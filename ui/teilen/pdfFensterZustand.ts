import { useEffect, useState } from 'react';
import type { jsPDF } from 'jspdf';

/**
 * Der Zustand der Teilen-Fenster der Blätter (E8) – Stand und Bau des PDF. Getrennt von `pdfFenster.tsx`, damit jene
 * Datei nur Komponenten exportiert.
 */

const stempel = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** „Stand 05.11.2026, 14:00“ – einmal beim Öffnen des Fensters festgehalten. */
export function useStand(): string {
  const [stand] = useState(() => `Stand ${stempel.format(new Date())}`);
  return stand;
}

export type PdfStand = { art: 'baut' } | { art: 'fertig'; doc: jsPDF } | { art: 'fehler' };

/**
 * Das PDF zu `blatt` bauen – neu, sobald sich das Blatt ändert. Wer während des Bauens umschaltet, bekommt das PDF zur
 * NEUEN Wahl; ein später fertiges altes zählt nicht.
 */
export function useGebautesPdf<B>(blatt: B, bauen: (b: B) => Promise<jsPDF>) {
  const [stand, setStand] = useState<PdfStand>({ art: 'baut' });
  const [geladen, setGeladen] = useState(false);
  useEffect(() => {
    let aktuell = true;
    setStand({ art: 'baut' });
    setGeladen(false);
    bauen(blatt).then(
      (doc) => aktuell && setStand({ art: 'fertig', doc }),
      () => aktuell && setStand({ art: 'fehler' }),
    );
    return () => {
      aktuell = false;
    };
    // `bauen` ist eine feste Funktion des Aufrufers – neu gebaut wird nach dem Blatt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blatt]);
  return { stand, geladen, setGeladen };
}
