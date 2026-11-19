// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { describe, expect, it } from 'vitest';
import { renderSeite } from './render';
import { SCHRIFTEN, findeSchrift, istSichererSchriftname } from './schriften';
import {
  NEUTRALE_FARBEN,
  SYSTEM_SCHRIFT,
  brauchtHellenText,
  cssAdresse,
  cssFuerStyleTag,
  luminanz,
  themeCss,
  wirksameFarben,
} from './theme';
import {
  baustein,
  ECG_FARBEN,
  ECG_SCHRIFTEN,
  einstellungen,
  kontext,
  seite,
  seiteMit,
} from './website.testdaten';
import type { Einstellungen } from './modell';

const adresse = { schriftAdresse: (d: string) => `/schriften/${d}` };
const doc = (e: Partial<Einstellungen>, k = {}) =>
  new DOMParser().parseFromString(
    renderSeite(seite(), kontext({ einstellungen: einstellungen(e), ...k })),
    'text/html',
  );

describe('Theme im Kopf der Seite', () => {
  it('ein <style> NACH dem Stylesheet mit den Variablen in :root', () => {
    const html = renderSeite(
      seite(),
      kontext({ einstellungen: einstellungen({ farben: ECG_FARBEN, schriften: ECG_SCHRIFTEN }) }),
    );
    const kopf = html.slice(0, html.indexOf('</head>'));
    expect(kopf.indexOf('<link rel="stylesheet"')).toBeGreaterThan(-1);
    expect(kopf.indexOf('<style>')).toBeGreaterThan(kopf.indexOf('<link rel="stylesheet"'));
    const css =
      doc({ farben: ECG_FARBEN, schriften: ECG_SCHRIFTEN }).querySelector('head style')
        ?.textContent ?? '';
    for (const [name, wert] of [
      ['--farbe-haupt', '#00616e'],
      ['--farbe-haupt-tief', '#00434c'],
      ['--farbe-akzent', '#eb5e28'],
      ['--farbe-grund', '#fffcf2'],
      ['--farbe-sanft', '#ccd7c5'],
      ['--farbe-text', '#14110f'],
    ])
      expect(css, name).toContain(`${name}:${wert}`);
    expect(css).toMatch(/:root\{[^}]*--schrift-text:'Quicksand', system-ui/);
    expect(css).toMatch(/--schrift-ueberschrift:'Quicksand'/);
    expect(css).toMatch(/--schrift-akzent:'Caveat Brush'/);
  });

  it('ohne Angaben: neutrale Farben (nicht die der ECG), Systemschrift, keine @font-face', () => {
    const css = doc({}).querySelector('head style')?.textContent ?? '';
    for (const [k, v] of Object.entries(NEUTRALE_FARBEN))
      expect(css).toContain(`--farbe-${k}:${v}`);
    expect(css).not.toContain('@font-face');
    expect(css).toContain(`--schrift-text:${SYSTEM_SCHRIFT}`);
    for (const ecg of Object.values(ECG_FARBEN)) expect(css).not.toContain(ecg);
    // Die ECG-Farben stehen nirgends im Code der Website, nur in den Testdaten
    expect(Object.values(NEUTRALE_FARBEN)).not.toEqual(
      expect.arrayContaining(Object.values(ECG_FARBEN)),
    );
  });

  it('fehlt hauptTief, wird es per color-mix aus der Hauptfarbe abgeleitet', () => {
    const { hauptTief: _w, ...ohne } = ECG_FARBEN;
    void _w;
    const css = themeCss(einstellungen({ farben: ohne }), adresse);
    expect(css).toContain('--farbe-haupt-tief:color-mix(in srgb, var(--farbe-haupt) 70%, #000)');
    expect(themeCss(einstellungen({ farben: ECG_FARBEN }), adresse)).not.toContain('color-mix');
  });

  it('@font-face je gewählter Schrift, Adresse nur über schriftAdresse, jede Schrift nur einmal', () => {
    const css = themeCss(einstellungen({ schriften: ECG_SCHRIFTEN }), adresse);
    expect(css.match(/@font-face/g)).toHaveLength(2); // Quicksand (2x gewählt) + Caveat Brush
    expect(css).toContain(
      "@font-face{font-family:'Quicksand';src:url(\"/schriften/quicksand-var.woff2\") format('woff2');font-weight:300 700;font-display:swap}",
    );
    expect(css).toContain('url("/schriften/caveat-brush.woff2")');
    const andere = themeCss(einstellungen({ schriften: ECG_SCHRIFTEN }), {
      schriftAdresse: (d) => `https://cdn.beispiel.de/${d}`,
    });
    expect(andere).toContain('url("https://cdn.beispiel.de/quicksand-var.woff2")');
  });

  it('eigene Schrift: Name, Datei über den Kontext, Gewichte', () => {
    const e = einstellungen({
      schriften: {
        text: { art: 'eigene', name: 'Meine Schrift-2', datei: 'asset-9', gewichte: '300 700' },
        ueberschrift: {
          art: 'eigene',
          name: 'Meine Schrift-2',
          datei: 'asset-9',
          gewichte: '300 700',
        },
      },
    });
    const css = themeCss(e, adresse);
    expect(css).toContain(
      '@font-face{font-family:\'Meine Schrift-2\';src:url("/schriften/asset-9");font-weight:300 700;font-display:swap}',
    );
    expect(css).toContain("--schrift-text:'Meine Schrift-2', system-ui, sans-serif");
    expect(css.match(/@font-face/g)).toHaveLength(1);
  });

  it('Reihenfolge: @font-face, :root, dann das eigene CSS', () => {
    const css = themeCss(
      einstellungen({ schriften: ECG_SCHRIFTEN, eigenesCss: '.w-knopf{color:red}' }),
      adresse,
    );
    expect(css.indexOf('@font-face')).toBeLessThan(css.indexOf(':root{'));
    expect(css.indexOf(':root{')).toBeLessThan(css.indexOf('.w-knopf{color:red}'));
    expect(css.endsWith('.w-knopf{color:red}')).toBe(true);
  });

  it('leeres eigenes CSS: nichts angehängt', () => {
    const ohne = themeCss(einstellungen({}), adresse);
    expect(themeCss(einstellungen({ eigenesCss: '  \n ' }), adresse)).toBe(ohne);
  });
});

describe('Schutz: eigenes CSS bricht nicht aus dem <style> aus', () => {
  const ausbrueche = [
    '</style><script>alert(1)</script>',
    '</STYLE><script>alert(1)</script>',
    '</StYlE><script>alert(1)</script>',
    '</style ><script>alert(1)</script>',
    '</style\t><script>alert(1)</script>',
    '</style\n><script>alert(1)</script>',
    '</style/><script>alert(1)</script>',
    '</ style><script>alert(1)</script>',
    'a{}</style><img src=x onerror=alert(1)>',
    '</style></style></style><script>x</script>',
    '<</style>/style><script>x</script>',
    '/* </style> */ <script>x</script>',
    'a{content:"</style><script>x</script>"}',
  ];

  it('nach dem Einbau gibt es genau ein <style> im Kopf und kein Skript aus dem CSS', () => {
    for (const css of ausbrueche) {
      const d = doc({ eigenesCss: css });
      expect(d.querySelectorAll('style'), css).toHaveLength(1);
      expect(d.querySelectorAll('script[src]'), css).toHaveLength(1); // nur der Verweis des Kontexts
      expect(d.querySelectorAll('script:not([src])'), css).toHaveLength(0);
      expect(d.querySelectorAll('[onerror]'), css).toHaveLength(0);
      expect(d.body.querySelectorAll('img'), css).toHaveLength(0);
      expect(d.head.querySelectorAll('script:not([src])'), css).toHaveLength(0);
    }
  });

  it('das <style> enthält den ganzen Text noch (nur die Schrägstriche sind maskiert)', () => {
    const d = doc({ eigenesCss: '.a{color:red}</style><script>x</script>.b{color:blue}' });
    const inhalt = d.querySelector('style')?.textContent ?? '';
    expect(inhalt).toContain('.a{color:red}<\\/style><script>x<\\/script>.b{color:blue}');
  });

  it('cssFuerStyleTag: nach der Entschärfung bleibt kein „</“ übrig', () => {
    for (const css of ausbrueche) expect(cssFuerStyleTag(css), css).not.toContain('</');
    expect(cssFuerStyleTag('a{color:red}')).toBe('a{color:red}');
  });

  it('auch das Ganze (@font-face, :root, eigenes CSS) enthält kein „</“', () => {
    for (const css of ausbrueche) {
      const gesamt = themeCss(
        einstellungen({ schriften: ECG_SCHRIFTEN, eigenesCss: css }),
        adresse,
      );
      expect(gesamt.includes('</'), css).toBe(false);
    }
  });
});

describe('Schutz: Schriftnamen, Gewichte, Adressen, Farben', () => {
  const eigene = (name: string, extra: object = {}) =>
    einstellungen({
      schriften: {
        text: { art: 'eigene', name, datei: 'asset-1', ...extra },
        ueberschrift: { art: 'auswahl', name: 'Quicksand' },
      },
    } as never);

  it('Namen mit CSS-Zeichen werden abgewiesen – die Schrift fällt auf die Systemschrift zurück', () => {
    for (const boese of [
      'x;}body{background:red',
      "a'b",
      'a\\b',
      'a</style>',
      'a"b',
      'a{b',
      'a;b',
      '',
      ' x',
      '-x',
      'a\nb',
      'a:b',
      'a(b)',
    ]) {
      expect(istSichererSchriftname(boese), JSON.stringify(boese)).toBe(false);
      const css = themeCss(eigene(boese), adresse);
      expect(css, JSON.stringify(boese)).not.toContain(boese === '' ? '\u0000' : boese);
      expect(css.match(/@font-face/g), JSON.stringify(boese)).toHaveLength(1); // nur die gültige Überschrift-Schrift
      expect(css).toContain(`--schrift-text:${SYSTEM_SCHRIFT}`);
    }
  });

  it('gültige Namen kommen durch: Buchstaben, Ziffern, Leerzeichen, Bindestrich (auch Umlaute)', () => {
    for (const ok of ['Meine Schrift', 'Schrift-2', 'Größe 12', 'A', 'Ünder-Sans 3'])
      expect(istSichererSchriftname(ok), ok).toBe(true);
  });

  it('ungültige Gewichte werden weggelassen, nicht ausgegeben', () => {
    for (const g of ['bold', '400;}', '1000', '300-700', 'x']) {
      const css = themeCss(eigene('Ok', { gewichte: g }), adresse);
      const eigeneRegel = css.split('\n').find((z) => z.includes("font-family:'Ok'")) ?? '';
      expect(eigeneRegel, g).not.toContain('font-weight');
      expect(css, g).not.toContain(`${g};`);
    }
    expect(themeCss(eigene('Ok', { gewichte: '400' }), adresse)).toContain('font-weight:400;');
  });

  it('Schriftadressen bleiben in der CSS-Zeichenkette (Anführungszeichen, Klammern, Backslash …)', () => {
    const boese = '/s/x");}body{background:url(//evil)}\\';
    expect(cssAdresse(boese)).not.toMatch(/["'\\(){};<>\s]/);
    const css = themeCss(einstellungen({ schriften: ECG_SCHRIFTEN }), {
      schriftAdresse: () => boese,
    });
    // genau zwei @font-face, jede mit genau einem url("…")
    expect(css.match(/url\(/g)).toHaveLength(2);
    expect(css).not.toContain('evil)}');
    expect(css).not.toContain('");}');
    expect(cssAdresse('/schriften/a-b_c.woff2?v=1#x')).toBe('/schriften/a-b_c.woff2?v=1#x');
    expect(cssAdresse('/a b')).toBe('/a%20b');
  });

  it('eine unbekannte Schrift aus der „Auswahl“ (am Schema vorbei) wird ignoriert', () => {
    const css = themeCss(
      einstellungen({
        schriften: {
          text: { art: 'auswahl', name: "x'}body{" },
          ueberschrift: { art: 'auswahl', name: 'Quicksand' },
        },
      }),
      adresse,
    );
    expect(css).not.toContain('body{');
    expect(css).toContain(`--schrift-text:${SYSTEM_SCHRIFT}`);
  });

  it('Farben am Schema vorbei: ungültige fallen auf die neutrale Vorgabe zurück', () => {
    const f = wirksameFarben(
      einstellungen({
        farben: { ...ECG_FARBEN, haupt: 'red;}body{', hauptTief: 'url(x)', akzent: '#12345g' },
      }),
    );
    expect(f.haupt).toBe(NEUTRALE_FARBEN.haupt);
    expect(f.akzent).toBe(NEUTRALE_FARBEN.akzent);
    expect(f.hauptTief).toBeUndefined();
    expect(f.grund).toBe(ECG_FARBEN.grund);
    const css = themeCss(
      einstellungen({ farben: { ...ECG_FARBEN, haupt: 'red;}body{' } }),
      adresse,
    );
    expect(css).not.toContain('body{');
  });
});

describe('Helligkeit', () => {
  it('Luminanz: schwarz 0, weiß 1, ungültig null', () => {
    expect(luminanz('#000')).toBe(0);
    expect(luminanz('#ffffff')).toBeCloseTo(1, 5);
    expect(luminanz('red')).toBeNull();
    expect(luminanz('#fff;')).toBeNull();
  });
  it('brauchtHellenText: dunkle Farben ja, helle nein, ungültig nein', () => {
    expect(brauchtHellenText('#000')).toBe(true);
    expect(brauchtHellenText('#00616e')).toBe(true);
    expect(brauchtHellenText('#fff')).toBe(false);
    expect(brauchtHellenText('#ccd7c5')).toBe(false);
    expect(brauchtHellenText('nix')).toBe(false);
  });
});

describe('Schriftliste (E-W14)', () => {
  it('12 bis 15 Schriften, Namen und Dateien eindeutig', () => {
    expect(SCHRIFTEN.length).toBeGreaterThanOrEqual(12);
    expect(SCHRIFTEN.length).toBeLessThanOrEqual(15);
    expect(new Set(SCHRIFTEN.map((s) => s.name)).size).toBe(SCHRIFTEN.length);
    expect(new Set(SCHRIFTEN.map((s) => s.datei)).size).toBe(SCHRIFTEN.length);
  });
  it('jeder Eintrag ist vollständig und CSS-sicher', () => {
    for (const s of SCHRIFTEN) {
      expect(istSichererSchriftname(s.name), s.name).toBe(true);
      expect(istSichererSchriftname(s.familie), s.familie).toBe(true);
      expect(s.datei, s.name).toMatch(/^[a-z0-9-]+\.woff2$/);
      expect(s.gewichte, s.name).toMatch(/^[1-9]00(?: [1-9]00)?$/);
      expect(s.ersatz, s.name).toMatch(/(?:sans-serif|serif|cursive)$/);
      expect(s.ersatz, s.name).not.toMatch(/[;{}<>"\\]/);
      expect(['serifenlos', 'serif', 'hand', 'display']).toContain(s.kategorie);
      expect(findeSchrift(s.name)).toBe(s);
    }
  });
  it('die Vorschlagsliste ist da (Quicksand und Caveat Brush als Startwerte)', () => {
    for (const n of [
      'Quicksand',
      'Caveat Brush',
      'Caveat',
      'Noto Sans',
      'Roboto Slab',
      'Montserrat',
      'Open Sans',
      'Source Sans 3',
      'Nunito',
      'Inter',
      'Merriweather',
      'Lora',
      'Playfair Display',
    ])
      expect(findeSchrift(n), n).toBeDefined();
    expect(findeSchrift('Comic Sans')).toBeUndefined();
  });
  it('jede Schrift der Liste lässt sich im Renderer einbinden', () => {
    for (const s of SCHRIFTEN) {
      const css = themeCss(
        einstellungen({
          schriften: {
            text: { art: 'auswahl', name: s.name },
            ueberschrift: { art: 'auswahl', name: s.name },
          },
        }),
        adresse,
      );
      expect(css, s.name).toContain(`font-family:'${s.familie}'`);
      expect(css, s.name).toContain(`/schriften/${s.datei}`);
    }
  });
});

describe('Theme auf allen Seiten, nicht nur der ersten', () => {
  it('jede Seite trägt dasselbe <style>', () => {
    const k = kontext({
      einstellungen: einstellungen({ farben: ECG_FARBEN, eigenesCss: '.x{color:red}' }),
    });
    const stil = (html: string) => /<style>([\s\S]*?)<\/style>/.exec(html)?.[1];
    expect(stil(renderSeite(seite(), k))).toBe(
      stil(renderSeite(seiteMit([baustein('text')], { id: 'z', pfad: 'z', startseite: false }), k)),
    );
  });
});
