### Neu (Gebetsabend)

- **Neue Erweiterung „Gebetsabend“ (G1 + G2).** Sie überträgt den Gebetsabend mit Bild und Ton an Gemeindeglieder,
  die nicht kommen können – nur mit ChurchTools-Zugang und Recht, ohne Link zum Weitergeben. Sie lässt sich
  installieren und mit einem Knopf **einrichten** (legt die Kategorien „Zugang“ und „Einstellungen“ an). Danach zeigt
  die Seite den nächsten Termin aus dem Kalender und einen großen Knopf **„Gebetsabend zuhören“**. Ohne Übertragung
  steht „Noch keine Übertragung“ da; die Seite merkt von selbst, wenn die Technik startet. Ein Tippen öffnet Bild und
  Ton ohne fremde Bedienelemente (bis auf den Wiedergabe-Knopf, wenn das iPhone das Abspielen sperrt – „Einmal ins
  Bild tippen“), darunter steht, was gerade passiert. Startet die Technik neu, verbindet sich der Player selbst neu;
  beendet sie, schließt er sich. Antwortet ChurchTools kurz nicht, läuft alles weiter. Übertragen starten und „Wer
  hört zu?“ folgen. Anleitung mit Rechte-Tabelle: `docs/betrieb/GEBETSABEND.md`.

### Intern (Gebetsabend)

- Regeln in `shared/gebetsabend/`: Zugangsdaten (nur Buchstaben und Ziffern, ohne Schieflage erzeugt), die
  VDO.Ninja-Adressen an einer Stelle, der Player-Zustand aus den VDO.Ninja-Meldungen, der Stand der Einrichtung,
  Einstellungen, nächster Termin und die Zuhör-Regeln (`nachNachfrage`: weiter / neu / beendet) – alles nach den
  Messungen S0/S0b/G0 vom 05.11.2026 (`gebetsabend-planung/s0-messung.md`). Meldungen von VDO.Ninja nur aus dem
  eigenen iframe **und** von `https://vdo.ninja` (`istVdoMeldung`). Gegenprobe je Teil, Komponenten-Test mit
  Fake-Timern.
- Eingetragen in Workspaces, Build, Lint, Testlauf, CI-Paket, Release-Weg `gebetsabend-v*`, Release-Notizen. Die
  CSS-Klassen-Prüfung (`client/src/cssKlassen.test.ts`) prüft jetzt auch das Organigramm, das dort fehlte.
