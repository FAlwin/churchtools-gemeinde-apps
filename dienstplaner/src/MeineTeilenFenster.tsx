import { useMemo } from 'react';
import { useLaden } from '@ui/ct/useLaden';
import { Sheet } from '@ui/fenster/Sheet';
import { PdfKnoepfe, PdfStandUndVorschau } from '@ui/teilen/pdfFenster';
import { useGebautesPdf, useStand } from '@ui/teilen/pdfFensterZustand';
import { planBlattPdf } from '@ui/teilen/planBlattPdf';
import styles from '@ui/teilen/TeilenFenster.module.scss';
import { meineBlatt } from '@shared/dienstplan/meineBlatt';
import { einteilungenAus, type Einteilung, type TauschPort } from '@shared/dienstplan/tausch';
import { tauschPort } from './tauschPort';

interface Wer {
  ichId: number;
  /** „Alwin Friesen“. */
  name: string;
  gemeinde: string | null;
  zeitzone: string;
}

/**
 * **„Meine Dienste teilen“** (Bauplan E8-3, Entwurf `e8-teilen.html`) – aus Dienste → Meine: alle kommenden eigenen
 * Dienste als PDF, z. B. für den Familienkalender. Nichts zu wählen – nur die Seiten und „Herunterladen“/„Teilen“ wie
 * bei den anderen Blättern (`ui/teilen/pdfFenster.tsx`). Gelesen wird frisch beim Öffnen, über denselben Zugang wie das
 * Tauschen (`tauschPort.einteilungen`) – nicht nur die geladenen Wochen der Liste.
 */
export function MeineTeilenFenster({
  wer,
  onClose,
  port = tauschPort,
}: {
  wer: Wer;
  onClose: () => void;
  port?: Pick<TauschPort, 'einteilungen'>;
}) {
  const { stand, neu } = useLaden(
    () =>
      port.einteilungen(wer.ichId).then(einteilungenAus, (e: unknown) => {
        console.warn('[meine dienste] nicht geladen:', e);
        throw e;
      }),
    [port, wer.ichId],
  );
  const einteilungen: Einteilung[] | 'laedt' | 'fehler' =
    stand.art === 'fertig' ? stand.daten : stand.art === 'fehler' ? 'fehler' : 'laedt';

  if (Array.isArray(einteilungen))
    return <BlattFenster wer={wer} einteilungen={einteilungen} onClose={onClose} />;
  return (
    <Sheet title="Meine Dienste teilen" onClose={onClose} knoepfe={null}>
      <div className={styles.inhalt}>
        {einteilungen === 'laedt' ? (
          <p className={styles.hinweis}>Deine Dienste werden geladen …</p>
        ) : (
          <p className={styles.hinweis} role="alert">
            Deine Dienste ließen sich gerade nicht laden.{' '}
            <button type="button" className={styles.link} onClick={neu}>
              Erneut versuchen
            </button>
          </p>
        )}
      </div>
    </Sheet>
  );
}

function BlattFenster({
  wer,
  einteilungen,
  onClose,
}: {
  wer: Wer;
  einteilungen: Einteilung[];
  onClose: () => void;
}) {
  const stand = useStand();
  const blatt = useMemo(
    () =>
      meineBlatt({
        name: wer.name,
        einteilungen,
        zeitzone: wer.zeitzone,
        gemeinde: wer.gemeinde,
        app: 'Dienstplaner',
        stand,
      }),
    [wer.name, wer.zeitzone, wer.gemeinde, einteilungen, stand],
  );
  const { stand: pdf, geladen, setGeladen } = useGebautesPdf(blatt, planBlattPdf);
  return (
    <Sheet
      title="Meine Dienste teilen"
      onClose={onClose}
      einblenden={false}
      knoepfe={
        <PdfKnoepfe
          pdf={pdf}
          dateiname={blatt.dateiname}
          onGeladen={() => setGeladen(true)}
          onClose={onClose}
        />
      }
    >
      <div className={styles.inhalt}>
        <p className={styles.hinweis}>
          Alle kommenden Dienste – zugesagte und angefragte. Abgesagte stehen nicht darauf.
        </p>
        <PdfStandUndVorschau pdf={pdf} dateiname={blatt.dateiname} geladen={geladen} />
      </div>
    </Sheet>
  );
}
