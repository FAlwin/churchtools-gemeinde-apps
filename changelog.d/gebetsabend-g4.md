### Neu (Gebetsabend)

- **„Wer hört zu?“ (G4).** In einer eigenen Karte neben dem Sender sieht die Technik, wer gerade zuhört – Vor- und Nachname aus ChurchTools
  und seit wann. Wer sich still neu verbindet oder mit zwei Geräten zuhört, steht einmal da („2 Geräte“). „Ohne
  Namen“ heißt meist: Jemand hört mit einem weitergegebenen Link zu. Nach „Sender neu starten“ beginnt die Liste leer
  und füllt sich von selbst wieder. Gespeichert wird nichts.

### Geändert (Gebetsabend)

- **Aussehen wie die anderen Erweiterungen** (Entwurf v4). Die Technik sieht am Computer zwei Spalten wie im
  Dienstplaner: links „Übertragung“ mit dem Kamerabild, rechts „Wer hört zu?“ und den Gebetsabend. Termin und
  „Gebetsabend zuhören“ stehen in einer Karte wie „Als Nächstes“. „Einstellungen“ ist ein Knopf neben „Hallo …“ statt
  eines kleinen Zahnrads in der Karte. Alle Knöpfe sind normale ChurchTools-Knöpfe.

### Geändert (alle Erweiterungen)

- **Das Zahnrad bei „Einstellungen“ sieht aus wie „System-Einstellungen“ in ChurchTools** – die Form aus Font Awesome 7
  statt 6, mit breiteren Zähnen. Gilt auch für Anmeldungen und Organigramm.

### Intern (Gebetsabend)

- Regeln in `shared/gebetsabend/werHoert.ts`: Verbindungen je UUID aus `push-connection` / `push-connection-info`
  (auch das ältere `new-push-connection`), angezeigt je Person (Messung G0-3). Meldungen zählen nur aus dem eigenen
  Sender-iframe und von `https://vdo.ninja`; `meldungAus` reicht dafür die UUID mit durch, und `VDO_HERKUNFT` steht
  jetzt an EINER Stelle in `links.ts` (vorher in `Zuhoeren.tsx` berechnet). Gegenprobe je Teil (9 Teile).
- Seit Entwurf v4 meldet `Sender.tsx` nur noch weiter (`onMeldung`); die Verbindungen hält die Technik-Karte je Sender
  (neuer Schlüssel bei neuen Daten oder „neu starten“ = leere Liste), angezeigt in `WerHoertZu.tsx`. Der Termin kommt
  über `useNaechsterTermin` in die Zuhören-Karte; Knöpfe sind `FensterKnopf`.
