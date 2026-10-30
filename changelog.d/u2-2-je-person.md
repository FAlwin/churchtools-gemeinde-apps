### Neu (Anmeldungen, U2-2 – je Person)

- **Umschalter „Je Anmeldung / Je Person“** im Bereich „Anmeldungen“ – je Person eine Zeile mit Vor- und Nachname,
  Status (Platz oder Warteplatz), Alter, jeder Frage der Person, „Angemeldet von“, Anmelde-Nr. und Betrag/Bezahlt der
  Anmeldung. Die Spalten kommen aus dem Katalog der Druckliste (`teilnehmerSpalten`, Zellen über `teilnehmerZelle`).
  Die Reiter zählen dann Personen; ein Klick öffnet die Anmeldung der Person. Bei „Abgesagt“ gibt es keinen Umschalter
  (Absagen sind je Person).
- **Summen je Person** – Personen mit Platz (+ Warteliste), Fragen der Person nach ihrer Art, Alter in den Altersstufen
  der Preise (`altersregel`, dieselbe Regel wie die Rechnung). Betrag und Bezahlt zählen jede Anmeldung **einmal**, auch
  wenn sie bei jeder Person steht.
- Sortieren je Person und je Anmeldung über dieselbe Regel (`ordnen` in `tabelle.ts`).
