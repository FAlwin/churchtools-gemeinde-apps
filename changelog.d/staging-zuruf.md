### Intern (gemeinsam)

- **Staging nur noch auf Zuruf:** Die Test-Instanz baut von selbst nur `main`; ein Zweig kommt mit
  `gh workflow run staging.yml --ref <zweig>` drauf. Die Version nennt den Zweig (`staging-feat-…-<sha>`).
  Vorher überschrieb jeder Push jeder Sitzung die eine Test-Instanz (Alwin: „da haben sich wieder andere
  vorgedrängelt“).
- **CHANGELOG-Einträge als Dateien je PR** in `changelog.d/`; der Release führt sie mit
  `npm run changelog -- --version X.Y.Z` zusammen. Damit gibt es beim Mergen keine CHANGELOG-Konflikte mehr
  zwischen gleichzeitigen PRs. Die CI prüft das Format (`npm run changelog -- --pruefen`).
