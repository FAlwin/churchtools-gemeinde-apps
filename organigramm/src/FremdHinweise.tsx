import type { FremdStand } from '@shared/organigramm/einrichtungPlan';
import { Hinweis } from './KjHinweis';
import kj from './KinderJugend.module.scss';

/**
 * **Der Stopp wegen fremder Regeln** (O9-5c-2, Entwurf `o9-5-einrichten-v1`) – rot, wenn eine Stufen-Gruppe schon eigene
 * Regeln hat, die das Schreiben ersetzen würde, oder wenn sich die Regeln nicht lesen ließen (nie „keine“ annehmen). Eine
 * Stelle für die Vorschau von „Einrichten“ und von „Wechseltage nachtragen“. `was`: wer sie ersetzen würde („Einrichten“,
 * „Das Schreiben“).
 */
export function FremdHinweise({
  fremd,
  was,
  neu,
}: {
  /** `null`: noch nicht geladen. */
  fremd: FremdStand | null;
  was: string;
  neu: () => void;
}) {
  return (
    <>
      {fremd?.art === 'fremd' &&
        fremd.gruppen.map((g) => (
          <Hinweis key={g.gruppeId} rot>
            <b>„{g.name}“ hat schon eigene Regeln in ChurchTools</b> (
            {g.zahl === 1 ? '1 Regel' : `${g.zahl} Regeln`}, z. B.{' '}
            {g.beispiele.map((b) => `„${b}“`).join(', ')}). {was} würde sie ersetzen. Deshalb geht
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
          <button type="button" className={kj.rueck} onClick={neu}>
            Nochmal prüfen
          </button>
        </Hinweis>
      )}
    </>
  );
}
