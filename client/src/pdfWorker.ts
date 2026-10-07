// pdf.js-Worker INLINE im Bundle – offline verfügbar (#32). Begründung in `pdfSetup.ts`.
// Der Extension-Build lenkt diesen Import auf `pdfWorkerDatei.ts` um (vite.config.ts, #335).
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';

export default PdfWorker;
