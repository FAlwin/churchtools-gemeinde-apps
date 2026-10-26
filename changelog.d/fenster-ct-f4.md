### Geändert (Anmeldungen, E6-O F4)

- **Alle Fenster der Anmeldungen im ChurchTools-Aufbau** (#734): Titel links, **X rechts**, Knöpfe **rechts unten**,
  am Handy – und wenn sie nicht nebeneinander passen – untereinander mit dem Hauptknopf oben. Betroffen sind 33
  Fenster: Neue Veranstaltung, Verwalten (Umbenennen, Freigabe zurücknehmen, anderes Team, Löschen), Archiv, Termin,
  Anmeldung, Wer meldet sich an?, Bezahlung, Daten löschen, alle Preis-Fenster, Einstellungen der Gemeinde, Freigeben,
  QR-Code, Druckliste, Rundmail, Anmeldung von Hand, Zurückholen und das Fenster einer Anmeldung.
- **Mehrstufige Fenster haben unten nur „Zurück“ und den Hauptknopf**, ganz zu geht es über das X (Alwin): Anmeldung
  von Hand, Rundmail-Vorschau und „… jetzt senden?“, im Fenster einer Anmeldung „Nachrücken?“, „Absagen?“ (dort
  führt „Abbrechen“ zurück zur Anmeldung) und die fertige Mail.
- **Zwei Wege unten nebeneinander:** QR-Code „als Bild“ / „Aushang als PDF“, Druckliste „Herunterladen“ / „Teilen …“,
  Rundmail „Vorschau“ / „Senden …“, „Gibt es schon“ „Zurück“ / „Trotzdem neu anlegen“. „Baustein entfernen“ in den
  Preis-Fenstern bleibt getrennt im Inhalt.
- **Während etwas gespeichert, gesendet oder freigegeben wird**, sind X und „Abbrechen“ gesperrt.
- „Heruntergeladen“ in der Druckliste steht jetzt über den Knöpfen statt zwischen ihnen.

### Intern (E6-O F4)

- `anmeldungen/src` ist aus der Ausnahmeliste von `ui/fenster/fensterAufbau.test.ts` heraus – übrig sind Organigramm
  und Protokolle (F5).
- Neu: `FensterLink` (`ui/fenster/FensterKnopf`) – derselbe Knopf als Link, für „Im Mailprogramm öffnen“ (`mailto:`).
- Neuer Test-Helfer `ui/fenster/fenster.testutil.ts` (`knopfFolge`, `fensterKnoepfe`); er ersetzt 19 gleichlautende
  Kopien in den Tests von Dienstplaner und Musik-App.
- Entfernt: `.knoepfe` und `.gefahrKnopf` (Anmeldungen) – die Rückfragen reichen ihre Knöpfe als `FrageKnoepfe` bzw.
  `MailKnoepfe` an das Fenster.
