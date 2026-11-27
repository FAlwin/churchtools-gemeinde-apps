/**
 * **Die Lage der Ampel einer Veranstaltung** (N3d, E38 ff.) – aus den Einstellungen, den Anmeldungen und der Ablage
 * „Nachweis-Stand“ wird je eingeschalteter Art der Wert jeder Person (`ampelFuer`, `nachweisAmpel.ts`). Die Tabelle hängt die
 * Lage zur Laufzeit an die Einstellungen (`nachweisLage`); der Hinweis auf der Startseite zählt aus derselben Lage – es gibt
 * keine zweite Rechnung.
 *
 * „Wer zählt“ ist die eine Regel `zaehltFuerNachweis` (dieselbe wie beim Eintragen beim Öffnen, N3c).
 */
import type { OeffentlicheEinstellungen, TerminAngabe } from './formular';
import type { ListenAnmeldung } from './liste';
import { tageBis } from '../ct/datum';
import {
  ampelFuer,
  OHNE_GUELTIGEN,
  type AmpelArt,
  type AmpelFall,
  type AmpelStand,
  type NachweisLage,
} from './nachweisAmpel';
import { nachweisProblem, zaehltFuerNachweis } from './nachweisBedarf';
import type { NachweisAblage } from './nachweisStandAblage';
import { letzterTagVon } from './termin';

/** Ab so vielen Tagen vor dem Beginn erscheint der Hinweis „Braucht deine Aufmerksamkeit“ (sechs Wochen, E25). */
export const NACHWEIS_HINWEIS_TAGE = 42;

/** Beginnt die Veranstaltung in höchstens sechs Wochen (oder läuft sie schon)? Ohne Termin: nie. */
export function imHinweisFenster(
  termin: Pick<TerminAngabe, 'beginn'> | null,
  heute: string,
): boolean {
  return !!termin && tageBis(heute, termin.beginn.slice(0, 10)) <= NACHWEIS_HINWEIS_TAGE;
}

/**
 * **Die Lage bauen.** `ablage`: die gelesene Ablage, `'laedt'` (noch keine Antwort – die Werte fehlen noch) oder
 * `'nichtLesbar'` (auch bei einem Lesefehler: die Zellen sagen es ehrlich, statt „fehlt“ für alle).
 */
export function nachweisLageBauen(
  e: OeffentlicheEinstellungen,
  liste: readonly ListenAnmeldung[],
  ablage: NachweisAblage | 'laedt' | 'nichtLesbar',
  heute: string,
): NachweisLage {
  const letzterTag = e.termin ? letzterTagVon(e.termin) : null;
  const arten = new Map<number, AmpelArt>();
  for (const b of e.nachweise ?? []) {
    const id = b.artGruppeId;
    const lesbar = typeof ablage === 'object' && ablage.art === 'gelesen';
    const stand: AmpelStand | null =
      ablage === 'laedt'
        ? null
        : typeof ablage === 'string' || ablage.art === 'nichtLesbar'
          ? { art: 'nichtLesbar' }
          : { art: 'gelesen', personen: ablage.staende.get(id) ?? new Map() };
    const bedingungKaputt = b.fuer === 'nurWenn' && nachweisProblem(e, b)?.art === 'frage';
    const ampel = new Map<number, AmpelFall>();
    if (stand)
      for (const x of liste)
        for (const p of x.personen)
          ampel.set(
            p.personId,
            ampelFuer({
              bedingungKaputt,
              zaehlt: zaehltFuerNachweis(e, b, { x, p }),
              stand,
              personId: p.personId,
              letzterTag,
              heute,
            }),
          );
    arten.set(id, {
      name: lesbar ? (ablage.namen.get(id) ?? null) : null,
      bedingungKaputt,
      nichtLesbar: stand?.art === 'nichtLesbar',
      ampel,
    });
  }
  return { arten };
}

/** **Wie viele Personen haben keinen gültigen Nachweis?** Verschiedene Personen – wem zwei Arten fehlen, zählt einmal. */
export function ohneGueltigenNachweis(lage: NachweisLage): number {
  const personen = new Set<number>();
  for (const a of lage.arten.values())
    for (const [id, f] of a.ampel) if (OHNE_GUELTIGEN.has(f.wert)) personen.add(id);
  return personen.size;
}
