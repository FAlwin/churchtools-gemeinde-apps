### Geändert (Dienstplaner)

- **Der Ablauf in der Termin-Ansicht ist jetzt wie in der Musik-App.** Ein Tipp auf einen Punkt zeigt alles dazu (Position, Davor/Danach –
  das gab es seit der Einzelansicht schon); neu ist der **Kopf in Stufen**: beim Ansehen **Live**, **Musik-App**, **⋯** und **Bearbeiten**;
  im Bearbeiten das grüne **Eintrag hinzufügen** (am Handy der grüne Kreis), **⋯** und das blaue **Fertig**.
- **Gewohnheit: Der Stift an jeder Zeile entfällt.** Im Bearbeiten die **Zeile antippen** – das Fenster „Punkt bearbeiten“ geht auf wie bisher.
  Auch die Matrix in „Planen“ (Ablauf bearbeiten) und der Ablauf am Handy zeigen keinen Zeilen-Stift mehr; Plus und Papierkorb beim
  Darüberfahren bleiben.
- **Gewohnheit: Spalten, Ablauf zeigen, Als Vorlage und Neu aufsetzen liegen im „⋯“-Menü.** Beim Ansehen: **Spalten wählen** (ein kleines
  Fenster mit Häkchen, statt des Knopfs „Spalten“) und **Ablauf zeigen** (statt eines eigenen Knopfs). Beim Bearbeiten: **Als Vorlage …**
  (nur mit dem Recht) und **Neu aufsetzen …** (statt der Links in der Hinweiszeile). **Live** und **Musik-App** bleiben sichtbar im Kopf.
- **„+ Ablauf anlegen“ ist das leise gestrichelte Feld** (wie in der Musik-App) – bei einem Termin ohne Ablauf in der Termin-Ansicht, in
  „Planen“ am Handy und in leeren Spalten der Matrix; vorher ein Rahmen-Knopf bzw. ein blau gestrichelter Knopf.

### Intern

- `TerminAblauf` reicht statt `spaltenKnopf`/`zeigenKnopf` ein `mehrKnopf` (`MehrMenue`) an den Aufrufer und nutzt `linksImMenue`/`ohneStift`
  aus `useAblaufBearbeiten`, `InfoSpaltenFenster` und `LeisesPlus` – dieselben Bausteine wie die Musik-App. Die Obergrenzen im Wächter
  `bedienKnoepfe` für den Dienstplaner sinken auf 78 Knöpfe und 21 feste Höhen. Eine Dienstplaner-Einführung mit Zielen am Stift gibt es
  nicht – Tour-Versionen unverändert.
