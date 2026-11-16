### Neu (Organigramm)

- **Organigramm: Reiter „Kinder & Jugend“ – Gruppenwechsel der Kinder ansehen** (Bauplan O9-2; nur lesen, Ausnahmen
  setzen kommt mit O9-3).
  - **Wer ihn sieht:** Leitungen der Kindergruppen („Meine Gruppe“), die Bereichsleitung Kinder & Jugend und Admins
    („Übersicht“ mit einer Kachel je Gruppe). Ohne Einrichtung im Speicher der Erweiterung (Kategorie
    „Gruppenwechsel“) gibt es den Reiter nicht.
  - **Je Gruppe:** Ankündigung, Wechseltag und Stichtag; wer wechselt, wer bleibt (auch „bleibt noch ein Jahr“ als
    Ausnahme), wer neu dazukommt. Leitungen sehen neue Kinder erst ab der Ankündigung, die Bereichsleitung schon
    vorher als Vorschau.
  - **Daten pflegen:** Kinder ohne Geburtstag (die wechseln nie von selbst) und, für die Bereichsleitung, wer bis zum
    Stichtag 18 wird.
  - Die **Wechseltage** kommen aus dem Ferienkalender („Schulferien NRW“). Wer ihn nicht sehen darf, bekommt einen
    Hinweis statt leerer Listen – der Kalender muss den Kinder-Leitungen freigegeben sein.

### Intern (Organigramm, Gebetsabend)

- **Organigramm:** `shared/organigramm/gruppenwechselEinrichtung.ts` (Format der Einrichtung, streng geprüft) und
  `gruppenwechselSicht.ts` (wer sieht was, welches Wechseljahr, je Stufe wechseln/bleiben/neu). Personen, die sich
  nicht lesen lassen, gelten als „unbekannt“, nicht als „ohne Geburtstag“; ein vorübergehender Fehler zeigt „Erneut
  versuchen“ statt falscher Listen.
- **Geteilt:** Das Laden je Gruppe (abgemeldet / kein Recht / vorübergehend) steht jetzt einmal in `jeGruppeLaden`
  (Organigramm-Mitglieder und Reiter „Kinder & Jugend“). Die Termin-Abfrage eines Kalenders liegt in
  `shared/ct/kalenderTermine.ts` (vorher im Gebetsabend).
