### Neu (Anmeldungen, U2-4 – Zeilen anheften)

- **Stecknadel am Zeilenanfang** im Bereich „Anmeldungen“ (je Anmeldung und je Person): heftet eine Zeile oben an. Sie
  bleibt beim Sortieren oben (darunter gilt die Sortierung weiter) und steht nur in den Reitern, in die sie ohnehin
  gehört. Gemerkt nur auf diesem Gerät, je Veranstaltung; was es nicht mehr gibt, fällt beim nächsten Anheften aus dem
  Speicher. Mit Maus erscheint die Nadel beim Darüberfahren, am Handy steht sie immer da; die Nadel-Spalte bleibt links
  stehen, auch am Handy. Bei „Abgesagt“ gibt es keine Nadel.

### Intern (U2-4)

- **Ein Gerätespeicher für die Erweiterungen:** Das Organigramm hatte eine eigene Kopie von „Im Gerät merken“ – es nutzt
  jetzt wie Dienstplaner und Protokolle `ui/bedienung/geraet.ts`, die Anmeldungen ebenso. Test des Bausteins selbst in
  `ui/bedienung/geraet.test.ts`. Die Musik-App behält `lokalSpeicher.ts` (meldet zusätzlich einen vollen Speicher).
- `personSchluessel` (`tabelle.ts`): ein Schlüssel je Personenzeile für Zeile und Nadel.
