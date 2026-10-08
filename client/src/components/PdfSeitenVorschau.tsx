import { useEffect, useMemo, useState } from 'react';
import type { jsPDF } from 'jspdf';
import { Icon } from './icons';
import { Spinner } from './Spinner';
import { renderPdfSeite, renderPdfToCanvases } from '../utils/dokumentSeiten';
import styles from './PdfSeitenVorschau.module.scss';

/** Miniaturen: klein genug, dass auch ein langer Ablauf das Gerät nicht füllt (A4 ≈ 180 px breit). */
const MINI_SCALE = 0.3;
/** Großansicht einer Seite: scharf auf dem iPad. */
const GROSS_SCALE = 2;

/**
 * **Vorschau des fertigen PDF im Teilen-Fenster** (Alwin, 08.10.2026, Entwurf A: „eine Ansicht vor
 * dem Teilen"). Die Seiten liegen als kleine Blätter nebeneinander; Antippen zeigt eine Seite groß.
 *
 * Gezeichnet wird mit `dokumentSeiten` – derselben Umwandlung wie im Liedblatt, keine zweite. Eine
 * Vorschau, die nicht klappt, hält das Teilen nicht auf: Das PDF ist ja fertig.
 */
export function PdfSeitenVorschau({ doc }: { doc: jsPDF }) {
  const daten = useMemo(() => doc.output('arraybuffer'), [doc]);
  const seiten = doc.getNumberOfPages();
  const [bilder, setBilder] = useState<string[] | null>(null);
  const [fehler, setFehler] = useState(false);
  const [gross, setGross] = useState<number | null>(null);
  const [grossBild, setGrossBild] = useState<string | null>(null);

  useEffect(() => {
    // Neues PDF (z. B. Anmerkungen umgeschaltet): alte Bilder weg, ein später fertiges altes
    // Zeichnen darf das neue nicht überschreiben.
    let aktuell = true;
    setBilder(null);
    setFehler(false);
    setGross(null);
    // pdf.js übernimmt den Puffer (er ist danach leer) – deshalb je Aufruf eine Kopie.
    renderPdfToCanvases(daten.slice(0), MINI_SCALE).then(
      (cs) => {
        if (aktuell) setBilder(cs.map((c) => c.toDataURL('image/jpeg', 0.8)));
      },
      () => {
        if (aktuell) setFehler(true);
      },
    );
    return () => {
      aktuell = false;
    };
  }, [daten]);

  useEffect(() => {
    if (gross === null) return;
    let aktuell = true;
    setGrossBild(null);
    renderPdfSeite(daten.slice(0), gross + 1, GROSS_SCALE).then(
      (c) => {
        if (aktuell) setGrossBild(c.toDataURL('image/jpeg', 0.85));
      },
      () => {
        // Großansicht nicht zu zeichnen → zurück zur Übersicht, die Miniaturen gibt es ja.
        if (aktuell) setGross(null);
      },
    );
    return () => {
      aktuell = false;
    };
  }, [gross, daten]);

  if (fehler) return null;

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
