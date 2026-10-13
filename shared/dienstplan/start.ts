/**
 * **Was die Startseite des Dienstplaners zeigt** (Bauplan E3-3, Entwurf v17) – aus derselben
 * Terminliste wie der Reiter „Termine“ (`termine.ts`), ohne eigene Abfrage:
 *
 * - **Als Nächstes**: der nächste Termin, der noch nicht vorbei und nicht abgesagt ist,
 * - **Für dich offen**: deine Anfragen (angefragt, noch nicht zugesagt),
 * - **Deine nächsten Dienste**: zugesagt, ohne den Termin oben, höchstens vier,
 * - **Planen**: freie Plätze je Dienstgruppe, die du planst, in den nächsten sechs Wochen.
 */
import type { Dienstgruppe } from '../ct/dienstgruppen';
import { tageBis } from '../ct/datum';
import type { TerminZeile } from './termine';

/** Ein eigener Dienst an einem Termin. */
export interface DienstAmTermin {
  termin: TerminZeile;
  dienst: string;
}

export interface StartUebersicht {
  naechster: TerminZeile | null;
  offen: DienstAmTermin[];
  naechsteDienste: DienstAmTermin[];
  planen: { gruppe: Dienstgruppe; frei: number }[];
}

/** So weit schaut die Karte „Planen“ (Entwurf: „nächste 6 Wochen“). */
export const PLANEN_TAGE = 42;
/** So viele „nächste Dienste“ zeigt die Startseite; alle stehen unter „Termine → Meine“. */
export const NAECHSTE_DIENSTE = 4;

export function startUebersicht(
  zeilen: TerminZeile[],
  o: {
    /** Jetzt als Zeitpunkt – was davor endete, ist vorbei. */
    jetzt: Date;
    /** Heute als `YYYY-MM-DD` in Ortszeit. */
    heute: string;
    /** Die Dienstgruppen, die man plant, in der Reihenfolge der Gemeinde. */
    planbar: Dienstgruppe[];
  },
): StartUebersicht {
  const kommend = zeilen.filter((z) => !z.abgesagt && Date.parse(z.ende) >= o.jetzt.getTime());
  const naechster = kommend[0] ?? null;
  const offen: DienstAmTermin[] = [];
  const zugesagt: DienstAmTermin[] = [];
  for (const termin of kommend) {
    for (const d of termin.meine) {
      (d.zugesagt ? zugesagt : offen).push({ termin, dienst: d.dienst });
    }
  }
  const sechsWochen = kommend.filter((z) => tageBis(o.heute, z.tag) < PLANEN_TAGE);
  return {
    naechster,
    offen,
    naechsteDienste: zugesagt
      .filter((d) => d.termin.id !== naechster?.id)
      .slice(0, NAECHSTE_DIENSTE),
    planen: o.planbar.map((gruppe) => ({
      gruppe,
      frei: sechsWochen.reduce((n, z) => n + (z.freiNachGruppe[gruppe.id] ?? 0), 0),
    })),
  };
}

/** „heute“, „morgen“, „in 3 Tagen“ – wie weit der Termin weg ist. */
export function bisDahin(heute: string, tag: string): string {
  const n = tageBis(heute, tag);
  return n <= 0 ? 'heute' : n === 1 ? 'morgen' : `in ${n} Tagen`;
}
