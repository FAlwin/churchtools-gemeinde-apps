### Intern

- **„Planen“ im Dienstplaner in Dateien geteilt** (#845, Schritt 4, Scheibe 4a-1): Die Teile, die schon eigene
  Komponenten waren, stehen jetzt in eigenen Dateien – `Terminleiste.tsx`, `PlanAnsicht.tsx` (Tabelle, Handy,
  Gruppenknöpfe), `WerWieOft.tsx`, `PlanPlaetze.tsx` (Plätze, auch für die Termin-Ansicht), `useBisUnten.ts` und
  `planSicht.ts` (gemeinsame Typen und Regeln wie `darfPlanen`, `freierPlatz`). Rein verschoben, nichts verändert:
  `Planen.tsx` hat statt 2.010 noch rund 1.150 Zeilen. Als Nächstes zieht 4a-2 Zustand und Abläufe aus der
  Komponente `Planen` in Hooks.
