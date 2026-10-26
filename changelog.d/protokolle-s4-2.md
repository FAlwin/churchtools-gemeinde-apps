### Neu (Protokolle, S4-2)

- **Aufgaben im Protokoll sind To-Dos** (Alwin 24.10.2026): Eine Aufgabe mit Text wird beim Speichern sofort zum
  To-Do in „Mitarbeit“ – die Zuständigen sehen sie gleich unter „Meine offenen To-Dos“, auch solange das Protokoll
  Entwurf ist. **Das Protokoll führt:** Text ändern zieht ins To-Do mit; Aufgabe löschen vermerkt das To-Do als
  gelöscht (nie hart, mit Verlauf), „Rückgängig“ holt es mit Wer/Bis/Status zurück.
- An der Aufgabe wie in Entwurf 7: **Status-Kreis** vorne (offen → in Arbeit → erledigt), Schildchen **„Wer?“** (Häkchen
  je Gruppenmitglied + externer Name, z. B. „Hausmeister Müller“) und **„Bis“** (Datum, überfällig rot). Geändert wird
  direkt das To-Do, nicht das Protokoll.
- **Beschluss** und **Termin** (mit Datum-Schildchen, nur im Protokoll) als eigene Blöcke; Aufgabe, Beschluss und
  Termin haben Knöpfe in der Werkzeugleiste und Einträge im „/“-Menü. **„[] “ + Leertaste macht eine Aufgabe** (die
  einfache Checkliste gibt es weiter über Textart und „/“-Menü).

### Intern (Protokolle, S4-2)

- Regeln `aufgabenAbgleich`, `aufgabenIdsVergeben`, `alsWiederhergestellt` in `shared/protokolle/aufgaben.ts`;
  `protokolle/src/aufgabenSchreiben.ts` (frisch lesen, auf diesem Stand planen, schreiben, nachlesen) – auch
  `ladeAufgaben` liest jetzt darüber. Der Abgleich läuft beim Speichern **nach** der Sperr-Prüfung und **vor** dem
  ersten Schreiben am Protokoll: ein Fenster ohne Sperre fasst die To-Dos nie an.
- Aufgaben-IDs werden außerhalb des Rückgängig-Verlaufs vergeben (sonst nahm „Rückgängig“ die ID weg und das To-Do
  wäre als gelöscht vermerkt worden – beim Durchklicken gefunden, Test gegen den echten Editor).
- `ladeGruppenMitglieder` (nur aktive Mitglieder; `mitgliederAus` liefert die Angefragten mit – Test).
- Neue Symbole `kreis`, `kreis-halb`, `kreis-haken`, `aufgabe`, `stempel`; Baustein `StatusKreis`.
