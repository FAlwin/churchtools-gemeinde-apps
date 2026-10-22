/**
 * **Das Protokoll als Dokument** (Bauplan Protokolle S1/S4) – Blockmodell und die EINE Ableitung, aus der
 * Bereiche (Beschlüsse · To-Dos · Termine), Beschlüsse-Liste, PDF und Freigabe lesen. Lehre aus den Entwürfen
 * 2–7: Es gibt keine zweite Liste von Beschlüssen neben dem Dokument (Regel-Dopplung).
 *
 * Gespeichert wird das Dokument im Format des Editors (BlockNote, entschieden 22.10.2026): eine Liste von
 * Blöcken mit `id`, `type`, `props`, `content` (Inline-Text) und `children` (eingerückte Unterpunkte, beliebig
 * tief). Hier steht nur, was die Regeln davon brauchen – ohne Abhängigkeit vom Editor, damit Erweiterung,
 * PDF und Tests dieselben Regeln nutzen.
 *
 * Unsere eigenen Blockarten (`BLOCK`) ergänzen die des Editors:
 * - `aufgabe` – Text = was zu tun ist; `props.aufgabe` = ID des To-Do-Werts in „Mitarbeit“ (dort stehen Wer,
 *   Bis und Status, damit Abhaken das Protokoll nicht berührt; Bauplan 3.3);
 * - `beschluss` – Text = der Beschluss;
 * - `termin` – Text = was stattfindet, `props.datum` = `JJJJ-MM-TT`;
 * - `verweis` – fester Punkt ohne eigenen Text: `props.art` = `offene-aufgaben` | `letztes-protokoll`.
 *
 * Ein **Tagesordnungspunkt** ist eine Überschrift der Stufe 1 auf oberster Ebene; alles bis zur nächsten
 * gehört zu ihm (auch in Unterpunkten).
 */

/** Ein Stück Text mit Auszeichnung (fett, kursiv …) – so, wie der Editor es liefert. */
export interface TextStueck {
  type: 'text';
  text: string;
  styles?: Record<string, unknown>;
}

/** Ein Verweis im Text. */
export interface LinkStueck {
  type: 'link';
  href: string;
  content: TextStueck[];
}

export type InlineStueck = TextStueck | LinkStueck;

export interface Block {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  /** Inline-Text; bei Blöcken ohne Text fehlt er (Trennlinie, Verweis). */
  content?: unknown;
  children?: Block[];
}

export const BLOCK = {
  aufgabe: 'aufgabe',
  beschluss: 'beschluss',
  termin: 'termin',
  verweis: 'verweis',
} as const;

export type VerweisArt = 'offene-aufgaben' | 'letztes-protokoll';

export interface Punkt {
  blockId: string;
  /** 1, 2, 3 … in der Reihenfolge des Dokuments. */
  nummer: number;
  titel: string;
}

interface Eintrag {
  blockId: string;
  text: string;
  /** Block-ID des Tagesordnungspunkts – `null`, wenn der Eintrag vor dem ersten Punkt steht. */
  punkt: string | null;
}

export type BeschlussEintrag = Eintrag;

export interface AufgabenEintrag extends Eintrag {
  /** ID des To-Do-Werts in „Mitarbeit“; `null`, solange die Aufgabe noch nicht gespeichert ist. */
  aufgabe: string | null;
}

export interface TerminEintrag extends Eintrag {
  /** `JJJJ-MM-TT`; `null`, solange kein gültiges Datum gesetzt ist. */
  datum: string | null;
}

export interface Ableitung {
  punkte: Punkt[];
  beschluesse: BeschlussEintrag[];
  aufgaben: AufgabenEintrag[];
  termine: TerminEintrag[];
}

/** Der reine Text eines Blocks (Auszeichnungen weg, Links mit ihrem Text). */
export function textAus(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((s: unknown) => {
      if (!s || typeof s !== 'object') return '';
      const stueck = s as { type?: unknown; text?: unknown; content?: unknown };
      if (stueck.type === 'text') return typeof stueck.text === 'string' ? stueck.text : '';
      if (stueck.type === 'link') return textAus(stueck.content);
      return '';
    })
    .join('');
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

/** `props.datum`, wenn es ein gültiges Kalenderdatum ist (`2026-02-30` zählt nicht). */
function datumAus(props: Record<string, unknown> | undefined): string | null {
  const d = props?.datum;
  if (typeof d !== 'string' || !DATUM.test(d)) return null;
  const t = new Date(`${d}T12:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d ? d : null;
}

function istPunkt(b: Block): boolean {
  return b.type === 'heading' && Number(b.props?.level ?? 1) === 1;
}

/**
 * **Alles, was aus dem Dokument folgt** – in der Reihenfolge des Dokuments, Unterpunkte eingeschlossen.
 * Leere Beschlüsse und Termine ohne Text zählen nicht (eine angefangene Zeile ist noch kein Beschluss);
 * Aufgaben ohne Text ebenso.
 */
export function ableiten(dokument: readonly Block[]): Ableitung {
  const a: Ableitung = { punkte: [], beschluesse: [], aufgaben: [], termine: [] };
  let punkt: string | null = null;

  const besuche = (b: Block): void => {
    const text = textAus(b.content).trim();
    if (b.type === BLOCK.beschluss && text) a.beschluesse.push({ blockId: b.id, text, punkt });
    if (b.type === BLOCK.aufgabe && text) {
      const id = b.props?.aufgabe;
      a.aufgaben.push({
        blockId: b.id,
        text,
        punkt,
        aufgabe: typeof id === 'string' && id ? id : null,
      });
    }
    if (b.type === BLOCK.termin && text)
      a.termine.push({ blockId: b.id, text, punkt, datum: datumAus(b.props) });
    for (const k of b.children ?? []) besuche(k);
  };

  for (const b of dokument) {
    if (istPunkt(b)) {
      punkt = b.id;
      a.punkte.push({
        blockId: b.id,
        nummer: a.punkte.length + 1,
        titel: textAus(b.content).trim(),
      });
    }
    besuche(b);
  }
  return a;
}

/** Ist das ein Dokument, wie wir es speichern? Für alles, was aus dem Speicher zurückkommt. */
export function istDokument(x: unknown): x is Block[] {
  const istBlock = (b: unknown): boolean => {
    if (!b || typeof b !== 'object') return false;
    const o = b as { id?: unknown; type?: unknown; children?: unknown };
    if (typeof o.id !== 'string' || typeof o.type !== 'string') return false;
    return o.children === undefined || (Array.isArray(o.children) && o.children.every(istBlock));
  };
  return Array.isArray(x) && x.every(istBlock);
}

/** Eine tiefe Kopie mit neuen IDs – für Vorlagen und „wie letztes Mal“. */
export function mitNeuenIds(bloecke: readonly Block[], neueId: () => string): Block[] {
  return bloecke.map((b) => ({
    ...b,
    id: neueId(),
    ...(b.props ? { props: { ...b.props } } : {}),
    ...(b.content !== undefined
      ? { content: JSON.parse(JSON.stringify(b.content)) as unknown }
      : {}),
    children: mitNeuenIds(b.children ?? [], neueId),
  }));
}
