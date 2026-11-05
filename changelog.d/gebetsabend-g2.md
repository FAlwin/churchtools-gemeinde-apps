### Neu (Gebetsabend)

- **Zuhören (G2).** Ist der Gebetsabend eingerichtet, zeigt die Seite den nächsten Termin aus dem Kalender und einen
  großen Knopf **„Gebetsabend zuhören“**. Ohne Übertragung steht „Noch keine Übertragung“ da; die Seite merkt von
  selbst, wenn die Technik startet. Ein Tippen öffnet Bild und Ton ohne fremde Bedienelemente (bis auf den
  Wiedergabe-Knopf, wenn das iPhone das Abspielen sperrt – „Einmal ins Bild tippen“), darunter steht, was gerade
  passiert. Startet die Technik neu, verbindet sich der Player selbst neu; beendet sie, schließt er sich.
  Antwortet ChurchTools kurz nicht, läuft alles weiter.

### Intern (Gebetsabend)

- Regeln `shared/gebetsabend/zuhoeren.ts` (Texte, `nachNachfrage`: weiter / neu / beendet), `termin.ts`,
  `einstellungen.ts`; Meldungen von VDO.Ninja nur aus dem eigenen iframe **und** von `https://vdo.ninja`
  (`istVdoMeldung`). Gegenprobe je Teil, Komponenten-Test mit Fake-Timern.
- `ladeIch` liefert jetzt auch den Nachnamen (`nachname`, optional) – für den Namen beim Sender.
