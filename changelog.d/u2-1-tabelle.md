### Geändert (Anmeldungen, U2-1 – Tabelle)

- **Die Liste ist eine Tabelle** (Entwurf `u2-tabelle-v1`, abgenommen 29.10.2026) – eine Zeile je Anmeldung mit Name,
  Nr., Personen, jeder Frage der Anmeldung als Spalte, Betrag, Bezahlt und Anmeldetag. Kopf und Summenzeile bleiben beim
  Scrollen stehen, der Name links. Ein Tipp auf eine Überschrift sortiert (auf, ab, zurück zum Anmeldetag). Die
  Summenzeile zählt Anmeldungen, Personen mit Platz, Beträge (gesamt, offen, eingegangen – wie die Kacheln) und jede Frage
  nach ihrer Art (Zahl: Summe, Ja/Nein: Anzahl Ja, Auswahl: je Antwort, Text: ausgefüllt). Die Fragen kommen aus
  demselben Katalog wie die Spalten der Druckliste (`fragen`, `frageAntwort` in `druckliste.ts`), gerechnet wird in
  `shared/anmeldung/tabelle.ts`.
- **Reiter statt Filter-Chips**, mit der Zahl ihrer Zeilen; die Warteliste zeigt Anmeldungen mit Spalte „Warteplatz“,
  „Abgesagt“ eine Tabelle der Absagen (mit „Zurückholen“, wer ändern darf). `ReiterLeiste` kann dafür eine Anzahl
  hinter dem Text und einen eigenen Namen für Vorleser.
- **Leiste im ChurchTools-Stil** – eckige Suche (Name oder Nr.) in Knopfhöhe; am Handy zeigen Druckliste und Rundmail
  nur ihr Zeichen, damit „＋ Von Hand“ nicht mehr umbricht (Fund U1).
- **„Platz frei – jemand wartet“ nur noch zweimal** – in der Kachel „Warteliste“ und im Reiter „Warteliste“ (mit
  „… nachrücken lassen“). Über der Liste und in der Nachprüfung fällt er weg; die Nachprüfung zählt ihn nicht mehr als
  Hinweis.
