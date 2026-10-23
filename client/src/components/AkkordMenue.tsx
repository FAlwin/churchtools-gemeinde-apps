import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '@ui/icons/icons';
import styles from './AkkordMenue.module.scss';

interface Props {
  name: string;
  /** Platz auf dem Bildschirm: unter dem Kärtchen (`y` = seine Unterkante, `oben` = seine Oberkante). */
  x: number;
  y: number;
  oben: number;
  kannLinks: boolean;
  kannRechts: boolean;
  links: () => void;
  rechts: () => void;
  aendern: () => void;
  entfernen: () => void;
  schliessen: () => void;
}

const ABSTAND = 6;

/**
 * **Menü am angetippten Akkord-Kärtchen** (Lied-Editor L5-2, Entwurf Variante A): eine Stelle nach links/rechts,
 * ändern, entfernen. Es bleibt nach ← → offen, damit man mehrmals schieben kann; ein Tipp daneben, Escape,
 * Weiterschreiben oder Scrollen schließt es.
 */
export function AkkordMenue({
  name,
  x,
  y,
  oben,
  kannLinks,
  kannRechts,
  links,
  rechts,
  aendern,
  entfernen,
  schliessen,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Unter dem Kärtchen – reicht der sichtbare Bereich dort nicht (Tastatur offen, Kärtchen am unteren Rand: Alwin
  // am iPad, 23.10.2026, das Menü lag unter der Tastatur), dann darüber.
  const [top, setTop] = useState(y + ABSTAND);
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 0;
    const vv = window.visualViewport;
    const sichtbarBis = vv ? vv.offsetTop + vv.height : window.innerHeight;
    setTop(y + ABSTAND + h > sichtbarBis ? Math.max(ABSTAND, oben - ABSTAND - h) : y + ABSTAND);
  }, [y, oben]);
  useEffect(() => {
    const daneben = (e: PointerEvent) => {
      const ziel = e.target as HTMLElement;
      // Ein anderes Kärtchen oder die Akkord-Leiste kümmern sich selbst (neues Menü bzw. Akkord ersetzen).
      if (ref.current?.contains(ziel) || ziel.closest?.('.cm-cp-akkord, [aria-label="Akkorde"]'))
        return;
      schliessen();
    };
    const taste = () => schliessen();
    const rollen = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) schliessen();
    };
    document.addEventListener('pointerdown', daneben);
    document.addEventListener('keydown', taste);
    document.addEventListener('scroll', rollen, true);
    return () => {
      document.removeEventListener('pointerdown', daneben);
      document.removeEventListener('keydown', taste);
      document.removeEventListener('scroll', rollen, true);
    };
  }, [schliessen]);

  // Die Knöpfe nehmen dem Text den Fokus nicht – am iPad bliebe sonst die Tastatur nicht stehen.
  const ohneFokus = (e: React.MouseEvent) => e.preventDefault();
  return (
    <div
      ref={ref}
      className={styles.menue}
      role="group"
      aria-label={`Akkord ${name}`}
      style={{ left: Math.max(16, Math.min(x - 8, window.innerWidth - 320)), top }}
    >
      <button
        type="button"
        className={styles.knopf}
        aria-label="Eine Stelle nach links"
        disabled={!kannLinks}
        onMouseDown={ohneFokus}
        onClick={links}
      >
        <Icon name="chev-left" size={18} stroke={2.2} />
      </button>
      <button
        type="button"
        className={styles.knopf}
        aria-label="Eine Stelle nach rechts"
        disabled={!kannRechts}
        onMouseDown={ohneFokus}
        onClick={rechts}
      >
        <Icon name="chev-right" size={18} stroke={2.2} />
      </button>
      <span className={styles.trenner} />
      <button type="button" className={styles.knopf} onMouseDown={ohneFokus} onClick={aendern}>
        <Icon name="pencil" size={16} />
        Ändern
      </button>
      <button
        type="button"
        className={`${styles.knopf} ${styles.weg}`}
        onMouseDown={ohneFokus}
        onClick={entfernen}
      >
        <Icon name="trash" size={16} />
        Entfernen
      </button>
    </div>
  );
}
