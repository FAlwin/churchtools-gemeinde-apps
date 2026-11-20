import type { ReactNode } from 'react';
import { Icon } from '../icons/icons';
import styles from './KlickZeile.module.scss';

interface Gemeinsam {
  /** Der Inhalt der Zeile (Kachel, Titel, Etikett …) – der Aufrufer legt ihn aus, die Zeile ist nur die Fläche. */
  children: ReactNode;
  /** Layout und Trennlinie der Liste, in der die Zeile steht (Klasse der Liste). */
  className?: string;
  /** Pfeil am Ende: „›“ (weiter), „⌄“ (klappt auf) – ein Link nach außen hat immer „›“. */
  pfeil?: 'weiter' | 'auf' | 'zu';
}

type Props = Gemeinsam &
  (
    | { onClick: () => void; href?: never; ariaExpanded?: boolean }
    | { href: string; onClick?: never; ariaExpanded?: never }
  );

/**
 * **Eine ganze Zeile als Knopf** (E24, „Ruhige Bedienung“ B7: Anmelde-Tool Start – „Jede Zeile ist selbst der Knopf und
 * endet mit ›, statt drei verschiedener Knöpfe“). Die Fläche der Zeile öffnet etwas; was zu tun ist, steht als Etikett im
 * Inhalt. Mit `onClick` ein `<button>`, mit `href` ein Link (führt die Zeile nach ChurchTools, bleibt es ein echter
 * Link). Der Name für Screenreader ist der Inhalt der Zeile – keine versteckte zweite Beschriftung.
 *
 * Die Zeile sieht aus wie eine Listenzeile (kein Rand, kein Rahmen), beim Darüberfahren (nur Maus) leicht hinterlegt.
 * Ein zweiter, eigener Knopf in derselben Zeile ist nicht vorgesehen: Ein `<button>` in einem `<button>` geht nicht –
 * wer neben dem Öffnen noch etwas tun können soll, legt es hinter die geöffnete Seite.
 */
export function KlickZeile(props: Props) {
  const { children, className, pfeil = 'weiter' } = props;
  const klasse = `${styles.zeile}${className ? ' ' + className : ''}`;
  const symbol = (
    <Icon
      name={
        pfeil === 'weiter' || props.href ? 'chev-right' : pfeil === 'auf' ? 'chev-up' : 'chev-down'
      }
      size={18}
      className={styles.pfeil}
    />
  );
  if (props.href !== undefined)
    return (
      <a className={klasse} href={props.href}>
        {children}
        {symbol}
      </a>
    );
  return (
    <button
      type="button"
      className={klasse}
      onClick={props.onClick}
      aria-expanded={props.ariaExpanded}
    >
      {children}
      {symbol}
    </button>
  );
}
