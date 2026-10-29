### Intern (Musik-App)

- **Wackelnder E2E „Schreibansicht am Handy“ stabil.** Die Editor-Tests setzten den Cursor per Klick auf die halbe
  Höhe einer Zeile, gemessen, bevor die Schrift Lato geladen war. Mit der Ersatzschrift bricht die Zeile am Handy um
  (62 statt 31 px); kam die Schrift zwischen Messen und Klicken, lag am Klickpunkt die nächste Zeile, und Playwright
  versuchte es bis zum Timeout – unter Last gelegentlich, auch auf main. Die Klick-Folge stand viermal kopiert in den
  Editor-Tests; jetzt einmal als `cursorInZeile` in `e2e/werkzeug.ts`: erst auf die Schrift warten, dann in die erste
  Bildschirmzeile klicken. Neuer Test hält die Schrift gezielt zurück (alter Klick-Weg: rot, neuer: grün).
