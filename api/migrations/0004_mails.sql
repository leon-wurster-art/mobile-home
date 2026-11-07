-- Wann wurde dem Gast die Buchungsbestätigung geschickt? (Merker in der Verwaltung)
ALTER TABLE buchungen ADD COLUMN bestaetigung_gesendet_am TEXT;
-- Wann ging die automatische Eingangsbestätigung der Anfrage raus?
ALTER TABLE buchungen ADD COLUMN eingang_mail_am TEXT;
