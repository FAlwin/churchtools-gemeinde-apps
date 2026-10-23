### Neu (Protokolle, S3-3)

- **Startseite** (Entwurf 7): links **„Heute“** – steht heute eine Sitzung an, mit Uhrzeit, „2 von 3 zugesagt“ und
  „Sitzung öffnen“ – und **„Meine offenen To-Dos“** über alle Gruppen (mir zugewiesen, nicht erledigt; überfällig
  zuerst und rot, dann in Arbeit, dann offen). Rechts **„Nächste Sitzungen“** über alle Gruppen, früheste zuerst, mit
  der eigenen Antwort auf die Besprechungsanfrage („du hast zugesagt“, „noch nicht beantwortet“), und **„Deine
  Gruppen“** mit der Zahl offener To-Dos. Am Handy eine Spalte.
- **Von der Startseite in die Sitzung:** Ein Tipp auf eine Sitzung oder ein To-Do öffnet den Reiter „Sitzungen“ mit
  der Gruppe und gleich der Sitzung; ein Tipp auf eine Gruppe öffnet ihre Liste. Wer danach über die Reiter wechselt,
  landet wieder in der normalen Liste.
- Scheitert das Laden der Übersicht vorübergehend, gibt es „Erneut versuchen“ – nicht „Nichts offen“.

### Intern (Protokolle)

- `offene()` in `shared/protokolle/aufgaben.ts` ist die eine Regel für „offen“ (nicht erledigt, nicht gelöscht);
  „Meine offenen“ und der Zähler je Gruppe nutzen sie. Die Antworten der Besprechungsanfragen (`accepted`,
  `declined`, `pending`, `tentative` laut OpenAPI der Instanz) liest der Lese-Kern jetzt mit (`ladeUebersicht`).
