### Intern

- **Anmeldungen: Reiter „Formular | Bedingungen“ im Baukasten** (Etappe F, Scheibe F1d; noch nicht freigegeben,
  veröffentlicht wird erst nach Etappe F). Nach dem abgenommenen Entwurf `f1-bedingungen-nachweise-v1`, Ansicht 1;
  die Reiter stehen über dem Formular (Alwin, 12.11.2026), nicht darin.
  - Der Reiter „Bedingungen“ zeigt alle Regeln als „Wenn … dann zeige …“; gleiche Bedingungen sind zu einer Regel
    zusammengefasst (`regelGruppen`), Antwort-Regeln als „„Leitung“ nur wählbar in …“. Kaputte Regeln stehen rot.
  - „Neue Regel“ mit mehreren Zielen per Häkchen; „Bearbeiten“ ändert die Regel für alle Ziele zugleich, ein
    abgewähltes Ziel verliert sie, „Regel entfernen“ nimmt sie von allen. Als Ziele gehen nur Felder nach allen
    Quellen (`zielKandidaten`), als Quellen nur Fragen vor allen Zielen (`gemeinsameQuellen`) – keine Kreise. Hat ein
    Feld schon eine andere Bedingung, sagt das Fenster vorher, dass sie ersetzt wird.
  - Gespeichert wird weiter je Feld und Antwort, in EINEM Schreiben für alle Ziele (`regelSpeichern` →
    `regelSetzen`), also mit EINEM „Rückgängig“; geprüft am frisch gelesenen Stand (422, wenn sie nicht stimmt).
  - Der gewählte Reiter bleibt je Veranstaltung stehen, auch wenn „Rückgängig“ die Seite neu aufbaut
    (`baukastenBlick.ts`).
  - Das Fenster an einer Frage oder Antwort sagt jetzt, wenn andere Felder dieselbe Bedingung haben („Hier änderst du
    sie nur für diese Frage …“).
  - Zusammengelegt statt kopiert: Der Block „Bedingung“ und „Sonst ausgrauen/ausblenden“ sind dieselben in beiden
    Fenstern (`BedingungBlock`, `DarstellungWahl`), was ein Fenster speichert regelt `bedingungAufbereiten`, „immer
    dabei“ (Name, E-Mail, Datenschutz, Preis) steht an einer Stelle (`kannBedingungTragen` und `kaputteStellen`).
