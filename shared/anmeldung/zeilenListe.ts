/**
 * **Baustein „Liste mit Zeilen“** (F6, Entwurf `f6-liste-v1`, abgenommen von Alwin am 20.11.2026) – z. B. „Was bringst du
 * privat mit?“ mit den Spalten Gegenstand, Anzahl, Wert, Zustand. Die EINE Regel für Baukasten, Formular, Tabelle und
 * ChurchTools-Text:
 *
 *  - **1–5 Spalten** der Arten Text, Zahl und Auswahl; eine Zahl-Spalte kann eine Einheit haben und – höchstens eine –
 *    „Summe zeigen“. Höchstzahl Zeilen 1–50, vorbelegt 10.
 *  - Eine Zeile ist **leer** (fällt weg), **vollständig** (jede Zelle gültig) oder **angefangen** (hält das Absenden
 *    auf – auch bei einer freiwilligen Liste). Pflicht heißt: mindestens eine vollständige Zeile.
 *  - Die Summe zählt **nur vollständige Zeilen**; je Zeile steht der Gesamtwert (kein Anzahl × Einzelwert).
 *
 * **Ablage in ChurchTools (Entscheidung E1):** die Antwort als lesbarer langer Text (Kopfzeile + eine Zeile je Eintrag),
 * dazu die Spalte „Frage (Daten)“ mit den Zeilen in fester Form (`listeDaten`) – darüber öffnet das Tool die Liste wieder,
 * auch wenn jemand den lesbaren Text in ChurchTools ändert –, mit „Summe zeigen“ zusätzlich ein Zahl-Feld. Jede Spalte
 * fasst **4.000 Zeichen** (`GRUPPENFELD_MAX`), und ohne Login schneidet ChurchTools still ab (M9) – deshalb prüft
 * `listePruefen` die Länge der Daten, bevor abgeschickt wird; nur der lesbare Text darf gekürzt werden.
 *
 * Die Antworten einer Zeile hängen an der **Kennung der Spalte**, nicht an ihrer Stelle: Wird eine Spalte umbenannt oder
 * verschoben, bleiben gespeicherte Listen richtig zugeordnet.
 */
import { z } from 'zod';
import { ANTWORT_MAX } from './bedingungen';
import { GRUPPENFELD_MAX, zahlText } from './feldwert';

export type SpaltenArt = 'text' | 'zahl' | 'auswahl';

export interface ListenSpalte {
  /** Feste Kennung (Daten in ChurchTools hängen daran) – bleibt beim Umbenennen, Verschieben und Wechsel der Art. */
  id: string;
  name: string;
  art: SpaltenArt;
  /** Nur bei Zahl: „€“, „kg“ … – steht in der Kopfzeile. */
  einheit?: string;
  /** Nur bei Zahl, höchstens eine Spalte: Summe zeigen (Formular, Tabelle, eigenes Zahl-Feld in ChurchTools). */
  summe?: boolean;
  /** Nur bei Auswahl: die Antworten. */
  antworten?: string[];
}

export interface ListeEinstellung {
  spalten: ListenSpalte[];
  /** Höchstzahl Zeilen, 1–50. */
  max: number;
}

/** Die Antwort: je Zeile die Zellen, über die Kennung der Spalte. */
export interface ListeAntwort {
  zeilen: Record<string, string>[];
}

export const SPALTEN_MAX = 5;
export const ZEILEN_MAX = 50;
export const ZEILEN_VORGABE = 10;
export const SPALTEN_NAME_MAX = 40;
export const EINHEIT_MAX = 10;
/** Höchstlänge einer Text-Zelle – wie eine Antwort (Entwurf: „bis 255 Zeichen“). */
export const ZELLE_MAX = ANTWORT_MAX;
const AUSWAHL_MAX = 20;

export const listeSchema = z.object({
  spalten: z
    .array(
      z.object({
        id: z.string().min(1).max(8),
        name: z.string().max(SPALTEN_NAME_MAX),
        art: z.enum(['text', 'zahl', 'auswahl']),
        einheit: z.string().max(EINHEIT_MAX).optional(),
        summe: z.boolean().optional(),
        antworten: z.array(z.string().max(ANTWORT_MAX)).max(AUSWAHL_MAX).optional(),
      }),
    )
    .min(1)
    .max(SPALTEN_MAX),
  max: z.number().int().min(1).max(ZEILEN_MAX),
});

/** Was ein neuer Baustein mitbringt: „Was“ (Text) und „Anzahl“ (Zahl), höchstens 10 Zeilen. */
export function standardListe(): ListeEinstellung {
  return {
    spalten: [
      { id: 'a', name: 'Was', art: 'text' },
      { id: 'b', name: 'Anzahl', art: 'zahl' },
    ],
    max: ZEILEN_VORGABE,
  };
}

/**
 * Eine Kennung für eine neue Spalte, die es in der Liste noch nicht gibt – zufällig, damit eine gelöschte Spalte ihre
 * Kennung nicht an eine neue vererbt (deren Zellen zeigten sonst die alten Antworten).
 */
export function neueSpaltenKennung(spalten: ListenSpalte[]): string {
  const vergeben = new Set(spalten.map((s) => s.id));
  for (;;) {
    const id = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) =>
      (b % 36).toString(36),
    ).join('');
    if (!vergeben.has(id)) return id;
  }
}

/** Eine neue Spalte (Text) mit einem Namen, den es noch nicht gibt: „Neue Spalte“, „Neue Spalte 2“ … */
export function neueSpalte(spalten: ListenSpalte[]): ListenSpalte {
  const namen = new Set(spalten.map((s) => s.name.trim().toLowerCase()));
  let name = 'Neue Spalte';
  for (let i = 2; namen.has(name.toLowerCase()); i++) name = `Neue Spalte ${i}`;
  return { id: neueSpaltenKennung(spalten), name, art: 'text' };
}

/** Was an den Einstellungen einer Liste nicht stimmt (Baukasten, Speichern) – `null` = in Ordnung. */
export function listeEinstellungFehler(l: ListeEinstellung | undefined): string | null {
  if (!l || l.spalten.length === 0) return 'Bitte mindestens eine Spalte anlegen.';
  if (l.spalten.length > SPALTEN_MAX) return `Höchstens ${SPALTEN_MAX} Spalten.`;
  if (l.spalten.some((s) => !s.name.trim())) return 'Bitte jeder Spalte einen Namen geben.';
  const namen = l.spalten.map((s) => s.name.trim().toLowerCase());
  const doppelt = l.spalten.find((_, i) => namen.indexOf(namen[i]) !== i);
  if (doppelt)
    return `Zwei Spalten heißen „${doppelt.name.trim()}“ – bitte unterschiedlich benennen.`;
  const wenig = l.spalten.find(
    (s) => s.art === 'auswahl' && (s.antworten ?? []).filter((a) => a.trim()).length < 2,
  );
  if (wenig) return `Bitte bei „${wenig.name.trim()}“ mindestens zwei Antworten eintragen.`;
  // Dieselben Grenzen wie das Schema (`listeSchema`) – sonst ginge das Feld durch und das Speichern scheiterte erst am Ende.
  const viele = l.spalten.find((s) => (s.antworten ?? []).length > AUSWAHL_MAX);
  if (viele) return `Bei „${viele.name.trim()}“ gehen höchstens ${AUSWAHL_MAX} Antworten.`;
  const lang = l.spalten.find((s) => (s.antworten ?? []).some((a) => a.length > ANTWORT_MAX));
  if (lang) return `Bei „${lang.name.trim()}“ ist eine Antwort länger als ${ANTWORT_MAX} Zeichen.`;
  if (l.spalten.some((s) => s.summe && s.art !== 'zahl'))
    return 'Eine Summe gibt es nur bei Zahl-Spalten.';
  if (l.spalten.filter((s) => s.summe).length > 1) return 'Nur eine Spalte kann eine Summe zeigen.';
  if (!Number.isInteger(l.max) || l.max < 1 || l.max > ZEILEN_MAX)
    return `Höchstens 1 bis ${ZEILEN_MAX} Zeilen.`;
  return null;
}

/**
 * **Eine Zahl aus einer Zelle**, wie man sie in Deutschland tippt: „2,5“, „1.234,50“, „1.234“ (= 1234), „-3“; mit Punkt
 * als Dezimalzeichen nur, wenn es keine Tausendergruppe sein kann („1.5“, „12.75“). `null`, wenn es keine Zahl ist
 * („1e3“, „zwei“, leer). Nicht dieselbe Regel wie `zahlAus` der Tabelle: Die liest Werte aus ChurchTools („1234.5“).
 */
export function listenZahl(text: string): number | null {
  const t = text.replace(/\s/g, '');
  let roh: string;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) roh = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d+(,\d+)?$/.test(t)) roh = t.replace(',', '.');
  else if (/^-?\d+\.\d+$/.test(t)) roh = t;
  else return null;
  const n = Number(roh);
  return Number.isFinite(n) ? n : null;
}

/** Ist diese Zelle gültig ausgefüllt? Text bis `ZELLE_MAX`, Zahl lesbar, Auswahl eine der Antworten. */
export function zelleGueltig(s: ListenSpalte, wert: string | undefined): boolean {
  const t = (wert ?? '').trim();
  if (!t) return false;
  if (s.art === 'zahl') return listenZahl(t) !== null;
  if (s.art === 'auswahl') return (s.antworten ?? []).some((a) => a.trim() === t);
  return t.length <= ZELLE_MAX;
}

export type ZeilenZustand =
  | { art: 'leer' }
  | { art: 'voll' }
  | { art: 'angefangen'; fehlt: ListenSpalte[] };

/** **Leer, vollständig oder angefangen** – und welche Zellen einer angefangenen Zeile fehlen oder nicht passen. */
export function zeilenZustand(l: ListeEinstellung, zeile: Record<string, string>): ZeilenZustand {
  if (l.spalten.every((s) => !(zeile[s.id] ?? '').trim())) return { art: 'leer' };
  const fehlt = l.spalten.filter((s) => !zelleGueltig(s, zeile[s.id]));
  return fehlt.length ? { art: 'angefangen', fehlt } : { art: 'voll' };
}

/** Die Antwort als Liste – leer, wenn sie etwas anderes ist. */
export function listeAus(w: unknown): ListeAntwort {
  const z = (w as Partial<ListeAntwort> | undefined)?.zeilen;
  if (!Array.isArray(z)) return { zeilen: [] };
  return {
    zeilen: z.map((x) =>
      x && typeof x === 'object'
        ? Object.fromEntries(
            Object.entries(x).filter((e): e is [string, string] => typeof e[1] === 'string'),
          )
        : {},
    ),
  };
}

/** Nur die vollständigen Zeilen – sie werden gespeichert, gezählt und summiert; leere fallen weg. */
export function vollstaendigeZeilen(
  l: ListeEinstellung,
  a: ListeAntwort,
): Record<string, string>[] {
  return a.zeilen.filter((z) => zeilenZustand(l, z).art === 'voll');
}

/** Die Spalte mit „Summe zeigen“ – höchstens eine. */
export function summenSpalte(l: ListeEinstellung): ListenSpalte | null {
  return l.spalten.find((s) => s.art === 'zahl' && s.summe) ?? null;
}

/** Auf Hundertstel gerundet – sonst stünde 0,1 + 0,2 als 0,30000000000000004 in ChurchTools. */
const hundertstel = (n: number) => Math.round(n * 100) / 100;

/** **Die Summe** über die vollständigen Zeilen – `null`, wenn keine Spalte „Summe zeigen“ hat. */
export function listenSumme(l: ListeEinstellung, a: ListeAntwort): number | null {
  const s = summenSpalte(l);
  if (!s) return null;
  return hundertstel(
    vollstaendigeZeilen(l, a).reduce((sum, z) => sum + (listenZahl(z[s.id] ?? '') ?? 0), 0),
  );
}

/** Die Summe für das Zahl-Feld in ChurchTools: mit Punkt – ein Komma lehnt ChurchTools mit 400 ab (M9). */
export function summeFuerCt(n: number): string {
  return String(hundertstel(n));
}

/** Kopf einer Spalte: „Wert gesamt (€)“. */
export function spaltenTitel(s: ListenSpalte): string {
  const e = s.art === 'zahl' ? s.einheit?.trim() : '';
  return e ? `${s.name.trim()} (${e})` : s.name.trim();
}

/** Eine Zelle als Text: Zahlen deutsch („1.234,5“), Text ohne Zeilenumbrüche. */
function zelleText(s: ListenSpalte, wert: string): string {
  if (s.art === 'zahl') return zahlText(listenZahl(wert) ?? 0);
  return wert.trim().replace(/\s*\n\s*/g, ' ');
}

const TRENNER = ' · ';

/**
 * **Der lesbare Text für ChurchTools** – Kopfzeile, dann eine Zeile je vollständigem Eintrag; `''` ohne Eintrag. Passt
 * er nicht in ein Gruppenfeld, fallen hinten Zeilen weg und die letzte sagt „… und n weitere Zeilen“ (vollständig
 * steht die Liste in „(Daten)“). Kein Umbruch am Ende – den schneidet ChurchTools ab (M9).
 */
export function listeLesbar(l: ListeEinstellung, a: ListeAntwort): string {
  const voll = vollstaendigeZeilen(l, a);
  if (!voll.length) return '';
  const kopf = l.spalten.map(spaltenTitel).join(TRENNER);
  const zeilen = voll.map((z) => l.spalten.map((s) => zelleText(s, z[s.id] ?? '')).join(TRENNER));
  const ganz = [kopf, ...zeilen].join('\n');
  if (ganz.length <= GRUPPENFELD_MAX) return ganz;
  for (let n = zeilen.length - 1; n >= 0; n--) {
    const rest = zeilen.length - n;
    const text = [
      kopf,
      ...zeilen.slice(0, n),
      `… und ${rest} weitere ${rest === 1 ? 'Zeile' : 'Zeilen'}`,
    ].join('\n');
    if (text.length <= GRUPPENFELD_MAX) return text;
  }
  return kopf.slice(0, GRUPPENFELD_MAX);
}

/** Kennzeichen des Formats von „(Daten)“ – ein späteres Format bekommt eine neue Nummer. */
const DATEN_FASSUNG = 1;

/**
 * **Die Spalte „(Daten)“** – die vollständigen Zeilen in fester Form: `{"v":1,"s":[Kennungen],"z":[[Zellen …]]}`, Zahlen
 * als Zahl. Einfaches JSON reicht: Sonderzeichen, HTML-Zeichen und Emoji kommen ohne Login unverändert zurück (M9).
 * `''` ohne Eintrag.
 */
export function listeDaten(l: ListeEinstellung, a: ListeAntwort): string {
  const voll = vollstaendigeZeilen(l, a);
  if (!voll.length) return '';
  return JSON.stringify({
    v: DATEN_FASSUNG,
    s: l.spalten.map((s) => s.id),
    z: voll.map((z) =>
      l.spalten.map((s) =>
        s.art === 'zahl' ? (listenZahl(z[s.id] ?? '') ?? 0) : (z[s.id] ?? '').trim(),
      ),
    ),
  });
}

/**
 * **„(Daten)“ wieder lesen** – mit den Spalten, wie sie jetzt sind: Zellen gehen über die Kennung an ihre Spalte,
 * Spalten, die es nicht mehr gibt, fallen weg. Zahlen kommen deutsch zurück („2,5“). `null`, wenn der Text nicht in
 * diesem Format ist (dann zeigt das Tool den lesbaren Text).
 */
export function listeAusDaten(l: ListeEinstellung, text: string): ListeAntwort | null {
  if (!text.trim()) return { zeilen: [] };
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return null;
  }
  const d = roh as { v?: unknown; s?: unknown; z?: unknown };
  if (d?.v !== DATEN_FASSUNG || !Array.isArray(d.s) || !Array.isArray(d.z)) return null;
  const ids = d.s.map((x) => (typeof x === 'string' ? x : ''));
  const bekannt = new Set(l.spalten.map((s) => s.id));
  const zeilen: Record<string, string>[] = [];
  for (const zeile of d.z as unknown[]) {
    if (!Array.isArray(zeile)) return null;
    const aus: Record<string, string> = {};
    ids.forEach((id, i) => {
      const w: unknown = zeile[i];
      if (!bekannt.has(id)) return;
      if (typeof w === 'number') aus[id] = String(w).replace('.', ',');
      else if (typeof w === 'string') aus[id] = w;
    });
    zeilen.push(aus);
  }
  return { zeilen };
}

/**
 * Wie lang eine **realistische** Zelle ist (E52, aus M9): Text 20 Zeichen („Zelt für 4 Personen“), Zahl 4 Stellen,
 * Auswahl so lang wie ihre längste Antwort. In „(Daten)“ kommen je Zelle Anführungszeichen und Komma dazu, je Zeile
 * Klammern und Komma.
 */
const TEXT_ZELLE_REALISTISCH = 20;
const ZAHL_ZELLE_REALISTISCH = 4;

/** **Ungefähre Länge von „(Daten)“**, wenn alle Zeilen mit realistischen Zellen gefüllt sind (E52). */
export function listeDatenSchaetzung(l: ListeEinstellung): number {
  const zelle = (s: ListenSpalte) =>
    s.art === 'zahl'
      ? ZAHL_ZELLE_REALISTISCH + 1
      : (s.art === 'auswahl'
          ? Math.max(0, ...(s.antworten ?? []).map((a) => a.trim().length))
          : TEXT_ZELLE_REALISTISCH) + 3;
  const zeile = 2 + l.spalten.reduce((n, s) => n + zelle(s), 0);
  const kopf = 20 + l.spalten.reduce((n, s) => n + s.id.length + 3, 0);
  return kopf + l.max * zeile;
}

/**
 * **Könnte eine volle Liste zu lang werden?** (Hinweis im Baukasten, F6b) – wenn die Schätzung über ein Gruppenfeld
 * (`GRUPPENFELD_MAX`) geht. Nur ein Hinweis: Was wirklich zählt, prüft `listePruefen` beim Absenden.
 */
export function listeKoennteZuLangWerden(l: ListeEinstellung): boolean {
  return listeDatenSchaetzung(l) > GRUPPENFELD_MAX;
}

/**
 * **Was an einer ausgefüllten Liste nicht stimmt** – Pfad-Teile für `pruefeAntworten` (`formular.ts`), jeweils hinter dem
 * Pfad des Felds: `<Zeile>.<Spalte>` je fehlender oder unpassender Zelle einer angefangenen Zeile, `max` bei mehr
 * Zeilen als erlaubt, `lang`, wenn „(Daten)“ nicht in ein Gruppenfeld passt, und `''` (das Feld selbst), wenn die Liste
 * Pflicht ist und keine Zeile vollständig. Angefangene Zeilen und die Länge gelten auch bei freiwilligen Listen.
 */
export function listePruefen(
  l: ListeEinstellung | undefined,
  wert: unknown,
  pflicht: boolean,
): string[] {
  if (!l) return [];
  const a = listeAus(wert);
  const fehlt: string[] = [];
  a.zeilen.forEach((z, i) => {
    const st = zeilenZustand(l, z);
    if (st.art === 'angefangen') for (const s of st.fehlt) fehlt.push(`${i}.${s.id}`);
  });
  const voll = vollstaendigeZeilen(l, a);
  if (voll.length > l.max) fehlt.push('max');
  if (listeDaten(l, a).length > GRUPPENFELD_MAX) fehlt.push('lang');
  if (pflicht && voll.length === 0) fehlt.push('');
  return fehlt;
}

/** Die Sätze unter der Liste im Formular – aus den Pfad-Teilen von `listePruefen` (Entwurf: „Zeile 2: Anzahl fehlt“). */
export function listeFehlerTexte(l: ListeEinstellung, teile: string[]): string[] {
  const texte: string[] = [];
  if (teile.includes('')) texte.push('Bitte mindestens eine Zeile vollständig ausfüllen.');
  const jeZeile = new Map<number, string[]>();
  for (const t of teile) {
    const m = /^(\d+)\.(.+)$/.exec(t);
    if (!m) continue;
    const s = l.spalten.find((x) => x.id === m[2]);
    if (!s) continue;
    const i = Number(m[1]);
    jeZeile.set(i, [...(jeZeile.get(i) ?? []), s.name.trim()]);
  }
  for (const [i, namen] of [...jeZeile].sort((x, y) => x[0] - y[0]))
    texte.push(`Zeile ${i + 1}: ${namen.join(', ')} ${namen.length === 1 ? 'fehlt' : 'fehlen'}`);
  if (teile.includes('max')) texte.push(`Höchstens ${l.max} Zeilen.`);
  if (teile.includes('lang'))
    texte.push('Die Liste ist zu lang zum Speichern – bitte kürzer fassen oder Zeilen weglassen.');
  return texte;
}
