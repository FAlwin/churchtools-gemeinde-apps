### Neu (Protokolle, S5-3)

- **Anwesenheit** als fester Punkt im Protokoll (Entwürfe `s5-3-anwesenheit-v1/-v2`, Alwin 05.11.2026): je Mitglied
  **Anwesend / Abwesend**, nochmal tippen = wieder offen. Jeder Tipp steht sofort im **ChurchTools-Gruppentreffen** –
  dort hat ChurchTools auch die Übersicht über alle Sitzungen.
- **Von selbst vorbelegt:** Wer zugesagt hat, ist anwesend, wer abgesagt hat, abwesend – solange am Treffen noch
  niemand etwas eingetragen hat. Danach tippt man nur noch die Abweichungen (kurzfristig krank …).
- **Gäste** als freie Namen – sie stehen nur im Protokoll, nicht in der Gruppe.
- **Einklappbar:** Zugeklappt (beim Lesen von selbst) steht „Anwesend (n): … · Abwesend: … · Offen: … · Gäste: …“.
- Ohne Gruppentreffen steht im Kasten **„Gruppentreffen anlegen“** (ohne Mail); danach geht die Anwesenheit gleich.
- Über „Einfügen ▾ → Anwesenheit“ und das „/“-Menü; die **Standard-Vorlage „Leitungssitzung“** beginnt mit
  „1. Anwesenheit“ (eingerichtete Vorlagen bleiben, wie sie sind).
- **„Gruppe einrichten“** gibt der Leitung „Gruppentreffen pflegen“ und „… durchführen“ – nur entzogen, wenn die
  Verwaltung sie selbst gesetzt hat.

### Behoben (Protokolle, S5-3)

- Ein fester Punkt, den diese Fassung nicht kennt, erschien als „Offene To-Dos“; bei der Freigabe hätte jeder Punkt
  außer „Letztes Protokoll“ den Stand der To-Dos festgehalten bekommen – jetzt je Art ausdrücklich.

### Intern (S5-3)

- Gemessen 05.11.2026 (`messung-s5-3-2026-11-05.md`): „Gruppentreffen pflegen“ = 10124, „durchführen“ = 10111;
  zurück auf offen = `DELETE …/members/{person}` mit `{status: 'unsure'}` (aus der ChurchTools-Oberfläche).
- Regel `shared/protokolle/anwesenheit.ts`, Schreiben `protokolle/src/anwesenheitSchreiben.ts` (Teilnehmerliste
  seitenweise; Vorbelegen schreibt alle und liest einmal nach), Kasten `Anwesenheit.tsx` (gemeinsamer Umschalter
  `Segment`), `treffenVerknuepfen` in `schreiben.ts`.
- Eine Liste der festen Punkte: `VERWEIS_ARTEN` / `istVerweisArt` in `dokument.ts` (vorher zwei `VerweisArt`-Typen
  und Einzelvergleiche in Vorlage und Formular).
- Der ChurchTools-Nachbau der Tests kennt Anwesenheit (seitenweise Teilnehmer) und läuft auch in jsdom.
