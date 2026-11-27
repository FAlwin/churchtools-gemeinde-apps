import { Icon } from '../icons/icons';
import styles from './NachbarKnopf.module.scss';

/**
 * **Der Nachbar-Knopf** unten auf einer Seite: kleine Beschriftung mit Pfeil („‹ DAVOR“, „WEITER ›“), darunter Zeit und
 * Titel des Nachbarn. Der eine Baustein für „Davor / Danach“ der Punkt-Ansicht (`PunktAnsicht`) und die Steuerleiste der
 * Live-Ansicht (Dienstplaner, Live-Ansicht 2, A11) – damit beide gleich aussehen und es keinen zweiten rohen Knopf gibt.
 * `haupt`: gefüllt blau, der eine gefüllte Knopf der Leiste (R1).
 */
export function NachbarKnopf({
  richtung,
  label,
  zeit,
  titel,
  wer,
  onClick,
  disabled,
  haupt,
  ariaLabel,
  hinweis,
}: {
  /** `davor`: Pfeil links, Text linksbündig; `danach`: Pfeil rechts, rechtsbündig. */
  richtung: 'davor' | 'danach';
  /** Die kleine Beschriftung in Großbuchstaben („DAVOR“, „ZURÜCK“). */
  label: string;
  /** Zeile mit Zeit/Dauer des Nachbarn (klein, grau) – optional. */
  zeit?: string;
  titel?: string;
  /** Die Zuständigen des Nachbarn (klein, grau, einzeilig) – nur in der Punkt-Ansicht. */
  wer?: string;
  onClick: (() => void) | undefined;
  /** Ohne Angabe gesperrt, wenn es keinen `onClick` gibt. */
  disabled?: boolean;
  haupt?: boolean;
  /** Der Name für Screenreader. */
  ariaLabel: string;
  /** Tooltip. */
  hinweis?: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.nachbar}${richtung === 'danach' ? ` ${styles.danach}` : ''}${haupt ? ` ${styles.haupt}` : ''}`}
      disabled={disabled ?? !onClick}
      onClick={onClick}
      aria-label={ariaLabel}
      title={hinweis}
    >
      <span className={styles.nachbarArt}>
        {richtung === 'davor' && <Icon name="chev-left" size={14} stroke={2.6} />}
        {label}
        {richtung === 'danach' && <Icon name="chev-right" size={14} stroke={2.6} />}
      </span>
      {zeit && <span className={styles.nachbarZeit}>{zeit}</span>}
      {titel && <span className={styles.nachbarTitel}>{titel}</span>}
      {wer && <span className={styles.nachbarWer}>{wer}</span>}
    </button>
  );
}
