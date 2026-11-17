### Behoben (alle Apps)

- **Bestätigungsfenster schließen mit der Esc-Taste.** Die kleinen Fenster mit „Abbrechen“ (z. B. „Bitte prüfen“ im
  Dienstplaner, Löschen-Rückfragen in Musik-App, Gebetsabend und Protokollen) ließen sich bisher nur per Klick
  schließen. Esc wirkt jetzt wie „Abbrechen“ – nicht, solange gerade gespeichert wird, und nicht bei reinen Meldungen
  ohne Abbrechen.

### Intern (alle Apps)

- Ein gemeinsamer Baustein `ui/bedienung/useEscape.ts` statt vier Kopien (`OptionWaehlen`, `useAufklapp`,
  `AkkordLeiste`, Protokoll-Editor). Akkordleiste und Protokoll-Editor haben dafür erstmals einen Test.
