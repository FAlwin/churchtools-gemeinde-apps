### Neu (Dienstplaner, E7-1 – Alwin, 03.11.2026)

- **Anfragen beantworten:** Auf der Startseite unter „Für dich offen“ und im Reiter „Dienste → Meine“ stehen an jeder
  offenen Anfrage **Zusagen** und **Absagen** (Entwurf `e7-anfragen.html`, Variante A) – zusätzlich zur
  ChurchTools-App, mit denselben Wörtern. Absagen fragt nach einem freiwilligen **Grund**, den sieht, wer den Dienst
  plant. Ab zwei offenen Anfragen gibt es **„Alle zusagen“**. Nach dem Antworten bleibt die Zeile zehn Minuten lang mit
  **„Rückgängig“** stehen – so lange lässt ChurchTools es zu. Erlaubt ein Dienst kein Absagen, steht statt des Knopfs
  „Absagen geht hier nicht – bitte sprich mit dem Planer.“ Hat sich eine Anfrage inzwischen geändert (zurückgezogen,
  neu vergeben), wird nichts überschrieben: ein Hinweis, und die Liste lädt neu. Absagen und Rückgängig gehen auch
  ohne Recht auf den Dienst – wer ihn nicht plant, sieht den freien Platz nach der Absage gar nicht mehr (beim Prüfen
  als Nicht-Admin aufgefallen: Die Absage kam an, die Meldung sagte aber „gibt es nicht mehr“). Testfall TF-ABLAUF-20.

### Geändert (Dienstplaner)

- Die eigenen Dienste eines Termins stehen auf der Startseite und unter „Dienste“ in der Reihenfolge der Gemeinde (wie
  die Zeilen der Matrix), nicht mehr in der von ChurchTools – dort springt ein Dienst nach jeder Antwort nach hinten
  (beim Prüfen in der Test-Instanz aufgefallen).

### Intern (Dienstplaner)

- Der Schreibkern des Einteilens (`platzEinteilen`) ist jetzt ein Fall von `platzAendern` (frisch lesen, Konflikt statt
  Überschreiben, schreiben, nachlesen); Zusagen, Absagen und Rückgängig (`@shared/dienstplan/antworten`) benutzen
  dieselbe Regel. Gemessen 03.11.2026 als Nicht-Admin (`dienstplaner-planung/docs/messung-e7.md`).
