import { mapLimit } from '@shared/ct/mapLimit';
import { useLaden } from '@ui/ct/useLaden';
import { abfrageRegelAus, type AbfrageRegel } from '@shared/dienstplan/erinnern';
import type { AbfragenStand } from '@shared/dienstplan/abfragenSpeicher';
import { GLEICHZEITIG } from './ladeAntworten';

/** Liest das Dokument der Abfragen einer Dienstgruppe (`ladeAbfragen`, im Fenster `AbfrageAnschluss.lesen`). */
export type AbfragenLader = (dienstgruppeId: number) => Promise<AbfragenStand>;

/** Die Regel einer Dienstgruppe – oder `unbekannt`, wenn ihr Dokument nicht gelesen werden konnte (nichts raten). */
export type RegelStand = AbfrageRegel | 'unbekannt';

/**
 * **Die Regel je Dienstgruppe lesen** (V-4): Art der Verfügbarkeits-Abfrage und – bei „Nur abwesend“ – die ID der laufenden Abfrage
 * (`abfrageRegelAus`, die eine Stelle dafür). **Zweige einzeln:** ein Lesefehler (Netz, ChurchTools) ist `unbekannt` – vorübergehend,
 * die Gruppe bleibt gesperrt statt falsch gerechnet; ein **unlesbares** Dokument gilt wie der Startwert als „Zusagen“ (wie in V-2/V-3).
 * Wirft nie.
 */
export async function ladeRegeln(
  lader: AbfragenLader,
  dienstgruppenIds: readonly number[],
  heute: string,
): Promise<Map<number, RegelStand>> {
  // Gedrosselt wie die Antworten (`GLEICHZEITIG`): Der Lader der App liest die Regeln seit V-5 bei jedem Laden mit – ChurchTools
  // bremst sonst (HTTP 429).
  const regeln = new Map<number, RegelStand>();
  await mapLimit([...dienstgruppenIds], GLEICHZEITIG, async (id) => {
    try {
      const s = await lader(id);
      regeln.set(
        id,
        s.fehler !== null ? 'unbekannt' : abfrageRegelAus(s.unlesbar ? null : s.inhalt, heute),
      );
    } catch {
      regeln.set(id, 'unbekannt');
    }
  });
  return regeln;
}

const LEER: ReadonlyMap<number, RegelStand> = new Map();

/**
 * Für „Erinnern“: lädt die Regeln der gezeigten Dienstgruppen beim Öffnen. Ohne `lader` (kein Anschluss an die Abfragen) gilt
 * überall „Zusagen“, wie vor V-4 – dann ist nichts zu laden.
 */
export function useAbfrageRegeln(
  lader: AbfragenLader | undefined,
  dienstgruppenIds: readonly number[],
  heute: string,
) {
  const ids = dienstgruppenIds.join(',');
  const { stand, neu } = useLaden<Map<number, RegelStand>>(
    () => (lader && ids !== '' ? ladeRegeln(lader, ids.split(',').map(Number), heute) : null),
    [lader, ids, heute],
  );
  return {
    laedt: lader !== undefined && ids !== '' && stand.art === 'laedt',
    regeln: stand.art === 'fertig' ? stand.daten : LEER,
    neuLaden: neu,
  };
}

/**
 * **Welche Dienstgruppen „Nur abwesend“ fragen** (V-5, für `PersonenAntworten.nurAbwesend`): aus den Regeln (`ladeRegeln`). Eine
 * Gruppe, deren Dokument gerade nicht lesbar war (`unbekannt`), zählt **nicht** dazu – dann zeigt Planen ihre Ja/Vielleicht wie vor
 * V-5. Das ist nur Anzeige: ausgeblendet, nicht gelöscht; ein Aussetzer zerstört nichts.
 */
export function nurAbwesendAus(regeln: ReadonlyMap<number, RegelStand>): Set<number> {
  return new Set(
    [...regeln].flatMap(([id, r]) => (r !== 'unbekannt' && r.art === 'abwesend' ? [id] : [])),
  );
}
