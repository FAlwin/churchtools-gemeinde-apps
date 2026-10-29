/**
 * **Das Blatt der Organigramm-PDF** (O7b-4, Entwurf `o7b-4-pdf-v1.html`, abgenommen 28.10.2026): Papier, Ränder,
 * wie groß das Diagramm wird und wie die Liste auf Seiten verteilt wird. Nur Rechnen, in Millimetern – gezeichnet wird
 * in `BlattSeite.tsx`, zur PDF wird es in `ui/teilen/svgSeitenPdf.ts`.
 *
 * Vorher (bis zum Test 28.10.2026) druckte die Erweiterung über den Druckdialog des Browsers. Safari hält sich dabei
 * nicht an das Querformat und druckt Adresse und Datum an den Rand – deshalb jetzt eine echte PDF-Datei.
 */
import type { Anordnung, SichtKnoten } from '@shared/organigramm/ansichten';
import { rollenZahl } from '@shared/organigramm/personen';
import type { KastenInhalt } from './kastenPersonen';
import { kuerzenAuf, nachKommasUmbrechen } from './umbruch';

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
/** Personen unter einer Gruppe (O7b-6b): engere Zeilen, kleinere Schrift (mm). */
export const PERSON_ZEILE = 4.4;
export const ROLLE_GROESSE = 2.469; // 7 pt
export const PERSON_GROESSE = 2.999; // 8,5 pt
/** Zwischen Rolle und Namen (mm). */
const ROLLE_ABSTAND = 1.5;

export type ListenZeile =
  | {
      art: 'gruppe';
      knoten: SichtKnoten;
      /** 0 = die Spitze. */
      tiefe: number;
    }
  | {
      art: 'person';
      schluessel: string;
      /** Die Ebene der Gruppe, zu der die Zeile gehört. */
      tiefe: number;
      /** Wie viele senkrechte Linien links durchlaufen – die der Gruppe selbst, wenn darunter Untergruppen folgen. */
      linien: number;
      /** Die Rolle steht nur in der ersten Zeile; die Namen beginnen in allen Zeilen bei `ab`. */
      rolle: string | null;
      ab: number;
      text: string;
      kursiv: boolean;
    };

/** Breite eines Textes in mm – gemessen beim Aufrufer mit der Schrift der Seite. */
export type ListenMass = (text: string, fett: boolean, groesse: number) => number;

/** Personen stehen etwas eingerückt unter dem Namen – rechts von dessen Linie, aber vor den Untergruppen (mm). */
const PERSONEN_EINZUG = 3.5;

/** Wo der Name einer Gruppe steht – rechts neben der Linie seiner Ebene (die Spitze ganz links). */
export const namenX = (f: { x: number }, tiefe: number) =>
  f.x + tiefe * EINRUECKEN + (tiefe ? 1.5 : 0);

/** Wo eine Personen-Zeile beginnt: unter dem Namen der Gruppe, halb so weit eingerückt wie eine Untergruppe. */
export const personenX = (f: { x: number }, tiefe: number) => namenX(f, tiefe) + PERSONEN_EINZUG;

const zeilenHoehe = (z: ListenZeile) => (z.art === 'gruppe' ? ZEILE : PERSON_ZEILE);

/** Die Personen einer Gruppe als Zeilen der Liste – Rollen, Umbruch und Kürzen wie im Kästchen des Diagramms. */
function personenZeilen(
  k: SichtKnoten,
  tiefe: number,
  i: KastenInhalt,
  platz: number,
  mass: ListenMass,
): ListenZeile[] {
  const basis = {
    art: 'person' as const,
    tiefe,
    linien: tiefe + (k.kinder.length ? 1 : 0),
  };
  const person = (t: string) => mass(t, false, PERSON_GROESSE);
  if (i.art === 'hinweis')
    return [
      {
        ...basis,
        schluessel: `${k.schluessel}:0`,
        rolle: null,
        ab: 0,
        text: kuerzenAuf(i.text, platz, person),
        kursiv: true,
      },
    ];
  const out: ListenZeile[] = [];
  for (const g of i.gruppen) {
    const rolle = g.rolle.toLocaleUpperCase('de');
    const ab = mass(rolle, true, ROLLE_GROESSE) + ROLLE_ABSTAND;
    const texte = g.nurZahl
      ? [kuerzenAuf(rollenZahl(g), platz - ab, person)]
      : nachKommasUmbrechen(g.namen, platz - ab, person);
    texte.forEach((text, n) =>
      out.push({
        ...basis,
        schluessel: `${k.schluessel}:${out.length}`,
        rolle: n === 0 ? rolle : null,
        ab,
        text,
        kursiv: g.nurZahl,
      }),
    );
  }
  return out;
}

/**
 * Die Liste in Leserichtung, auf Seiten verteilt – so viele Zeilen, wie zwischen Kopf und Fuß passen. Mit `leute`
 * (O7b-6b) stehen unter jeder Gruppe ihre Personen; der Name einer Gruppe bleibt dabei nie allein unten auf einer Seite
 * stehen, während ihre Personen auf der nächsten beginnen.
 */
export function listenSeiten(
  sicht: SichtKnoten,
  p: Papier,
  leute?: { inhalt: (id: number) => KastenInhalt | null; mass: ListenMass },
): ListenZeile[][] {
  const f = flaeche(p);
  const zeilen: ListenZeile[] = [];
  const lauf = (k: SichtKnoten, tiefe: number) => {
    zeilen.push({ art: 'gruppe', knoten: k, tiefe });
    const i = k.id === null || !leute ? null : leute.inhalt(k.id);
    if (i && leute)
      zeilen.push(...personenZeilen(k, tiefe, i, f.x + f.breite - personenX(f, tiefe), leute.mass));
    k.kinder.forEach((c) => lauf(c, tiefe + 1));
  };
  lauf(sicht, 0);
  const seiten: ListenZeile[][] = [[]];
  let belegt = 0;
  zeilen.forEach((z, n) => {
    const folgt = zeilen[n + 1];
    // Eine Gruppe nimmt ihre erste Personen-Zeile mit auf die Seite.
    const braucht =
      zeilenHoehe(z) + (z.art === 'gruppe' && folgt?.art === 'person' ? PERSON_ZEILE : 0);
    if (belegt > 0 && belegt + braucht > f.hoehe + 1e-9) {
      seiten.push([]);
      belegt = 0;
    }
    seiten[seiten.length - 1].push(z);
    belegt += zeilenHoehe(z);
  });
  return seiten;
}

/** „Organigramm-Gottesdienst-2026-10-28.pdf“ – nur Buchstaben, Ziffern und Striche, damit jedes Gerät sie nimmt. */
export function pdfDateiname(name: string, datum: Date): string {
  const teil = name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'Gemeinde';
  const tag = `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}-${String(datum.getDate()).padStart(2, '0')}`;
  return `Organigramm-${teil}-${tag}.pdf`;
}
