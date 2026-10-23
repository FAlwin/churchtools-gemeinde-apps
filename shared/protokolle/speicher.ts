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
 *   nachlesen → Kopf umstellen → nachlesen → alte Teile löschen; gebaut in S4-1).
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
  const passend = teile
    .filter((t) => t.sitzung === kopf.sitzung && t.stand === kopf.stand)
    .sort((a, b) => a.nr - b.nr);
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

/** Nach so vielen Minuten ohne Lebenszeichen gilt eine Schreibsperre als verlassen. */
export const SPERRE_MINUTEN = 10;

/** Darf ich schreiben? `frei` = niemand, `meine` = ich selbst, `fremd` = jemand anderes schreibt gerade. */
export function sperreLage(
  sperre: Sperre | null,
  ich: number,
  jetzt: Date,
): 'frei' | 'meine' | 'fremd' {
  if (!sperre) return 'frei';
  const alter = jetzt.getTime() - new Date(sperre.seit).getTime();
  if (!Number.isFinite(alter) || alter > SPERRE_MINUTEN * 60_000) return 'frei';
  return sperre.von === ich ? 'meine' : 'fremd';
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
