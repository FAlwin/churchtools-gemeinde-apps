### Intern

- **Ein gemeinsamer Start für alle Erweiterungen** (#845): `erweiterungStarten()` in `ui/erweiterung/starten.tsx`
  ersetzt vier fast gleiche `main.tsx` (je 43 → 11–12 Zeilen). Klasse `ct-extension`, Home-Strich, Hell/Dunkel,
  Zoom beim Antippen und die Rechte-Meldung stehen damit an einer Stelle; `?demo` bleibt nur beim Entwickeln
  (gemessen: kein Demo-Code in den gebauten Erweiterungen). Ein Wächtertest hält fest, dass jede neue Erweiterung
  diesen Start nimmt.
