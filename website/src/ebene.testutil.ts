/**
 * Hilfen für die Tests der Bedien-Schicht (`ebene.test.ts`, `ebene.kern.test.ts`): Kern und Skript laufen im iframe, hier laufen
 * sie im Dokument der Testumgebung nach.
 */
import { vi } from 'vitest';
import { renderSeite } from '@shared/website/render';
import { kontext } from '@shared/website/website.testdaten';
import type { Seite } from '@shared/website/modell';
import { ABSTAENDE, aufteilungenJeSpalten } from './ebene';
import kernText from './ebene.kern.txt?raw';
import skriptText from './ebene.skript.txt?raw';

/** Die reinen Rechenschritte des Kerns (Kollision, Textmodell, Lesen/Zeichnen). */
export type Kern = {
  flaeche: (a: Rechteck, b: Rechteck) => number;
  aufblasen: (r: Rechteck, d: number) => Rechteck;
  waehle: (
    kand: Kandidat[],
    hind: Rechteck[],
    belegt: Rechteck[],
    opt?: { pflicht?: boolean; erzwinge?: boolean; breite?: number },
  ) => Platz | null;
  ordne: (
    elemente: { name: string; rang: number; pflicht?: boolean; kand: Kandidat[] }[],
    hind: Rechteck[],
    breite: number,
    belegt?: Rechteck[],
  ) => Record<string, Platz | null>;
  RANG: Record<string, number>;
  anteile: (name: string) => number[];
  teilerAnteil: (name: string, j: number) => number;
  aufteilungRasten: (namen: string[], j: number, s: number) => string | null;
  aufteilungFrei: (namen: string[]) => boolean;
  aufteilungText: (name: string) => string;
  aufteilungNachbar: (
    namen: string[],
    j: number,
    aktuell: string,
    richtung: 'links' | 'rechts',
  ) => string | null;
  spaltenLage: (links: number, rechts: number, n: number, gap: number) => Lage;
  teilerX: (lage: Lage, name: string, j: number) => number;
  zeigerAnteil: (lage: Lage, x: number, j: number) => number;
  abstandRasten: (
    stufen: readonly string[],
    px: Record<string, number>,
    ziel: number,
  ) => string | null;
  stufenMessen: (wurzel: Element, stufen: readonly string[]) => Record<string, number>;
  formatUmschalten: Schritt3<'fett' | 'kursiv'>;
  linkSetzen: Schritt3<string>;
  linkEntfernen: Schritt;
  listeUmschalten: Schritt;
  ueberschriftUmschalten: Schritt;
  formatZustand: (
    b: Block[],
    a: Auswahl,
  ) => {
    fett: boolean;
    kursiv: boolean;
    link: string | null;
    liste: boolean;
    ueberschrift: boolean;
  };
  loeschen: Schritt;
  einfuegen: Schritt3<string>;
  teilen: Schritt;
  umbruch: Schritt;
  fuerSpeichern: (b: Block[]) => Block[];
  lesen: (wurzel: Element, sel: Selection | null) => { bloecke: Block[]; auswahl: Auswahl | null };
  rendern: (wurzel: Element, b: Block[]) => void;
  auswahlSetzen: (wurzel: Element, a: Auswahl) => void;
  zusammengefallen: (a: Auswahl) => boolean;
  laenge: (b: Block) => number;
};
export type Lage = { links: number; n: number; gap: number; nutz: number };
export type Rechteck = { l: number; t: number; r: number; b: number };
export type Kandidat = Rechteck & { sk?: boolean };
export type Platz = { rect: Rechteck; sk?: boolean; index: number; ue: number };
export type Lauf = { t: string; fett?: true; kursiv?: true; link?: string };
export type Block = { art: 'p' | 'h' | 'ul' | 'ol'; laeufe: Lauf[] };
export type Stelle = { b: number; o: number };
export type Auswahl = { von: Stelle; bis: Stelle };
type Schritt = (b: Block[], a: Auswahl) => { bloecke: Block[]; auswahl: Auswahl };
type Schritt3<T> = (b: Block[], a: Auswahl, x: T) => { bloecke: Block[]; auswahl: Auswahl };

export function ladeKern(): Kern {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- der Kern, der im iframe läuft, wird hier im Dokument nachgespielt
  return new Function(`return (${kernText}\n)`)() as Kern;
}

export interface Start {
  scroll?: number;
  modus?: 'computer' | 'handy';
  darfHtml?: boolean;
  weiter?: { i: number; j: number; k: number; feld: string; n: number } | null;
}

export const SYMBOLE = {
  plus: '<svg>+</svg>',
  stift: '<svg>s</svg>',
  hoch: '<svg>^</svg>',
  runter: '<svg>v</svg>',
  kopie: '<svg>k</svg>',
  muell: '<svg>m</svg>',
  griff: '<svg>g</svg>',
  link: '<svg>l</svg>',
  liste: '<svg>li</svg>',
  regler: '<svg>r</svg>',
};

/** Alles, was die Schicht an `document`/`window` anmeldet – damit jeder Test mit einem leeren Dokument anfängt. */
const angemeldet: [EventTarget, string, EventListenerOrEventListenerObject, unknown][] = [];
export function aufraeumen(): void {
  for (const [z, t, l, o] of angemeldet) z.removeEventListener(t, l, o as AddEventListenerOptions);
  angemeldet.length = 0;
  vi.restoreAllMocks();
  document.body.innerHTML = '';
}

/** Die Seite in das Dokument legen (nur den Körper – Skripte in `innerHTML` laufen nicht) und die Schicht darüber starten. */
export function starten(s: Seite, opt: Start = {}) {
  // jsdom kennt die Maße von Textstücken nicht (Range.getClientRects) – leer genügt: Es gibt dann keine Hindernisse.
  const leeresRechteck = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
  if (!('getClientRects' in Range.prototype))
    Object.assign(Range.prototype, {
      getClientRects: () => [],
      getBoundingClientRect: () => ({ ...leeresRechteck, toJSON: () => ({}) }),
    });
  const html = renderSeite(s, kontext({ seiten: [s] }));
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/
    .exec(html)![1]
    .replace(/<script[^>]*><\/script>/g, '');
  for (const ziel of [document, window, document.documentElement] as EventTarget[]) {
    const orig = ziel.addEventListener.bind(ziel);
    vi.spyOn(ziel, 'addEventListener').mockImplementation((t, l, o) => {
      if (l) angemeldet.push([ziel, t, l, o]);
      orig(t, l, o);
    });
  }
  const senden = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- das Skript, das im iframe läuft, wird hier im Dokument nachgespielt
  const skript = new Function(`return (${skriptText}\n)`)() as (c: unknown, k: unknown) => void;
  skript(
    {
      scroll: opt.scroll ?? 0,
      symbole: SYMBOLE,
      modus: opt.modus ?? 'computer',
      darfHtml: opt.darfHtml ?? false,
      abstaende: ABSTAENDE,
      aufteilungen: aufteilungenJeSpalten(),
      abstandNamen: { kein: 'Kein', klein: 'Klein', normal: 'Normal', gross: 'Groß' },
      weiter: opt.weiter ?? null,
    },
    ladeKern(),
  );
  return senden;
}

/** Die Nachrichten, die die Schicht bisher gesendet hat. */
export const gesendet = (spy: ReturnType<typeof starten>): Record<string, unknown>[] =>
  spy.mock.calls.map((c) => c[0] as Record<string, unknown>);
