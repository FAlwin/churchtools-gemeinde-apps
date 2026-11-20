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
import { pruefsumme, teileBauen as teileAllgemein, TEIL_ZEICHEN, textAusTeilen } from '../ct/teile';
import { sperreLage, sperreVon, SPERRE_MINUTEN, type Schreiber, type Sperre } from '../ct/sperre';
import { istDokument, type Block } from './dokument';

// Die Schreibsperre (Regel, Zeitgrenze, Typen) steht seit der Website (W3a-2) in `shared/ct/sperre.ts`; hier bleibt sie
// unter dem alten Namen erreichbar. Gespeichert wird sie bei den Protokollen im Kopf der Sitzung (`ProtokollKopf.sperre`).
export { sperreLage, sperreVon, SPERRE_MINUTEN };
export type { Schreiber, Sperre };

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

// Die Aufteilung selbst (`TEIL_ZEICHEN`, `pruefsumme`, Teile bauen und zusammensetzen) steht in `shared/ct/teile.ts` – die
// Website teilt ihre Seiten genauso. Hier nur die Hülle der Protokolle.
export { TEIL_ZEICHEN, pruefsumme };

/**
 * Das Dokument als Teil-Werte (fertige Texte für `customdatavalues`) und den Stand für den Kopf. Wirft, wenn
 * ein Teil die Grenze sprengen würde – das darf nie still passieren.
 */
export function teileBauen(
  dokument: readonly Block[],
  sitzung: string,
): { stand: string; werte: string[] } {
  return teileAllgemein(
    JSON.stringify(dokument),
    (t) =>
      ({
        art: 'protokoll-teil',
        fassung: 1,
        sitzung,
        stand: t.stand,
        nr: t.nr,
        von: t.von,
        daten: t.daten,
      }) satisfies ProtokollTeil,
    'Ein Protokoll-Teil',
  );
}

/**
 * **Das Dokument zum Kopf** aus den gelesenen Teilen. `null`, wenn Teile fehlen, zu einem anderen Stand
 * gehören oder kaputt sind – der Aufrufer liest dann neu oder meldet es; er nimmt nie einen halben Stand.
 */
export function dokumentAusTeilen(
  kopf: Pick<ProtokollKopf, 'sitzung' | 'stand'>,
  teile: readonly ProtokollTeil[],
): Block[] | null {
  const json = textAusTeilen(
    kopf.stand,
    teile.filter((t) => t.sitzung === kopf.sitzung),
  );
  if (json === null) return null;
  try {
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
