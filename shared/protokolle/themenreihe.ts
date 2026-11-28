/**
 * **Themenreihe** (Protokolle, Baustein „Reihe“, Scheibe 1; sichtbarer Name „Reihe“ – im Code `themenreihe`, weil
 * `terminReihe.ts` schon die Wiederholung eines Termins meint). Eine Gruppe plant im Treffen eine Themen- oder Predigtreihe:
 * eine Zeile je Abend mit Datum, ChurchTools-Event, Thema, Wer, Bibelstelle und Notiz. „In Events übertragen“ schreibt jeder
 * Zeile ihren Teil in die „Infos“ (`description`) ihres Events.
 *
 * **Wo sie liegt:** ein Wert je Reihe in „Mitarbeit“ (wie ein To-Do, Entscheidung 27.11.2026) – nicht im Protokoll: Ein
 * freigegebenes Protokoll ist fest, Events ordnet man aber meist erst danach zu. Der Editor-Block trägt nur `props.reihe` =
 * die ID dieses Werts (wie `props.aufgabe`). **Nie hart löschen** (S0): eine Reihe wird nur als gelöscht vermerkt.
 *
 * **Eigene Kennung** (`art: 'themenreihe'`): kein To-Do-Leser (`istAufgabe`) hält sie für ein To-Do.
 *
 * **Der Abschnitt im Event:** Die Reihe schreibt nur zwischen zwei Markierungszeilen. Was sonst in den Infos steht (Handtext),
 * bleibt Zeichen für Zeichen stehen; ein Event trägt höchstens EINEN Reihe-Abschnitt (beim Umbenennen der Reihe wird der alte
 * ersetzt, nicht ein zweiter angehängt). Ein kaputter Abschnitt (Start ohne Ende, zwei Starts, Ende vor Start) wird nie
 * geraten – es wird nichts geschrieben (`beschaedigt`).
 */
import { plusTage, tagMonatKurz } from '../ct/datum';
import { tagAusIso } from '../ct/zeit';
import { INFOS_MAX } from '../ct/terminInfos';

export interface ReiheWer {
  /** ChurchTools-Person, `null` = freier Name. */
  personId: number | null;
  name: string;
}

export interface ReiheZeile {
  id: string;
  /** `JJJJ-MM-TT`; leer = noch kein Datum. */
  datum: string;
  /** Das ChurchTools-Event dieses Abends, `null` = noch keins. */
  eventId: number | null;
  /** Der Name des Events beim Zuordnen – nur zur Anzeige. */
  eventTitel: string;
  thema: string;
  wer: ReiheWer | null;
  bibelstelle: string;
  notiz: string;
}

export interface Themenreihe {
  art: 'themenreihe';
  fassung: 1;
  id: string;
  gruppe: number;
  name: string;
  zeilen: ReiheZeile[];
  /** Wer sie zuletzt gespeichert hat und wann (ISO). */
  von: number;
  am: string;
  /** Als gelöscht vermerkt (nie hart löschen) – wer, wann. */
  geloescht?: { von: number; am: string };
}

const TAG = /^\d{4}-\d{2}-\d{2}$/;

/** Ist das ein gültiger Tag `JJJJ-MM-TT` (den es im Kalender gibt)? */
export function istTag(x: unknown): x is string {
  if (typeof x !== 'string' || !TAG.test(x)) return false;
  const d = new Date(`${x}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === x;
}

/**
 * **Ist das eine Reihe von uns?** Streng – für `derArt` und das Nachlesen (`wertNachgelesen` vergleicht den gelesenen mit
 * dem geschriebenen Wert, ein „tolerantes“ Umformen hier ließe jedes Nachlesen scheitern). Das tolerante Lesen der
 * Zeilen ist `reiheLesen`.
 */
export function istThemenreihe(x: unknown): x is Themenreihe {
  const r = x as Partial<Themenreihe> | null;
  return (
    !!r &&
    typeof r === 'object' &&
    r.art === 'themenreihe' &&
    r.fassung === 1 &&
    typeof r.id === 'string' &&
    typeof r.gruppe === 'number' &&
    typeof r.name === 'string' &&
    Array.isArray(r.zeilen) &&
    typeof r.von === 'number' &&
    typeof r.am === 'string' &&
    (r.geloescht === undefined ||
      (!!r.geloescht && typeof r.geloescht.von === 'number' && typeof r.geloescht.am === 'string'))
  );
}

const text = (x: unknown): string => (typeof x === 'string' ? x : '');

function werLesen(x: unknown): ReiheWer | null {
  const w = x as Partial<ReiheWer> | null;
  if (!w || typeof w !== 'object') return null;
  const name = text(w.name);
  const personId =
    typeof w.personId === 'number' && Number.isInteger(w.personId) ? w.personId : null;
  return name.trim() === '' && personId === null ? null : { personId, name };
}

/**
 * **Tolerant lesen:** eine Reihe, deren Zeilen unvollständig sind (ältere oder neuere Fassung, Handarbeit in ChurchTools),
 * mit Standardwerten – Zeilen ohne Gestalt fallen weg, ein ungültiges Datum wird leer. Immer die **normalisierte** Form
 * schreiben (`reiheSchreibform`), nie die rohe.
 */
export function reiheLesen(r: Themenreihe): Themenreihe {
  const zeilen = (Array.isArray(r.zeilen) ? r.zeilen : []).flatMap((z, i) => {
    if (!z || typeof z !== 'object') return [];
    const roh = z as Partial<ReiheZeile>;
    const ev = roh.eventId;
    return [
      {
        id: typeof roh.id === 'string' && roh.id !== '' ? roh.id : `z${i}`,
        datum: istTag(roh.datum) ? roh.datum : '',
        eventId: typeof ev === 'number' && Number.isInteger(ev) && ev > 0 ? ev : null,
        eventTitel: text(roh.eventTitel),
        thema: text(roh.thema),
        wer: werLesen(roh.wer),
        bibelstelle: text(roh.bibelstelle),
        notiz: text(roh.notiz),
      },
    ];
  });
  return { ...r, zeilen };
}

/** Die Zeilen nach Datum (stabil; Zeilen ohne Datum zuletzt) – so zählt „Teil n von m“. */
export function zeilenSortiert(zeilen: readonly ReiheZeile[]): ReiheZeile[] {
  return zeilen
    .map((z, i) => ({ z, i }))
    .sort((a, b) => {
      if (a.z.datum === b.z.datum) return a.i - b.i;
      if (a.z.datum === '') return 1;
      if (b.z.datum === '') return -1;
      return a.z.datum < b.z.datum ? -1 : 1;
    })
    .map((x) => x.z);
}

/** Die Form, die in „Mitarbeit“ geschrieben wird: normalisiert, Zeilen nach Datum. Immer diese, nie die rohe. */
export function reiheSchreibform(r: Themenreihe): Themenreihe {
  const n = reiheLesen(r);
  return { ...n, name: n.name.trim(), zeilen: zeilenSortiert(n.zeilen) };
}

export function neueZeile(id: string, datum: string): ReiheZeile {
  return {
    id,
    datum,
    eventId: null,
    eventTitel: '',
    thema: '',
    wer: null,
    bibelstelle: '',
    notiz: '',
  };
}

export function neueThemenreihe(a: {
  id: string;
  gruppe: number;
  name: string;
  zeilen: ReiheZeile[];
  von: number;
  am: string;
}): Themenreihe {
  return reiheSchreibform({
    art: 'themenreihe',
    fassung: 1,
    id: a.id,
    gruppe: a.gruppe,
    name: a.name,
    zeilen: a.zeilen,
    von: a.von,
    am: a.am,
  });
}

/** Als gelöscht vermerken – ein schon vermerkter bleibt, wie er ist. */
export const reiheGeloescht = (r: Themenreihe, von: number, am: string): Themenreihe =>
  r.geloescht ? r : { ...r, geloescht: { von, am } };

/**
 * **Auf einen Blick** (Reiter „Reihen“): erster und letzter Abend (nur aus Zeilen mit gültigem Datum, sonst `null`), Zahl der
 * Abende (alle Zeilen) und wie viele davon schon ein Event haben. Rechnet nichts nach, was die Zeilen nicht selbst sagen –
 * ob das Event noch in ChurchTools steht, liest der Reiter bewusst nicht.
 */
export function reiheUeberblick(r: Pick<Themenreihe, 'zeilen'>): {
  von: string | null;
  bis: string | null;
  abende: number;
  mitEvent: number;
} {
  const tage = r.zeilen
    .map((z) => z.datum)
    .filter(istTag)
    .sort();
  return {
    von: tage[0] ?? null,
    bis: tage.at(-1) ?? null,
    abende: r.zeilen.length,
    mitEvent: r.zeilen.filter((z) => z.eventId !== null).length,
  };
}

/**
 * **Der Zeitraum einer Reihe als Text:** „13. Jan – 10. Feb 2027“, über den Jahreswechsel „28. Dez 2026 – 11. Jan 2027“, ein
 * einzelner Tag „13. Jan 2027“, ohne Datum „ohne Datum“.
 */
export function reiheZeitraumText(von: string | null, bis: string | null): string {
  if (von === null || bis === null) return 'ohne Datum';
  if (von === bis) return `${tagMonatKurz(von)} ${von.slice(0, 4)}`;
  return von.slice(0, 4) === bis.slice(0, 4)
    ? `${tagMonatKurz(von)} – ${tagMonatKurz(bis)} ${bis.slice(0, 4)}`
    : `${tagMonatKurz(von)} ${von.slice(0, 4)} – ${tagMonatKurz(bis)} ${bis.slice(0, 4)}`;
}

/**
 * **Die Reihenfolge im Reiter „Reihen“:** zuerst laufende und kommende (letzter Abend ab `heute`) nach erstem Abend
 * aufsteigend, dann vergangene nach letztem Abend absteigend, Reihen ohne jedes Datum ans Ende. Gleichstand: wie geliefert.
 */
export function reihenOrdnen<T extends Pick<Themenreihe, 'zeilen'>>(
  reihen: readonly T[],
  heute: string,
): T[] {
  const mit = reihen.map((r, i) => ({ r, i, u: reiheUeberblick(r) }));
  const rang = (u: { bis: string | null }) => (u.bis === null ? 2 : u.bis >= heute ? 0 : 1);
  return mit
    .sort((a, b) => {
      const ra = rang(a.u);
      const rb = rang(b.u);
      if (ra !== rb) return ra - rb;
      if (ra === 0 && a.u.von !== b.u.von)
        return (a.u.von as string) < (b.u.von as string) ? -1 : 1;
      if (ra === 1 && a.u.bis !== b.u.bis)
        return (a.u.bis as string) > (b.u.bis as string) ? -1 : 1;
      return a.i - b.i;
    })
    .map((x) => x.r);
}

/** **Das Datum für „+ Abend“:** eine Woche nach dem letzten Abend – ohne Zeilen `heute`. */
export function naechstesDatum(zeilen: readonly ReiheZeile[], heute: string): string {
  const tage = zeilen.map((z) => z.datum).filter(istTag);
  return tage.length ? plusTage(tage.sort().at(-1) as string, 7) : heute;
}

/** Was fehlt, damit die Reihe gespeichert werden kann? `null` = nichts. Eine Stelle für das Fenster. */
export function reiheFehlt(r: Pick<Themenreihe, 'name' | 'zeilen'>): string | null {
  if (r.name.trim() === '') return 'Gib der Reihe einen Namen.';
  if (r.zeilen.some((z) => !istTag(z.datum))) return 'Jeder Abend braucht ein Datum.';
  const ids = r.zeilen.map((z) => z.eventId).filter((e): e is number => e !== null);
  if (new Set(ids).size !== ids.length)
    return 'Ein Event kann nur zu einem Abend gehören – ein Event ist doppelt gewählt.';
  return null;
}

// ── Der Abschnitt im Event ──────────────────────────────────────────────────────────────────────────────────

const START = '── Reihe ';
const ENDE = '── Ende Reihe (aus Protokolle) ──';
const ENDE_PRAEFIX = '── Ende Reihe';

/** Ein Wert in einer Zeile: Zeilenumbrüche werden zu Leerzeichen – ein Umbruch könnte eine Markierung vortäuschen. */
const einzeilig = (s: string): string => s.replace(/\s*[\r\n]+\s*/g, ' ').trim();

/**
 * **Der Abschnitt einer Zeile**, wie er in die Infos des Events kommt:
 * ```
 * ── Reihe „<Name>“ · Teil <n> von <m> ──
 * Thema: …
 * Wer: …
 * Bibelstelle: …
 * Notiz: …
 * ── Ende Reihe (aus Protokolle) ──
 * ```
 * Leere Felder fehlen. `n` zählt nach Datum (`zeilenSortiert`), `m` sind alle Zeilen. Ohne abschließendes Zeilenende
 * (sonst scheitert das Nachlesen in `infosSpeichern` womöglich dauerhaft).
 */
export function abschnitt(
  reihe: Pick<Themenreihe, 'name' | 'zeilen'>,
  zeilenIndex: number,
): string {
  const z = reihe.zeilen[zeilenIndex];
  if (!z) throw new Error(`Zeile ${zeilenIndex} gibt es nicht.`);
  const n = zeilenSortiert(reihe.zeilen).indexOf(z) + 1;
  const felder: [string, string][] = [
    ['Thema', einzeilig(z.thema)],
    ['Wer', einzeilig(z.wer?.name ?? '')],
    ['Bibelstelle', einzeilig(z.bibelstelle)],
    ['Notiz', einzeilig(z.notiz)],
  ];
  return [
    `${START}„${einzeilig(reihe.name)}“ · Teil ${n} von ${reihe.zeilen.length} ──`,
    ...felder.filter(([, v]) => v !== '').map(([k, v]) => `${k}: ${v}`),
    ENDE,
  ].join('\n');
}

const ohneCr = (l: string): string => l.replace(/\r$/, '');

export type Eingesetzt = { art: 'ok'; text: string; ersetzt: boolean } | { art: 'beschaedigt' };

/**
 * **Den Abschnitt in die Infos einsetzen.** Gibt es schon einen Reihe-Abschnitt, wird er ersetzt (der Rest bleibt Zeichen für
 * Zeichen); sonst kommt er mit einer Leerzeile Abstand ans Ende (bei leeren Infos: nur er). Genau ein Start und ein Ende
 * dahinter – alles andere ist `beschaedigt`, es wird nichts geraten.
 */
export function abschnittEinsetzen(alt: string, neuerAbschnitt: string): Eingesetzt {
  const zeilen = alt.split('\n');
  const starts: number[] = [];
  const enden: number[] = [];
  zeilen.forEach((l, i) => {
    const s = ohneCr(l);
    if (s.startsWith(START)) starts.push(i);
    if (s.startsWith(ENDE_PRAEFIX)) enden.push(i);
  });
  if (!starts.length && !enden.length) {
    if (alt.trim() === '') return { art: 'ok', text: neuerAbschnitt, ersetzt: false };
    const abstand = alt.endsWith('\n\n') ? '' : alt.endsWith('\n') ? '\n' : '\n\n';
    return { art: 'ok', text: alt + abstand + neuerAbschnitt, ersetzt: false };
  }
  if (starts.length !== 1 || enden.length !== 1 || enden[0] <= starts[0])
    return { art: 'beschaedigt' };
  const [von, bis] = [starts[0], enden[0]];
  // Zeilenenden des Abschnitts im Event beibehalten (ChurchTools-Web kann „\r\n“ speichern).
  const cr = zeilen[von].endsWith('\r');
  const neu = neuerAbschnitt
    .split('\n')
    .map((l, i, alle) => (cr && i < alle.length - 1 ? l + '\r' : l));
  const schluss = zeilen[bis].endsWith('\r') ? '\r' : '';
  neu[neu.length - 1] += schluss;
  return {
    art: 'ok',
    text: [...zeilen.slice(0, von), ...neu, ...zeilen.slice(bis + 1)].join('\n'),
    ersetzt: true,
  };
}

/** Der Abschnitt dieser Reihe im Text der Infos, oder `null`, wenn keiner dasteht (oder er kaputt ist). */
export function abschnittAus(infos: string): string | null {
  const l = infos.split('\n');
  const von = l.findIndex((x) => ohneCr(x).startsWith(START));
  const bis = l.findIndex((x) => ohneCr(x).startsWith(ENDE_PRAEFIX));
  return von < 0 || bis <= von
    ? null
    : l
        .slice(von, bis + 1)
        .map(ohneCr)
        .join('\n');
}

// ── Vorschau je Zeile ───────────────────────────────────────────────────────────────────────────────────────

export type VorschauArt =
  | 'neu'
  | 'geaendert'
  | 'aktuell'
  | 'ohneEvent'
  | 'nichtGelesen'
  | 'keinRecht'
  | 'beschaedigt'
  | 'zuLang'
  | 'doppelt';

export interface Vorschau {
  art: VorschauArt;
  /** Der Text, der in die Infos käme – bei `neu`, `geaendert`, `zuLang` (dann zu lang). */
  neuerText?: string;
  /** Der Text, der beim Öffnen in den Infos stand. */
  alterText?: string;
  /** Der Abschnitt dieser Zeile – für die Hervorhebung. */
  abschnitt?: string;
}

/** Was das Fenster über ein Event weiß: `null` = nicht (ablesbar) gelesen. */
export interface EventLage {
  /** Die Infos, wie sie beim Öffnen frisch gelesen wurden. */
  text: string;
  /** Darf der Nutzer die Infos dieses Events ändern (`darfTerminAendern`)? */
  darf: boolean;
}

/**
 * **Was würde mit dieser Zeile geschehen?** Rangfolge (die erste zutreffende): `ohneEvent` (kein Event zugeordnet) →
 * `doppelt` (das Event gehört schon einer früheren Zeile) → `nichtGelesen` (Event nicht lesbar) → `keinRecht` →
 * `beschaedigt` (Abschnitt im Event kaputt) → `aktuell` (nichts zu ändern) → `zuLang` (mehr als `INFOS_MAX`) → `neu` / `geaendert`.
 */
export function vorschau(
  reihe: Pick<Themenreihe, 'name' | 'zeilen'>,
  zeilenIndex: number,
  event: EventLage | null,
): Vorschau {
  const z = reihe.zeilen[zeilenIndex];
  if (z.eventId === null) return { art: 'ohneEvent' };
  const frueher = reihe.zeilen.findIndex((x) => x.eventId === z.eventId);
  if (frueher !== zeilenIndex) return { art: 'doppelt' };
  if (!event) return { art: 'nichtGelesen' };
  if (!event.darf) return { art: 'keinRecht', alterText: event.text };
  const teil = abschnitt(reihe, zeilenIndex);
  const r = abschnittEinsetzen(event.text, teil);
  if (r.art === 'beschaedigt') return { art: 'beschaedigt', alterText: event.text };
  const aus = { neuerText: r.text, alterText: event.text, abschnitt: teil };
  if (r.text === event.text) return { art: 'aktuell', ...aus };
  if (r.text.length > INFOS_MAX) return { art: 'zuLang', ...aus };
  return { art: r.ersetzt ? 'geaendert' : 'neu', ...aus };
}

// ── Events zur Zeile ────────────────────────────────────────────────────────────────────────────────────────

/** Ein Event, wie die Zeile es anbietet. */
export interface ReiheEvent {
  id: number;
  name: string;
  /** ISO-Zeit (UTC) wie von ChurchTools. */
  startDate: string;
  /** Der Tag in der Zeitzone der Gemeinde – **nicht** `startDate.slice(0, 10)` (UTC kann der Vortag sein). */
  tag: string;
  kalenderId: number | null;
}

/** Die Events aus `GET /events?from&to` – ohne Unbrauchbares. */
export function reiheEventsAus(roh: unknown, zeitzone: string): ReiheEvent[] {
  if (!Array.isArray(roh)) return [];
  return roh.flatMap((x: unknown) => {
    const e = x as {
      id?: unknown;
      name?: unknown;
      startDate?: unknown;
      calendar?: { domainIdentifier?: unknown };
    } | null;
    if (!e || typeof e.id !== 'number' || typeof e.startDate !== 'string') return [];
    const k = Number(e.calendar?.domainIdentifier);
    return [
      {
        id: e.id,
        name: typeof e.name === 'string' ? e.name : '',
        startDate: e.startDate,
        tag: tagAusIso(e.startDate, zeitzone),
        kalenderId: Number.isInteger(k) && e.calendar?.domainIdentifier != null ? k : null,
      },
    ];
  });
}

const tageZwischen = (a: string, b: string): number =>
  Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);

/**
 * **Die Events, die für diesen Abend in Frage kommen:** höchstens 7 Tage daneben, die am Tag selbst zuerst, dann nach
 * Abstand, dann nach Beginn. Events, die schon einer anderen Zeile gehören (`vergeben`), werden nicht noch einmal
 * angeboten – sonst trüge ein Event zwei Abschnitte.
 */
export function eventsZurZeile(
  datum: string,
  events: readonly ReiheEvent[],
  vergeben: ReadonlySet<number> = new Set(),
): { event: ReiheEvent; amTag: boolean }[] {
  return events
    .filter((e) => !vergeben.has(e.id) && Math.abs(tageZwischen(e.tag, datum)) <= 7)
    .map((e) => ({ event: e, abstand: Math.abs(tageZwischen(e.tag, datum)) }))
    .sort((a, b) => a.abstand - b.abstand || a.event.startDate.localeCompare(b.event.startDate))
    .map((x) => ({ event: x.event, amTag: x.abstand === 0 }));
}

/** Der Tag, ab dem und bis zu dem `GET /events` für diesen Abend gelesen wird (±7 Tage, dazu ein Tag Luft für die Zeitzone). */
export const eventFenster = (datum: string): { von: string; bis: string } => ({
  von: plusTage(datum, -8),
  bis: plusTage(datum, 8),
});

/** Die Zeile mit dem gewählten Event: übernimmt Titel und den **Tag des Events**. */
export function zeileMitEvent(z: ReiheZeile, e: ReiheEvent): ReiheZeile {
  return { ...z, eventId: e.id, eventTitel: e.name, datum: e.tag };
}
