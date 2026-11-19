import styles from './ReiterZaehler.module.scss';

/**
 * **Roter Zähler an einem Reiter** (Protokolle: „To-Dos“ mit fälligen To-Dos) – eine Bauart für die Leiste unten
 * (`ReiterLeiste`, `zaehler`) und den Reiter oben (`Segment`, als Teil der Beschriftung). Rein zur Ansicht
 * (`aria-hidden`): Den Klartext („To-Dos, 3 fällig“) trägt der Reiter selbst als Namen. Ab 100 „99+“.
 */
export function ReiterZaehler({ zahl }: { zahl: number }) {
  if (zahl <= 0) return null;
  return (
    // `b` statt `span`: Die Reiterleisten setzen Schrift für `.tab span` – das träfe sonst auch den Zähler.
    <b className={styles.zaehler} aria-hidden="true" data-zaehler>
      {zahl > 99 ? '99+' : zahl}
    </b>
  );
}
