/**
 * **Vorschläge für Tagesordnungspunkte** (Bauplan S5-4, entschieden 06.11.2026) – ein Wert je Vorschlag in der Kategorie
 * „Mitarbeit“ der Gruppe (wie die To-Dos: Mitglieder dürfen dort schreiben, im Protokoll nicht).
 *
 * - Ein Vorschlag gilt **für eine bestimmte Sitzung** – oder, wenn keine festgelegt ist, **für die nächste**: Er rutscht
 *   von selbst zu ihr, sobald die Leitung eine festlegt (`zielSitzung`). Fällt seine Sitzung weg (abgesagt, ohne ihn
 *   freigegeben), rutscht ein offener Vorschlag ebenso weiter – nichts geht verloren.
 * - Alle in der Gruppe sehen alle Vorschläge. Ändern und zurückziehen darf, wer vorschlug, **solange er offen ist**.
 * - Die Leitung **übernimmt** (der Punkt kommt vor „Verschiedenes“, sonst ans Ende), schiebt ihn aufs **nächste Mal**
 *   oder **lehnt ab** (Begründung freiwillig). Bei „Direkt eintragen“ landen offene Vorschläge von selbst im Protokoll.
 * - Im Protokoll trägt der Punkt die Block-ID `vorschlag-<ID>` (`vorschlagBlockId`): So wird er nie doppelt eingefügt,
 *   auch wenn das Vermerken „im Protokoll“ danach scheitert und beim nächsten Öffnen erneut versucht wird.
 * - **Nie hart löschen** (wie bei den To-Dos, S0): Zurückziehen ist ein Stand, kein Löschen.
 */
import { tagAusIso } from '../ct/zeit';
import { punktEbene, textAus, type Block } from './dokument';
import { gehoertZu, type Sitzung } from './sitzungen';

export type VorschlagStand =
  | 'offen'
  /** Die Leitung hat ihn in der Liste übernommen; er kommt beim nächsten Öffnen des Protokolls hinein. */
  | 'angenommen'
  | 'imProtokoll'
  | 'abgelehnt'
  | 'zurueckgezogen';

/**
 * Wofür der Vorschlag gilt: eine bestimmte Sitzung (wie `gehoertZu` sie wiederfindet, dazu die Protokoll-ID, falls
 * schon eines begonnen war) – oder die nächste Sitzung **nach** einem Zeitpunkt (`null` = ab heute).
 */
export type VorschlagZiel =
  | {
      art: 'sitzung';
      beginn: string;
      termin: { kalender: number; id: number } | null;
      treffen: number | null;
      sitzung: string | null;
    }
  | { art: 'naechste'; nach: string | null };

export interface VorschlagVerlauf {
  /** ISO-Zeit. */
  am: string;
  von: number;
  name: string;
  art:
    | 'angelegt'
    | 'geaendert'
    | 'verschoben'
    | 'angenommen'
    | 'imProtokoll'
    | 'abgelehnt'
    | 'zurueckgezogen';
}

export interface Vorschlag {
  art: 'vorschlag';
  fassung: 1;
  id: string;
  gruppe: number;
  titel: string;
  /** Freiwillig; leer = kein Text. */
  text: string;
  /** Wer vorschlug – mit Namen, weil Mitglieder die Mitgliederliste oft nicht sehen (wie `mitNamen` bei To-Dos). */
  von: number;
  name: string;
  ziel: VorschlagZiel;
  stand: VorschlagStand;
  /** Begründung beim Ablehnen – leer = keine. */
  grund: string;
  /** Protokoll (Kopf-ID), in dem der Punkt steht – nur bei `imProtokoll`. */
  sitzung: string | null;
  verlauf: VorschlagVerlauf[];
}

export const TITEL_MAX = 120;

const istZiel = (z: unknown): z is VorschlagZiel => {
  const x = z as Partial<Record<string, unknown>> | null;
  if (!x) return false;
  if (x.art === 'naechste') return x.nach === null || typeof x.nach === 'string';
  return (
    x.art === 'sitzung' &&
    typeof x.beginn === 'string' &&
    (x.treffen === null || typeof x.treffen === 'number') &&
    (x.sitzung === null || typeof x.sitzung === 'string') &&
    (x.termin === null ||
      (typeof (x.termin as { kalender?: unknown })?.kalender === 'number' &&
        typeof (x.termin as { id?: unknown }).id === 'number'))
  );
};

const STAENDE: readonly VorschlagStand[] = [
  'offen',
  'angenommen',
  'imProtokoll',
  'abgelehnt',
  'zurueckgezogen',
];

export function istVorschlag(x: unknown): x is Vorschlag {
  const v = x as Partial<Vorschlag> | null;
  return (
    !!v &&
    v.art === 'vorschlag' &&
    v.fassung === 1 &&
    typeof v.id === 'string' &&
    typeof v.gruppe === 'number' &&
    typeof v.titel === 'string' &&
    typeof v.text === 'string' &&
    typeof v.von === 'number' &&
    typeof v.name === 'string' &&
    istZiel(v.ziel) &&
    STAENDE.includes(v.stand as VorschlagStand) &&
    typeof v.grund === 'string' &&
    (v.sitzung === null || typeof v.sitzung === 'string') &&
    Array.isArray(v.verlauf)
  );
}

/** Wer gerade schreibt – Person und Name für den Verlauf. */
export interface Vorschlagend {
  person: number;
  name: string;
}

const eintrag = (
  art: VorschlagVerlauf['art'],
  ich: Vorschlagend,
  am: string,
): VorschlagVerlauf => ({
  am,
  von: ich.person,
  name: ich.name,
  art,
});

/** Das Ziel „diese Sitzung“ – so, dass `zielSitzung` sie auch nach dem Beginnen eines Protokolls wiederfindet. */
export function zielVon(s: Pick<Sitzung, 'beginn' | 'termin' | 'treffen' | 'kopf'>): VorschlagZiel {
  return {
    art: 'sitzung',
    beginn: s.beginn,
    termin: s.termin,
    treffen: s.treffen,
    sitzung: s.kopf?.sitzung ?? null,
  };
}

export const NAECHSTE: VorschlagZiel = { art: 'naechste', nach: null };

export function neuerVorschlag(q: {
  id: string;
  gruppe: number;
  titel: string;
  text: string;
  ziel: VorschlagZiel;
  ich: Vorschlagend;
  am: string;
}): Vorschlag {
  return {
    art: 'vorschlag',
    fassung: 1,
    id: q.id,
    gruppe: q.gruppe,
    titel: q.titel.trim().slice(0, TITEL_MAX),
    text: q.text.trim(),
    von: q.ich.person,
    name: q.ich.name,
    ziel: q.ziel,
    stand: 'offen',
    grund: '',
    sitzung: null,
    verlauf: [eintrag('angelegt', q.ich, q.am)],
  };
}

/** Ein Vorschlag, der schon entschieden ist, bleibt, wie er ist – wer ihn ändern will, bekommt einen Fehler. */
export class SchonEntschieden extends Error {
  constructor() {
    super('Über diesen Vorschlag hat die Leitung schon entschieden.');
  }
}
const nurOffen = (v: Vorschlag): void => {
  if (v.stand !== 'offen') throw new SchonEntschieden();
};

/** Ändern (wer vorschlug) – nur solange offen. */
export function vorschlagAendern(
  v: Vorschlag,
  x: { titel: string; text: string; ziel: VorschlagZiel },
  ich: Vorschlagend,
  am: string,
): Vorschlag {
  nurOffen(v);
  return {
    ...v,
    titel: x.titel.trim().slice(0, TITEL_MAX),
    text: x.text.trim(),
    ziel: x.ziel,
    verlauf: [...v.verlauf, eintrag('geaendert', ich, am)],
  };
}

export function zurueckziehen(v: Vorschlag, ich: Vorschlagend, am: string): Vorschlag {
  nurOffen(v);
  return {
    ...v,
    stand: 'zurueckgezogen',
    verlauf: [...v.verlauf, eintrag('zurueckgezogen', ich, am)],
  };
}

export function ablehnen(v: Vorschlag, grund: string, ich: Vorschlagend, am: string): Vorschlag {
  nurOffen(v);
  return {
    ...v,
    stand: 'abgelehnt',
    grund: grund.trim(),
    verlauf: [...v.verlauf, eintrag('abgelehnt', ich, am)],
  };
}

/** Übernehmen in der Liste: für diese Sitzung vorgemerkt, eingefügt wird beim Öffnen des Protokolls. */
export function annehmen(
  v: Vorschlag,
  s: Pick<Sitzung, 'beginn' | 'termin' | 'treffen' | 'kopf'>,
  ich: Vorschlagend,
  am: string,
): Vorschlag {
  nurOffen(v);
  return {
    ...v,
    stand: 'angenommen',
    ziel: zielVon(s),
    verlauf: [...v.verlauf, eintrag('angenommen', ich, am)],
  };
}

/**
 * „Nächstes Mal“: zur nächsten Sitzung **nach** dieser – auch zu einer, die es noch nicht gibt. Ein schon angenommener
 * Vorschlag wird dabei wieder offen.
 */
export function aufsNaechsteMal(
  v: Vorschlag,
  s: Pick<Sitzung, 'beginn'>,
  ich: Vorschlagend,
  am: string,
): Vorschlag {
  if (v.stand !== 'offen' && v.stand !== 'angenommen') throw new SchonEntschieden();
  return {
    ...v,
    stand: 'offen',
    ziel: { art: 'naechste', nach: s.beginn },
    verlauf: [...v.verlauf, eintrag('verschoben', ich, am)],
  };
}

/** Steht im Protokoll `sitzung` (Kopf-ID). Schon vermerkt → bleibt, wie er ist (zweiter Versuch). */
export function imProtokoll(
  v: Vorschlag,
  sitzung: string,
  ich: Vorschlagend,
  am: string,
): Vorschlag {
  if (v.stand === 'imProtokoll') return v;
  return {
    ...v,
    stand: 'imProtokoll',
    sitzung,
    verlauf: [...v.verlauf, eintrag('imProtokoll', ich, am)],
  };
}

/**
 * **Zu welcher Sitzung gehört der Vorschlag gerade?** `kommend` wie `sitzungenOrdnen` (nach Beginn sortiert).
 * - Eine bestimmte Sitzung, die noch kommt (auch ein begonnenes Protokoll von gestern): diese.
 * - Sonst die nächste ab heute (bzw. nach `nach`) – `null`, wenn keine festgelegt ist („Nächste Sitzung“).
 */
export function zielSitzung(
  v: Pick<Vorschlag, 'ziel'>,
  kommend: readonly Sitzung[],
  heute: string,
  zeitzone: string,
): Sitzung | null {
  const z = v.ziel;
  const da = genau(z, kommend);
  if (da) return da;
  const nach = z.art === 'naechste' ? z.nach : z.beginn;
  return (
    kommend.find(
      (s) =>
        tagAusIso(s.beginn, zeitzone) >= heute &&
        (nach === null || Date.parse(s.beginn) > Date.parse(nach)),
    ) ?? null
  );
}

/** Wer darf hier was? Mitglied: eigene, offene ändern/zurückziehen. Leitung: offene entscheiden. */
export function darfAendern(v: Vorschlag, ich: number): boolean {
  return v.stand === 'offen' && v.von === ich;
}

export interface VorschlagGruppe {
  /** `null` = „Nächste Sitzung“ (noch nicht festgelegt). */
  sitzung: Sitzung | null;
  vorschlaege: Vorschlag[];
}

/** So lange stehen entschiedene Vorschläge unter „Erledigt“, nachdem ihre Sitzung vorbei ist. */
export const ERLEDIGT_TAGE = 60;

/**
 * **Die Karte „Vorschläge“** (Reiter „Sitzungen“): je kommende Sitzung (in ihrer Reihenfolge), dann „Nächste Sitzung“,
 * dann „Erledigt“ (entschieden, Sitzung vorbei, höchstens `ERLEDIGT_TAGE` alt; neueste zuerst). Zurückgezogene nie.
 * Offene und angenommene folgen `zielSitzung`; im Protokoll stehende ihrer Sitzung; abgelehnte ihrem Ziel.
 */
export function vorschlaegeOrdnen(
  liste: readonly Vorschlag[],
  kommend: readonly Sitzung[],
  heute: string,
  zeitzone: string,
): { gruppen: VorschlagGruppe[]; erledigt: Vorschlag[] } {
  const je = new Map<Sitzung | null, Vorschlag[]>();
  const erledigt: Vorschlag[] = [];
  const dazu = (s: Sitzung | null, v: Vorschlag) => je.set(s, [...(je.get(s) ?? []), v]);
  for (const v of liste) {
    if (v.stand === 'zurueckgezogen') continue;
    if (v.stand === 'offen' || v.stand === 'angenommen') {
      dazu(zielSitzung(v, kommend, heute, zeitzone), v);
      continue;
    }
    const s =
      v.stand === 'imProtokoll'
        ? kommend.find((x) => x.kopf?.sitzung === v.sitzung)
        : genau(v.ziel, kommend);
    if (s) dazu(s, v);
    else erledigt.push(v);
  }
  const zuletzt = (v: Vorschlag) => v.verlauf[v.verlauf.length - 1]?.am ?? '';
  const grenze = Date.parse(`${heute}T00:00:00Z`) - ERLEDIGT_TAGE * 86_400_000;
  return {
    gruppen: [
      ...kommend.filter((s) => je.has(s)).map((s) => ({ sitzung: s, vorschlaege: je.get(s)! })),
      ...(je.has(null) ? [{ sitzung: null, vorschlaege: je.get(null)! }] : []),
    ],
    erledigt: erledigt
      .filter((v) => Date.parse(zuletzt(v)) >= grenze)
      .sort((a, b) => zuletzt(b).localeCompare(zuletzt(a))),
  };
}

/** Die Sitzung, die das Ziel genau meint (ohne Weiterrutschen) – die eine Stelle für `zielSitzung` und „Erledigt“. */
function genau(z: VorschlagZiel, kommend: readonly Sitzung[]): Sitzung | undefined {
  if (z.art !== 'sitzung') return undefined;
  return kommend.find(
    (s) =>
      (z.sitzung !== null && s.kopf?.sitzung === z.sitzung) ||
      gehoertZu({ beginn: z.beginn, termin: z.termin, treffen: z.treffen }, s),
  );
}

/**
 * **Was beim Öffnen des Protokolls hinein soll** (Sitzung über ihren `schluessel` verglichen – nach einem Nachladen ist
 * sie ein neues Objekt): angenommene dieser Sitzung – und bei „Direkt eintragen“ auch die
 * offenen. Reihenfolge wie vorgeschlagen.
 */
export function zumEinfuegen(
  liste: readonly Vorschlag[],
  s: Sitzung,
  direkt: boolean,
  kommend: readonly Sitzung[],
  heute: string,
  zeitzone: string,
): Vorschlag[] {
  return liste
    .filter(
      (v) =>
        (v.stand === 'angenommen' || (direkt && v.stand === 'offen')) &&
        zielSitzung(v, kommend, heute, zeitzone)?.schluessel === s.schluessel,
    )
    .sort((a, b) => (a.verlauf[0]?.am ?? '').localeCompare(b.verlauf[0]?.am ?? ''));
}

/** Die offenen Vorschläge einer Sitzung – für den Kasten beim Schreiben. */
export function offeneFuer(
  liste: readonly Vorschlag[],
  s: Sitzung,
  kommend: readonly Sitzung[],
  heute: string,
  zeitzone: string,
): Vorschlag[] {
  return liste.filter(
    (v) =>
      v.stand === 'offen' && zielSitzung(v, kommend, heute, zeitzone)?.schluessel === s.schluessel,
  );
}

/** Block-ID des Tagesordnungspunkts, der aus dem Vorschlag entsteht. */
export const vorschlagBlockId = (v: Pick<Vorschlag, 'id'>): string => `vorschlag-${v.id}`;

/** Steht der Punkt schon im Dokument (auch eingerückt)? */
export function schonImDokument(dokument: readonly Block[], v: Pick<Vorschlag, 'id'>): boolean {
  const id = vorschlagBlockId(v);
  const suche = (bs: readonly Block[]): boolean =>
    bs.some((b) => b.id === id || suche(b.children ?? []));
  return suche(dokument);
}

/** „Verschiedenes“ – vor diesen Tagesordnungspunkt kommen übernommene Vorschläge (Alwin 06.11.2026). */
const VERSCHIEDENES = /^\s*verschiedenes\s*$/i;

/** Block-ID des Tagesordnungspunkts „Verschiedenes“ (oberste Ebene) – `null`: keiner, dann ans Ende. */
export function einfuegeStelle(dokument: readonly Block[]): string | null {
  return (
    dokument.find((b) => punktEbene(b) === 0 && VERSCHIEDENES.test(textAus(b.content)))?.id ?? null
  );
}

/**
 * Die Blöcke eines übernommenen Vorschlags: Tagesordnungspunkt (Titel), klein der Vermerk „vorgeschlagen von …“, dann der
 * Text – oder eine leere Zeile für Notizen.
 */
export function vorschlagBloecke(v: Pick<Vorschlag, 'id' | 'titel' | 'text' | 'name'>): Block[] {
  return [
    {
      id: vorschlagBlockId(v),
      type: 'heading',
      props: { level: 1 },
      content: [{ type: 'text', text: v.titel, styles: {} }],
      children: [],
    },
    {
      id: `${vorschlagBlockId(v)}-von`,
      type: 'paragraph',
      content: [{ type: 'text', text: `vorgeschlagen von ${v.name}`, styles: { italic: true } }],
      children: [],
    },
    {
      id: `${vorschlagBlockId(v)}-text`,
      type: 'paragraph',
      content: v.text ? [{ type: 'text', text: v.text, styles: {} }] : [],
      children: [],
    },
  ];
}
