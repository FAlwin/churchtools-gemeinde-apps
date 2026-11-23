### Neu (Website)

- **Mails im Freigabe-Weg (W3b-3):** Wer **eine Seite zur Prüfung einreicht** oder **das Löschen anfragt**, benachrichtigt damit die **Leitung** der
  Website-Gruppe per Mail; wer **zurückgibt** (mit Anmerkung) oder **freigibt**, benachrichtigt die Person, die **eingereicht** hatte. Bei „Alles
  freigeben“ bekommt jede Person **eine** Mail mit allen ihren Seiten. **Nie an sich selbst**; ist niemand übrig, gibt es weder Mail noch Fehler.
  Der Text ist kurz mit Link (wer, welche Seite, beim Zurückgeben die Anmerkung).
- **Die Mail kommt erst, wenn die Handlung nachgelesen ist, und ändert nie ihr Ergebnis:** Scheitert die Handlung, geht keine Mail; scheitert die
  Mail, gilt die Handlung trotzdem. Ein kurzer Hinweis sagt, was geschah – **gesendet**, **nicht verschickt** (mit Grund) oder **unklar** (dann
  nicht noch einmal einreichen; nichts wird automatisch wiederholt).
- **Schalter „Mails im Freigabe-Weg“** im Fenster „Einstellungen“ (Leitung und Admin): wirkt **sofort**, als eigener Wert – nicht in den
  Einstellungen, die erst über „Freigeben“ online gehen. Ohne Wert sind die Mails an.
- **Wer die Leitung ist,** hält der Admin fest, wenn er die Stufen setzt („Wer darf was“ und beim Einrichten): Ein Redakteur kann die Rechte
  nicht lesen, muss aber wissen, wen er benachrichtigt. Bestehende Einrichtungen nutzen die Vorbelegung (Rollen mit Leiter-Kennzeichen), bis
  „Rechte setzen“ einmal gedrückt wurde.

### Intern (Anmeldungen + Website)

- **Ein gemeinsamer Sende-Baustein für Mails über ChurchTools** (`ui/ct/mailSenden.ts`): Das Senden (`sendEMailToPersonIds`), das Nachlesen im
  Protokoll und „unklar, ob verschickt“ stand im Anmelde-Tool (`rundmail.ts`) und wird nun auch von der Website genutzt. Das Anmelde-Tool
  verhält sich unverändert (gleiche Meldungen, gleiche Zweige). Die Adresse des Empfängers ist freiwillig; ohne jede Adresse lässt sich nichts
  im Protokoll nachprüfen.
