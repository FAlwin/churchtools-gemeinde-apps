### Neu (Protokolle, K2b-Folgepunkte)

- **„Bearbeiten“ auch im Editor** (Alwin 29.10.2026): Ein Protokoll im Entwurf hat oben denselben Knopf wie die
  Sitzungsansicht – Zeit, Titel, Eingeladene der eigenen Sitzung ändern oder sie absagen. Danach zeigt der Kopf des
  Editors gleich den neuen Stand; der Text im Editor bleibt, wie er ist.

### Behoben

- Sitzungen mehr als 180 Tage voraus kamen ohne Einladungen und Zusagen in den Kasten „Nächste Sitzung“ und auf die
  Startseite – die Liste fragt den Kalender nur so weit. Für geplante und begonnene Protokolle mit Termin dahinter liest
  sie Termin und Einladungen jetzt gezielt nach (bemerkt beim Prüfen von K2b).

### Intern

- Termin und Besprechungsanfragen werden an einer Stelle gelesen (`protokolle/src/termin.ts`) – vorher las die Liste,
  das Festlegen und das Bearbeiten sie je selbst. Die Zeit einer Sitzung aus dem Termin (bei Serien: Beginn der Sitzung,
  Dauer vom Termin) ist `zeitAusTermin`. Der Test-Nachbau beachtet jetzt den gefragten Zeitraum des Kalenders.
