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

### 4. Automatische E-Mails (Eingangsbestätigung an Gäste + Benachrichtigung an dich)
Bei jeder neuen Anfrage gehen gleichzeitig zwei Mails raus:
- **an den Gast:** Eingangsbestätigung in seiner Sprache (DE/EN/HR/SL). Absender ist `anfrage@mobile-home-privlaka.com`; Antworten landen bei `MAIL_ANTWORT_AN`.
- **an dich (`NOTIFY_TO`):** Zeitraum, Personen, Preis, Sprache und ein Knopf zur Verwaltung, bewusst ohne Name und Kontaktdaten des Gastes.

#### Einrichtung mit Brevo, Schritt für Schritt (EU-Anbieter, kostenlos bis 300 Mails/Tag, ca. 30 Minuten)

Die Bezeichnungen in Brevo und Cloudflare können sich leicht ändern. Sinngemäß bleibt alles gleich.

**Schritt 1 – Postfach `anfrage@mobile-home-privlaka.com` anlegen (Cloudflare, kostenlos)**
Die Absenderadresse soll wirklich Mails empfangen können, z. B. falls Brevo einen Bestätigungscode dorthin schickt.
1. dash.cloudflare.com → Domain **mobile-home-privlaka.com** → links **E-Mail → Email Routing**.
2. **Get started / Aktivieren**. Cloudflare trägt die nötigen DNS-Einträge (MX, SPF) selbst ein, bestätigen.
3. **Destination addresses → Add**: deine echte Mailadresse. Den Bestätigungslink in der Mail anklicken.
4. **Routing rules → Create address**: Custom address `anfrage`, Action „Send to an email", Ziel: deine Adresse → **Save**.

**Schritt 2 – Brevo-Konto**
1. brevo.com → **Sign up free**. E-Mail und ein **in Keeper erzeugtes Passwort** verwenden.
2. Mail bestätigen und die Fragen beantworten (Firma: „Mobile Home Adria", Website: mobile-home-privlaka.com). Den **Free**-Tarif wählen.
3. Empfohlen: unter **Profil (oben rechts) → Security** die Zwei-Faktor-Anmeldung einschalten.

**Schritt 3 – Domain bei Brevo bestätigen**
1. Profil oben rechts → **Senders, Domains & Dedicated IPs** → Reiter **Domains** → **Add a domain** → `mobile-home-privlaka.com`.
2. Bietet Brevo eine **automatische Einrichtung über Cloudflare** an, diese nehmen und fertig. Sonst **„Authenticate the domain yourself"**: Brevo zeigt 3–4 Einträge (Brevo-Code als TXT, DKIM als CNAME oder TXT, DMARC als TXT `_dmarc`).
3. In Cloudflare → **DNS → Records → Add record** jeden Eintrag genau so anlegen: Typ, Name und Inhalt kopieren. Bei CNAME den **Proxy-Status auf „DNS only"** (graue Wolke) stellen.
4. ⚠ Gibt es schon einen **SPF**-Eintrag (TXT `v=spf1 …` von Email Routing) und Brevo verlangt auch einen: **nicht** einen zweiten anlegen, sondern zusammenführen, z. B. `v=spf1 include:_spf.mx.cloudflare.net include:spf.brevo.com ~all`.
5. Gibt es schon einen **DMARC**-Eintrag (`_dmarc`), ebenfalls nur einen behalten.
6. Zurück in Brevo **Authenticate / Verify** klicken. Das dauert meist Minuten, selten bis zu einigen Stunden.

**Schritt 4 – Absender anlegen**
1. **Senders, Domains & Dedicated IPs** → Reiter **Senders** → **Add sender**: Name `Mobile Home Adria`, E-Mail `anfrage@mobile-home-privlaka.com`.
2. Kommt ein Bestätigungscode, landet er dank Schritt 1 in deinem Postfach.

**Schritt 5 – API-Schlüssel**
1. Profil oben rechts → **SMTP & API** → Reiter **API Keys** → **Generate a new API key**, Name z. B. `mobile-home-api`.
2. **Ablauf:** die längste angebotene Dauer wählen. Im Keeper-Eintrag eine Erinnerung zum Erneuern vor dem Ablaufdatum setzen.
3. **Zugriff: „Eingeschränkt"** und bei **Berechtigung** nur **Transaktions-E-Mails → „Alle"**. Alle anderen Zeilen auf **„Keine"**, auch „E-Mail-Kampagne".
4. Den Schlüssel **sofort in Keeper** speichern. Er wird nur einmal angezeigt. Nicht in Dateien, Chats oder den Browser kopieren.
5. Brevo-Schlüssel verfallen auch **nach 90 Tagen ohne Nutzung**. Die API nutzt ihn deshalb einmal täglich, das hält ihn aktiv. Ist der Schlüssel trotzdem abgelaufen oder ungültig, zeigt die Verwaltung oben einen **roten Hinweis**. Dann einen neuen Schlüssel erzeugen und wie in Schritt 7 eintragen.

**Schritt 6 – IP-Sperre bei Brevo ausschalten (wichtig)**
Brevo blockiert API-Aufrufe von unbekannten IP-Adressen. Cloudflare-Worker haben wechselnde IPs.
- Profil → **Security** → **Authorised IPs** → Sperre **deaktivieren**.
- Ohne diesen Schritt kommen keine Mails an. In den Logs steht dann „unrecognised IP address".

**Schritt 7 – Schlüssel und Benachrichtigungsadresse in die API eintragen**
Im Terminal (VS Code → Terminal), Ordner `api/`:
```powershell
cd "C:\Users\mini pekka\Desktop\mobile-home\api"
npx wrangler secret put BREVO_API_KEY      # Schlüssel aus Keeper einfügen, Enter
npx wrangler secret put NOTIFY_TO          # deine Adresse für Benachrichtigungen, Enter
```
Fertig, ohne neues Ausspielen.

**Schritt 8 – Testen**
1. Auf der Website eine Anfrage mit deiner eigenen E-Mail stellen, gern in einer anderen Sprache (z. B. 🌐 HR).
2. Innerhalb einer Minute sollten **zwei Mails** ankommen: die Eingangsbestätigung (als Gast) und die Benachrichtigung mit dem Knopf zur Verwaltung. Auch im **Spam-Ordner** nachsehen.
3. In der Verwaltung steht bei der Anfrage „✓ Eingangsbestätigung automatisch gesendet".
4. Test-Anfrage in der Verwaltung **löschen**.
5. Kommt nichts an: Brevo → **Transactional → Logs** ansehen, oder im Terminal `npx wrangler tail` laufen lassen und erneut testen.

Ohne Schlüssel funktioniert alles weiter, nur ohne automatische Mails. Alternativ geht **Resend** mit `RESEND_API_KEY`. Dann den Abschnitt in `datenschutz.html` anpassen.

Schutz gegen Missbrauch: höchstens 5 Anfragen pro Stunde je Anschluss, höchstens 40 automatische Gäste-Mails pro Tag. Im Gruß wird nur der Vorname verwendet, nichts, was nach Link aussieht.

### 5. Optional
- **iCal-Export schützen:** Mit `npx wrangler secret put ICS_TOKEN` gesetzt, ist der Link nur noch mit `?token=…` abrufbar.

## Im Alltag

| Was | Wo |
|---|---|
| Anfragen bestätigen / ablehnen | Verwaltung → Tab „Anfragen" |
| Bestätigungs-Mail an Gast nicht vergessen | Nach dem Bestätigen erscheint die Buchung oben im Tab „Anfragen" **gelb** unter „Bestätigungs-Mail noch senden". Dort Mail öffnen, senden, dann „✓ Als gesendet markieren". Die Zahl am Tab zählt offene Anfragen **und** offene Mails. In der Liste steht „Mail offen" oder „Mail ✓", im Kalender ist der Zeitraum unten gelb markiert. |
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
