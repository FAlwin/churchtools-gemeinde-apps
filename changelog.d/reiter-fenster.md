### Intern

- **Anmeldungen: die Fenster des Reiters als Hook** (#845, Schritt 4, Scheibe 4c-3): `useFenster` führt, welches Fenster
  offen ist – die Anmeldung (mit Rückfrage und der letzten Änderung samt „Rückgängig“), „Von Hand“, Zurückholen,
  Rundmail und Druckliste – und welche Anmeldung im Fenster steht, auch wenn sie nach einer Absage aus der Liste fiel.
  Unverändert übernommen; `AnmeldungenReiter.tsx` hat statt 710 noch 673 Zeilen (vor Schritt 4: 1.193) → fertig
  aufgeteilt. Neue Tests (`useFenster.test.ts`): Zurück aus „Person dazu“, Fenster bleibt nur mit „Rückgängig“,
  „fertig“ ohne alte Rückfrage, Rundmail erst mit Liste und genau einmal.
