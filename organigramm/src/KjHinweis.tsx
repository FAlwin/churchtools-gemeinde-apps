import type { ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import styles from './KinderJugend.module.scss';

/**
 * Ein Hinweis im Reiter „Kinder & Jugend“: blau zum Erklären, gelb (`gelb`) für etwas, das man tun sollte, rot (`rot`)
 * für einen Stopp („hier geht es nicht weiter“, Fenster „Einrichten“). Nie nur Farbe: Der Text sagt es dazu.
 */
export function Hinweis({
  children,
  gelb,
  rot,
}: {
  children: ReactNode;
  gelb?: boolean;
  rot?: boolean;
}) {
  const klasse = [styles.hinweis, gelb && styles.hinweisGelb, rot && styles.hinweisRot]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={klasse} role={rot ? 'alert' : undefined}>
      <Icon name="info" size={16} />
      <span>{children}</span>
    </div>
  );
}
