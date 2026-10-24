### Neu (Organigramm, O7-3, #719)

- **Umbau** im Reiter „Neue Gliederung“ (Umschalter „Plan | Umbau · N offen“): die Schritte vom Plan nach ChurchTools –
  neue Gruppen anlegen, umhängen, umbenennen, archivieren – mit Fortschritt. **Ausführen** ändert ChurchTools sofort
  und liest nach; danach **Rückgängig** für den letzten Schritt. **Alle offenen nacheinander ausführen** (nach
  Rückfrage) liest vor jedem Schritt neu, macht auch, was erst dadurch frei wird, und hält beim ersten Fehler an.
- **Archivieren wartet**, solange in ChurchTools noch Gruppen darunter hängen (Alwin, 24.10.2026). Archivieren setzt
  den Status „archiviert“ – Mitglieder und Historie bleiben.
- Erledigt ist, was ChurchTools schon so zeigt; eine neue Gruppe, die es dort schon gibt, lässt sich **im Plan
  übernehmen**. Vom Umbau angelegte Gruppen bleiben als erledigt in der Liste – ebenso ein Umbenennen, wenn die Gruppe
  danach archiviert wurde (gefunden in der Test-Instanz).

### Intern (Organigramm)

- Messung `organigramm-planung/docs/messung-o7-3-2026-10-24.md`: Umbenennen/Archivieren per `PATCH /groups/{id}`;
  archivierte Gruppen fehlen in `GET /groups` und in der Hierarchie (eigens über `group_status_ids[]`), ChurchTools
  nimmt auch einen leeren Namen an.
- `shared/organigramm/umbau.ts` (Schritt ausführen/zurücknehmen), `obergruppenGenau` und `archivStatus` in
  `struktur.ts`, Anlegen ohne Obergruppe; `umbauSchritte` mit archivierten Gruppen als eigener Liste; der Nachbau von
  ChurchTools für Tests liegt jetzt an einer Stelle (`struktur.testutil.ts`); `ladeGruppenbaum` für Start und Umbau.
