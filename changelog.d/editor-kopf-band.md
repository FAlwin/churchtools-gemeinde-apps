### Behoben (Musik-App)

- **Lied-Editor: Der Kopf steht unter dem Band, nicht mehr unter der Uhr** (Alwin am iPhone, 29.10.2026: „das
  Fenster ist zu hoch“). In der installierten App lagen Abbrechen, Titel und Speichern direkt unter der Uhr im
  Unschärfe-Band von iOS und wirkten weich. Jetzt beginnt der Kopf wie jeder andere unter dem Band. Er war der letzte
  mit der alten Regel; ein Messkasten am Gerät zeigte, dass sonst nichts verschoben war.

### Intern (Musik-App)

- Das Tempo-Menü rechnet seine größte Höhe mit der gemessenen Unterkante des Kopfs statt mit einem Nachbau der alten
  Regel (Safe-Area oder 20px + 78px).
- Wächter `ui/design/obenBand.test.ts`: Niemand außer `_variables.scss` (und der Messung in `main.tsx`) rechnet selbst
  aus der Safe-Area oben.
