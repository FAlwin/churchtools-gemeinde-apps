### Geändert (Dienstplaner, E6-Abschluss – Alwin, 30.10.2026)

- **Termin-Ansicht: „Bearbeiten“ mit Wort.** Über dem Ablauf steht statt des runden Stifts ein grauer Knopf
  **„Bearbeiten“**, im Bearbeiten das blaue **„Fertig“** – wie in der Musik-App und in der Matrix. Der Stift allein war
  leicht zu übersehen.
- **„Musik-App“ öffnet den Ablauf dieses Termins.** Der Knopf über dem Ablauf öffnete bisher nur die Musik-App selbst;
  jetzt springt sie direkt in den Ablauf genau dieses Termins (auch außerhalb ihrer üblichen Wochen).

- **Der Zeitraum-Knopf springt nicht mehr** (Alwin, 30.10.2026): Er hat jetzt eine feste Breite. Vorher wuchs er mit
  seinem Text – wechselte „5 Termine · passend zur Fensterbreite“ zu „6 Termine“, wurde er 39 px schmaler, und ＋ ›
  daneben rutschten beim mehrmaligen Klicken unter dem Finger weg. Gilt auch für die Abwesenheiten der Musik-App
  (derselbe Knopf). Am Handy bleibt er über die volle Breite.

### Geändert (Musik-App)

- Die Musik-App versteht den Direktlink jetzt auch **ohne Punkt** (`#/termin/<ID>`): Dann öffnet sie den Ablauf des
  Termins statt eines Lieds. Gebraucht vom Knopf „Musik-App“ im Dienstplaner.

### Intern

- `shared/ct/musikAppLink.ts`: `punktId` ist optional (`musikAppDirektLink(app, termin, null, tag)`); eine Stelle für
  beide Apps wie bisher. `useAppNav` öffnet ohne Punkt die Ablauf-Ansicht.
