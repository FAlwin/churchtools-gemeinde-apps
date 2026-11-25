### Behoben (Protokolle)

- **Reiter „Termine“ (und Start, To-Dos, Suche) fragt ChurchTools weniger:** Gruppen, die denselben Kalender nutzen, lasen beim Laden
  dieselben Termine, Besprechungsanfragen, Kategorien und Protokolle je Gruppe noch einmal – live am 25.11.2026 im Reiter „Termine“
  95 Abrufe, 52 davon doppelt (bis zu 5× dieselbe Adresse). Jetzt fragt ein Ladevorgang jede Adresse nur einmal. Wer die Erweiterung
  direkt auf „Termine“ öffnet, bekommt die To-Dos für den Hinweis auf fällige To-Dos aus derselben Übersicht statt aus einem eigenen Abruf.

### Intern (Protokolle)

- `einmalLesen()` in `protokolle/src/lesen.ts`: ein Leser je Ladevorgang auf Basis von `merkeVersprechen` (kein neuer Speicher);
  `ladeUebersicht` reicht ihn über alle Gruppen an `ladeSitzungen`, `andereImKalender`, `termineMitAnfrage`, `treffenLesen`,
  `anfragenLesen` und `terminLaden` (`Leser`, Vorgabe weiter `ctDaten`). Bewusst nicht seitenweit: Nach „Eintragen“ oder „Erneut
  versuchen“ wird frisch gelesen. Der Nachbau zählt jetzt auch volle Adressen mit Abfrage (`adressen`); `lesenEinmal.test.ts` prüft
  „keine Adresse doppelt“ (im Nachbau mit drei Gruppen im selben Kalender vorher 30 Abrufe auf 15 Adressen, jetzt 15).
- Bleibt bewusst: Die Gruppentreffen einer Gruppe werden für die eigene Liste ab heute und für den Abgleich „anderer Gruppen im
  selben Kalender“ ab gestern gelesen – zwei verschiedene Adressen.
