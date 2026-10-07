import * as pdfjsLib from 'pdfjs-dist';
// Worker INLINE ins Bundle bündeln (kein separater Datei-Abruf zur Laufzeit). Der frühere
// ?url-Ansatz lud eine externe .mjs, die im iPad-PWA offline nicht verfügbar war → pdf.js fiel auf
// den „fake worker" zurück und scheiterte („Importing a module script failed"). Inline liegt der
// Worker im ohnehin offline verfügbaren Haupt-Bundle → Charts rendern auch ohne Netz (#32).
//
// In der ChurchTools-Extension geht das nicht: ChurchTools verbietet Worker aus `blob:` (CSP
// `child-src * data`, gemessen 07.10.2026). Dort lenkt `vite.config.ts` `./pdfWorker` auf
// `./pdfWorkerDatei` um – der Worker als eigene Datei; Offline gibt es in der Extension ohnehin nicht.
import PdfWorker from './pdfWorker';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();
