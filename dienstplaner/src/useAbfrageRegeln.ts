import { useLaden } from '@ui/ct/useLaden';
import { abfrageRegelAus, type AbfrageRegel } from '@shared/dienstplan/erinnern';
import type { AbfragenStand } from '@shared/dienstplan/abfragenSpeicher';

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
  const je = await Promise.all(
    dienstgruppenIds.map(async (id): Promise<[number, RegelStand]> => {
      try {
        const s = await lader(id);
        if (s.fehler !== null) return [id, 'unbekannt'];
        return [id, abfrageRegelAus(s.unlesbar ? null : s.inhalt, heute)];
      } catch {
        return [id, 'unbekannt'];
      }
    }),
  );
  return new Map(je);
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
