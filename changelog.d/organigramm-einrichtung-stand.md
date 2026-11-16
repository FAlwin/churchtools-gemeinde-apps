### Neu (Organigramm)

- **Organigramm: Unterreiter „Einrichtung“ im Reiter „Kinder & Jugend“** (Bauplan O9-5c-1, nur mit „Berechtigungen
  verwalten“). Die Seite zeigt die Stufen, wie sie eingerichtet sind (Kette mit „ab N Jahren“, Bereichsgruppe,
  Ferienkalender, Stichtag, Ankündigung), und **was in ChurchTools davon wirklich steht**: Gruppentyp, Rechte der Leitung
  am Typ, Wechsel-Gruppen, Wechseltage in den Regeln, Regeln der Gruppen (auch fremde) und Aufräum-Routinen. Jede Zeile
  ist „in Ordnung“, „stimmt nicht“ (mit Grund) oder „nicht prüfbar“; ein gelber Hinweis oben zählt, was nicht stimmt.
  Die Seite liest nur – Knöpfe zum Ändern und Reparieren kommen später.
  - **Der Reiter „Kinder & Jugend“ erscheint für „Berechtigungen verwalten“ auch ohne Einrichtung** und sagt, welcher Fall
    es ist: „Gruppenwechsel noch nicht eingerichtet“, „Die gespeicherte Einrichtung ließ sich nicht lesen. Es wird nichts
    überschrieben.“ oder „Die Einrichtung ließ sich gerade nicht lesen“ mit „Erneut versuchen“. Diese Fälle werden nie
    verwechselt – vorübergehend ist nicht „nicht eingerichtet“. Alle anderen sehen den Reiter wie bisher erst nach dem
    Einrichten. Wer „Berechtigungen verwalten“ hat, sieht den eingerichteten Reiter jetzt auch ohne Kindergruppe.

### Intern (Organigramm)

- **Organigramm:** `shared/organigramm/einrichtungStand.ts` – der Soll/Ist-Abgleich als reine Funktion; das Soll kommt aus
  den Erzeugern (`alleRegeln`, `aufraeumRoutine`, `LEITER_RECHTE`), die Wechseltage aus `jahrStaende` (keine zweite
  Rechnung). `ladeEinrichtungStand` liest gedrosselt (vier Gruppen zugleich) und wirft nie: 401/403/Netz/5xx und unbekannte
  Antworten sind „nicht gelesen“, nur 404 beim Regel-Abruf heißt „keine Regeln“. `remove-member` mit `actionData: null`
  (so liefert es ChurchTools) gilt wie `{}` (Messung 16.11.2026).
- **Organigramm:** `dokumentGenau` in `speicher.ts` unterscheidet „kein Wert“ von „Wert nicht lesbar“ (auch andere Fassung
  oder kein JSON in der Kategorie); `dokumentAusKategorie` (Plan, Sichtbarkeit) verhält sich unverändert. `ladeEinrichtung`
  liefert `da | keine | unlesbar | fehler`.
- **Organigramm (Demo):** `?demo` zeigt den Gruppenwechsel „eingerichtet“ (Kinder & Jugend, drei Stufen) mit lauter
  „in Ordnung“.
