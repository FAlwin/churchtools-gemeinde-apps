import { Fragment, useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import styles from './BlattKopf.module.scss';

/** Ein Lied in der Leiste: seine Stelle im Ablauf und sein Titel (derselbe Weg wie auf dem Blatt, `chartHead`). */
export interface LeistenLied {
  idx: number;
  titel: string;
}

interface AblaufLeisteProps {
  lieder: LeistenLied[];
  /** Nummern vor den Titeln – nur im Ablauf, nicht beim einzelnen Lied aus der Liederliste. */
  mitNummer: boolean;
  /** Die gerade sichtbaren Lieder (Querformat zwei) – grau hinterlegt. */
  sichtbar: ReadonlySet<number>;
  /** Das gewählte Lied – darauf wirken Knöpfe und Lied-Menü. Blau unterstrichen, mit Pfeil. */
  gewaehlt: number;
  /** Was neben dem gewählten Titel steht: Tonart · Fassung · Tempo samt Puls (`BlattKopf`). */
  info: ReactNode;
  /** Lied-Menü offen (für `aria-expanded`). */
  menuOffen: boolean;
  /** Lied-Menü oder eines seiner Fenster offen – das gewählte Lied ist dann hellblau hinterlegt. */
  liedFensterOffen: boolean;
  onTipp: (idx: number) => void;
}

/**
 * **Die Ablauf-Leiste** über dem Blatt (Scheibe B2, Entwurf Variante B mit Alwin, 26.10.2026): alle Lieder des
 * Ablaufs nebeneinander, mit Trennstrichen – wie die Reiter der Ablaufpläne in ChurchTools. Ersetzt die
 * Titel-Kapseln im Kopf und das Springen über die Punkte.
 *
 * **Waagerecht scrollbar**, der Rand blendet aus. Ändert sich das gewählte Lied (Blättern, Pedal, Tipp), scrollt die
 * Leiste so weit mit, dass es zu sehen ist – von Hand wischen zeigt, was kommt, ohne umzublättern: Die Leiste liegt
 * im Kopf, außerhalb der Wisch-Fläche des Blatts.
 */
export function AblaufLeiste({
  lieder,
  mitNummer,
  sichtbar,
  gewaehlt,
  info,
  menuOffen,
  liedFensterOffen,
  onTipp,
}: AblaufLeisteProps) {
  const leisteRef = useRef<HTMLElement>(null);

  // Mitscrollen. Effekt-Rumpf in `{ }` – `scrollTo` liefert in neueren Browsern ein Promise, das React sonst als
  // Aufräum-Funktion aufriefe (Chrome 152, weiße Seite beim Verlassen).
  useEffect(() => {
    const leiste = leisteRef.current;
    const knopf = leiste?.querySelector<HTMLElement>(`[data-lied="${gewaehlt}"]`);
    if (!leiste || !knopf || typeof leiste.scrollTo !== 'function') return;
    const links = knopf.offsetLeft;
    const rechts = links + knopf.offsetWidth;
    const rand = 24; // so weit blendet der Rand aus
    if (
      links < leiste.scrollLeft + rand ||
      rechts > leiste.scrollLeft + leiste.clientWidth - rand
    ) {
      leiste.scrollTo({ left: Math.max(0, links - rand), behavior: 'smooth' });
    }
  }, [gewaehlt]);

  return (
    <nav
      ref={leisteRef}
      className={`${styles.leiste}${lieder.length > 1 ? ' ' + styles.leisteRand : ''}`}
      aria-label="Lieder im Ablauf"
      data-tour="chart-lied"
    >
      {lieder.map((l, k) => {
        const istGewaehlt = l.idx === gewaehlt;
        return (
          <Fragment key={l.idx}>
            {k > 0 && <span className={styles.trenner} aria-hidden="true" />}
            <button
              type="button"
              data-lied={l.idx}
              className={`${styles.lied}${sichtbar.has(l.idx) ? ' ' + styles.liedSichtbar : ''}${
                istGewaehlt ? ' ' + styles.liedGewaehlt : ''
              }${istGewaehlt && liedFensterOffen ? ' ' + styles.liedOffen : ''}`}
              aria-current={istGewaehlt ? 'true' : undefined}
              aria-haspopup={istGewaehlt ? 'menu' : undefined}
              aria-expanded={istGewaehlt ? menuOffen : undefined}
              onClick={() => onTipp(l.idx)}
            >
              {mitNummer && <span className={styles.nummer}>{l.idx + 1}</span>}
              <span className={styles.liedTitel}>{l.titel}</span>
              {istGewaehlt && (
                <>
                  {info}
                  <Icon name="chev-down" size={14} stroke={2.4} className={styles.pfeil} />
                </>
              )}
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}
