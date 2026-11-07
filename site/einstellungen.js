/* ============================================================
   EINSTELLUNGEN  –  Mobile Home Website
   ============================================================
   Stammdaten, Preise und Regeln der Website.
   Buchungen und Sperrzeiten werden NICHT mehr hier gepflegt,
   sondern in der Verwaltung (…/admin/).

   Datumsformat immer: "JJJJ-MM-TT"  (z. B. "2027-08-01")
   ============================================================ */

const KONFIG = {

  /* ---------- Stammdaten ---------- */
  name: "Mobile Home Adria",
  untertitel: "Dein Zuhause an der Küste Istriens",
  ort: "Zelena Laguna, Poreč · Kroatien",

  // Kontakt (Footer, Fallback wenn die API nicht erreichbar ist)
  kontaktEmail: "deine-email@beispiel.de",
  telefon: "+49 170 0000000",

  /* ---------- API (Anfragen & Belegung) ---------- */
  // Adresse des Cloudflare Workers, z. B. "https://mobile-home-api.DEIN-NAME.workers.dev"
  // Leer lassen ("") = Anfragen gehen per E-Mail-Programm (mailto), Kalender ohne Belegung.
  // Beim lokalen Testen (http://localhost:8080) wird automatisch die lokale API genutzt.
  apiUrl: location.hostname === "localhost" ? "http://localhost:8787" : "https://mobile-home-api.leon-wurster.workers.dev",

  // Koordinaten für die Karte (bei Google Maps: Rechtsklick auf den Ort → Koordinaten kopieren)
  karte: {
    lat: 45.1994,
    lng: 13.5891,
    zoom: 14,
    markerText: "Mobile Home Adria<br>Zelena Laguna, Poreč"
  },

  /* ---------- Buchungsregeln ---------- */
  minNaechte: 3,            // Mindestaufenthalt (muss zu MIN_NAECHTE in api/wrangler.toml passen)
  endreinigung: 60,         // einmalige Endreinigung in €
  maxPersonen: 5,           // (muss zu MAX_PERSONEN in api/wrangler.toml passen)
  buchbarMonateVoraus: 18,  // so weit kann man im Kalender nach vorne blättern

  // true  = nur Nächte innerhalb der Saisons unten sind buchbar (Campingplatz im Winter zu)
  // false = auch außerhalb buchbar, dann gilt der standardPreis
  nurInSaisonBuchbar: true,

  /* ---------- Preise pro Nacht (Saisons) ---------- */
  // Zeiträume dürfen sich nicht überschneiden. "bis" ist einschließlich (letzte Nacht).
  standardPreis: 75,
  saisons: [
    { name: "Nebensaison",  von: "2026-04-01", bis: "2026-06-14", preisProNacht: 75  },
    { name: "Hauptsaison",  von: "2026-06-15", bis: "2026-09-06", preisProNacht: 120 },
    { name: "Nachsaison",   von: "2026-09-07", bis: "2026-10-31", preisProNacht: 80  },
    { name: "Nebensaison",  von: "2027-04-01", bis: "2027-06-14", preisProNacht: 79  },
    // TODO 2027: Haupt- und Nachsaison ergänzen, sonst ist ab 15.06.2027 nichts buchbar
    // { name: "Hauptsaison", von: "2027-06-15", bis: "2027-09-05", preisProNacht: 0 },
    // { name: "Nachsaison",  von: "2027-09-06", bis: "2027-10-31", preisProNacht: 0 },
  ],
};
