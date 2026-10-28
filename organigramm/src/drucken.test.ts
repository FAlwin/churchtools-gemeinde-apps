// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drucken, druckHtml, eigeneStile, PAPIERE, schriftRegeln, type Blatt } from './drucken';

const SEITE = 'https://test.church.tools/ccm/organigramm/';

/** So liegen die Regeln bei ChurchTools (gemessen 28.10.2026): `base-….css`, unter `@layer` und `@media screen`. */
const CT: Blatt = {
  href: 'https://test.church.tools/system/dist/assets/base-CI4Ymyvy.css',
  cssRules: [
    { cssText: 'body { margin: 0; }' },
    {
      cssText: '@layer base { … }',
      cssRules: [
        {
          cssText: '@media screen { … }',
          cssRules: [
            {
              cssText:
                '@font-face { font-family: Lato; font-weight: 700; src: local("Lato Bold"), url("./lato-700-B7ACiDZI.woff2") format("woff2"); }',
            },
            {
              cssText:
                '@font-face { font-family: "Font Awesome Pro"; src: url("./fa-solid-900.woff2"); }',
            },
          ],
        },
      ],
    },
  ],
};

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('schriftRegeln', () => {
  it('holt Lato aus @layer/@media heraus, Pfade absolut neben der Stilvorlage – andere Schriften nicht', () => {
    const r = schriftRegeln([CT], SEITE);
    expect(r).toHaveLength(1);
    expect(r[0]).toContain(
      'url("https://test.church.tools/system/dist/assets/lato-700-B7ACiDZI.woff2")',
    );
    expect(r[0]).toContain('local("Lato Bold")');
    expect(r[0]).not.toContain('@media');
  });

  it('eine Stilvorlage ohne Adresse (im Dokument) bezieht Pfade auf die Seite; data:- und volle Adressen bleiben', () => {
    const r = schriftRegeln(
      [
        {
          href: null,
          cssRules: [
            {
              cssText:
                "@font-face { font-family: 'Lato'; src: url(lato.woff2), url(data:font/woff2;base64,AAA); }",
            },
            {
              cssText: '@font-face { font-family: Lato; src: url("https://cdn.example/x.woff2"); }',
            },
          ],
        },
      ],
      SEITE,
    );
    expect(r[0]).toContain('url("https://test.church.tools/ccm/organigramm/lato.woff2")');
    expect(r[0]).toContain('url(data:font/woff2;base64,AAA)');
    expect(r[1]).toContain('url("https://cdn.example/x.woff2")');
  });

  it('eine fremde Stilvorlage, die man nicht lesen darf, wird übersprungen', () => {
    const fremd = {
      href: 'https://fremd.example/a.css',
      get cssRules(): never {
        throw new DOMException('verboten', 'SecurityError');
      },
    };
    expect(schriftRegeln([fremd, CT], SEITE)).toHaveLength(1);
  });
});

describe('eigeneStile', () => {
  it('nur die eigenen: <link> unter dem eigenen Pfad und die <style> von Vite – nicht die von ChurchTools', () => {
    document.head.innerHTML = `
      <link rel="stylesheet" href="https://test.church.tools/system/dist/assets/base.css">
      <link rel="stylesheet" href="https://test.church.tools/ccm/organigramm/assets/index-abc.css">
      <style data-vite-dev-id="/x.scss">.knoten{}</style>
      <style>.ct{}</style>`;
    const s = eigeneStile(document, 'https://test.church.tools/ccm/organigramm/');
    expect(s).toContain('href="https://test.church.tools/ccm/organigramm/assets/index-abc.css"');
    expect(s).toContain('<style>.knoten{}</style>');
    expect(s).not.toContain('base.css');
    expect(s).not.toContain('.ct{}');
  });
});

describe('druckHtml', () => {
  it('Seite, Rand, Schrift, Stile, Inhalt – das Diagramm füllt die Seite unter der Kopfzeile', () => {
    const html = druckHtml({
      titel: 'Organigramm <Test>',
      inhalt: '<svg></svg>',
      papier: PAPIERE[0],
      schrift: ['@font-face { font-family: Lato; }'],
      stile: '<link rel="stylesheet" href="x.css">',
    });
    expect(html).toContain('<title>Organigramm &lt;Test&gt;</title>');
    expect(html).toContain('@page { size: A4 landscape; margin: 12mm; }');
    // A4 quer: 210 mm hoch − 2 × 12 mm Rand − 14 mm Kopf
    expect(html).toContain('height: 172mm');
    expect(html).toContain('@font-face { font-family: Lato; }');
    expect(html).toContain('<link rel="stylesheet" href="x.css">');
    // Nur im Bereich der Erweiterung gelten ihre Farben – sonst sind die Kästchen schwarz (Demo 28.10.2026).
    expect(html).toContain('<body><div data-gemeinde-app=""><svg></svg></div></body>');
  });

  it('A3 quer und A4 hoch haben ihre eigene Größe', () => {
    const a3 = druckHtml({ titel: '', inhalt: '', papier: PAPIERE[2], schrift: [], stile: '' });
    expect(a3).toContain('size: A3 landscape');
    expect(a3).toContain('height: 259mm');
    const hoch = druckHtml({ titel: '', inhalt: '', papier: PAPIERE[1], schrift: [], stile: '' });
    expect(hoch).toContain('size: A4 portrait');
    expect(hoch).toContain('height: 259mm');
  });
});

describe('drucken', () => {
  it('schreibt das Dokument in einen unsichtbaren Rahmen, druckt dort – nicht die Seite – und räumt danach auf', async () => {
    vi.useFakeTimers();
    const seitenDruck = vi.spyOn(window, 'print').mockImplementation(() => {});
    let gedruckt: Window | null = null;
    let inhalt = '';
    const fertig = drucken(
      '<!doctype html><html><body><p>Inhalt</p></body></html>',
      document,
      (w) => {
        gedruckt = w;
        inhalt = w.document.body.innerHTML;
      },
    );
    await vi.advanceTimersByTimeAsync(3000);
    await fertig;
    const rahmen = document.querySelector('iframe')!;
    expect(rahmen.style.visibility).toBe('hidden');
    expect(rahmen.getAttribute('aria-hidden')).toBe('true');
    expect(gedruckt).toBe(rahmen.contentWindow);
    expect(inhalt).toBe('<p>Inhalt</p>');
    expect(seitenDruck).not.toHaveBeenCalled();
    rahmen.contentWindow!.dispatchEvent(new Event('afterprint'));
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('meldet der Browser das Ende nicht (Safari), ist der Rahmen nach einer Minute trotzdem weg', async () => {
    vi.useFakeTimers();
    const fertig = drucken('<p>x</p>', document, () => {});
    await vi.advanceTimersByTimeAsync(3000);
    await fertig;
    expect(document.querySelector('iframe')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(document.querySelector('iframe')).toBeNull();
  });
});
