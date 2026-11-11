### Intern

- **Lied-Blatt: Datei-Fenster, Seiten-Schlüssel und Teilen-PDF herausgelöst** (#845, Schritt 4, Scheibe 4e):
  `DateiFenster` (Dateien des Arrangements mit SongSelect-Rückfrage, Löschen, Umbenennen und Upload-Warnung),
  `useSeitenSchluessel` (Anmerkungs-, Zoom- und „Notizen von …“-Schlüssel je Seite) und `liedPdfBauen` (das aktive Lied
  als PDF zum Teilen) stehen jetzt in eigenen Dateien. Unverändert übernommen; `ChordChart.tsx` hat statt 1.063 noch
  896 Zeilen. Neue Tests für alle drei Teile – vorher war diese Verdrahtung ungetestet (16 Teile, 2 über E2E bewacht).
