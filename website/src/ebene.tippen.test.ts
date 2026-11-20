// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { abschnitt, baustein, seite, spalte } from '@shared/website/website.testdaten';
import { aufraeumen, gesendet, starten } from './ebene.testutil';

const SEITE = seite({
  abschnitte: [
    abschnitt(
      [
        baustein('ueberschrift', { id: 'u', text: 'Willkommen', punkt: true }),
        baustein('akzentzeile', { id: 'a', text: 'Herzlich' }),
        baustein('text', { id: 't', markdown: 'Ein **fetter** Text\n\n- eins\n- zwei' }),
        baustein('knoepfe', { id: 'k' }),
        baustein('html', { id: 'h' }),
      ],
      { id: 'a0' },
    ),
    abschnitt([baustein('bildText', { id: 'bt', markdown: 'Neben dem Bild' })], {
      id: 'a1',
      spalten: [spalte([baustein('bildText', { id: 'bt', markdown: 'Neben dem Bild' })])],
    }),
  ],
});

const M = (rest: Record<string, unknown>) => ({ websiteEditor: true, ...rest });
const finde = <T extends Element = HTMLElement>(wahl: string): T =>
  document.querySelector<T>(wahl)!;
const arten = (spy: ReturnType<typeof starten>) => gesendet(spy).map((m) => m.was);
const nur = (spy: ReturnType<typeof starten>, was: string) =>
  gesendet(spy).filter((m) => m.was === was);

/** Ein Klick auf ein Feld (Aufnahmephase – wie im Browser, wo der Druck vorher kommt). */
const klick = (el: Element) => {
  el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
};
/** „Tippen“: den Inhalt ersetzen und dem Feld sagen, dass es sich geändert hat. */
const tippe = (el: Element, html: string) => {
  el.innerHTML = html;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
/** Klick daneben: das Feld verliert den Fokus, ein Zeitgeber später entscheidet die Schicht. */
const verlassen = (el: Element) => {
  el.dispatchEvent(new Event('focusout', { bubbles: true }));
  vi.advanceTimersByTime(5);
};
const taste = (key: string, ziel: Element = document.body) =>
  ziel.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const markiere = (von: Node, o1: number, bis: Node, o2: number) => {
  const r = document.createRange();
  r.setStart(von, o1);
  r.setEnd(bis, o2);
  getSelection()!.removeAllRanges();
  getSelection()!.addRange(r);
  document.dispatchEvent(new Event('selectionchange'));
};
const davor = (el: Element, inputType: string) => {
  const e = new InputEvent('beforeinput', { inputType, bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e;
};

beforeEach(() => {
  window.scrollTo = vi.fn() as never;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  aufraeumen();
});

describe('Text direkt tippen: Überschrift, Akzentzeile, Knopf (reiner Text)', () => {
  it('Klick → es wird getippt: Stelle gemeldet, Feld bearbeitbar, der Punkt gehört nicht zum Text', () => {
    const senden = starten(SEITE);
    const h = finde('.w-b-ueberschrift h2');
    klick(h);
    expect(nur(senden, 'tippen')).toEqual([
      M({ was: 'tippen', i: 0, j: 0, k: 0, feld: 'text', n: 0 }),
    ]);
    expect(h.contentEditable).toBe('plaintext-only');
    expect(h.classList.contains('b-edit')).toBe(true);
    expect(h.querySelector('.w-punkt')).toBeNull();
    expect(document.body.classList.contains('b-tippt')).toBe(true);
  });

  it('Eingabetaste übernimmt: der Text kommt als reiner Text, danach „fertig“', () => {
    const senden = starten(SEITE);
    const h = finde('.w-b-ueberschrift h2');
    klick(h);
    h.textContent = '  Neue   <b>Überschrift</b>  ';
    taste('Enter', h);
    expect(arten(senden).slice(-3)).toEqual(['tippen', 'text', 'tippen-ende']);
    expect(nur(senden, 'text')[0]).toEqual(
      M({ was: 'text', i: 0, j: 0, k: 0, feld: 'text', n: 0, wert: 'Neue <b>Überschrift</b>' }),
    );
    expect(h.hasAttribute('contenteditable')).toBe(false);
    expect(document.body.classList.contains('b-tippt')).toBe(false);
  });

  it('unverändert: nichts wird gesendet außer „fertig“, die Seite bleibt, wie sie war (auch der Punkt)', () => {
    const senden = starten(SEITE);
    const h = finde('.w-b-ueberschrift h2');
    const vorher = h.innerHTML;
    klick(h);
    taste('Enter', h);
    expect(nur(senden, 'text')).toHaveLength(0);
    expect(arten(senden)).toContain('tippen-ende');
    expect(h.innerHTML).toBe(vorher);
  });

  it('Esc bricht ab: nichts wird gesendet, der alte Text steht wieder da', () => {
    const senden = starten(SEITE);
    const h = finde('.w-b-ueberschrift h2');
    const vorher = h.innerHTML;
    klick(h);
    h.textContent = 'Etwas ganz anderes';
    taste('Escape', h);
    expect(nur(senden, 'text')).toHaveLength(0);
    expect(h.innerHTML).toBe(vorher);
    expect(arten(senden).at(-1)).toBe('tippen-ende');
  });

  it('Klick daneben übernimmt', () => {
    const senden = starten(SEITE);
    const h = finde('.w-b-ueberschrift h2');
    klick(h);
    h.textContent = 'Neu';
    verlassen(h);
    expect(nur(senden, 'text')).toHaveLength(1);
    expect(nur(senden, 'text')[0]).toMatchObject({ wert: 'Neu' });
  });

  it('Akzentzeile und die Beschriftung eines Knopfes (welcher: `n`)', () => {
    const senden = starten(SEITE);
    klick(finde('.w-akzent'));
    expect(nur(senden, 'tippen').at(-1)).toMatchObject({ k: 1, feld: 'text', n: 0 });
    taste('Escape');
    klick(document.querySelectorAll<HTMLElement>('.w-knopf')[1]);
    expect(nur(senden, 'tippen').at(-1)).toMatchObject({ k: 3, feld: 'knopf', n: 1 });
    document.querySelectorAll('.w-knopf')[1].textContent = 'Dritter Weg';
    taste('Enter');
    expect(nur(senden, 'text').at(-1)).toMatchObject({
      k: 3,
      feld: 'knopf',
      n: 1,
      wert: 'Dritter Weg',
    });
  });

  it('Klick in ein anderes Textfeld: Text übernehmen UND dort gleich weitertippen (`weiter`)', () => {
    const senden = starten(SEITE);
    const h = finde('.w-b-ueberschrift h2');
    klick(h);
    h.textContent = 'Anders';
    const akzent = finde('.w-akzent');
    akzent.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    verlassen(h);
    expect(nur(senden, 'text')[0]).toMatchObject({
      wert: 'Anders',
      weiter: { i: 0, j: 0, k: 1, feld: 'text', n: 0 },
    });
  });

  it('Klick in ein anderes Feld ohne Änderung: gleich dort weiter, ohne Nachricht für das alte', () => {
    const senden = starten(SEITE);
    const h = finde('.w-b-ueberschrift h2');
    klick(h);
    const akzent = finde('.w-akzent');
    akzent.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    verlassen(h);
    expect(nur(senden, 'text')).toHaveLength(0);
    expect(nur(senden, 'tippen').at(-1)).toMatchObject({ k: 1 });
    expect(akzent.classList.contains('b-edit')).toBe(true);
  });

  it('nach einem Neuzeichnen (`weiter` in den Einstellungen) geht es im nächsten Feld weiter', () => {
    const senden = starten(SEITE, { weiter: { i: 0, j: 0, k: 1, feld: 'text', n: 0 } });
    expect(nur(senden, 'tippen')).toEqual([
      M({ was: 'tippen', i: 0, j: 0, k: 1, feld: 'text', n: 0 }),
    ]);
    expect(finde('.w-akzent').classList.contains('b-edit')).toBe(true);
  });

  it('Eingefügtes ist reiner Text in EINER Zeile – kein Markup, keine Umbrüche', () => {
    const senden = starten(SEITE);
    const h = finde('.w-b-ueberschrift h2');
    klick(h);
    markiere(h.firstChild!, 0, h.firstChild!, h.firstChild!.textContent!.length);
    const e = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'clipboardData', {
      value: { getData: () => 'Aus\nder <b>Ablage</b>' },
    });
    h.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(h.querySelector('b')).toBeNull();
    expect(h.textContent).toBe('Aus der <b>Ablage</b>');
    taste('Enter', h);
    expect(nur(senden, 'text')[0]).toMatchObject({ wert: 'Aus der <b>Ablage</b>' });
  });
});

describe('Text direkt tippen: Text mit Auszeichnung', () => {
  const text = () => finde('.w-b-text .w-text');

  it('Klick beginnt das Tippen; der Text bekommt die Gestalt p/ul, Esc stellt das Original wieder her', () => {
    const senden = starten(SEITE);
    const vorher = text().innerHTML;
    klick(text().querySelector('strong')!);
    expect(nur(senden, 'tippen')[0]).toMatchObject({ k: 2, feld: 'markdown', n: 0 });
    expect(text().isContentEditable || text().contentEditable === 'true').toBe(true);
    tippe(text(), '<p>kaputt</p>');
    taste('Escape', text());
    expect(text().innerHTML).toBe(vorher);
    expect(nur(senden, 'text')).toHaveLength(0);
  });

  it('Übernehmen: Blöcke mit Fett, Absatz und Listenpunkten – nicht das HTML', () => {
    const senden = starten(SEITE);
    klick(text());
    tippe(text(), '<p>Neu <strong>fett</strong> &lt;b&gt;</p><ul><li>a</li></ul>');
    verlassen(text());
    expect(nur(senden, 'text')[0]).toEqual(
      M({
        was: 'text',
        i: 0,
        j: 0,
        k: 2,
        feld: 'markdown',
        n: 0,
        bloecke: [
          { art: 'p', laeufe: [{ t: 'Neu ' }, { t: 'fett', fett: true }, { t: ' <b>' }] },
          { art: 'ul', laeufe: [{ t: 'a' }] },
        ],
      }),
    );
  });

  it('Text in Bild+Text lässt sich genauso tippen', () => {
    const senden = starten(SEITE);
    klick(finde('.w-b-bildText .w-text'));
    expect(nur(senden, 'tippen')[0]).toMatchObject({ i: 1, j: 0, k: 0, feld: 'markdown' });
  });

  it('Eingabetaste teilt den Absatz selbst (ohne den Browser): zwei Absätze, der Cursor im zweiten', () => {
    starten(SEITE);
    klick(text());
    tippe(text(), '<p>HalloWelt</p>');
    const p = text().querySelector('p')!;
    markiere(p.firstChild!, 5, p.firstChild!, 5);
    const e = davor(text(), 'insertParagraph');
    expect(e.defaultPrevented).toBe(true);
    expect([...text().querySelectorAll('p')].map((x) => x.textContent)).toEqual(['Hallo', 'Welt']);
    expect(getSelection()!.anchorNode).toBe(text().querySelectorAll('p')[1].firstChild);
  });

  it('Umschalt+Eingabe: ein Umbruch im Absatz', () => {
    starten(SEITE);
    klick(text());
    tippe(text(), '<p>ab</p>');
    const p = text().querySelector('p')!;
    markiere(p.firstChild!, 1, p.firstChild!, 1);
    davor(text(), 'insertLineBreak');
    expect(text().querySelector('p')!.innerHTML).toBe('a<br>b');
  });

  it('Eingefügtes ist reiner Text: kein Markup, Leerzeile = neuer Absatz', () => {
    const senden = starten(SEITE);
    klick(text());
    tippe(text(), '<p></p>');
    markiere(text().querySelector('p')!, 0, text().querySelector('p')!, 0);
    const e = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'clipboardData', {
      value: { getData: () => '<img src=x onerror=alert(1)> **nicht fett**\n\nZweiter' },
    });
    text().dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(text().querySelector('img')).toBeNull();
    expect([...text().querySelectorAll('p')].map((x) => x.textContent)).toEqual([
      '<img src=x onerror=alert(1)> **nicht fett**',
      'Zweiter',
    ]);
    verlassen(text());
    expect(nur(senden, 'text')[0].bloecke).toEqual([
      { art: 'p', laeufe: [{ t: '<img src=x onerror=alert(1)> **nicht fett**' }] },
      { art: 'p', laeufe: [{ t: 'Zweiter' }] },
    ]);
  });

  it('die Leiste: Fett, Kursiv, Liste, Zwischenüberschrift – am Markierten, ohne den Browser-Befehl', () => {
    const senden = starten(SEITE);
    klick(text());
    tippe(text(), '<p>Hallo Welt</p>');
    const p = text().querySelector('p')!;
    markiere(p.firstChild!, 6, p.firstChild!, 10);
    finde('.b-format [data-f="fett"]').click();
    expect(text().querySelector('p')!.innerHTML).toBe('Hallo <strong>Welt</strong>');
    expect(getSelection()!.toString()).toBe('Welt'); // die Markierung bleibt
    finde('.b-format [data-f="kursiv"]').click();
    expect(text().querySelector('p')!.innerHTML).toBe('Hallo <strong><em>Welt</em></strong>');
    finde('.b-format [data-f="fett"]').click(); // nochmal: wieder weg
    expect(text().querySelector('p')!.innerHTML).toBe('Hallo <em>Welt</em>');
    finde('.b-format [data-f="liste"]').click();
    expect(text().innerHTML).toBe('<ul><li>Hallo <em>Welt</em></li></ul>');
    finde('.b-format [data-f="zwischen"]').click();
    expect(text().innerHTML).toBe('<h3>Hallo <em>Welt</em></h3>');
    verlassen(text());
    expect(nur(senden, 'text')[0].bloecke).toEqual([
      { art: 'h', laeufe: [{ t: 'Hallo ' }, { t: 'Welt', kursiv: true }] },
    ]);
  });

  it('Tastenkürzel Fett/Kursiv laufen über denselben Weg (kein `<b>` vom Browser)', () => {
    starten(SEITE);
    klick(text());
    tippe(text(), '<p>Hallo</p>');
    const p = text().querySelector('p')!;
    markiere(p.firstChild!, 0, p.firstChild!, 5);
    expect(davor(text(), 'formatBold').defaultPrevented).toBe(true);
    expect(text().querySelector('p')!.innerHTML).toBe('<strong>Hallo</strong>');
    davor(text(), 'formatItalic');
    expect(text().querySelector('b, i')).toBeNull();
  });

  it('Link: die Adresse prüft die ERWEITERUNG – erlaubt → Link, nicht erlaubt → ruhiger Hinweis, kein Link', () => {
    const senden = starten(SEITE);
    klick(text());
    tippe(text(), '<p>Mehr hier lesen</p>');
    const p = text().querySelector('p')!;
    markiere(p.firstChild!, 5, p.firstChild!, 9);
    finde('.b-format [data-f="link"]').click();
    const feld = finde<HTMLInputElement>('.b-lf input');
    expect(finde('.b-lf').hidden).toBe(false);
    expect(feld.value).toBe('https://');
    feld.value = 'javascript:alert(1)';
    finde('.b-lf [data-f="ok"]').click(); // (kein <form>: im iframe ohne `allow-forms` käme kein „submit“)
    const frage = nur(senden, 'link-pruefen').at(-1) as { id: number; url: string };
    expect(frage.url).toBe('javascript:alert(1)'); // die Ebene entscheidet nicht selbst
    const antwort = (id: number, ok: boolean, source: unknown = window) =>
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { websiteParent: true, was: 'link-ergebnis', id, ok },
          source: source as Window,
        }),
      );
    antwort(frage.id, false);
    expect(finde('.b-lf-fehler').hidden).toBe(false);
    expect(text().querySelector('a')).toBeNull();
    // eine Antwort von woanders zählt nicht
    feld.value = 'https://a.de';
    feld.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    ); // Eingabetaste geht auch
    const frage2 = nur(senden, 'link-pruefen').at(-1) as { id: number };
    antwort(frage2.id, true, null);
    expect(text().querySelector('a')).toBeNull();
    // eine Antwort mit falscher Nummer auch nicht
    antwort(frage2.id + 99, true);
    expect(text().querySelector('a')).toBeNull();
    antwort(frage2.id, true);
    expect(text().querySelector('p')!.innerHTML).toBe('Mehr <a href="https://a.de">hier</a> lesen');
    (document.activeElement as HTMLElement | null)?.blur(); // (jsdom kann ein `contenteditable` nicht fokussieren)
    verlassen(text());
    expect(nur(senden, 'text')[0].bloecke).toEqual([
      { art: 'p', laeufe: [{ t: 'Mehr ' }, { t: 'hier', link: 'https://a.de' }, { t: ' lesen' }] },
    ]);
  });

  it('das Link-Feld ist KEIN Formular: im abgeschotteten iframe (ohne allow-forms) käme sonst nie ein „submit“', () => {
    starten(SEITE);
    expect(finde('.b-format').querySelector('form')).toBeNull();
  });

  it('Link entfernen: der Knopf wirkt am Link als Ganzes', () => {
    starten(SEITE);
    klick(text());
    tippe(text(), '<p>Mehr <a href="https://a.de">hier</a> lesen</p>');
    const a = text().querySelector('a')!;
    markiere(a.firstChild!, 1, a.firstChild!, 2);
    finde('.b-format [data-f="link"]').click();
    expect(text().querySelector('a')).toBeNull();
    expect(text().querySelector('p')!.textContent).toBe('Mehr hier lesen');
  });

  it('eigenes Rückgängig/Wiederholen (Strg+Z geht über den Verlauf der Schicht, nicht den des Browsers)', () => {
    starten(SEITE);
    klick(text());
    tippe(text(), '<p>Eins</p>');
    vi.advanceTimersByTime(1000);
    tippe(text(), '<p>Eins zwei</p>');
    expect(davor(text(), 'historyUndo').defaultPrevented).toBe(true);
    expect(text().textContent).toBe('Eins');
    davor(text(), 'historyUndo');
    expect(text().textContent).toBe(
      'Ein **fetter** Text'.replace('**', '').replace('**', '') + 'eins' + 'zwei',
    );
    davor(text(), 'historyRedo');
    expect(text().textContent).toBe('Eins');
  });

  it('Strg/Cmd+Z, Umschalt+Strg/Cmd+Z und Strg+Y gehen über den eigenen Verlauf – der Browser meldet „Wiederholen“ sonst nie', () => {
    starten(SEITE);
    klick(text());
    tippe(text(), '<p>Eins</p>');
    vi.advanceTimersByTime(1000);
    tippe(text(), '<p>Eins zwei</p>');
    const t = (key: string, opt: KeyboardEventInit) => {
      const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opt });
      text().dispatchEvent(e);
      return e;
    };
    expect(t('z', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(text().textContent).toBe('Eins');
    expect(t('Z', { ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(true);
    expect(text().textContent).toBe('Eins zwei');
    t('z', { metaKey: true });
    expect(text().textContent).toBe('Eins');
    t('y', { ctrlKey: true });
    expect(text().textContent).toBe('Eins zwei');
    // mit Alt oder ohne Strg bleibt die Taste beim Browser
    expect(t('z', { altKey: true, ctrlKey: true }).defaultPrevented).toBe(false);
    expect(t('z', {}).defaultPrevented).toBe(false);
  });

  it('Wiederholen führt zurück – auch wenn die Markierung inzwischen woanders steht (das zerstörte den Weg schon einmal)', () => {
    starten(SEITE);
    klick(text());
    tippe(text(), '<p>Eins</p>');
    vi.advanceTimersByTime(1000);
    tippe(text(), '<p>Eins zwei</p>');
    const p = () => text().querySelector('p')!;
    markiere(p().firstChild!, 4, p().firstChild!, 4);
    davor(text(), 'historyUndo');
    expect(text().textContent).toBe('Eins');
    markiere(p().firstChild!, 0, p().firstChild!, 0); // die Auswahl wandert
    davor(text(), 'historyRedo');
    expect(text().textContent).toBe('Eins zwei');
    davor(text(), 'historyUndo');
    davor(text(), 'historyUndo');
    expect(text().textContent).not.toBe('Eins zwei');
    davor(text(), 'historyRedo');
    davor(text(), 'historyRedo');
    expect(text().textContent).toBe('Eins zwei');
  });

  it('Rückgängig nach der Leiste: auch Fett lässt sich zurücknehmen', () => {
    starten(SEITE);
    klick(text());
    tippe(text(), '<p>Hallo</p>');
    const p = text().querySelector('p')!;
    markiere(p.firstChild!, 0, p.firstChild!, 5);
    finde('.b-format [data-f="fett"]').click();
    expect(text().querySelector('strong')).not.toBeNull();
    davor(text(), 'historyUndo');
    expect(text().querySelector('strong')).toBeNull();
    expect(text().textContent).toBe('Hallo');
  });

  it('Ziehen von Text in das Feld wird verhindert', () => {
    starten(SEITE);
    klick(text());
    const e = davor(text(), 'insertFromDrop');
    expect(e.defaultPrevented).toBe(true);
  });
});
