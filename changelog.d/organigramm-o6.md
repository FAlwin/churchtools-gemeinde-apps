### Neu (Organigramm, O6, #709)

- **Leitung und Mitglieder pflegen** im Gruppenfenster – für alle, die es in ChurchTools dürfen: global (Gruppen-Admin,
  „Mitgliedschaften bearbeiten“ für die Gruppe oder ihren Typ) ODER mit der eigenen Rolle in der Gruppe
  (`/permissions/internal/groups/{id}`). Gemessen: Leitungen dürfen aufnehmen und Rollen ändern, aber nicht austragen –
  dann fehlt bei ihnen „Austragen“.
- **＋ Person aufnehmen**: Suche wie bei den Anmeldungen (nur bestehende Personen), „schon dabei“ gesperrt, Rolle =
  Standardrolle des Gruppentyps, wählbar.
- An jeder Person **Rolle** (nur Rollen des Gruppentyps, ohne versteckte; bei einer Leitungsrolle ein Hinweis auf die
  Rechte) und **Austragen** = Mitgliedschaft **beenden** (Enddatum heute), nicht löschen – die Historie in ChurchTools
  bleibt (Alwin, 23.10.2026).
- Nach jedem Schreiben wird nachgelesen; danach lädt nur diese Gruppe neu. **Rückgängig im Fenster**: Aufnehmen wird
  gelöscht (war die Person nie dabei) bzw. der alte Stand zurückgesetzt, Rolle zurück, Enddatum wieder leer.
- Rechte je Gruppe nicht ladbar → Knöpfe bleiben zu, ein Hinweis sagt es.

### Intern (gemeinsam)

- Personensuche (`personenSuchen`, `personenRoh`) aus den Anmeldungen nach `ui/ct/personen.ts` gezogen – EINE Suche für
  alle Erweiterungen; die Anmeldungen leiten weiter, ihre Oberfläche bleibt gleich.
- Rollen tragen jetzt Gruppentyp, Standard und versteckt (`rollenFuerTyp`, `standardRolle`).
