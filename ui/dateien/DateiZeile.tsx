import { Icon, type IconName } from '../icons/icons';
import styles from './DateiZeile.module.scss';

/**
 * **Eine Datei in einer Liste** – Symbol, Name, darunter Art und Größe, antippen öffnet sie aus ChurchTools. Seit T2a
 * (02.11.2026) hier: vorher stand die Zeile nur in der Lied-Ansicht des Dienstplaners; die Dateien am Termin sehen
 * genauso aus und sollen sie nicht nachbauen.
 *
 * `href: null` = die Adresse ist nicht sicher zu öffnen (`dateiAdresse`) – dann steht die Zeile da, führt aber nirgends
 * hin, statt die Sitzung an einen fremden Host zu schicken. Mit `onClick` statt `href` ist die Zeile ein Knopf (T2b: wer
 * ändern darf, bekommt erst das kleine Fenster mit Öffnen, Umbenennen, Löschen – wie in ChurchTools).
 */
export function DateiZeile({
  href,
  onClick,
  symbol,
  titel,
  unter,
}: {
  href?: string | null;
  onClick?: () => void;
  symbol: IconName;
  titel: string;
  unter: string;
}) {
  const inhalt = (
    <>
      <Icon name={symbol} size={18} />
      <span className={styles.text}>
        {titel}
        <small>{unter}</small>
      </span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={`${styles.zeile} ${styles.knopf}`} onClick={onClick}>
        {inhalt}
        <Icon name="chev-right" size={16} className={styles.pfeil} />
      </button>
    );
  }
  if (!href) {
    return (
      <span className={`${styles.zeile} ${styles.tot}`} title="Lässt sich hier nicht öffnen">
        {inhalt}
      </span>
    );
  }
  return (
    <a className={styles.zeile} href={href} target="_blank" rel="noopener noreferrer">
      {inhalt}
      <Icon name="chev-right" size={16} className={styles.pfeil} />
    </a>
  );
}
