import { gruppenFarbe } from '@shared/organigramm/farbe';
import { nachfahren, type Knoten } from '@shared/organigramm/gruppen';
import type { Start } from './start';
import styles from './Uebersicht.module.scss';

const anzahl = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`;

/**
 * Die Übersicht in O1 (Bauplan: „leer, aber echt“): die Bereiche – oberste Gruppen, die man sehen darf – mit
 * der Zahl ihrer Gruppen darunter, in der Farbe der Gruppe. Baum, Mitglieder und Fenster kommen mit O2.
 */
export function Uebersicht({ start }: { start: Start }) {
  const bereiche = start.baum;
  const kachel = (k: Knoten) => (
    <span
      className={styles.kachel}
      style={{ background: gruppenFarbe(k.gruppe, start.typFarben) }}
      aria-hidden="true"
    >
      {k.gruppe.name.trim().charAt(0).toUpperCase()}
    </span>
  );

  return (
    <div className={styles.raster}>
      <section className={styles.karte} aria-labelledby="bereiche">
        <div className={styles.kopf}>
          <h2 id="bereiche">Bereiche</h2>
          <span className={styles.leise}>
            {anzahl(start.gruppen.length, 'Gruppe', 'Gruppen')} insgesamt
          </span>
        </div>
        <ul className={styles.liste}>
          {bereiche.length === 0 && (
            <li className={styles.zeile}>
              <span className={styles.leise}>Du siehst in ChurchTools keine Gruppe.</span>
            </li>
          )}
          {bereiche.map((k) => {
            const darunter = nachfahren(k).length;
            return (
              <li key={k.gruppe.id} className={styles.zeile}>
                {kachel(k)}
                <b className={styles.mitte}>{k.gruppe.name}</b>
                <span className={styles.leise}>
                  {darunter
                    ? anzahl(darunter, 'Gruppe', 'Gruppen') + ' darunter'
                    : 'keine Untergruppen'}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.karte} aria-labelledby="rechte">
        <div className={styles.kopf}>
          <h2 id="rechte">Deine Rechte</h2>
        </div>
        <p className={styles.text}>
          {start.rechte.gruppenVerwalten
            ? 'Du darfst in ChurchTools Gruppen verwalten – umhängen und anlegen kommt hier mit den nächsten Schritten dazu.'
            : 'Du siehst die Gruppen, die ChurchTools dir zeigt. Ändern dürfen nur Gruppen-Admins der Gemeinde.'}
        </p>
      </section>

      <p className={styles.bau}>
        Das Organigramm wird gerade gebaut. Als Nächstes kommen der ganze Baum mit Leitung und
        Mitgliedern und die Präsentation.
      </p>
    </div>
  );
}
