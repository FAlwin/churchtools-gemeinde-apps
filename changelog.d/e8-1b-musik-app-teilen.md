### Neu (Musik-App)

- **Termin-Blatt teilen** (Bauplan E8-1b, Entwurf `e8-teilen.html`): Oben im Teilen-Fenster des Ablaufs wählt man
  „Liedblätter | Termin-Blatt“. Das Termin-Blatt ist dasselbe wie im Dienstplaner – Dienste je Gruppe, Ablauf mit
  Beginn und Ende, Infos, Unterseiten zum Wählen, Vorschau. Ein Ablauf ohne Lieder lässt sich jetzt auch teilen: „Teilen“
  öffnet dann gleich das Termin-Blatt.
- In ChurchTools stehen oben die **Dienste des Termins** (wer eingeteilt ist, angefragt, frei). Auf dem eigenen Server
  kommt das Blatt ohne Dienste – die Zeile „Dienste“ sagt es.

### Geändert (Dienstplaner)

- **„Musik-App“ über dem Ablauf** sieht jetzt aus wie die Knöpfe daneben (Rahmen, Symbol, Beschriftung; am Handy nur
  das Symbol) statt als blauer Text – neuer gemeinsamer Baustein `KopfLink`.

### Intern

- Die Dienste eines Termins mit derselben Plan-Regel wie im Dienstplaner (`shared/dienstplan/terminBlattDienste.ts`,
  vorher `dienstplaner/src/`): nur Dienste, deren Plätze ChurchTools vollständig liefert – ohne den Weg über geleitete
  Gruppen (die Musik-App liest sie nicht), im Zweifel fehlt ein Dienst, statt unvollständig dazustehen.
- `TeilenFenster` und `TerminTeilenFenster` haben einen Kopf (die Wahl) und blenden beim Umschalten nicht neu ein;
  `TerminTeilenFenster` sagt in der Zeile „Dienste“, wenn es keine gibt oder sie nicht zu haben sind.
