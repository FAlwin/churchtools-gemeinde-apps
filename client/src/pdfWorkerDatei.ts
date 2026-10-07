// pdf.js-Worker als EIGENE Datei – für die ChurchTools-Extension (#335): ChurchTools verbietet
// Worker aus `blob:` (CSP `child-src * data`, gemessen 07.10.2026). Nur im Extension-Build benutzt.
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

export default PdfWorker;
