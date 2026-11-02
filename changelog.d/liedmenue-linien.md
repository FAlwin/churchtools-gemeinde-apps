### Behoben (Musik-App)

- **Gerade Trennlinien im Lied-Menü** (Alwin, 02.11.2026: „Warum sind die Linien rechts und links so abgerundet?“).
  Seit dem Umbau zum Fenster (#779) bogen sich die Linien zwischen den Zeilen an beiden Enden nach unten: Sie hingen
  als Schatten an der Zeile, und die Zeile hat runde Ecken für die Hervorhebung. Jetzt ist die Linie ein eigenes,
  gerades Element über die volle Breite; die Hervorhebung bleibt rund.

### Intern (alle Apps)

- Wächter `ui/design/trennlinien.test.ts`: Eine Regel mit Rundung darf ihre Trennlinie nicht als
  `box-shadow: inset 0 1px 0` tragen. Gegenprobe: ohne den Fix meldet er genau die Zeile im Lied-Menü.
