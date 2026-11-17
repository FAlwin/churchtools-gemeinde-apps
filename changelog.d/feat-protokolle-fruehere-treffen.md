### Neu (Protokolle)

- **Frühere Treffen: ein Protokoll zu einem Treffen nachtragen, das schon vorbei ist.** Bisher zeigte „Kommend“ Termine
  und Gruppentreffen ohne Protokoll nur ab heute – zu einem vergangenen Treffen (z. B. dem Techniker Treffen vom
  15.11.) ließ sich kein Protokoll beginnen. Jetzt, nur für die Leitung der Gruppe:
  - **„Noch ohne Protokoll“** steht im Reiter „Sitzungen“ über „Kommend“: zurückliegende Sitzungen ohne Protokoll seit dem
    letzten freigegebenen Protokoll der Gruppe (gibt es keins: die letzten 28 Tage), bis gestern – heute steht schon in
    „Kommend“. Je Zeile **„Protokoll beginnen“**. Ist nichts offen, fehlt der Block; scheitert das Laden, steht im Block
    ein Hinweis mit „Erneut versuchen“ und der Rest der Seite bleibt.
  - **„Protokoll nachtragen“** (neben „Neues Protokoll“ und „Neue Sitzung“): Fenster, das **Monat für Monat** (‹ ›) alle
    Treffen und Termine ohne Protokoll zeigt, beliebig weit zurück, vorwärts nicht über den laufenden Monat hinaus. Gelesen
    wird nur der gezeigte Monat. Eine Zeile antippen führt im selben Fenster zu „Protokoll beginnen“ (Vorlage /
    „Wie letztes Mal“ / leer; „‹“ zurück zur Auswahl). Das Protokoll ist danach mit genau diesem Termin und Gruppentreffen
    verknüpft, die Anwesenheit wird aus den Zusagen und Absagen vorbelegt. Ist das Gruppentreffen schon abgeschlossen, sagt
    die Zeile, dass die Anwesenheit in ChurchTools feststeht.
  - Mitglieder sehen weder den Block noch den Knopf.

### Behoben (Protokolle)

- **Anwesenheit bei einem Protokoll zu einem vergangenen Termin.** Die Antworten auf die Einladung wurden nur für Termine ab
  heute gelesen (und für solche hinter den 180 Tagen). Ein begonnenes Protokoll zu einem Termin davor kam deshalb ohne
  Zusagen und Absagen an – die Anwesenheit hätte sich nicht aus den Antworten vorbelegt. Jetzt werden Termine mit
  Protokoll-Entwurf auch vor dem Lesefenster gezielt nachgelesen.

### Intern

- `shared/protokolle/fruehere.ts`: die Regeln von „Frühere Treffen“ an einer Stelle (Zeitraum des Blocks, Zeitraum eines
  Monats, „ohne Protokoll“). Die Zusammenführung von Terminen, Treffen und Köpfen ist als `sitzungenZusammenfuehren`
  herausgelöst (`sitzungenOrdnen` nutzt sie, nichts nachgebaut); `treffenLesen` nimmt `isCompleted` mit
  (`abgeschlossen`). Lesen: `sitzungenOhneProtokoll` in `protokolle/src/lesen.ts`.
