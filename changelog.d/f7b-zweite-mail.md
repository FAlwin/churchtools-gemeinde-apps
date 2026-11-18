### Intern

- **Anmeldungen: Zweite Mail** (Etappe F, Scheibe F7b; veröffentlicht wird erst nach Etappe F). Entwurf
  `f7-mails-v1`, Klick-Runde 11 und Entscheidungen vom 18.11.2026, Messung M3 (Warten mit Dauer).
  - Fenster „Mails“, neuer Reiter **„Zweite Mail“**: Schalter, Zeitpunkt (gleich nach der Bestätigung, X Tage nach der
    Anmeldung oder an einem Tag), Betreff und Text mit „Antwort einfügen“ (wie in der Bestätigung). Darunter der Gruß.
    Geht an jede Person mit Platz; wer nachrückt, bekommt sie dann. Schon Angemeldete bekommen sie nicht (Hinweis:
    dafür die Rundmail). Die Karte „Mails“ nennt sie („Zweite Mail: ✓ 3 Tage nach der Anmeldung“).
  - Gespeichert: Betreff und Text in der Beschreibung des Ablaufs „Warteliste“ (mit deren Text höchstens 1.000
    Zeichen, Zähler), das „Wann“ in der von „Platz“ – dort stehen ihre Schritte, beides im selben Aufruf geschrieben.
    Geschrieben wird erst „Warteliste“, dann „Platz“: Scheitert das Zweite, gibt es höchstens Text ohne Mail.
  - Schritte: „sofort“ und „X Tage“ (Warten mit `duration`) direkt nach der Bestätigung, ein Tag nach Datum zwischen
    den Erinnerungen. Ein Tag am Löschdatum oder danach wird abgelehnt. Nummern bleiben nur, wenn sie an derselben
    Stelle bleibt; sonst kommen die alten Schritte über „bis heute“ (Mail aus) weg – wer dort wartet, läuft ohne die
    zweite Mail weiter (gemessen M3). Das gilt jetzt allgemein für wegfallende Warte-Schritte
    (`wegfallendeWarten`/`durchlassSchritte`, vorher nur für Erinnerungen).
  - Nachstarten: „sofort“ ist dabei aus wie die Bestätigung; mit Warten bleibt sie an (neue Anmeldungen, die dort
    warten, sollen sie bekommen – Neugestartete, die dort hängen bleiben, dann auch; Alwin: so lassen). Wer an einer
    Erinnerung wartet, wird ihretwegen nicht neu gestartet.
  - Abgleich und Nachlesen vergleichen sie mit; eine Kopie übernimmt sie von der Vorlage – mit Datum nicht.
  - „Antwort einfügen“ ist jetzt ein eigener Baustein (`AntwortKnoepfe`) für Bestätigung und zweite Mail.
  - Die vier Reiter des Fensters brechen am Handy zwei mal zwei um (vorher wäre „Zweite Mail“ abgeschnitten).
