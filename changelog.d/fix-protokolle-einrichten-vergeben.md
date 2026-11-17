### Sicherheit (Protokolle)

- **Einrichten prüft die Merkliste der selbst vergebenen Rechte** (Security-Review vor `protokolle-v1.0.0`): Die Liste
  steht in der Kategorie „Protokolle · Gruppe“, die die Leitung beschreiben darf. Ein untergeschobener Eintrag konnte
  bisher dazu führen, dass ein Admin beim nächsten „Einrichten“ ungewollt Rechte entzieht – auch an Rollen anderer
  Gruppen. Jetzt zählen nur Zusatzrechte an Rollen dieser Gruppe (frisch aus ChurchTools), Kalenderrechte nur am alten
  oder neuen Kalender der Gruppe (`vergebenPruefen` in `shared/protokolle/einrichten.ts`). Die Gruppenrollen liest das
  Einrichten dafür selbst (eine Stelle `rollenLesen`, auch für das Fenster).
