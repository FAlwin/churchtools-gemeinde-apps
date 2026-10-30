### Behoben (Protokolle)

- **To-Dos: Hover-Farben nur mit Maus** – drei `:hover`-Regeln aus S7-1 (#795) standen nicht in `@media (hover: hover)`
  (Status-Marke, Aufgabentext, „Ältere erledigte zeigen“). Am Handy wäre die Farbe nach dem Antippen hängen geblieben; der
  Wächter `ui/design/hoverNurMaus.test.ts` (#776) hatte main deshalb rot gemeldet.
