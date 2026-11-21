// @vitest-environment jsdom
/**
 * Maße ziehen in der Bedien-Schicht (W3c-3): Spaltenbreite an der Trennlinie und Abstand an der Pille. Die Rechnung der Rastung
 * prüft `ebene.kern.test.ts`; hier geht es um das, was das Skript daraus macht: Griff, Rastlinien, Chip, Bänder, Esc, die EINE
 * Nachricht, der Klick ohne Ziehen. jsdom misst nichts – Maße und das „Stylesheet“ (Innenabstand je Stufe) legt der Test fest.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { abschnitt, baustein, seite, spalte } from '@shared/website/website.testdaten';
import { ABSTAENDE } from './ebene';
import { aufraeumen, gesendet, starten } from './ebene.testutil';

const M = (rest: Record<string, unknown>) => ({ websiteEditor: true, ...rest });
const maße = (el: Element, l: number, t: number, r: number, b: number) =>
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: l,
    top: t,
    right: r,
    bottom: b,
    width: r - l,
    height: b - t,
    x: l,
    y: t,
    toJSON: () => ({}),
  });
const zeiger = (art: string, el: Element, x: number, y: number) =>
  el.dispatchEvent(new MouseEvent(art, { bubbles: true, clientX: x, clientY: y, button: 0 }));
const hoverAuf = (el: Element) => {
  zeiger('pointermove', el, 5, 5);
  vi.advanceTimersByTime(500);
};
const taste = (key: string, ziel: EventTarget = document) =>
  ziel.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

/** a0: eine Spalte · a1: zwei Spalten (1-1) mit Text links · a2: drei Spalten · a3: vier Spalten. */
const SEITE = seite({
  abschnitte: [
    abschnitt([baustein('ueberschrift', { id: 'u1' })], { id: 'a0' }),
    abschnitt([], {
      id: 'a1',
      aufteilung: '1-1',
      spalten: [
        spalte([baustein('text', { id: 'c0' })], { id: 's0' }),
        spalte([baustein('trenner', { id: 'c1' })], { id: 's1' }),
      ],
    }),
    abschnitt([], {
      id: 'a2',
      aufteilung: '1-1-1',
      spalten: [
        spalte([baustein('text', { id: 'd0' })], { id: 'p0' }),
        spalte([baustein('text', { id: 'd1' })], { id: 'p1' }),
        spalte([baustein('text', { id: 'd2' })], { id: 'p2' }),
      ],
    }),
    abschnitt([], {
      id: 'a3',
      aufteilung: '1-1-1-1',
      spalten: [0, 1, 2, 3].map((n) =>
        spalte([baustein('text', { id: `e${n}` })], { id: `q${n}` }),
      ),
    }),
  ],
});

/** Zwei Spalten von 0–400 und 440–840 (Lücke 40); a1 liegt bei 300–600. */
function messen() {
  const secs = [...document.querySelectorAll('section.w-abschnitt')];
  const inn = [...document.querySelectorAll('.w-abschnitt-innen')];
  const sp = [...document.querySelectorAll('.w-spalte')];
  maße(secs[0], 0, 0, 840, 200);
  maße(inn[0], 0, 20, 840, 180);
  maße(sp[0], 0, 20, 840, 180);
  maße(secs[1], 0, 300, 840, 600);
  maße(inn[1], 0, 320, 840, 580);
  maße(sp[1], 0, 320, 400, 580);
  maße(sp[2], 440, 320, 840, 580);
  maße(secs[2], 0, 700, 840, 1000);
  maße(inn[2], 0, 720, 840, 980);
  maße(sp[3], 0, 720, 270, 980);
  maße(sp[4], 285, 720, 555, 980);
  maße(sp[5], 570, 720, 840, 980);
  maße(secs[3], 0, 1100, 840, 1400);
  maße(inn[3], 0, 1120, 840, 1380);
  [0, 1, 2, 3].forEach((n) => maße(sp[6 + n], n * 210, 1120, n * 210 + 200, 1380));
  [...document.querySelectorAll('.w-baustein')].forEach((b) => {
    const r = b.parentElement!.getBoundingClientRect();
    maße(b, r.left, r.top, r.right, r.top + 40);
  });
}
const abschnitt1 = () => document.querySelectorAll('section.w-abschnitt')[1];
const innen1 = () => document.querySelectorAll<HTMLElement>('.w-abschnitt-innen')[1];
const teiler = () =>
  [...document.querySelectorAll<HTMLElement>('.b-teiler')].filter((t) => !t.hidden);
const hatKlasse = (el: Element, k: string) => el.classList.contains(k);

/** Der Zug am Spalten-Griff: greifen, bewegen, (loslassen). */
function spaltenZug(t: HTMLElement, von: number, nach: number, loslassen = true) {
  zeiger('pointerdown', t, von, 450);
  zeiger('pointermove', t, nach, 450);
  if (loslassen) zeiger('pointerup', t, nach, 450);
}

beforeEach(() => {
  window.scrollTo = vi.fn() as never;
  // jsdom hat keine Seitenbreite – ohne sie liegt jeder Wunschplatz „außerhalb“ und jedes Element ohne Pflicht wird ausgeblendet.
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  aufraeumen();
});

describe('Spaltenbreite ziehen', () => {
  it('der Griff steht nur am Abschnitt unter der Maus, mittig in der Lücke – bei zwei Spalten ist er frei', () => {
    starten(SEITE);
    messen();
    expect(teiler()).toHaveLength(0);
    hoverAuf(abschnitt1());
    const t = teiler();
    expect(t).toHaveLength(1);
    expect(hatKlasse(t[0], 'b-fest')).toBe(false);
    // Lücke 400–440, Mitte 420, der Griff ist 20 breit (Schicht liegt bei 0/0) → links 410 – im Entwurf wie hier: `left` ist mittig
    expect(t[0].style.left).toBe(`${420 - t[0].offsetWidth / 2}px`);
  });

  it('ziehen rastet auf die Aufteilung mit derselben Spaltenzahl: live Vorschau, Chip, Rastlinien – und EINE Nachricht beim Loslassen', () => {
    const senden = starten(SEITE);
    messen();
    hoverAuf(abschnitt1());
    const t = teiler()[0];
    zeiger('pointerdown', t, 420, 450);
    expect(document.body.classList.contains('b-zieht-spalten')).toBe(true);
    // Rastlinien: genau die Aufteilungen mit zwei Spalten
    const linien = [...innen1().querySelectorAll<HTMLElement>('.b-rast')];
    expect(linien.map((l) => l.dataset.name)).toEqual(['1-1', '2-1', '1-2']);
    expect(linien.map((l) => l.textContent)).toEqual(['1 : 1', '2 : 1', '1 : 2']);
    // Lage: 0..840, Lücke 40 → 800 zum Aufteilen; 1-1 → Mitte der Lücke bei 400 + 20 = 420, 2-1 → 533,3 + 20
    expect(parseFloat(linien[0].style.left)).toBeCloseTo(420);
    expect(parseFloat(linien[1].style.left)).toBeCloseTo((800 * 2) / 3 + 20);
    expect(parseFloat(linien[2].style.left)).toBeCloseTo(800 / 3 + 20);

    zeiger('pointermove', t, 700, 450);
    expect(innen1().style.gridTemplateColumns).toBe('2fr 1fr');
    expect(document.querySelector('.b-chip')!.textContent).toBe('Aufteilung 2 : 1');
    expect(linien[1].classList.contains('b-an')).toBe(true);
    expect(linien[0].classList.contains('b-an')).toBe(false);
    zeiger('pointermove', t, 100, 450);
    expect(innen1().style.gridTemplateColumns).toBe('1fr 2fr');
    expect(document.querySelector('.b-chip')!.textContent).toBe('Aufteilung 1 : 2');
    zeiger('pointermove', t, 420, 450);
    expect(innen1().style.gridTemplateColumns).toBe('1fr 1fr');
    expect(document.querySelector('.b-chip')!.textContent).toBe('Aufteilung 1 : 1 (gleich breit)');
    zeiger('pointermove', t, 700, 450);
    expect(gesendet(senden).filter((m) => m.was === 'aufteilung')).toEqual([]); // beim Ziehen noch nichts

    zeiger('pointerup', t, 700, 450);
    expect(gesendet(senden).filter((m) => m.was === 'aufteilung')).toEqual([
      M({ was: 'aufteilung', i: 1, aufteilung: '2-1' }),
    ]);
    // aufgeräumt: keine Rastlinien, kein Chip, keine Klassen
    expect(document.querySelectorAll('.b-rast, .b-chip')).toHaveLength(0);
    expect(document.body.classList.contains('b-zieht-spalten')).toBe(false);
    expect(document.body.classList.contains('b-zieht')).toBe(false);
  });

  it('Esc bricht ab: nichts wird gesendet, die Breite ist wieder wie vorher', () => {
    const senden = starten(SEITE);
    messen();
    hoverAuf(abschnitt1());
    const t = teiler()[0];
    spaltenZug(t, 420, 700, false);
    expect(innen1().style.gridTemplateColumns).toBe('2fr 1fr');
    taste('Escape');
    expect(innen1().style.gridTemplateColumns).toBe('');
    expect(document.querySelectorAll('.b-rast, .b-chip')).toHaveLength(0);
    expect(document.body.classList.contains('b-zieht')).toBe(false);
    zeiger('pointerup', t, 700, 450); // das Loslassen danach tut nichts mehr
    expect(gesendet(senden).filter((m) => m.was === 'aufteilung')).toEqual([]);
  });

  it('zurück auf die Aufteilung, die schon gilt: keine Nachricht', () => {
    const senden = starten(SEITE);
    messen();
    hoverAuf(abschnitt1());
    spaltenZug(teiler()[0], 420, 430);
    expect(gesendet(senden).filter((m) => m.was === 'aufteilung')).toEqual([]);
    expect(innen1().style.gridTemplateColumns).toBe('');
  });

  it('kommt keine neue Zeichnung (die Erweiterung hat nichts übernommen), stellt die Ebene nach 2,5 s den Stand davor her', () => {
    starten(SEITE);
    messen();
    hoverAuf(abschnitt1());
    spaltenZug(teiler()[0], 420, 700);
    expect(innen1().style.gridTemplateColumns).toBe('2fr 1fr'); // bleibt bis zur neuen Zeichnung stehen
    vi.advanceTimersByTime(2600);
    expect(innen1().style.gridTemplateColumns).toBe('');
  });

  it('drei und vier Spalten: Griff gedämpft, kein Ziehen, nur ein kurzer Hinweis – und keine Nachricht', () => {
    const senden = starten(SEITE);
    messen();
    for (const [n, name] of [
      [2, 'drei'],
      [3, 'vier'],
    ] as const) {
      hoverAuf(document.querySelectorAll('section.w-abschnitt')[n]);
      const t = teiler();
      expect(t, name).toHaveLength(n - 0 === 2 ? 2 : 3); // 3 Spalten → 2 Lücken, 4 Spalten → 3 Lücken
      for (const g of t) {
        expect(hatKlasse(g, 'b-fest'), name).toBe(true);
        expect(g.title).toContain('nur eine Aufteilung');
      }
      zeiger('pointerdown', t[0], 285, 800);
      zeiger('pointermove', t[0], 500, 800);
      zeiger('pointerup', t[0], 500, 800);
      expect(document.body.classList.contains('b-zieht'), name).toBe(false);
      expect(document.querySelector('.b-rast'), name).toBeNull();
      expect(document.querySelector('.w-abschnitt-innen[style]'), name).toBeNull();
      // der Hinweis steht kurz da und verschwindet von selbst
      expect(document.querySelector('.b-chip')!.textContent).toContain('nur eine Aufteilung');
      vi.advanceTimersByTime(3100);
      expect(document.querySelector('.b-chip')).toBeNull();
    }
    expect(gesendet(senden).filter((m) => m.was === 'aufteilung')).toEqual([]);
  });

  it('eine Spalte: kein Griff', () => {
    starten(SEITE);
    messen();
    hoverAuf(document.querySelectorAll('section.w-abschnitt')[0]);
    expect(teiler()).toHaveLength(0);
  });

  it('Pfeiltasten am Griff: die nächste Aufteilung links bzw. rechts – am Rand nichts', () => {
    const senden = starten(SEITE);
    messen();
    hoverAuf(abschnitt1());
    const t = teiler()[0];
    taste('ArrowRight', t);
    taste('ArrowLeft', t);
    expect(gesendet(senden).filter((m) => m.was === 'aufteilung')).toEqual([
      M({ was: 'aufteilung', i: 1, aufteilung: '2-1' }),
      M({ was: 'aufteilung', i: 1, aufteilung: '1-2' }),
    ]);
  });

  it('Rangordnung: liegt Text in der Lücke, weicht der Griff in der Höhe aus – er liegt nie über einem Hindernis', () => {
    // jsdom misst keine Größen: Der Griff ist 20 × 46 groß (wie in ebene.css), sonst wäre „über dem Knopf“ nicht zu prüfen.
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(20);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(46);
    starten(SEITE);
    messen();
    // Ein Knopf (zählt als Hindernis) genau in der Lücke, in der Mitte der Höhe
    const knopf = document.createElement('a');
    knopf.className = 'w-knopf';
    document.querySelector('#inhalt')!.appendChild(knopf);
    maße(knopf, 400, 430, 440, 470);
    hoverAuf(abschnitt1());
    const t = teiler()[0];
    expect(t).toBeDefined();
    const y = parseFloat(t.style.top);
    const h = t.offsetHeight;
    expect(y + h <= 430 || y >= 470, `Griff bei ${y}–${y + h} liegt über dem Knopf 430–470`).toBe(
      true,
    );
    expect(y).not.toBe(427); // ohne Hindernis stünde er mittig in der Höhe (320 + (260 − 46) / 2)
  });

  it('am Handy gibt es keine Griffe', () => {
    starten(SEITE, { modus: 'handy' });
    messen();
    hoverAuf(abschnitt1());
    expect(document.querySelectorAll('.b-teiler')).toHaveLength(0);
  });
});

describe('Abstand ziehen', () => {
  /** Das „Stylesheet“: der obere Innenabstand je Stufe, so wie `--abstand` ihn setzt (nur Probe-Abschnitte werden gefragt). */
  const PX = { kein: 0, klein: 24, normal: 56, gross: 120 } as Record<string, number>;
  beforeEach(() => {
    const orig = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, p?: string | null) => {
      if (el.tagName === 'SECTION' && (el as HTMLElement).style.visibility === 'hidden') {
        const stufe = ABSTAENDE.find((s) => el.classList.contains(`w-abschnitt--abstand-${s}`));
        return { paddingTop: `${PX[stufe ?? 'normal']}px` } as CSSStyleDeclaration;
      }
      return orig(el, p);
    });
  });
  const pille = () => document.querySelector<HTMLElement>('.b-abstand')!;
  const baender = () =>
    [...document.querySelectorAll<HTMLElement>('.b-band')].filter((b) => !b.hidden);
  const abstandsKlasse = (el: Element) =>
    [...el.classList].filter((k) => k.startsWith('w-abschnitt--abstand-'));

  it('die Pille sagt, dass es EINEN Wert für oben und unten gibt', () => {
    starten(SEITE);
    messen();
    hoverAuf(abschnitt1());
    expect(pille().hidden).toBe(false);
    expect(pille().querySelector('span')!.textContent).toBe('Abstand oben & unten: Normal');
    expect(pille().getAttribute('aria-label')).toContain('oben und unten');
  });

  it('senkrecht ziehen rastet auf die gemessenen Stufen: Klasse live, Bänder in Abstandshöhe, Chip mit Stufe, EINE Nachricht', () => {
    const senden = starten(SEITE);
    messen();
    hoverAuf(abschnitt1());
    zeiger('pointerdown', pille(), 400, 500);
    zeiger('pointermove', pille(), 400, 560); // +60 → 56 + 60 = 116 → „gross“ (120)
    expect(abstandsKlasse(abschnitt1())).toEqual(['w-abschnitt--abstand-gross']);
    expect(document.querySelector('.b-chip')!.textContent).toBe('Abstand oben und unten: Groß');
    expect(pille().querySelector('span')!.textContent).toBe('Abstand oben & unten: Groß');
    expect(document.body.classList.contains('b-zieht-hoehe')).toBe(true);
    // zwei Bänder: oben und unten, so hoch wie die gemessene Stufe (120), gestreift (Klasse) – nicht fest im Skript
    const b = baender();
    expect(b).toHaveLength(2);
    for (const band of b) expect(band.style.height).toBe('120px');
    expect(b[0].style.top).toBe('300px'); // obere Kante des Abschnitts
    expect(b[1].style.top).toBe(`${600 - 120}px`); // untere Kante minus Abstandshöhe

    zeiger('pointermove', pille(), 400, 440); // −60 → −4 → „kein“
    expect(abstandsKlasse(abschnitt1())).toEqual(['w-abschnitt--abstand-kein']);
    expect(document.querySelector('.b-chip')!.textContent).toBe('Abstand oben und unten: Kein');
    for (const band of baender()) expect(band.style.height).toBe('0px');
    zeiger('pointermove', pille(), 400, 480); // −20 → 36 → „klein“ (24 ist näher als 56)
    expect(abstandsKlasse(abschnitt1())).toEqual(['w-abschnitt--abstand-klein']);
    zeiger('pointermove', pille(), 400, 560);
    expect(gesendet(senden).filter((m) => m.was === 'abstand')).toEqual([]); // beim Ziehen noch nichts

    zeiger('pointerup', pille(), 400, 560);
    expect(gesendet(senden).filter((m) => m.was === 'abstand')).toEqual([
      M({ was: 'abstand', i: 1, abstand: 'gross' }),
    ]);
    expect(baender()).toHaveLength(0);
    expect(document.querySelector('.b-chip')).toBeNull();
    expect(document.body.classList.contains('b-zieht-hoehe')).toBe(false);
  });

  it('der Griff nimmt beim Greifen den Fokus (sonst kommt Esc im iframe nie an – im Browser so gemessen)', () => {
    starten(SEITE);
    messen();
    hoverAuf(abschnitt1());
    zeiger('pointerdown', pille(), 400, 500);
    expect(document.activeElement).toBe(pille());
    zeiger('pointerup', pille(), 400, 500);
  });

  it('die Pixelwerte kommen aus dem Stylesheet: andere Werte, andere Rastung', () => {
    const senden = starten(SEITE);
    messen();
    PX.klein = 150; // ein anderes Stylesheet
    PX.gross = 400;
    hoverAuf(abschnitt1());
    zeiger('pointerdown', pille(), 400, 500);
    zeiger('pointermove', pille(), 400, 560); // 56 + 60 = 116 → jetzt „klein“ (150), nicht „gross“
    zeiger('pointerup', pille(), 400, 560);
    expect(gesendet(senden).filter((m) => m.was === 'abstand')).toEqual([
      M({ was: 'abstand', i: 1, abstand: 'klein' }),
    ]);
    PX.klein = 24;
    PX.gross = 120;
  });

  it('Esc bricht ab: die Klasse ist wieder die alte, keine Nachricht', () => {
    const senden = starten(SEITE);
    messen();
    hoverAuf(abschnitt1());
    zeiger('pointerdown', pille(), 400, 500);
    zeiger('pointermove', pille(), 400, 570);
    expect(abstandsKlasse(abschnitt1())).toEqual(['w-abschnitt--abstand-gross']);
    taste('Escape');
    expect(abstandsKlasse(abschnitt1())).toEqual([]); // normal = keine Klasse
    expect(baender()).toHaveLength(0);
    zeiger('pointerup', pille(), 400, 570);
    expect(gesendet(senden).filter((m) => m.was === 'abstand')).toEqual([]);
  });

  it('zurück zur Stufe, die schon gilt: keine Nachricht', () => {
    const senden = starten(SEITE);
    messen();
    hoverAuf(abschnitt1());
    zeiger('pointerdown', pille(), 400, 500);
    zeiger('pointermove', pille(), 400, 570);
    zeiger('pointermove', pille(), 400, 502);
    zeiger('pointerup', pille(), 400, 502);
    expect(gesendet(senden).filter((m) => m.was === 'abstand')).toEqual([]);
    expect(abstandsKlasse(abschnitt1())).toEqual([]);
  });

  it('ein Klick ohne Ziehen öffnet das Fenster „Gestalten“ – nichts wird verändert', () => {
    const senden = starten(SEITE);
    messen();
    hoverAuf(abschnitt1());
    zeiger('pointerdown', pille(), 400, 500);
    zeiger('pointermove', pille(), 400, 503); // unter 4 px: noch ein Klick
    expect(document.body.classList.contains('b-zieht-hoehe')).toBe(false);
    zeiger('pointerup', pille(), 400, 503);
    pille().click();
    expect(gesendet(senden).filter((m) => m.was === 'gestalten')).toEqual([
      M({ was: 'gestalten', i: 1 }),
    ]);
    expect(gesendet(senden).filter((m) => m.was === 'abstand')).toEqual([]);
    expect(abstandsKlasse(abschnitt1())).toEqual([]);
  });

  it('nach einem Zug öffnet der Klick, den der Browser danach schickt, NICHT das Fenster – der nächste echte Klick schon', () => {
    const senden = starten(SEITE);
    messen();
    hoverAuf(abschnitt1());
    zeiger('pointerdown', pille(), 400, 500);
    zeiger('pointermove', pille(), 400, 570);
    zeiger('pointerup', pille(), 400, 570);
    pille().click(); // das `click` nach dem Loslassen
    expect(gesendet(senden).filter((m) => m.was === 'gestalten')).toEqual([]);
    hoverAuf(abschnitt1());
    pille().click();
    expect(gesendet(senden).filter((m) => m.was === 'gestalten')).toHaveLength(1);
  });

  it('kommt keine neue Zeichnung, stellt die Ebene nach 2,5 s die alte Stufe wieder her', () => {
    starten(SEITE);
    messen();
    hoverAuf(abschnitt1());
    zeiger('pointerdown', pille(), 400, 500);
    zeiger('pointermove', pille(), 400, 570);
    zeiger('pointerup', pille(), 400, 570);
    expect(abstandsKlasse(abschnitt1())).toEqual(['w-abschnitt--abstand-gross']);
    vi.advanceTimersByTime(2600);
    expect(abstandsKlasse(abschnitt1())).toEqual([]);
  });

  it('Pfeil runter / hoch: eine Stufe mehr bzw. weniger – am Rand nichts', () => {
    const senden = starten(SEITE);
    messen();
    hoverAuf(abschnitt1());
    taste('ArrowDown', pille());
    taste('ArrowUp', pille());
    expect(gesendet(senden).filter((m) => m.was === 'abstand')).toEqual([
      M({ was: 'abstand', i: 1, abstand: 'gross' }),
      M({ was: 'abstand', i: 1, abstand: 'klein' }),
    ]);
  });

  it('am Handy gibt es keine Pille', () => {
    starten(SEITE, { modus: 'handy' });
    messen();
    hoverAuf(abschnitt1());
    expect(document.querySelector('.b-abstand')).toBeNull();
    expect(document.querySelector('.b-band')).toBeNull();
  });
});
