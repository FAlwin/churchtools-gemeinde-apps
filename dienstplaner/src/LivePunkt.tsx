import styles from './LivePunkt.module.scss';

/** Der rote Punkt „Live läuft gerade in ChurchTools“ – am Knopf „Live“ im Termin und am Knopf „Live-Ansicht“ auf der Startseite. */
export function LivePunkt() {
  return <span className={styles.livePunkt} data-testid="live-punkt" />;
}
