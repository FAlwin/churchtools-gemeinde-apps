import { CenterMessage } from '@ui/bedienung/CenterMessage';
import { datumText, tagPunkt } from '@shared/ct/datum';
import type { EinrichtungsPlan, FremdStand, PlanArt } from '@shared/organigramm/einrichtungPlan';
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

const ART_TEXT: Record<PlanArt, string> = { neu: 'neu', vorhanden: 'vorhanden', aendern: 'ändern' };
const ART_KLASSE: Record<PlanArt, string> = { neu: kj.blau, vorhanden: kj.gruen, aendern: kj.gelb };

/**
 * **Schritt „Vorschau“** (Entwurf `o9-5-einrichten-v1`): wer wann wohin wechselt, was die Erweiterung in ChurchTools
 * anlegen würde und – wenn nötig – der Stopp wegen fremder Regeln. Er liest nur; geschrieben wird hier nichts.
 */
export function EinrichtenVorschau({
  art,
  wer,
  jahre,
  plan,
  fremd,
  fremdNeu,
  haken,
  onHaken,
}: {
  art: 'einrichten' | 'aendern';
  wer: Teil<WerVorschau>;
  /** Die Jahre der Wechseltage, ab dem nächsten Wechsel. */
  jahre: readonly Wechseljahr[];
  plan: Teil<EinrichtungsPlan>;
  /** `null`: noch nicht geladen. */
  fremd: FremdStand | null;
  /** Die Regeln der Stufen noch einmal lesen. */
  fremdNeu: () => void;
  haken: boolean;
  onHaken: (an: boolean) => void;
}) {
  const erstes = jahre[0];
  return (
    <div className={styles.stapel}>
      <div className={styles.unter}>Wer wechselt wann wohin</div>
      {wer.art === 'laedt' ? (
        <CenterMessage loading text="Die Kinder werden gelesen …" />
      ) : wer.art === 'fehler' ? (
        <CenterMessage icon="warnung" text={wer.text} onRetry={wer.neu} />
      ) : jahre.length === 0 ? (
        <Hinweis gelb>
          <b>Der Ferienkalender nennt keine künftigen Sommerferien.</b> Ohne Wechseltage gibt es
          nichts einzurichten – bitte den Kalender prüfen.
        </Hinweis>
      ) : (
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
                {wer.daten.jahre.map((z) => (
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
          {wer.daten.ohneGeburtstag > 0 && (
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
              Von {wer.daten.nichtGelesen.map((n) => `„${n}“`).join(', ')} ließen sich die Kinder
              nicht lesen – sie fehlen in den Zahlen.
            </Hinweis>
          )}
          <p className={kj.leise}>
            Wer in späteren Jahren wechselt, hängt von Geburtstagen ab, die noch nachgetragen werden
            können – die Zahlen sind der heutige Stand.
          </p>
        </>
      )}

      <div className={styles.unter}>Das legt die Erweiterung in ChurchTools an</div>
      {plan.art === 'laedt' ? (
        <CenterMessage loading text="Der Stand in ChurchTools wird geprüft …" />
      ) : plan.art === 'fehler' ? (
        <CenterMessage icon="warnung" text={plan.text} onRetry={plan.neu} />
      ) : (
        <>
          <ul className={`${styles.anlage} ${kj.karte}`} aria-label="Das legt die Erweiterung an">
            {plan.daten.zeilen.map((z) => (
              <li key={z.id}>
                <span className={`${kj.chip} ${ART_KLASSE[z.art]}`}>{ART_TEXT[z.art]}</span>
                <span className={styles.anlageMitte}>
                  <b>{z.titel}</b>
                  <span>{z.text}</span>
                  {z.rechte && (
                    <span className={styles.chips}>
                      {z.rechte.map((r) => (
                        <span key={r} className={`${kj.chip} ${kj.grau}`}>
                          {r}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {plan.daten.unsicher.length > 0 && (
            <Hinweis gelb>
              <b>Nicht alles ließ sich prüfen:</b> {plan.daten.unsicher.join(', ')}. Solange das so
              ist, wird nichts geschrieben.
            </Hinweis>
          )}
        </>
      )}

      <Hinweis>
        Es wird keine Mail verschickt.
        {erstes
          ? ` Kinder kommen erst ab der Ankündigung am ${tagPunkt(erstes.ankuendigung)} in die Wechsel-Gruppen; bis dahin ändert sich nur, dass die Leitungen als Leiter drinstehen.`
          : ''}
      </Hinweis>

      {fremd?.art === 'fremd' &&
        fremd.gruppen.map((g) => (
          <Hinweis key={g.gruppeId} rot>
            <b>„{g.name}“ hat schon eigene Regeln in ChurchTools</b> (
            {g.zahl === 1 ? '1 Regel' : `${g.zahl} Regeln`}, z. B.{' '}
            {g.beispiele.map((b) => `„${b}“`).join(', ')}).{' '}
            {art === 'einrichten' ? 'Einrichten' : 'Das Schreiben'} würde sie ersetzen. Deshalb geht
            es hier nicht weiter: Bitte die Regeln in ChurchTools ansehen oder die Gruppe aus den
            Stufen nehmen.
          </Hinweis>
        ))}
      {fremd?.art === 'unlesbar' && (
        <Hinweis rot>
          <b>
            Die Regeln von {fremd.gruppen.map((g) => `„${g.name}“`).join(', ')} ließen sich nicht
            prüfen.
          </b>{' '}
          Deshalb geht es hier nicht weiter – es wird nie angenommen, dass es keine gibt.{' '}
          <button type="button" className={kj.rueck} onClick={fremdNeu}>
            Nochmal prüfen
          </button>
        </Hinweis>
      )}

      {art === 'einrichten' && (
        <label className={styles.haken}>
          <input
            type="checkbox"
            checked={haken}
            disabled={fremd?.art !== 'frei'}
            onChange={(e) => onHaken(e.target.checked)}
          />
          <span>
            Ich habe die <b>Rechte der Leitung</b> geprüft. Wer Leiter einer Wechsel-Gruppe ist,
            darf dort die Kinder sehen und Ausnahmen setzen – sonst nichts.
          </span>
        </label>
      )}
    </div>
  );
}
