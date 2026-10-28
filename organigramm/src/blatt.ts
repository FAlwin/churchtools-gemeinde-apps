/**
 * **Das Blatt der Organigramm-PDF** (O7b-4, Entwurf `o7b-4-pdf-v1.html`, abgenommen 28.10.2026): Papier, Ränder,
 * wie groß das Diagramm wird und wie die Liste auf Seiten verteilt wird. Nur Rechnen, in Millimetern – gezeichnet wird
 * in `BlattSeite.tsx`, zur PDF wird es in `ui/teilen/svgSeitenPdf.ts`.
 *
 * Vorher (bis zum Test 28.10.2026) druckte die Erweiterung über den Druckdialog des Browsers. Safari hält sich dabei
 * nicht an das Querformat und druckt Adresse und Datum an den Rand – deshalb jetzt eine echte PDF-Datei.
 */
import type { Anordnung, SichtKnoten } from '@shared/organigramm/ansichten';

export interface Papier {
  id: 'a4-quer' | 'a4-hoch' | 'a3-quer' | 'a3-hoch';
  label: string;
  /** Blatt in Millimetern. */
  breite: number;
  hoehe: number;
}

export const PAPIERE: readonly Papier[] = [
  { id: 'a4-quer', label: 'A4 quer', breite: 297, hoehe: 210 },
  { id: 'a4-hoch', label: 'A4 hoch', breite: 210, hoehe: 297 },
  { id: 'a3-quer', label: 'A3 quer', breite: 420, hoehe: 297 },
  { id: 'a3-hoch', label: 'A3 hoch', breite: 297, hoehe: 420 },
];

/** „Passend“: das A4, auf dem das Diagramm am größten wird (Entwurf: vorgewählt). */
export type PapierWahl = Papier['id'] | 'passend';

const papier = (id: Papier['id']) => PAPIERE.find((p) => p.id === id)!;

/** Rand, Kopf (Logo, Titel, Stand, Linie) und Fuß (Gemeinde, Seitenzahl) in Millimetern. */
export const RAND = 14;
export const KOPF = 22;
export const FUSS = 10;

/** 1 pt in Millimetern. */
export const PT = 25.4 / 72;
/** Schriftgröße im Diagramm in seinen eigenen Einheiten (`Diagramm.module.scss`). */
const SCHRIFT_EINHEITEN = 14;
/** Größer als 11 pt wird ein kleines Diagramm nicht – sonst wirkt es aufgeblasen. */
export const GROESSTE_PT = 11;
/** Darunter wird es schwer lesbar – das Fenster rät dann zu A3 oder einem Ausschnitt. */
export const KLEINSTE_PT = 6;
/** Luft ums Diagramm, in seinen Einheiten. */
const LUFT = 8;

/** Wo auf dem Blatt der Inhalt steht – zwischen Kopf und Fuß. */
export function flaeche(p: Papier) {
  return {
    x: RAND,
    y: RAND + KOPF,
    breite: p.breite - 2 * RAND,
    hoehe: p.hoehe - 2 * RAND - KOPF - FUSS,
  };
}

/** Millimeter je Einheit des Diagramms, damit es aufs Blatt passt – höchstens so, dass die Schrift 11 pt hat. */
export function massstab(rahmen: Anordnung['rahmen'], p: Papier): number {
  const f = flaeche(p);
  return Math.min(
    f.breite / (rahmen.breite + 2 * LUFT),
    f.hoehe / (rahmen.hoehe + 2 * LUFT),
    (GROESSTE_PT * PT) / SCHRIFT_EINHEITEN,
  );
}

/** Die Schriftgröße der Namen auf dem Blatt, in pt. */
export const schriftPt = (mmJeEinheit: number) => (mmJeEinheit * SCHRIFT_EINHEITEN) / PT;

/** Das Diagramm mittig auf die Fläche: verschieben und vergrößern (für `transform`). */
export function einpassen(rahmen: Anordnung['rahmen'], p: Papier) {
  const f = flaeche(p);
  const s = massstab(rahmen, p);
  return {
    x: f.x + (f.breite - rahmen.breite * s) / 2 - rahmen.x * s,
    y: f.y + (f.hoehe - rahmen.hoehe * s) / 2 - rahmen.y * s,
    massstab: s,
  };
}

/**
 * Das Papier zur Wahl. „Passend“ nimmt für ein Diagramm das A4, auf dem es größer wird (bei Gleichstand quer); eine Liste
 * steht hoch.
 */
export function papierFuer(wahl: PapierWahl, rahmen: Anordnung['rahmen'] | null): Papier {
  if (wahl !== 'passend') return papier(wahl);
  if (!rahmen) return papier('a4-hoch');
  const quer = papier('a4-quer');
  const hoch = papier('a4-hoch');
  return massstab(rahmen, quer) >= massstab(rahmen, hoch) ? quer : hoch;
}

// ── Liste ──

/** Höhe einer Zeile und Einrückung je Ebene (mm). */
export const ZEILE = 6.6;
export const EINRUECKEN = 7;

export interface ListenZeile {
  knoten: SichtKnoten;
  /** 0 = die Spitze. */
  tiefe: number;
}

/** Die Liste in Leserichtung, auf Seiten verteilt – so viele Zeilen, wie zwischen Kopf und Fuß passen. */
export function listenSeiten(sicht: SichtKnoten, p: Papier): ListenZeile[][] {
  const zeilen: ListenZeile[] = [];
  const lauf = (k: SichtKnoten, tiefe: number) => {
    zeilen.push({ knoten: k, tiefe });
    k.kinder.forEach((c) => lauf(c, tiefe + 1));
  };
  lauf(sicht, 0);
  const proSeite = Math.max(1, Math.floor(flaeche(p).hoehe / ZEILE));
  const seiten: ListenZeile[][] = [];
  for (let i = 0; i < zeilen.length; i += proSeite) seiten.push(zeilen.slice(i, i + proSeite));
  return seiten;
}

/** „Organigramm-Gottesdienst-2026-10-28.pdf“ – nur Buchstaben, Ziffern und Striche, damit jedes Gerät sie nimmt. */
export function pdfDateiname(name: string, datum: Date): string {
  const teil = name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'Gemeinde';
  const tag = `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}-${String(datum.getDate()).padStart(2, '0')}`;
  return `Organigramm-${teil}-${tag}.pdf`;
}
