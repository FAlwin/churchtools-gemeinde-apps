import { Icon } from '@ui/icons/icons';
import { naechsterStatus, statusText, type AufgabenStatus } from '@shared/protokolle/aufgaben';
import styles from './StatusKreis.module.scss';

const ICON = { offen: 'kreis', arbeit: 'kreis-halb', erledigt: 'kreis-haken' } as const;

/**
 * **Der Status-Kreis eines To-Dos** (entschieden 16.10.2026: Status überall direkt über den Kreis; S4-2 im
 * Protokoll): offen → in Arbeit → erledigt → offen (`naechsterStatus`). Ohne `onWechsel` nur Anzeige.
 */
export function StatusKreis({
  status,
  onWechsel,
}: {
  status: AufgabenStatus;
  onWechsel?: (neu: AufgabenStatus) => void;
}) {
  const naechster = naechsterStatus(status);
  return (
    <button
      type="button"
      className={`${styles.kreis} ${styles[status]}`}
      disabled={!onWechsel}
      aria-label={`Status: ${statusText(status)}${onWechsel ? ` – antippen für „${statusText(naechster)}“` : ''}`}
      title={statusText(status)}
      contentEditable={false}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onWechsel?.(naechster)}
    >
      <Icon name={ICON[status]} size={20} />
    </button>
  );
}
