### Neu (Protokolle, S3-4b)

- **Suche mit der Lupe** (Alwin, 23.10.2026): oben rechts im Kopf; ein Tipp klappt die Suchleiste neben den Reitern
  aus, ist es zu schmal (Handy), bekommt sie eine eigene Zeile. ✕ oder Esc schließt sie wieder, ein Reiter auch.
- **Eine Suche für alles:** Beschlüsse, To-Dos, Termine und Protokolltext aller Gruppen, filterbar nach Art und Gruppe;
  die Fundstellen sind markiert. **Ohne Suchbegriff stehen dort alle Beschlüsse** – die Beschluss-Übersicht über alle
  Sitzungen. Beschlüsse, Termine und Text kommen nur aus freigegebenen Protokollen, To-Dos aus allen.
- **Ein Treffer öffnet seine Sitzung und springt zum Tagesordnungspunkt**, der kurz hervorgehoben wird.

### Behoben (Protokolle)

- Ein Sprung von der Startseite in eine Sitzung ging verloren, wenn die Sitzungen zweimal kurz hintereinander geladen
  wurden (React-Prüfmodus, „Erneut versuchen“): Jedes Laden merkt sich sein Ziel jetzt selbst.

### Intern (Protokolle)

- `statusText()` in `shared/protokolle/aufgaben.ts` ist die eine Stelle für „in Arbeit“ – vorher stand der Text an
  drei Stellen (Protokoll, Sitzung, Startseite) und wäre mit der Suche die vierte geworden.
