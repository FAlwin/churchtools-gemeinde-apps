import styles from './ReiterZaehler.module.scss';

/**
 * **Zähler an einem Reiter** – rot (Protokolle: „To-Dos“ mit fälligen To-Dos, etwas wartet auf dich) oder blau
 * (`ton="blau"`, „Wann kann ich?“: „Einträge“ mit Zahl der anstehenden Einträge, B4 – ein Merker, kein Alarm). Eine Bauart für
 * die Leiste unten (`ReiterLeiste`, `zaehler`) und den Reiter oben (`Segment`, als Teil der Beschriftung). Rein zur Ansicht
 * (`aria-hidden`): Den Klartext („To-Dos, 3 fällig“) trägt der Reiter selbst als Namen. Ab 100 „99+“.
 */
export function ReiterZaehler({ zahl, ton = 'rot' }: { zahl: number; ton?: 'rot' | 'blau' }) {
  if (zahl <= 0) return null;
  return (
    // `b` statt `span`: Die Reiterleisten setzen Schrift für `.tab span` – das träfe sonst auch den Zähler.
    <b
      className={`${styles.zaehler}${ton === 'blau' ? ' ' + styles.blau : ''}`}
      aria-hidden="true"
      data-zaehler
    >
      {zahl > 99 ? '99+' : zahl}
    </b>
  );
}
