### Geändert (Anmeldungen)

- **Baukasten: Der Hinweis „Nicht gespeichert“ bleibt nicht mehr stehen.** Wer ein Feld ohne Frage verlässt, sieht
  jetzt, welches Feld es war: „„Gruppe“ nicht gespeichert: Bitte eine Frage eintragen.“ Der Hinweis verschwindet,
  sobald danach etwas anderes gespeichert wird (Design, ein anderes Feld, ein Feld entfernt) oder wenn das Feld selbst
  entfernt wird. Bisher blieb er stehen, bis wieder in ein Feld getippt wurde. Solange das Feld noch gewählt ist,
  bleibt der Hinweis wie bisher.

### Intern

- **„TT.MM.“ an einer Stelle:** `tagMonat` in `shared/ct/datum.ts`. Bisher wurde das Format an acht Stellen von Hand
  gebaut (Zeitraum, Anmeldungen, „zuletzt gespeichert“, Dateiname des Plan-Blatts, Offline-Stand, Abwesenheiten,
  `tagKurz`). Der Dateiname des Termin-Blatts nutzt jetzt `tagPunkt` statt eines eigenen „TT.MM.JJJJ“. Die Ausgaben
  bleiben gleich. Restpunkt aus #845.
