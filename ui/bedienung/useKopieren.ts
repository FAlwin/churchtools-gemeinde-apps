import { useEffect, useState, type RefObject } from 'react';

/**
 * **Einen Text oder Link kopieren** – die eine Regel für alle Stellen (Karte „Anmeldelink“ in `AnmeldeLink.tsx`,
 * `LinkKopieren` im Termin-Fenster der Anmeldungen, „Leitungen Bescheid geben“ im Organigramm): danach kurz „kopiert“,
 * nach 1,6 s wieder bereit. Lässt der Browser es nicht zu, wird das Feld markiert (`vonHand`), damit man von Hand
 * kopieren kann. (Bis 16.11.2026 `useLinkKopieren` in den Anmeldungen.)
 */
export function useKopieren(
  text: string,
  feld: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
) {
  const [stand, setStand] = useState<'bereit' | 'kopiert' | 'vonHand'>('bereit');
  useEffect(() => {
    if (stand !== 'kopiert') return;
    const t = setTimeout(() => setStand('bereit'), 1600);
    return () => clearTimeout(t);
  }, [stand]);
  // Ohne Zwischenablage (unsichere Seite, alter Browser) fehlt `navigator.clipboard` ganz – das ist auch „geht nicht“.
  const kopieren = () =>
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(text))
      .then(
        () => setStand('kopiert'),
        () => {
          feld.current?.select();
          setStand('vonHand');
        },
      );
  return { stand, kopieren };
}
