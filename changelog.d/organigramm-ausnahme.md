### Neu (Organigramm)

- **Organigramm: „Bleibt noch ein Jahr“ – Ausnahme im Gruppenwechsel setzen** (Bauplan O9-3). Im Fenster eines Kindes
  im Reiter „Kinder & Jugend“ gibt es den Schalter **„Bleibt noch ein Jahr in …“**. Er speichert sofort, liest danach
  nach, und **„Rückgängig“** steht im Fenster selbst.
  - **Wer es darf, entscheidet das Recht an der Wechsel-Gruppe in ChurchTools**, nicht die Rolle in der App: Ist das
    Kind dort schon Mitglied, braucht man das Recht, den Status zu ändern (Leitungen ab der Ankündigung); sonst das
    Recht, Personen aufzunehmen – Bereichsleitung und Admins können eine Ausnahme deshalb schon **vor** der
    Ankündigung eintragen (das Kind wird gleich als „zu löschen“ aufgenommen). Fehlt das Recht, steht statt des
    Schalters ein Hinweis, z. B. „Eine Ausnahme kannst du ab dem … eintragen.“
  - **Ab dem Wechseltag** gibt es keinen Schalter mehr – dann käme die Ausnahme zu spät.
  - **Ausnahme vom letzten Jahr:** Wurde der Status vor dem Wechseltag des Vorjahres gesetzt, steht
    das Kind mit gelbem Chip „Ausnahme vom letzten Jahr“ da, die Gruppenseite weist darauf hin, und das Fenster sagt,
    wann das Kind wechselt, wenn man die Ausnahme aufhebt.
  - **Fehler:** Abgemeldet → wie überall auf der Seite; fehlendes Recht oder „ChurchTools hat es nicht übernommen“ →
    genau diese Meldung im Fenster; Netz oder Serverfehler → „Gerade nicht gespeichert“, der Stand bleibt, nichts wird
    von selbst wiederholt.

### Intern (Organigramm)

- **Organigramm:** Neue Regeln für Ausnahme setzen, aufheben und „Rückgängig“ in `shared/organigramm/mitgliedschaft.ts`
  (Nachlesen prüft den **Status**); `GruppenRechte.statusAendern` (`+edit groupmemberstatus`);
  `ausnahmeStand` und `ausnahmeVomVorjahr` in `gruppenwechselSicht.ts`. Der Reiter holt die Rechte an den
  Wechsel-Gruppen mit; lassen sie sich nicht lesen, gibt es dort keinen Schalter, die Listen bleiben.
