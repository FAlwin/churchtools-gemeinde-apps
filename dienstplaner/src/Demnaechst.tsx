import type { ReiterId } from './reiter';
import styles from './Startseite.module.scss';

const TEXT: Record<Exclude<ReiterId, 'start'>, { titel: string; text: string }> = {
  termine: {
    titel: 'Termine',
    text: 'Hier stehen bald alle Termine mit deinen Diensten – „Meine“ oder „Alle“, nach Veranstaltung gefiltert.',
  },
  planen: {
    titel: 'Planen',
    text: 'Hier entsteht der Plan deiner Dienstgruppen: Termine nebeneinander, Dienste untereinander.',
  },
  abwesenheiten: {
    titel: 'Abwesenheiten',
    text: 'Hier trägst du bald ein, wann du nicht kannst – dieselben Abwesenheiten wie in ChurchTools.',
  },
};

/** Platzhalter der Reiter, die in den nächsten Schritten von E3 gebaut werden. */
export function Demnaechst({ reiter }: { reiter: Exclude<ReiterId, 'start'> }) {
  const t = TEXT[reiter];
  return (
    <section className={styles.karte} aria-labelledby="demnaechst">
      <div className={styles.kopf}>
        <h2 id="demnaechst">{t.titel}</h2>
      </div>
      <p className={styles.hinweis}>{t.text}</p>
    </section>
  );
}
