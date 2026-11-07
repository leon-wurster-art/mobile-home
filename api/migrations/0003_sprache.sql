-- Sprache, in der der Gast angefragt hat (de, en, hr, sl) – für Antwort-Mails in seiner Sprache
ALTER TABLE buchungen ADD COLUMN sprache TEXT;
