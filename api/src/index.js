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
// Titel/Beschreibung der Startseite je Sprache (gleich wie meta.title/meta.desc in site/assets/i18n.js)
const META = {
  de: { locale: "de_DE", titel: "Mobile Home Adria · Privlaka bei Zadar", text: "Modernes Mobile Home im Dalmacija Camp in Privlaka bei Zadar, Kroatien. Verfügbarkeit prüfen und direkt anfragen – klimatisiert, überdachte Terrasse, Campingplatz direkt am Meer." },
  en: { locale: "en_GB", titel: "Mobile Home Adria · Privlaka near Zadar", text: "Modern mobile home at Dalmacija Camp in Privlaka near Zadar, Croatia. Check availability and enquire directly – air-conditioned, covered terrace, campsite right by the sea." },
  hr: { locale: "hr_HR", titel: "Mobile Home Adria · Privlaka kod Zadra", text: "Moderna mobilna kućica u kampu Dalmacija u Privlaci kod Zadra. Provjeri dostupnost i pošalji upit izravno – klima, natkrivena terasa, kamp uz samo more." },
  sl: { locale: "sl_SI", titel: "Mobile Home Adria · Privlaka pri Zadru", text: "Sodobna mobilna hišica v kampu Dalmacija v Privlaki pri Zadru na Hrvaškem. Preveri razpoložljivost in pošlji povpraševanje – klima, pokrita terasa, kamp tik ob morju." },
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const istApi = url.pathname === "/api" || url.pathname.startsWith("/api/");

    // http → https (lokal per .dev.vars HTTPS_UMLEITUNG=0 abgeschaltet)
    if (url.protocol === "http:" && env.HTTPS_UMLEITUNG !== "0") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }
    // www.… → Domain ohne www;  …workers.dev → eigene Domain (außer API, für ältere Aufrufe)
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }
    if (!istApi && env.ASSETS && env.WEBSITE_URL && url.hostname.endsWith(".workers.dev"))
      return Response.redirect(env.WEBSITE_URL.replace(/\/+$/, "") + url.pathname + url.search, 301);

    if (!istApi && env.ASSETS) return websiteAntwort(request, env, url);
    return apiAntwort(request, env, ctx, url);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(cronLauf(env));
  },
  // Eingehende Mails an noreply@… (Cloudflare Email Routing → Worker): automatische Hinweis-Antwort
  async email(message, env, ctx) {
    await noreplyEmpfang(message, env);
  },
};

/* ---------------- Sicherheits-Header ---------------- */
// Gilt für alle Antworten (Website und API)
function grundHeader(h, url) {
  if (url.protocol === "https:") h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=()");
  h.set("Cross-Origin-Opener-Policy", "same-origin");
}

// Content-Security-Policy der Website: Skripte nur von hier oder mit Einmal-Schlüssel (Nonce),
// Kartenkacheln nur von OpenStreetMap, keine Einbettung in fremde Seiten
const websiteCsp = (nonce, url) => [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}'`,
  "style-src 'self' 'unsafe-inline'",           // Inline-Stile (Leaflet, dynamische Elemente)
  "img-src 'self' data: https://tile.openstreetmap.org",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "manifest-src 'self'",
  ...(url.protocol === "https:" ? ["upgrade-insecure-requests"] : []),
].join("; ");

/* ---------------- Website (statische Dateien aus site/) ---------------- */
async function websiteAntwort(request, env, url) {
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response("Methode nicht erlaubt", { status: 405, headers: { Allow: "GET, HEAD" } });

  // Seiten (HTML) immer frisch ausliefern: jede Antwort hat eine neue Nonce, daher keine Revalidierung (304)
  const istSeite = !/\.[a-z0-9]+$/i.test(url.pathname) || url.pathname.endsWith(".html");
  let anfrage = request;
  if (istSeite) {
    const h = new Headers(request.headers);
    h.delete("If-None-Match"); h.delete("If-Modified-Since");
    anfrage = new Request(request, { headers: h });
  }
  const original = await env.ASSETS.fetch(anfrage);
  const typ = original.headers.get("Content-Type") || "";
  const html = typ.includes("text/html");
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));

  const h = new Headers(original.headers);
  grundHeader(h, url);
  h.set("Content-Security-Policy", websiteCsp(nonce, url));
  h.set("Cross-Origin-Resource-Policy", url.pathname.startsWith("/images/") ? "cross-origin" : "same-origin");   // Vorschaubild beim Teilen
  if (html) {
    h.set("Cache-Control", "no-cache");
    h.delete("ETag"); h.delete("Last-Modified");
  } else if (url.searchParams.has("v") && env.VERSION && env.VERSION !== "dev") {
    h.set("Cache-Control", "public, max-age=31536000, immutable");   // CSS/JS mit Versionskennung
  } else if (/^\/(images|assets)\//.test(url.pathname)) {
    h.set("Cache-Control", "public, max-age=604800");                // Bilder, Schriften, Leaflet: 7 Tage
  } else {
    h.set("Cache-Control", "no-cache");                              // z. B. einstellungen.js ohne Version
  }
  if (url.pathname.startsWith("/admin")) { h.set("X-Robots-Tag", "noindex, nofollow"); h.set("Cache-Control", "no-store"); }

  const res = new Response(original.body, { status: original.status, statusText: original.statusText, headers: h });
  if (!html) return res;

  // Nonce an alle <script> hängen, Versionskennung (__VERSION__) für CSS/JS einsetzen
  const version = env.VERSION || "dev";
  const rw = new HTMLRewriter();
  // Startseite mit ?lang=xx: Titel, Beschreibung, Sprache und Vorschau schon im HTML passend setzen
  // (Suchmaschinen und Link-Vorschauen in WhatsApp/Facebook führen kein JavaScript aus)
  const m = (url.pathname === "/" || url.pathname === "/index.html") && META[url.searchParams.get("lang")];
  if (m) {
    const l = url.searchParams.get("lang");
    const adresse = (env.WEBSITE_URL || url.origin).replace(/\/+$/, "") + "/?lang=" + l;
    rw.on("html", { element(e) { e.setAttribute("lang", l); } })
      .on("title", { element(e) { e.setInnerContent(m.titel); } })
      .on('meta[name="description"]', { element(e) { e.setAttribute("content", m.text); } })
      .on('meta[property="og:title"]', { element(e) { e.setAttribute("content", m.titel); } })
      .on('meta[property="og:description"]', { element(e) { e.setAttribute("content", m.text); } })
      .on('meta[property="og:locale"]', { element(e) { e.setAttribute("content", m.locale); } })
      .on('meta[property="og:url"]', { element(e) { e.setAttribute("content", adresse); } })
      .on('link[rel="canonical"]', { element(e) { e.setAttribute("href", adresse); } });
  }
  return rw
    .on("script", { element(e) {
      e.setAttribute("nonce", nonce);
      const src = e.getAttribute("src");
      if (src && src.includes("__VERSION__")) e.setAttribute("src", src.replace("__VERSION__", version));
    } })
    .on("link[href*='__VERSION__']", { element(e) { e.setAttribute("href", e.getAttribute("href").replace("__VERSION__", version)); } })
    .transform(res);
}

/* ---------------- API ---------------- */
async function apiAntwort(request, env, ctx, url) {
  const cors = corsHeaders(request, env);
  let res;
  if (request.method === "OPTIONS") res = new Response(null, { status: 204 });
  else {
    try {
      res = await route(request, env, ctx);
    } catch (e) {
      if (e instanceof HttpError) res = json({ fehler: e.message, ...e.extra }, e.status);
      else { console.error(e); res = json({ fehler: "Interner Fehler" }, 500); }
    }
  }
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  grundHeader(res.headers, url);
  res.headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  res.headers.set("Cross-Origin-Resource-Policy", "same-site");
  // Verwaltungsdaten und Anmeldung niemals zwischenspeichern
  if (url.pathname.startsWith("/api/admin/") || url.pathname === "/api/login") res.headers.set("Cache-Control", "no-store");
  return res;
}

/* ---------------- Routing ---------------- */
async function route(req, env, ctx) {
  const url = new URL(req.url);
  const p = url.pathname.replace(/\/+$/, "") || "/";
  const m = req.method;

  // Schreibende Aufrufe nur von derselben Adresse oder erlaubten Seiten (Browser senden immer Origin)
  const origin = req.headers.get("Origin");
  if (m !== "GET" && origin && origin !== url.origin && !erlaubteOrigins(env).includes(origin)) throw new HttpError(403, "Herkunft nicht erlaubt");

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
  return json({ belegt: results, preise, maxNaechte: Number(env.MAX_NAECHTE || 60), stand: new Date().toISOString() }, 200, { "Cache-Control": "public, max-age=60" });
}

async function neueAnfrage(req, env, ctx) {
  const d = await leseJson(req);
  if (d.website) return json({ ok: true }, 201);            // Honeypot: Bots füllen das versteckte Feld aus

  // Erst zählen, dann prüfen – so können auch gleichzeitig gesendete Anfragen das Limit nicht umgehen
  const schluessel = await ipSchluessel(req, env, "anfrage");
  await limitZaehlen(env, schluessel);
  await limitPruefen(env, schluessel, 12, 3600, "Zu viele Anfragen von diesem Anschluss – bitte später erneut versuchen oder per E-Mail melden.", 1);
  // Schutz vor Spam-Wellen mit wechselnden Adressen: höchstens 50 neue Anfragen pro Tag insgesamt
  await limitPruefen(env, "anfrage:gesamt", 50, 86400, "Zurzeit gehen ungewöhnlich viele Anfragen ein – bitte später erneut versuchen oder per E-Mail melden.");

  const von = V.datum(d.von, "Anreise");
  const bis = V.datum(d.bis, "Abreise");
  const h = heute(env);
  const n = naechte(von, bis);
  const p = await ladePreise(env);
  const max = Number(env.MAX_NAECHTE || 60);
  if (von < h) throw new HttpError(400, "Die Anreise liegt in der Vergangenheit.", { code: "vergangenheit" });
  if (bis > horizontVon(h, p.buchbarMonateVoraus)) throw new HttpError(400, `Anfragen sind höchstens ${p.buchbarMonateVoraus} Monate im Voraus möglich.`, { code: "horizont" });
  if (n < 1) throw new HttpError(400, "Die Abreise muss nach der Anreise liegen.");
  const s0 = saisonFuer(p, von);
  const min = (s0 && s0.minNaechte) || p.minNaechte;
  if (n < min) throw new HttpError(400, `Mindestaufenthalt${s0 && s0.minNaechte ? " in der " + s0.name : ""}: ${min} Nächte.`, { code: "min_naechte", min });
  if (n > max) throw new HttpError(400, `Höchstens ${max} Nächte pro Anfrage.`, { code: "max_naechte", max });
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
    throw new HttpError(409, "Der Zeitraum ist leider nicht mehr frei. Bitte wähle andere Daten.", { code: "belegt" });

  await limitZaehlen(env, "anfrage:gesamt");
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
  const name = typeof d.name === "string" ? d.name.trim() : "";
  const passwort = typeof d.passwort === "string" ? d.passwort : "";
  // Jeder Versuch wird VOR der Prüfung gezählt (keine Umgehung durch parallele Anfragen),
  // je Anschluss und je Benutzername (schützt auch bei wechselnden IP-Adressen)
  const ipSchl = await ipSchluessel(req, env, "login");
  const nameSchl = "login-name:" + b64url(await crypto.subtle.digest("SHA-256", enc.encode(name.toLowerCase() + "|" + (env.SESSION_SECRET || "")))).slice(0, 22);
  await limitZaehlen(env, ipSchl);
  await limitZaehlen(env, nameSchl);
  await limitPruefen(env, ipSchl, 10, 900, "Zu viele Anmeldeversuche – bitte 15 Minuten warten.", 1);
  await limitPruefen(env, nameSchl, 10, 900, "Zu viele Anmeldeversuche für diesen Zugang – bitte 15 Minuten warten.", 1);

  const u = name ? await env.DB.prepare("SELECT name, pw_hash FROM benutzer WHERE name = ? COLLATE NOCASE").bind(name).first() : null;
  // Auch bei unbekanntem Namen rechnen, damit die Antwortzeit nichts verrät
  const ok = await passwortPruefen(passwort, u ? u.pw_hash : "pbkdf2$" + PBKDF2_ITER + "$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
  if (!u || !ok) throw new HttpError(401, "Name oder Passwort falsch.");
  // erfolgreiche Anmeldung: Zähler für diesen Zugang zurücksetzen
  await env.DB.prepare("DELETE FROM rate_limit WHERE schluessel IN (?, ?)").bind(ipSchl, nameSchl).run();
  return json({ token: await tokenErstellen(env, u.name, u.pw_hash), name: u.name, gueltigStunden: TOKEN_STUNDEN });
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
  const u = await env.DB.prepare("SELECT name, pw_hash FROM benutzer WHERE name = ?").bind(p.u).first();
  if (!u) throw new HttpError(401, "Zugang existiert nicht mehr.");
  // Nach einer Passwortänderung sind alle älteren Anmeldungen ungültig
  if (p.k !== await passwortKennung(u.pw_hash)) throw new HttpError(401, "Passwort wurde geändert – bitte erneut anmelden.");
  return u.name;
}

async function passwortAendern(req, env, user) {
  const d = await leseJson(req);
  const u = await env.DB.prepare("SELECT pw_hash FROM benutzer WHERE name = ?").bind(user).first();
  if (!(await passwortPruefen(String(d.alt || ""), u.pw_hash))) throw new HttpError(400, "Das bisherige Passwort stimmt nicht.");
  const neu = String(d.neu || "");
  if (neu.length < 12) throw new HttpError(400, "Das neue Passwort muss mindestens 12 Zeichen haben.");
  const neuHash = await passwortHash(neu);
  await env.DB.prepare("UPDATE benutzer SET pw_hash = ? WHERE name = ?").bind(neuHash, user).run();
  // neue Anmeldung zurückgeben – alle anderen (älteren) Sitzungen sind damit abgemeldet
  return json({ ok: true, token: await tokenErstellen(env, user, neuHash) });
}

/* ---------------- Verwaltung ---------------- */
async function liste(env, url) {
  let sql = "SELECT * FROM buchungen WHERE 1=1";
  const args = [];
  const status = url.searchParams.get("status");
  const ab = url.searchParams.get("ab");
  if (status) { sql += " AND status = ?"; args.push(V.status(status)); }
  if (ab) { sql += " AND bis >= ?"; args.push(V.datum(ab, "ab")); }
  sql += " ORDER BY von DESC LIMIT 2000";   // neueste zuerst, falls die Grenze je erreicht wird (Admin sortiert selbst)
  const { results } = await env.DB.prepare(sql).bind(...args).all();
  return json({ buchungen: results, heute: heute(env), mail: await mailStatus(env), cron: await cronStatus(env) });
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
  const datumGeaendert = f.von !== alt.von || f.bis !== alt.bis;
  // Merker „Bestätigungs-Mail gesendet“: true → Zeitpunkt setzen (vorhandenen behalten), false → zurücksetzen.
  // Ändern sich die Daten, muss der Gast eine neue Bestätigung bekommen → Merker zurücksetzen.
  let mailAm = "bestaetigung_gesendet" in d
    ? (d.bestaetigung_gesendet === true ? (alt.bestaetigung_gesendet_am || jetzt) : null)
    : alt.bestaetigung_gesendet_am;
  if (datumGeaendert) mailAm = null;
  // Preis bei geändertem Zeitraum neu berechnen (sonst stünde der alte Preis in der Bestätigungs-Mail)
  let preis = alt.preis_web;
  if (datumGeaendert && alt.preis_web != null) {
    try { preis = preisBerechnen(await ladePreise(env), f.von, f.bis); } catch { preis = null; }
  }
  const r = await env.DB.prepare(
    `UPDATE buchungen SET status=?2, von=?3, bis=?4, name=?5, email=?6, telefon=?7, personen=?8,
       nachricht=?9, notiz=?10, geaendert_am=?11, geaendert_von=?12, bestaetigung_gesendet_am=?14, preis_web=?15
     WHERE id=?1 AND geaendert_am=?13 AND (?2 NOT IN ${SQL_BLOCKIEREND} OR NOT EXISTS (
       SELECT 1 FROM buchungen b WHERE b.id != ?1 AND b.status IN ${SQL_BLOCKIEREND} AND b.von < ?4 AND b.bis > ?3))`
  ).bind(id, f.status, f.von, f.bis, f.name, f.email, f.telefon, f.personen, f.nachricht, f.notiz, jetzt, user, alt.geaendert_am, mailAm, preis).run();

  if (!r.meta.changes) {
    const jetzt2 = await eintrag(env, id);
    if (!jetzt2) throw new HttpError(404, "Eintrag nicht gefunden – wurde er gelöscht?");
    if (jetzt2.geaendert_am !== alt.geaendert_am)
      throw new HttpError(409, "Der Eintrag wurde gerade von jemand anderem geändert. Bitte neu laden.", { veraltet: true });
    await konfliktFehler(env, f.von, f.bis, id);
  }
  // Offene Anfrage abgelehnt → Gast bekommt automatisch eine Absage (abschaltbar mit absage_mail: false).
  // Nicht bei bereits bestätigten/gesperrten Einträgen (dafür „Storniert“) und nie zweimal.
  let absage = null;
  if (f.status === "abgelehnt" && alt.status === "anfrage" && !alt.absage_gesendet_am && d.absage_mail !== false) {
    try { absage = await absageSenden(env, { id, von: f.von, bis: f.bis, name: f.name, email: f.email, sprache: alt.sprache }); }
    catch (e) { console.error("Absage:", e); absage = "fehler"; }
  }
  return json({ buchung: await eintrag(env, id), absage });
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
    benachrichtigung: !!(env.NOTIFY_TO || "").trim(),
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

// Texte für alle automatischen Gäste-Mails (DE/EN/HR/SL)
const MAILTEXT = {
  de: {
    hallo: n => `Hallo${n ? " " + n : ""},`, gruss: "Viele Grüße",
    felder: ["Anreise", "Abreise", "Nächte", "Personen", "Preis (ca.)"], inkl: "inkl. Endreinigung",
    noreply: (m, t) => `Dies ist eine automatisch versendete E-Mail – bitte nicht darauf antworten, Antworten werden nicht gelesen. Bei Fragen erreichst du uns unter ${m}${t ? " oder " + t : ""}.`,
    eingang: {
      betreff: h => `Deine Anfrage ist angekommen – ${h}`,
      intro: "vielen Dank für deine Anfrage! Sie ist bei uns angekommen:",
      weiter: "Die Anfrage ist unverbindlich. Wir prüfen die Verfügbarkeit und melden uns innerhalb von 24 Stunden mit einer Bestätigung oder Rückfrage.",
      fuss: w => `Diese E-Mail wurde verschickt, weil auf ${w} eine Anfrage mit dieser Adresse gestellt wurde. Falls du das nicht warst, kannst du sie ignorieren.`,
    },
    absage: {
      betreff: (h, z) => `Deine Anfrage ${z} – ${h}`,
      intro: z => `vielen Dank für deine Anfrage für unser Mobile Home im Zeitraum ${z}. Leider ist das Mobile Home in diesem Zeitraum nicht verfügbar, deshalb können wir dir keine Zusage geben.`,
      weiter: "Vielleicht passt ein anderer Termin? Die freien Zeiträume siehst du hier:", knopf: "Freie Termine ansehen",
    },
  },
  en: {
    hallo: n => `Hello${n ? " " + n : ""},`, gruss: "Best regards",
    felder: ["Arrival", "Departure", "Nights", "Guests", "Price (approx.)"], inkl: "incl. final cleaning",
    noreply: (m, t) => `This is an automated email – please do not reply, replies are not read. If you have any questions, contact us at ${m}${t ? " or " + t : ""}.`,
    eingang: {
      betreff: h => `We've received your enquiry – ${h}`,
      intro: "Thank you for your enquiry! We have received it:",
      weiter: "Your enquiry is non-binding. We'll check availability and get back to you within 24 hours with a confirmation or a question.",
      fuss: w => `This email was sent because an enquiry was made on ${w} using this address. If this wasn't you, you can ignore it.`,
    },
    absage: {
      betreff: (h, z) => `Your enquiry ${z} – ${h}`,
      intro: z => `Thank you for your enquiry for our mobile home for ${z}. Unfortunately, the mobile home is not available during this period, so we cannot confirm your stay.`,
      weiter: "Perhaps another date would suit you? You can see the available dates here:", knopf: "See available dates",
    },
  },
  hr: {
    hallo: n => `Pozdrav${n ? " " + n : ""},`, gruss: "Srdačan pozdrav",
    felder: ["Dolazak", "Odlazak", "Noći", "Osobe", "Cijena (otprilike)"], inkl: "uključujući završno čišćenje",
    noreply: (m, t) => `Ovo je automatski poslana e-poruka – molimo ne odgovaraj na nju, odgovori se ne čitaju. Za pitanja nam se javi na ${m}${t ? " ili " + t : ""}.`,
    eingang: {
      betreff: h => `Zaprimili smo tvoj upit – ${h}`,
      intro: "hvala na upitu! Zaprimili smo ga:",
      weiter: "Upit je neobvezujući. Provjerit ćemo dostupnost i javiti ti se u roku od 24 sata s potvrdom ili pitanjem.",
      fuss: w => `Ova je e-poruka poslana jer je na ${w} poslan upit s ovom adresom. Ako to nisi bio/bila ti, slobodno je zanemari.`,
    },
    absage: {
      betreff: (h, z) => `Tvoj upit ${z} – ${h}`,
      intro: z => `hvala na upitu za našu mobilnu kućicu u terminu ${z}. Nažalost, mobilna kućica u tom terminu nije slobodna pa ti ne možemo potvrditi boravak.`,
      weiter: "Možda ti odgovara neki drugi termin? Slobodne termine možeš pogledati ovdje:", knopf: "Pogledaj slobodne termine",
    },
  },
  sl: {
    hallo: n => `Dober dan${n ? ", " + n : ""},`, gruss: "Lep pozdrav",
    felder: ["Prihod", "Odhod", "Noči", "Osebe", "Cena (približno)"], inkl: "vključno s končnim čiščenjem",
    noreply: (m, t) => `To je samodejno poslano e-sporočilo – prosimo, ne odgovarjaj nanj, odgovorov ne beremo. Za vprašanja nam piši na ${m}${t ? " ali pokliči " + t : ""}.`,
    eingang: {
      betreff: h => `Prejeli smo tvoje povpraševanje – ${h}`,
      intro: "hvala za povpraševanje! Prejeli smo ga:",
      weiter: "Povpraševanje je nezavezujoče. Preverili bomo razpoložljivost in se ti v 24 urah oglasili s potrditvijo ali vprašanjem.",
      fuss: w => `To e-sporočilo je bilo poslano, ker je bilo na ${w} poslano povpraševanje s tem naslovom. Če to nisi bil/a ti, ga lahko prezreš.`,
    },
    absage: {
      betreff: (h, z) => `Tvoje povpraševanje ${z} – ${h}`,
      intro: z => `hvala za povpraševanje za našo mobilno hišico v terminu ${z}. Žal mobilna hišica v tem terminu ni prosta, zato ti bivanja ne moremo potrditi.`,
      weiter: "Morda ti ustreza kakšen drug termin? Proste termine si lahko ogledaš tukaj:", knopf: "Oglej si proste termine",
    },
  },
};

// Gemeinsamer Aufbau aller automatischen Mails (Text + HTML) mit No-Reply-Hinweis
function mailBauen({ lang, haus, hallo, absaetze = [], zeilen = [], nach = [], knopf = null, gruss, link = "", hinweis, fuss = "" }) {
  const breite = zeilen.length ? Math.max(...zeilen.map(z => String(z[0]).length)) + 2 : 0;
  const text = [
    hallo, "",
    ...absaetze.flatMap(a => [a, ""]),
    ...(zeilen.length ? [...zeilen.map(([k, v]) => (k + ":").padEnd(breite) + v), ""] : []),
    ...nach.flatMap(a => [a, ""]),
    ...(knopf ? [knopf.url, ""] : []),
    gruss, haus, ...(link ? [link] : []), "",
    "—", hinweis, ...(fuss ? ["", fuss] : []),
  ].join("\n");
  const p = t => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5">${htmlEsc(t)}</p>`;
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;background:#f4f6f7;font-family:Arial,Helvetica,sans-serif;color:#0c1a20">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#ffffff;border:1px solid #e4e9eb;border-radius:12px;padding:24px">
<p style="margin:0 0 6px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#0e5e73;font-weight:bold">${htmlEsc(haus)}</p>
${hallo ? `<p style="margin:0 0 16px;font-size:16px">${htmlEsc(hallo)}</p>` : ""}
${absaetze.map(p).join("\n")}
${zeilen.length ? `<table style="border-collapse:collapse;width:100%;font-size:15px;margin:0 0 16px">${zeilen.map(([k, v]) =>
  `<tr><td style="padding:7px 0;color:#5b6b72;border-bottom:1px solid #eef1f2;width:42%">${htmlEsc(k)}</td><td style="padding:7px 0;border-bottom:1px solid #eef1f2;font-weight:bold">${htmlEsc(v)}</td></tr>`).join("")}</table>` : ""}
${nach.map(p).join("\n")}
${knopf ? `<p style="margin:4px 0 20px"><a href="${htmlEsc(knopf.url)}" style="display:inline-block;background:#0e5e73;color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:9px">${htmlEsc(knopf.text)}</a></p>` : ""}
<p style="margin:0;font-size:15px">${htmlEsc(gruss)}<br><b>${htmlEsc(haus)}</b>${link ? `<br><a href="${htmlEsc(link)}" style="color:#0e5e73">${htmlEsc(link.replace(/^https?:\/\//, "").replace(/\/?\?.*$/, ""))}</a>` : ""}</p>
</div>
<p style="margin:14px 4px 0;font-size:12px;line-height:1.5;color:#5b6b72"><b>${htmlEsc(hinweis)}</b>${fuss ? "<br>" + htmlEsc(fuss) : ""}</p>
</div></body></html>`;
  return { text, html };
}

// Gemeinsame Werte für Gäste-Mails
function gastWerte(env, a) {
  const l = MAILTEXT[a.sprache] ? a.sprache : "de", T = MAILTEXT[l], loc = LOCALE[l];
  const web = (env.WEBSITE_URL || "").replace(/\/+$/, "");
  const lang = s => new Date(s + "T12:00:00Z").toLocaleDateString(loc, { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  const kurz = s => new Date(s + "T12:00:00Z").toLocaleDateString(loc, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  return {
    l, T, loc, web, haus: env.MAIL_ABSENDER_NAME || "Mobile Home",
    link: web ? `${web}/?lang=${l}` : "", zeitraum: `${kurz(a.von)} – ${kurz(a.bis)}`, lang,
    vorname: sichererVorname(a.name),
    hinweis: T.noreply(env.KONTAKT_EMAIL || env.MAIL_ABSENDER_ADRESSE || "", env.KONTAKT_TELEFON || ""),
  };
}

// Schutz gegen Missbrauch: Tageskontingente je Mail-Art (Eingangsbestätigungen, Absagen, Benachrichtigungen getrennt,
// damit z. B. eine Spam-Welle nicht die Absagen aus der Verwaltung blockiert)
async function gastLimitOk(env, schluessel = "mail:gast", max = 40) {
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM rate_limit WHERE schluessel = ? AND zeit > ?").bind(schluessel, Date.now() - 86400000).first();
  if (n.n >= max) { console.error("Tageslimit erreicht:", schluessel); return false; }
  return true;
}

// Automatische Eingangsbestätigung an den Gast (in seiner Sprache)
async function eingangBestaetigen(env, a) {
  if (!mailAktiv(env) || !a.email || !(await gastLimitOk(env))) return;
  const w = gastWerte(env, a), T = w.T;
  const preis = a.preis_web != null ? new Intl.NumberFormat(w.loc, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(a.preis_web) + " " + T.inkl : "";
  const zeilen = [[T.felder[0], w.lang(a.von)], [T.felder[1], w.lang(a.bis)], [T.felder[2], naechte(a.von, a.bis)], [T.felder[3], a.personen]];
  if (preis) zeilen.push([T.felder[4], preis]);
  const { text, html } = mailBauen({
    lang: w.l, haus: w.haus, hallo: T.hallo(w.vorname), absaetze: [T.eingang.intro], zeilen, nach: [T.eingang.weiter],
    gruss: T.gruss, link: w.link, hinweis: w.hinweis, fuss: T.eingang.fuss(w.web.replace(/^https?:\/\//, "") || w.haus),
  });
  const ok = await mailSenden(env, { an: a.email, betreff: T.eingang.betreff(w.haus), text, html, antwortAn: env.MAIL_ANTWORT_AN });
  if (ok) {
    await limitZaehlen(env, "mail:gast");
    await env.DB.prepare("UPDATE buchungen SET eingang_mail_am = ? WHERE id = ?").bind(new Date().toISOString(), a.id).run();
  }
}

// Automatische Absage an den Gast, wenn die Anfrage in der Verwaltung abgelehnt wird
// Rückgabe: "gesendet" | "nicht_eingerichtet" | "keine_adresse" | "limit" | "fehler"
async function absageSenden(env, a) {
  if (!a.email) return "keine_adresse";
  if (!mailAktiv(env)) return "nicht_eingerichtet";
  if (!(await gastLimitOk(env, "mail:absage", 40))) return "limit";
  const w = gastWerte(env, a), T = w.T;
  const { text, html } = mailBauen({
    lang: w.l, haus: w.haus, hallo: T.hallo(w.vorname), absaetze: [T.absage.intro(w.zeitraum), T.absage.weiter],
    knopf: w.link ? { text: T.absage.knopf, url: w.link + "#verfuegbarkeit" } : null,
    gruss: T.gruss, link: w.link, hinweis: w.hinweis,
  });
  const ok = await mailSenden(env, { an: a.email, betreff: T.absage.betreff(w.haus, w.zeitraum), text, html, antwortAn: env.MAIL_ANTWORT_AN });
  if (!ok) return "fehler";
  // Mail ist raus – Fehler beim Vermerken dürfen das Ergebnis nicht verfälschen
  try {
    await limitZaehlen(env, "mail:absage");
    await env.DB.prepare("UPDATE buchungen SET absage_gesendet_am = ? WHERE id = ?").bind(new Date().toISOString(), a.id).run();
  } catch (e) { console.error("Absage vermerken:", e); }
  return "gesendet";
}

// Benachrichtigung an die Verwaltung (NOTIFY_TO) – bewusst ohne Name/Kontaktdaten des Gastes
async function benachrichtigen(env, a) {
  const an = (env.NOTIFY_TO || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!mailAktiv(env) || !an.length || !(await gastLimitOk(env, "mail:verwaltung", 50))) return;
  const zeitraum = `${deDatum(a.von)} – ${deDatum(a.bis)}`;
  const n = naechte(a.von, a.bis);
  const sprachen = { de: "Deutsch", en: "Englisch", hr: "Kroatisch", sl: "Slowenisch" };
  const preis = a.preis_web != null ? `${a.preis_web} € (inkl. Endreinigung)` : "–";
  const admin = env.ADMIN_URL || "";
  const { text, html } = mailBauen({
    lang: "de", haus: "Neue Buchungsanfrage", hallo: "",
    zeilen: [["Zeitraum", zeitraum], ["Nächte", n], ["Personen", a.personen], ["Preis (berechnet)", preis], ["Sprache", sprachen[a.sprache] || a.sprache]],
    knopf: admin ? { text: "In der Verwaltung öffnen", url: admin } : null,
    gruss: "Automatische Benachrichtigung", link: "",
    hinweis: "Automatisch versendet – bitte nicht antworten, Antworten werden nicht gelesen.",
    fuss: "Name und Kontaktdaten des Gastes stehen aus Datenschutzgründen nur in der Verwaltung.",
  });
  if (await mailSenden(env, { an, betreff: `Neue Anfrage: ${zeitraum} (${n} Nächte, ${a.personen} Pers.)`, text, html, antwortAn: env.MAIL_ANTWORT_AN }))
    await limitZaehlen(env, "mail:verwaltung");
}

/* ---------------- E-Mail-Empfang: noreply@… beantwortet automatisch ---------------- */
// In Cloudflare unter E-Mail → Email Routing eine Regel „noreply@… → Worker mobile-home-api“ anlegen.
// Eingehende Mails werden NICHT gelesen, gespeichert oder weitergeleitet; der Absender bekommt eine Hinweis-Antwort.
const NOREPLY_TEXT = (env) => {
  const m = env.KONTAKT_EMAIL || "", t = env.KONTAKT_TELEFON || "";
  return [
    "Diese Adresse wird nicht gelesen (no-reply). Deine Nachricht wurde nicht zugestellt.",
    `Bitte schreib uns an ${m}${t ? " oder ruf an: " + t : ""}.`,
    "",
    "This address is not monitored (no-reply). Your message has not been delivered.",
    `Please write to ${m}${t ? " or call " + t : ""}.`,
    "",
    "Ova adresa se ne čita (no-reply). Tvoja poruka nije dostavljena.",
    `Molimo piši nam na ${m}${t ? " ili nazovi " + t : ""}.`,
    "",
    "Ta naslov se ne bere (no-reply). Tvoje sporočilo ni bilo dostavljeno.",
    `Prosimo, piši nam na ${m}${t ? " ali pokliči " + t : ""}.`,
    "",
    `— ${env.MAIL_ABSENDER_NAME || "Mobile Home"} · ${(env.WEBSITE_URL || "").replace(/^https?:\/\//, "")}`,
  ].join("\n");
};

const b64Utf8 = s => btoa(String.fromCharCode(...enc.encode(s)));
const mimeWort = s => `=?UTF-8?B?${b64Utf8(s)}?=`;

async function noreplyEmpfang(message, env) {
  const h = message.headers, von = message.from || "";
  // Keine Antwort auf automatische Mails, Bounces oder Listen (verhindert Mail-Schleifen)
  const automatisch = (h.get("auto-submitted") || "no").toLowerCase() !== "no"
    || /bulk|junk|list/i.test(h.get("precedence") || "") || h.get("list-id") || h.get("x-autoreply") || h.get("x-autorespond")
    || /mailer-daemon|postmaster|no-?reply|bounce/i.test(von) || !von.includes("@");
  if (automatisch) return;   // still verwerfen

  // höchstens eine Hinweis-Antwort pro Absender und Tag
  const schl = "noreply:" + b64url(await crypto.subtle.digest("SHA-256", enc.encode(von.toLowerCase() + "|" + (env.SESSION_SECRET || "")))).slice(0, 22);
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM rate_limit WHERE schluessel = ? AND zeit > ?").bind(schl, Date.now() - 86400000).first();
  if (n.n >= 1) return;
  await limitZaehlen(env, schl);

  const msgId = h.get("message-id");
  const betreff = (h.get("subject") || "").replace(/[\r\n]+/g, " ").slice(0, 150);
  const domain = (message.to.split("@")[1] || "mobile-home.invalid");
  const roh = [
    `From: ${mimeWort(env.MAIL_ABSENDER_NAME || "Mobile Home")} <${message.to}>`,
    `To: <${von}>`,
    `Subject: ${mimeWort("Automatische Antwort / Automatic reply" + (betreff ? ": " + betreff : ""))}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    ...(msgId ? [`In-Reply-To: ${msgId}`, `References: ${msgId}`] : []),
    "Auto-Submitted: auto-replied",
    "X-Auto-Response-Suppress: All",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64Utf8(NOREPLY_TEXT(env)).replace(/.{76}/g, "$&\r\n"),
  ].join("\r\n");
  try {
    const { EmailMessage } = await import("cloudflare:email");
    await message.reply(new EmailMessage(message.to, von, roh));
  } catch (e) {
    // Antwort nicht möglich (z. B. Absender-Prüfung fehlgeschlagen) → Zustellung mit Hinweis ablehnen (Bounce)
    console.error("noreply-Antwort fehlgeschlagen:", String(e).slice(0, 200));
    message.setReject("This address is not monitored (no-reply). Please contact " + (env.KONTAKT_EMAIL || "the sender via the website") + ".");
  }
}

/* ---------------- Tägliche Bereinigung (Datenschutz) ---------------- */
// Ergebnis wird in einstellungen 'cronstatus' vermerkt und in der Verwaltung angezeigt
async function cronLauf(env) {
  const [a, m] = await Promise.allSettled([aufraeumen(env), mailPruefen(env)]);
  for (const r of [a, m]) if (r.status === "rejected") console.error("Cron:", r.reason);
  try {
    await env.DB.prepare(
      `INSERT INTO einstellungen (schluessel, wert, geaendert_am, geaendert_von) VALUES ('cronstatus', ?1, ?2, 'System')
       ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert, geaendert_am = excluded.geaendert_am`
    ).bind(JSON.stringify({ ok: a.status === "fulfilled", fehler: a.status === "rejected" ? String(a.reason).slice(0, 200) : null }), new Date().toISOString()).run();
  } catch (e) { console.error("Cronstatus:", e); }
}
async function cronStatus(env) {
  const r = await env.DB.prepare("SELECT wert, geaendert_am FROM einstellungen WHERE schluessel = 'cronstatus'").first();
  return r ? { ...JSON.parse(r.wert), stand: r.geaendert_am } : null;
}
async function aufraeumen(env) {
  const h = heute(env);
  const loeschenTage = Number(env.LOESCHEN_NACH_TAGEN || 180);
  const anonTage = Number(env.ANONYMISIEREN_NACH_TAGEN || 365);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM rate_limit WHERE zeit < ?").bind(Date.now() - 86400000),
    // abgelehnt/storniert: erst löschen, wenn der Zeitraum vorbei ist UND die letzte Änderung X Tage zurückliegt
    env.DB.prepare("DELETE FROM buchungen WHERE status IN ('abgelehnt','storniert') AND bis < ? AND geaendert_am < ?")
      .bind(h, new Date(Date.now() - loeschenTage * 86400000).toISOString()),
    env.DB.prepare("DELETE FROM buchungen WHERE status = 'anfrage' AND bis < ?").bind(plusTage(h, -30)),
    env.DB.prepare(
      `UPDATE buchungen SET name = NULL, email = NULL, telefon = NULL, nachricht = NULL,
         notiz = CASE WHEN notiz IS NULL THEN NULL ELSE '[anonymisiert]' END
       WHERE status IN ('bestaetigt','blockiert') AND bis < ?
         AND (name IS NOT NULL OR email IS NOT NULL OR telefon IS NOT NULL OR nachricht IS NOT NULL
              OR (notiz IS NOT NULL AND notiz != '[anonymisiert]'))`
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
// schonGezaehlt = 1, wenn der aktuelle Versuch vorher schon eingetragen wurde (Zählen vor Prüfen)
async function limitPruefen(env, schluessel, max, fensterSek, meldung, schonGezaehlt = 0) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM rate_limit WHERE schluessel = ? AND zeit > ?")
    .bind(schluessel, Date.now() - fensterSek * 1000).first();
  if (r.n - schonGezaehlt >= max) throw new HttpError(429, meldung, { code: "limit" });
}
const limitZaehlen = (env, schluessel) =>
  env.DB.prepare("INSERT INTO rate_limit (schluessel, zeit) VALUES (?, ?)").bind(schluessel, Date.now()).run();

/* ---------------- Krypto ---------------- */
async function hmacKey(env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new HttpError(500, "Server nicht eingerichtet (SESSION_SECRET fehlt).");
  return crypto.subtle.importKey("raw", enc.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
// Kennung des aktuellen Passworts im Token: ändert sich das Passwort, werden alte Anmeldungen ungültig
const passwortKennung = async pwHash => b64url(await crypto.subtle.digest("SHA-256", enc.encode(String(pwHash)))).slice(0, 16);
async function tokenErstellen(env, name, pwHash) {
  const payload = b64url(enc.encode(JSON.stringify({ u: name, k: await passwortKennung(pwHash), exp: Date.now() + TOKEN_STUNDEN * 3600000 })));
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
