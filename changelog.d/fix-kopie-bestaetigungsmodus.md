### Behoben (Anmeldungen)

- **Kopie einer älteren Veranstaltung nahm keine Anmeldungen an** – „Wie eine frühere Veranstaltung“ übernahm den
  Bestätigungsmodus der Vorlage. Stand der auf „alle bestätigen“ (ältere Veranstaltungen), scheiterte das Formular schon
  beim ersten Schritt mit „PersonId or eMail must be present“. Der Modus „Unbekannte ohne Bestätigungsmail“ wird jetzt
  beim Anlegen, beim Kopieren und beim Freigeben gesetzt – eine Stelle (`ohneBestaetigungsmail`), jedes Mal
  nachgelesen. Das Freigeben repariert damit auch Kopien, die schon so entstanden sind. Gefunden bei der echten Prüfung
  von A9-1 (24.10.2026).
