import { Icon } from '../icons/icons';
import styles from './LeisesPlus.module.scss';

/**
 * **Das leise „+“ mitten im Inhalt** (R10/E2, „Ruhige Bedienung“ B8): ein gestricheltes Feld mit „+“ und einem Wort für alles,
 * was **an dieser Stelle fehlt** – ein Termin ohne Ablauf („Ablauf anlegen“), ein freier Platz, eine leere Spalte. Antippen legt
 * genau dort an.
 *
 * Das ist die zweite Art von „+“. Die erste ist **grün gefüllt** und legt etwas **Neues** an (`KopfKnopf neu`,
 * `HinzufuegenMenue`, am Handy `SchwebePlus`) – höchstens eines je Ansicht. Mitten in einer Liste steht nie ein zweiter
 * grüner Knopf: Die Farbe trägt dort nur die Zahl in der Überschrift. Grau und gestrichelt heißt „hier fehlt etwas“.
 */
export function LeisesPlus({
  label,
  onClick,
  disabled,
  dataTour,
  title,
}: {
  /** Was angelegt wird („Ablauf anlegen“) – steht im Feld und ist der Name für Screenreader. */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  dataTour?: string;
  /** Tooltip, wenn er mehr sagen soll als die Beschriftung. */
  title?: string;
}) {
  return (
    <button
      type="button"
      className={styles.feld}
      onClick={onClick}
      disabled={disabled}
      data-tour={dataTour}
      title={title ?? label}
    >
      <Icon name="plus" size={14} stroke={2.4} />
      {label}
    </button>
  );
}
