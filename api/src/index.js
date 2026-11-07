/* ============================================================
   Mobile Home API  –  Cloudflare Worker + D1
   ------------------------------------------------------------
   Öffentlich:
     GET    /api/belegung              belegte Zeiträume (nur Daten, keine Gastdaten)
     POST   /api/anfragen              neue Buchungsanfrage von der Website
     GET    /api/kalender.ics          iCal-Export (für Airbnb/Booking/Google/Outlook)
     POST   /api/login                 Anmeldung Verwaltung → Token
   Verwaltung (Authorization: Bearer <token>):
     GET    /api/admin/ich
     GET    /api/admin/einstellungen   Preise & Regeln lesen
     PUT    /api/admin/einstellungen   Preise & Regeln speichern
     GET    /api/admin/buchungen       ?status=anfrage&ab=JJJJ-MM-TT
     POST   /api/admin/buchungen       Eintrag anlegen (Sperre / Buchung)
     PATCH  /api/admin/buchungen/:id   ändern, bestätigen, ablehnen …
     DELETE /api/admin/buchungen/:id   endgültig löschen
     POST   /api/admin/passwort        eigenes Passwort ändern
   ============================================================ */

const STATUS = ["anfrage", "bestaetigt", "abgelehnt", "storniert", "blockiert"];
const BLOCKIEREND = ["bestaetigt", "blockiert"];
const SQL_BLOCKIEREND = "('bestaetigt','blockiert')";
const PBKDF2_ITER = 100000;          // Obergrenze der Workers-Laufzeit
const TOKEN_STUNDEN = 12;
const enc = new TextEncoder();

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    let res;
    try {
      res = await route(request, env, ctx);
    } catch (e) {
      if (e instanceof HttpError) res = json({ fehler: e.message, ...e.extra }, e.status);
      else { console.error(e); res = json({ fehler: "Interner Fehler" }, 500); }
    }
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.allSettled([aufraeumen(env), mailPruefen(env)]));
  },
};

/* ---------------- Routing ---------------- */
async function route(req, env, ctx) {
  const url = new URL(req.url);
  const p = url.pathname.replace(/\/+$/, "") || "/";
  const m = req.method;

  // Schreibende Aufrufe nur von erlaubten Seiten (Browser senden immer Origin)
  const origin = req.headers.get("Origin");
  if (m !== "GET" && origin && !erlaubteOrigins(env).includes(origin)) throw new HttpError(403, "Herkunft nicht erlaubt");

  if (p === "/" || p === "/api") return json({ ok: true, dienst: "mobile-home-api" });
  if (p === "/api/belegung" && m === "GET") return belegung(env);
  if (p === "/api/kalender.ics" && m === "GET") return icsExport(env, url);
  if (p === "/api/anfragen" && m === "POST") return neueAnfrage(req, env, ctx);
  if (p === "/api/login" && m === "POST") return login(req, env);

  if (p.startsWith("/api/admin/")) {
    const user = await auth(req, env);
    if (p === "/api/admin/ich" && m === "GET") return json({ name: user });
    if (p === "/api/admin/passwort" && m === "POST") return passwortAendern(req, env, user);
    if (p === "/api/admin/einstellungen" && m === "GET") return json({ preise: await ladePreise(env) });
    if (p === "/api/admin/einstellungen" && m === "PUT") return preiseSpeichern(req, env, user);
    if (p === "/api/admin/buchungen" && m === "GET") return liste(env, url);
    if (p === "/api/admin/buchungen" && m === "POST") return anlegen(req, env, user);
    const mm = p.match(/^\/api\/admin\/buchungen\/([0-9a-f-]{36})$/);
    if (mm && m === "PATCH") return aendern(req, env, user, mm[1]);
    if (mm && m === "DELETE") return loeschen(env, mm[1]);
  }
  throw new HttpError(404, "Nicht gefunden");
}

/* ---------------- Öffentlich ---------------- */
async function belegung(env) {
  const [{ results }, p] = await Promise.all([
    env.DB.prepare(`SELECT von, bis FROM buchungen WHERE status IN ${SQL_BLOCKIEREND} AND bis > ? ORDER BY von`).bind(heute(env)).all(),
    ladePreise(env),
  ]);
  const { geaendert_am, geaendert_von, ...preise } = p;   // interne Felder nicht veröffentlichen
  return json({ belegt: results, preise, stand: new Date().toISOString() }, 200, { "Cache-Control": "public, max-age=60" });
}

async function neueAnfrage(req, env, ctx) {
  const d = await leseJson(req);
  if (d.website) return json({ ok: true }, 201);            // Honeypot: Bots füllen das versteckte Feld aus

  const schluessel = await ipSchluessel(req, env, "anfrage");
  await limitPruefen(env, schluessel, 5, 3600, "Zu viele Anfragen von diesem Anschluss – bitte später erneut versuchen oder per E-Mail melden.");

  const von = V.datum(d.von, "Anreise");
  const bis = V.datum(d.bis, "Abreise");
  const h = heute(env);
  const n = naechte(von, bis);
  const p = await ladePreise(env);
  const max = Number(env.MAX_NAECHTE || 60);
  if (von < h) throw new HttpError(400, "Die Anreise liegt in der Vergangenheit.");
  if (bis > horizontVon(h, p.buchbarMonateVoraus)) throw new HttpError(400, `Anfragen sind höchstens ${p.buchbarMonateVoraus} Monate im Voraus möglich.`);
  if (n < 1) throw new HttpError(400, "Die Abreise muss nach der Anreise liegen.");
  const s0 = saisonFuer(p, von);
  const min = (s0 && s0.minNaechte) || p.minNaechte;
  if (n < min) throw new HttpError(400, `Mindestaufenthalt${s0 && s0.minNaechte ? " in der " + s0.name : ""}: ${min} Nächte.`);
  if (n > max) throw new HttpError(400, `Höchstens ${max} Nächte pro Anfrage.`);
  const preis = preisBerechnen(p, von, bis);   // wirft, wenn Nächte außerhalb der Saison liegen
  if (d.datenschutz !== true) throw new HttpError(400, "Bitte bestätige die Datenschutzhinweise.");

  const b = {
    name: V.text(d.name, "Name", 100, true),
    email: V.email(d.email, true),
    telefon: V.text(d.telefon, "Telefon", 50),
    personen: V.int(d.personen, "Personen", 1, p.maxPersonen, true),
    nachricht: V.text(d.nachricht, "Nachricht", 2000),
    preis_web: preis,                            // serverseitig berechnet, nicht vom Browser übernommen
    sprache: ["de", "en", "hr", "sl"].includes(d.sprache) ? d.sprache : "de",
  };

  if ((await konflikte(env, von, bis)).length)
    throw new HttpError(409, "Der Zeitraum ist leider nicht mehr frei. Bitte wähle andere Daten.");

  await limitZaehlen(env, schluessel);
  const jetzt = new Date().toISOString();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO buchungen (id,status,von,bis,name,email,telefon,personen,nachricht,preis_web,sprache,quelle,erstellt_am,geaendert_am)
     VALUES (?,'anfrage',?,?,?,?,?,?,?,?,?,'web',?,?)`
  ).bind(id, von, bis, b.name, b.email, b.telefon, b.personen, b.nachricht, b.preis_web, b.sprache, jetzt, jetzt).run();

  // Gleichzeitig: Eingangsbestätigung an den Gast + Benachrichtigung an die Verwaltung
  const a = { id, von, bis, ...b };
  ctx.waitUntil(Promise.allSettled([
    eingangBestaetigen(env, a).catch(e => console.error("Eingangsbestätigung:", e)),
    benachrichtigen(env, a).catch(e => console.error("Benachrichtigung:", e)),
  ]));
  return json({ ok: true }, 201);
}

async function icsExport(env, url) {
  if (env.ICS_TOKEN && url.searchParams.get("token") !== env.ICS_TOKEN) throw new HttpError(403, "Token fehlt oder ist falsch");
  const { results } = await env.DB
    .prepare(`SELECT id, von, bis FROM buchungen WHERE status IN ${SQL_BLOCKIEREND} AND bis >= ? ORDER BY von`)
    .bind(plusTage(heute(env), -30)).all();
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const zeilen = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mobile Home//Belegung//DE",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Mobile Home Belegung",
  ];
  for (const b of results) {
    zeilen.push(
      "BEGIN:VEVENT", `UID:${b.id}@mobile-home`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${b.von.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${b.bis.replace(/-/g, "")}`,
      "SUMMARY:Belegt", "TRANSP:OPAQUE", "END:VEVENT"
    );
  }
  zeilen.push("END:VCALENDAR");
  return new Response(zeilen.join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}

/* ---------------- Anmeldung ---------------- */
async function login(req, env) {
  const d = await leseJson(req);
  const schluessel = await ipSchluessel(req, env, "login");
  await limitPruefen(env, schluessel, 10, 900, "Zu viele Fehlversuche – bitte 15 Minuten warten.");

  const name = typeof d.name === "string" ? d.name.trim() : "";
  const passwort = typeof d.passwort === "string" ? d.passwort : "";
  const u = name ? await env.DB.prepare("SELECT name, pw_hash FROM benutzer WHERE name = ? COLLATE NOCASE").bind(name).first() : null;
  // Auch bei unbekanntem Namen rechnen, damit die Antwortzeit nichts verrät
  const ok = await passwortPruefen(passwort, u ? u.pw_hash : "pbkdf2$" + PBKDF2_ITER + "$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
  if (!u || !ok) {
    await limitZaehlen(env, schluessel);
    throw new HttpError(401, "Name oder Passwort falsch.");
  }
  return json({ token: await tokenErstellen(env, u.name), name: u.name, gueltigStunden: TOKEN_STUNDEN });
}

async function auth(req, env) {
  const m = (req.headers.get("Authorization") || "").match(/^Bearer ([\w-]+)\.([\w-]+)$/);
  if (!m) throw new HttpError(401, "Bitte anmelden.");
  let p;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(env), unb64url(m[2]), enc.encode(m[1]));
    if (!ok) throw new Error();
    p = JSON.parse(new TextDecoder().decode(unb64url(m[1])));
  } catch { throw new HttpError(401, "Bitte erneut anmelden."); }
  if (!p.exp || p.exp < Date.now()) throw new HttpError(401, "Sitzung abgelaufen – bitte erneut anmelden.");
  const u = await env.DB.prepare("SELECT name FROM benutzer WHERE name = ?").bind(p.u).first();
  if (!u) throw new HttpError(401, "Zugang existiert nicht mehr.");
  return u.name;
}

async function passwortAendern(req, env, user) {
  const d = await leseJson(req);
  const u = await env.DB.prepare("SELECT pw_hash FROM benutzer WHERE name = ?").bind(user).first();
  if (!(await passwortPruefen(String(d.alt || ""), u.pw_hash))) throw new HttpError(400, "Das bisherige Passwort stimmt nicht.");
  const neu = String(d.neu || "");
  if (neu.length < 12) throw new HttpError(400, "Das neue Passwort muss mindestens 12 Zeichen haben.");
  await env.DB.prepare("UPDATE benutzer SET pw_hash = ? WHERE name = ?").bind(await passwortHash(neu), user).run();
  return json({ ok: true });
}

/* ---------------- Verwaltung ---------------- */
async function liste(env, url) {
  let sql = "SELECT * FROM buchungen WHERE 1=1";
  const args = [];
  const status = url.searchParams.get("status");
  const ab = url.searchParams.get("ab");
  if (status) { sql += " AND status = ?"; args.push(V.status(status)); }
  if (ab) { sql += " AND bis >= ?"; args.push(V.datum(ab, "ab")); }
  sql += " ORDER BY von LIMIT 2000";
  const { results } = await env.DB.prepare(sql).bind(...args).all();
  return json({ buchungen: results, heute: heute(env), mail: await mailStatus(env) });
}

async function anlegen(req, env, user) {
  const d = await leseJson(req);
  const f = adminFelder(d, { status: "blockiert" });
  const id = crypto.randomUUID();
  const jetzt = new Date().toISOString();
  const mailAm = d.bestaetigung_gesendet === true ? jetzt : null;
  const r = await env.DB.prepare(
    `INSERT INTO buchungen (id,status,von,bis,name,email,telefon,personen,nachricht,notiz,quelle,erstellt_am,geaendert_am,geaendert_von,bestaetigung_gesendet_am)
     SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,'verwaltung',?11,?11,?12,?13
     WHERE ?2 NOT IN ${SQL_BLOCKIEREND} OR NOT EXISTS (
       SELECT 1 FROM buchungen WHERE status IN ${SQL_BLOCKIEREND} AND von < ?4 AND bis > ?3)`
  ).bind(id, f.status, f.von, f.bis, f.name, f.email, f.telefon, f.personen, f.nachricht, f.notiz, jetzt, user, mailAm).run();
  if (!r.meta.changes) await konfliktFehler(env, f.von, f.bis, id);
  return json({ buchung: await eintrag(env, id) }, 201);
}

async function aendern(req, env, user, id) {
  const d = await leseJson(req);
  const alt = await eintrag(env, id);
  if (!alt) throw new HttpError(404, "Eintrag nicht gefunden – wurde er gelöscht?");
  if (d.geaendert_am && d.geaendert_am !== alt.geaendert_am)
    throw new HttpError(409, "Der Eintrag wurde inzwischen von jemand anderem geändert. Bitte neu laden.", { veraltet: true });

  const f = adminFelder(d, alt);
  const jetzt = new Date().toISOString();
  // Merker „Bestätigungs-Mail gesendet“: true → Zeitpunkt setzen (vorhandenen behalten), false → zurücksetzen
  const mailAm = "bestaetigung_gesendet" in d
    ? (d.bestaetigung_gesendet === true ? (alt.bestaetigung_gesendet_am || jetzt) : null)
    : alt.bestaetigung_gesendet_am;
  const r = await env.DB.prepare(
    `UPDATE buchungen SET status=?2, von=?3, bis=?4, name=?5, email=?6, telefon=?7, personen=?8,
       nachricht=?9, notiz=?10, geaendert_am=?11, geaendert_von=?12, bestaetigung_gesendet_am=?14
     WHERE id=?1 AND geaendert_am=?13 AND (?2 NOT IN ${SQL_BLOCKIEREND} OR NOT EXISTS (
       SELECT 1 FROM buchungen b WHERE b.id != ?1 AND b.status IN ${SQL_BLOCKIEREND} AND b.von < ?4 AND b.bis > ?3))`
  ).bind(id, f.status, f.von, f.bis, f.name, f.email, f.telefon, f.personen, f.nachricht, f.notiz, jetzt, user, alt.geaendert_am, mailAm).run();

  if (!r.meta.changes) {
    const jetzt2 = await eintrag(env, id);
    if (!jetzt2) throw new HttpError(404, "Eintrag nicht gefunden – wurde er gelöscht?");
    if (jetzt2.geaendert_am !== alt.geaendert_am)
      throw new HttpError(409, "Der Eintrag wurde gerade von jemand anderem geändert. Bitte neu laden.", { veraltet: true });
    await konfliktFehler(env, f.von, f.bis, id);
  }
  return json({ buchung: await eintrag(env, id) });
}

async function loeschen(env, id) {
  const r = await env.DB.prepare("DELETE FROM buchungen WHERE id = ?").bind(id).run();
  if (!r.meta.changes) throw new HttpError(404, "Eintrag nicht gefunden.");
  return json({ ok: true });
}

function adminFelder(d, alt) {
  const nimm = k => (k in d ? d[k] : alt[k]);
  const status = V.status(nimm("status"));
  const von = V.datum(nimm("von"), "Anreise");
  const bis = V.datum(nimm("bis"), "Abreise");
  if (bis <= von) throw new HttpError(400, "Die Abreise muss nach der Anreise liegen.");
  if (naechte(von, bis) > 400) throw new HttpError(400, "Zeitraum zu lang (max. 400 Nächte).");
  return {
    status, von, bis,
    name: V.text(nimm("name"), "Name", 100),
    email: V.email(nimm("email")),
    telefon: V.text(nimm("telefon"), "Telefon", 50),
    personen: V.int(nimm("personen"), "Personen", 1, 50),
    nachricht: V.text(nimm("nachricht"), "Nachricht", 2000),
    notiz: V.text(nimm("notiz"), "Notiz", 2000),
  };
}

const eintrag = (env, id) => env.DB.prepare("SELECT * FROM buchungen WHERE id = ?").bind(id).first();

async function konflikte(env, von, bis, ohneId = "") {
  const { results } = await env.DB.prepare(
    `SELECT id, status, von, bis, name FROM buchungen
     WHERE status IN ${SQL_BLOCKIEREND} AND von < ? AND bis > ? AND id != ? ORDER BY von`
  ).bind(bis, von, ohneId).all();
  return results;
}

async function konfliktFehler(env, von, bis, ohneId) {
  const k = await konflikte(env, von, bis, ohneId);
  throw new HttpError(409, "Überschneidung mit einem bestätigten oder gesperrten Zeitraum.", { konflikte: k });
}

/* ---------------- Preise & Regeln ---------------- */
const STANDARD_PREISE = {
  standardPreis: 75, endreinigung: 60, minNaechte: 3, maxPersonen: 5,
  buchbarMonateVoraus: 18, nurInSaisonBuchbar: false, saisons: [],   // Camp ist ganzjährig geöffnet
};

async function ladePreise(env) {
  const r = await env.DB.prepare("SELECT wert, geaendert_am, geaendert_von FROM einstellungen WHERE schluessel = 'preise'").first();
  if (!r) return { ...STANDARD_PREISE, geaendert_am: null, geaendert_von: null };
  return { ...STANDARD_PREISE, ...JSON.parse(r.wert), geaendert_am: r.geaendert_am, geaendert_von: r.geaendert_von };
}

// Saison für eine Nacht: feste Zeiträume (Sonderzeiträume) haben Vorrang vor jährlichen Saisons.
// Jährliche Saisons speichern von/bis als "MM-TT" und dürfen über den Jahreswechsel gehen (z. B. 12-20 bis 01-06).
const imJahresbereich = (md, s) => (s.von <= s.bis ? md >= s.von && md <= s.bis : md >= s.von || md <= s.bis);
const saisonFuer = (p, ds) =>
  p.saisons.find(s => !s.jaehrlich && s.von <= ds && ds <= s.bis) ||
  p.saisons.find(s => s.jaehrlich && imJahresbereich(ds.slice(5), s));

function preisBerechnen(p, von, bis) {
  let summe = 0;
  for (let d = von; d < bis; d = plusTage(d, 1)) {
    const s = saisonFuer(p, d);
    if (s) summe += s.preisProNacht;
    else if (p.nurInSaisonBuchbar) throw new HttpError(400, `Die Nacht ab ${deDatum(d)} ist nicht buchbar (außerhalb der Saison).`);
    else summe += p.standardPreis;
  }
  return summe + p.endreinigung;
}

// Erster Tag nach dem buchbaren Zeitraum (wie im Kalender der Website)
function horizontVon(h, monate) {
  const [y, m] = h.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + monate + 1, 1)).toISOString().slice(0, 10);
}

function preisePruefen(d) {
  const zahl = (v, feld, min, max) => V.int(v, feld, min, max, true);
  const p = {
    standardPreis: zahl(d.standardPreis, "Standardpreis", 0, 10000),
    endreinigung: zahl(d.endreinigung, "Endreinigung", 0, 10000),
    minNaechte: zahl(d.minNaechte, "Mindestnächte", 1, 60),
    maxPersonen: zahl(d.maxPersonen, "Max. Personen", 1, 50),
    buchbarMonateVoraus: zahl(d.buchbarMonateVoraus, "Buchbar im Voraus", 2, 36),
    nurInSaisonBuchbar: d.nurInSaisonBuchbar === true,
  };
  if (!Array.isArray(d.saisons) || d.saisons.length > 100) throw new HttpError(400, "Saisons: Liste mit höchstens 100 Einträgen erwartet.");
  p.saisons = d.saisons.map((s, i) => {
    if (!s || typeof s !== "object") throw new HttpError(400, `Saison ${i + 1}: ungültig.`);
    const nr = `Saison ${i + 1}`;
    const jaehrlich = s.jaehrlich === true;
    const r = {
      name: V.text(s.name, `${nr}: Name`, 40, true),
      von: jaehrlich ? V.monatTag(s.von, `${nr}: Von`) : V.datum(s.von, `${nr}: Von`),
      bis: jaehrlich ? V.monatTag(s.bis, `${nr}: Bis`) : V.datum(s.bis, `${nr}: Bis`),
      preisProNacht: zahl(s.preisProNacht, `${nr}: Preis pro Nacht`, 0, 10000),
    };
    if (jaehrlich) r.jaehrlich = true;
    const mn = V.int(s.minNaechte, `${nr}: Mindestnächte`, 1, 60);
    if (mn) r.minNaechte = mn;
    if (!jaehrlich && r.bis < r.von) throw new HttpError(400, `${nr} („${r.name}“): „bis“ liegt vor „von“.`);
    return r;
  }).sort((a, b) => (!!b.jaehrlich - !!a.jaehrlich) || a.von.localeCompare(b.von));

  // Überschneidungen: feste Zeiträume untereinander und jährliche untereinander.
  // (Ein fester Zeitraum darf eine jährliche Saison überlagern – er gilt dann vorrangig.)
  const fest = p.saisons.filter(s => !s.jaehrlich);
  for (let i = 1; i < fest.length; i++) {
    const a = fest[i - 1], b = fest[i];
    if (b.von <= a.bis)
      throw new HttpError(400, `Zeiträume überschneiden sich: „${a.name}“ (${deDatum(a.von)}–${deDatum(a.bis)}) und „${b.name}“ (${deDatum(b.von)}–${deDatum(b.bis)}).`);
  }
  const abschnitte = s => (s.von <= s.bis ? [[s.von, s.bis]] : [[s.von, "12-31"], ["01-01", s.bis]]);
  const jahr = p.saisons.filter(s => s.jaehrlich);
  for (let i = 0; i < jahr.length; i++) for (let j = i + 1; j < jahr.length; j++) {
    const ueber = abschnitte(jahr[i]).some(([a1, a2]) => abschnitte(jahr[j]).some(([b1, b2]) => a1 <= b2 && b1 <= a2));
    if (ueber) throw new HttpError(400, `Jährliche Saisons überschneiden sich: „${jahr[i].name}“ und „${jahr[j].name}“.`);
  }
  return p;
}

async function preiseSpeichern(req, env, user) {
  const d = await leseJson(req);
  const p = preisePruefen(d);
  const jetzt = new Date().toISOString();
  const r = await env.DB.prepare(
    `INSERT INTO einstellungen (schluessel, wert, geaendert_am, geaendert_von) VALUES ('preise', ?1, ?2, ?3)
     ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert, geaendert_am = excluded.geaendert_am, geaendert_von = excluded.geaendert_von
     WHERE einstellungen.geaendert_am IS ?4`
  ).bind(JSON.stringify(p), jetzt, user, d.geaendert_am ?? null).run();
  if (!r.meta.changes)
    throw new HttpError(409, "Die Preise wurden inzwischen von jemand anderem geändert. Bitte neu laden.", { veraltet: true });
  return json({ preise: await ladePreise(env) });
}

/* ---------------- E-Mails (Brevo oder Resend – je nachdem, welcher Schlüssel hinterlegt ist) ---------------- */
// Benötigt: BREVO_API_KEY oder RESEND_API_KEY (Secret), MAIL_ABSENDER_ADRESSE (Var, Domain beim Dienst bestätigt)
const mailAktiv = env => !!((env.BREVO_API_KEY || env.RESEND_API_KEY) && env.MAIL_ABSENDER_ADRESSE);

async function mailSenden(env, { an, betreff, text, html, antwortAn }) {
  if (!mailAktiv(env)) return false;
  const name = env.MAIL_ABSENDER_NAME || "Mobile Home";
  const empfaenger = (Array.isArray(an) ? an : [an]).filter(Boolean);
  if (!empfaenger.length) return false;
  let r;
  if (env.BREVO_API_KEY) {
    r = await fetch(env.BREVO_API_URL || "https://api.brevo.com/v3/smtp/email", {   // BREVO_API_URL nur für lokale Tests
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name, email: env.MAIL_ABSENDER_ADRESSE },
        to: empfaenger.map(email => ({ email })),
        subject: betreff, textContent: text, htmlContent: html,
        ...(antwortAn ? { replyTo: { email: antwortAn } } : {}),
      }),
    });
  } else {
    r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${name} <${env.MAIL_ABSENDER_ADRESSE}>`, to: empfaenger,
        subject: betreff, text, html, ...(antwortAn ? { reply_to: antwortAn } : {}),
      }),
    });
  }
  if (!r.ok) {
    const fehler = `${r.status} ${(await r.text()).slice(0, 200)}`;
    console.error("Mailversand", fehler);
    await mailStatusSetzen(env, false, fehler);
    return false;
  }
  await mailStatusSetzen(env, true);
  return true;
}

// Zustand des Mailversands (für den Hinweis in der Verwaltung)
async function mailStatusSetzen(env, ok, fehler = null) {
  try {
    await env.DB.prepare(
      `INSERT INTO einstellungen (schluessel, wert, geaendert_am, geaendert_von) VALUES ('mailstatus', ?1, ?2, 'System')
       ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert, geaendert_am = excluded.geaendert_am`
    ).bind(JSON.stringify({ ok, fehler }), new Date().toISOString()).run();
  } catch (e) { console.error("Mailstatus", e); }
}
async function mailStatus(env) {
  const r = await env.DB.prepare("SELECT wert, geaendert_am FROM einstellungen WHERE schluessel = 'mailstatus'").first();
  return { aktiv: mailAktiv(env), dienst: env.BREVO_API_KEY ? "Brevo" : env.RESEND_API_KEY ? "Resend" : null,
    ...(r ? JSON.parse(r.wert) : {}), stand: r ? r.geaendert_am : null };
}
// Tägliche Prüfung (Cron): hält den Brevo-Schlüssel aktiv – Brevo-Schlüssel verfallen nach 90 Tagen ohne Nutzung –
// und meldet einen ungültigen oder abgelaufenen Schlüssel in der Verwaltung
async function mailPruefen(env) {
  if (!mailAktiv(env) || !env.BREVO_API_KEY) return;
  try {
    const basis = env.BREVO_API_URL ? env.BREVO_API_URL.replace(/\/[^/]*$/, "") : "https://api.brevo.com/v3";
    const r = await fetch(`${basis}/smtp/statistics/aggregatedReport?days=1`, { headers: { "api-key": env.BREVO_API_KEY, Accept: "application/json" } });
    await mailStatusSetzen(env, r.ok, r.ok ? null : `${r.status} ${(await r.text()).slice(0, 200)}`);
  } catch (e) {
    await mailStatusSetzen(env, false, String(e).slice(0, 200));
  }
}

const htmlEsc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Nur den Vornamen verwenden und alles verwerfen, was nach Link/Spam aussieht (Formular ist öffentlich)
const sichererVorname = n => { const v = String(n || "").trim().split(/\s+/)[0].slice(0, 30); return /[/:@<>\\]|www|http|\.\w{2,}/i.test(v) ? "" : v; };

const LOCALE = { de: "de-DE", en: "en-GB", hr: "hr-HR", sl: "sl-SI" };
const EINGANG = {
  de: {
    betreff: h => `Deine Anfrage ist angekommen – ${h}`,
    hallo: n => `Hallo${n ? " " + n : ""},`,
    intro: "vielen Dank für deine Anfrage! Sie ist bei uns angekommen:",
    felder: ["Anreise", "Abreise", "Nächte", "Personen", "Preis (ca.)"], inkl: "inkl. Endreinigung",
    weiter: "Die Anfrage ist unverbindlich. Wir prüfen die Verfügbarkeit und melden uns innerhalb von 24 Stunden mit einer Bestätigung oder Rückfrage.",
    fragen: "Fragen? Antworte einfach auf diese E-Mail.", gruss: "Viele Grüße",
    fuss: w => `Diese E-Mail wurde automatisch verschickt, weil auf ${w} eine Anfrage mit dieser Adresse gestellt wurde. Falls du das nicht warst, kannst du sie ignorieren.`,
  },
  en: {
    betreff: h => `We've received your enquiry – ${h}`,
    hallo: n => `Hello${n ? " " + n : ""},`,
    intro: "Thank you for your enquiry! We have received it:",
    felder: ["Arrival", "Departure", "Nights", "Guests", "Price (approx.)"], inkl: "incl. final cleaning",
    weiter: "Your enquiry is non-binding. We'll check availability and get back to you within 24 hours with a confirmation or a question.",
    fragen: "Questions? Simply reply to this email.", gruss: "Best regards",
    fuss: w => `This email was sent automatically because an enquiry was made on ${w} using this address. If this wasn't you, you can ignore it.`,
  },
  hr: {
    betreff: h => `Zaprimili smo tvoj upit – ${h}`,
    hallo: n => `Pozdrav${n ? " " + n : ""},`,
    intro: "hvala na upitu! Zaprimili smo ga:",
    felder: ["Dolazak", "Odlazak", "Noći", "Osobe", "Cijena (otprilike)"], inkl: "uključujući završno čišćenje",
    weiter: "Upit je neobvezujući. Provjerit ćemo dostupnost i javiti ti se u roku od 24 sata s potvrdom ili pitanjem.",
    fragen: "Pitanja? Jednostavno odgovori na ovu e-poruku.", gruss: "Srdačan pozdrav",
    fuss: w => `Ova je e-poruka poslana automatski jer je na ${w} poslan upit s ovom adresom. Ako to nisi bio/bila ti, slobodno je zanemari.`,
  },
  sl: {
    betreff: h => `Prejeli smo tvoje povpraševanje – ${h}`,
    hallo: n => `Dober dan${n ? ", " + n : ""},`,
    intro: "hvala za povpraševanje! Prejeli smo ga:",
    felder: ["Prihod", "Odhod", "Noči", "Osebe", "Cena (približno)"], inkl: "vključno s končnim čiščenjem",
    weiter: "Povpraševanje je nezavezujoče. Preverili bomo razpoložljivost in se ti v 24 urah oglasili s potrditvijo ali vprašanjem.",
    fragen: "Vprašanja? Preprosto odgovori na to e-pošto.", gruss: "Lep pozdrav",
    fuss: w => `To e-sporočilo je bilo poslano samodejno, ker je bilo na ${w} poslano povpraševanje s tem naslovom. Če to nisi bil/a ti, ga lahko prezreš.`,
  },
};

// Automatische Eingangsbestätigung an den Gast (in seiner Sprache)
async function eingangBestaetigen(env, a) {
  if (!mailAktiv(env) || !a.email) return;
  // Schutz gegen Missbrauch des öffentlichen Formulars: höchstens 40 automatische Gäste-Mails pro Tag
  const tagSchluessel = "mail:gast";
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM rate_limit WHERE schluessel = ? AND zeit > ?").bind(tagSchluessel, Date.now() - 86400000).first();
  if (n.n >= 40) { console.error("Tageslimit Eingangsbestätigungen erreicht"); return; }

  const l = EINGANG[a.sprache] ? a.sprache : "de", T = EINGANG[l], loc = LOCALE[l];
  const haus = env.MAIL_ABSENDER_NAME || "Mobile Home";
  const web = (env.WEBSITE_URL || "").replace(/\/+$/, "");
  const webSprache = web ? `${web}/?lang=${l}` : "";
  const datum = s => new Date(s + "T12:00:00Z").toLocaleDateString(loc, { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  const preis = a.preis_web != null ? new Intl.NumberFormat(loc, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(a.preis_web) + " " + T.inkl : "";
  const zeilen = [[T.felder[0], datum(a.von)], [T.felder[1], datum(a.bis)], [T.felder[2], naechte(a.von, a.bis)], [T.felder[3], a.personen]];
  if (preis) zeilen.push([T.felder[4], preis]);
  const vorname = sichererVorname(a.name);
  const breite = Math.max(...zeilen.map(z => z[0].length)) + 2;

  const text = [
    T.hallo(vorname), "", T.intro, "",
    ...zeilen.map(([k, v]) => (k + ":").padEnd(breite) + v), "",
    T.weiter, "", T.fragen, "", T.gruss, haus, webSprache, "", "—", T.fuss(web || haus),
  ].join("\n");
  const html = `<!doctype html><html lang="${l}"><body style="margin:0;background:#f4f6f7;font-family:Arial,Helvetica,sans-serif;color:#0c1a20">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#ffffff;border:1px solid #e4e9eb;border-radius:12px;padding:24px">
<p style="margin:0 0 6px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#0e5e73;font-weight:bold">${htmlEsc(haus)}</p>
<p style="margin:0 0 16px;font-size:16px">${htmlEsc(T.hallo(vorname))}</p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.5">${htmlEsc(T.intro)}</p>
<table style="border-collapse:collapse;width:100%;font-size:15px;margin:0 0 16px">${zeilen.map(([k, v]) =>
  `<tr><td style="padding:7px 0;color:#5b6b72;border-bottom:1px solid #eef1f2;width:42%">${htmlEsc(k)}</td><td style="padding:7px 0;border-bottom:1px solid #eef1f2;font-weight:bold">${htmlEsc(v)}</td></tr>`).join("")}</table>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${htmlEsc(T.weiter)}</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.5">${htmlEsc(T.fragen)}</p>
<p style="margin:0;font-size:15px">${htmlEsc(T.gruss)}<br><b>${htmlEsc(haus)}</b>${webSprache ? `<br><a href="${htmlEsc(webSprache)}" style="color:#0e5e73">${htmlEsc(web.replace(/^https?:\/\//, ""))}</a>` : ""}</p>
</div>
<p style="margin:14px 4px 0;font-size:12px;line-height:1.5;color:#5b6b72">${htmlEsc(T.fuss(web.replace(/^https?:\/\//, "") || haus))}</p>
</div></body></html>`;

  const ok = await mailSenden(env, { an: a.email, betreff: T.betreff(haus), text, html, antwortAn: env.MAIL_ANTWORT_AN });
  if (ok) {
    await limitZaehlen(env, tagSchluessel);
    await env.DB.prepare("UPDATE buchungen SET eingang_mail_am = ? WHERE id = ?").bind(new Date().toISOString(), a.id).run();
  }
}

// Benachrichtigung an die Verwaltung (NOTIFY_TO) – bewusst ohne Name/Kontaktdaten des Gastes
async function benachrichtigen(env, a) {
  const an = (env.NOTIFY_TO || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!mailAktiv(env) || !an.length) return;
  const zeitraum = `${deDatum(a.von)} – ${deDatum(a.bis)}`;
  const n = naechte(a.von, a.bis);
  const sprachen = { de: "Deutsch", en: "Englisch", hr: "Kroatisch", sl: "Slowenisch" };
  const preis = a.preis_web != null ? `${a.preis_web} € (inkl. Endreinigung)` : "–";
  const admin = env.ADMIN_URL || "";
  const zeilen = [["Zeitraum", zeitraum], ["Nächte", n], ["Personen", a.personen], ["Preis (berechnet)", preis], ["Sprache", sprachen[a.sprache] || a.sprache]];
  const text = `Neue Buchungsanfrage über die Website\n\n${zeilen.map(([k, v]) => (k + ":").padEnd(19) + v).join("\n")}\n\n` +
    `Anfrage ansehen und bestätigen:\n${admin}\n\n(Name und Kontaktdaten des Gastes stehen aus Datenschutzgründen nur in der Verwaltung.)`;
  const html = `<!doctype html><html lang="de"><body style="margin:0;background:#f4f6f7;font-family:Arial,Helvetica,sans-serif;color:#0c1a20">
<div style="max-width:560px;margin:0 auto;padding:24px 16px"><div style="background:#fff;border:1px solid #e4e9eb;border-radius:12px;padding:24px">
<p style="margin:0 0 14px;font-size:18px;font-weight:bold">Neue Buchungsanfrage</p>
<table style="border-collapse:collapse;width:100%;font-size:15px;margin:0 0 20px">${zeilen.map(([k, v]) =>
  `<tr><td style="padding:7px 0;color:#5b6b72;border-bottom:1px solid #eef1f2;width:42%">${htmlEsc(k)}</td><td style="padding:7px 0;border-bottom:1px solid #eef1f2;font-weight:bold">${htmlEsc(v)}</td></tr>`).join("")}</table>
${admin ? `<a href="${htmlEsc(admin)}" style="display:inline-block;background:#0e5e73;color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:9px">In der Verwaltung öffnen</a>` : ""}
<p style="margin:18px 0 0;font-size:12px;color:#5b6b72">Name und Kontaktdaten des Gastes stehen aus Datenschutzgründen nur in der Verwaltung.</p>
</div></div></body></html>`;
  await mailSenden(env, { an, betreff: `Neue Anfrage: ${zeitraum} (${n} Nächte, ${a.personen} Pers.)`, text, html });
}

/* ---------------- Tägliche Bereinigung (Datenschutz) ---------------- */
async function aufraeumen(env) {
  const h = heute(env);
  const loeschenTage = Number(env.LOESCHEN_NACH_TAGEN || 180);
  const anonTage = Number(env.ANONYMISIEREN_NACH_TAGEN || 365);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM rate_limit WHERE zeit < ?").bind(Date.now() - 86400000),
    env.DB.prepare("DELETE FROM buchungen WHERE status IN ('abgelehnt','storniert') AND geaendert_am < ?")
      .bind(new Date(Date.now() - loeschenTage * 86400000).toISOString()),
    env.DB.prepare("DELETE FROM buchungen WHERE status = 'anfrage' AND bis < ?").bind(plusTage(h, -30)),
    env.DB.prepare(
      `UPDATE buchungen SET name = NULL, email = NULL, telefon = NULL, nachricht = NULL,
         notiz = CASE WHEN notiz IS NULL THEN NULL ELSE '[anonymisiert]' END
       WHERE status = 'bestaetigt' AND bis < ?
         AND (name IS NOT NULL OR email IS NOT NULL OR telefon IS NOT NULL OR nachricht IS NOT NULL)`
    ).bind(plusTage(h, -anonTage)),
  ]);
}

/* ---------------- Validierung ---------------- */
const V = {
  datum(v, feld) {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new HttpError(400, `${feld}: Datum im Format JJJJ-MM-TT erwartet.`);
    const d = new Date(v + "T00:00:00Z");
    if (isNaN(d) || d.toISOString().slice(0, 10) !== v) throw new HttpError(400, `${feld}: ungültiges Datum.`);
    return v;
  },
  monatTag(v, feld) {   // "MM-TT" für jährlich wiederkehrende Saisons (29.02. erlaubt)
    const m = typeof v === "string" && v.match(/^(\d{2})-(\d{2})$/);
    if (!m) throw new HttpError(400, `${feld}: Tag und Monat im Format MM-TT erwartet.`);
    const mon = Number(m[1]), tag = Number(m[2]);
    if (mon < 1 || mon > 12 || tag < 1 || tag > new Date(Date.UTC(2024, mon, 0)).getUTCDate()) throw new HttpError(400, `${feld}: ungültiger Tag/Monat.`);
    return v;
  },
  text(v, feld, max, pflicht = false) {
    if (v == null || v === "") { if (pflicht) throw new HttpError(400, `${feld} fehlt.`); return null; }
    if (typeof v !== "string") throw new HttpError(400, `${feld}: Text erwartet.`);
    const s = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
    if (!s) { if (pflicht) throw new HttpError(400, `${feld} fehlt.`); return null; }
    if (s.length > max) throw new HttpError(400, `${feld}: höchstens ${max} Zeichen.`);
    return s;
  },
  email(v, pflicht = false) {
    const s = V.text(v, "E-Mail", 200, pflicht);
    if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) throw new HttpError(400, "Bitte eine gültige E-Mail-Adresse angeben.");
    return s;
  },
  int(v, feld, min, max, pflicht = false) {
    if (v == null || v === "") { if (pflicht) throw new HttpError(400, `${feld} fehlt.`); return null; }
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `${feld}: Zahl zwischen ${min} und ${max} erwartet.`);
    return n;
  },
  status(v) {
    if (!STATUS.includes(v)) throw new HttpError(400, `Unbekannter Status: ${String(v).slice(0, 20)}`);
    return v;
  },
};

/* ---------------- Rate-Limit (IP nur gehasht) ---------------- */
async function ipSchluessel(req, env, zweck) {
  const ip = req.headers.get("CF-Connecting-IP") || "unbekannt";
  const h = await crypto.subtle.digest("SHA-256", enc.encode(`${zweck}|${ip}|${env.SESSION_SECRET || ""}`));
  return `${zweck}:${b64url(h).slice(0, 22)}`;
}
async function limitPruefen(env, schluessel, max, fensterSek, meldung) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM rate_limit WHERE schluessel = ? AND zeit > ?")
    .bind(schluessel, Date.now() - fensterSek * 1000).first();
  if (r.n >= max) throw new HttpError(429, meldung);
}
const limitZaehlen = (env, schluessel) =>
  env.DB.prepare("INSERT INTO rate_limit (schluessel, zeit) VALUES (?, ?)").bind(schluessel, Date.now()).run();

/* ---------------- Krypto ---------------- */
async function hmacKey(env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new HttpError(500, "Server nicht eingerichtet (SESSION_SECRET fehlt).");
  return crypto.subtle.importKey("raw", enc.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function tokenErstellen(env, name) {
  const payload = b64url(enc.encode(JSON.stringify({ u: name, exp: Date.now() + TOKEN_STUNDEN * 3600000 })));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}
async function pbkdf2(passwort, salt, iter) {
  const key = await crypto.subtle.importKey("raw", enc.encode(passwort), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256));
}
async function passwortHash(passwort) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITER}$${b64(salt)}$${b64(await pbkdf2(passwort, salt, PBKDF2_ITER))}`;
}
async function passwortPruefen(passwort, gespeichert) {
  const [algo, iterS, saltS, hashS] = String(gespeichert).split("$");
  const iter = Number(iterS);
  if (algo !== "pbkdf2" || !(iter > 0 && iter <= PBKDF2_ITER)) return false;
  const ist = await pbkdf2(passwort, unb64(saltS), iter);
  const soll = unb64(hashS);
  if (ist.length !== soll.length) return false;
  if (crypto.subtle.timingSafeEqual) return crypto.subtle.timingSafeEqual(ist, soll);
  let x = 0; for (let i = 0; i < ist.length; i++) x |= ist[i] ^ soll[i];
  return x === 0;
}
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64url = buf => b64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = s => unb64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));

/* ---------------- Hilfsfunktionen ---------------- */
class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
}
async function leseJson(req) {
  const t = await req.text();
  if (t.length > 20000) throw new HttpError(413, "Anfrage zu groß.");
  let d;
  try { d = JSON.parse(t); } catch { throw new HttpError(400, "Ungültiges JSON."); }
  if (!d || typeof d !== "object" || Array.isArray(d)) throw new HttpError(400, "Ungültige Daten.");
  return d;
}
const erlaubteOrigins = env => (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
function corsHeaders(req, env) {
  const origin = req.headers.get("Origin");
  const h = { Vary: "Origin" };
  if (origin && erlaubteOrigins(env).includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}
const heute = env => new Intl.DateTimeFormat("sv-SE", { timeZone: env.ZEITZONE || "Europe/Zagreb" }).format(new Date());
function plusTage(s, n) { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const naechte = (von, bis) => Math.round((Date.parse(bis) - Date.parse(von)) / 86400000);
const deDatum = s => s.split("-").reverse().join(".");
