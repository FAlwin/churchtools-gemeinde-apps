### Geändert (Dienstplaner)

- **Planen mit gewähltem Zeitraum:** Scheitert das Nachladen bei ＋ oder nach dem Senden, bleibt die Matrix stehen –
  darüber steht der Fehler mit „Erneut versuchen“, wie schon bei „ab heute“ (Alwin, 06.11.2026). Vorher ersetzte der
  Fehler die ganze Matrix. „Erneut versuchen“ lädt leise, ohne „Termine werden geladen …“.

### Intern

- **`useLaden` im Dienstplaner, Teil 2** (#845, Scheibe 3e-2): der Zeitraum in „Planen“ und die Nachfrage zu Terminen
  außerhalb des Zeitraums (alte Entwürfe) laden über den gemeinsamen Hook. Damit gibt es in keiner Erweiterung mehr
  einen Ladeblock von Hand; der Wächter gilt jetzt auch für den Dienstplaner. Neu im Hook: Mit `behalten` steht ein
  gescheitertes Neuladen als `neuFehler` neben den behaltenen Daten, und `behalten` darf eine Prüfung auf die alten Daten
  sein (nur passende bleiben stehen).
- Neue Tests: ＋ scheitert → Matrix bleibt, Fehler darüber, „Erneut versuchen“ lädt leise; Termine, die in zwei Runden
  bekannt werden, bleiben bekannt (kein Hin und Her beim Nachfragen).
