### Neu (Musik-App + Dienstplaner)

- **„Als Vorlage …“ im Ablauf eines Termins** (E10): Im Bearbeiten-Modus steht rechts in der Hinweiszeile – links neben „Neu aufsetzen …“ –
  der Link **„Als Vorlage …“** (nur, wer im Kalender des Termins Ablaufvorlagen bearbeiten darf). Ein Fenster, zwei Wege: den Ablauf als
  **neue Vorlage** speichern (Name vom Termin vorbelegt, Kalender wählbar) oder eine **vorhandene Vorlage ersetzen** (roter Hinweis mit den
  Zahlen, roter Knopf). Übernommen werden alle Einträge mit Dauer, Notiz, Infos je Dienstgruppe, Liedern und Platzhaltern wie „[Moderation]“ –
  keine Namen von Personen. Hat inzwischen jemand die Vorlage geändert, wird nichts überschrieben. In der Musik-App sieht „Ablauf anlegen“
  die neue Vorlage sofort; die Einführung zum Bearbeiten nennt den Link (`setlist-edit-v7`).

### Intern (Musik-App)

- **Server:** neue Routen `POST /api/services/:eventId/agenda/als-vorlage` und `PUT /api/ablauf-vorlagen/:vorlageId/aus-termin/:eventId`
  (Kern: `ablaufAlsVorlage`, `vorlageErsetzen`); Erweiterung und Server nehmen denselben Weg über die Weiche. Baustein `AlsVorlageFenster` /
  `useAlsVorlage` in `ui/ablauf/`, `VorlagenEintrag.modifiedDate` trägt den Stempel für den Vergleich.
