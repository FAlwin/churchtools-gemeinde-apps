### Geändert (Musik-App + Dienstplaner)

- **Ein Ablaufpunkt öffnet überall eine Seite – auch am iPad und Mac.** Vorher ging am iPad und Rechner ein kleines Fenster in der Mitte auf; jetzt ist es wie am Handy und in der ChurchTools-App: oben **‹ Ablauf** und **Position 3/10**, darunter der Titel groß und die Infos des Punkts, unten **Davor / Danach**. Auf breiten Bildschirmen steht der Inhalt in **Lesebreite** in der Mitte, die Leiste unten geht über die ganze Breite. Am Rechner blättern **← →** durch die Punkte (nicht, solange man in ein Textfeld tippt), **Esc** geht zurück. Die ‹ › oben im Fenster entfallen.

### Intern (Musik-App + Dienstplaner)

- `PunktAnsichtFenster` ist entfernt; `usePunktAnsicht` zeigt immer `PunktSeite` (kein Wechsel mehr nach Breite). Neuer Wächter `ui/design/punktSeite.test.ts` hält Lesebreite und Handy-Beschriftung in der Stildatei fest.
