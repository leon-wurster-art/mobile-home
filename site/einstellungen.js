/* ============================================================
   EINSTELLUNGEN  –  Mobile Home Website
   ============================================================
   Hier stehen nur noch Stammdaten, Kontakt und technische Adressen.

   Preise, Saisons, Mindestnächte, Endreinigung und max. Personen
   werden in der Verwaltung gepflegt:  …/admin/ → „Preise & Regeln“.
   Buchungen und Sperrzeiten ebenfalls in der Verwaltung.
   ============================================================ */

const KONFIG = {

  /* ---------- Stammdaten ---------- */
  name: "Mobile Home Adria",
  untertitel: "Dein Zuhause an der Küste Istriens",
  ort: "Zelena Laguna, Poreč · Kroatien",

  // Kontakt (Footer und Notfall-Weg per E-Mail, falls die API nicht erreichbar ist)
  kontaktEmail: "deine-email@beispiel.de",
  telefon: "+49 170 0000000",

  /* ---------- API (Anfragen, Belegung, Preise) ---------- */
  // Beim lokalen Testen (http://localhost:8080) wird automatisch die lokale API genutzt.
  apiUrl: location.hostname === "localhost" ? "http://localhost:8787" : "https://mobile-home-api.leon-wurster.workers.dev",

  // Koordinaten für die Karte (bei Google Maps: Rechtsklick auf den Ort → Koordinaten kopieren)
  karte: {
    lat: 45.1994,
    lng: 13.5891,
    zoom: 14,
    markerText: "Mobile Home Adria<br>Zelena Laguna, Poreč"
  },
};
