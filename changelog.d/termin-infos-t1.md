### Neu (Dienstplaner, T1 – Alwin, 02.11.2026)

- **„Weitere Infos“ am Termin** – das „i“ aus der Dienstplan-Liste von ChurchTools (Entwurf `termin-einstellungen.html`,
  Variante B). Unter Datum und Uhrzeit steht der Anfang in einer Zeile, oben im Kopf ein ⓘ; beides öffnet das Fenster
  mit dem ganzen Text. Wer den Termin ändern darf (Admin, „Events bearbeiten“ für den Kalender oder Admin des Termins –
  gemessen), bearbeitet ihn dort: Textfeld mit Zähler, höchstens 4000 Zeichen wie ChurchTools. Dasselbe Feld wie
  „Weitere Infos“ in ChurchTools.
  - **Eine Absage bleibt bestehen:** ChurchTools setzt einen abgesagten Termin beim Speichern ohne diese Angabe wieder
    auf „findet statt“ (gemessen). Der Dienstplaner liest sie vorher frisch und schickt sie mit.
  - Hat jemand die Infos inzwischen anders gespeichert, wird nicht überschrieben: Das Fenster zeigt den Text aus
    ChurchTools und bietet „Ihre übernehmen“ oder „Meine speichern“.
  - Nach dem Speichern wird nachgelesen; kam es nicht an, steht „ChurchTools hat die Infos nicht übernommen“ da.
  - Testfall TF-ABLAUF-16.

### Intern (Dienstplaner)

- `DienstRechte.terminKalender` (`edit events`), `PlanSpalte.infos`, `darfTerminAendern` (derselbe Aufbau wie beim
  Ablauf, über `darfAblaufBearbeiten`). Demo: Termin 101 hat Infos, der Planer darf sie ändern.
