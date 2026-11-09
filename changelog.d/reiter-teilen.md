### Intern

- **Anmeldungen: das Fenster einer Anmeldung in eigener Datei** (#845, Schritt 4, Scheibe 4c-1): `AnmeldungAnsehen`
  (Antworten, Zahlungen, Nachrücken, Absagen, „Rückgängig“ im Fenster) steht jetzt in `AnmeldungAnsehen.tsx`; die
  Texte, die Liste und Fenster teilen (`kurz`, `ganzerName`, `absageText`), in `anmeldungText.ts`. Nur verschoben;
  `AnmeldungenReiter.tsx` hat statt 1.193 noch 760 Zeilen. Neuer Test: im Fenster je Person Platz oder Warteliste, Link
  zur Person in ChurchTools, Abgesagte mit Grund.
