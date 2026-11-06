### Intern

- **`useLaden` auch in den Anmeldungen** (#845, Scheibe 3d): Anmeldelink, QR-Code, Mails, „Mails und Löschen
  einrichten“, Druckliste, Termin (Kalender und Termine), Baukasten (Gemeindelogo, Antworten eines Felds),
  Logo-Auswahl, „Neue Veranstaltung“, „Einstellungen der Gemeinde“ und „Freigeben“ laden über den gemeinsamen Hook
  statt über zwölf eigene Ladeblöcke. Was im Fenster geändert wird (Leitung, Vorgaben, Adresse, Zahlarten, die frühere
  Veranstaltung), liegt jetzt über dem Geladenen, statt es nach dem Laden umzukopieren. Der Wächter gegen Ladeblöcke
  von Hand gilt jetzt auch für die Anmeldungen.
- Neue Tests für die Fehlerzweige, die bisher ungeprüft waren (Leitung, Kalender, Termine, QR-Code, Druckliste,
  Mails, Gemeinde, Logos, frühere Veranstaltungen), und für Vorwahlen: die erste frühere Veranstaltung, ein anderes
  Team fängt neu an, wer schon Leitung ist, bleibt gewählt; die Termine stehen sortiert; ein entferntes Logo
  verschwindet ohne Neuladen; „Heruntergeladen“ gilt nur für das heruntergeladene PDF.
