### Behoben (alle Apps)

- **Am Handy bleibt nach dem Antippen keine Farbe mehr hängen** (Alwin am iPhone, 29.10.2026). Touch-Geräte halten den
  Maus-Zustand auf dem zuletzt angetippten Element fest – in der Liedleiste blieb so das vorher angetippte Lied
  hellblau und sah aus wie gewählt. Hover-Farben gelten jetzt nur noch mit Maus (`@media (hover: hover)`): 72 Regeln
  in 44 Dateien aller Apps (Musik-App, gemeinsame Knöpfe und Fenster, Dienstplaner, Organigramm, Protokolle,
  Anmeldungen, Anmeldeformular).

### Intern (alle Apps)

- Wächter `ui/design/hoverNurMaus.test.ts`: Jede `:hover`-Regel muss in `@media (hover: hover)` stehen.
