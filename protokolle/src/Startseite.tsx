import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import { Marke } from './Marke';
import styles from './Startseite.module.scss';

const LAGE: Record<ProtokollGruppe['lage'], { text: string; art: 'gut' | 'problem' | 'leise' }> = {
  eingerichtet: { text: 'eingerichtet', art: 'gut' },
  unvollstaendig: { text: 'unvollständig eingerichtet', art: 'problem' },
};

/**
 * **Startseite der Protokolle** (Bauplan S1) – vorerst nur „Deine Gruppen“: die Gruppen, deren Protokolle man sehen
 * darf (S2-4), mit dem Stand der Einrichtung. Die
 * Bereiche des Entwurfs (Meine offenen To-Dos, Nächste Sitzungen) kommen mit S3.
 */
export function Startseite({ gruppen }: { gruppen: ProtokollGruppe[] }) {
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
              <Marke art={LAGE[g.lage].art}>{LAGE[g.lage].text}</Marke>
            </li>
          ))}
        </ul>
      )}
      {/* Gruppen ohne Zugriff stehen nicht in der Liste (S2-4) – deshalb immer dieser Hinweis. */}
      <p className={styles.fuss}>
        Fehlt eine Gruppe? Ein Admin richtet sie ein oder gibt dir Zugriff.
      </p>
    </section>
  );
}
