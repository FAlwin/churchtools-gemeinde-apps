### Geändert (Dienstplaner)

- **Dienste: ruhigere Werkzeugzeile.** Über der Karte steht eine Zeile statt eines Kartenkopfs: links „Meine | Alle“, rechts
  **Filter** und **⋯**. Am Handy ist „Meine ⌄“ ein blauer Knopf, Filter und ⋯ haben einen Rahmen.
- **Gewohnheit: „Teilen“ und die Hilfe liegen jetzt im ⋯-Menü** (Teilen nur bei „Meine“, wie bisher). Das „?“ in der Zeile gibt
  es nicht mehr. Nichts ist weggefallen, nur einen Klick tiefer.
- **Dienste: „Weitere Wochen laden“** (vorher „Weitere Termine laden“) steht als stilles blaues Wort unter der Liste. Ist die Liste
  leer, steht dort ein Satz mit dem Link „Alle Termine zeigen“, der gleich zu „Alle“ springt.
- **Wann kann ich?: alles in einer Zeile.** Links „Termine | Einträge“ – die Zahl der anstehenden Einträge ist jetzt ein blauer
  Kreis direkt hinter dem Wort –, in der Mitte der Zeitraum mit ‹ › zum Blättern (nichts Vergangenes), rechts **Filter** und der
  grüne Knopf **+ Zeitraum eintragen** (am Handy wie bisher das runde Plus). Unter „Einträge“ stehen Zeitraum und Filter nicht
  mehr, sie wirken nur auf die Termine.
- **Wann kann ich?: leisere Notiz.** Ohne Notiz steht ein graues „+ Notiz“, mit Notiz nur ihr Text (ohne „Notiz:“ davor).

### Geändert (Musik-App)

- **Abwesenheiten: dieselbe ruhige Zeile wie im Dienstplaner** („Wann kann ich?“, siehe oben): „Termine | Einträge“ mit blauem
  Kreis, Zeitraum mit ‹ ›, „Filter“ und der grüne Knopf „+ Zeitraum eintragen“ in einer Zeile; „+ Notiz“ gibt es hier nicht
  (die Musik-App kennt keine Notiz an Terminen). Der Haken „Abwesend“ je Termin bleibt.

### Intern

- Neue Bausteine in `ui/bedienung`: `ZeitraumLeiste` (‹ Zeitraum › als ein Rahmen, vorher in „Planen“ von Hand;
  `Terminleiste` nutzt ihn jetzt) und `TextKnopf` (stilles blaues Wort). `AnsichtWahl` kann einen Merker tragen (`zahl`),
  `ReiterZaehler` gibt es in Blau (`ton="blau"`), `FilterKnopf` bekommt `dataTour`; die Werkzeugzeile hält „rechts“ auch ohne Mitte
  rechts. `AbwesenheitenSeite` gibt dem Rahmen nur noch `werkzeug` statt `kopf` + `aktionen`.
- Wächter `bedienKnoepfe`: Obergrenze Dienstplaner 81 → 79. Der eigene rote Zähler der Abwesenheiten ist durch `ReiterZaehler`
  ersetzt.
