import { tagKurz } from '@shared/ct/datum';
import { werWieOft } from '@shared/dienstplan/werWieOft';
import type { Sicht } from './planSicht';
import { useBisUnten } from './useBisUnten';
import styles from './Planen.module.scss';

/** „Wer wie oft?“ – Einsätze je Person im sichtbaren Zeitraum und in den sichtbaren Gruppen. */
export function WerWieOft({ sicht }: { sicht: Sicht }) {
  const sichtbar = new Set(sicht.gruppen.map((g) => g.gruppe?.id ?? null));
  const { personen, schnitt } = werWieOft(sicht.plan, {
    spalten: sicht.spalten,
    gruppeSichtbar: (id) => sichtbar.has(id),
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
                {p.dienste.map((d) => (
                  <span key={d} className={styles.etikett}>
                    {d}
                  </span>
                ))}
              </td>
              <td>
                <span className={styles.anzahl}>
                  {p.einsaetze.length}
                  <i style={{ width: `${Math.round((p.einsaetze.length / meiste) * 120)}px` }} />
                </span>
              </td>
              <td>
                {p.einsaetze.map((e, i) => (
                  <span key={i} className={styles.etikett}>
                    {tagKurz(e.spalte.tag)} {e.dienst}
                    {!e.zugesagt && ' ?'}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
