### Neu (Anmeldungen, A9-1)

- **Bestätigungsmails über ChurchTools** – beim Freigeben richtet die Erweiterung zwei Abläufe (Routinen) ein: „Platz“
  schickt nach dem Anmelden und beim Nachrücken eine Bestätigung mit Termin, Anmelde-Nr., Betrag, Bankdaten und dem
  Link zu „Deine Anmeldung“; „Warteliste“ nennt den Platz auf der Warteliste. Die Standard-Mail von ChurchTools geht
  danach aus. Absender ist, wer freigibt (wenn Leitung), sonst die erste gewählte Leitung. Gemessen 24.10.2026
  (`messung-a9-2026-10-24.md`), Entwurf `a9-ablaeufe-v1`.
- Betrag und Bankdaten stehen nur in der Mail zur ersten Person einer Anmeldung (dort liegt der Betrag), die Anrede an
  den Kontakt ebenso; Anmeldungen durchs Team bekommen die Bestätigung auch – ohne Link (Alwin, 24.10.2026).
- Neues Systemfeld **„Link zur Anmeldung“**: Das Formular schreibt beim Anmelden den Link mit dem Schlüssel der Person
  hinein (`abmeldeLink`) – die Routine-Mail kennt keinen Platzhalter für den Abmelde-Schlüssel.
- Karte **„Mails“** im Reiter „Veranstaltung“ (nur ansehen): eingerichtet, noch nicht eingerichtet (Standard-Mail), im
  Entwurf „wird beim Freigeben eingerichtet“.
- Fehlt das Recht „Routinen verwalten“, wird trotzdem freigegeben; die Meldung sagt, dass ChurchTools seine
  Standard-Mail schickt. Eine eigene Routine aus ChurchTools an derselben Stelle fasst die Erweiterung nicht an.
- „Rückgängig“ nach dem Absagen sagt jetzt, dass ChurchTools beim Wiedereintragen die Bestätigung noch einmal schickt;
  nach dem Rückgängigmachen verschwindet der Satz.
- Die Fenster „Nachrücken“, „Von Hand“ und „Zurückholen“ sagen, was ChurchTools schickt – mit eingerichteten Mails die
  Bestätigung, sonst wie bisher (`mailHinweis`, eine Stelle). Gefunden bei der echten Prüfung in der Test-Instanz.

### Intern (Anmeldungen, A9-1)

- `shared/anmeldung/ablaeufe.ts` baut die Mails (eine Stelle), `anmeldungen/src/ablaeufe.ts` schreibt und liest nach.
- Bankdaten-Zeilen an einer Stelle (`bankZeilen`) – Bescheid nach dem Nachrücken, Rundmail und Bestätigung nutzen
  dieselbe; `htmlSicher` aus der Rundmail für alle.
