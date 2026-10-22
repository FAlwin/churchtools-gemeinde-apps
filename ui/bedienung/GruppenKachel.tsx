import styles from './GruppenKachel.module.scss';

/**
 * **Die Kachel einer Gruppe** – Anfangsbuchstabe auf der Farbe der Gruppe, wie ChurchTools sie zeichnet (Farbe aus
 * `gruppenFarbe` in `shared/organigramm/farbe.ts`: eigene Farbe vor Typfarbe). Für alle Apps.
 */
export function GruppenKachel({
  name,
  farbe,
  groesse = 28,
}: {
  name: string;
  farbe: string;
  groesse?: number;
}) {
  return (
    <span
      className={styles.kachel}
      style={{
        width: groesse,
        height: groesse,
        fontSize: Math.round(groesse * 0.45),
        background: farbe,
      }}
      aria-hidden="true"
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
