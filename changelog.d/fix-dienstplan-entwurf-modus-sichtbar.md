### Behoben (Dienstplaner)

- **Anfrage oder direkt ist am Entwurf deutlich zu sehen.** In „Personen“ stand das „?“ einer Anfrage in einem winzigen,
  gestrichelten blauen Kreis auf blauer Fläche – im Dunkelmodus kaum zu erkennen. Jetzt sagt der **Rahmen** die Art:
  **gestrichelt = Anfrage**, **durchgezogen = direkt** (auch Gäste), in „Personen“ und in der Matrix gleich; „?“ und Haken
  stehen in einem gefüllten Kreis. Darüberfahren in der Matrix dunkelt die Fläche ab, statt den Rahmen durchzuziehen.
- **Abgesagte Termine: Der Spaltenkopf bleibt deckend.** Die blasse abgesagte Spalte war über `opacity` durchsichtig – in der
  Matrix schien beim Scrollen „kein Ablauf“ durch den klebenden Kopf, in „Personen“ ebenso. Jetzt werden nur die Inhalte
  blass (gemeinsames Mixin `abgesagt-blass` in `ui/design/_mixins.scss`).
