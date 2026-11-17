### Neu (Protokolle)

- **Mit KI füllen: neue Punkte mit Beschlüssen, To-Dos und Terminen.** Ein leeres Protokoll (oder eines ohne passende
  Punkte) ließ sich nicht füllen: Beschlüsse, To-Dos und Termine brauchten die Nummer eines vorhandenen Punkts („Punkt 1
  gibt es nicht“). Jetzt kann ein neuer Punkt der KI-Antwort (`neue_punkte`) neben Stichpunkten auch Beschlüsse, To-Dos
  (mit Zuständigen und Datum) und Termine tragen. Die Vorschau zeigt sie unter dem Punkt, **ein** Häkchen gilt für den
  ganzen Punkt; beim Übernehmen entstehen Tagesordnungspunkt, Stichpunkte, Beschlüsse, To-Dos und Termine wie bei einem
  vorhandenen Punkt. Steht im Protokoll keine Tagesordnung, bittet der Auftrag die KI, den Inhalt selbst in Punkte zu
  gliedern. Antworten im alten Aufbau gehen weiter.

### Intern

- `shared/protokolle/ki.ts`: Lesen (`beschlussTeil`/`todoTeil`/`terminTeil`) und Block-Erzeugung (`beschlussBlock`/
  `todoBlock`/`terminBlock`) für einzelne Einträge und für die Inhalte eines neuen Punkts sind jeweils EINE Stelle;
  `Eintrag.neuerPunkt` trägt `beschluesse`, `todos`, `termine`.
