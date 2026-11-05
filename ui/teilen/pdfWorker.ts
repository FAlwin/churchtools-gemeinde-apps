// pdf.js-Worker INLINE im Bundle – offline verfügbar (#32). Begründung in `pdfSetup.ts`.
// Der Erweiterungs-Bau lenkt diesen Import auf `pdfWorkerDatei.ts` um (`ui/erweiterung/viteErweiterung.ts`, #335).
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';

export default PdfWorker;
