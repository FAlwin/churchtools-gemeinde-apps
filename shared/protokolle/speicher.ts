/**
 * **Wie Sitzungen im Erweiterungs-Speicher liegen** (Bauplan Protokolle 3.3, gemessen in S0 am 22.10.2026).
 *
 * - Je Gruppe zwei Kategorien: `protokolle-g<ID>` (nur die Leitung schreibt) und `mitarbeit-g<ID>` (To-Dos und
 *   Vorschläge; Mitglieder dürfen schreiben). Dazu eine gemeinsame Kategorie `vorlagen`.
 * - **Ein Wert fasst höchstens 10.000 Zeichen** (`MAX_ZEICHEN`). Ein langes Protokoll (300 Blöcke) sind gemessen
 *   75–87 Tsd. Zeichen. Deshalb: ein **Kopf-Wert** (Titel, Status, Termin, Sperre, Verweis auf die Teile) und
 *   **Teil-Werte** mit dem gepackten Dokument (deflate + Base64url, `shared/ct/packen.ts`).
 * - Beim Lesen gehört ein Teil nur dann zum Dokument, wenn sein `stand` zum Kopf passt – so liegt bei einem
 *   abgebrochenen Speichern immer noch ein vollständiger Stand vor (Reihenfolge des Schreibens: neue Teile →
 *   nachlesen → Kopf umstellen → nachlesen → alte Teile löschen; gebaut in S4-1, `protokolle/src/schreiben.ts`).
 * - **Meine Gruppen** kommen aus den sichtbaren Kategorien: Teilnehmer versteckter Gruppen sehen ihre eigene
 *   Gruppe in ChurchTools nicht (S0, 403), die Kategorie aber schon.
 */
import { MAX_ZEICHEN } from '../ct/modulDaten';
import { textEntpacken, textPacken } from '../ct/packen';
import { istDokument, type Block } from './dokument';

export const KUERZEL_VORLAGEN = 'vorlagen';

export function kuerzelProtokolle(gruppe: number): string {
  return `protokolle-g${gruppe}`;
}

export function kuerzelMitarbeit(gruppe: number): string {
  return `mitarbeit-g${gruppe}`;
}

/** Welche Gruppe und welche Art steckt in einem Kürzel? `null` für fremde Kategorien. */
export function kuerzelLesen(
  kuerzel: string,
): { art: 'protokolle' | 'mitarbeit'; gruppe: number } | null {
  const m = /^(protokolle|mitarbeit)-g([1-9]\d*)$/.exec(kuerzel);
  return m ? { art: m[1] as 'protokolle' | 'mitarbeit', gruppe: Number(m[2]) } : null;
}

export type SitzungsStatus = 'geplant' | 'entwurf' | 'frei';

/** Wer gerade schreibt (Bauplan 3.3: eine Person schreibt, alle lesen). */
export interface Sperre {
  von: number;
  name: string;
  /** ISO-Zeit des letzten Lebenszeichens. */
  seit: string;
  /**
   * Kennung des Editor-Fensters (S4-1). Dieselbe Person in zwei Fenstern oder auf zwei Geräten sperrt sich gegenseitig
   * – sonst überschriebe das eine Fenster still, was das andere gerade gespeichert hat. Fehlt sie (ältere Werte),
   * ist die Sperre für jedes Fenster fremd.
   */
  fenster?: string;
}

/** Wer schreiben will: Person, Name für die Anzeige („Alwin schreibt gerade“) und das eigene Fenster. */
export interface Schreiber {
  person: number;
  name: string;
  fenster: string;
}

export interface ProtokollKopf {
  art: 'protokoll';
  fassung: 1;
  /** Eigene ID der Sitzung (bleibt, auch wenn die Werte beim Speichern neu angelegt werden). */
  sitzung: string;
  titel: string;
  status: SitzungsStatus;
  /** Beginn der Sitzung, ISO. */
  beginn: string;
  /** Verknüpfter Kalendertermin (Weg C) und Gruppentreffen – `null`, solange nicht angelegt. */
  termin: { kalender: number; id: number } | null;
  treffen: number | null;
  freigabe: { von: number; am: string } | null;
  sperre: Sperre | null;
  /** Prüfsumme des gespeicherten Dokuments; die Teile tragen dieselbe. */
  stand: string;
}

export interface ProtokollTeil {
  art: 'protokoll-teil';
  fassung: 1;
  sitzung: string;
  stand: string;
  nr: number;
  von: number;
  daten: string;
}

/** Wie lang das gepackte Stück in einem Teil sein darf – Platz für die Hülle bleibt (`teileBauen` prüft das). */
export const TEIL_ZEICHEN = 9_500;

/** FNV-1a über den Text – reicht, um „ist das derselbe Stand?“ zu beantworten (kein Schutz gegen Absicht). */
export function pruefsumme(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Das Dokument als Teil-Werte (fertige Texte für `customdatavalues`) und den Stand für den Kopf. Wirft, wenn
 * ein Teil die Grenze sprengen würde – das darf nie still passieren.
 */
export function teileBauen(
  dokument: readonly Block[],
  sitzung: string,
): { stand: string; werte: string[] } {
  const json = JSON.stringify(dokument);
  const stand = pruefsumme(json);
  const code = textPacken(json);
  const stuecke: string[] = [];
  for (let i = 0; i < code.length; i += TEIL_ZEICHEN) stuecke.push(code.slice(i, i + TEIL_ZEICHEN));
  if (!stuecke.length) stuecke.push('');
  const werte = stuecke.map((daten, nr) =>
    JSON.stringify({
      art: 'protokoll-teil',
      fassung: 1,
      sitzung,
      stand,
      nr,
      von: stuecke.length,
      daten,
    } satisfies ProtokollTeil),
  );
  const zuLang = werte.find((w) => w.length > MAX_ZEICHEN);
  if (zuLang)
    throw new Error(
      `Ein Protokoll-Teil hätte ${zuLang.length} Zeichen (höchstens ${MAX_ZEICHEN}).`,
    );
  return { stand, werte };
}

/**
 * **Das Dokument zum Kopf** aus den gelesenen Teilen. `null`, wenn Teile fehlen, zu einem anderen Stand
 * gehören oder kaputt sind – der Aufrufer liest dann neu oder meldet es; er nimmt nie einen halben Stand.
 */
export function dokumentAusTeilen(
  kopf: Pick<ProtokollKopf, 'sitzung' | 'stand'>,
  teile: readonly ProtokollTeil[],
): Block[] | null {
  // Gleicher Stand heißt gleicher Inhalt: Liegt ein Teil doppelt da (ein früheres Speichern mit demselben Text, dessen
  // Aufräumen scheiterte), zählt er einmal – sonst wäre das Protokoll unlesbar, bis jemand von Hand aufräumt.
  const jeNr = new Map<number, ProtokollTeil>();
  for (const t of teile)
    if (t.sitzung === kopf.sitzung && t.stand === kopf.stand && !jeNr.has(t.nr)) jeNr.set(t.nr, t);
  const passend = [...jeNr.values()].sort((a, b) => a.nr - b.nr);
  if (!passend.length) return null;
  const anzahl = passend[0].von;
  if (passend.length !== anzahl || passend.some((t, i) => t.nr !== i || t.von !== anzahl))
    return null;
  try {
    const json = textEntpacken(passend.map((t) => t.daten).join(''));
    if (pruefsumme(json) !== kopf.stand) return null;
    const dok: unknown = JSON.parse(json);
    return istDokument(dok) ? dok : null;
  } catch {
    return null;
  }
}

/**
 * **Das Dokument einer Sitzung** – ein geplantes Protokoll hat noch keins (`null`), sonst `dokumentAusTeilen`. Die
 * eine Stelle dafür (Protokoll ansehen, Suche); vorher stand die Regel in der Ansicht.
 */
export function dokumentDerSitzung(
  kopf: Pick<ProtokollKopf, 'sitzung' | 'stand' | 'status'> | null,
  teile: readonly ProtokollTeil[],
): Block[] | null {
  return kopf && kopf.status !== 'geplant' ? dokumentAusTeilen(kopf, teile) : null;
}

/** Nach so vielen Minuten ohne Lebenszeichen gilt eine Schreibsperre als verlassen. */
export const SPERRE_MINUTEN = 10;

/**
 * Darf ich schreiben? `frei` = niemand (oder die Sperre ist verlassen), `meine` = dieses Fenster, `fremd` = jemand
 * anderes – oder ich selbst in einem anderen Fenster (`sperre.von === ich.person` unterscheidet das für die Anzeige).
 */
export function sperreLage(
  sperre: Sperre | null,
  ich: Pick<Schreiber, 'person' | 'fenster'>,
  jetzt: Date,
): 'frei' | 'meine' | 'fremd' {
  if (!sperre) return 'frei';
  const alter = jetzt.getTime() - new Date(sperre.seit).getTime();
  if (!Number.isFinite(alter) || alter > SPERRE_MINUTEN * 60_000) return 'frei';
  return sperre.von === ich.person && sperre.fenster === ich.fenster ? 'meine' : 'fremd';
}

/** Die Sperre dieses Fensters, Lebenszeichen jetzt. */
export function sperreVon(ich: Schreiber, jetzt: Date): Sperre {
  return { von: ich.person, name: ich.name, seit: jetzt.toISOString(), fenster: ich.fenster };
}

/** Ein Wert, wie er aus der Kategorie kommt (`Wert` aus `modulDaten`, hier ohne die Abhängigkeit). */
interface RohWert {
  id: number;
  value: string;
}

/** Der Inhalt eines Werts als JSON – `null`, wenn er keins ist. Die eine Stelle dafür (Lesen, Schreiben). */
export function wertInhalt(w: Pick<RohWert, 'value'>): unknown {
  try {
    return JSON.parse(w.value);
  } catch {
    return null;
  }
}

/**
 * **Was zu einer Sitzung in der Kategorie liegt** – der Kopf (bei mehreren mit derselben Sitzung der mit der kleinsten
 * ID, wie bei Kategorien) und alle Teile. `kopf` ist `null`, wenn die Sitzung (noch) keinen hat.
 */
export function sitzungAusWerten(
  werte: readonly RohWert[],
  sitzung: string,
): {
  kopf: { id: number; inhalt: ProtokollKopf } | null;
  teile: { id: number; teil: ProtokollTeil }[];
} {
  let kopf: { id: number; inhalt: ProtokollKopf } | null = null;
  const teile: { id: number; teil: ProtokollTeil }[] = [];
  for (const w of [...werte].sort((a, b) => a.id - b.id)) {
    const x = wertInhalt(w);
    if (istKopf(x) && x.sitzung === sitzung && !kopf) kopf = { id: w.id, inhalt: x };
    else if (istTeil(x) && x.sitzung === sitzung) teile.push({ id: w.id, teil: x });
  }
  return { kopf, teile };
}

/**
 * **Darf dieses Fenster jetzt schreiben?** Die eine Regel für Sperre nehmen und Speichern (S4-1), geprüft auf dem
 * frisch gelesenen Kopf:
 * - `weg` – die Sitzung hat keinen Kopf mehr;
 * - `fest` – nicht (mehr) im Entwurf (freigegeben oder nur geplant);
 * - `gesperrt` – jemand anderes (oder ein anderes Fenster) schreibt;
 * - `veraendert` – der gespeicherte Stand ist nicht mehr der, auf dem dieses Fenster aufsetzt: Jemand hat
 *   inzwischen gespeichert (etwa nachdem die eigene Sperre verfallen war). Überschreiben hieße, seinen Text still zu
 *   verlieren – also neu laden;
 * - `ok`.
 */
export function schreibLage(
  kopf: ProtokollKopf | null,
  ich: Pick<Schreiber, 'person' | 'fenster'>,
  basisStand: string,
  jetzt: Date,
): 'ok' | 'weg' | 'fest' | 'gesperrt' | 'veraendert' {
  if (!kopf) return 'weg';
  if (kopf.status !== 'entwurf') return 'fest';
  if (sperreLage(kopf.sperre, ich, jetzt) === 'fremd') return 'gesperrt';
  return kopf.stand === basisStand ? 'ok' : 'veraendert';
}

const STATUS: readonly SitzungsStatus[] = ['geplant', 'entwurf', 'frei'];

/** Ist das ein Kopf-Wert der Protokolle (S3-1)? Fremde und kaputte Werte werden beim Lesen übergangen. */
export function istKopf(x: unknown): x is ProtokollKopf {
  const k = x as Partial<ProtokollKopf> | null;
  return (
    !!k &&
    k.art === 'protokoll' &&
    k.fassung === 1 &&
    typeof k.sitzung === 'string' &&
    typeof k.titel === 'string' &&
    STATUS.includes(k.status as SitzungsStatus) &&
    typeof k.beginn === 'string' &&
    !Number.isNaN(Date.parse(k.beginn)) &&
    (k.termin === null ||
      (typeof k.termin?.kalender === 'number' && typeof k.termin.id === 'number')) &&
    (k.treffen === null || typeof k.treffen === 'number') &&
    typeof k.stand === 'string'
  );
}

/** Ist das ein Teil-Wert der Protokolle (S3-1)? */
export function istTeil(x: unknown): x is ProtokollTeil {
  const t = x as Partial<ProtokollTeil> | null;
  return (
    !!t &&
    t.art === 'protokoll-teil' &&
    t.fassung === 1 &&
    typeof t.sitzung === 'string' &&
    typeof t.stand === 'string' &&
    Number.isInteger(t.nr) &&
    Number.isInteger(t.von) &&
    typeof t.daten === 'string'
  );
}
