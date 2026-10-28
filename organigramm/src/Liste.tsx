import type { ReactNode } from 'react';
import type { SichtKnoten } from '@shared/organigramm/ansichten';
import { Icon } from '@ui/icons/icons';
import styles from './Liste.module.scss';

interface Props {
  sicht: SichtKnoten;
  /** Fehlen beide, ist die Liste nur zum Ansehen – so steht sie auf Papier (O7b-4): ohne Pfeile, ohne Knöpfe. */
  onUmklappen?: (schluessel: string) => void;
  onGruppe?: (id: number) => void;
}

const anzahl = (n: number) => `${n} ${n === 1 ? 'Untergruppe' : 'Untergruppen'}`;

/**
 * **Die Liste** (O7b-2, Entwurf `o7b-ansichten-v1.html`): die Gemeinde als Gliederung mit Linien – nur Namen, jede Gruppe
 * mit Untergruppen klappt auf und zu. Gut am Handy, wo ein breites Organigramm nicht hinpasst. Klick auf eine Gruppe →
 * Gruppenfenster; die Gemeinde selbst ist keine Gruppe und öffnet nichts.
 */
export function Liste({ sicht, onUmklappen, onGruppe }: Props) {
  const zeile = (k: SichtKnoten): ReactNode => {
    const fett = k.ebene <= 1;
    const id = k.id;
    const name = <span className={fett ? styles.fett : undefined}>{k.name}</span>;
    return (
      <li key={k.schluessel}>
        <div className={styles.zeile}>
          {k.kinderZahl > 0 && onUmklappen ? (
            <button
              type="button"
              className={styles.pfeil}
              aria-expanded={k.offen}
              aria-label={`${k.name} ${k.offen ? 'zuklappen' : 'aufklappen'}`}
              onClick={() => onUmklappen(k.schluessel)}
            >
              <Icon name={k.offen ? 'chev-down' : 'chev-right'} size={16} />
            </button>
          ) : (
            <span className={styles.pfeilLeer} />
          )}
          {id === null || !onGruppe ? (
            <span className={styles.name}>{name}</span>
          ) : (
            <button type="button" className={styles.name} onClick={() => onGruppe(id)}>
              {name}
            </button>
          )}
          {!k.offen && k.kinderZahl > 0 && (
            <span className={styles.zahl}>{anzahl(k.kinderZahl)}</span>
          )}
        </div>
        {k.kinder.length > 0 && <ul className={styles.unter}>{k.kinder.map(zeile)}</ul>}
      </li>
    );
  };
  return <ul className={styles.liste}>{zeile(sicht)}</ul>;
}
