import { CenterMessage } from '@ui/bedienung/CenterMessage';
import { datumText } from '@shared/ct/datum';
import type { WerVorschau } from '@shared/organigramm/einrichtungVorschau';
import type { Wechseljahr } from '@shared/organigramm/gruppenwechsel';
import { Hinweis } from './KjHinweis';
import kj from './KinderJugend.module.scss';
import styles from './Einrichten.module.scss';

/** Was ein Teil der Vorschau gerade zeigt: lädt, nicht ladbar (mit „Erneut versuchen“) oder fertig. */
export type Teil<T> =
  | { art: 'laedt' }
  | { art: 'fehler'; text: string; neu: () => void }
  | { art: 'da'; daten: T };

/**
 * **„Wer wechselt wann wohin“** – die Tabelle (Jahr, Wechseltag, Zahl je Übergang), auf Wunsch mit den Namen des ersten
 * Jahres und den Hinweisen zu Kindern ohne Geburtstag. Eine Stelle für die Vorschau von „Einrichten“ und von „Wechseltage
 * nachtragen“ (O9-5d). `ab`: nur Jahre **nach** diesem zeigen (Nachtragen zeigt nur die neuen) – gerechnet wird trotzdem
 * von Anfang an, sonst zählte ein Kind in jedem Jahr noch einmal.
 */
export function WerTabelle({
  wer,
  jahre,
  ab,
  mitNamen = true,
}: {
  wer: Teil<WerVorschau>;
  /** Die Jahre der Wechseltage, ab dem nächsten Wechsel. */
  jahre: readonly Wechseljahr[];
  ab?: number;
  mitNamen?: boolean;
}) {
  const erstes = jahre[0];
  if (wer.art === 'laedt') return <CenterMessage loading text="Die Kinder werden gelesen …" />;
  if (wer.art === 'fehler')
    return <CenterMessage icon="warnung" text={wer.text} onRetry={wer.neu} />;
  if (jahre.length === 0)
    return (
      <Hinweis gelb>
        <b>Der Ferienkalender nennt keine künftigen Sommerferien.</b> Ohne Wechseltage gibt es
        nichts einzurichten – bitte den Kalender prüfen.
      </Hinweis>
    );
  const zeilen = wer.daten.jahre.filter((z) => ab === undefined || z.jahr.jahr > ab);
  return (
    <>
      <div className={`${kj.karte} ${kj.rahmen}`}>
        <table className={kj.tabelle}>
          <thead>
            <tr>
              <th>Jahr</th>
              <th>Wechseltag</th>
              {wer.daten.uebergaenge.map((u) => (
                <th key={u} className={styles.zahlSpalte}>
                  {u}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z) => (
              <tr key={z.jahr.jahr}>
                <td>
                  <b>{z.jahr.jahr}</b>
                </td>
                <td>{datumText(z.jahr.wechseltag)}</td>
                {z.zahlen.map((n, i) => (
                  <td key={i} className={styles.zahlSpalte}>
                    {n}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mitNamen && (
        <details className={styles.mehr}>
          <summary>Namen für {erstes.jahr} zeigen</summary>
          <div className={styles.namenListe}>
            {wer.daten.uebergaenge.map((u, i) => (
              <div key={u}>
                <b>{u}</b>
                <div className={styles.namen}>
                  {wer.daten.namen[i].length > 0 ? wer.daten.namen[i].join(', ') : '–'}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      {mitNamen && wer.daten.ohneGeburtstag > 0 && (
        <Hinweis gelb>
          <b>
            {wer.daten.ohneGeburtstag === 1
              ? '1 Kind ohne Geburtstag wechselt'
              : `${wer.daten.ohneGeburtstag} Kinder ohne Geburtstag wechseln`}{' '}
            nie von selbst.
          </b>{' '}
          Sie stehen unter „Daten pflegen“.
        </Hinweis>
      )}
      {wer.daten.nichtGelesen.length > 0 && (
        <Hinweis gelb>
          Von {wer.daten.nichtGelesen.map((n) => `„${n}“`).join(', ')} ließen sich die Kinder nicht
          lesen – sie fehlen in den Zahlen.
        </Hinweis>
      )}
      <p className={kj.leise}>
        Wer in späteren Jahren wechselt, hängt von Geburtstagen ab, die noch nachgetragen werden
        können – die Zahlen sind der heutige Stand.
      </p>
    </>
  );
}
