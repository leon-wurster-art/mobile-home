-- Buchungen, Anfragen und Sperrzeiten
-- von = Anreisetag, bis = Abreisetag (die Nacht vor "bis" ist die letzte belegte Nacht)
CREATE TABLE buchungen (
  id            TEXT PRIMARY KEY,
  status        TEXT NOT NULL CHECK (status IN ('anfrage','bestaetigt','abgelehnt','storniert','blockiert')),
  von           TEXT NOT NULL,
  bis           TEXT NOT NULL,
  name          TEXT,
  email         TEXT,
  telefon       TEXT,
  personen      INTEGER,
  nachricht     TEXT,
  preis_web     INTEGER,          -- Preisschätzung, die der Gast auf der Website gesehen hat
  notiz         TEXT,             -- interne Notiz der Verwaltung
  quelle        TEXT NOT NULL DEFAULT 'web',   -- web | verwaltung
  erstellt_am   TEXT NOT NULL,
  geaendert_am  TEXT NOT NULL,
  geaendert_von TEXT,
  CHECK (von < bis)
);
CREATE INDEX idx_buchungen_status_zeitraum ON buchungen (status, von, bis);

-- Zugänge für die Verwaltungsseite (nur Passwort-Hashes, PBKDF2-SHA256)
CREATE TABLE benutzer (
  name        TEXT PRIMARY KEY,
  pw_hash     TEXT NOT NULL,
  erstellt_am TEXT NOT NULL
);

-- Zähler gegen Spam und Passwort-Raten (IP nur als gesalzener Hash, wird täglich bereinigt)
CREATE TABLE rate_limit (
  schluessel TEXT NOT NULL,
  zeit       INTEGER NOT NULL
);
CREATE INDEX idx_rate_limit ON rate_limit (schluessel, zeit);
