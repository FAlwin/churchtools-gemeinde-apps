import { useEffect, useMemo, useState } from 'react';
import type { jsPDF } from 'jspdf';
import { Icon } from '../icons/icons';
import { Spinner } from '../bedienung/Spinner';
import { useLaden } from '../ct/useLaden';
import { renderPdfSeite, renderPdfToCanvases } from './pdfSeiten';
import styles from './PdfSeitenVorschau.module.scss';

/** Miniaturen: klein genug, dass auch ein langer Ablauf das Gerät nicht füllt (A4 ≈ 180 px breit). */
const MINI_SCALE = 0.3;
/** Großansicht einer Seite: scharf auf dem iPad. */
const GROSS_SCALE = 2;

/**
 * **Vorschau des fertigen PDF im Teilen-Fenster** (Alwin, 08.10.2026, Entwurf A: „eine Ansicht vor
 * dem Teilen"). Die Seiten liegen als kleine Blätter nebeneinander; Antippen zeigt eine Seite groß.
 *
 * Gezeichnet wird mit `pdfSeiten` – derselben Umwandlung wie im Liedblatt, keine zweite. Seit E8-1 in `ui/` – der
 * Dienstplaner zeigt damit das Termin-Blatt. Eine
 * Vorschau, die nicht klappt, hält das Teilen nicht auf: Das PDF ist ja fertig.
 */
export function PdfSeitenVorschau({ doc }: { doc: jsPDF }) {
  const daten = useMemo(() => doc.output('arraybuffer'), [doc]);
  const seiten = doc.getNumberOfPages();
  const [gross, setGross] = useState<number | null>(null);

  // Neues PDF (z. B. Anmerkungen umgeschaltet): neu zeichnen – ein später fertiges altes Zeichnen zählt nicht
  // (`useLaden`). pdf.js übernimmt den Puffer (er ist danach leer) – deshalb je Aufruf eine Kopie.
  const mini = useLaden(
    () =>
      renderPdfToCanvases(daten.slice(0), MINI_SCALE).then((cs) =>
        cs.map((c) => c.toDataURL('image/jpeg', 0.8)),
      ),
    [daten],
  ).stand;
  useEffect(() => {
    setGross(null);
  }, [daten]);

  const grossStand = useLaden(
    () =>
      gross === null
        ? null
        : renderPdfSeite(daten.slice(0), gross + 1, GROSS_SCALE).then((c) =>
            c.toDataURL('image/jpeg', 0.85),
          ),
    [gross, daten],
  ).stand;
  // Großansicht nicht zu zeichnen → zurück zur Übersicht, die Miniaturen gibt es ja.
  useEffect(() => {
    if (grossStand.art === 'fehler') setGross(null);
  }, [grossStand.art]);
  const bilder = mini.art === 'fertig' ? mini.daten : null;
  const grossBild = grossStand.art === 'fertig' ? grossStand.daten : null;

  if (mini.art === 'fehler') return null;

  if (gross !== null) {
    return (
      <div className={styles.gross}>
        <div className={styles.grossKopf}>
          <button type="button" className={styles.knopf} onClick={() => setGross(null)}>
            <Icon name="chev-left" size={18} /> Alle Seiten
          </button>
          <span className={styles.zaehler}>
            Seite {gross + 1} von {seiten}
          </span>
          <span className={styles.blaettern}>
            <button
              type="button"
              className={styles.knopf}
              aria-label="Vorige Seite"
              disabled={gross === 0}
              onClick={() => setGross(gross - 1)}
            >
              <Icon name="chev-left" size={18} />
            </button>
            <button
              type="button"
              className={styles.knopf}
              aria-label="Nächste Seite"
              disabled={gross === seiten - 1}
              onClick={() => setGross(gross + 1)}
            >
              <Icon name="chev-right" size={18} />
            </button>
          </span>
        </div>
        <div className={styles.grossBlatt}>
          {grossBild ? <img src={grossBild} alt={`Seite ${gross + 1}`} /> : <Spinner />}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.leiste} aria-label="Vorschau">
      {bilder === null ? (
        <span className={styles.laedt}>
          <Spinner />
        </span>
      ) : (
        bilder.map((src, i) => (
          <button
            key={i}
            type="button"
            className={styles.blatt}
            aria-label={`Seite ${i + 1} vergrößern`}
            onClick={() => setGross(i)}
          >
            <img src={src} alt="" />
          </button>
        ))
      )}
    </div>
  );
}
