### Behoben (Organigramm)

- **Organigramm: Der Gruppenwechsel trägt nur noch Kinder aus, keine Leitungen** (Bauplan O9-6-1). Die Austrag-Regel der
  alten Gruppe fragte nur, wer in der neuen Gruppe aktiver Teilnehmer ist – eine **Leitung der alten Gruppe**, die in der
  neuen Gruppe Teilnehmer, Coach o. Ä. ist (z. B. Teeny-Leitung bei „Jugend ab 16“), wäre beim nächsten Tageslauf still
  ausgetragen worden. Jetzt muss die Person in der alten Gruppe **Teilnehmer** sein. Live war noch nichts eingerichtet,
  und an keinem Übergang gab es so eine Überschneidung.
  - Technisch: ChurchQuery-Operator `person--group` (nicht dokumentiert, in der Test-Instanz gemessen): Er prüft eine
    andere Mitgliedschaft derselben Person mit eigener Rolle und eigenem Status.
  - Die Seite „Einrichtung“ meldet eine ältere Austrag-Regel als ⚠ „veraltet“; „Stufen ändern → Änderungen schreiben“
    erneuert sie.
