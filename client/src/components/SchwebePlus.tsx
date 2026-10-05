import { Icon } from './icons';
import styles from './SchwebePlus.module.scss';

/**
 * Das runde Plus, das unten rechts über dem Inhalt schwebt – **einmal für die ganze App**.
 *
 * Bis zum 05.10.2026 gab es das nur in den Abwesenheiten (eigene Klasse `.plus`). Als der Ablauf
 * dasselbe bekam (Alwin: „als Plus im kreisförmigen Symbol über dem Ablauf schweben lassen"), wäre
 * es die zweite Kopie geworden. Gehört in die `ueberlagerung` des `SeitenGeruest`: Es scrollt nicht mit.
 */
export function SchwebePlus({
  label,
  onClick,
  disabled,
  dataTour,
}: {
  /** Was der Knopf tut („Zeitraum eintragen") – für Screenreader und Tests. */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  dataTour?: string;
}) {
  return (
    <button
      type="button"
      className={styles.plus}
      data-tour={dataTour}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name="plus" size={26} stroke={2.2} />
    </button>
  );
}
