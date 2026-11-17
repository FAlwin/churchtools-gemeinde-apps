### Intern

- **Anmeldungen: „Mehrere Antworten“ als echtes Auswahlfeld in ChurchTools** (Etappe F, Scheibe F5c; veröffentlicht
  wird erst nach Etappe F). Gemessen auf der Test-Instanz am 17.11.2026 (`messung-f5c-2026-11-17.md`):
  - Neue Fragen „Mehrere Antworten“ werden in ChurchTools ein `multiselect` mit den Antworten als Optionen (vorher eine
    Text-Spalte „A, B“). Umbenannte Antworten behalten ihre Nummer, die Wahl bleibt; eine schon gewählte entfernte
    Antwort bleibt verborgen stehen – wie bei den anderen Auswahlfragen. **Vorhandene Text-Spalten bleiben Text.**
  - Geschrieben wird die Liste der Options-Nummern (Formular und von Hand); zurück kommt sie als Liste und wird zu
    „A, B“ – Tabelle, Summe, Druckliste, Nachprüfung und „Person dazu“ lesen beides gleich.
  - Die EINE Stelle für Rohwerte aus ChurchTools (`shared/anmeldung/feldwert.ts`): Liste, Antworten zählen,
    Übergabe und „Rückgängig“ bei einer Absage, Nachprüfen nach dem Schreiben. Vorher hätten diese Stellen eine
    Mehrfachauswahl als leer gelesen – die Übergabe hätte sie gelöscht.
  - Zurückholen einer Abgesagten: Die Mehrfachauswahl aus dem Verlauf („Küche, Programm“) kommt wieder als Liste der
    Nummern zurück; nicht mehr bekannte Antworten werden genannt.
