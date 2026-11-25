/**
 * **Mein Stand in einer Abfrage** (Bauplan R-3, 25.11.2026): was Mitarbeitende zu einer laufenden Abfrage sehen – die Karte
 * auf der Startseite, das Band in „Wann kann ich?“ und (später, R-5) das Austragen beim Antworten. Nur Rechnen und Texte;
 * geladen wird in `dienstplaner/src/useAbfragen.ts`.
 *
 * **Eine Rechnung für alle:** „Offen“ ist ausschließlich `offeneTermine` (`erinnern.ts`) – dieselbe Regel wie bei „Erinnern“.
 * Hier werden ihr nur die Fragen der eigenen Daten beantwortet:
 * - `beantwortet`: eigene Ja/Vielleicht-Antwort (`antworten`, wie „Wann kann ich?“) **oder** eigene Abwesenheit, die den
 *   Termin deckt (`decktTermin`, dieselbe Regel wie überall);
 * - `eingeteilt`: eigener Dienst (zugesagt oder angefragt) an dem Termin **in dieser Dienstgruppe**;
 * - `pausiert`: nie – Mitarbeitende können ihre Pause nicht lesen, Pausierte sehen die Karte (Alwin, 25.11.2026).
 */
import { decktTermin } from '../absences/index';
import { MONATE, monatName, monatPlus, monateBis, plusTage, tagKurz, tagMonat } from '../ct/datum';
import type { CtAbsence } from '../ct/typen';
import {
  abfrageZustand,
  erinnerungsTage,
  geltenderPlan,
  type Abfrage,
  type AbfragenInhalt,
} from './abfragen';
import { abfrageEtikett } from './abfrageFenster';
import { offeneTermine } from './erinnern';
import type { Antworten } from './verfuegbarkeit';

/** Was von einem Termin gebraucht wird: Tag, Zeitfenster (für Abwesenheiten) und ob er abgesagt ist. */
export interface StandTermin {
  id: number;
  /** `YYYY-MM-DD` in Ortszeit der Gemeinde. */
  tag: string;
  abgesagt?: boolean;
  /** Beginn und Ende, wie ChurchTools sie liefert (`TerminZeile.beginn`/`ende`). */
  beginn: string;
  ende: string;
}

/**
 * **Deckt eine der eigenen Abwesenheiten diesen Termin?** Die eine Stelle für die Frage auf der Startseite
 * („Du bist an dem Tag als abwesend eingetragen“) und in der Abfrage (Nein = Abwesenheit); die Regel selbst ist
 * `decktTermin`.
 */
export const abwesendAm = (abwesenheiten: readonly CtAbsence[], t: StandTermin): boolean =>
  abwesenheiten.some((a) =>
    decktTermin(
      {
        startDate: a.startDate,
        endDate: a.endDate,
        startTime: a.startTime ?? null,
        endTime: a.endTime ?? null,
      },
      { startDate: t.beginn, endDate: t.ende, date: t.tag },
    ),
  );

/**
 * **Die Termine, an denen ich in dieser Dienstgruppe eingeteilt bin** (zugesagt oder angefragt – `meine` kennt beides).
 * Welcher Dienst zu welcher Dienstgruppe gehört, sagt `gruppeVonDienst` (`Start.dienste`); ein Platz ohne bekannten Dienst
 * (`ort: null`) lässt sich keiner Gruppe zuordnen und zählt nicht – dann bleibt der Termin offen, nichts wird still
 * weggelassen.
 */
export function eingeteilteTermine(
  zeilen: readonly { id: number; meine: readonly { ort: { serviceId: number } | null }[] }[],
  dienstgruppeId: number,
  gruppeVonDienst: (serviceId: number) => number | null | undefined,
): Set<number> {
  return new Set(
    zeilen
      .filter((z) =>
        z.meine.some((d) => d.ort !== null && gruppeVonDienst(d.ort.serviceId) === dienstgruppeId),
      )
      .map((z) => z.id),
  );
}

export interface MeinStand<T> {
  /** Die Termine der Abfrage, an denen noch etwas fehlt (in der Reihenfolge der Abfrage). */
  offen: T[];
  /** Alle Termine der Abfrage (so viele hat der Planer beim Start gezählt). */
  gesamt: number;
}

/**
 * **Mein Stand in der Abfrage:** `termine` sind alle bekannten Termine (mehr als die der Abfrage dürfen darunter sein –
 * es zählen nur die IDs in `abfrage.termine`; ein Termin, der nicht (mehr) da ist, zählt nicht als offen).
 */
export function meinStandInAbfrage<T extends StandTermin>(o: {
  abfrage: Pick<Abfrage, 'termine'>;
  termine: readonly T[];
  /** Die eigenen Ja/Vielleicht-Antworten (Termin-ID als Text). */
  antworten: Antworten;
  abwesenheiten: readonly CtAbsence[];
  /** Termin-IDs, an denen ich in der Dienstgruppe eingeteilt bin (`eingeteilteTermine`). */
  eingeteilt: ReadonlySet<number>;
  heute: string;
}): MeinStand<T> {
  const nachId = new Map(o.termine.map((t) => [t.id, t]));
  const dieseTermine = o.abfrage.termine.flatMap((id) => {
    const t = nachId.get(id);
    return t ? [t] : [];
  });
  const { offen } = offeneTermine({
    termine: dieseTermine,
    heute: o.heute,
    beantwortet: (t) => o.antworten[String(t.id)] !== undefined || abwesendAm(o.abwesenheiten, t),
    eingeteilt: (t) => o.eingeteilt.has(t.id),
    pausiert: () => false,
  });
  return { offen, gesamt: o.abfrage.termine.length };
}

// ── Texte ───────────────────────────────────────────────────────────────────

/** „Februar“ · „Februar und März“ · „Februar, März und April“ – die Monate von `von` bis `bis`. */
export function monateText(von: string, bis: string): string {
  const n = Math.max(0, monateBis(von, bis));
  const namen = Array.from({ length: n + 1 }, (_, i) =>
    monatName(`${monatPlus(von.slice(0, 7), i)}-01`),
  );
  return namen.length === 1
    ? namen[0]
    : `${namen.slice(0, -1).join(', ')} und ${namen[namen.length - 1]}`;
}

/** Der Titel der Karte als Frage: „Wann kannst du im Februar und März?“ (ein Monat: „im Februar“). */
export const abfrageFrage = (a: Pick<Abfrage, 'von' | 'bis'>): string =>
  `Wann kannst du im ${monateText(a.von, a.bis)}?`;

/** „Feb“ oder „Feb–Mär“ – die Monate kurz, für die Zeile des Planers. */
export function monateKurz(a: Pick<Abfrage, 'von' | 'bis'>): string {
  const kurz = (t: string) => MONATE[Number(t.slice(5, 7)) - 1].slice(0, 3);
  const v = kurz(a.von);
  const b = kurz(a.bis);
  return a.von.slice(0, 7) === a.bis.slice(0, 7) ? v : `${v}–${b}`;
}

const termineText = (n: number) => `${n} ${n === 1 ? 'Termin' : 'Termine'}`;

/** „Musik fragt für 9 Termine (01.02.–31.03.). Noch 7 offen.“ */
export const abfrageKartenText = (o: {
  gruppe: string;
  abfrage: Pick<Abfrage, 'von' | 'bis'>;
  stand: Pick<MeinStand<unknown>, 'gesamt'> & { offen: number };
}): string =>
  `${o.gruppe} fragt für ${termineText(o.stand.gesamt)} (${tagMonat(o.abfrage.von)}–${tagMonat(o.abfrage.bis)}). Noch ${o.stand.offen} offen.`;

/** „Abfrage Musik · 01.02.–31.03. · noch 7 von 9 offen“ – das Band in „Wann kann ich?“ (`stand` fehlt, solange es lädt). */
export const abfrageBandText = (o: {
  gruppe: string;
  abfrage: Pick<Abfrage, 'von' | 'bis'>;
  stand: { offen: number; gesamt: number } | null;
}): string =>
  `Abfrage ${o.gruppe} · ${tagMonat(o.abfrage.von)}–${tagMonat(o.abfrage.bis)}${
    o.stand ? ` · noch ${o.stand.offen} von ${o.stand.gesamt} offen` : ''
  }`;

/** „Abfrage Musik · Feb–Mär“ – die Zeile des Planers. */
export const abfrageZeilenTitel = (o: { gruppe: string; abfrage: Pick<Abfrage, 'von' | 'bis'> }) =>
  `Abfrage ${o.gruppe} · ${monateKurz(o.abfrage)}`;

/**
 * Das Etikett auf Karte, Band und Zeile: **blau „bis Di, 05.01.“** vor der Frist, **rot „Frist vorbei“** danach (der Stand
 * im Fenster sagt dasselbe genauer: `abfrageEtikett`, „Frist war …“). Geplant: grau „öffnet …“; beendet: keins.
 */
export function abfrageKartenEtikett(
  a: Abfrage,
  heute: string,
): { ton: 'neutral' | 'blau' | 'rot'; text: string } | null {
  return abfrageZustand(a, heute) === 'fristVorbei'
    ? { ton: 'rot', text: 'Frist vorbei' }
    : abfrageEtikett(a, heute);
}

/**
 * „nächste Erinnerung So, 03.01.“ – der erste Erinnerungstag **ab morgen** (`erinnerungsTage`); `null`, wenn keiner mehr kommt.
 * Bei laufender Abfrage ist die Erinnerung von heute schon raus (gegen 0:15 Uhr bzw. beim Start) – **eine Regel** für die
 * Startseite und überall, wo sie steht.
 */
export function naechsteErinnerungText(
  inhalt: AbfragenInhalt,
  abfrage: Abfrage,
  heute: string,
): string | null {
  const tag = erinnerungsTage(geltenderPlan(inhalt), abfrage, plusTage(heute, 1))[0];
  return tag ? `nächste Erinnerung ${tagKurz(tag)}` : null;
}
