### Geändert (alle Apps)

- **Die Release-Seite auf GitHub zeigt nur noch die Änderungen der App, die veröffentlicht wird** (Alwin, 30.10.2026:
  „wenn ich einen Release einer App mache, sollen auch nur die Features dieser einen App oder Erweiterung da
  erscheinen“). Vorher hing beim Musik-App-Release eine Liste aller Pull Requests seit dem letzten Tag dran – auch die
  von Protokollen, Organigramm, Dienstplaner und Anmeldungen. Jetzt stehen dort unter „Was sich geändert hat seit …“
  die Punkte Neu, Geändert und Behoben aus dem CHANGELOG, die diese App nennen oder alle Apps betreffen. Die
  Erweiterungen bekommen dieselbe Liste; vorher hatten sie gar keine.

### Intern (Release-Beschreibung)

- `scripts/release-notizen.mjs`: Abschnitte aus `CHANGELOG.md` und `changelog.d/` beim Tag minus denselben beim vorigen
  stabilen Tag derselben App (gleiches Präfix, ohne `-rc`), verglichen am Text – so gilt ein Eintrag, den ein
  Musik-App-Release aus `changelog.d/` ins CHANGELOG schiebt, beim nächsten Erweiterungs-Release nicht wieder als neu.
  `release.yml`, `erweiterung-release.yml` und `anmeldungen-release.yml` rufen es auf (`fetch-depth: 0`),
  `generate_release_notes` ist aus.
- `npm run changelog -- --pruefen` verlangt in jeder gezeigten Überschrift (Neu/Geändert/Behoben/Entfernt/Sicherheit)
  die App in der Klammer – sonst landete der Eintrag in keiner Release-Beschreibung.
