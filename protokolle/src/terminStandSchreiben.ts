/**
 * **Den Stand eines Termin-Bausteins schreiben** (W14) – in „Mitarbeit“ der Gruppe, derselbe Weg wie bei To-Dos und
 * Vorschlägen: frisch lesen, Regel auf den gelesenen Stand anwenden, schreiben, **nachlesen** (ein `201` ist kein Beleg),
 * jeder Fehler wird geworfen. Die Regeln stehen in `@shared/protokolle/terminStand`.
 *
 * **Vorübergehend ist nicht ungültig:** Scheitert das Schreiben (Netz, 5xx), ändert sich nichts – der Baustein bleibt
 * „noch nicht im Kalender“, nie fälschlich „im Kalender“ oder „nicht eintragen“. Der Aufrufer meldet den Fehler.
 */
import {
  istTerminStand,
  neuerTerminStand,
  wennNochOffen,
  type TerminStand,
  type TerminZiel,
} from '@shared/protokolle/terminStand';
import { wertNachgelesen, type MitarbeitOrt } from './mitarbeitWerte';

const TEXTE = {
  verweigert: 'Du darfst in dieser Gruppe nichts speichern.',
  nichtUebernommen: 'ChurchTools hat den Vermerk nicht übernommen.',
};

/** Der Termin steht in ChurchTools – dieser Vermerk gilt immer (auch über ein „Nicht eintragen“ hinweg). */
export function terminVermerken(
  ort: MitarbeitOrt,
  ziel: TerminZiel,
  kalender: NonNullable<TerminStand['kalender']>,
  ich: number,
  am: string,
): Promise<TerminStand> {
  const neu = neuerTerminStand(ziel, 'imKalender', kalender, ich, am);
  return wertNachgelesen(
    ort,
    istTerminStand,
    neu.id,
    () => neu,
    () => neu,
    TEXTE,
  );
}

/** „Nicht eintragen“ (`nichtEintragen`) bzw. „Wieder anzeigen“ (`offen`) – ein Eintrag im Kalender bleibt, wie er ist. */
export function terminMarkieren(
  ort: MitarbeitOrt,
  ziel: TerminZiel,
  stand: 'nichtEintragen' | 'offen',
  ich: number,
  am: string,
): Promise<TerminStand> {
  const neu = neuerTerminStand(ziel, stand, null, ich, am);
  return wertNachgelesen(
    ort,
    istTerminStand,
    neu.id,
    (alt) => wennNochOffen(alt, neu),
    () => neu,
    TEXTE,
  );
}
