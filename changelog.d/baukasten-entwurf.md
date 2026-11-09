### Intern

- **Baukasten: Feld-Entwurf und Design-Speichern als Hooks** (#845, Schritt 4, Scheibe 4b-2): `useFeldEntwurf` trägt,
  welches Feld gewählt ist, was daran geändert wird und wann es gespeichert wird (nach einer Pause beim Tippen, beim
  Wechsel, beim Verlassen), den Fragetyp und was ChurchTools zu den Antworten weiß; `useDesignEntwurf` speichert das
  Design nach einer kurzen Pause. Unverändert übernommen; `Baukasten.tsx` hat statt 874 noch rund 710 Zeilen (vor
  Schritt 4: 1.109). Neue Tests: Leerzeichen am Rand, Speichern beim Verlassen (Feld und Design einzeln), ein gewähltes
  Vorlagen-Feld entfernen, Zwischenstand bei wartendem Design, Textfeld → Auswahl mit zwei Antworten.
