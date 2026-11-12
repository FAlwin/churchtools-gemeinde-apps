### Behoben (Dienstplaner)

- **Planen zählt im Termin-Kopf nur die gezeigten Gruppen.** „N frei“, der Füllbalken und am Handy die Datumszettel
  zählten bisher immer alle Gruppen eines Termins – auch wenn nur eine Gruppe gezeigt wurde. Wer von der Startseite
  „Programm · 3 Plätze frei“ kam, sah an einem Gottesdienst „12 frei“, obwohl Programm dort nur einen Platz frei hatte.
  Jetzt zählen sie wie die Gruppenzeilen; hat keine gezeigte Gruppe an einem Termin einen Dienst, steht dort „—“.
- **Der Hinweis „Nur … · nächste 6 Wochen“ ist blau** – er war versehentlich rot wie eine Warnung.

### Intern

- Wächter `ui/design/extendReihenfolge.test.ts`: Eine Klasse mit `@extend` darf ihre eigenen Angaben nicht an die
  erweiterte Regel verlieren (Sass hängt sie dort an – steht die Klasse davor, gewinnt die andere). Geprüft am
  übersetzten CSS aller Apps.
