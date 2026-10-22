import { Spinner } from './Spinner';
import { Icon, type IconName } from '@ui/icons/icons';
import styles from './CenterMessage.module.scss';

interface CenterMessageProps {
  /** true → Ladekringel statt Icon. */
  loading?: boolean;
  /** Linien-Icon aus `ui/icons` – seit 22.10.2026 kein Emoji mehr (`keineBehelfszeichen.test.ts`). */
  icon?: IconName;
  text: string;
  onRetry?: () => void;
  /** Optionale Zusatzaktion (z.B. Abmelden) mit eigenem Text. */
  actionLabel?: string;
  onAction?: () => void;
}

/** Zentrierte Statusmeldung (Laden, leer, Fehler) für Screen-Inhalte. */
export function CenterMessage({
  loading,
  icon,
  text,
  onRetry,
  actionLabel,
  onAction,
}: CenterMessageProps) {
  return (
    <div className={styles.wrap}>
      {loading ? (
        <Spinner />
      ) : (
        icon && (
          <div className={styles.icon}>
            <Icon name={icon} size={36} stroke={1.6} />
          </div>
        )
      )}
      <div className={styles.text}>{text}</div>
      {onRetry && (
        <button className={styles.retry} onClick={onRetry}>
          Erneut versuchen
        </button>
      )}
      {onAction && actionLabel && (
        <button className={styles.retry} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
