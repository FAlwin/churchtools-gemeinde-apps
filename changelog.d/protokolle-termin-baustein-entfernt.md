### Behoben (Protokolle)

- **Ein Termin-Baustein, der aus dem Protokoll entfernt wird, hinterlässt keinen unvermerkten Stand mehr.** Bisher blieb
  sein Stand im Reiter „Termine“ (`termin-stand` in „Mitarbeit“) einfach liegen. Jetzt gleicht das Speichern (und das
  Freigeben) die Stände wie die To-Dos ab: Steht ein Baustein nicht mehr im Protokoll, wird sein Stand **als gelöscht
  vermerkt** – nie hart gelöscht (in „Mitarbeit“ darf niemand Werte löschen, S0) –, und nachgelesen. Kommt der Baustein
  zurück (Rückgängig), fällt der Vermerk wieder weg; „im Kalender“ und „nicht eintragen“ bleiben dabei, wie sie waren. Ist
  nichts zu ändern, wird nur einmal gelesen. Eine Regel für Speichern und Löschen: `terminStandNach` in
  `shared/protokolle/terminStand.ts`, geschrieben von `termineAbgleichen` in `protokolle/src/terminStandSchreiben.ts`
  (`termineAlsGeloescht` beim Löschen ist derselbe Abgleich mit „kein Protokoll mehr“).
