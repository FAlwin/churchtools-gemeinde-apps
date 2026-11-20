import { CenterMessage } from '@ui/bedienung/CenterMessage';
import { Etikett, type EtikettTon } from '@ui/bedienung/Etikett';
import { tagPunkt } from '@shared/ct/datum';
import type { EinrichtungsPlan, FremdStand, PlanArt } from '@shared/organigramm/einrichtungPlan';
import {
  offenesFensterText,
  type OffenesFenster,
  type WerVorschau,
} from '@shared/organigramm/einrichtungVorschau';
import type { Wechseljahr } from '@shared/organigramm/gruppenwechsel';
import { Hinweis } from './KjHinweis';
import { FremdHinweise } from './FremdHinweise';
import { WerTabelle, type Teil } from './WerTabelle';
import kj from './KinderJugend.module.scss';
import styles from './Einrichten.module.scss';

export type { Teil } from './WerTabelle';

const ART_TEXT: Record<PlanArt, string> = { neu: 'neu', vorhanden: 'vorhanden', aendern: 'ändern' };
const ART_TON: Record<PlanArt, EtikettTon> = { neu: 'blau', vorhanden: 'gruen', aendern: 'blau' };

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
  offen,
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
  /** Läuft heute schon einer der Wechsel, die geschrieben werden? Dann steht das gelb ganz oben (O9-5d). */
  offen?: OffenesFenster | null;
}) {
  const erstes = jahre[0];
  return (
    <div className={styles.stapel}>
      {offen && (
        <Hinweis gelb>
          <b>{offenesFensterText(offen)}</b>
        </Hinweis>
      )}
      <div className={styles.unter}>Wer wechselt wann wohin</div>
      <WerTabelle wer={wer} jahre={jahre} />

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
                <Etikett ton={ART_TON[z.art]}>{ART_TEXT[z.art]}</Etikett>
                <span className={styles.anlageMitte}>
                  <b>{z.titel}</b>
                  <span>{z.text}</span>
                  {z.rechte && (
                    <span className={styles.chips}>
                      {z.rechte.map((r) => (
                        <Etikett key={r}>{r}</Etikett>
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

      <FremdHinweise
        fremd={fremd}
        was={art === 'einrichten' ? 'Einrichten' : 'Das Schreiben'}
        neu={fremdNeu}
      />

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
