-- Preise & Regeln, gepflegt in der Verwaltung (ein JSON-Dokument pro Schlüssel)
CREATE TABLE einstellungen (
  schluessel    TEXT PRIMARY KEY,
  wert          TEXT NOT NULL,
  geaendert_am  TEXT NOT NULL,
  geaendert_von TEXT
);

-- Startwerte = bisherige Werte aus einstellungen.js
INSERT INTO einstellungen (schluessel, wert, geaendert_am, geaendert_von) VALUES ('preise', '{
  "standardPreis": 75,
  "endreinigung": 60,
  "minNaechte": 3,
  "maxPersonen": 5,
  "buchbarMonateVoraus": 18,
  "nurInSaisonBuchbar": true,
  "saisons": [
    {"name": "Nebensaison", "von": "2026-04-01", "bis": "2026-06-14", "preisProNacht": 75},
    {"name": "Hauptsaison", "von": "2026-06-15", "bis": "2026-09-06", "preisProNacht": 120},
    {"name": "Nachsaison",  "von": "2026-09-07", "bis": "2026-10-31", "preisProNacht": 80},
    {"name": "Nebensaison", "von": "2027-04-01", "bis": "2027-06-14", "preisProNacht": 79}
  ]
}', '2026-11-07T00:00:00.000Z', 'Migration');
