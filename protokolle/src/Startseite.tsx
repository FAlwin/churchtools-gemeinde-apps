import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import styles from './Startseite.module.scss';

const LAGE: Record<ProtokollGruppe['lage'], { text: string; klasse: string }> = {
  eingerichtet: { text: 'eingerichtet', klasse: styles.gut },
  unvollstaendig: { text: 'unvollständig eingerichtet', klasse: styles.problem },
  'nicht-eingerichtet': { text: 'nicht eingerichtet', klasse: styles.leise },
};

/**
 * **Startseite der Protokolle** (Bauplan S1) – vorerst nur „Deine Gruppen“ mit dem Stand der Einrichtung. Die
 * Bereiche des Entwurfs (Meine offenen To-Dos, Nächste Sitzungen) kommen mit S3.
 */
export function Startseite({ gruppen }: { gruppen: ProtokollGruppe[] }) {
  const ohne = gruppen.some((g) => g.lage !== 'eingerichtet');
  return (
    <section className={styles.karte} aria-labelledby="deine-gruppen">
      <div className={styles.kopf}>
        <h2 id="deine-gruppen">Deine Gruppen</h2>
        <span className={styles.anzahl}>{gruppen.length}</span>
      </div>
      {gruppen.length === 0 ? (
        <p className={styles.leer}>Du bist in keiner Gruppe, die hier Protokolle führen kann.</p>
      ) : (
        <ul className={styles.liste}>
          {gruppen.map((g) => (
            <li key={g.id} className={styles.zeile}>
              <span className={styles.name}>{g.name}</span>
              <span className={`${styles.lage} ${LAGE[g.lage].klasse}`}>{LAGE[g.lage].text}</span>
            </li>
          ))}
        </ul>
      )}
      {ohne && (
        <p className={styles.fuss}>
          Eine Gruppe richtet ein Admin in ChurchTools einmal ein – danach können ihre Mitglieder
          hier Protokolle und To-Dos führen.
        </p>
      )}
    </section>
  );
}
