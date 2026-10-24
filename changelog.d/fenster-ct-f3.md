### Geändert (Musik-App, E6-O F3)

- **Alle Fenster der Musik-App im ChurchTools-Aufbau** (#726): Titel links, **X rechts**, Knöpfe **rechts unten**, am
  Handy untereinander mit dem Hauptknopf oben. Betroffen sind 24 Fenster: Kapo, Tonart, Akkord, Abschnitte
  transponieren, Abwesenheit, Teil eines Zeitraums, PDF teilen, Notizen von …, Zum Ablauf hinzufügen, Dateien, Neues
  Lied, Lied bearbeiten, Arrangement, „Lied gibt es schon“ und alle Fenster der Verwaltung.
- **„Speichern“ steht unten** – auch bei „Lied bearbeiten“ und „Arrangement“, wo es vorher mitten im Fenster stand.
  „Zum Standard machen“ und „Löschen …“ bleiben getrennt im Inhalt.
- **Zwei Wege unten nebeneinander:** PDF „Herunterladen“ / „Teilen“, Zeitraum „löschen“ (rot) / „anpassen“, „Lied gibt
  es schon“: „Trotzdem neu anlegen“ / „… verwenden“.
- **Nach „Lied angelegt“** stehen alle nächsten Schritte unten: Fertig · Noch ein Lied · Notenblatt · Lied öffnen bzw.
  Zurück zum Eintrag.
- Speichern-Knöpfe zeigen „Wird gespeichert …“ statt eines Kreisels.

### Geändert (alle Apps, E6-O F3)

- **Passen die Knöpfe unten nicht nebeneinander, stehen sie untereinander** – auch am Rechner, der Hauptknopf oben
  (Alwin). Vorher rutschte bei drei langen Knöpfen der Hauptknopf allein in eine zweite Zeile. Gilt für alle Fenster
  und Bestätigungen, z. B. auch den Zauberstab im Dienstplaner bei vielen Vorschlägen.

### Intern (E6-O F3)

- „Links verwalten“, „Termin-Arten“ und „Termine ohne Ablauf“ zeichnen ihr Fenster selbst, damit „Speichern“ in die
  Fußzeile kann.
- Neuer Dauer-Test `ui/fenster/fensterAufbau.test.ts`: In umgezogenen Apps fällt jedes Fenster ohne `knoepfe` auf; die
  Liste der noch nicht umgezogenen Apps (Anmeldungen, Organigramm, Protokolle) muss ehrlich bleiben.
- `FensterKnopf` kann ein Symbol neben der Beschriftung zeigen. Neuer Hook `ui/fenster/useKnopfZeile` (misst die
  Knopfzeile, `data-stapel`/`data-messen` im Mixin `fensterKnopfZeile`). Entfernt: `TeilenFenster.module.scss` und die
  nachgebauten Hauptknöpfe (`.orgSave`, `.save`, `.primaryWide` u. a.).
