import { metaWerte } from './chordproMeta';

/**
 * **Liedinfo: Kopfzeilen der Datei ↔ Stammdaten in ChurchTools** (Lied-Editor L4, 23.10.2026).
 *
 * Alwin hat entschieden (L0 + 23.10.): Titel, Autor, CCLI, Copyright (am Lied) sowie Tempo und Takt (am Arrangement)
 * gehören nach ChurchTools. Lieder, die nie im neuen Editor gespeichert werden, bleiben wie sie sind – die Datei hat
 * dort weiter Vorrang (`setlistKern`, `chartHead`). Wird ein Lied im Editor gespeichert, wandern die Angaben nach
 * ChurchTools und die Zeilen verlassen die Datei.
 *
 * **`{key}` fehlt hier mit Absicht:** Es ist die *notierte* Tonart dieser Fassung (#398) – davon hängt das
 * Transponieren ab – und bleibt in der Datei. Ebenso bleiben SongSelect-Zeilen ohne ChurchTools-Feld
 * (`{ccli_license}`, `{footer}`, `{subtitle}` …).
 */
export const LIEDINFO_FELDER = [
  { feld: 'name', zeile: 'title', ort: 'lied' },
  { feld: 'author', zeile: 'artist', ort: 'lied' },
  { feld: 'ccli', zeile: 'ccli', ort: 'lied' },
  { feld: 'copyright', zeile: 'copyright', ort: 'lied' },
  { feld: 'tempo', zeile: 'tempo', ort: 'arrangement' },
  { feld: 'beat', zeile: 'time', ort: 'arrangement' },
] as const;

export type LiedinfoFeld = (typeof LIEDINFO_FELDER)[number]['feld'];
/** Werte je Feld als Text – fehlend oder leer heißt „nicht gesetzt“. */
export type Liedinfo = Partial<Record<LiedinfoFeld, string | null>>;

/** Mehrere Zeilen desselben Felds (SongSelect: Original- und Übersetzungs-Autor) – keine geht verloren. */
const TRENNER = ' / ';

/** Was die Datei an Liedinfo trägt. */
export function liedinfoAusDatei(text: string): Liedinfo {
  const info: Liedinfo = {};
  for (const { feld, zeile } of LIEDINFO_FELDER) {
    const werte = metaWerte(text, zeile);
    if (werte.length) info[feld] = werte.join(TRENNER);
  }
  return info;
}

function wert(v: string | null | undefined): string {
  return (v ?? '').trim().replace(/\s+/g, ' ');
}

/** Gleich im Sinne der Anzeige: Leerraum zählt nicht, Tempo als Zahl („72“ = „72.0“). */
function gleich(feld: LiedinfoFeld, a: string, b: string): boolean {
  if (feld === 'tempo' && a && b) return Number(a) === Number(b);
  return a === b;
}

/**
 * - `leer`: Die Datei hat nichts – ChurchTools gilt ohnehin.
 * - `gleich`: Beide sagen dasselbe – die Zeile kann einfach gehen.
 * - `vorbelegen`: Nur die Datei hat einen Wert – er wird ins Formular übernommen (Alwin, 23.10.).
 * - `abweichung`: Beide haben verschiedene Werte – Hinweis am Feld, Alwin entscheidet je Feld.
 */
export type LiedinfoArt = 'leer' | 'gleich' | 'vorbelegen' | 'abweichung';

export interface LiedinfoVergleich {
  feld: LiedinfoFeld;
  datei: string;
  ct: string;
  art: LiedinfoArt;
}

/** Datei und ChurchTools Feld für Feld nebeneinander. */
export function liedinfoVergleich(datei: Liedinfo, ct: Liedinfo): LiedinfoVergleich[] {
  return LIEDINFO_FELDER.map(({ feld }) => {
    const d = wert(datei[feld]);
    const c = wert(ct[feld]);
    const art: LiedinfoArt = !d
      ? 'leer'
      : !c
        ? 'vorbelegen'
        : gleich(feld, d, c)
          ? 'gleich'
          : 'abweichung';
    return { feld, datei: d, ct: c, art };
  });
}

/**
 * **Die Kopfzeilen entfernen, deren Feld ChurchTools wirklich hat.** `ctStand` ist der Stand NACH dem Speichern –
 * was der Server zurückmeldet, nicht was abgeschickt wurde. Hat ChurchTools ein Feld nicht (leer, keine Rechte,
 * Speichern gescheitert), bleibt die Zeile in der Datei: So geht keine Angabe verloren.
 *
 * Entfernt wird die ganze Zeile samt Zeilenumbruch, wenn sie nur aus der Angabe besteht; alle Zeilen desselben
 * Felds (zwei `{artist}`). Alles andere bleibt Zeichen für Zeichen.
 */
export function liedinfoZeilenEntfernen(text: string, ctStand: Liedinfo): string {
  const weg = LIEDINFO_FELDER.filter(({ feld }) => wert(ctStand[feld])).map((f) => f.zeile);
  if (!weg.length) return text;
  return text.replace(new RegExp(`^${zeileKern(weg)}(?:\\r?\\n|$)`, 'gim'), '');
}

/** Eine Kopfzeile, die nur aus einer dieser Angaben besteht – EINE Grammatik für Entfernen und Ausblenden. */
function zeileKern(zeilen: readonly string[]): string {
  return `[ \\t]*\\{(?:${zeilen.join('|')})\\s*:[^}\\n]*\\}[ \\t]*`;
}

/**
 * **Ist diese Zeile eine Liedinfo-Kopfzeile?** Der Editor blendet sie aus, sobald die Liedinfo sie zeigt (L4) –
 * nach derselben Grammatik, nach der sie beim Speichern entfernt wird.
 */
export const LIEDINFO_ZEILE = new RegExp(
  `^${zeileKern(LIEDINFO_FELDER.map((f) => f.zeile))}$`,
  'i',
);
