import type { ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import styles from './KinderJugend.module.scss';

/** Ein Hinweis im Reiter „Kinder & Jugend“: blau zum Erklären, gelb (`gelb`) für etwas, das man tun sollte. */
export function Hinweis({ children, gelb }: { children: ReactNode; gelb?: boolean }) {
  return (
    <div className={gelb ? `${styles.hinweis} ${styles.hinweisGelb}` : styles.hinweis}>
      <Icon name="info" size={16} />
      <span>{children}</span>
    </div>
  );
}
