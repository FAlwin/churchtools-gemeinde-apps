### Geändert (Musik-App, Lied-Editor L6)

- **„Einfügen“ statt „Format“** im Lied-Editor: Ein Menü mit den Teilen (Vers, Refrain, Pre-Chorus, Bridge, Intro,
  Zwischenspiel, Outro, Ende), dem **Pedal-Halt** und – abgesetzt – „Nur für andere Programme“ (Kapo, neue Spalte,
  neue Seite, Untertitel; mit dem Hinweis, dass sie in der App nichts bewirken). Ein neuer Teil kommt als Band
  **unter** die Zeile, in der der Cursor steht, mit einer leeren Zeile zum Lostippen; „Vers“ nummeriert sich selbst
  („Vers 2“), die übrigen nur, wenn es den Namen schon gibt. Titel, Interpret, Tonart, Tempo, Takt, CCLI und Copyright
  stehen im Abschnitt **Liedinfo**: Ein Tipp öffnet die Liedinfo bei genau diesem Feld (die Werte stehen in
  ChurchTools); wo es keine Liedinfo gibt, kommt die Angabe wie früher in den Text. Teile mit **eigenem Namen**
  (z. B. Tag, Instrumental) über „Eigener Name …“.
- **Ruhigerer Text:** Die Zeile `{key: …}` und die Ende-Marken `{end_of_verse}` & Co. sind im Editor ausgeblendet –
  die Tonart nennen Kopf und Akkord-Leiste, das Band markiert den Anfang jedes Teils. Im „ChordPro-Text“ sind beide
  zu sehen, gespeichert bleiben sie unverändert.

### Behoben (Musik-App, Lied-Editor L6)

- **Kapo und Untertitel einfügen:** Der Cursor stand hinter der Klammer statt davor – aus einer eingetippten „2“
  wurde `{capo: }2`. Schon im alten Format-Menü so; gefunden beim Prüfen in der Test-Instanz.
