/**
 * **Ansichten des Organigramms** (Bauplan O7b, Entwurf `o7b-ansichten-v1.html` abgenommen am 26.10.2026): was von der
 * Gemeinde zu sehen ist (Spitze, auf- und zugeklappt) und wie die Kästchen liegen – **von oben**, **von links** und als
 * **Mindmap**. Hier steht nur die Rechnung; gezeichnet wird in der Oberfläche (O7b-3).
 *
 * - **Spitze** ist die Gemeinde – in ChurchTools keine Gruppe, nur ihr Name – oder eine Gruppe („Anfangen bei“). Unter
 *   der Gemeinde stehen die Bereiche (die obersten Gruppen) in der Reihenfolge, die der Aufrufer liefert.
 * - **Schlüssel ist der Pfad** der Gruppen-IDs von oben (`10/7/12`): Eine Gruppe mit zwei Obergruppen steht wie im Baum
 *   unter beiden, und jede Stelle klappt für sich auf und zu. Die Gemeinde hat den Schlüssel `GEMEINDE`.
 * - **Im Kästchen der Name, darunter auf Wunsch die Personen** (O7b-6). Wie breit und hoch ein Kästchen wird, misst der
 *   Aufrufer (`breite`, `hoehe`) – so bleibt die Rechnung ohne Browser prüfbar. Die Linien treffen immer die Zeile mit
 *   dem Namen (`HOEHE`), auch bei hohen Kästchen.
 */
import type { Knoten } from './gruppen';

export const GEMEINDE = 'gemeinde';
/** Höhe eines Kästchens mit nur dem Namen – und der Zeile mit dem Namen in einem höheren (O7b-6). */
export const HOEHE = 36;
/** Halbmesser des runden +/− am Kästchen. */
export const SCHALTER = 9;

export interface SichtKnoten {
  schluessel: string;
  /** `null` = die Gemeinde selbst. */
  id: number | null;
  name: string;
  /** Eigene Farbe der Gruppe (ChurchTools-Name) und ihr Typ – daraus die Farbe der Kachel (O7b-8). `null` bei der Gemeinde. */
  farbe: string | null;
  typId: number | null;
  /** 0 = Spitze, 1 = die Ebene darunter (beide werden fett gezeigt). */
  ebene: number;
  /** Alle Untergruppen, auch zugeklappte – für das „+3“ am Schalter. */
  kinderZahl: number;
  offen: boolean;
  /** Nur die sichtbaren: leer, wenn zugeklappt. */
  kinder: SichtKnoten[];
}

const pfadKind = (pfad: string, id: number) => (pfad === GEMEINDE ? String(id) : `${pfad}/${id}`);

/** Die Gruppe an einem Pfad – `null`, wenn es ihn (nach Typ-Filter oder Änderung in ChurchTools) nicht mehr gibt. */
export function knotenAmPfad(baum: readonly Knoten[], pfad: string): Knoten | null {
  let ebene: readonly Knoten[] = baum;
  let gefunden: Knoten | null = null;
  for (const teil of pfad.split('/')) {
    gefunden = ebene.find((k) => String(k.gruppe.id) === teil) ?? null;
    if (!gefunden) return null;
    ebene = gefunden.kinder;
  }
  return gefunden;
}

/** Der erste Pfad zu einer Gruppe (bei zwei Obergruppen die erste Stelle im Baum) – für „Hier anfangen“. */
export function pfadVon(baum: readonly Knoten[], id: number): string | null {
  const lauf = (ks: readonly Knoten[], pfad: string): string | null => {
    for (const k of ks) {
      const p = pfadKind(pfad, k.gruppe.id);
      if (k.gruppe.id === id) return p;
      const t = lauf(k.kinder, p);
      if (t) return t;
    }
    return null;
  };
  return lauf(baum, GEMEINDE);
}

/**
 * Was „Anfangen bei“ anbietet (O7b-2, auch „Ausschnitt“ beim Drucken O7b-4): die ganze Gemeinde, jeder Bereich – und
 * die gewählte Spitze, wenn sie tiefer liegt („Im Organigramm hier anfangen“). Wert `''` = ganze Gemeinde.
 */
export function spitzenWahl(
  baum: readonly Knoten[],
  spitze: string | null,
): { wert: string; name: string }[] {
  const wahl = [
    { wert: '', name: 'Ganze Gemeinde' },
    ...baum.map((b) => ({ wert: String(b.gruppe.id), name: b.gruppe.name })),
  ];
  const tief = spitze?.includes('/') ? knotenAmPfad(baum, spitze) : null;
  if (tief && spitze) wahl.push({ wert: spitze, name: tief.gruppe.name });
  return wahl;
}

/** Wie es anfangs aussieht: die Gemeinde und die Bereiche offen, darunter zu. */
export function anfangsOffen(baum: readonly Knoten[]): Set<string> {
  return new Set([GEMEINDE, ...baum.map((b) => String(b.gruppe.id))]);
}

/**
 * Was zu sehen ist – ab der Spitze (`null` = ganze Gemeinde; ein Pfad, den es nicht mehr gibt, fällt auf die
 * Gemeinde zurück). `alles` klappt alles auf (Drucken).
 */
export function sichtbarerBaum(
  baum: readonly Knoten[],
  gemeinde: string,
  spitze: string | null,
  offen: ReadonlySet<string>,
  alles = false,
): SichtKnoten {
  const lauf = (k: Knoten, pfad: string, ebene: number): SichtKnoten => {
    const auf = alles || offen.has(pfad);
    return {
      schluessel: pfad,
      id: k.gruppe.id,
      name: k.gruppe.name,
      farbe: k.gruppe.farbe,
      typId: k.gruppe.typId,
      ebene,
      kinderZahl: k.kinder.length,
      offen: auf,
      kinder: auf ? k.kinder.map((c) => lauf(c, pfadKind(pfad, c.gruppe.id), ebene + 1)) : [],
    };
  };
  const k = spitze === null ? null : knotenAmPfad(baum, spitze);
  if (k && spitze !== null) return lauf(k, spitze, 0);
  const auf = alles || offen.has(GEMEINDE);
  return {
    schluessel: GEMEINDE,
    id: null,
    name: gemeinde,
    farbe: null,
    typId: null,
    ebene: 0,
    kinderZahl: baum.length,
    offen: auf,
    kinder: auf ? baum.map((b) => lauf(b, String(b.gruppe.id), 1)) : [],
  };
}

/** Alle Stellen unter der Spitze (sie eingeschlossen), die sich auf- und zuklappen lassen. */
function klappbar(baum: readonly Knoten[], spitze: string | null): string[] {
  const out: string[] = [];
  const lauf = (k: Knoten, pfad: string) => {
    if (!k.kinder.length) return;
    out.push(pfad);
    k.kinder.forEach((c) => lauf(c, pfadKind(pfad, c.gruppe.id)));
  };
  const k = spitze === null ? null : knotenAmPfad(baum, spitze);
  if (k && spitze !== null) lauf(k, spitze);
  else {
    out.push(GEMEINDE);
    baum.forEach((b) => lauf(b, String(b.gruppe.id)));
  }
  return out;
}

/** „Alle aufklappen“ – nur unter der Spitze; was außerhalb liegt, bleibt, wie es war. */
export function alleAuf(
  baum: readonly Knoten[],
  spitze: string | null,
  offen: ReadonlySet<string>,
): Set<string> {
  return new Set([...offen, ...klappbar(baum, spitze)]);
}

/** „Alle zuklappen“ – nur unter der Spitze, und die Spitze bleibt offen (sonst stünde nur ein Kästchen da). */
export function alleZu(
  baum: readonly Knoten[],
  spitze: string | null,
  offen: ReadonlySet<string>,
): Set<string> {
  const [oben, ...rest] = klappbar(baum, spitze);
  const zu = new Set(rest);
  const neu = new Set([...offen].filter((p) => !zu.has(p)));
  if (oben !== undefined) neu.add(oben);
  return neu;
}

// ── Anordnung ──

export interface Punkt {
  x: number;
  y: number;
}

export interface LageKnoten {
  knoten: SichtKnoten;
  /** Linke obere Ecke. */
  x: number;
  y: number;
  breite: number;
  /** Mindestens `HOEHE`; höher, wenn unter dem Namen Personen stehen (O7b-6). */
  hoehe: number;
  /** Mitte des +/−, wenn die Gruppe Untergruppen hat (auch zugeklappt). */
  schalter: Punkt | null;
}

/** Eine Linie von der Ober- zur Untergruppe: gerade Stücke, oder (`rund`) eine Kurve vom ersten zum letzten Punkt. */
export interface Kante {
  punkte: Punkt[];
  rund: boolean;
}

export interface Anordnung {
  knoten: LageKnoten[];
  kanten: Kante[];
  /** Was gezeichnet wird, samt +/−. */
  rahmen: { x: number; y: number; breite: number; hoehe: number };
  /**
   * Wo der Blick anfängt, wenn nicht alles lesbar passt: `x`/`y` im Bild kommen an den Anteil `fx`/`fy` der Fläche
   * (0 = Rand, 0,5 = Mitte) – von oben die Spitze oben in der Mitte, von links links in der Mitte, Mindmap in der Mitte.
   */
  anker: Punkt & { fx: number; fy: number };
}

export type AnordnungsArt = 'oben' | 'links' | 'mindmap';
export type Breite = (k: SichtKnoten) => number;
export type Hoehe = (k: SichtKnoten) => number;
/** Ohne Personen sind alle Kästchen gleich hoch. */
const NUR_NAME: Hoehe = () => HOEHE;

const blaetter = (k: SichtKnoten): number =>
  k.kinder.length ? k.kinder.reduce((a, c) => a + blaetter(c), 0) : 1;

/** Abstände – wie im Entwurf. */
const STAPEL_EINZUG = 30;
const STAPEL_LINIE = 14;
const STAPEL_ABSTAND = 12;
const SPALTEN_LUECKE = 28;
const BUS = 30;
const ZEILE = 46;
const EBENEN_LUECKE = 56;
const MINDMAP_ABSTAND = 70;

/**
 * **Von oben:** die Spitze oben, die Ebene darunter nebeneinander, alles Weitere darunter gestapelt und eingerückt –
 * wie ein klassisches Organigramm, das dadurch schmal genug für Beamer und Papier bleibt.
 */
function vonOben(spitze: SichtKnoten, breite: Breite, hoehe: Hoehe): Omit<Anordnung, 'rahmen'> {
  const knoten: LageKnoten[] = [];
  const kanten: Kante[] = [];
  const stapel = (k: SichtKnoten, x: number, y: number, trocken: boolean) => {
    const w = breite(k);
    const h = hoehe(k);
    const linie = x + STAPEL_LINIE;
    if (!trocken)
      knoten.push({
        knoten: k,
        x,
        y,
        breite: w,
        hoehe: h,
        schalter: k.kinderZahl ? { x: linie, y: y + h } : null,
      });
    let cy = y + h + 16;
    let rechts = x + w;
    for (const c of k.kinder) {
      const r = stapel(c, x + STAPEL_EINZUG, cy, trocken);
      const mitte = cy + HOEHE / 2;
      if (!trocken)
        kanten.push({
          punkte: [
            { x: linie, y: y + h + SCHALTER },
            { x: linie, y: mitte },
            { x: x + STAPEL_EINZUG, y: mitte },
          ],
          rund: false,
        });
      cy = r.unten + STAPEL_ABSTAND;
      rechts = Math.max(rechts, r.rechts);
    }
    return { unten: k.kinder.length ? cy - STAPEL_ABSTAND : y + h, rechts };
  };
  const w0 = breite(spitze);
  const h0 = hoehe(spitze);
  if (!spitze.kinder.length) {
    stapel(spitze, 0, 0, false);
    // Allein: ohne Untergruppen, der Schalter sitzt unten in der Mitte wie bei jeder Spitze.
    knoten[0].schalter = spitze.kinderZahl ? { x: w0 / 2, y: h0 } : null;
    return { knoten, kanten, anker: { x: w0 / 2, y: 0, fx: 0.5, fy: 0 } };
  }
  const spalten = spitze.kinder.map((c) => stapel(c, 0, 0, true).rechts);
  const gesamt = spalten.reduce((a, b) => a + b, 0) + SPALTEN_LUECKE * (spalten.length - 1);
  const mitte = gesamt / 2;
  const unten = h0 + 56;
  const bus = h0 + BUS;
  knoten.push({
    knoten: spitze,
    x: mitte - w0 / 2,
    y: 0,
    breite: w0,
    hoehe: h0,
    schalter: { x: mitte, y: h0 },
  });
  let x = 0;
  spitze.kinder.forEach((c, i) => {
    const m = x + breite(c) / 2;
    kanten.push({
      punkte: [
        { x: mitte, y: h0 + SCHALTER },
        { x: mitte, y: bus },
        { x: m, y: bus },
        { x: m, y: unten },
      ],
      rund: false,
    });
    stapel(c, x, unten, false);
    x += spalten[i] + SPALTEN_LUECKE;
  });
  return { knoten, kanten, anker: { x: mitte, y: 0, fx: 0.5, fy: 0 } };
}

/**
 * Ein Baum zur Seite (`richtung` 1 = nach rechts, −1 = nach links), senkrecht um 0 gemittelt: jede Ebene eine Spalte
 * ab `x0`, jedes Blatt eine Zeile, die Obergruppe mittig vor ihren Untergruppen. Hohe Kästchen (O7b-6) schieben alles
 * darunter weiter: Eine Zeile beginnt erst unter dem tiefsten Kästchen davor. Liefert die obersten Kästchen.
 */
function zurSeite(
  wurzeln: readonly SichtKnoten[],
  richtung: 1 | -1,
  x0: number,
  rund: boolean,
  breite: Breite,
  hoehe: Hoehe,
  knoten: LageKnoten[],
  kanten: Kante[],
): LageKnoten[] {
  const spalten: number[] = [];
  const messen = (k: SichtKnoten, d: number) => {
    spalten[d] = Math.max(spalten[d] ?? 0, breite(k));
    k.kinder.forEach((c) => messen(c, d + 1));
  };
  wurzeln.forEach((k) => messen(k, 0));
  const xs = [0];
  for (let d = 1; d < spalten.length; d++) xs[d] = xs[d - 1] + spalten[d - 1] + EBENEN_LUECKE;
  // Erst ab 0 nach unten setzen, am Ende um 0 mitteln – dazu sammeln, bevor es zu den anderen Kästchen kommt.
  const eigene: LageKnoten[] = [];
  const linien: Kante[] = [];
  const luecke = ZEILE - HOEHE;
  let frei = 0;
  const setzen = (k: SichtKnoten, d: number): LageKnoten => {
    const w = breite(k);
    const h = hoehe(k);
    const x = richtung > 0 ? x0 + xs[d] : x0 - xs[d] - w;
    const aussen = richtung > 0 ? x + w : x;
    let mitte: number;
    if (k.kinder.length) {
      const cs = k.kinder.map((c) => setzen(c, d + 1));
      mitte = (cs[0].y + cs[cs.length - 1].y) / 2 + HOEHE / 2;
      const start = aussen + SCHALTER * richtung;
      for (const c of cs) {
        const innen = richtung > 0 ? c.x : c.x + c.breite;
        const cm = c.y + HOEHE / 2;
        linien.push(
          rund
            ? {
                punkte: [
                  { x: start, y: mitte },
                  { x: innen, y: cm },
                ],
                rund: true,
              }
            : {
                punkte: [
                  { x: start, y: mitte },
                  { x: (start + innen) / 2, y: mitte },
                  { x: (start + innen) / 2, y: cm },
                  { x: innen, y: cm },
                ],
                rund: false,
              },
        );
      }
    } else mitte = frei + HOEHE / 2;
    const y = mitte - HOEHE / 2;
    frei = Math.max(frei, y + h + luecke);
    const lage: LageKnoten = {
      knoten: k,
      x,
      y,
      breite: w,
      hoehe: h,
      schalter: k.kinderZahl ? { x: aussen, y: mitte } : null,
    };
    eigene.push(lage);
    return lage;
  };
  const oben = wurzeln.map((k) => setzen(k, 0));
  const dy = -(frei - luecke) / 2;
  const runter = (p: Punkt) => ({ x: p.x, y: p.y + dy });
  for (const l of eigene) {
    l.y += dy;
    if (l.schalter) l.schalter = runter(l.schalter);
    knoten.push(l);
  }
  for (const l of linien) kanten.push({ ...l, punkte: l.punkte.map(runter) });
  return oben;
}

/** **Von links:** die Spitze links, jede Ebene eine Spalte weiter rechts. */
function vonLinks(spitze: SichtKnoten, breite: Breite, hoehe: Hoehe): Omit<Anordnung, 'rahmen'> {
  const knoten: LageKnoten[] = [];
  const kanten: Kante[] = [];
  const [oben] = zurSeite([spitze], 1, 0, false, breite, hoehe, knoten, kanten);
  // Die Spitze steht mittig vor ihren Untergruppen – nicht unbedingt auf 0 (die Zeilen sind um 0 gemittelt).
  return { knoten, kanten, anker: { x: 0, y: oben.y + HOEHE / 2, fx: 0, fy: 0.5 } };
}

/**
 * **Mindmap:** die Spitze in der Mitte, die Ebene darunter halb nach rechts, halb nach links – geteilt nach Zeilen, damit
 * beide Seiten etwa gleich hoch werden (rechts zuerst, in der gelieferten Reihenfolge).
 */
function mindmap(spitze: SichtKnoten, breite: Breite, hoehe: Hoehe): Omit<Anordnung, 'rahmen'> {
  const knoten: LageKnoten[] = [];
  const kanten: Kante[] = [];
  const w0 = breite(spitze);
  // Die offene Mitte hat keinen Schalter (Zuklappen ließe nur ein Kästchen übrig); eine zugeklappte schon, sonst
  // ginge sie nie wieder auf.
  const schalter = !spitze.offen && spitze.kinderZahl ? { x: w0 / 2, y: 0 } : null;
  knoten.push({
    knoten: spitze,
    x: -w0 / 2,
    y: -HOEHE / 2,
    breite: w0,
    hoehe: hoehe(spitze),
    schalter,
  });
  const gesamt = blaetter(spitze);
  const rechts: SichtKnoten[] = [];
  const links: SichtKnoten[] = [];
  let summe = 0;
  for (const c of spitze.kinder) {
    (summe < gesamt / 2 || !rechts.length ? rechts : links).push(c);
    summe += blaetter(c);
  }
  const ab = w0 / 2 + MINDMAP_ABSTAND;
  for (const t of zurSeite(rechts, 1, ab, true, breite, hoehe, knoten, kanten))
    kanten.push({
      punkte: [
        { x: w0 / 2, y: 0 },
        { x: t.x, y: t.y + HOEHE / 2 },
      ],
      rund: true,
    });
  for (const t of zurSeite(links, -1, -ab, true, breite, hoehe, knoten, kanten))
    kanten.push({
      punkte: [
        { x: -w0 / 2, y: 0 },
        { x: t.x + t.breite, y: t.y + HOEHE / 2 },
      ],
      rund: true,
    });
  return { knoten, kanten, anker: { x: 0, y: 0, fx: 0.5, fy: 0.5 } };
}

/** Die Kästchen einer Ansicht anordnen – ohne `hoehe` alle mit nur dem Namen. */
export function anordnen(
  art: AnordnungsArt,
  spitze: SichtKnoten,
  breite: Breite,
  hoehe: Hoehe = NUR_NAME,
): Anordnung {
  const teil =
    art === 'oben'
      ? vonOben(spitze, breite, hoehe)
      : art === 'links'
        ? vonLinks(spitze, breite, hoehe)
        : mindmap(spitze, breite, hoehe);
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const k of teil.knoten) {
    x1 = Math.min(x1, k.x, (k.schalter?.x ?? Infinity) - SCHALTER);
    x2 = Math.max(x2, k.x + k.breite, (k.schalter?.x ?? -Infinity) + SCHALTER);
    y1 = Math.min(y1, k.y);
    y2 = Math.max(y2, k.y + k.hoehe, (k.schalter?.y ?? -Infinity) + SCHALTER);
  }
  return { ...teil, rahmen: { x: x1, y: y1, breite: x2 - x1, hoehe: y2 - y1 } };
}

/**
 * **Das Stück vom Kästchen bis zur ersten Linie**, wo am Bildschirm das +/− sitzt (O7b-4). Alle Linien beginnen einen
 * Halbmesser neben dem Schalter (`SCHALTER`); auf Papier gibt es keinen Schalter, die Lücke wäre zu sehen. `null`, wenn
 * die Gruppe zu ist oder keine Untergruppen hat – dann geht keine Linie ab.
 */
export function schalterStummel(lage: LageKnoten): Kante | null {
  const s = lage.schalter;
  if (!s || !lage.knoten.kinder.length) return null;
  // Der Schalter sitzt auf dem Rand des Kästchens: unten (von oben), rechts oder links (zur Seite, Mindmap).
  const ende =
    s.y >= lage.y + lage.hoehe
      ? { x: s.x, y: s.y + SCHALTER }
      : { x: s.x + (s.x >= lage.x + lage.breite ? SCHALTER : -SCHALTER), y: s.y };
  return { punkte: [s, ende], rund: false };
}

/** Eine Kante als SVG-Pfad (`d`). */
export function kantenPfad(k: Kante): string {
  const [a, ...rest] = k.punkte;
  if (k.rund && rest.length) {
    const b = rest[rest.length - 1];
    const m = (a.x + b.x) / 2;
    return `M${a.x} ${a.y}C${m} ${a.y} ${m} ${b.y} ${b.x} ${b.y}`;
  }
  return `M${a.x} ${a.y}` + rest.map((p) => `L${p.x} ${p.y}`).join('');
}
