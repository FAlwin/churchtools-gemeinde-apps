import { useEffect, useState } from 'react';
import type { jsPDF } from 'jspdf';
import { Sheet } from './Sheet';
import { SchalterZeile } from './SchalterZeile';
import { Spinner } from './Spinner';
import { useLatestRef } from '../hooks/useLatestRef';
import { getTeilenMitAnmerkungen, setTeilenMitAnmerkungen } from '../utils/devicePrefs';
import { sharePdf } from '../utils/sharePdf';
import styles from '../pages/Settings.module.scss';

/** Was das Bauen liefert: das PDF und ein Hinweis auf Lieder, die nicht wie gezeigt dabei sind. */
export interface GebautesPdf {
  doc: jsPDF;
  hinweis: string;
}

interface TeilenFensterProps {
  titel: string;
  dateiname: string;
  /** Baut das PDF – mit oder ohne die eigenen Anmerkungen. */
  bauen: (mitAnmerkungen: boolean) => Promise<GebautesPdf>;
  onClose: () => void;
}

type Stand =
  | { art: 'baut' }
  | { art: 'fertig'; pdf: GebautesPdf }
  | { art: 'fehler'; meldung: string };

/**
 * **Teilen als PDF – mit oder ohne Anmerkungen** (Alwin, 07.10.2026, Entwurf abgenommen).
 *
 * Zwei Gründe für ein eigenes Fenster statt sofortigem Teilen:
 *  - Die Wahl, ob die eigenen Anmerkungen mitkommen („zum Üben digital, beim Auftritt Blätter").
 *    Das Gerät merkt sie sich; ohne Angabe: ohne Anmerkungen.
 *  - Mit Dokumenten (PDFs aus ChurchTools) dauert das Bauen Sekunden. Danach öffnet iOS das
 *    Teilen-Menü nicht mehr – es braucht ein frisches Antippen. Das PDF entsteht deshalb, sobald das
 *    Fenster offen ist, und „Teilen" gibt es erst, wenn es fertig ist.
 */
export function TeilenFenster({ titel, dateiname, bauen, onClose }: TeilenFensterProps) {
  const [mitAnmerkungen, setMitAnmerkungen] = useState(getTeilenMitAnmerkungen);
  const [stand, setStand] = useState<Stand>({ art: 'baut' });
  // Gebaut wird nur bei neuer Wahl – `bauen` ist beim Aufrufer je Darstellung eine neue Funktion.
  const bauenRef = useLatestRef(bauen);

  useEffect(() => {
    // Wer während des Bauens umschaltet, bekommt das PDF zur NEUEN Wahl – das alte wird verworfen.
    let aktuell = true;
    setStand({ art: 'baut' });
    bauenRef.current(mitAnmerkungen).then(
      (pdf) => {
        if (aktuell) setStand({ art: 'fertig', pdf });
      },
      (e: unknown) => {
        if (aktuell) {
          setStand({
            art: 'fehler',
            meldung: e instanceof Error ? e.message : 'Das PDF konnte nicht erstellt werden.',
          });
        }
      },
    );
    return () => {
      aktuell = false;
    };
  }, [mitAnmerkungen, bauenRef]);

  function umschalten() {
    const neu = !mitAnmerkungen;
    setMitAnmerkungen(neu);
    setTeilenMitAnmerkungen(neu);
  }

  return (
    <Sheet title={titel} onClose={onClose}>
      <div className={styles.cardList}>
        <SchalterZeile
          label="Meine Anmerkungen"
          hinweis="Striche und Texte so, wie du sie auf den Blättern siehst."
          an={mitAnmerkungen}
          onUmschalten={umschalten}
        />
      </div>
      <p className={styles.sheetHint} role="status">
        {stand.art === 'baut'
          ? 'PDF wird erstellt …'
          : stand.art === 'fehler'
            ? stand.meldung
            : [
                `Fertig · ${stand.pdf.doc.getNumberOfPages()} ${stand.pdf.doc.getNumberOfPages() === 1 ? 'Seite' : 'Seiten'}`,
                stand.pdf.hinweis,
              ]
                .filter(Boolean)
                .join('. ')}
      </p>
      <button
        className={styles.orgSave}
        disabled={stand.art !== 'fertig'}
        onClick={() => {
          if (stand.art !== 'fertig') return;
          void sharePdf(stand.pdf.doc, dateiname);
          onClose();
        }}
      >
        {stand.art === 'baut' ? <Spinner /> : 'Teilen'}
      </button>
    </Sheet>
  );
}
