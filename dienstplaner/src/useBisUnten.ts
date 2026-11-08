import { useLayoutEffect, useState } from 'react';
import styles from './Planen.module.scss';

/**
 * **Der Rollbereich reicht genau bis über den Fensterrand** (E9-3, Abnahme 05.11.2026): Mit dem festen
 * `calc(100vh - 220px)` endete er in ChurchTools 4 px unter dem Fenster (die Matrix beginnt dort bei 224 px), und
 * mit offenen Entwürfen lag die klebende Leiste „Noch nicht gesendet“ über seinem unteren Rand – beides genau auf der
 * Scroll-Leiste, die man nun immer sehen soll. Gemessen wird die Oberkante und, falls da, die Senden-Leiste; neu bei
 * jeder Größenänderung der Seite (die Leiste kommt und geht). Ohne Messung gilt die Regel aus dem Stil.
 */
export function useBisUnten() {
  // Als Zustand statt `useRef`: Der Rahmen kann später erscheinen („Wer wie oft?“ ist erst leer) – dann wird gemessen.
  const [el, ref] = useState<HTMLDivElement | null>(null);
  const [hoehe, setHoehe] = useState<number>();
  useLayoutEffect(() => {
    if (!el) return;
    const messen = () => {
      const leiste = el
        .closest(`.${styles.planen}`)
        ?.querySelector<HTMLElement>(`.${styles.sendeLeiste}`);
      const unten = 16 + (leiste ? leiste.offsetHeight + 24 : 0);
      const oben = el.getBoundingClientRect().top + window.scrollY;
      setHoehe(Math.max(320, Math.floor(window.innerHeight - oben - unten)));
    };
    messen();
    window.addEventListener('resize', messen);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(messen);
    ro?.observe(document.body);
    return () => {
      window.removeEventListener('resize', messen);
      ro?.disconnect();
    };
  }, [el]);
  return { ref, style: hoehe ? { maxHeight: hoehe } : undefined };
}
