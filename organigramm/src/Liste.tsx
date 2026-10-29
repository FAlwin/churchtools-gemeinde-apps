import type { ReactNode } from 'react';
import type { SichtKnoten } from '@shared/organigramm/ansichten';
import { rollenZahl } from '@shared/organigramm/personen';
import { Icon } from '@ui/icons/icons';
import type { KastenInhalt } from './kastenPersonen';
import styles from './Liste.module.scss';

interface Props {
  sicht: SichtKnoten;
  onUmklappen: (schluessel: string) => void;
  onGruppe: (id: number) => void;
  /** Personen unter dem Namen (O7b-6) – dieselbe Regel wie in den Kästchen des Diagramms. */
  inhalt?: (id: number) => KastenInhalt | null;
}

const anzahl = (n: number) => `${n} ${n === 1 ? 'Untergruppe' : 'Untergruppen'}`;

/**
 * **Die Liste** (O7b-2, Entwurf `o7b-ansichten-v1.html`): die Gemeinde als Gliederung mit Linien, jede Gruppe mit
 * Untergruppen klappt auf und zu. Gut am Handy, wo ein breites Organigramm nicht hinpasst. Klick auf eine Gruppe →
 * Gruppenfenster; die Gemeinde selbst ist keine Gruppe und öffnet nichts. Unter dem Namen auf Wunsch die Personen nach
 * Rollen (O7b-6), wie im Kästchen des Diagramms.
 */
export function Liste({ sicht, onUmklappen, onGruppe, inhalt }: Props) {
  const zeile = (k: SichtKnoten): ReactNode => {
    const fett = k.ebene <= 1;
    const id = k.id;
    const name = <span className={fett ? styles.fett : undefined}>{k.name}</span>;
    const leute = id === null || !inhalt ? null : inhalt(id);
    return (
      <li key={k.schluessel}>
        <div className={styles.zeile}>
          {k.kinderZahl > 0 ? (
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
          {id === null ? (
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
        {leute && (
          <div className={styles.leute}>
            {leute.art === 'hinweis' ? (
              <span className={styles.hinweis}>{leute.text}</span>
            ) : (
              leute.gruppen.map((g, i) => (
                <span key={i} className={styles.rolle}>
                  <span className={styles.rollenName}>{g.rolle}</span>{' '}
                  {g.nurZahl ? <i>{rollenZahl(g)}</i> : g.namen.join(', ')}
                </span>
              ))
            )}
          </div>
        )}
        {k.kinder.length > 0 && <ul className={styles.unter}>{k.kinder.map(zeile)}</ul>}
      </li>
    );
  };
  return <ul className={styles.liste}>{zeile(sicht)}</ul>;
}
