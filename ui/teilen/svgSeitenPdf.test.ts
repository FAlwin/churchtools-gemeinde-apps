// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { svg2pdf } from 'svg2pdf.js';
import { grundlinienFestlegen, stileEinbetten, svgSeitenPdf } from './svgSeitenPdf';

// svg2pdf zeichnet im Browser – hier zählt, WAS es bekommt und in welche Seite.
vi.mock('svg2pdf.js', () => ({ svg2pdf: vi.fn(() => Promise.resolve()) }));
const zeichnen = vi.mocked(svg2pdf);

const NS = 'http://www.w3.org/2000/svg';
function seite(inhalt: string, stil = ''): SVGSVGElement {
  document.head.innerHTML = `<style>${stil}</style>`;
  const huelle = document.createElement('div');
  huelle.innerHTML = `<svg xmlns="${NS}" viewBox="0 0 297 210">${inhalt}</svg>`;
  document.body.appendChild(huelle);
  return huelle.querySelector('svg')!;
}

// jsdom kennt keine Schriften im Dokument – hier wird nur mitgeschrieben, was angemeldet wird.
const angemeldet: string[] = [];
class SchriftAttrappe {
  constructor(
    readonly family: string,
    _daten: ArrayBuffer,
    readonly art: { weight: string },
  ) {}
  load() {
    return Promise.resolve(this);
  }
}
vi.stubGlobal('FontFace', SchriftAttrappe);
Object.defineProperty(document, 'fonts', {
  value: { add: (f: SchriftAttrappe) => angemeldet.push(`${f.family} ${f.art.weight}`) },
});

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  zeichnen.mockClear();
});

describe('stileEinbetten', () => {
  it('die ausgerechneten Stile werden Attribute – Längen ohne px, Stärke normal/fett, immer die PDF-Schrift', () => {
    const svg = seite(
      '<g class="knoten"><title>Hinweis</title><rect class="kasten" width="10" height="5"/><text class="name" dominant-baseline="central">Café</text></g>',
      '.kasten { fill: #dbeafe; stroke: #155dfc; stroke-width: 1.25px; } .name { fill: #162456; font-size: 3.5px; font-weight: 700; text-anchor: end; }',
    );
    const kopie = stileEinbetten(svg, 'LatoPdf');
    const rect = kopie.querySelector('rect')!;
    expect(rect.getAttribute('fill')).toMatch(/#dbeafe|rgb\(219, 234, 254\)/);
    expect(rect.getAttribute('stroke-width')).toBe('1.25');
    expect(rect.hasAttribute('class')).toBe(false);
    const text = kopie.querySelector('text')!;
    expect(text.getAttribute('font-size')).toBe('3.5');
    expect(text.getAttribute('font-weight')).toBe('bold');
    expect(text.getAttribute('text-anchor')).toBe('end');
    expect(text.getAttribute('font-family')).toBe('LatoPdf');
    // `<title>` ist der Hinweis beim Darüberfahren – nicht fürs Papier.
    expect(kopie.querySelector('title')).toBeNull();
    // Das Original am Bildschirm bleibt, wie es ist.
    expect(svg.querySelector('title')).not.toBeNull();
    expect(svg.querySelector('rect')!.getAttribute('class')).toBe('kasten');
  });
});

describe('stileEinbetten – Rundungen aus dem Stil (O7b-8)', () => {
  it('eine Rundung per Stil (`rx: var(--r-tile)`) wird Attribut; „auto“ (keine Angabe) nicht – damit käme svg2pdf nicht zurecht', () => {
    const svg = seite(
      '<rect class="kachel" width="18" height="18"/><rect class="kasten" width="10" height="5"/>',
    );
    // jsdom rechnet `rx` nicht aus – so liefert es der Browser.
    const echt = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
      const stil = echt(el);
      const rund = el.getAttribute('class') === 'kachel' ? '6px' : 'auto';
      return new Proxy(stil, {
        get: (z, k) =>
          k === 'getPropertyValue'
            ? (n: string) => (n === 'rx' || n === 'ry' ? rund : z.getPropertyValue(n))
            : (Reflect.get(z, k) as unknown),
      });
    });
    const [kachel, kasten] = stileEinbetten(svg, 'LatoPdf').querySelectorAll('rect');
    expect([kachel.getAttribute('rx'), kachel.getAttribute('ry')]).toEqual(['6', '6']);
    expect(kasten.hasAttribute('rx')).toBe(false);
    vi.restoreAllMocks();
  });
});

describe('grundlinienFestlegen', () => {
  it('mittig gesetzte Namen bekommen die Grundlinie, die der Browser misst (Rahmen mit und ohne Angabe)', () => {
    const svg = seite('<text x="5" y="50" dominant-baseline="central">Gottesdienst</text>');
    const t = svg.querySelector('text')!;
    // Chromium, 14er-Schrift (28.10.2026): mit `central` 41,5, ohne 36.
    const rahmen = vi.fn(() => ({
      x: 5,
      y: t.hasAttribute('dominant-baseline') ? 41.5 : 36,
      width: 80,
      height: 17,
    }));
    Object.assign(t, { getBBox: rahmen });
    grundlinienFestlegen(svg);
    expect(t.getAttribute('y')).toBe('55.5');
    expect(t.hasAttribute('dominant-baseline')).toBe(false);
    expect(t.hasAttribute('alignment-baseline')).toBe(false);
  });

  it('gemessen wird am groß gezeichneten Blatt – klein gerundet der Browser den Versatz auf 0 (O7b-8, 29.10.2026)', () => {
    const svg = seite('<text x="5" y="50" dominant-baseline="central">Gottesdienst</text>');
    const t = svg.querySelector('text')!;
    const breiten: string[] = [];
    Object.assign(t, {
      getBBox: () => {
        breiten.push(svg.style.width);
        return { x: 5, y: t.hasAttribute('dominant-baseline') ? 41.5 : 36, width: 80, height: 17 };
      },
    });
    svg.style.width = '12px';
    grundlinienFestlegen(svg);
    expect(breiten).toEqual(['8000px', '8000px']);
    // Danach wie vorher – die Lage in der PDF hängt an der viewBox.
    expect(svg.style.width).toBe('12px');
  });

  it('ohne Messung (hier: keine Zeichenfläche) bleibt es bei `alignment-baseline`', () => {
    const svg = seite(
      '<text x="5" y="50" dominant-baseline="central">Gottesdienst</text><text y="9">Kopf</text>',
    );
    grundlinienFestlegen(svg);
    const [name, kopf] = Array.from(svg.querySelectorAll('text'));
    expect(name.getAttribute('y')).toBe('50');
    expect(name.getAttribute('alignment-baseline')).toBe('central');
    // Ein Text mit gewöhnlicher Grundlinie bleibt unberührt.
    expect(kopf.getAttribute('y')).toBe('9');
    expect(kopf.hasAttribute('alignment-baseline')).toBe(false);
  });
});

describe('svgSeitenPdf', () => {
  it('jede Seite in ihrem Format (quer bleibt quer), mit Titel; die Kopien sind beim Zeichnen eingehängt', async () => {
    const quer = seite('<text dominant-baseline="central">Diagramm</text>');
    const hoch = seite('<text>Liste</text>');
    const eingehaengt: boolean[] = [];
    zeichnen.mockImplementation((el) => {
      eingehaengt.push(document.body.contains(el));
      return Promise.resolve() as never;
    });
    const doc = await svgSeitenPdf(
      [
        { svg: quer, breite: 297, hoehe: 210 },
        { svg: hoch, breite: 210, hoehe: 297 },
      ],
      { titel: 'Organigramm – Gottesdienst', thema: 'Stand 28.10.2026' },
    );
    expect(doc.getNumberOfPages()).toBe(2);
    doc.setPage(1);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(297, 0);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(210, 0);
    doc.setPage(2);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(210, 0);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(297, 0);
    expect(zeichnen).toHaveBeenCalledTimes(2);
    expect(zeichnen.mock.calls[0][2]).toEqual({ x: 0, y: 0, width: 297, height: 210 });
    expect(zeichnen.mock.calls[1][2]).toEqual({ x: 0, y: 0, width: 210, height: 297 });
    expect(eingehaengt).toEqual([true, true]);
    // Die Grundlinie ist beim Zeichnen schon festgelegt (hier ohne Messung: `alignment-baseline`, das svg2pdf kennt).
    const gezeichnet = zeichnen.mock.calls[0][0].querySelector('text')!;
    expect(gezeichnet.hasAttribute('dominant-baseline')).toBe(false);
    expect(gezeichnet.getAttribute('alignment-baseline')).toBe('central');
    // Lato unter eigenem Namen auch im Dokument – damit misst svg2pdf rechtsbündige Texte.
    expect(angemeldet).toEqual(['LatoPdf 400', 'LatoPdf 700']);
    // Gezeichnet werden Kopien – die Vorschau bleibt am Platz, die Ablage ist danach wieder weg.
    expect(zeichnen.mock.calls[0][0]).not.toBe(quer);
    expect(document.body.contains(quer)).toBe(true);
    expect(document.querySelectorAll('[aria-hidden="true"]').length).toBe(0);
    // Der Titel steht in UTF-16 in der Datei (ein Nullbyte vor jedem Zeichen).
    expect(doc.output()).toContain([...'Organigramm'].map((z) => '\u0000' + z).join(''));
    expect(doc.getFontList().LatoPdf).toEqual(['normal', 'bold']);
  });

  it('scheitert das Zeichnen, wirft es – und räumt trotzdem auf', async () => {
    zeichnen.mockRejectedValueOnce(new Error('kaputt'));
    await expect(
      svgSeitenPdf([{ svg: seite('<text>x</text>'), breite: 297, hoehe: 210 }], { titel: 'x' }),
    ).rejects.toThrow('kaputt');
    expect(document.querySelectorAll('[aria-hidden="true"]').length).toBe(0);
  });

  it('ohne Seite keine PDF', async () => {
    await expect(svgSeitenPdf([], { titel: 'x' })).rejects.toThrow('Keine Seite');
  });
});
