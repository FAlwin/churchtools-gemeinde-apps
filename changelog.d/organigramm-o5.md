### Neu (Organigramm, O5, #694)

- **Gruppen umhängen und anlegen** im Gruppenfenster – für alle, die es in ChurchTools dürfen (Gruppen-Admin, oder
  „Gruppe bearbeiten“ für die Gruppe bzw. ihren Typ; Anlegen nur in freigegebenen Typen). Leitungen dürfen das in
  ChurchTools nicht und sehen keine Knöpfe.
- Unter „Gehört zu“: **Ändern** (Obergruppe ersetzen), **Lösen** (bei der letzten wird die Gruppe ein eigener Bereich)
  und **＋ Weitere Obergruppe**; das Ziel kommt aus einer Liste mit Suche und Pfad („Gottesdienst › Technik“). Die Gruppe
  selbst, ihre Untergruppen (das wäre ein Kreis) und ihre jetzigen Obergruppen stehen nicht zur Wahl.
- Vor jeder Änderung sagt das Fenster, was sich an den Rechten ändert (Rechte wirken in ChurchTools nach unten).
- **＋ Untergruppe anlegen** mit Name und Gruppentyp (vorbelegt mit dem Typ der Obergruppe); Status „aktiv“ über den
  internen Namen aus `/person/masterdata`, nicht über eine feste Zahl.
- Umhängen schreibt erst die neue Obergruppe, dann löst es die alte – die Gruppe hängt nie unter keiner. „Bereits
  gesetzt“ (400) zählt als erledigt. **Nach jedem Schreiben wird nachgelesen**; stimmt der Stand nicht, sagt das
  Fenster genau das. Danach lädt der Baum neu (Mitglieder nur für neue Gruppen); lädt er gerade nicht, bleibt der
  bisherige Stand stehen und das Fenster sagt es.
- **Rückgängig im Fenster** für jede Änderung (auch: neue Gruppe wieder löschen).

### Intern (gemeinsam)

- „Rückgängig im Fenster“ (`RueckgaengigImFenster`) samt Ablauf (`useAenderungZurueck`) aus den Anmeldungen nach
  `ui/fenster/` gezogen – EINE Umsetzung für alle Erweiterungen; die Leiste unten bleibt in den Anmeldungen.
- `ladeMitglieder`: Nachladen bestimmter Gruppen an einer Stelle (`fehlendeNachladen`, neu `neueGruppenNachladen`).
