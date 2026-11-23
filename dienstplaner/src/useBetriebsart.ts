import { useEffect, useState } from 'react';
import { STANDARD_BETRIEBSART, type Betriebsart } from '@shared/ct/liveAgenda';
import type { EinstellungenStand } from '@shared/dienstplan/liveEinstellungen';
import { ladeEinstellungen } from './ladeEinstellungen';

/** Wie oft die Betriebsart nachgelesen wird, solange die Live-Ansicht offen ist – ändert ein Planer sie, folgt jedes Gerät. */
export const BETRIEBSART_TAKT_MS = 30_000;
/** Nach einem Fehler früher: Ein Aussetzer beim Öffnen soll die Live-Ansicht nicht lange auf dem Standard lassen. */
export const BETRIEBSART_NOCHMAL_MS = 5_000;

/**
 * **Die Betriebsart der Live-Ansicht** (L4-2): sofort lesen, dann alle 30 s (nach einem Fehler alle 5 s). Bis zur ersten
 * Antwort und bei einem Fehler gilt der Standard – **ein Lesefehler ändert nie eine schon gelesene Betriebsart** (vorübergehend
 * ist nicht ungültig): Sie bleibt stehen, bis ein Lesen gelingt.
 */
export function useBetriebsart(
  lesen: () => Promise<EinstellungenStand> = ladeEinstellungen,
): Betriebsart {
  const [art, setArt] = useState<Betriebsart>(STANDARD_BETRIEBSART);

  useEffect(() => {
    let aus = false;
    let timer: number | undefined;
    const holen = () => {
      lesen().then(
        (stand) => {
          if (aus) return;
          if (stand.fehler === null) setArt(stand.betriebsart);
          timer = window.setTimeout(
            holen,
            stand.fehler === null ? BETRIEBSART_TAKT_MS : BETRIEBSART_NOCHMAL_MS,
          );
        },
        () => {
          if (!aus) timer = window.setTimeout(holen, BETRIEBSART_NOCHMAL_MS);
        },
      );
    };
    holen();
    return () => {
      aus = true;
      window.clearTimeout(timer);
    };
  }, [lesen]);

  return art;
}
