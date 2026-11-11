### Intern

- **Anmeldeformular: Absenden und freie Plätze als Hooks** (#845, Schritt 4, Scheibe 4d-2): `useAbsenden` prüft,
  schützt gegen Spam (Honigtopf, Mindest-Ausfüllzeit), schickt ab oder zeigt in der Vorschau, was herauskäme, und
  schickt bei „Noch einmal“ nur die Offenen mit derselben Anmelde-Nr.; `usePlaetze` fragt beim Hinzufügen einer Person
  die freien Plätze frisch nach. Unverändert übernommen (`ui/anmeldeformular/useAbsenden.ts`, dazu der Typ
  `Abschicken`); `AnmeldeFormular.tsx` hat statt 627 noch 537 Zeilen (vor Schritt 4: 1.113) → fertig aufgeteilt. Neue
  Tests: im Baukasten keine Person dazu, kein doppeltes Nachfragen, Fehler bei „Noch einmal“, Mail im Vorschau-Ergebnis.
