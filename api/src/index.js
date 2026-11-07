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
    ctx.waitUntil(aufraeumen(env));
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
  await env.DB.prepare(
    `INSERT INTO buchungen (id,status,von,bis,name,email,telefon,personen,nachricht,preis_web,sprache,quelle,erstellt_am,geaendert_am)
     VALUES (?,'anfrage',?,?,?,?,?,?,?,?,?,'web',?,?)`
  ).bind(crypto.randomUUID(), von, bis, b.name, b.email, b.telefon, b.personen, b.nachricht, b.preis_web, b.sprache, jetzt, jetzt).run();

  ctx.waitUntil(benachrichtigen(env, { von, bis, personen: b.personen }).catch(e => console.error("Benachrichtigung:", e)));
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
  return json({ buchungen: results, heute: heute(env) });
}

async function anlegen(req, env, user) {
  const f = adminFelder(await leseJson(req), { status: "blockiert" });
  const id = crypto.randomUUID();
  const jetzt = new Date().toISOString();
  const r = await env.DB.prepare(
    `INSERT INTO buchungen (id,status,von,bis,name,email,telefon,personen,nachricht,notiz,quelle,erstellt_am,geaendert_am,geaendert_von)
     SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,'verwaltung',?11,?11,?12
     WHERE ?2 NOT IN ${SQL_BLOCKIEREND} OR NOT EXISTS (
       SELECT 1 FROM buchungen WHERE status IN ${SQL_BLOCKIEREND} AND von < ?4 AND bis > ?3)`
  ).bind(id, f.status, f.von, f.bis, f.name, f.email, f.telefon, f.personen, f.nachricht, f.notiz, jetzt, user).run();
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
  const r = await env.DB.prepare(
    `UPDATE buchungen SET status=?2, von=?3, bis=?4, name=?5, email=?6, telefon=?7, personen=?8,
       nachricht=?9, notiz=?10, geaendert_am=?11, geaendert_von=?12
     WHERE id=?1 AND geaendert_am=?13 AND (?2 NOT IN ${SQL_BLOCKIEREND} OR NOT EXISTS (
       SELECT 1 FROM buchungen b WHERE b.id != ?1 AND b.status IN ${SQL_BLOCKIEREND} AND b.von < ?4 AND b.bis > ?3))`
  ).bind(id, f.status, f.von, f.bis, f.name, f.email, f.telefon, f.personen, f.nachricht, f.notiz, jetzt, user, alt.geaendert_am).run();

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
  buchbarMonateVoraus: 18, nurInSaisonBuchbar: true, saisons: [],
};

async function ladePreise(env) {
  const r = await env.DB.prepare("SELECT wert, geaendert_am, geaendert_von FROM einstellungen WHERE schluessel = 'preise'").first();
  if (!r) return { ...STANDARD_PREISE, geaendert_am: null, geaendert_von: null };
  return { ...STANDARD_PREISE, ...JSON.parse(r.wert), geaendert_am: r.geaendert_am, geaendert_von: r.geaendert_von };
}

const saisonFuer = (p, ds) => p.saisons.find(s => s.von <= ds && ds <= s.bis);

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
    const r = {
      name: V.text(s.name, `${nr}: Name`, 40, true),
      von: V.datum(s.von, `${nr}: Von`),
      bis: V.datum(s.bis, `${nr}: Bis`),
      preisProNacht: zahl(s.preisProNacht, `${nr}: Preis pro Nacht`, 0, 10000),
    };
    const mn = V.int(s.minNaechte, `${nr}: Mindestnächte`, 1, 60);
    if (mn) r.minNaechte = mn;
    if (r.bis < r.von) throw new HttpError(400, `${nr} („${r.name}“): „bis“ liegt vor „von“.`);
    return r;
  }).sort((a, b) => a.von.localeCompare(b.von));
  for (let i = 1; i < p.saisons.length; i++) {
    const a = p.saisons[i - 1], b = p.saisons[i];
    if (b.von <= a.bis)
      throw new HttpError(400, `Saisons überschneiden sich: „${a.name}“ (${deDatum(a.von)}–${deDatum(a.bis)}) und „${b.name}“ (${deDatum(b.von)}–${deDatum(b.bis)}).`);
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

/* ---------------- Benachrichtigung (optional, ohne Gastdaten) ---------------- */
async function benachrichtigen(env, b) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_TO || !env.NOTIFY_FROM) return;
  const zeitraum = `${deDatum(b.von)} – ${deDatum(b.bis)}`;
  const text =
    `Neue Buchungsanfrage über die Website\n\n` +
    `Zeitraum: ${zeitraum} (${naechte(b.von, b.bis)} Nächte)\nPersonen: ${b.personen}\n\n` +
    `Details und Bearbeitung in der Verwaltung:\n${env.ADMIN_URL || ""}\n\n` +
    `(Diese Mail enthält bewusst keine Gastdaten.)`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.NOTIFY_FROM,
      to: env.NOTIFY_TO.split(",").map(s => s.trim()).filter(Boolean),
      subject: `Neue Anfrage: ${zeitraum}`,
      text,
    }),
  });
  if (!r.ok) console.error("Resend", r.status, await r.text());
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
