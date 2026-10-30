### Neu (Anmeldungen, U2-3 – Spalten wählen)

- **Fenster „Spalten“** im Bereich „Anmeldungen“, je Ansicht (je Anmeldung, je Person): Häkchen zeigt eine Spalte,
  Pfeile ordnen, die **Stecknadel** heftet sie links an – mehrere möglich, in der Reihenfolge des Anheftens; am Handy
  bleibt nur die erste stehen. „Wie zu Beginn“ holt die Vorgabe zurück. Je Person stehen auch die Fragen der Anmeldung
  zur Wahl; ihre Summe zählt jede Anmeldung einmal.
- Die Wahl gilt **fürs ganze Team**: neues, freiwilliges Feld `tabelle` in den Einstellungen der Veranstaltung, wie die
  Druckliste (`druck`) – nur, was von der Vorgabe abweicht, und nur von dem, der die Veranstaltung bearbeiten darf.
  Gelöschte Fragen fallen weg (`nurVorhandene`, dieselbe Bereinigung wie die Druckliste), neue stehen hinten. Die Kopie
  einer Veranstaltung übernimmt die Wahl.
- Ohne Wahl angeheftet: der Name, je Person Vor- und Nachname (Entwurf). Der Warteplatz steht im Reiter Warteliste
  gleich hinter den angehefteten Spalten.

### Intern (U2-3)

- `ZeilenKnopf` kann an und aus sein (`an` → `aria-pressed`, blau); neue Symbole `nadel` und `chev-up`.
- Die Spalten der Tabelle kommen aus `spaltenKatalog`/`gezeigteSpalten` (`tabelle.ts`) statt aus festen Listen;
  Geburtsdatum sortiert nach dem Datum.
