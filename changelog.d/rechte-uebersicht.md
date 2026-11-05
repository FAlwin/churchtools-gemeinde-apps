### Geändert (Musik-App)

- **Rechte-Übersicht neu aufgebaut** (`docs/betrieb/ERWEITERUNG.md`, „Rechte einrichten“): die drei Schritte beim
  Einrichten (als Admin in der Verwaltung eine Einstellung ändern und bei „Anmerkungen“ die Musikteam-Gruppe wählen –
  erst dann gibt es die Kategorien der App), eine Häkchen-Tabelle für die Rechte der Erweiterung (Nutzer, Musiker,
  Admin je Kategorie) und die übrigen Rechte als Vorschlag, den jede Gemeinde selbst anpasst. Neu darin: die
  Info-Spalten im Ablauf (`view servicegroup`).

### Intern

- **Prüfung `shared/ct/rechteDoku.test.ts`:** Jedes ChurchTools-Recht, das die Musik App auswertet, muss in der
  Rechte-Übersicht stehen – gefunden über die Erzeuger (`rechteAus`, `dienstgruppenSichtAus`), nicht über eine Liste.
