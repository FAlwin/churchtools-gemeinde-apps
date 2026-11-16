### Intern

- **Anmeldungen: freie Antwort – Regel-Teil** (Etappe F, Scheibe F3a; noch ohne Oberfläche, veröffentlicht wird erst
  nach Etappe F). Nach Klick-Runde 9 und dem abgenommenen Entwurf `f3-freie-antwort-v1`:
  - Auswahlfragen (Eine Antwort, Auswahlliste, Mehrere Antworten, Ja / Nein) können eine **freie Antwort** haben – die
    letzte, mit eigener Beschriftung und Textfeld „klappt auf“, „steht immer da“ oder ohne (`Feld.frei`,
    `shared/anmeldung/freieAntwort.ts`).
  - In ChurchTools ist sie eine normale Antwort der Auswahl (`wahlAntworten` – die EINE Liste für Optionen und
    Bedingungen); der Text steht in einer zweiten Spalte „Frage (Beschriftung)“ (`ctZusatzSpalten`).
  - Pflicht: Ist die Frage Pflicht und gibt es ein Textfeld, muss der Text da sein, sobald die freie Antwort gewählt
    ist. Abgewählt oder ausgeblendet geht der Text nicht mit (`leeren`).
  - In der Erweiterung steht nur der Text, wie eine eigene Antwort („FeG Siegburg“) – Tabelle, Summenzeile,
    Druckliste, „Anmeldung ansehen“ (`antwortText`); ohne Text die Beschriftung. Für die Regeln liest `antwortRoh`
    die Beschriftung (Rückweg, Nachprüfung, „Person dazu“).
