### Neu (Gebetsabend)

- **„Wer hört zu?“ (G4).** Unter dem Sender sieht die Technik, wer gerade zuhört – Vor- und Nachname aus ChurchTools
  und seit wann. Wer sich still neu verbindet oder mit zwei Geräten zuhört, steht einmal da („2 Geräte“). „Ohne
  Namen“ heißt meist: Jemand hört mit einem weitergegebenen Link zu. Nach „Sender neu starten“ beginnt die Liste leer
  und füllt sich von selbst wieder. Gespeichert wird nichts.

### Intern (Gebetsabend)

- Regeln in `shared/gebetsabend/werHoert.ts`: Verbindungen je UUID aus `push-connection` / `push-connection-info`
  (auch das ältere `new-push-connection`), angezeigt je Person (Messung G0-3). Meldungen zählen nur aus dem eigenen
  Sender-iframe und von `https://vdo.ninja`; `meldungAus` reicht dafür die UUID mit durch, und `VDO_HERKUNFT` steht
  jetzt an EINER Stelle in `links.ts` (vorher in `Zuhoeren.tsx` berechnet). Gegenprobe je Teil (9 Teile).
