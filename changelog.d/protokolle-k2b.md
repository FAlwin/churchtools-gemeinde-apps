### Neu (Protokolle, K2b-1)

- **Sitzung bearbeiten** (Alwin 29.10.2026): Die Leitung ändert eine Sitzung über „Bearbeiten“ in der Sitzungsansicht
  oder „Ändern“ im Kasten „Nächste Sitzung“ – Titel, Datum, Uhrzeit, Dauer und wer eingeladen ist. Termin,
  Gruppentreffen und Protokoll ziehen mit. Das Fenster sagt vor dem Speichern, wer welche Mail bekommt (gemessen
  29.10.2026, `messung-k2b-2026-10-29.md`):
  - neue Zeit: **„Alle neu einladen“** (vorgewählt) – ChurchTools schickt „Termin geändert“ und setzt die Zusagen
    zurück; abgewählt wird still verschoben, die Zusagen bleiben;
  - nur der Titel: still; einladen: „Neue Besprechungsanfrage“; ausladen: „Termin gelöscht“ an die Person.
- **Sitzung absagen**: Termin und Gruppentreffen werden gelöscht (Mail „Termin gelöscht“ an die Eingeladenen); ein nur
  geplantes Protokoll verschwindet, ein begonnenes bleibt als Entwurf ohne Termin.
- Serientermine und Termine mit Anmeldung ändert das Fenster noch nicht – es sagt das (Serien folgen mit K2b-2).
- Das Fenster liest Zeit, Dauer und Eingeladene beim Öffnen frisch vom Termin – auch für Sitzungen mehr als 180 Tage
  voraus (die Liste liest nur so weit) und wenn inzwischen jemand zugesagt hat.

### Intern

- Ein Termin-`PUT` leert, was fehlt (Beschreibung, Ort, Link; beim Gruppentreffen der Kommentar) – der gelesene Termin
  geht unverändert zurück, nur Titel und Zeit sind neu (Rundreise gemessen).
- Titel/Datum/Uhrzeit/Dauer und die Einladeliste als ein Baustein `Planungsfelder` für „Neue Sitzung“, „Neues
  Protokoll“ und „Sitzung bearbeiten“; `abgelehnt` aus `planen.ts` gemeinsam genutzt.
