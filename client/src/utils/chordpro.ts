/**
 * ChordPro-Parser. Unterstützt ZWEI Dialekte:
 *  1. Standard:    {start_of_verse: Verse 1} … {end_of_verse}, Kurzform {chorus}
 *  2. SongSelect:  Abschnitte via {comment: Vers}, {comment: Chorus 2}
 *
 * Reine Funktionen, keine React-Abhängigkeit. Übernommen aus dem Design-Prototyp
 * und um den SongSelect-Dialekt + Typen erweitert.
 */
import type { ChordProSection } from '@shared/types/index';

/** Ein Akkord-/Text-Paar einer Zeile. */
interface ChordPair {
  chord: string | null;
  text: string;
}

/**
 * Leitet aus einem Abschnitts-Label (z.B. "Vers", "Chorus 2", "Pre-Chorus")
 * den Abschnittstyp ab. Erkennt deutsche und englische Bezeichnungen.
 */
function deriveSectionType(label: string): string {
  const l = label.toLowerCase().trim();
  if (/^(pre[-\s_]?chorus|pre[-\s_]?refrain)/.test(l)) return 'pre_chorus';
  if (/^(vers|verse|strophe)/.test(l)) return 'verse';
  if (/^(chorus|refrain|kehrvers)/.test(l)) return 'chorus';
  if (/^(bridge|br[üu]cke)/.test(l)) return 'bridge';
  if (/^(intro|vorspiel)/.test(l)) return 'intro';
  if (/^(outro|nachspiel|ende)/.test(l)) return 'outro';
  if (/^(tag|coda)/.test(l)) return 'tag';
  if (/^(instrumental|solo|interlude|zwischenspiel)/.test(l)) return 'instrumental';
  return 'verse';
}

/**
 * **Beginnt diese Zeile einen Song-Teil?** Dann mit Typ und Überschrift, sonst `null`. EINE Regel für das
 * Blatt (`parseChordPro`) und die Bänder im Editor (Lied-Editor L3) – beide Dialekte:
 * `{start_of_verse: Vers 1}`, Kurzform `{chorus: 2}`, SongSelect `{comment: Vers}`.
 */
export function abschnittsKopf(zeile: string): { type: string; label: string } | null {
  const ln = zeile.trim();
  const start = ln.match(/^\{start_of_(\w+)(?:[:\s]+(.+?))?\}$/i);
  if (start) return { type: start[1].toLowerCase(), label: start[2] || start[1] };
  const kurz = ln.match(
    /^\{(verse|chorus|bridge|pre[-_]?chorus|intro|outro|tag)(?:[:\s]+(.+?))?\}$/i,
  );
  if (kurz) return { type: kurz[1].toLowerCase().replace(/-/g, '_'), label: kurz[2] || kurz[1] };
  const kommentar = ln.match(/^\{comment[:\s]+(.+?)\}$/i);
  if (kommentar) {
    const label = kommentar[1].trim();
    return { type: deriveSectionType(label), label };
  }
  return null;
}

/** Zerlegt den rohen ChordPro-Text in Abschnitte. */
export function parseChordPro(text: string): ChordProSection[] {
  const lines = text.split('\n');
  const sections: ChordProSection[] = [];
  let current: ChordProSection | null = null;

  for (const raw of lines) {
    const ln = raw.trim();

    // Teil-Anfang (beide Dialekte) – die Regel steht in `abschnittsKopf`.
    const kopf = abschnittsKopf(ln);
    if (kopf) {
      current = { ...kopf, lines: [] };
      sections.push(current);
      continue;
    }

    // Standard: {end_of_verse}
    if (/^\{end_of_\w+\}$/i.test(ln)) {
      current = null;
      continue;
    }

    // Weiterschalt-Punkt (#606, wie bei OnSong): `----` allein in einer Zeile. Nicht als Text zeigen,
    // nur die Stelle merken – vor der NÄCHSTEN Zeile dieses Teils.
    if (TRENNER.test(ln)) {
      if (current) (current.umbrueche ??= []).push(current.lines.length);
      continue;
    }

    // Sonstige Metadaten-Direktiven ({title}, {key}, {tempo} …) überspringen
    if (/^\{.*\}$/.test(ln)) continue;

    // Leerzeile
    if (!ln) {
      if (current) current.lines.push('');
      continue;
    }

    // Inhalts-Zeile – ohne vorherigen Abschnitt einen impliziten Vers öffnen
    if (!current) {
      current = { type: 'verse', label: '', lines: [] };
      sections.push(current);
    }
    current.lines.push(ln);
  }

  // Nachlaufende Leerzeilen je Abschnitt entfernen; leere Abschnitte verwerfen. Ein Trenner ganz am
  // Anfang oder Ende eines Teils trennt nichts – er fällt weg.
  return sections
    .map((s) => {
      const ls = [...s.lines];
      while (ls.length && !ls[ls.length - 1]) ls.pop();
      const umbrueche = [...new Set(s.umbrueche ?? [])].filter((i) => i > 0 && i < ls.length);
      const { umbrueche: _alt, ...rest } = s;
      return umbrueche.length > 0 ? { ...rest, lines: ls, umbrueche } : { ...rest, lines: ls };
    })
    .filter((s) => s.lines.length > 0);
}

/** `----` (vier oder mehr Bindestriche) allein in einer Zeile = Weiterschalt-Punkt (#606). */
const TRENNER = /^-{4,}$/;

/** Ein Song-Teil in Flow-Reihenfolge – mit seiner Stelle im Original (für die Abschnitts-Transponierung). */
export type FlowTeil = ChordProSection & { index: number };

/** Namen vergleichen: Groß-/Kleinschreibung und mehrfache Leerzeichen zählen nicht. */
export function flowName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Die Einträge einer Flow-Zeile („Intro, Vers 1, Chorus 1") – leere fallen weg. */
export function flowEintraege(flow: string | undefined): string[] {
  return (flow ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}

/**
 * **Die Teile in der Reihenfolge der Flow-Zeile** (`{flow: …}`, #606, Alwin + Musik-Bereichsleiter).
 *
 * Zugeordnet wird über die Abschnitts-Überschrift (bei SongSelect `{comment: Vers 1}`). Entscheidungen
 * (17.10.2026): Teile, die im Flow nicht vorkommen, fallen **weg** (wie bei OnSong); wiederholte Teile
 * stehen jeweils voll da. Namen, zu denen es keinen Teil gibt, kommen in `unbekannt` (der Editor zeigt
 * sie an).
 *
 * Ohne Flow – oder wenn KEIN Name passt – bleibt alles wie im Text: Ein vertippter Flow darf das Blatt
 * nicht leer machen.
 *
 * `index` ist die Stelle im Original: Daran hängt die Abschnitts-Transponierung (`sectionSemitones`),
 * die sich ein Teil also auch bei Wiederholung merkt.
 */
export function teileImFlow(
  sections: ChordProSection[],
  flow: string | undefined,
): { teile: FlowTeil[]; unbekannt: string[]; flow: string[] } {
  const alle = sections.map((s, index) => ({ ...s, index }));
  const eintraege = flowEintraege(flow);
  if (eintraege.length === 0) return { teile: alle, unbekannt: [], flow: [] };
  const nachName = new Map<string, FlowTeil>();
  for (const t of alle) {
    const n = flowName(t.label);
    if (n && !nachName.has(n)) nachName.set(n, t);
  }
  const teile: FlowTeil[] = [];
  const unbekannt: string[] = [];
  const gefunden: string[] = [];
  for (const e of eintraege) {
    const t = nachName.get(flowName(e));
    if (t) {
      teile.push(t);
      gefunden.push(e);
    } else if (!unbekannt.includes(e)) unbekannt.push(e);
  }
  if (teile.length === 0) return { teile: alle, unbekannt, flow: [] };
  return { teile, unbekannt, flow: gefunden };
}

/**
 * **Wo der Editor die Flow-Zeile einsetzt** (#606: „nach den allgemeinen Infos und vor den
 * Bestandteilen"): vor dem ersten Song-Teil bzw. der ersten Liedzeile. Vorbefüllt mit den vorhandenen
 * Teilen in ihrer Reihenfolge – umstellen und Wiederholungen eintragen geht dann schneller als tippen.
 * Gibt es schon eine Flow-Zeile, liefert die Funktion deren Stelle (`vorhanden`), damit der Editor dorthin
 * springt statt eine zweite einzufügen.
 */
export function flowEinfuegen(
  text: string,
): { vorhanden: true; pos: number } | { vorhanden: false; pos: number; zeile: string } {
  const zeilen = text.split('\n');
  let pos = 0;
  let ziel = -1;
  for (const raw of zeilen) {
    const ln = raw.trim();
    if (/^\{flow[:\s]/i.test(ln)) return { vorhanden: true, pos };
    pos += raw.length + 1;
  }
  pos = 0;
  for (const raw of zeilen) {
    const ln = raw.trim();
    const istKopf = ln === '' || (/^\{.*\}$/.test(ln) && !ABSCHNITT.test(ln));
    if (!istKopf) {
      ziel = pos;
      break;
    }
    pos += raw.length + 1;
  }
  if (ziel === -1) ziel = text.length;
  const namen = parseChordPro(text)
    .map((s) => s.label.trim())
    .filter(Boolean);
  return { vorhanden: false, pos: ziel, zeile: `{flow: ${namen.join(', ')}}` };
}

/**
 * **Den Ablauf neu schreiben** (Lied-Editor L2, 22.10.2026: Ablauf als Kärtchen). Liefert die EINE Änderung am
 * Text, die die Kärtchen-Reihenfolge in die `{flow: …}`-Zeile bringt – als `{ from, to, insert }`, damit der
 * Editor sie wie eine Eingabe anwendet (Rückgängig inklusive):
 *  - Es gibt eine Flow-Zeile → sie wird ersetzt.
 *  - Es gibt keine → sie kommt dorthin, wo `flowEinfuegen` sie hinsetzt (nach den Kopfangaben).
 *  - `eintraege` leer → die Zeile fällt samt Zeilenende weg: „wie im Text" (`teileImFlow` ohne Flow).
 * `null`, wenn sich nichts ändert. Der Rest des Texts bleibt Zeichen für Zeichen, wie er war.
 */
export function flowSetzen(
  text: string,
  eintraege: string[],
): { from: number; to: number; insert: string } | null {
  const zeile = eintraege.length > 0 ? `{flow: ${eintraege.join(', ')}}` : '';
  let pos = 0;
  for (const raw of text.split('\n')) {
    if (/^\{flow[:\s]/i.test(raw.trim())) {
      if (raw === zeile) return null;
      if (zeile) return { from: pos, to: pos + raw.length, insert: zeile };
      // Weg damit – samt Zeilenende (am Textende das davor), sonst bliebe eine Leerzeile.
      const ende = pos + raw.length;
      if (ende < text.length) return { from: pos, to: ende + 1, insert: '' };
      return { from: Math.max(0, pos - 1), to: ende, insert: '' };
    }
    pos += raw.length + 1;
  }
  if (!zeile) return null;
  const ziel = flowEinfuegen(text);
  // `flowEinfuegen` meldet hier immer „nicht vorhanden" – die Suche oben hat keine Zeile gefunden.
  const an = ziel.pos;
  return { from: an, to: an, insert: `${zeile}\n` };
}

/** Direktiven, die einen Song-Teil beginnen (beide Dialekte). */
const ABSCHNITT =
  /^\{(start_of_\w+|comment|verse|chorus|bridge|pre[-_]?chorus|intro|outro|tag)(?:[:\s].*)?\}$/i;

/** Zerlegt eine einzelne Zeile in Akkord-/Text-Paare. */
export function parseLine(line: string): ChordPair[] {
  if (!line.includes('[')) return [{ chord: null, text: line }];
  const pairs: ChordPair[] = [];
  const firstIndex = line.indexOf('[');
  if (firstIndex > 0) pairs.push({ chord: null, text: line.slice(0, firstIndex) });
  const re = /\[([^\]]*)\]([^[]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    pairs.push({ chord: m[1] || null, text: m[2] });
  }
  return pairs;
}

/** Liest Metadaten ({title}, {key}, {tempo}, {ccli} …) aus dem ChordPro-Text. */
export function parseMetadata(text: string): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const m = raw
      .trim()
      .match(/^\{(title|artist|key|tempo|time|ccli|composer|copyright|flow)[:\s]+(.+?)\}$/i);
    if (m) meta[m[1].toLowerCase()] = m[2].trim();
  }
  return meta;
}
