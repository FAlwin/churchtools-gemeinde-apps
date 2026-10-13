import styles from './Startseite.module.scss';

const TEXT: Record<'abwesenheiten', { titel: string; text: string }> = {
  abwesenheiten: {
    titel: 'Abwesenheiten',
    text: 'Hier trägst du bald ein, wann du nicht kannst – dieselben Abwesenheiten wie in ChurchTools.',
  },
};

/** Platzhalter der Reiter, die in den nächsten Schritten von E3 gebaut werden. */
export function Demnaechst({ reiter }: { reiter: 'abwesenheiten' }) {
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
