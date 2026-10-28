### Neu (Organigramm, O7b-4, #736)

- **Organigramm als PDF:** Knopf „PDF / Drucken“ im Seitenkopf (neben „Präsentieren“). Das Fenster übernimmt Ansicht,
  „Anfangen bei“ und was aufgeklappt ist, mit **Vorschau**: Ansicht (von oben, von links, Mindmap, Liste),
  Ausschnitt, Papier („Passend“ – das A4, auf dem das Diagramm am größten wird –, A4 quer/hoch, A3 quer/hoch),
  „Alles aufgeklappt“ und „Logo der Gemeinde“. Ein Diagramm steht auf einer Seite (Schrift höchstens 11 pt, unter 6 pt
  ein Hinweis), eine Liste läuft über mehrere Seiten.
- Das Blatt (Entwurf `o7b-4-pdf-v1.html`): oben Logo aus ChurchTools, „Organigramm“, Gemeinde und Stand, unten Gemeinde
  und Seitenzahl; Lato wie in ChurchTools, immer hell. **PDF öffnen** zeigt die PDF in einem neuen Tab – von dort
  drucken; **Herunterladen** speichert sie. Eine eigene PDF statt des Druckfensters des Browsers, weil Safari dort das
  Querformat nicht hielt und Adresse und Datum an den Rand druckte (Test 28.10.2026).

### Intern

- `ui/teilen/svgSeitenPdf.ts`: Seiten, die als SVG am Bildschirm stehen, werden zur PDF (svg2pdf.js, jede Seite in
  ihrem Format) – die ausgerechneten Stile wandern als Attribute mit, die Grundlinie mittig gesetzter Texte misst der
  Browser. `ui/teilen/pdfSchrift.ts`: Lato (unverändert, OFL) für PDFs, auch im Dokument unter eigenem Namen
  `LatoPdf`. `oeffnePdf` in `ui/teilen/sharePdf.ts`. `ui/ct/logo.ts`: Logo der Gemeinde (`/api/config` →
  `site_logo`).
- Die hellen Farben stehen jetzt im Mixin `hell` (`ui/design/_farben.scss`); `:root` bindet ihn ein (gebautes CSS
  unverändert), ebenso das Blatt – so bleibt Papier im Dunkelmodus hell, ohne zweite Werte.
- Organigramm: `DiagrammBild.tsx` zeichnet Bildschirm und PDF gleich (auf Papier mit dem Linienstück, wo sonst das +/−
  sitzt – `schalterStummel` im Ansichten-Kern), `messung.ts` misst an einer Stelle, `spitzenWahl` liefert die Auswahl
  für „Anfangen bei“ und „Ausschnitt“. Neue Abhängigkeiten im Organigramm: `jspdf` (wie Musik-App/Anmeldungen),
  `svg2pdf.js` – beide erst beim Öffnen des PDF-Fensters geladen.
