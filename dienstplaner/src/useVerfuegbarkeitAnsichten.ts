/**
 * **Die Ansichten von „Verfügbarkeit“ laden** (V-3): welche eigenen Dienstgruppen nach Zusagen fragen und welche Termine
 * unter „Zusagen“ stehen. Die Regeln dazu stehen in `shared/dienstplan/verfuegbarkeitAnsicht.ts`; hier wird nur geholt.
 *
 * **Nichts geht verloren:** Ein Dokument, das sich nicht lesen lässt (Lesefehler, unlesbar, kein Netz), gilt wie der Startwert
 * als „Zusagen“ – dann sind Ja/Vielleicht da, wie vor V-3. Lassen sich die Termine nicht laden, stehen unter „Zusagen“ alle
 * Termine (ohne Schild), nicht keiner.
 */
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import { plusTage } from '@shared/ct/datum';
import { zusagenGruppen, zusagenTermine } from '@shared/dienstplan/verfuegbarkeitAnsicht';
import type { AbfragenInhalt } from '@shared/dienstplan/abfragen';
import { useLaden } from '@ui/ct/useLaden';
import { ladeAbfragen } from './ladeAbfragen';
import { ladeRohTermine } from './ladeTermine';
import { ganzSichtbar, type Start } from './start';

/**
 * Die eigenen Gruppen, die nach Zusagen fragen. Liest je Gruppe das Dokument `dienstplaner-abfragen-<id>`; **wirft nie**
 * (jeder Fehler einer Gruppe ergibt „nicht lesbar“ = Zusagen).
 */
export async function ladeZusagenGruppen(
  gruppen: readonly Dienstgruppe[],
): Promise<Dienstgruppe[]> {
  const inhalte = new Map<number, AbfragenInhalt | null>(
    await Promise.all(
      gruppen.map(async (g): Promise<[number, AbfragenInhalt | null]> => {
        try {
          const s = await ladeAbfragen(g.id);
          return [g.id, s.fehler !== null || s.unlesbar ? null : s.inhalt];
        } catch {
          return [g.id, null];
        }
      }),
    ),
  );
  return zusagenGruppen(gruppen, (id) => inhalte.get(id) ?? null);
}

/**
 * **Liefert ChurchTools die Plätze dieser Gruppen vollständig?** Nur dann sagt „kein Platz an diesem Termin“ etwas. Sonst liefert es
 * einem einfachen Mitglied zu einem Dienst nur die **eigenen** Einträge (`siehtDienstGanz`, gemessen 13.10.2026) – die Termine, an denen
 * die Gruppe Dienste hat, die Person aber nicht eingeteilt ist (genau die, die eine Antwort brauchen), fehlten in der Liste. Dieselbe Frage
 * wie bei der Matrix (`ganzSichtbar`): Ein Dienst einer der Gruppen, den man nicht ganz sieht, macht die Liste unvollständig.
 */
export function platzeVollstaendig(start: Start, gruppen: readonly Dienstgruppe[]): boolean {
  const ids = new Set(gruppen.map((g) => g.id));
  return [...start.dienste.values()]
    .filter((d) => d.dienstgruppeId !== null && ids.has(d.dienstgruppeId))
    .every((d) => ganzSichtbar(start, d));
}

/**
 * Die Termine von `von` bis `bis` (einschließlich), an denen eine der Gruppen Dienste hat – mit den Namen dieser Gruppen. Wirft wie
 * `ladeRohTermine`. **`null`: nicht zu ermitteln** (die Plätze kommen nicht vollständig, `platzeVollstaendig`) – dann stehen unter
 * „Zusagen“ alle Termine, nichts geht verloren; geladen wird dafür gar nichts.
 */
export async function ladeZusagenTermine(
  start: Start,
  gruppen: readonly Dienstgruppe[],
  von: string,
  bis: string,
): Promise<Map<number, string[]> | null> {
  if (!platzeVollstaendig(start, gruppen)) return null;
  const roh = await ladeRohTermine(von, plusTage(bis, 1));
  return zusagenTermine(roh, (serviceId) => start.dienste.get(serviceId)?.dienstgruppeId, gruppen);
}

/** Was `useZusagenGruppen` liefert: `bereit`, sobald gelesen ist (oder es nichts zu lesen gibt). */
export interface ZusagenGruppenStand {
  bereit: boolean;
  gruppen: Dienstgruppe[];
}
const KEINE_GRUPPEN: Dienstgruppe[] = [];

/** Lädt beim Öffnen, wer von den eigenen Gruppen nach Zusagen fragt. Ohne eigene Gruppe: sofort bereit und leer. */
export function useZusagenGruppen(dienstgruppen: Dienstgruppe[]): ZusagenGruppenStand {
  const { stand } = useLaden(
    () => (dienstgruppen.length === 0 ? null : ladeZusagenGruppen(dienstgruppen)),
    [dienstgruppen],
  );
  // Ohne eigene Gruppe gibt es nichts zu lesen – sofort bereit (nicht erst nach dem ersten Zeichnen).
  if (dienstgruppen.length === 0) return { bereit: true, gruppen: KEINE_GRUPPEN };
  if (stand.art === 'fertig') return { bereit: true, gruppen: stand.daten };
  // `ladeZusagenGruppen` wirft nie; käme dennoch ein Fehler, gilt alles als „Zusagen“ – nichts geht verloren.
  if (stand.art === 'fehler') return { bereit: true, gruppen: dienstgruppen };
  return { bereit: false, gruppen: KEINE_GRUPPEN };
}

/** Woher die Termine der Ansicht „Zusagen“ kommen: aus dem Kontext der Seite (Start, Zusagen-Gruppen). */
export interface ZusagenQuelle {
  start: Start | undefined;
  gruppen: Dienstgruppe[];
}

/**
 * Der Hook für `Ansichten.useZusagenTermine`: lädt nur, solange die Ansicht offen ist (`aktiv`) und ein `start` da ist.
 * `undefined` = lädt, `null` = nicht zu ermitteln (kein Start, kein Netz) – dann zeigt die Seite alle Termine.
 */
export function useZusagenTermineVon(
  quelle: ZusagenQuelle,
  bereich: { von: string; bis: string },
  aktiv: boolean,
): ReadonlyMap<number, string[]> | null | undefined {
  const { start, gruppen } = quelle;
  const { stand } = useLaden(
    () =>
      aktiv && start && gruppen.length > 0
        ? ladeZusagenTermine(start, gruppen, bereich.von, bereich.bis)
        : null,
    [aktiv, start, gruppen, bereich.von, bereich.bis],
  );
  if (stand.art === 'fertig') return stand.daten;
  if (stand.art === 'laedt') return undefined;
  // `aus` (nicht aktiv, kein Start, keine Gruppe) oder ein Fehler: nicht zu ermitteln.
  return null;
}
