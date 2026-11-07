# Mobile Home Website – Anleitung

## Aufbau

```
site/                  → öffentliche Website (GitHub Pages)
  index.html           Startseite mit Kalender und Anfrageformular
  admin/index.html     Verwaltung: Anfragen bestätigen, Kalender, Sperren
  einstellungen.js     Stammdaten, Kontakt, API-Adresse
  impressum.html, datenschutz.html
  images/fotos/        web-optimierte Fotos (je 800 px fürs Raster, 1600 px für die Großansicht)
  assets/i18n.js       alle Texte der Website in Deutsch, Englisch, Kroatisch, Slowenisch
fotos-original/        Original-Kamerafotos (nur lokal, nicht im Repo)
api/                   → API als Cloudflare Worker + D1-Datenbank
.github/workflows/     automatisches Ausspielen von Website und API
```

So läuft es ab:

1. Ein Gast wählt auf der Website einen Zeitraum und schickt das Formular ab.
2. Die API speichert die Anfrage als **„Anfrage"**. Der Zeitraum ist damit noch nicht blockiert.
3. Die Betreuer melden sich unter `…/admin/` an und **bestätigen** oder **lehnen ab**. Danach öffnet ein Klick eine vorbereitete Mail an den Gast.
4. Bestätigte Buchungen und Sperren (Eigennutzung, Wartung) erscheinen sofort, spätestens nach 1 Minute, als belegt im öffentlichen Kalender.
5. Unter `…/api/kalender.ics` gibt es den Belegungskalender als iCal. Ihn kannst du in Airbnb, Booking.com, Google oder Outlook importieren.

## Einmalige Einrichtung

### 1. Cloudflare (API + Datenbank)
Du brauchst ein kostenloses Cloudflare-Konto. Dann im Ordner `api/`:

```bash
npm install
npx wrangler login
npx wrangler d1 create mobile-home        # ausgegebene database_id in wrangler.toml eintragen
npm run db:init:remote                    # Tabellen anlegen
npx wrangler secret put SESSION_SECRET    # langen Zufallswert eingeben (z. B. in Keeper erzeugen)
```

In `api/wrangler.toml` noch `ALLOWED_ORIGINS` und `ADMIN_URL` auf deine GitHub-Pages-Adresse setzen. Dann:

```bash
npm run deploy                            # gibt die Adresse aus, z. B. https://mobile-home-api.<name>.workers.dev
```

### 2. Zugänge für die Verwaltung
Pro Person einen Zugang anlegen. Das Passwort wird abgefragt, gespeichert wird nur ein Hash:

```bash
npm run benutzer:remote -- anna
```

**Passwörter bitte in Keeper erzeugen und dort ablegen**, nicht im Browser, nicht in Dateien, nicht im Chat. Mit demselben Befehl setzt du ein vergessenes Passwort neu. Angemeldete Personen können ihr Passwort auch selbst in der Verwaltung ändern.

### 3. Website (GitHub Pages)
1. Die API-Adresse aus Schritt 1 in `site/einstellungen.js` bei `apiUrl` eintragen. Den `localhost`-Teil kannst du stehen lassen:
   `apiUrl: location.hostname === "localhost" ? "http://localhost:8787" : "https://mobile-home-api.<name>.workers.dev",`
2. Den Ordner als GitHub-Repo pushen.
3. Im Repo unter **Settings → Pages → Source** „GitHub Actions" wählen. Jeder Push auf `main` veröffentlicht dann `site/`.
4. Optional automatisches Ausspielen der API: In GitHub unter **Settings → Secrets → Actions** die Secrets `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID` anlegen.

### 4. Optional
- **Mail bei neuer Anfrage:** Konto bei resend.com anlegen, dann `npx wrangler secret put RESEND_API_KEY`, `NOTIFY_TO` (Empfänger, kommagetrennt) und `NOTIFY_FROM` setzen. Die Mail enthält nur Zeitraum und Personenzahl, keine Gastdaten.
- **iCal-Export schützen:** Mit `npx wrangler secret put ICS_TOKEN` gesetzt, ist der Link nur noch mit `?token=…` abrufbar.

## Im Alltag

| Was | Wo |
|---|---|
| Anfragen bestätigen / ablehnen | Verwaltung → Tab „Anfragen" |
| Eigennutzung / Wartung sperren | Verwaltung → Kalender → freien Tag anklicken (oder „+ Neuer Eintrag") |
| Buchung ändern, verschieben, stornieren | Verwaltung → Eintrag anklicken |
| Preise, Saisons, Mindestnächte, Endreinigung, max. Personen | Verwaltung → Tab „Preise & Regeln“ |
| Texte der Website (alle Sprachen) | `site/assets/i18n.js` – jeden Text in allen vier Sprachen ändern |
| Fotos austauschen/ergänzen | Original nach `fotos-original/`, daraus 800- und 1600-px-JPGs ohne Metadaten in `site/images/fotos/` erzeugen und in `site/index.html` in der Liste `FOTOS` eintragen (Beschriftung in `i18n.js` unter `gal.<name>`) |

**Überschneidungen:** Die API verhindert, dass sich zwei bestätigte Buchungen oder Sperren überschneiden. Am Abreisetag darf der nächste Gast anreisen.

**Preise:** Das Camp ist ganzjährig geöffnet. Unter „Preise & Regeln“ gilt der **Nebensaison-Preis** an allen Tagen ohne Saison; die **Hauptsaison** ist als *jährliche* Saison eingetragen (gilt jedes Jahr zu denselben Daten, auch über Silvester möglich). *Einmalige* Sonderzeiträume mit festem Datum haben Vorrang. Den Preis rechnet die API selbst nach – der Preis in einer Anfrage stammt immer aus den gespeicherten Saisons. Der Haken „Außerhalb der Saisons keine Buchung“ ist nur für eine Winterpause gedacht.

**Datenschutz, läuft automatisch jede Nacht:**
- Abgelehnte und stornierte Anfragen werden nach 180 Tagen gelöscht.
- Unbeantwortete Anfragen werden 30 Tage nach dem Zeitraum gelöscht.
- Bei bestätigten Buchungen werden die Gastdaten 365 Tage nach Abreise entfernt.

Die Fristen stellst du in `api/wrangler.toml` ein.

## Lokal testen

```bash
cd api
npm install
npm run db:init:local
# .dev.vars anlegen mit:  SESSION_SECRET=<mind. 32 zufällige Zeichen>
npm run benutzer:local -- test
npm run dev                         # API auf http://localhost:8787

# zweites Terminal:
cd site
npx http-server -p 8080 -c-1        # Website auf http://localhost:8080, Verwaltung unter /admin/
```

Unter `localhost` nutzt die Website automatisch die lokale API.

## Vor dem Livegang
- [x] `impressum.html` und `datenschutz.html` ausfüllen
- [x] E-Mail und Telefon in `einstellungen.js`
- [x] Preise ganzjährig (Haupt-/Nebensaison) eingerichtet – Werte in der Verwaltung prüfen
- [x] Fotos in `site/images/fotos/`
- [ ] Kroatische und slowenische Texte von Muttersprachlern gegenlesen lassen
- [x] `og:image`-Adresse in `site/index.html` auf die echte Domain setzen
- [ ] Cloudflare-DPA zur Ablage herunterladen: https://www.cloudflare.com/cloudflare-customer-dpa/
