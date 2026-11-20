// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderSeite } from '@shared/website/render';
import { abschnitt, baustein, kontext, seite, spalte } from '@shared/website/website.testdaten';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Icon, type IconName } from '@ui/icons/icons';
import { ebeneHtml, ebeneSymbole, mitEbene, svgZuText } from './ebene';
import skript from './ebene.skript.txt?raw';
import { vorschauHtml } from './vorschauHtml';

const SEITE = seite({
  abschnitte: [
    abschnitt([baustein('ueberschrift', { id: 'u1' }), baustein('text', { id: 't1' })], {
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

const SYMBOLE = {
  plus: '<svg>+</svg>',
  stift: '<svg>s</svg>',
  hoch: '<svg>^</svg>',
  runter: '<svg>v</svg>',
  kopie: '<svg>k</svg>',
  muell: '<svg>m</svg>',
};

/** Die Seite in das Dokument legen (nur den Körper – Skripte in `innerHTML` laufen nicht) und die Ebene darüber starten. */
function starten(s = SEITE, scroll = 0) {
  const html = renderSeite(s, kontext({ seiten: [s] }));
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/
    .exec(html)![1]
    .replace(/<script[^>]*><\/script>/g, '');
  const senden = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- das Skript, das im iframe läuft, wird hier im Dokument nachgespielt
  (new Function(`return (${skript}\n)`)() as (c: unknown) => void)({ scroll, symbole: SYMBOLE });
  return senden;
}

const letzte = (spy: ReturnType<typeof starten>) => spy.mock.calls.at(-1)?.[0];

beforeEach(() => {
  window.scrollTo = vi.fn() as never;
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('Bearbeiten-Ebene im iframe (läuft hier im Dokument nach)', () => {
  it('„Abschnitt einfügen“ steht vor, zwischen und nach den Abschnitten – und meldet die Stelle', () => {
    const senden = starten();
    const knoepfe = [...document.querySelectorAll<HTMLButtonElement>('.b-einfuegen button')];
    expect(knoepfe).toHaveLength(3);
    knoepfe.forEach((k, i) => {
      k.click();
      expect(letzte(senden)).toEqual({ websiteEditor: true, was: 'einfuegen', i });
    });
  });

  it('jeder Abschnitt hat eine Leiste: Gestalten, nach oben, nach unten, kopieren, löschen – mit dem richtigen Abschnitt', () => {
    const senden = starten();
    const leisten = [...document.querySelectorAll('.b-werk')];
    expect(leisten).toHaveLength(2);
    leisten.forEach((leiste, i) => {
      for (const was of ['gestalten', 'hoch', 'runter', 'kopieren', 'loeschen']) {
        leiste.querySelector<HTMLButtonElement>(`[data-w="${was}"]`)!.click();
        expect(letzte(senden), `${was} ${i}`).toEqual({ websiteEditor: true, was, i });
      }
    });
  });

  it('die Knöpfe tragen die Symbole des gemeinsamen Satzes und einen Namen für Screenreader', () => {
    starten();
    const knopf = document.querySelector('.b-werk [data-w="loeschen"]')!;
    expect(knopf.innerHTML).toContain(SYMBOLE.muell);
    expect(knopf.getAttribute('aria-label')).toBe('Abschnitt löschen');
    expect(document.querySelector('.b-werk [data-w="gestalten"]')!.textContent).toContain(
      'Gestalten',
    );
  });

  it('ein Klick auf einen Baustein meldet Abschnitt, Spalte UND Baustein – auch in der zweiten Spalte', () => {
    const senden = starten();
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
      b.click();
      const [i, j, k] = erwartet[n];
      expect(letzte(senden), String(n)).toEqual({ websiteEditor: true, was: 'baustein', i, j, k });
    });
  });

  it('„+ Baustein“ steht in jeder Spalte und meldet Abschnitt und Spalte', () => {
    const senden = starten();
    const neue = [...document.querySelectorAll<HTMLButtonElement>('.b-neu-baustein')];
    expect(neue).toHaveLength(3);
    neue[2].click();
    expect(letzte(senden)).toEqual({ websiteEditor: true, was: 'baustein-neu', i: 1, j: 1 });
    // und der Klick auf den Knopf zählt nicht als Klick auf einen Baustein
    expect(
      senden.mock.calls.filter(([m]) => (m as { was: string }).was === 'baustein'),
    ).toHaveLength(0);
  });

  it('eine leere Seite: ein sichtbarer Knopf „Abschnitt einfügen“ an Stelle 0', () => {
    const senden = starten(seite());
    const leer = document.querySelector<HTMLElement>('.b-leer')!;
    expect(leer.textContent).toContain('Diese Seite ist noch leer');
    leer.querySelector('button')!.click();
    expect(letzte(senden)).toEqual({ websiteEditor: true, was: 'einfuegen', i: 0 });
    expect(document.querySelectorAll('.b-werk')).toHaveLength(0);
  });

  it('Links tun nichts, Formulare werden nicht abgeschickt', () => {
    starten();
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
    const senden = starten(SEITE, 340);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 340);
    window.dispatchEvent(new Event('scroll'));
    expect(letzte(senden)).toMatchObject({ was: 'scroll' });
    window.scrollTo = vi.fn() as never;
    starten(SEITE, 0);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('am Handy zeigt der zuletzt angetippte Abschnitt seine Leiste (`b-aktiv`), immer nur einer', () => {
    starten();
    const [a0, a1] = [...document.querySelectorAll('section.w-abschnitt')];
    a0.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(a0.classList.contains('b-aktiv')).toBe(true);
    a1.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(a0.classList.contains('b-aktiv')).toBe(false);
    expect(a1.classList.contains('b-aktiv')).toBe(true);
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

describe('Die Ebene gehört NUR in die Vorschau', () => {
  it('der Bau (renderSeite) kennt weder Ebene noch Stile noch Kennungen für den Editor', () => {
    const html = renderSeite(SEITE, kontext({ seiten: [SEITE] }));
    expect(html).not.toMatch(
      /b-werk|b-einfuegen|b-neu-baustein|websiteEditor|postMessage|data-w-id|b-leer/,
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

  it('das Skript kann seinen Block nicht beenden: kein `</script` im Text, `<` in den Einstellungen ist entschärft', () => {
    expect(skript).not.toMatch(/<\/script/i);
    expect(skript).not.toMatch(/<!--/);
    const html = ebeneHtml(5);
    const innen = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
    expect(innen).not.toMatch(/<\/script/i);
    expect(innen).not.toMatch(/<!--/);
  });

  it('die Symbole kommen aus dem gemeinsamen Satz (SVG, 15 px) – alle sechs, keine Behelfszeichen', () => {
    const s = ebeneSymbole();
    expect(Object.keys(s).sort()).toEqual(['hoch', 'kopie', 'muell', 'plus', 'runter', 'stift']);
    for (const svg of Object.values(s)) expect(svg).toMatch(/^<svg[^>]*width="15"/);
  });
});
