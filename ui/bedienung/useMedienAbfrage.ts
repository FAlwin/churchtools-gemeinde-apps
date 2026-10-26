import { useEffect, useState } from 'react';

/**
 * **Handy-Breite** – ab hier stehen die Reiter unten statt oben und Kopfknöpfe nur als Symbol. EINE Grenze für alle
 * Apps (vorher stand `'(max-width: 759px)'` dreimal von Hand: Dienstplaner, Organigramm, Protokolle).
 */
export const HANDY_BREITE = '(max-width: 759px)';

/**
 * **Trifft eine CSS-Medienabfrage gerade zu?** – laufend nachgeführt (`matchMedia` + `change`).
 *
 * Eine Stelle für alle Apps (Dienstplaner E3: Reiter oben oder unten). Vorher stand dasselbe Muster von
 * Hand im Notizen-Editor (Breite ab 768 px) und in den Einstellungen (dunkles System-Design).
 * Bewusst NICHT hierüber: `useLandscape` – die Ausrichtung wird dort zusätzlich bei `focus`/`pageshow`
 * nachgeprüft, weil iOS sie aus dem Hintergrund ohne Ereignis ändert (#215).
 *
 * `ohneFenster` gilt, wo es kein `window`/`matchMedia` gibt (Tests, Server).
 */
export function useMedienAbfrage(abfrage: string, ohneFenster = false): boolean {
  const [trifft, setTrifft] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(abfrage).matches
      : ohneFenster,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(abfrage);
    const nachfuehren = () => setTrifft(mq.matches);
    // Die Abfrage kann sich zwischen erstem Zeichnen und diesem Effekt geändert haben.
    nachfuehren();
    // Ältere Safari (vor iOS 14) kennen an `MediaQueryList` nur `addListener` – das öffentliche Anmeldeformular
    // öffnen Gäste mit allen möglichen Handys (A6-2b). Ohne beides: kein Nachführen, aber auch kein Absturz.
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', nachfuehren);
      return () => mq.removeEventListener('change', nachfuehren);
    }
    if (typeof mq.addListener === 'function') {
      mq.addListener(nachfuehren);
      return () => mq.removeListener(nachfuehren);
    }
  }, [abfrage]);

  return trifft;
}
