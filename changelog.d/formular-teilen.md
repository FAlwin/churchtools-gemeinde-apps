### Intern

- **Anmeldeformular in Dateien geteilt** (#845, Schritt 4, Scheibe 4d-1): `FeldEingabe` (ein Feld, wie Gäste es sehen,
  mit Pflicht-Stern), `FormularRahmen` (Gestaltung, Kopf mit Logo und Titelbild, Symbole; dazu der Typ `Ansicht`) und
  `Ergebnis` (die Seite nach dem Abschicken, `FormularErgebnis.tsx`) stehen jetzt in eigenen Dateien unter
  `ui/anmeldeformular/`. Nur verschoben; `AnmeldeFormular.tsx` hat statt 1.113 noch 627 Zeilen. Neue Tests:
  Pflicht-Stern und „(freiwillig)“ an der Beschriftung, Symbole in den Fakten oben.
