### Behoben (Dienstplaner)

- **„Live“: Texte überlagern sich nicht mehr.** Im schmalen Fenster und am Handy drückten lange Namen den Titel eines Punkts auf fast nichts zusammen (Gottesdienst 22.11.). Jetzt hat der Titel Vorrang, die Namen brechen rechtsbündig um und stehen am Handy unter dem Titel; nichts läuft mehr aus dem Bild.

### Neu (Dienstplaner)

- **„Live“ zeigt die Überschriften des Ablaufs und den Beginn.** Die Überschriften stehen als leise Bänder in der Liste, an der Grenze zwischen Vorlauf und Beginn eine blaue Linie „Beginn 10:00“. Die Stelle zählt weiter genau wie in der Live-Agenda von ChurchTools.
- **„Live“: Zurück und Weiter stehen unten.** Eine Leiste über die ganze Breite wie „Davor / Danach“ in der Punkt-Ansicht: links „Zurück“ mit dem Titel des vorigen Punkts, in der Mitte „− 1 Min / + 1 Min“, rechts „Weiter“ (blau) mit dem Titel des nächsten Punkts. Wer nicht steuern darf, sieht keine Leiste. Rechts neben der Liste bleiben Kreis und Zeitkonto.
- **„Live“: Infos der eigenen Dienstgruppen.** Wer an dem Termin eingeteilt ist, sieht die Infos seiner Dienstgruppen groß unter „Jetzt“ und klein unter jedem Punkt in der Liste (auch beim laufenden, nicht bei erledigten) – so kann z. B. die Technik den nächsten Punkt vorbereiten. Ist man nirgends eingeteilt, gilt wie bisher die Auswahl unter „Spalten“.

### Geändert (Dienstplaner)

- **„Live“: Die Restzeit zeigt „−0:45“ statt „+0:45“**, wenn die Zeit um ist – dasselbe Vorzeichen wie später beim Zeitkonto (Minus = Rückstand).

### Intern (Dienstplaner + Musik-App)

- „Davor / Danach“ der Punkt-Ansicht ist jetzt ein gemeinsamer Baustein (`ui/ablauf/NachbarKnopf.tsx`), den auch die Steuerleiste der Live-Ansicht nutzt.
