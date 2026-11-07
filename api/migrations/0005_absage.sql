-- Wann ging die automatische Absage-Mail an den Gast raus?
ALTER TABLE buchungen ADD COLUMN absage_gesendet_am TEXT;
