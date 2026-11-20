### Geändert (Musik-App)

- **Ruhigere Termine.** Statt Umschalter, Filter und Vollbild in einer vollen Zeile steht über der Liste **eine Werkzeugzeile**:
  links **Kommende | Vergangene** (am Handy der blaue Knopf „Kommende ⌄“), rechts der **Filter** – still, ohne Rand. Der Umschalter
  ist nur noch so breit wie seine Wörter.
- **Gewohnheit: Vollbild steht neben den Reitern.** In der ChurchTools-Erweiterung sitzt der Vollbild-Knopf am iPad und Rechner
  ganz rechts in der Reiterzeile (Termine · Lieder · Mehr) statt in jedem Seitenkopf. Am Handy bleibt er im Seitenkopf.
- **Gewohnheit: „+ Anlegen“ bei einem Termin ohne Ablauf heißt jetzt „+ Ablauf anlegen“** und ist ein leises gestricheltes
  Feld; das Etikett „Kein Ablauf“ entfällt, weil es dasselbe sagte. Wer keinen Ablauf anlegen darf, sieht das Etikett weiter.
  „Mehr laden“ unter den vergangenen Terminen ist ein stilles blaues Wort statt eines breiten Knopfs.
- **Lieder: die Sortierung** (A–Z · Häufigkeit · Zuletzt) steht in derselben Werkzeugzeile wie überall – am Rechner verbunden,
  am Handy als Auswahlknopf in Wortbreite. Das Suchfeld bleibt, wo es ist: Die Suche ist das Wichtigste dieser Seite und
  braucht kein Aufklappen.
- **Liedblatt: die Werkzeuge** (Aussehen, Tempo, Anmerken …) und Vollbild sind am iPad und Rechner still, ohne Rahmen; am
  Handy behalten sie ihren Rahmen. Zeichenwerkzeuge, Tempo-Menü und Fußleiste bleiben unverändert.

### Geändert (alle Apps)

- **Zwei Arten von „+“.** Grün gefüllt heißt immer **etwas Neues anlegen**: Am Handy ist der schwebende Kreis mit „+“ jetzt
  **grün** statt blau (Neues Lied, Neue Vorlage, Zeitraum eintragen, Eintrag im Ablauf), wie der grüne Knopf „Neu“ am
  Rechner. Grau und gestrichelt heißt „hier fehlt etwas“ (`+ Ablauf anlegen`).

### Behoben (Dienstplaner)

- **„Wann kann ich?“ am Handy: das „+“ stand unter dem Bildschirmrand.** Der Kreis lag am Ende der Liste (bei 844 px Höhe auf
  y≈1000) statt fest unten rechts über der Reiterleiste. Ebenso klebte die Speichern-Leiste nach dem Abhaken am Ende der Karte
  statt am unteren Rand. Ursache: Die Karte schneidet ab (`overflow: hidden`), und das machte sie zum Rollbereich der klebenden
  Hülle. Das schwebende „+“ zeichnet sich jetzt auf die Fläche über der Reiterleiste, egal wo die Seite es aufruft – auch im
  Bearbeiten eines Ablaufs und bei den Vorlagen.

### Intern

- Neu: `LeisesPlus` (gestricheltes „+“, R10), `SchwebeFlaeche` (Fläche des schwebenden Plus, vom `ErweiterungsRahmen` gesetzt),
  `ReiterLeiste rechts`, `AnsichtWahl gedimmt`, `SongStatsBar werkzeug`, `VollbildImReiter`. Obergrenze rohe Knöpfe Musik-App
  111 → 110.
