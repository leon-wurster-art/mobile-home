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
  untertitel: "Dein Zuhause an der dalmatinischen Küste",
  ort: "Dalmacija Camp, Privlaka · Kroatien",

  // Kontakt (Footer und Notfall-Weg per E-Mail, falls die API nicht erreichbar ist)
  kontaktEmail: "jadraleno@web.de",
  telefon: "+49 176 66672965",

  /* ---------- API (Anfragen, Belegung, Preise) ---------- */
  // Website und API laufen unter derselben Adresse (Cloudflare). Nur beim Testen mit einem
  // separaten Webserver auf Port 8080 wird die lokale API auf Port 8787 genutzt.
  apiUrl: location.port === "8080" ? "http://localhost:8787" : location.origin,

  // Koordinaten für die Karte (bei Google Maps: Rechtsklick auf den Ort → Koordinaten kopieren)
  karte: {
    lat: 44.25679,
    lng: 15.12565,
    zoom: 14,
    markerText: "Mobile Home Adria<br>Dalmacija Camp, Privlaka"
  },
};
