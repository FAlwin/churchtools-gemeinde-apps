import { FensterKnopf } from '../fenster/FensterKnopf';
import { Spinner } from '../bedienung/Spinner';
import { Icon } from '../icons/icons';
import { PdfSeitenVorschau } from './PdfSeitenVorschau';
import { downloadPdf, sharePdf } from './sharePdf';
import type { PdfStand } from './pdfFensterZustand';
import styles from './TeilenFenster.module.scss';

/**
 * **Was jedes Teilen-Fenster der Blätter gleich hat** (E8) – „Termin teilen“ und „Plan teilen“: das PDF im Hintergrund
 * bauen (ein später fertiges altes zählt nicht), darunter „Fertig · N Seiten · Datei.pdf“ und die Seiten, unten
 * „Herunterladen“ und „Teilen“. Bis E8-2 stand das im Termin-Fenster; das Plan-Fenster hätte es nachgebaut.
 */

/** „Herunterladen“ und „Teilen“ unten im Fenster. Teilen schließt das Fenster, Herunterladen lässt es offen. */
export function PdfKnoepfe({
  pdf,
  dateiname,
  onGeladen,
  onClose,
}: {
  pdf: PdfStand;
  dateiname: string;
  onGeladen: () => void;
  onClose: () => void;
}) {
  const fertig = pdf.art === 'fertig' ? pdf.doc : null;
  return (
    <>
      <FensterKnopf
        art="hell"
        disabled={!fertig}
        onClick={() => {
          if (!fertig) return;
          downloadPdf(fertig, dateiname);
          onGeladen();
        }}
      >
        <Icon name="download" size={18} /> Herunterladen
      </FensterKnopf>
      <FensterKnopf
        disabled={!fertig}
        onClick={() => {
          if (!fertig) return;
          void sharePdf(fertig, dateiname);
          onClose();
        }}
      >
        {pdf.art === 'baut' ? (
          <Spinner />
        ) : (
          <>
            <Icon name="share" size={18} /> Teilen
          </>
        )}
      </FensterKnopf>
    </>
  );
}

/** Die Zeile „Fertig · N Seiten · Datei.pdf“ und darunter die Seiten. */
export function PdfStandUndVorschau({
  pdf,
  dateiname,
  geladen,
}: {
  pdf: PdfStand;
  dateiname: string;
  geladen: boolean;
}) {
  const fertig = pdf.art === 'fertig' ? pdf.doc : null;
  const seiten = fertig?.getNumberOfPages() ?? 0;
  return (
    <>
      <p className={styles.stand} role="status">
        {pdf.art === 'baut'
          ? 'PDF wird erstellt …'
          : pdf.art === 'fehler'
            ? 'Das PDF konnte nicht erstellt werden – bitte noch einmal öffnen.'
            : [
                `Fertig · ${seiten} ${seiten === 1 ? 'Seite' : 'Seiten'} · ${dateiname}.pdf`,
                geladen ? 'Heruntergeladen' : '',
              ]
                .filter(Boolean)
                .join('. ')}
      </p>
      {fertig && <PdfSeitenVorschau doc={fertig} />}
    </>
  );
}
