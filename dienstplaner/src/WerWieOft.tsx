import { tagKurz } from '@shared/ct/datum';
import { Etikett } from '@ui/bedienung/Etikett';
import { werWieOft } from '@shared/dienstplan/werWieOft';
import type { Sicht } from './planSicht';
import { useBisUnten } from './useBisUnten';
import styles from './Planen.module.scss';

/** „Wer wie oft?“ – Einsätze je Person im sichtbaren Zeitraum und in den sichtbaren Gruppen und Diensten (derselbe Filter wie die Matrix). */
export function WerWieOft({ sicht }: { sicht: Sicht }) {
  const { personen, schnitt } = werWieOft(sicht.plan, {
    spalten: sicht.spalten,
    gruppen: sicht.gruppen,
  });
  const meiste = Math.max(1, ...personen.map((p) => p.einsaetze.length));
  const bisUnten = useBisUnten();
  if (personen.length === 0) {
    return (
      <section className={styles.karte}>
        <p className={styles.hinweis} style={{ padding: 14 }}>
          In diesem Zeitraum ist noch niemand eingeteilt.
        </p>
      </section>
    );
  }
  return (
    <div className={styles.rahmen} ref={bisUnten.ref} style={bisUnten.style}>
      <table className={styles.personen}>
        <thead>
          <tr>
            <th scope="col">Person</th>
            <th scope="col">Dienste</th>
            <th scope="col">Einsätze (Ø {schnitt.toFixed(1).replace('.', ',')})</th>
            <th scope="col">Wann</th>
          </tr>
        </thead>
        <tbody>
          {personen.map((p) => (
            <tr key={`${p.gast ? 'g' : 'p'}${p.name}`}>
              <th scope="row">
                {p.name}
                {p.gast && <span className={styles.gast}>Gast</span>}
              </th>
              <td>
                <div className={styles.etiketten}>
                  {p.dienste.map((d) => (
                    <Etikett key={d}>{d}</Etikett>
                  ))}
                </div>
              </td>
              <td>
                <span className={styles.anzahl}>
                  {p.einsaetze.length}
                  <i style={{ width: `${Math.round((p.einsaetze.length / meiste) * 120)}px` }} />
                </span>
              </td>
              <td>
                <div className={styles.etiketten}>
                  {p.einsaetze.map((e, i) => (
                    <Etikett key={i}>
                      {tagKurz(e.spalte.tag)} {e.dienst}
                      {!e.zugesagt && ' ?'}
                    </Etikett>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
