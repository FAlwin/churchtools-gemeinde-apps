### Neu (Organigramm, O7-1, #719)

- **Plan-Kern für die „neue Gliederung“** (noch ohne Oberfläche): Der Plan speichert nur die **Änderungen gegenüber
  heute** – neue Gruppen, Umhängen, Umbenennen, Archivieren. „Plan anlegen“ ist damit eine Kopie von heute, und später
  direkt in ChurchTools angelegte Gruppen erscheinen von selbst im Plan (`shared/organigramm/plan.ts`).
- **Umbau-Schritte** aus dem Unterschied zu heute, in der Reihenfolge neu anlegen → umhängen → umbenennen → archivieren;
  „wartet auf …“, wenn etwas in eine noch nicht angelegte Gruppe soll; **erledigt**, sobald ChurchTools so aussieht wie
  der Plan (auch wenn es jemand direkt dort gemacht hat; eine neue Gruppe gilt als angelegt bei gleichem Namen unter
  derselben Obergruppe).
- Gespeichert als **ein Wert in der Kategorie „Plan“** mit Versionsnummer: Hat ein anderer Admin inzwischen gespeichert,
  wird nichts überschrieben (Konflikt); nach dem Schreiben wird nachgelesen. Gespeicherter Inhalt wird geprüft – kaputte
  Teile fallen weg, statt die Seite zu brechen.

### Intern (gemeinsam)

- Neuer Baustein `shared/ct/versionierterWert.ts`: ein Dokument im Speicher der Erweiterung mit Version, Konflikt und
  Nachlesen – nach dem Vorbild der Dienstplaner-Entwürfe. `ui/ct/modulPort.ts`: `versionPortFuer` (der Dienstplaner
  nutzt denselben Anschluss weiter als `entwurfPortFuer`).
- `untergruppenVon` (Organigramm) arbeitet mit beliebigen Schlüsseln – der Plan kennt neben ChurchTools-IDs eigene für
  neue Gruppen.
