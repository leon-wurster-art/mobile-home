/* ============================================================
   Übersetzungen der Website  –  Deutsch · English · Hrvatski · Slovenščina
   ------------------------------------------------------------
   Texte ändern: den passenden Schlüssel in allen vier Sprachen anpassen.
   {name} usw. sind Platzhalter, die die Seite selbst füllt.
   Einträge mit [ … ] sind Mehrzahl-Formen (1 / 2–4 / 5+ …).
   ============================================================ */
(function () {
  "use strict";

  const SPRACHEN = {
    de: { name: "Deutsch",     kurz: "DE", locale: "de-DE" },
    en: { name: "English",     kurz: "EN", locale: "en-GB" },
    hr: { name: "Hrvatski",    kurz: "HR", locale: "hr-HR" },
    sl: { name: "Slovenščina", kurz: "SL", locale: "sl-SI" },
  };

  const T = {
    /* ======================= DEUTSCH ======================= */
    de: {
      "meta.title": "Mobile Home Adria · Privlaka bei Zadar",
      "meta.desc": "Modernes Mobile Home im Dalmacija Camp in Privlaka bei Zadar, Kroatien. Verfügbarkeit prüfen und direkt anfragen – klimatisiert, überdachte Terrasse, Campingplatz direkt am Meer.",
      "place": "Dalmacija Camp, Privlaka · Kroatien",

      "nav.gallery": "Galerie", "nav.amenities": "Ausstattung", "nav.availability": "Verfügbarkeit",
      "nav.location": "Lage", "nav.info": "Gut zu wissen", "nav.contact": "Kontakt", "nav.cta": "Anfragen",
      "nav.menuOpen": "Menü öffnen", "nav.menuClose": "Menü schließen", "nav.lang": "Sprache wählen",

      "hero.b1": "Klimatisiert", "hero.b2": "Überdachte Terrasse", "hero.b3": "Camp direkt am Meer",
      "hero.title": "Dein Ort <em>am Meer</em>",
      "hero.cta1": "Verfügbarkeit prüfen", "hero.cta2": "Fotos ansehen",
      "hero.alt": "Überdachte Terrasse des Mobile Homes mit Essplatz",

      "fact.guests": "4 + 1 Gäste", "fact.guestsSub": "2 Doppelbetten + Schlafcouch",
      "fact.size": "32 m² + Terrasse", "fact.sizeSub": "Baujahr 2022",
      "fact.sea": "Direkt am Meer", "fact.seaSub": "Flache Sandbucht am Camp",
      "fact.park": "Eigener Stellplatz", "fact.parkSub": "direkt am Mobile Home",

      "gal.eyebrow": "Galerie", "gal.title": "Ein Blick ins Mobile Home",
      "gal.sub": "Terrasse, Wohnbereich mit Küche, zwei Schlafzimmer und Bad – klick auf ein Foto für die große Ansicht.",
      "gal.all": "Alle", "gal.cat.aussen": "Außen & Camp", "gal.cat.terrasse": "Terrasse",
      "gal.cat.wohnen": "Wohnen & Küche", "gal.cat.schlafen": "Schlafen & Bad",
      "gal.open": "Foto vergrößern: {c}",
      "gal.terrasse-essplatz": "Überdachte Terrasse mit Essplatz",
      "gal.terrasse-lounge": "Loungeecke auf der Terrasse",
      "gal.terrasse-liege": "Sitzecke und Sonnenliege",
      "gal.eingang": "Eingang von der Terrasse",
      "gal.wohnbereich": "Wohnbereich mit Küche und Essplatz",
      "gal.kueche": "Küche mit 2 Kochfeldern",
      "gal.schlafcouch": "Schlafcouch im Wohnzimmer",
      "gal.schlafzimmer-1": "Schlafzimmer mit Doppelbett",
      "gal.schlafzimmer-2": "Zweites Schlafzimmer mit Doppelbett",
      "gal.bad": "Bad mit Dusche und WC",
      "gal.aussenansicht": "Außenansicht im Schatten der Pinien",
      "gal.parkplatz": "Eigener Parkplatz am Mobile Home",
      "lb.close": "Schließen", "lb.prev": "Vorheriges Foto", "lb.next": "Nächstes Foto",

      "am.eyebrow": "Ausstattung", "am.title": "Alles da für den Urlaub",
      "am.sub": "Kompakt, modern und komplett eingerichtet – ankommen, Kühlschrank füllen, ans Meer.",
      "am.1t": "2 Schlafzimmer", "am.1d": "Zwei Doppelbetten in getrennten Zimmern, dazu eine Schlafcouch.",
      "am.2t": "Klimaanlage", "am.2d": "Kühlt im Hochsommer, heizt an kühlen Abenden in der Vor- und Nachsaison.",
      "am.3t": "WLAN inklusive", "am.3d": "Stabiles WLAN auf der Parzelle – fürs Streamen am Abend reicht es locker.",
      "am.4t": "Voll ausgestattete Küche", "am.4d": "2 Kochfelder, Kühlschrank mit Gefrierfach, Kaffeemaschine, komplettes Geschirr.",
      "am.5t": "Überdachte Terrasse", "am.5d": "Esstisch für 6, Loungeecke und Elektrogrill – der eigentliche Wohnraum im Sommer.",
      "am.6t": "Eigenes Bad", "am.6d": "Dusche, WC und Waschbecken – nur für euch, ohne Wege zum Sanitärhaus.",
      "am.7t": "Haustiere willkommen", "am.7d": "Ein Hund ist nach Absprache erlaubt – Aufpreis auf Anfrage, einfach in der Nachricht erwähnen.",
      "am.8t": "Smart-TV", "am.8d": "Mit deinen eigenen Streaming-Konten nutzbar – für Regentage und späte Abende.",

      "av.eyebrow": "Verfügbarkeit", "av.title": "Zeitraum wählen & anfragen",
      "av.sub": "Wähle im Kalender zuerst deinen Anreisetag, dann den Abreisetag. Durchgestrichene Tage sind bereits belegt. Die Anfrage ist unverbindlich – wir melden uns innerhalb von 24 Stunden.",
      "cal.select": "Anreise wählen", "cal.selectEnd": "Abreise wählen", "cal.done": "Zeitraum gewählt",
      "cal.loading": "Lade Verfügbarkeit …", "cal.prev": "Vorheriger Monat", "cal.next": "Nächster Monat",
      "cal.free": "frei", "cal.booked": "belegt", "cal.sel": "deine Auswahl",
      "cal.dayBooked": "belegt", "cal.dayClosed": "nicht buchbar",
      "cal.loadError": "Die aktuelle Belegung konnte nicht geladen werden. Du kannst trotzdem anfragen – wir prüfen Verfügbarkeit und Preis dann manuell.",

      "sum.title": "Deine Anfrage", "sum.pickHint": "Wähle deinen Zeitraum im Kalender – der Preis wird sofort berechnet.", "sum.onRequest": "Preis auf Anfrage",
      "sum.arrival": "Anreise", "sum.departure": "Abreise", "nights": ["{n} Nacht", "{n} Nächte"],
      "sum.cleaning": "Endreinigung", "sum.total": "Gesamt (ca.)",
      "sum.minStay": "Mindestaufenthalt: {n} Nächte. Bitte wähle einen längeren Zeitraum.",
      "sum.minStaySeason": "Mindestaufenthalt ({season}): {n} Nächte. Bitte wähle einen längeren Zeitraum.",

      "f.name": "Name", "f.namePh": "Vor- und Nachname", "f.email": "E-Mail", "f.emailPh": "fuer@die-antwort.de",
      "f.phone": "Telefon", "f.optional": "(optional)", "f.persons": "Personen", "persons": ["{n} Person", "{n} Personen"],
      "f.msg": "Nachricht", "f.msgPh": "Fragen, Hund dabei, Anreisezeit …",
      "f.consent": "Ich bin einverstanden, dass meine Angaben zur Bearbeitung der Anfrage gespeichert werden. Details in der <a href=\"datenschutz.html#anfrage\">Datenschutzerklärung</a>.",
      "f.submit": "Unverbindlich anfragen", "f.sending": "Wird gesendet …",
      "f.hint": "Erst mit unserer Bestätigung wird aus der Anfrage eine Buchung.",
      "f.hintMail": "Öffnet dein E-Mail-Programm mit einer vorbereiteten Anfrage. Erst mit unserer Bestätigung wird daraus eine Buchung.",
      "ok.thanks": "Danke{name}!", "ok.text": "Deine Anfrage für {dates} ist angekommen. Wir melden uns innerhalb von 24 Stunden per E-Mail.",
      "ok.again": "Weitere Anfrage stellen",
      "err.conflict": "Der Zeitraum ist leider nicht mehr frei. Bitte wähle andere Daten.",
      "err.generic": "Die Anfrage konnte nicht gesendet werden.",
      "err.network": "Die Anfrage konnte nicht gesendet werden (keine Verbindung).",
      "err.rate": "Zu viele Anfragen – bitte später erneut versuchen.",
      "err.mail": "Anfrage stattdessen per E-Mail senden",

      "loc.eyebrow": "Lage", "loc.title": "Norddalmatien, direkt am Wasser",
      "loc.sub": "Das Dalmacija Camp liegt in Privlaka auf einer Halbinsel nordwestlich von Zadar, direkt an einer flachen Badebucht. Der Marker zeigt den Campingplatz.",
      "map.aria": "Karte mit Standort des Campingplatzes", "map.title": "Interaktive Karte",
      "map.text": "Beim Laden werden Kartenkacheln von OpenStreetMap abgerufen. Dabei wird deine IP-Adresse an die OpenStreetMap Foundation übertragen. <a href=\"datenschutz.html#karte\">Mehr dazu</a>",
      "map.load": "Karte laden", "map.open": "In OpenStreetMap öffnen", "map.loading": "Lädt …", "map.retry": "Erneut versuchen",
      "poi.1n": "Strand & Badebucht", "poi.1v": "direkt am Camp",
      "poi.2n": "Pizzeria, Eisdiele, Biergarten & Strandbar", "poi.2v": "auf dem Camp · 15.06.–15.09.",
      "poi.3n": "Supermarkt Tommy mit Metzgerei", "poi.3v": "ca. 300 m",
      "poi.4n": "Ortszentrum Privlaka", "poi.4v": "ca. 800 m",
      "poi.5n": "Königsstadt Nin", "poi.5v": "ca. 7 km · 10 Min",
      "poi.6n": "Altstadt Zadar", "poi.6v": "ca. 20 km · 25 Min",
      "poi.7n": "Flughafen Zadar", "poi.7v": "ca. 30 km · 35 Min",

      "info.eyebrow": "Gut zu wissen", "info.title": "Check-in, Regeln & Extras",
      "info.sub": "Das Wichtigste vor der Anfrage auf einen Blick – alles Weitere klären wir gern persönlich.",
      "info.checkT": "Check-in / Check-out",
      "info.checkD": "Anreise ab 15:00 Uhr, Abreise bis 10:00 Uhr. Den Schlüssel bekommt ihr an der Infobox am Eingang des Campingplatzes – dort gebt ihr ihn bei der Abreise auch wieder ab.",
      "info.minT": "Mindestaufenthalt", "info.min": "Mindestens {n} Nächte{extra}. In der Hauptsaison empfehlen wir Anreise samstags.",
      "info.cleanT": "Endreinigung", "info.clean": "Einmalig {p} pro Aufenthalt. Bettwäsche und Handtücher sind inklusive.",
      "info.payT": "Bezahlung", "info.payD": "30 % Anzahlung per Überweisung bei Bestätigung, Rest 4 Wochen vor Anreise.",
      "info.cancelT": "Stornierung", "info.cancelD": "Bis 60 Tage vor Anreise kostenlos, danach fällt die Anzahlung an. Kulanz bei Weitervermietung.",
      "info.taxT": "Kurtaxe", "info.taxD": "Wird vor Ort vom Campingplatz erhoben – laut Preisliste 2026: 1,50 € pro Erwachsenem und Tag, 0,75 € für Jugendliche von 12 bis 18 Jahren.",

      "kontakt.eyebrow": "Kontakt", "kontakt.title": "Fragen? Melde dich gern",
      "kontakt.sub": "Ob Verfügbarkeit, Anreise oder Hund – schreib uns eine E-Mail oder ruf an. Wir antworten in der Regel innerhalb von 24 Stunden.",
      "kontakt.email": "E-Mail", "kontakt.phone": "Telefon", "kontakt.stay": "Unterkunft",
      "kontakt.address": "Dalmacija Camp · Ivana Pavla II 40 · 23233 Privlaka, Kroatien",
      "kontakt.cta": "Verfügbarkeit prüfen & anfragen", "kontakt.imgAlt": "Dekoration auf dem Esstisch",

      "foot.contact": "Kontakt", "foot.note": "Privatvermietung · Alle Angaben ohne Gewähr",
      "foot.imprint": "Impressum", "foot.privacy": "Datenschutz",
      "legal.onlyGerman": "", "legal.back": "Zur Startseite",
      "poi.8n": "Bus Zadar – Vir",
      "poi.8v": "Haltestelle vor dem Camp",
      "info.campT": "Campingplatz",
      "info.campD": "Das Dalmacija Camp ist ganzjährig geöffnet. Pizzeria, Eisdiele, Biergarten und Strandbar haben vom 15. Juni bis 15. September geöffnet. Der nächste Supermarkt – Tommy, mit Metzgerei – liegt rund 300 m entfernt (Ulica Ivana Pavla II 99). Rezeption: <a href=\"tel:+385992553190\">+385 99 255 3190</a> (Deutsch), <a href=\"tel:+385992553195\">+385 99 255 3195</a> (Kroatisch/Englisch), <a href=\"mailto:info@dalmacija-camp.com\">info@dalmacija-camp.com</a>.",
      "info.tripsT": "Ausflüge",
      "info.tripsD": "Nationalparks Krka, Plitvicer Seen, Kornaten und Paklenica, Kitesurfen in Nin, Rafting auf der Zrmanja, Abenteuerpark bei Zadar – Tipps gibt es an der Rezeption.",
      "cal.priceNote": "Preis pro Nacht",
      "gal.cat.strand": "Strand & Umgebung",
      "gal.strand-soline": "Sonnenuntergang am Strand Soline, Privlaka",
      "gal.strand-sabunike": "Sandstrand Sabunike bei Privlaka",
      "gal.strand-abendrot": "Abendrot am Sandstrand von Privlaka",

      "season.Hauptsaison": "Hauptsaison", "season.Nebensaison": "Nebensaison",
      "season.Nachsaison": "Nachsaison", "season.Vorsaison": "Vorsaison",
    },

    /* ======================= ENGLISH ======================= */
    en: {
      "meta.title": "Mobile Home Adria · Privlaka near Zadar",
      "meta.desc": "Modern mobile home at Dalmacija Camp in Privlaka near Zadar, Croatia. Check availability and enquire directly – air-conditioned, covered terrace, campsite right by the sea.",
      "place": "Dalmacija Camp, Privlaka · Croatia",

      "nav.gallery": "Gallery", "nav.amenities": "Amenities", "nav.availability": "Availability",
      "nav.location": "Location", "nav.info": "Good to know", "nav.contact": "Contact", "nav.cta": "Enquire",
      "nav.menuOpen": "Open menu", "nav.menuClose": "Close menu", "nav.lang": "Choose language",

      "hero.b1": "Air-conditioned", "hero.b2": "Covered terrace", "hero.b3": "Campsite right by the sea",
      "hero.title": "Your place <em>by the sea</em>",
      "hero.cta1": "Check availability", "hero.cta2": "View photos",
      "hero.alt": "Covered terrace of the mobile home with dining area",

      "fact.guests": "4 + 1 guests", "fact.guestsSub": "2 double beds + sofa bed",
      "fact.size": "32 m² + terrace", "fact.sizeSub": "Built in 2022",
      "fact.sea": "Right by the sea", "fact.seaSub": "Shallow sandy bay at the campsite",
      "fact.park": "Private parking", "fact.parkSub": "right next to the mobile home",

      "gal.eyebrow": "Gallery", "gal.title": "A look inside the mobile home",
      "gal.sub": "Terrace, living area with kitchen, two bedrooms and bathroom – click a photo to enlarge it.",
      "gal.all": "All", "gal.cat.aussen": "Outside & campsite", "gal.cat.terrasse": "Terrace",
      "gal.cat.wohnen": "Living & kitchen", "gal.cat.schlafen": "Bedrooms & bathroom",
      "gal.open": "Enlarge photo: {c}",
      "gal.terrasse-essplatz": "Covered terrace with dining area",
      "gal.terrasse-lounge": "Lounge corner on the terrace",
      "gal.terrasse-liege": "Seating corner and sun lounger",
      "gal.eingang": "Entrance from the terrace",
      "gal.wohnbereich": "Living area with kitchen and dining table",
      "gal.kueche": "Kitchen with two-ring hob",
      "gal.schlafcouch": "Sofa bed in the living room",
      "gal.schlafzimmer-1": "Bedroom with double bed",
      "gal.schlafzimmer-2": "Second bedroom with double bed",
      "gal.bad": "Bathroom with shower and toilet",
      "gal.aussenansicht": "Exterior in the shade of the pine trees",
      "gal.parkplatz": "Private parking space at the mobile home",
      "lb.close": "Close", "lb.prev": "Previous photo", "lb.next": "Next photo",

      "am.eyebrow": "Amenities", "am.title": "Everything you need for your holiday",
      "am.sub": "Compact, modern and fully furnished – arrive, fill the fridge, head to the beach.",
      "am.1t": "2 bedrooms", "am.1d": "Two double beds in separate rooms, plus a sofa bed.",
      "am.2t": "Air conditioning", "am.2d": "Cools you down in high summer and heats on cool evenings in spring and autumn.",
      "am.3t": "Wi-Fi included", "am.3d": "Reliable Wi-Fi at the pitch – plenty for streaming in the evening.",
      "am.4t": "Fully equipped kitchen", "am.4d": "Two-ring hob, fridge with freezer compartment, coffee machine, full set of crockery.",
      "am.5t": "Covered terrace", "am.5d": "Dining table for 6, lounge corner and electric grill – your real living room in summer.",
      "am.6t": "Private bathroom", "am.6d": "Shower, toilet and washbasin – just for you, no trips to the shower block.",
      "am.7t": "Pets welcome", "am.7d": "One dog is allowed by arrangement – surcharge on request, just mention it in your message.",
      "am.8t": "Smart TV", "am.8d": "Use your own streaming accounts – for rainy days and late evenings.",

      "av.eyebrow": "Availability", "av.title": "Choose your dates & enquire",
      "av.sub": "Select your arrival day in the calendar first, then your departure day. Crossed-out days are already booked. Your enquiry is non-binding – we'll get back to you within 24 hours.",
      "cal.select": "Select arrival", "cal.selectEnd": "Select departure", "cal.done": "Dates selected",
      "cal.loading": "Loading availability …", "cal.prev": "Previous month", "cal.next": "Next month",
      "cal.free": "available", "cal.booked": "booked", "cal.sel": "your selection",
      "cal.dayBooked": "booked", "cal.dayClosed": "not available",
      "cal.loadError": "The current availability could not be loaded. You can still send an enquiry – we'll then check availability and price manually.",

      "sum.title": "Your enquiry", "sum.pickHint": "Select your dates in the calendar – the price is calculated instantly.", "sum.onRequest": "Price on request",
      "sum.arrival": "Arrival", "sum.departure": "Departure", "nights": ["{n} night", "{n} nights"],
      "sum.cleaning": "Final cleaning", "sum.total": "Total (approx.)",
      "sum.minStay": "Minimum stay: {n} nights. Please choose a longer stay.",
      "sum.minStaySeason": "Minimum stay ({season}): {n} nights. Please choose a longer stay.",

      "f.name": "Name", "f.namePh": "First and last name", "f.email": "Email", "f.emailPh": "name@example.com",
      "f.phone": "Phone", "f.optional": "(optional)", "f.persons": "Guests", "persons": ["{n} guest", "{n} guests"],
      "f.msg": "Message", "f.msgPh": "Questions, travelling with a dog, arrival time …",
      "f.consent": "I agree that my details will be stored to process my enquiry. Details in the <a href=\"datenschutz.html#anfrage\">privacy policy</a> (in German).",
      "f.submit": "Send non-binding enquiry", "f.sending": "Sending …",
      "f.hint": "Your enquiry only becomes a booking once we confirm it.",
      "f.hintMail": "Opens your email program with a prepared enquiry. It only becomes a booking once we confirm it.",
      "ok.thanks": "Thank you{name}!", "ok.text": "Your enquiry for {dates} has been received. We'll reply by email within 24 hours.",
      "ok.again": "Send another enquiry",
      "err.conflict": "Sorry, these dates are no longer available. Please choose different dates.",
      "err.generic": "Your enquiry could not be sent.",
      "err.network": "Your enquiry could not be sent (no connection).",
      "err.rate": "Too many enquiries – please try again later.",
      "err.mail": "Send your enquiry by email instead",

      "loc.eyebrow": "Location", "loc.title": "Northern Dalmatia, right on the water",
      "loc.sub": "Dalmacija Camp is in Privlaka, on a peninsula north-west of Zadar, right on a shallow swimming bay. The marker shows the campsite.",
      "map.aria": "Map showing the campsite location", "map.title": "Interactive map",
      "map.text": "Loading the map retrieves map tiles from OpenStreetMap, which transmits your IP address to the OpenStreetMap Foundation. <a href=\"datenschutz.html#karte\">More info</a>",
      "map.load": "Load map", "map.open": "Open in OpenStreetMap", "map.loading": "Loading …", "map.retry": "Try again",
      "poi.1n": "Beach & swimming bay", "poi.1v": "right at the campsite",
      "poi.2n": "Pizzeria, ice-cream parlour, beer garden & beach bar", "poi.2v": "at the campsite · 15 Jun–15 Sep",
      "poi.3n": "Tommy supermarket with butcher's counter", "poi.3v": "approx. 300 m",
      "poi.4n": "Privlaka centre", "poi.4v": "approx. 800 m",
      "poi.5n": "Royal town of Nin", "poi.5v": "approx. 7 km · 10 min",
      "poi.6n": "Zadar old town", "poi.6v": "approx. 20 km · 25 min",
      "poi.7n": "Zadar airport", "poi.7v": "approx. 30 km · 35 min",

      "info.eyebrow": "Good to know", "info.title": "Check-in, rules & extras",
      "info.sub": "The essentials at a glance – we're happy to clarify everything else personally.",
      "info.checkT": "Check-in / check-out",
      "info.checkD": "Arrival from 3 pm, departure by 10 am. You'll get the key at the info point at the campsite entrance – please return it there when you leave.",
      "info.minT": "Minimum stay", "info.min": "At least {n} nights{extra}. In high season we recommend arriving on a Saturday.",
      "info.cleanT": "Final cleaning", "info.clean": "One-off {p} per stay. Bed linen and towels are included.",
      "info.payT": "Payment", "info.payD": "30% deposit by bank transfer upon confirmation, balance 4 weeks before arrival.",
      "info.cancelT": "Cancellation", "info.cancelD": "Free of charge up to 60 days before arrival; after that the deposit is retained. We'll be accommodating if we can re-let.",
      "info.taxT": "Tourist tax", "info.taxD": "Collected on site by the campsite – according to the 2026 price list: €1.50 per adult per day, €0.75 for young people aged 12 to 18.",

      "kontakt.eyebrow": "Contact", "kontakt.title": "Questions? Get in touch",
      "kontakt.sub": "Availability, arrival or bringing your dog – send us an email or give us a call. We usually reply within 24 hours.",
      "kontakt.email": "Email", "kontakt.phone": "Phone", "kontakt.stay": "Accommodation",
      "kontakt.address": "Dalmacija Camp · Ivana Pavla II 40 · 23233 Privlaka, Croatia",
      "kontakt.cta": "Check availability & enquire", "kontakt.imgAlt": "Decoration on the dining table",

      "foot.contact": "Contact", "foot.note": "Private rental · All information without guarantee",
      "foot.imprint": "Legal notice", "foot.privacy": "Privacy",
      "legal.onlyGerman": "This page is only available in German.", "legal.back": "Back to home page",
      "poi.8n": "Bus Zadar – Vir",
      "poi.8v": "stop in front of the campsite",
      "info.campT": "Campsite",
      "info.campD": "Dalmacija Camp is open all year round. The pizzeria, ice-cream parlour, beer garden and beach bar are open from 15 June to 15 September. The nearest supermarket – Tommy, with a butcher's counter – is about 300 m away (Ulica Ivana Pavla II 99). Reception: <a href=\"tel:+385992553190\">+385 99 255 3190</a> (German), <a href=\"tel:+385992553195\">+385 99 255 3195</a> (Croatian/English), <a href=\"mailto:info@dalmacija-camp.com\">info@dalmacija-camp.com</a>.",
      "info.tripsT": "Excursions",
      "info.tripsD": "Krka, Plitvice Lakes, Kornati and Paklenica national parks, kitesurfing in Nin, rafting on the Zrmanja, adventure park near Zadar – ask at reception for tips.",
      "cal.priceNote": "price per night",
      "gal.cat.strand": "Beach & surroundings",
      "gal.strand-soline": "Sunset at Soline beach, Privlaka",
      "gal.strand-sabunike": "Sabunike sandy beach near Privlaka",
      "gal.strand-abendrot": "Evening glow at Privlaka's sandy beach",

      "season.Hauptsaison": "high season", "season.Nebensaison": "low season",
      "season.Nachsaison": "late season", "season.Vorsaison": "early season",
    },

    /* ======================= HRVATSKI ======================= */
    hr: {
      "meta.title": "Mobile Home Adria · Privlaka kod Zadra",
      "meta.desc": "Moderna mobilna kućica u kampu Dalmacija u Privlaci kod Zadra. Provjeri dostupnost i pošalji upit izravno – klima, natkrivena terasa, kamp uz samo more.",
      "place": "Kamp Dalmacija, Privlaka · Hrvatska",

      "nav.gallery": "Galerija", "nav.amenities": "Oprema", "nav.availability": "Dostupnost",
      "nav.location": "Lokacija", "nav.info": "Korisno znati", "nav.contact": "Kontakt", "nav.cta": "Upit",
      "nav.menuOpen": "Otvori izbornik", "nav.menuClose": "Zatvori izbornik", "nav.lang": "Odaberi jezik",

      "hero.b1": "Klimatizirano", "hero.b2": "Natkrivena terasa", "hero.b3": "Kamp uz samo more",
      "hero.title": "Tvoje mjesto <em>uz more</em>",
      "hero.cta1": "Provjeri dostupnost", "hero.cta2": "Pogledaj fotografije",
      "hero.alt": "Natkrivena terasa mobilne kućice s blagovaonicom",

      "fact.guests": "4 + 1 osoba", "fact.guestsSub": "2 bračna kreveta + kauč na razvlačenje",
      "fact.size": "32 m² + terasa", "fact.sizeSub": "Izgrađeno 2022.",
      "fact.sea": "Uz samo more", "fact.seaSub": "Plitka pješčana uvala u kampu",
      "fact.park": "Vlastito parkirno mjesto", "fact.parkSub": "odmah uz mobilnu kućicu",

      "gal.eyebrow": "Galerija", "gal.title": "Pogled u mobilnu kućicu",
      "gal.sub": "Terasa, dnevni boravak s kuhinjom, dvije spavaće sobe i kupaonica – klikni na fotografiju za veći prikaz.",
      "gal.all": "Sve", "gal.cat.aussen": "Vani i kamp", "gal.cat.terrasse": "Terasa",
      "gal.cat.wohnen": "Boravak i kuhinja", "gal.cat.schlafen": "Spavaće sobe i kupaonica",
      "gal.open": "Povećaj fotografiju: {c}",
      "gal.terrasse-essplatz": "Natkrivena terasa s blagovaonicom",
      "gal.terrasse-lounge": "Lounge kutak na terasi",
      "gal.terrasse-liege": "Kutak za sjedenje i ležaljka",
      "gal.eingang": "Ulaz s terase",
      "gal.wohnbereich": "Dnevni boravak s kuhinjom i blagovaonicom",
      "gal.kueche": "Kuhinja s dvije ploče za kuhanje",
      "gal.schlafcouch": "Kauč na razvlačenje u dnevnom boravku",
      "gal.schlafzimmer-1": "Spavaća soba s bračnim krevetom",
      "gal.schlafzimmer-2": "Druga spavaća soba s bračnim krevetom",
      "gal.bad": "Kupaonica s tušem i WC-om",
      "gal.aussenansicht": "Pogled izvana u hladu borova",
      "gal.parkplatz": "Vlastito parkirno mjesto uz mobilnu kućicu",
      "lb.close": "Zatvori", "lb.prev": "Prethodna fotografija", "lb.next": "Sljedeća fotografija",

      "am.eyebrow": "Oprema", "am.title": "Sve što trebaš za odmor",
      "am.sub": "Kompaktno, moderno i potpuno opremljeno – stigni, napuni hladnjak i pravac more.",
      "am.1t": "2 spavaće sobe", "am.1d": "Dva bračna kreveta u odvojenim sobama, uz to kauč na razvlačenje.",
      "am.2t": "Klima uređaj", "am.2d": "Hladi usred ljeta, a za svježih večeri u pred- i posezoni grije.",
      "am.3t": "Wi-Fi uključen", "am.3d": "Stabilan Wi-Fi na parceli – dovoljno i za večernji streaming.",
      "am.4t": "Potpuno opremljena kuhinja", "am.4d": "Dvije ploče za kuhanje, hladnjak sa zamrzivačem, aparat za kavu, kompletno posuđe.",
      "am.5t": "Natkrivena terasa", "am.5d": "Stol za 6 osoba, lounge kutak i električni roštilj – ljeti pravi dnevni boravak.",
      "am.6t": "Vlastita kupaonica", "am.6d": "Tuš, WC i umivaonik – samo za vas, bez odlaska do sanitarnog čvora.",
      "am.7t": "Kućni ljubimci dobrodošli", "am.7d": "Jedan pas dopušten je uz dogovor – doplata na upit, samo to navedi u poruci.",
      "am.8t": "Smart TV", "am.8d": "Koristi vlastite račune za streaming – za kišne dane i kasne večeri.",

      "av.eyebrow": "Dostupnost", "av.title": "Odaberi termin i pošalji upit",
      "av.sub": "U kalendaru najprije odaberi dan dolaska, zatim dan odlaska. Prekriženi dani su već zauzeti. Upit je neobvezujući – javit ćemo ti se u roku od 24 sata.",
      "cal.select": "Odaberi dolazak", "cal.selectEnd": "Odaberi odlazak", "cal.done": "Termin odabran",
      "cal.loading": "Učitavanje dostupnosti …", "cal.prev": "Prethodni mjesec", "cal.next": "Sljedeći mjesec",
      "cal.free": "slobodno", "cal.booked": "zauzeto", "cal.sel": "tvoj odabir",
      "cal.dayBooked": "zauzeto", "cal.dayClosed": "nije moguće rezervirati",
      "cal.loadError": "Trenutna dostupnost nije se mogla učitati. Svejedno možeš poslati upit – dostupnost i cijenu tada ćemo provjeriti ručno.",

      "sum.title": "Tvoj upit", "sum.pickHint": "Odaberi termin u kalendaru – cijena se odmah izračunava.", "sum.onRequest": "Cijena na upit",
      "sum.arrival": "Dolazak", "sum.departure": "Odlazak", "nights": ["{n} noć", "{n} noći", "{n} noći"],
      "sum.cleaning": "Završno čišćenje", "sum.total": "Ukupno (otprilike)",
      "sum.minStay": "Minimalni boravak: {n} noći. Odaberi duži termin.",
      "sum.minStaySeason": "Minimalni boravak ({season}): {n} noći. Odaberi duži termin.",

      "f.name": "Ime i prezime", "f.namePh": "Ime i prezime", "f.email": "E-pošta", "f.emailPh": "ime@primjer.hr",
      "f.phone": "Telefon", "f.optional": "(neobavezno)", "f.persons": "Broj osoba", "persons": ["{n} osoba", "{n} osobe", "{n} osoba"],
      "f.msg": "Poruka", "f.msgPh": "Pitanja, dolazak sa psom, vrijeme dolaska …",
      "f.consent": "Slažem se da se moji podaci pohrane radi obrade upita. Detalji u <a href=\"datenschutz.html#anfrage\">izjavi o zaštiti podataka</a> (na njemačkom).",
      "f.submit": "Pošalji neobvezujući upit", "f.sending": "Šalje se …",
      "f.hint": "Upit postaje rezervacija tek nakon naše potvrde.",
      "f.hintMail": "Otvara tvoj program za e-poštu s pripremljenim upitom. Rezervacija postaje važeća tek nakon naše potvrde.",
      "ok.thanks": "Hvala{name}!", "ok.text": "Tvoj upit za {dates} je zaprimljen. Javit ćemo ti se e-poštom u roku od 24 sata.",
      "ok.again": "Pošalji novi upit",
      "err.conflict": "Nažalost, termin više nije slobodan. Odaberi druge datume.",
      "err.generic": "Upit nije bilo moguće poslati.",
      "err.network": "Upit nije bilo moguće poslati (nema veze).",
      "err.rate": "Previše upita – pokušaj ponovno kasnije.",
      "err.mail": "Pošalji upit e-poštom",

      "loc.eyebrow": "Lokacija", "loc.title": "Sjeverna Dalmacija, uz samo more",
      "loc.sub": "Kamp Dalmacija nalazi se u Privlaci, na poluotoku sjeverozapadno od Zadra, uz samu plitku uvalu za kupanje. Oznaka pokazuje kamp.",
      "map.aria": "Karta s lokacijom kampa", "map.title": "Interaktivna karta",
      "map.text": "Učitavanjem karte preuzimaju se karte s OpenStreetMapa, pri čemu se tvoja IP adresa prenosi zakladi OpenStreetMap Foundation. <a href=\"datenschutz.html#karte\">Više informacija</a>",
      "map.load": "Učitaj kartu", "map.open": "Otvori u OpenStreetMapu", "map.loading": "Učitava se …", "map.retry": "Pokušaj ponovno",
      "poi.1n": "Plaža i uvala za kupanje", "poi.1v": "uz sam kamp",
      "poi.2n": "Pizzerija, slastičarnica, pivnica i beach bar", "poi.2v": "u kampu · 15. 6. – 15. 9.",
      "poi.3n": "Supermarket Tommy s mesnicom", "poi.3v": "oko 300 m",
      "poi.4n": "Centar Privlake", "poi.4v": "oko 800 m",
      "poi.5n": "Kraljevski grad Nin", "poi.5v": "oko 7 km · 10 min",
      "poi.6n": "Stari grad Zadar", "poi.6v": "oko 20 km · 25 min",
      "poi.7n": "Zračna luka Zadar", "poi.7v": "oko 30 km · 35 min",

      "info.eyebrow": "Korisno znati", "info.title": "Prijava, pravila i dodaci",
      "info.sub": "Najvažnije na prvi pogled – sve ostalo rado ćemo dogovoriti osobno.",
      "info.checkT": "Dolazak / odlazak",
      "info.checkD": "Dolazak od 15:00, odlazak do 10:00 sati. Ključ preuzimate na info-punktu na ulazu u kamp – ondje ga i vraćate pri odlasku.",
      "info.minT": "Minimalni boravak", "info.min": "Najmanje {n} noći{extra}. U glavnoj sezoni preporučujemo dolazak subotom.",
      "info.cleanT": "Završno čišćenje", "info.clean": "Jednokratno {p} po boravku. Posteljina i ručnici su uključeni.",
      "info.payT": "Plaćanje", "info.payD": "Predujam od 30 % bankovnom uplatom pri potvrdi, ostatak 4 tjedna prije dolaska.",
      "info.cancelT": "Otkazivanje", "info.cancelD": "Besplatno do 60 dana prije dolaska, nakon toga zadržava se predujam. Ako termin ponovno iznajmimo, izaći ćemo ti u susret.",
      "info.taxT": "Boravišna pristojba", "info.taxD": "Naplaćuje je kamp na licu mjesta – prema cjeniku za 2026.: 1,50 € po odrasloj osobi dnevno, 0,75 € za mlade od 12 do 18 godina.",

      "kontakt.eyebrow": "Kontakt", "kontakt.title": "Pitanja? Javi nam se",
      "kontakt.sub": "Bilo da je riječ o dostupnosti, dolasku ili psu – pošalji nam e-poštu ili nazovi. Obično odgovaramo u roku od 24 sata.",
      "kontakt.email": "E-pošta", "kontakt.phone": "Telefon", "kontakt.stay": "Smještaj",
      "kontakt.address": "Kamp Dalmacija · Ivana Pavla II 40 · 23233 Privlaka, Hrvatska",
      "kontakt.cta": "Provjeri dostupnost i pošalji upit", "kontakt.imgAlt": "Ukras na stolu za blagovanje",

      "foot.contact": "Kontakt", "foot.note": "Privatni smještaj · Sve informacije bez jamstva",
      "foot.imprint": "Impresum", "foot.privacy": "Zaštita podataka",
      "legal.onlyGerman": "Ova je stranica dostupna samo na njemačkom jeziku.", "legal.back": "Na početnu stranicu",
      "poi.8n": "Autobus Zadar – Vir",
      "poi.8v": "stanica ispred kampa",
      "info.campT": "Kamp",
      "info.campD": "Kamp Dalmacija otvoren je cijele godine. Pizzerija, slastičarnica, pivnica i beach bar rade od 15. lipnja do 15. rujna. Najbliži supermarket – Tommy, s mesnicom – udaljen je oko 300 m (Ulica Ivana Pavla II 99). Recepcija: <a href=\"tel:+385992553190\">+385 99 255 3190</a> (njemački), <a href=\"tel:+385992553195\">+385 99 255 3195</a> (hrvatski/engleski), <a href=\"mailto:info@dalmacija-camp.com\">info@dalmacija-camp.com</a>.",
      "info.tripsT": "Izleti",
      "info.tripsD": "Nacionalni parkovi Krka, Plitvička jezera, Kornati i Paklenica, kitesurfing u Ninu, rafting na Zrmanji, avanturistički park kod Zadra – savjete dobiješ na recepciji.",
      "cal.priceNote": "cijena po noći",
      "gal.cat.strand": "Plaža i okolica",
      "gal.strand-soline": "Zalazak sunca na plaži Soline, Privlaka",
      "gal.strand-sabunike": "Pješčana plaža Sabunike kod Privlake",
      "gal.strand-abendrot": "Večernje rumenilo na pješčanoj plaži u Privlaci",

      "season.Hauptsaison": "glavna sezona", "season.Nebensaison": "niska sezona",
      "season.Nachsaison": "posezona", "season.Vorsaison": "predsezona",
    },

    /* ======================= SLOVENŠČINA ======================= */
    sl: {
      "meta.title": "Mobile Home Adria · Privlaka pri Zadru",
      "meta.desc": "Sodobna mobilna hišica v kampu Dalmacija v Privlaki pri Zadru na Hrvaškem. Preveri razpoložljivost in pošlji povpraševanje – klima, pokrita terasa, kamp tik ob morju.",
      "place": "Kamp Dalmacija, Privlaka · Hrvaška",

      "nav.gallery": "Galerija", "nav.amenities": "Oprema", "nav.availability": "Razpoložljivost",
      "nav.location": "Lokacija", "nav.info": "Dobro je vedeti", "nav.contact": "Kontakt", "nav.cta": "Povpraševanje",
      "nav.menuOpen": "Odpri meni", "nav.menuClose": "Zapri meni", "nav.lang": "Izberi jezik",

      "hero.b1": "Klimatizirano", "hero.b2": "Pokrita terasa", "hero.b3": "Kamp tik ob morju",
      "hero.title": "Tvoj kraj <em>ob morju</em>",
      "hero.cta1": "Preveri razpoložljivost", "hero.cta2": "Oglej si fotografije",
      "hero.alt": "Pokrita terasa mobilne hišice z jedilnim kotičkom",

      "fact.guests": "4 + 1 oseba", "fact.guestsSub": "2 zakonski postelji + raztegljiv kavč",
      "fact.size": "32 m² + terasa", "fact.sizeSub": "Letnik 2022",
      "fact.sea": "Tik ob morju", "fact.seaSub": "Plitev peščen zaliv v kampu",
      "fact.park": "Lastno parkirno mesto", "fact.parkSub": "tik ob mobilni hišici",

      "gal.eyebrow": "Galerija", "gal.title": "Pogled v mobilno hišico",
      "gal.sub": "Terasa, dnevni prostor s kuhinjo, dve spalnici in kopalnica – klikni na fotografijo za večji prikaz.",
      "gal.all": "Vse", "gal.cat.aussen": "Zunaj in kamp", "gal.cat.terrasse": "Terasa",
      "gal.cat.wohnen": "Bivanje in kuhinja", "gal.cat.schlafen": "Spalnici in kopalnica",
      "gal.open": "Povečaj fotografijo: {c}",
      "gal.terrasse-essplatz": "Pokrita terasa z jedilnim kotičkom",
      "gal.terrasse-lounge": "Lounge kotiček na terasi",
      "gal.terrasse-liege": "Sedežni kotiček in ležalnik",
      "gal.eingang": "Vhod s terase",
      "gal.wohnbereich": "Dnevni prostor s kuhinjo in jedilno mizo",
      "gal.kueche": "Kuhinja z dvema kuhalnima ploščama",
      "gal.schlafcouch": "Raztegljiv kavč v dnevni sobi",
      "gal.schlafzimmer-1": "Spalnica z zakonsko posteljo",
      "gal.schlafzimmer-2": "Druga spalnica z zakonsko posteljo",
      "gal.bad": "Kopalnica s tušem in WC-jem",
      "gal.aussenansicht": "Zunanjost v senci borovcev",
      "gal.parkplatz": "Lastno parkirno mesto ob mobilni hišici",
      "lb.close": "Zapri", "lb.prev": "Prejšnja fotografija", "lb.next": "Naslednja fotografija",

      "am.eyebrow": "Oprema", "am.title": "Vse, kar potrebuješ za dopust",
      "am.sub": "Kompaktno, sodobno in v celoti opremljeno – pridi, napolni hladilnik in na morje.",
      "am.1t": "2 spalnici", "am.1d": "Dve zakonski postelji v ločenih sobah, poleg tega raztegljiv kavč.",
      "am.2t": "Klimatska naprava", "am.2d": "Sredi poletja hladi, ob hladnih večerih v pred- in posezoni pa ogreva.",
      "am.3t": "Wi-Fi vključen", "am.3d": "Stabilen Wi-Fi na parceli – dovolj tudi za večerno pretakanje.",
      "am.4t": "Popolnoma opremljena kuhinja", "am.4d": "Dve kuhalni plošči, hladilnik z zamrzovalnikom, kavni aparat, komplet posode.",
      "am.5t": "Pokrita terasa", "am.5d": "Miza za 6 oseb, lounge kotiček in električni žar – poleti prava dnevna soba.",
      "am.6t": "Lastna kopalnica", "am.6d": "Tuš, WC in umivalnik – samo za vas, brez hoje do sanitarij.",
      "am.7t": "Hišni ljubljenčki dobrodošli", "am.7d": "En pes je dovoljen po dogovoru – doplačilo na povpraševanje, samo omeni ga v sporočilu.",
      "am.8t": "Pametni TV", "am.8d": "Uporabi svoje račune za pretakanje – za deževne dni in pozne večere.",

      "av.eyebrow": "Razpoložljivost", "av.title": "Izberi termin in pošlji povpraševanje",
      "av.sub": "V koledarju najprej izberi dan prihoda, nato dan odhoda. Prečrtani dnevi so že zasedeni. Povpraševanje je nezavezujoče – odgovorili ti bomo v 24 urah.",
      "cal.select": "Izberi prihod", "cal.selectEnd": "Izberi odhod", "cal.done": "Termin izbran",
      "cal.loading": "Nalaganje razpoložljivosti …", "cal.prev": "Prejšnji mesec", "cal.next": "Naslednji mesec",
      "cal.free": "prosto", "cal.booked": "zasedeno", "cal.sel": "tvoja izbira",
      "cal.dayBooked": "zasedeno", "cal.dayClosed": "ni mogoče rezervirati",
      "cal.loadError": "Trenutne razpoložljivosti ni bilo mogoče naložiti. Povpraševanje lahko vseeno pošlješ – razpoložljivost in ceno bomo nato preverili ročno.",

      "sum.title": "Tvoje povpraševanje", "sum.pickHint": "Izberi termin v koledarju – cena se izračuna takoj.", "sum.onRequest": "Cena na povpraševanje",
      "sum.arrival": "Prihod", "sum.departure": "Odhod", "nights": ["{n} noč", "{n} noči", "{n} noči", "{n} noči"],
      "sum.cleaning": "Končno čiščenje", "sum.total": "Skupaj (približno)",
      "sum.minStay": "Najkrajše bivanje: {n} noči. Izberi daljši termin.",
      "sum.minStaySeason": "Najkrajše bivanje ({season}): {n} noči. Izberi daljši termin.",

      "f.name": "Ime in priimek", "f.namePh": "Ime in priimek", "f.email": "E-pošta", "f.emailPh": "ime@primer.si",
      "f.phone": "Telefon", "f.optional": "(neobvezno)", "f.persons": "Število oseb", "persons": ["{n} oseba", "{n} osebi", "{n} osebe", "{n} oseb"],
      "f.msg": "Sporočilo", "f.msgPh": "Vprašanja, potovanje s psom, čas prihoda …",
      "f.consent": "Strinjam se, da se moji podatki shranijo za obdelavo povpraševanja. Podrobnosti v <a href=\"datenschutz.html#anfrage\">izjavi o varstvu podatkov</a> (v nemščini).",
      "f.submit": "Pošlji nezavezujoče povpraševanje", "f.sending": "Pošiljanje …",
      "f.hint": "Povpraševanje postane rezervacija šele z našo potrditvijo.",
      "f.hintMail": "Odpre tvoj e-poštni program s pripravljenim povpraševanjem. Rezervacija velja šele z našo potrditvijo.",
      "ok.thanks": "Hvala{name}!", "ok.text": "Tvoje povpraševanje za {dates} smo prejeli. Odgovorili ti bomo po e-pošti v 24 urah.",
      "ok.again": "Pošlji novo povpraševanje",
      "err.conflict": "Žal termin ni več prost. Izberi druge datume.",
      "err.generic": "Povpraševanja ni bilo mogoče poslati.",
      "err.network": "Povpraševanja ni bilo mogoče poslati (ni povezave).",
      "err.rate": "Preveč povpraševanj – poskusi znova pozneje.",
      "err.mail": "Pošlji povpraševanje po e-pošti",

      "loc.eyebrow": "Lokacija", "loc.title": "Severna Dalmacija, tik ob vodi",
      "loc.sub": "Kamp Dalmacija leži v Privlaki na polotoku severozahodno od Zadra, tik ob plitvem zalivu za kopanje. Oznaka prikazuje kamp.",
      "map.aria": "Zemljevid z lokacijo kampa", "map.title": "Interaktivni zemljevid",
      "map.text": "Ob nalaganju zemljevida se ploščice prenesejo z OpenStreetMap, pri čemer se tvoj naslov IP posreduje fundaciji OpenStreetMap Foundation. <a href=\"datenschutz.html#karte\">Več o tem</a>",
      "map.load": "Naloži zemljevid", "map.open": "Odpri v OpenStreetMap", "map.loading": "Nalaganje …", "map.retry": "Poskusi znova",
      "poi.1n": "Plaža in zaliv za kopanje", "poi.1v": "tik ob kampu",
      "poi.2n": "Picerija, sladoledarna, pivnica in plažni bar", "poi.2v": "v kampu · 15. 6.–15. 9.",
      "poi.3n": "Supermarket Tommy z mesnico", "poi.3v": "pribl. 300 m",
      "poi.4n": "Središče Privlake", "poi.4v": "pribl. 800 m",
      "poi.5n": "Kraljevo mesto Nin", "poi.5v": "pribl. 7 km · 10 min",
      "poi.6n": "Staro mestno jedro Zadra", "poi.6v": "pribl. 20 km · 25 min",
      "poi.7n": "Letališče Zadar", "poi.7v": "pribl. 30 km · 35 min",

      "info.eyebrow": "Dobro je vedeti", "info.title": "Prijava, pravila in dodatki",
      "info.sub": "Najpomembnejše na prvi pogled – vse ostalo z veseljem uredimo osebno.",
      "info.checkT": "Prihod / odhod",
      "info.checkD": "Prihod od 15:00, odhod do 10:00. Ključ prevzamete na informacijski točki ob vhodu v kamp – tam ga ob odhodu tudi vrnete.",
      "info.minT": "Najkrajše bivanje", "info.min": "Najmanj {n} noči{extra}. V glavni sezoni priporočamo prihod v soboto.",
      "info.cleanT": "Končno čiščenje", "info.clean": "Enkratno {p} na bivanje. Posteljnina in brisače so vključene.",
      "info.payT": "Plačilo", "info.payD": "30 % predplačila z bančnim nakazilom ob potrditvi, preostanek 4 tedne pred prihodom.",
      "info.cancelT": "Odpoved", "info.cancelD": "Brezplačno do 60 dni pred prihodom, nato se predplačilo zadrži. Če termin ponovno oddamo, ti pridemo naproti.",
      "info.taxT": "Turistična taksa", "info.taxD": "Pobere jo kamp na kraju samem – po ceniku za leto 2026: 1,50 € na odraslo osebo na dan, 0,75 € za mlade od 12 do 18 let.",

      "kontakt.eyebrow": "Kontakt", "kontakt.title": "Vprašanja? Piši nam",
      "kontakt.sub": "Naj gre za razpoložljivost, prihod ali psa – pošlji nam e-pošto ali pokliči. Običajno odgovorimo v 24 urah.",
      "kontakt.email": "E-pošta", "kontakt.phone": "Telefon", "kontakt.stay": "Nastanitev",
      "kontakt.address": "Kamp Dalmacija · Ivana Pavla II 40 · 23233 Privlaka, Hrvaška",
      "kontakt.cta": "Preveri razpoložljivost in pošlji povpraševanje", "kontakt.imgAlt": "Okras na jedilni mizi",

      "foot.contact": "Kontakt", "foot.note": "Zasebna oddaja · Vse informacije brez jamstva",
      "foot.imprint": "Impresum", "foot.privacy": "Varstvo podatkov",
      "legal.onlyGerman": "Ta stran je na voljo samo v nemščini.", "legal.back": "Na začetno stran",
      "poi.8n": "Avtobus Zadar – Vir",
      "poi.8v": "postajališče pred kampom",
      "info.campT": "Kamp",
      "info.campD": "Kamp Dalmacija je odprt vse leto. Picerija, sladoledarna, pivnica in plažni bar so odprti od 15. junija do 15. septembra. Najbližji supermarket – Tommy, z mesnico – je oddaljen približno 300 m (Ulica Ivana Pavla II 99). Recepcija: <a href=\"tel:+385992553190\">+385 99 255 3190</a> (nemščina), <a href=\"tel:+385992553195\">+385 99 255 3195</a> (hrvaščina/angleščina), <a href=\"mailto:info@dalmacija-camp.com\">info@dalmacija-camp.com</a>.",
      "info.tripsT": "Izleti",
      "info.tripsD": "Narodni parki Krka, Plitvička jezera, Kornati in Paklenica, kajtanje v Ninu, rafting na Zrmanji, pustolovski park pri Zadru – nasvete dobiš na recepciji.",
      "cal.priceNote": "cena na noč",
      "gal.cat.strand": "Plaža in okolica",
      "gal.strand-soline": "Sončni zahod na plaži Soline, Privlaka",
      "gal.strand-sabunike": "Peščena plaža Sabunike pri Privlaki",
      "gal.strand-abendrot": "Večerna zarja na peščeni plaži v Privlaki",

      "season.Hauptsaison": "glavna sezona", "season.Nebensaison": "nizka sezona",
      "season.Nachsaison": "posezona", "season.Vorsaison": "predsezona",
    },
  };

  // Mehrzahl-Regeln (Index in die [ … ]-Formen)
  const PLURAL = {
    de: n => (n === 1 ? 0 : 1),
    en: n => (n === 1 ? 0 : 1),
    hr: n => (n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 1 : 2),
    sl: n => (n % 100 === 1 ? 0 : n % 100 === 2 ? 1 : n % 100 === 3 || n % 100 === 4 ? 2 : 3),
  };

  const speicher = {
    get: () => { try { return localStorage.getItem("mh_lang"); } catch { return null; } },
    set: v => { try { localStorage.setItem("mh_lang", v); } catch {} },
  };

  // Reihenfolge: ?lang= in der Adresse → gespeicherte Wahl → Browsersprache → Englisch
  function erkennen() {
    try { const q = new URLSearchParams(location.search).get("lang"); if (q && T[q]) return q; } catch {}
    const s = speicher.get(); if (s && T[s]) return s;
    for (const l of navigator.languages || [navigator.language || ""]) {
      const k = String(l).toLowerCase().slice(0, 2);
      if (k === "de") return "de";
      if (k === "en") return "en";
      if (["hr", "bs", "sr", "sh"].includes(k)) return "hr";
      if (k === "sl") return "sl";
    }
    return "en";
  }

  let lang = erkennen();
  const hoerer = [];

  function t(key, vars) {
    let s = T[lang][key];
    if (s == null || s === "") s = lang === "de" ? s : T.de[key];
    if (s == null) return key;
    if (Array.isArray(s)) s = s[Math.min(PLURAL[lang](vars && vars.n), s.length - 1)];
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s;
  }
  const hat = key => !!T[lang][key];
  // Saisonnamen aus der Verwaltung übersetzen, sofern bekannt (sonst unverändert)
  const saison = name => (T[lang]["season." + name] ? T[lang]["season." + name] : name);

  function anwenden(root) {
    root = root || document;
    // Fehlt eine Übersetzung (t liefert dann den Schlüssel zurück), bleibt der vorhandene Text stehen
    root.querySelectorAll("[data-i18n]").forEach(el => { const v = t(el.dataset.i18n); if (v !== el.dataset.i18n) el.textContent = v; });
    root.querySelectorAll("[data-i18n-html]").forEach(el => { const v = t(el.dataset.i18nHtml); if (v !== el.dataset.i18nHtml) el.innerHTML = v; });
    root.querySelectorAll("[data-i18n-attr]").forEach(el => {
      el.dataset.i18nAttr.split(",").forEach(p => { const [a, k] = p.split(":").map(x => x.trim()); const v = t(k); if (v !== k) el.setAttribute(a, v); });
    });
    document.documentElement.lang = lang;
  }

  function setzen(l) {
    if (!T[l] || l === lang) return;
    lang = l;
    speicher.set(l);
    try { const u = new URL(location.href); u.searchParams.set("lang", l); history.replaceState(null, "", u); } catch {}
    anwenden();
    hoerer.forEach(f => f(l));
  }

  // Sprachumschalter (Knopf + Menü) in ein vorhandenes Element einbauen
  function umschalter(el) {
    const globe = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
    const chev = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    el.classList.add("lang");
    el.innerHTML =
      `<button type="button" class="lang-btn" aria-haspopup="true" aria-expanded="false">${globe}<span class="lang-cur"></span>${chev}</button>` +
      `<ul class="lang-menu" role="menu" hidden>` +
      Object.entries(SPRACHEN).map(([k, v]) =>
        `<li role="none"><button type="button" role="menuitemradio" data-lang="${k}" lang="${k}"><span class="lang-code">${v.kurz}</span>${v.name}</button></li>`).join("") +
      `</ul>`;
    const btn = el.querySelector(".lang-btn"), menu = el.querySelector(".lang-menu");
    const auf = open => { menu.hidden = !open; btn.setAttribute("aria-expanded", open); };
    const aktualisieren = () => {
      el.querySelector(".lang-cur").textContent = SPRACHEN[lang].kurz;
      btn.setAttribute("aria-label", t("nav.lang") + " – " + SPRACHEN[lang].name);
      menu.querySelectorAll("[data-lang]").forEach(b => b.setAttribute("aria-checked", b.dataset.lang === lang));
    };
    btn.addEventListener("click", e => { e.stopPropagation(); auf(menu.hidden); if (!menu.hidden) menu.querySelector('[aria-checked="true"]').focus(); });
    menu.addEventListener("click", e => { const b = e.target.closest("[data-lang]"); if (!b) return; auf(false); setzen(b.dataset.lang); btn.focus(); });
    menu.addEventListener("keydown", e => {
      const items = [...menu.querySelectorAll("[data-lang]")], i = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      if (e.key === "Escape") { auf(false); btn.focus(); }
    });
    document.addEventListener("click", e => { if (!el.contains(e.target)) auf(false); });
    hoerer.push(aktualisieren);
    aktualisieren();
  }

  window.I18N = {
    get lang() { return lang; },
    get locale() { return SPRACHEN[lang].locale; },
    SPRACHEN, t, hat, saison, anwenden, setzen, umschalter,
    beiWechsel: f => hoerer.push(f),
  };
})();
