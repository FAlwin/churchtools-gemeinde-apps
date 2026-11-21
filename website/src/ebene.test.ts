// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderSeite } from '@shared/website/render';
import { abschnitt, baustein, kontext, seite, spalte } from '@shared/website/website.testdaten';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Icon, type IconName } from '@ui/icons/icons';
import { ebeneHtml, ebeneSymbole, mitEbene, nonceGueltig, seitenNonce, svgZuText } from './ebene';
import kern from './ebene.kern.txt?raw';
import skript from './ebene.skript.txt?raw';
import { aufraeumen, gesendet, starten } from './ebene.testutil';
import { vorschauHtml } from './vorschauHtml';

const SEITE = seite({
  abschnitte: [
    abschnitt([baustein('ueberschrift', { id: 'u1' }), baustein('trenner', { id: 't1' })], {
      id: 'a0',
    }),
    abschnitt([], {
      id: 'a1',
      aufteilung: '1-1',
      spalten: [
        spalte([baustein('text', { id: 'c0' })], { id: 's0' }),
        spalte([baustein('trenner', { id: 'c1' }), baustein('text', { id: 'c2' })], { id: 's1' }),
      ],
    }),
  ],
});

const M = (rest: Record<string, unknown>) => ({ websiteEditor: true, ...rest });
const letzte = (spy: ReturnType<typeof starten>) => gesendet(spy).at(-1);
const hoverAuf = (el: Element) => {
  el.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 5, clientY: 5 }));
  vi.advanceTimersByTime(500); // Rahmen und Wartezeiten der Anzeige
};

beforeEach(() => {
  window.scrollTo = vi.fn() as never;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  aufraeumen();
});

describe('Bedien-Schicht im iframe (läuft hier im Dokument nach)', () => {
  it('meldet sich nach dem Start als „bereit“ (sonst weiß die Erweiterung nicht, ob ChurchTools das Skript blockiert hat)', () => {
    const senden = starten(SEITE);
    expect(gesendet(senden)).toContainEqual(M({ was: 'bereit' }));
  });

  it('es gibt EINE Abschnitt-Leiste und EINE Baustein-Leiste – sie wandern, statt an jedem Abschnitt zu hängen', () => {
    starten(SEITE);
    expect(document.querySelectorAll('.b-werk')).toHaveLength(1);
    expect(document.querySelectorAll('.b-blockleiste')).toHaveLength(1);
    expect(document.querySelectorAll('.b-ueber .b-abstand')).toHaveLength(1);
  });

  it('die Abschnitt-Leiste: Griff, Gestalten, kopieren, löschen – ohne „nach oben/unten“ (der Griff ersetzt sie)', () => {
    const senden = starten(SEITE);
    const abschnitte = [...document.querySelectorAll('section.w-abschnitt')];
    abschnitte.forEach((sec, i) => {
      hoverAuf(sec);
      expect(
        document.querySelector('.b-werk [data-w="hoch"], .b-werk [data-w="runter"]'),
      ).toBeNull();
      for (const was of ['gestalten', 'kopieren', 'loeschen']) {
        document.querySelector<HTMLButtonElement>(`.b-werk [data-w="${was}"]`)!.click();
        expect(letzte(senden), `${was} ${i}`).toEqual(M({ was, i }));
      }
    });
  });

  it('die Pfeiltasten am Griff verschieben um eine Stelle („nach“ = vor welchem Abschnitt); am Rand passiert nichts', () => {
    const senden = starten(SEITE);
    const taste = (griff: Element, key: string) =>
      griff.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    hoverAuf(document.querySelectorAll('section.w-abschnitt')[1]);
    const griff = document.querySelector('.b-werk [data-w="griff"]')!;
    taste(griff, 'ArrowUp');
    expect(letzte(senden)).toEqual(M({ was: 'verschieben', art: 'abschnitt', von: 1, nach: 0 }));
    const n = gesendet(senden).length;
    taste(griff, 'ArrowDown'); // letzter Abschnitt: nach unten gibt es nichts
    expect(gesendet(senden)).toHaveLength(n);
    hoverAuf(document.querySelectorAll('section.w-abschnitt')[0]);
    taste(document.querySelector('.b-werk [data-w="griff"]')!, 'ArrowDown');
    expect(letzte(senden)).toEqual(M({ was: 'verschieben', art: 'abschnitt', von: 0, nach: 2 }));
    taste(document.querySelector('.b-werk [data-w="griff"]')!, 'ArrowUp'); // erster: nach oben gibt es nichts
    expect(gesendet(senden)).toHaveLength(n + 1);
    // ein Klick auf den Griff tut nichts
    const m = gesendet(senden).length;
    (document.querySelector('.b-werk [data-w="griff"]') as HTMLButtonElement).click();
    expect(gesendet(senden)).toHaveLength(m);
  });

  it('die Knöpfe tragen die Symbole des gemeinsamen Satzes und einen Namen für Screenreader', () => {
    starten(SEITE);
    const knopf = document.querySelector('.b-werk [data-w="loeschen"]')!;
    expect(knopf.innerHTML).toContain('<svg>m</svg>');
    expect(knopf.getAttribute('aria-label')).toBe('Abschnitt löschen');
    expect(document.querySelector('.b-werk [data-w="gestalten"]')!.textContent).toContain(
      'Gestalten',
    );
  });

  it('„+ Abschnitt einfügen“ meldet die Grenze, an der die Maus steht', () => {
    const senden = starten(SEITE);
    hoverAuf(document.querySelectorAll('section.w-abschnitt')[0]);
    document.querySelector<HTMLButtonElement>('.b-ueber .b-einfuegen')!.click();
    expect(letzte(senden)).toMatchObject({ was: 'einfuegen' });
  });

  it('die Baustein-Leiste: der Stift öffnet das Fenster des Bausteins unter der Maus (Abschnitt, Spalte UND Baustein)', () => {
    const senden = starten(SEITE);
    const bausteine = [...document.querySelectorAll<HTMLElement>('.w-baustein')];
    expect(bausteine).toHaveLength(5);
    const erwartet = [
      [0, 0, 0],
      [0, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ];
    bausteine.forEach((b, n) => {
      hoverAuf(b);
      document.querySelector<HTMLButtonElement>('.b-blockleiste [data-w="fenster"]')!.click();
      const [i, j, k] = erwartet[n];
      expect(letzte(senden), String(n)).toEqual(M({ was: 'baustein', i, j, k }));
    });
  });

  it('ein Klick auf einen Baustein ohne Text (Trenner) öffnet das Fenster – auf einen Text-Baustein beginnt das Tippen', () => {
    const senden = starten(SEITE);
    const trenner = document.querySelectorAll<HTMLElement>('.w-b-trenner')[0];
    trenner.click();
    expect(letzte(senden)).toEqual(M({ was: 'baustein', i: 0, j: 0, k: 1 }));
    document.querySelector<HTMLElement>('.w-b-ueberschrift h2')!.click();
    expect(letzte(senden)).toMatchObject({ was: 'tippen', i: 0, j: 0, k: 0, feld: 'text' });
  });

  it('eine leere Spalte hat einen Knopf „Baustein hinzufügen“; er meldet Abschnitt und Spalte (nicht als Klick auf einen Baustein)', () => {
    const s = seite({
      abschnitte: [
        abschnitt([], {
          id: 'a0',
          aufteilung: '1-1',
          spalten: [spalte([baustein('trenner')], { id: 's0' }), spalte([], { id: 's1' })],
        }),
      ],
    });
    const senden = starten(s);
    const knoepfe = [...document.querySelectorAll<HTMLButtonElement>('.b-leerspalte')];
    expect(knoepfe).toHaveLength(1);
    knoepfe[0].click();
    expect(letzte(senden)).toEqual(M({ was: 'baustein-neu', i: 0, j: 1 }));
    expect(gesendet(senden).filter((m) => m.was === 'baustein')).toHaveLength(0);
  });

  it('das „+“ in einer Lücke öffnet das Hinzufügen an dieser Spalte', () => {
    const s = seite({
      abschnitte: [abschnitt([baustein('trenner', { id: 'x' }), baustein('trenner', { id: 'y' })])],
    });
    const senden = starten(s);
    const plus = document.querySelector<HTMLButtonElement>('.b-ueber .b-plus')!;
    expect(plus.getAttribute('aria-label')).toBe('Baustein hier hinzufügen');
    // ohne gemessene Lücke (hier hat das Testdokument keine Maße) wird es nicht angezeigt – es meldet nichts
    plus.click();
    expect(gesendet(senden).filter((m) => m.was === 'baustein-neu')).toHaveLength(0);
  });

  it('eine leere Seite: ein sichtbarer Knopf „Abschnitt einfügen“ an Stelle 0', () => {
    const senden = starten(seite());
    const leer = document.querySelector<HTMLElement>('.b-leer')!;
    expect(leer.textContent).toContain('Diese Seite ist noch leer');
    leer.querySelector('button')!.click();
    expect(letzte(senden)).toEqual(M({ was: 'einfuegen', i: 0 }));
  });

  it('Links tun nichts, Formulare werden nicht abgeschickt', () => {
    starten(SEITE);
    const a = document.createElement('a');
    a.href = 'https://beispiel.de/';
    document.body.append(a);
    const klick = new MouseEvent('click', { bubbles: true, cancelable: true });
    a.dispatchEvent(klick);
    expect(klick.defaultPrevented).toBe(true);
    const form = document.createElement('form');
    document.body.append(form);
    const abschicken = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(abschicken);
    expect(abschicken.defaultPrevented).toBe(true);
  });

  it('die Scrollposition: wird gemeldet und – beim Neuzeichnen – wieder eingestellt', () => {
    const senden = starten(SEITE, { scroll: 340 });
    expect(window.scrollTo).toHaveBeenCalledWith(0, 340);
    window.dispatchEvent(new Event('scroll'));
    expect(letzte(senden)).toMatchObject({ was: 'scroll' });
  });

  it('keine Scrollposition: es wird nicht gescrollt', () => {
    starten(SEITE, { scroll: 0 });
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});

describe('Handy: alles wie bisher – Fenster statt Tippen', () => {
  it('keine Baustein-Leiste, keine Abstand-Pille, kein „+“ in Lücken', () => {
    starten(SEITE, { modus: 'handy' });
    expect(document.querySelector('.b-blockleiste')).toBeNull();
    expect(document.querySelector('.b-abstand')).toBeNull();
    expect(document.querySelector('.b-ueber .b-plus')).not.toBeNull(); // da, aber …
    hoverAuf(document.querySelectorAll('section.w-abschnitt')[1]);
    expect((document.querySelector('.b-ueber .b-plus') as HTMLElement).hidden).toBe(true);
  });

  it('Tippen auf einen Baustein – auch auf Text – öffnet das Fenster; es beginnt kein Tippen', () => {
    const senden = starten(SEITE, { modus: 'handy' });
    document.querySelector<HTMLElement>('.w-b-ueberschrift h2')!.click();
    expect(letzte(senden)).toEqual(M({ was: 'baustein', i: 0, j: 0, k: 0 }));
    expect(gesendet(senden).filter((m) => m.was === 'tippen')).toHaveLength(0);
    expect(document.querySelector('[contenteditable]')).toBeNull();
  });

  it('die Abschnitt-Leiste bleibt – am Handy mit „nach oben/unten“ (kein Ziehen), das jetzt „verschieben“ meldet', () => {
    const senden = starten(SEITE, { modus: 'handy' });
    document
      .querySelectorAll('section.w-abschnitt')[0]
      .dispatchEvent(new Event('pointerdown', { bubbles: true }));
    vi.advanceTimersByTime(100);
    document.querySelector<HTMLButtonElement>('.b-werk [data-w="runter"]')!.click();
    expect(letzte(senden)).toEqual(M({ was: 'verschieben', art: 'abschnitt', von: 0, nach: 2 }));
    expect(document.querySelector('.b-griff-baustein')).toBeNull(); // am Handy keine Baustein-Leiste mit Griff
  });
});

describe('Rollen: „Eigenes HTML“ ist nie tippbar', () => {
  const MIT_HTML = seite({
    abschnitte: [abschnitt([baustein('html', { id: 'h' }), baustein('text', { id: 't' })])],
  });

  it('auch mit dem Recht beginnt dort kein Tippen – ein Klick öffnet das Fenster', () => {
    const senden = starten(MIT_HTML, { darfHtml: true });
    document.querySelector<HTMLElement>('.w-b-html .beispiel')!.click();
    expect(gesendet(senden).filter((m) => m.was === 'tippen')).toHaveLength(0);
    expect(letzte(senden)).toEqual(M({ was: 'baustein', i: 0, j: 0, k: 0 }));
    expect(document.querySelector('.w-b-html [contenteditable]')).toBeNull();
  });

  it('ohne das Recht gibt es dafür weder Fenster noch Baustein-Leiste', () => {
    const senden = starten(MIT_HTML, { darfHtml: false });
    const html = document.querySelector<HTMLElement>('.w-b-html')!;
    html.querySelector<HTMLElement>('.beispiel')!.click();
    expect(gesendet(senden).filter((m) => m.was === 'baustein' || m.was === 'tippen')).toHaveLength(
      0,
    );
    hoverAuf(html);
    expect((document.querySelector('.b-blockleiste') as HTMLElement).hidden).toBe(true);
    // Ein Text-Baustein derselben Seite bleibt bedienbar
    hoverAuf(document.querySelector('.w-b-text')!);
    expect((document.querySelector('.b-blockleiste') as HTMLElement).hidden).toBe(false);
  });
});

describe('Symbole als Text, ohne react-dom/server', () => {
  it('ergibt dasselbe wie der Server-Renderer von React – für jedes Symbol des gemeinsamen Satzes, nicht nur für die sechs', () => {
    const namen: IconName[] = [
      'plus',
      'pencil',
      'chev-up',
      'chev-down',
      'kopieren',
      'trash',
      'home',
      'calendar',
      'cog',
      'lock',
      'refresh',
      'x',
    ];
    for (const name of namen)
      expect(svgZuText(Icon({ name, size: 15 })), name).toBe(
        renderToStaticMarkup(createElement(Icon, { name, size: 15 })),
      );
  });

  it('kennt nur einfache Elemente und maskiert Text und Werte', () => {
    expect(
      svgZuText(createElement('text', { x: 1, className: 'weg', style: { color: 'red' } }, 'a<b')),
    ).toBe('<text x="1">a&lt;b</text>');
    expect(() => svgZuText(createElement(Icon, { name: 'plus' }))).toThrow();
    expect(svgZuText(null)).toBe('');
  });
});

describe('Nonce (ChurchTools erlaubt Skripte nur mit ihr)', () => {
  const NONCE = 'abcDEF0123456789+/=_-xyz';

  it('eine gültige Nonce steht auf Skript UND Stil der Ebene', () => {
    const html = ebeneHtml(0, NONCE);
    expect(html).toContain(`<style nonce="${NONCE}">`);
    expect(html).toContain(`<script nonce="${NONCE}">`);
    expect(mitEbene('<body></body>', 0, NONCE)).toContain(`<script nonce="${NONCE}">`);
    expect(
      vorschauHtml(SEITE, { seiten: [], menue: null, einstellungen: null }, 'E', 'UTC', {
        scroll: 0,
        nonce: NONCE,
      }),
    ).toContain(`<script nonce="${NONCE}">`);
  });

  it('ohne Nonce (Demo, Entwicklung) bleiben Skript und Stil ohne Attribut', () => {
    for (const n of [undefined, null, '']) {
      const html = ebeneHtml(0, n);
      expect(html).toContain('<script>');
      expect(html).toContain('<style>');
      expect(html).not.toContain('nonce');
    }
  });

  it('eine ungültige Nonce wird nicht übernommen – nichts kann aus dem Attribut ausbrechen', () => {
    for (const boese of [
      'x" onload="alert(1)',
      'kurz',
      'a'.repeat(201),
      '<b>aaaaaaaa',
      'abcdefgh\n',
    ]) {
      expect(nonceGueltig(boese), boese).toBeNull();
      const html = ebeneHtml(0, boese);
      expect(html).not.toContain('nonce');
      expect(html).not.toContain('onload');
    }
    expect(nonceGueltig(42)).toBeNull();
    expect(nonceGueltig(NONCE)).toBe(NONCE);
  });

  it('seitenNonce liest die Eigenschaft `.nonce` (das Attribut ist im DOM leer) und prüft sie', () => {
    document.head.innerHTML = '';
    expect(seitenNonce()).toBeNull();
    const s = document.createElement('script');
    s.nonce = NONCE;
    document.head.append(s);
    // jsdom spiegelt `nonce` ins Attribut; hier zählt nur, dass die Eigenschaft gelesen wird.
    expect(seitenNonce()).toBe(NONCE);
    s.nonce = 'x" y';
    expect(seitenNonce()).toBeNull();
    document.head.innerHTML = '';
  });
});

describe('Die Ebene gehört NUR in die Vorschau', () => {
  it('der Bau (renderSeite) kennt weder Ebene noch Stile noch Kennungen für den Editor', () => {
    const html = renderSeite(SEITE, kontext({ seiten: [SEITE] }));
    expect(html).not.toMatch(
      /b-werk|b-einfuegen|b-blockleiste|b-leerspalte|websiteEditor|postMessage|data-w-id|b-leer/,
    );
  });

  it('vorschauHtml ohne `bearbeiten` ist der reine Bau – mit `bearbeiten` kommt die Ebene hinzu', () => {
    const stand = { seiten: [SEITE], menue: null, einstellungen: null };
    const pur = vorschauHtml(SEITE, stand, 'ECG', 'Europe/Berlin');
    expect(pur).not.toMatch(/b-werk|websiteEditor/);
    const mit = vorschauHtml(SEITE, stand, 'ECG', 'Europe/Berlin', { scroll: 12 });
    expect(mit).toMatch(/b-werk/);
    expect(mit).toMatch(/websiteEditor/);
    expect(mit.startsWith(pur.slice(0, pur.lastIndexOf('</body>')))).toBe(true);
  });

  it('Skript und Stil stehen genau einmal, vor dem letzten `</body>`; ohne `</body>` bleibt die Seite unberührt', () => {
    const html = mitEbene('<html><body><p>x</p></body></html>', 0);
    expect(html.match(/<script>/g)).toHaveLength(1);
    expect(html.indexOf('<script>')).toBeLessThan(html.lastIndexOf('</body>'));
    expect(mitEbene('<p>kein Körper</p>', 0)).toBe('<p>kein Körper</p>');
  });

  it('Skript und Kern können ihren Block nicht beenden: kein `</script` im Text, `<` in den Einstellungen ist entschärft', () => {
    for (const text of [skript, kern]) {
      expect(text).not.toMatch(/<\/script/i);
      expect(text).not.toMatch(/<!--/);
    }
    const html = ebeneHtml(5);
    const innen = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
    const mitWeiter = ebeneHtml(5, null, { weiter: { i: 0, j: 0, k: 0, feld: 'text', n: 0 } });
    expect(
      mitWeiter.slice(mitWeiter.indexOf('<script>') + 8, mitWeiter.lastIndexOf('</script>')),
    ).not.toMatch(/<\/script/i);
    expect(innen).not.toMatch(/<\/script/i);
    expect(innen).not.toMatch(/<!--/);
  });

  it('die Symbole kommen aus dem gemeinsamen Satz (SVG, 15 px) – alle, keine Behelfszeichen', () => {
    const s = ebeneSymbole();
    expect(Object.keys(s).sort()).toEqual([
      'griff',
      'hoch',
      'kopie',
      'link',
      'liste',
      'muell',
      'plus',
      'regler',
      'runter',
      'stift',
    ]);
    for (const svg of Object.values(s)) expect(svg).toMatch(/^<svg[^>]*width="15"/);
  });
});
