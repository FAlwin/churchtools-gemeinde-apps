### Behoben (Protokolle)

- **Termin mit unmöglichem Datum:** Editor und Lese-Ansicht zeigten bei einem Termin auch ein Datum wie den 30.02.,
  das die Bereiche unten schon verwarfen. Jetzt gilt überall dieselbe Regel (`terminDatum`) – ein ungültiges Datum
  erscheint nirgends.

### Intern (S6-3a)

- **Das Protokoll als PDF – Satz** (Bauplan S6-3a, noch ohne Knopf; der kommt mit S6-3b): Regel
  `shared/protokolle/protokollBlatt.ts` (Kopf mit Freigabe-Vermerk, das Protokoll wie in der Lese-Ansicht, Übersicht
  Beschlüsse · To-Dos · Termine · Nächste Sitzung; To-Dos mit Wer und Bis ohne Status, bei „Offene To-Dos von früher“
  die seit der letzten Sitzung erledigten ausgeschrieben – Alwin 12.11.2026), gezeichnet in `ui/teilen/protokollPdf.ts`
  auf dem gemeinsamen `PdfSatz` (Zeile für Zeile über die Seite, Überschriften nie allein unten, Tabellen mit
  verbundenen Zellen).
- `PdfSatz` und `Lauf` können jetzt auch kursiv, unterstrichen, durchgestrichen, Code, Schrift- und Hintergrundfarbe
  und Links (Termin- und Plan-Blatt unverändert). Kursive Lato (`Lato-Italic.ttf`, `Lato-BoldItalic.ttf`, unverändert
  aus google/fonts, Alwin 12.11.2026) in eigenem Modul `pdfSchriftKursiv.ts` – nur das Protokoll-PDF lädt sie.
- Eine Regel statt Kopien: `zustaendigeNamen` (Editor, feste Punkte, PDF), `terminDatum` (Ableitung, Editor,
  Lese-Ansicht, PDF), `wannLang` jetzt in `@shared/ct/zeit`, `zurueckText` (Seite und PDF). Der Textmarker auf Papier
  (`MARKIERT_PAPIER`) wird im Test aus `--markiert` nachgerechnet.
