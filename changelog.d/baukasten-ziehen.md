### Intern

- **Baukasten: Ziehen und Ablegen als Hook, Knöpfe am Feld als Baustein** (#845, Schritt 4, Scheibe 4b-1): `useZiehen`
  trägt, was beim Ziehen geschieht – die Lücke unter dem Mauszeiger (gerechnet an den Plätzen vom Start), das Gleiten
  der Felder, das Mitscrollen am Rand, das Ausblenden des gezogenen Felds erst nach dem Start und das Ablegen „ganz
  unten“ vor Preis und Datenschutz. `FeldWerkzeug` sind die Knöpfe hoch, runter, kopieren und entfernen. Unverändert
  übernommen; `Baukasten.tsx` hat statt 1.109 noch rund 875 Zeilen. Neue Tests: Abbrechen des Ziehens, Gleiten,
  gesperrte Pfeile am Rand, „nach unten“ ans Ende und Kopieren.
