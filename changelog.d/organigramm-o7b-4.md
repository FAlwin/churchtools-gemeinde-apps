### Neu (Organigramm, O7b-4, #736)

- **Drucken / als PDF speichern:** Knopf „Drucken“ im Seitenkopf (neben „Präsentieren“). Das Fenster übernimmt
  Ansicht, „Anfangen bei“ und was aufgeklappt ist, mit **Vorschau**: Ansicht (von oben, von links, Mindmap, Liste),
  Ausschnitt, Papier (A4 quer/hoch, A3 quer), „Alles aufgeklappt drucken“. Ein Diagramm wird auf eine Seite
  eingepasst, eine Liste läuft über mehrere Seiten. Im Druckfenster des Browsers „Als PDF sichern“ wählen.
- Gedruckt wird **nur das Organigramm** mit Kopfzeile (Name, Stand) – in einem eigenen Druck-Dokument, weil
  ChurchTools keine Druckregeln hat und sonst Leiste und Reiter mitkämen. Immer hell, in Lato (die Schrift übernimmt
  das Druck-Dokument zur Laufzeit aus ChurchTools).

### Intern (Organigramm)

- `DiagrammBild.tsx`: Linien und Kästchen gemeinsam für Bildschirm und Druck; `messung.ts`: Breite und Kürzen der
  Namen an einer Stelle. `spitzenWahl` (Ansichten-Kern) liefert die Auswahl „Anfangen bei“/„Ausschnitt“ für beide.
- Die Liste lässt sich ohne Pfeile und Knöpfe zeigen (für Papier).
