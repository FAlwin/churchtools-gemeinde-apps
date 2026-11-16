### Geändert (alle Erweiterungen)

- **Volle Fensterbreite, überall gleich.** Bisher begrenzte der gemeinsame Rahmen den Inhalt auf 1120 px, den
  Gebetsabend auf 672 px, und die Protokoll-Seiten Sitzungen, To-Dos, Verwaltung und Suche hatten je ein eigenes
  Maß von 720 bis 820 px. Auf einem breiten Bildschirm blieb so die Hälfte frei, gerade in der Matrix und in
  „Personen“ des Dienstplaners. Jetzt nutzen Dienstplaner, Anmeldungen, Organigramm, Protokolle und Gebetsabend die
  ganze Breite, jede Seite gleich. Am Handy ändert sich nichts.
  - Lange Hinweistexte (unter Planen im Dienstplaner, Fußzeilen der Anmeldungen) bleiben auf eine Lesebreite von
    960 px begrenzt (`--lese-breite` in `ui/design/_variables.scss`). Das Bild beim Gebetsabend wird höchstens 70 %
    der Fensterhöhe hoch.
  - Die Option `schmal` des Seitenrahmens entfällt. Ein Test (`ui/design/seitenBreite.test.ts`) meldet jede neue
    feste Höchstbreite ab 600 px. Ausgenommen sind nur die Vollbild-Ansichten (Ablauf-Anzeige, Live-Ansicht) mit dem
    Vermerk „bewusst fest“.
