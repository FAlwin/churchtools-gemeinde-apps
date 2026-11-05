### Neu (Dienstplaner)

- **Termin teilen als PDF** (Bauplan E8-1, Entwurf `e8-teilen.html` Version 5, Alwin 05.11.2026): In der
  Termin-Ansicht steht hinter dem Titel „Teilen“. Das Fenster „Termin teilen“ zeigt drei Zeilen – Dienste, Ablauf,
  Infos – mit dem, was gerade eingestellt ist, dazu Hoch-/Querformat, die fertigen Seiten als Vorschau,
  „Herunterladen“ und „Teilen“. Ein Tipp auf eine Zeile öffnet ihre Einstellungen im selben Fenster: ein/aus, welche
  Gruppen, freie und angefragte Plätze, Dienste über oder unter dem Ablauf; Uhrzeit, Dauer, Zuständig (Spalte oder
  unter dem Eintrag), Notiz, Tonart, Tempo, Arrangement, Vorlauf, weggelassene Einträge; Infos als Spalten oder
  unter dem Eintrag. Die Infos-Gruppen kommen vorab aus „Spalten“ der Ansicht. Das Gerät merkt sich die Wahl.
- **Das Termin-Blatt** im ChurchTools-Look (Lato): oben Titel, Datum mit Beginn und Ende, Gemeinde und Stand; die
  Dienste je Gruppe in Spalten (Dienst grau, Person fett, „frei“ rot, „angefragt“); der Ablauf mit Beginn und Ende als
  dunkle Bänder, Abschnitten mit ihrer Dauer, Liedern mit Tonart. Keine leeren Info-Spalten; ganze Teams stehen nur als
  Dienst-Name. Auf jeder Seite Kopf und „Seite x von y“.

### Geändert

- **„Eintrag“ statt „Punkt“** in der Kopfzeile der Info-Spalten des Ablaufs (Musik-App und Dienstplaner) – so heißt es
  schon beim Hinzufügen.

### Intern

- Kern `shared/ct/terminBlatt.ts` (was aufs Blatt kommt, aus denselben Ablauf-Zeilen wie die Ansicht), Zeichnung
  `ui/teilen/terminBlattPdf.ts`, Fenster `ui/teilen/TerminTeilenFenster.tsx` – gemeinsam für Dienstplaner und (mit
  E8-1b) Musik-App.
- PDF-Vorschau, Seitenzeichnen mit pdf.js, Worker-Einrichtung, Bildgrößen-Grenze und Ladekringel aus der Musik-App
  nach `ui/` (`ui/teilen/`, `ui/bedienung/Spinner.tsx`); die Umlenkung des pdf.js-Workers auf eine eigene Datei steht
  jetzt im gemeinsamen Erweiterungs-Bau (`ui/erweiterung/viteErweiterung.ts`) und gilt für jede Erweiterung.
- Der Dienstplaner lädt „Termin teilen“ (mit pdf.js) erst beim Antippen.
