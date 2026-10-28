### Intern

- **E2E-Wackler `editor-schreiben` (Handy) behoben:** Unter Last kam die Webschrift später; mit der Ersatzschrift brach
  die Editor-Zeile am Handy auf zwei Reihen um (62 px statt 31 px). Der Test maß die Höhe in diesem Moment und klickte
  auf die halbe, alte Höhe – nach dem Laden der Schrift genau auf die Zeile darunter („intercepts pointer events“,
  60 s Zeitüberschreitung, in `--repeat-each=24 --workers=8` 4 von 24 rot). Jetzt wird erst nach `document.fonts.ready`
  gemessen, in **einer** Hilfe `anDenZeilenanfang` (`e2e/werkzeug.ts`) für alle vier Editor-Tests, die vorher je eine
  eigene Kopie hatten (`editor-schreiben`, `editor-akkorde`, `editor-text`, `editor-einfuegen`). Danach 120/120 unter
  Last grün; ohne das Warten wieder 4 von 24 rot.
