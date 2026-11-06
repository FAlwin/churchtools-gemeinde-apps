### Intern (Musik-App + Dienstplaner)

- **Liedwahl in den gemeinsamen Ordner gezogen (Dienstplaner E9, „LW1a“):** `SongPicker` mit Suche, Vorschau,
  Statistik-Leiste und SongSelect-/Liedtext-Treffern liegt jetzt in `ui/lied`, die Such-Regeln in
  `ui/lied/suchRegeln.ts`, die Abfragen in `ui/lied/liedDaten.ts` (Schlüssel und Haltezeiten unverändert). Die Daten
  kommen über den `LiedZugriff` der App; die Musik-App gibt ihre bisherigen Wege. ChordPro-Leser nach
  `shared/lieder`, `CenterMessage` und `useEntprellt` nach `ui/bedienung`. Für die Musik-App ändert sich nichts
  Sichtbares – Vorbereitung für die Liedauswahl im Dienstplaner.
