### Neu (Protokolle)

- **To-Dos vorschlagen (W9b):** Mitglieder (wer in der Gruppe keine Protokolle schreibt) können der Gruppe ein To-Do
  **vorschlagen**; die Leitung übernimmt oder lehnt ab.
  - **„Neues To-Do“ als Mitglied:** oben die Wahl **„Für mich | Vorschlag an die Gruppe“**. Ein Vorschlag hat Text, „Bis“,
    „Warum? (optional)“ und die Gruppe – wer es macht, legt die Leitung beim Übernehmen fest. Die Leitung sieht die Wahl
    nicht; sie legt wie bisher an.
  - **Bereich „Vorgeschlagen“** im Reiter To-Dos, über der Liste und über dem Board, einklappbar (das Gerät merkt es). Die
    Leitung sieht alle offenen Vorschläge ihrer Gruppen („N warten auf dich“), ein Mitglied nur die eigenen („wartet auf die
    Leitung“). Abgelehnte stehen sieben Tage mit der Begründung da und lassen sich mit „×“ ausblenden – dieselben Regeln und
    dieselbe Zeile wie bei den Vorschlägen für Tagesordnungspunkte. Gibt es nichts zu zeigen, fehlt der Bereich.
  - **Wer vorschlug:** „Ändern“ und „Zurückziehen“, solange der Vorschlag offen ist (zurückgezogen wird nur vermerkt, nie
    gelöscht). **Die Leitung:** „Übernehmen …“ öffnet das Fenster **„Vorschlag übernehmen“** – vorausgefüllt, dort wählt sie
    die Zuständigen; aus demselben Eintrag wird ein gewöhnliches To-Do (Notiz und Verlauf bleiben). „Ablehnen …“ fragt nach
    einer Begründung, die der Vorschlagende sieben Tage lang sieht.
  - **Ein Vorschlag ist kein To-Do:** Er steht in keiner Liste, keinem Board, keiner Zahl (Startseite, Hinweis am Reiter,
    „Das mache ich“), keiner Suche, keinem PDF und keinem Protokoll – erst das Übernehmen macht ihn dazu. Das wird beim
    **Lesen an einer Stelle** getrennt (`aufgabenAusRoh`, `istToDoVorschlag`), nicht in jeder Ansicht einzeln. Die normalen
    To-Do-Wege (Haken, Status, Notiz, Löschen, „Das mache ich“) lehnen einen Vorschlag mit einem verständlichen Satz ab; die
    Rechte stehen in `toDoRechte` (Fall „Vorschlag“) und `vorschlagVerboten` und gelten auch beim Speichern.
  - Alte Einträge bleiben unverändert gültig (das Kennzeichen `vorschlag` ist neu und optional).
