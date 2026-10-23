### Intern (Lied-Editor L4)

- Regeln für die Liedinfo (`shared/ct/liedinfo.ts`): welche Kopfzeile der Datei zu welchem ChurchTools-Feld gehört
  (Titel, Autor, CCLI, Copyright am Lied; Tempo, Takt am Arrangement – `{key}` bleibt als notierte Tonart),
  Vergleich Datei ↔ ChurchTools je Feld und das Entfernen der Zeilen, deren Feld ChurchTools nach dem Speichern
  wirklich hat. `metaWerte` liest alle Zeilen eines Felds (SongSelect bringt zwei `{artist}`).
