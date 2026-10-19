import { useEffect, useState } from 'react';
import { loadAppLogo, logoZeigen } from '../utils/logoAsset';
import { useSiteConfig } from './useSiteConfig';

/**
 * Das App-Logo für die PDF-Kopfzeile, einmalig vorgeladen (#314).
 *
 * Das Laden selbst macht `loadAppLogo` – **nicht** noch einmal hier. Beim Herauslösen aus
 * `ChordChart.tsx` stellte sich heraus, dass es die Funktion längst gab und das Vorladen daneben
 * ZWEIMAL von Hand geschrieben stand (in `ChordChart` und in `dev/DemoPdf`). Nur die Funktion
 * behandelt dabei `onerror`; die Handschriften ließen das Versprechen im Fehlerfall offen. Genau
 * diese Fehlerklasse – dieselbe Regel an mehreren Stellen, die Verbesserung nur an einer – hat
 * dieses Projekt schon mehrfach getroffen.
 *
 * Dieser Hook ist nur die React-Hülle darum: Er hält das Ergebnis im Zustand, damit die PDF neu
 * gebaut wird, sobald das Bild da ist. Alle Stellen, an denen ein Liedblatt entsteht, holen es hier –
 * der Seitenstrom, „Als PDF teilen" und seit 19.10.2026 auch das Liederheft im Ablauf (vorher lud es
 * selbst, mit einer eigenen Zeile; so gilt der Gemeinde-Schalter unten an EINER Stelle für alle).
 *
 * Solange das Bild lädt (oder es nicht laden konnte), ist der Wert `null`; die PDF entsteht dann
 * eben ohne Logo. Ein fehlendes Logo darf das Liederheft nicht aufhalten.
 *
 * Hat die Gemeinde das Logo ausgeblendet (Verwaltung → „Liedblatt: Logo zeigen“, `logoZeigen`), ist der
 * Wert immer `null` – und folgt dem Schalter sofort.
 */
export function useAppLogo(): HTMLImageElement | null {
  const zeigen = logoZeigen(useSiteConfig().data);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!zeigen) return;
    let abgebrochen = false;
    void loadAppLogo().then((img) => {
      if (!abgebrochen) setLogo(img);
    });
    return () => {
      abgebrochen = true;
    };
  }, [zeigen]);
  return zeigen ? logo : null;
}
