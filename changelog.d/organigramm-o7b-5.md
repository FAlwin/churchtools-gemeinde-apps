### Neu (Organigramm, O7b-5, #736)

- **Präsentation mit Ansichten:** oben **Kacheln · Von oben · Von links · Mindmap**. Die Seiten bleiben dieselben
  (Übersicht, dann Bereich für Bereich – Alwin: „Seiten bleiben“), der Umschalter ändert nur die Darstellung: Kacheln
  und Personen-Spalten wie bisher, oder die Seite als Diagramm – auf der Übersicht die ganze Gemeinde, auf einer
  Bereichs-Seite der Bereich, anfangs ganz aufgeklappt. Im Diagramm der Übersicht öffnet ein Klick auf einen Bereich
  seine Seite. Die gewählte Ansicht merkt sich das Gerät.

### Behoben (Organigramm)

- **„Ganz zeigen“** lässt unten den Streifen der Knöpfe frei – vorher lagen − / + / „Ganz zeigen“ über dem untersten
  Kästchen (Reiter und Präsentation; gemeldet von Alwin 28.10.2026). Gilt auch für die Startansicht.
- Die Leertaste auf einem +/− im Diagramm der Präsentation klappt nur und blättert nicht zusätzlich weiter.
- „Neue Gliederung | Heute“ in der Präsentation steht auf einer Schiene wie die übrigen Umschalter: 38 px hoch,
  einzeilig – am iPad quer (1024 px) war es zweizeilig und 41 px hoch. Ebenso „Plan | Umbau“ im Reiter „Neue Gliederung“.
  Eine Dauerprüfung (`ui/design/umschalterVerbunden.test.ts`) hält fest, dass jeder Umschalter des Organigramms so gebaut ist.

- Reiter „Neue Gliederung“: **„Neuer Bereich“** (grün wie „+ Gruppe erstellen“ in ChurchTools) und **„Plan verwerfen“**
  sind wieder richtige Knöpfe, so hoch wie der Umschalter daneben. „Neuer Bereich“ zeigte seit O7b-3 auf eine
  gestrichene Stilklasse und stand als bloßer Text da; „Plan verwerfen“ war 31 statt 38 px hoch.

### Intern (Organigramm)

- Dauerprüfung `ui/design/stilKlassen.test.ts`: Jede benutzte Klasse einer `*.module.scss` muss es dort geben (für alle
  Apps; einziger Fund war der oben).

- Die Namen der Ansichten stehen an einer Stelle (`ANSICHT_NAMEN` in `auswahl.ts`) statt je einer Liste in Reiter
  und PDF-Fenster.
