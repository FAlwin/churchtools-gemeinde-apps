import { useEffect, useState } from 'react';
import type { jsPDF } from 'jspdf';
import { datumUhrText } from '@shared/ct/zeit';
import { useLaden } from '../ct/useLaden';

/**
 * Der Zustand der Teilen-Fenster der Blätter (E8) – Stand und Bau des PDF. Getrennt von `pdfFenster.tsx`, damit jene
 * Datei nur Komponenten exportiert.
 */

/** „Stand 05.11.2026, 14:00“ – einmal beim Öffnen des Fensters festgehalten. */
export function useStand(): string {
  // In der Uhr der Gemeinde, nicht des Geräts (#847, Z2 – vorher ein eigener `Intl`-Stempel im Termin-Fenster).
  const [stand] = useState(() => `Stand ${datumUhrText(new Date())}`);
  return stand;
}

export type PdfStand = { art: 'baut' } | { art: 'fertig'; doc: jsPDF } | { art: 'fehler' };

/**
 * Das PDF zu `blatt` bauen – neu, sobald sich das Blatt ändert. Wer während des Bauens umschaltet, bekommt das PDF zur
 * NEUEN Wahl; ein später fertiges altes zählt nicht.
 */
export function useGebautesPdf<B>(blatt: B, bauen: (b: B) => Promise<jsPDF>) {
  // `bauen` ist eine feste Funktion des Aufrufers – neu gebaut wird nach dem Blatt.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const gebaut = useLaden(() => bauen(blatt), [blatt]).stand;
  const [geladen, setGeladen] = useState(false);
  useEffect(() => {
    setGeladen(false);
  }, [blatt]);
  const stand: PdfStand =
    gebaut.art === 'fertig'
      ? { art: 'fertig', doc: gebaut.daten }
      : gebaut.art === 'fehler'
        ? { art: 'fehler' }
        : { art: 'baut' };
  return { stand, geladen, setGeladen };
}
