import { useEffect, useState, type RefObject } from 'react';

/**
 * **Einen Link kopieren** – die eine Regel für beide Stellen (Karte „Anmeldelink“ in `AnmeldeLink.tsx` und `LinkKopieren` im Termin-Fenster):
 * danach kurz „kopiert“, nach 1,6 s wieder bereit. Lässt der Browser es nicht zu, wird das Feld markiert
 * (`vonHand`), damit man von Hand kopieren kann.
 */
export function useLinkKopieren(
  link: string,
  feld: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
) {
  const [stand, setStand] = useState<'bereit' | 'kopiert' | 'vonHand'>('bereit');
  useEffect(() => {
    if (stand !== 'kopiert') return;
    const t = setTimeout(() => setStand('bereit'), 1600);
    return () => clearTimeout(t);
  }, [stand]);
  const kopieren = () =>
    navigator.clipboard.writeText(link).then(
      () => setStand('kopiert'),
      () => {
        feld.current?.select();
        setStand('vonHand');
      },
    );
  return { stand, kopieren };
}
