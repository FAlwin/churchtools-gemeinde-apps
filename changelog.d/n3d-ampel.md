### Neu (Anmeldungen)

- **Nachweise: Ampel für die Leitung** (N3d). Im Reiter „Anmeldungen“ gibt es je eingeschalteter Nachweis-Art eine Spalte: grün „gültig bis MM/JJJJ“, blau „läuft vor Ende ab“ (der Nachweis endet vor dem letzten Tag der Veranstaltung), rot „fehlt“ oder „abgelaufen“, grau „noch nicht angefordert“, leise „nicht nötig“. Die Leitung sieht nie das Ergebnis der Einsicht. Die Spalte lässt sich wie jede andere ein- und ausblenden, anheften, sortieren und filtern, auch in eigenen Ansichten.
- Fehlt das Recht, den Stand zu lesen, oder scheitert das Lesen, steht dort **„Stand nicht lesbar“** statt „fehlt“ – bei einem vorübergehenden Fehler mit „Nochmal“.
- **„Braucht deine Aufmerksamkeit“:** Ab sechs Wochen vor Beginn zeigt die Startseite der Leitung je Veranstaltung „n Personen ohne gültigen Nachweis“. Keine Mail.

### Intern (Anmeldungen)

- Die Ampel ist eine reine Regel (`nachweisAmpel.ts`); Stand und Namen der Arten werden in einer Lesung aus der Ablage geholt; `letzterTagVon` und `zaehltFuerNachweis` sind jeweils die eine Stelle für Phase/Löschdatum/Ampel bzw. Eintragen/Ampel.
