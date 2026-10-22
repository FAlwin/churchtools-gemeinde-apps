# CHANGELOG-Einträge – eine Datei je PR

**Neue Einträge kommen hierher, nicht direkt in `CHANGELOG.md`** (seit 22.10.2026). So stört kein PR den
anderen: Vorher schrieb jeder ganz oben unter `[Unreleased]`, und jeder fremde Merge machte den eigenen PR
konflikthaft.

- **Eine Datei je PR**, benannt nach dem Zweig ohne Präfix: `feat/editor-l3` → `changelog.d/editor-l3.md`.
- **Inhalt wie bisher im CHANGELOG:** eine oder mehrere Überschriften `### Neu (…)` / `### Geändert (…)` /
  `### Behoben (…)` / `### Intern (…)`, darunter die Punkte. Keine `#`- oder `##`-Überschriften – die Version setzt
  der Release.
- **Beim Release** führt `npm run changelog -- --version X.Y.Z` alle Dateien unter `## [X.Y.Z] – Datum` in
  `CHANGELOG.md` zusammen (neueste zuerst) und löscht sie. Vorschau ohne Schreiben: `npm run changelog`; nur
  prüfen: `npm run changelog -- --pruefen`.
