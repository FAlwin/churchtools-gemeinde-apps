### Neu (Organigramm, O7-2, #719)

- **Reiter „Neue Gliederung“** – nur für Gruppen-Admins (Entwurf `o7-plan-v1`): **Plan anlegen** kopiert die heutige
  Gliederung; per Klick auf eine Gruppe im Plan umbenennen, woanders einhängen (Liste mit Suche, ohne Kreis), Untergruppe
  anlegen, archivieren oder eine neue Gruppe wieder herausnehmen, **Wie heute** nimmt alles zurück; **＋ Neuer Bereich**.
  Marken „neu“, „umgehängt“, „umbenannt“, „wird archiviert“ mit „vorher …“. ChurchTools selbst ändert sich nicht.
- Jede Änderung wird sofort gespeichert. Speichert ein anderer Admin gleichzeitig, wird **nichts überschrieben**: Der
  Hinweis nennt ihn, und **Nochmal auf dem neuen Stand** wendet die eigene Änderung auf seinen Stand an. Ebenso nach
  einer Zeitüberschreitung; bei fehlendem Recht auf die Kategorie sagt der Hinweis, welches Recht fehlt.
- **Plan verwerfen** (nach Rückfrage) löscht den Plan für alle.
- Eine Gruppe, die im Plan und in ChurchTools gegenläufig gehängt ist (Kreis), verschwindet nicht aus dem Plan.

### Intern (Organigramm)

- `shared/organigramm/plan.ts`: `planBaum`, `planUnterschied`, `planZiele` für die Ansicht; Demo (`?demo`) mit Speicher
  der Erweiterung, `?demo=konflikt` mit einem gleichzeitigen zweiten Admin.
