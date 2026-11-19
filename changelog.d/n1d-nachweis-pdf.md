### Intern (Anmeldungen)

- **Nachweise: der Antrag als eigene PDF** (Etappe F, Scheibe N1d; veröffentlicht wird erst nach Etappe F). Im Abschnitt „Antrag
  (Bescheinigung in ChurchTools)“ des Fensters „Nachweis-Art“ gibt es neben dem Baukasten die Gestaltung **„Eigene PDF“**: Die
  Gemeinde lädt ihr vorhandenes Antragsformular als PDF hoch (bis 15 MB), die Erweiterung macht aus der **ersten Seite** ein
  Hintergrundbild (JPEG, ~150 dpi; wird es über 2 MB, erneut mit gröberer Auflösung) und übernimmt das **Seitenformat** der PDF. Die
  Platzhalter `[Nachname], [Vorname]`, `[Vorname]`, `[Nachname]`, `[Geburtsdatum]`, `[Adresse]`, `[Heute]`, `[E-Mail]` und die
  **Unterschrift** (Bild) zieht man mit Maus oder Finger an ihre Stelle; beim ersten Hochladen stehen Name, Geburtsdatum, Adresse,
  „Ort, [Heute]“ und Unterschrift schon untereinander. Schriftgröße je Platzhalter (9, 11, 13 pt), Breite der Unterschrift (30 bis
  70 mm), Pfeiltasten verschieben, Entf entfernt. Eine mehrseitige PDF nimmt nur Seite 1 (mit Hinweis); eine kaputte oder
  verschlüsselte PDF meldet es verständlich und ändert nichts. Wechseln zwischen Baukasten und PDF verliert im offenen Fenster nichts.
- **Wie es gespeichert wird:** derselbe Weg wie beim Baukasten (globale Vorlage „Antrag: Nachweis: …“, HTML-Datei, Gruppenrolle
  Teilnehmer, alles nachgelesen). Das HTML hat das Seitenformat der PDF (`@page`), das Hintergrundbild ganzseitig und die Felder
  absolut positioniert – **Positionen in Prozent der Seite, Anker ist die linke obere Ecke**; Editor und HTML rechnen mit
  derselben Funktion. Seitenformat und Platzhalter stehen im Datenblock der Art (Fassung 3, Fassung 1 und 2 bleiben lesbar), das
  Seitenbild nur im HTML. Ist der bisherige Antrag nicht lesbar, wird nichts geschrieben, was das Seitenbild verlieren könnte.
- **pdf.js wird erst beim Wählen einer PDF geladen** (eigener Baustein, Worker als eigene Datei); die Erweiterung wächst dadurch von
  etwa 0,5 auf 1,0 MB (ChurchTools nimmt Pakete bis etwa 2,2 MB). `pdfjs-dist` steht jetzt auch in den Abhängigkeiten der
  Anmeldungen. Neu in `ui/teilen/pdfSeiten.ts`: `pdfSeiteOeffnen` (Seitenzahl, Maße in pt, Zeichnen in beliebigem Maßstab).
