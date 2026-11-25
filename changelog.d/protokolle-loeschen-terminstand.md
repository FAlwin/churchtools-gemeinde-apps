### Behoben (Protokolle)

- **Protokoll löschen räumt auch die Vermerke im Reiter „Termine“ ab (W6).** Bisher blieben die Stände der Termin-Bausteine
  (`termin-stand` in „Mitarbeit“: „im Kalender“, „nicht eintragen“) eines gelöschten Protokolls unsichtbar liegen. Jetzt
  werden sie – immer, ohne eigenes Häkchen – **als gelöscht vermerkt**, nie hart gelöscht (in „Mitarbeit“ darf niemand Werte
  löschen, S0), und nachgelesen. Der Schritt läuft nach der zweiten Sperrprüfung direkt vor dem Protokoll; scheitert er, steht
  das Protokoll noch, und „Nochmal versuchen“ vermerkt nichts doppelt. Auch doppelte Werte aus einem abgebrochenen Anlegen
  werden erfasst. `termineAlsGeloescht` in `protokolle/src/terminStandSchreiben.ts`, Regel `terminStandGeloescht` in
  `shared/protokolle/terminStand.ts`.
