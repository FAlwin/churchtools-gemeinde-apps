// @vitest-environment jsdom
/**
 * Ziehen in der Bedien-Schicht (W3c-2): Griff greifen, Linie und Geist, Zielspalte, Esc, Auto-Scroll, die eine Nachricht
 * `verschieben` mit nur Zahlen. jsdom misst nichts – die Maße der Abschnitte, Spalten und Bausteine werden hier festgelegt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { abschnitt, baustein, seite, spalte } from '@shared/website/website.testdaten';
import { aufraeumen, gesendet, starten } from './ebene.testutil';

const M = (rest: Record<string, unknown>) => ({ websiteEditor: true, ...rest });
const verschieben = (senden: ReturnType<typeof starten>) =>
  gesendet(senden).filter((m) => m.was === 'verschieben');

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

/**
 * Zwei Abschnitte. a0: eine Spalte mit „u1“ (10–60) und „t1“ (100–150). a1: zwei Spalten, links „c0“ (310–360),
 * rechts „c1“ (310–360) und „c2“ (400–450).
 */
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
function messen() {
  const [s0, s1] = [...document.querySelectorAll('section.w-abschnitt')];
  maße(s0, 0, 0, 800, 200);
  maße(s1, 0, 300, 800, 600);
  const sp = [...document.querySelectorAll('.w-spalte')];
  maße(sp[0], 0, 0, 800, 200);
  maße(sp[1], 0, 300, 400, 600);
  maße(sp[2], 400, 300, 800, 600);
  const b = [...document.querySelectorAll('.w-baustein')];
  maße(b[0], 0, 10, 800, 60);
  maße(b[1], 0, 100, 800, 150);
  maße(b[2], 0, 310, 400, 360);
  maße(b[3], 400, 310, 800, 360);
  maße(b[4], 400, 400, 800, 450);
}
const bausteinGriff = () => document.querySelector<HTMLElement>('.b-griff-baustein')!;
const abschnittGriff = () => document.querySelector<HTMLElement>('.b-griff-abschnitt')!;
/** Baustein `n` anfassen, zum Punkt ziehen (mit einem Zwischenschritt) und dort loslassen. */
function ziehen(
  griff: HTMLElement,
  von: [number, number],
  nach: [number, number],
  loslassen = true,
) {
  zeiger('pointerdown', griff, von[0], von[1]);
  zeiger('pointermove', griff, von[0] + 10, von[1] + 10);
  zeiger('pointermove', griff, nach[0], nach[1]);
  if (loslassen) zeiger('pointerup', griff, nach[0], nach[1]);
}

beforeEach(() => {
  window.scrollTo = vi.fn() as never;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  aufraeumen();
});

describe('Baustein ziehen', () => {
  it('in eine andere Spalte eines anderen Abschnitts – zwischen zwei Bausteine: genau EINE Nachricht, nur Zahlen', () => {
    const senden = starten(SEITE);
    messen();
    hoverAuf(document.querySelectorAll('.w-baustein')[1]); // t1
    ziehen(bausteinGriff(), [20, 120], [500, 380]);
    expect(verschieben(senden)).toEqual([
      M({
        was: 'verschieben',
        art: 'baustein',
        von: { i: 0, j: 0, k: 1 },
        nach: { i: 1, j: 1, k: 1 },
      }),
    ]);
  });

  it('ans Ende einer Spalte und an ihren Anfang', () => {
    const senden = starten(SEITE);
    messen();
    hoverAuf(document.querySelectorAll('.w-baustein')[1]);
    ziehen(bausteinGriff(), [20, 120], [100, 590]);
    expect(verschieben(senden).at(-1)).toMatchObject({ nach: { i: 1, j: 0, k: 1 } });
    hoverAuf(document.querySelectorAll('.w-baustein')[1]);
    ziehen(bausteinGriff(), [20, 120], [100, 305]);
    expect(verschieben(senden).at(-1)).toMatchObject({ nach: { i: 1, j: 0, k: 0 } });
  });

  it('in dieselbe Spalte: „nach“ ist die Stelle vor dem Herausnehmen gezählt (hinter dem letzten = Anzahl)', () => {
    const senden = starten(SEITE);
    messen();
    hoverAuf(document.querySelectorAll('.w-baustein')[0]); // u1
    ziehen(bausteinGriff(), [20, 30], [100, 130]);
    expect(verschieben(senden)).toEqual([
      M({
        was: 'verschieben',
        art: 'baustein',
        von: { i: 0, j: 0, k: 0 },
        nach: { i: 0, j: 0, k: 2 },
      }),
    ]);
  });

  it('eine leere Spalte ist ein Ziel – und wird dabei gestrichelt markiert', () => {
    const s = seite({
      abschnitte: [
        abschnitt([], {
          id: 'a0',
          aufteilung: '1-1',
          spalten: [
            spalte([baustein('trenner', { id: 'x' })], { id: 's0' }),
            spalte([], { id: 's1' }),
          ],
        }),
      ],
    });
    const senden = starten(s);
    maße(document.querySelector('section.w-abschnitt')!, 0, 0, 800, 200);
    const sp = [...document.querySelectorAll('.w-spalte')];
    maße(sp[0], 0, 0, 400, 200);
    maße(sp[1], 400, 0, 800, 200);
    maße(document.querySelector('.w-baustein')!, 0, 10, 400, 60);
    hoverAuf(document.querySelector('.w-baustein')!);
    ziehen(bausteinGriff(), [20, 30], [600, 80], false);
    expect(sp[1].classList.contains('b-ziel')).toBe(true);
    expect(sp[0].classList.contains('b-ziel')).toBe(false);
    zeiger('pointerup', bausteinGriff(), 600, 80);
    expect(verschieben(senden)).toEqual([
      M({
        was: 'verschieben',
        art: 'baustein',
        von: { i: 0, j: 0, k: 0 },
        nach: { i: 0, j: 1, k: 0 },
      }),
    ]);
  });

  it('beim Ziehen: Geist mit „Typ: Anfang des Texts“, Einfügelinie, die Quelle ist abgeblendet, die Leisten sind weg', () => {
    starten(SEITE);
    messen();
    const t1 = document.querySelectorAll('.w-baustein')[0] as HTMLElement; // Überschrift
    t1.querySelector('h2')!.textContent = 'Willkommen bei uns zuhause in Donrath und überall';
    hoverAuf(t1);
    ziehen(bausteinGriff(), [20, 30], [500, 380], false);
    const geist = document.querySelector<HTMLElement>('.b-geist')!;
    expect(geist.hidden).toBe(false);
    expect(geist.textContent).toMatch(/^Überschrift: Willkommen bei uns/);
    expect(geist.textContent.length).toBeLessThanOrEqual('Überschrift: '.length + 38);
    expect(document.querySelector<HTMLElement>('.b-linie')!.hidden).toBe(false);
    expect(t1.classList.contains('b-quelle')).toBe(true);
    expect(document.body.classList.contains('b-zieht')).toBe(true);
    zeiger('pointerup', bausteinGriff(), 500, 380);
    expect(document.querySelector<HTMLElement>('.b-geist')!.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('.b-linie')!.hidden).toBe(true);
    expect(t1.classList.contains('b-quelle')).toBe(false);
    expect(document.body.classList.contains('b-zieht')).toBe(false);
    expect(document.querySelector('.b-ziel')).toBeNull();
  });

  it('der Griff bekommt beim Greifen den Fokus – sonst käme Esc im iframe nie an (im Browser gemessen)', () => {
    starten(SEITE);
    messen();
    hoverAuf(document.querySelectorAll('.w-baustein')[1]);
    zeiger('pointerdown', bausteinGriff(), 20, 120);
    expect(document.activeElement).toBe(bausteinGriff());
  });

  it('unter 4 px ist es ein Klick auf den Griff, kein Ziehen – es geht nichts raus', () => {
    const senden = starten(SEITE);
    messen();
    hoverAuf(document.querySelectorAll('.w-baustein')[1]);
    zeiger('pointerdown', bausteinGriff(), 20, 120);
    zeiger('pointermove', bausteinGriff(), 22, 122);
    zeiger('pointerup', bausteinGriff(), 22, 122);
    expect(verschieben(senden)).toHaveLength(0);
    expect(document.body.classList.contains('b-zieht')).toBe(false);
  });

  it('Esc bricht ab: nichts geht raus, alles ist wieder aufgeräumt – auch das Loslassen danach schickt nichts', () => {
    const senden = starten(SEITE);
    messen();
    hoverAuf(document.querySelectorAll('.w-baustein')[1]);
    ziehen(bausteinGriff(), [20, 120], [500, 380], false);
    expect(document.body.classList.contains('b-zieht')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.body.classList.contains('b-zieht')).toBe(false);
    expect(document.querySelector<HTMLElement>('.b-geist')!.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('.b-linie')!.hidden).toBe(true);
    expect(document.querySelector('.b-ziel')).toBeNull();
    expect(document.querySelector('.b-quelle')).toBeNull();
    zeiger('pointerup', bausteinGriff(), 500, 380);
    expect(verschieben(senden)).toHaveLength(0);
  });

  it('am unteren und oberen Rand scrollt die Seite von selbst – und aufhören tut es mit dem Loslassen', () => {
    const senden = starten(SEITE);
    messen();
    const scrollBy = vi.fn();
    window.scrollBy = scrollBy as never;
    hoverAuf(document.querySelectorAll('.w-baustein')[1]);
    ziehen(bausteinGriff(), [20, 120], [500, window.innerHeight - 10], false);
    vi.advanceTimersByTime(100);
    expect(scrollBy).toHaveBeenCalled();
    expect(scrollBy.mock.calls.every((c) => (c[1] as number) > 0)).toBe(true);
    zeiger('pointermove', bausteinGriff(), 500, 5);
    vi.advanceTimersByTime(100);
    expect(scrollBy.mock.calls.at(-1)![1]).toBeLessThan(0);
    zeiger('pointerup', bausteinGriff(), 500, 5);
    const n = scrollBy.mock.calls.length;
    vi.advanceTimersByTime(200);
    expect(scrollBy.mock.calls).toHaveLength(n);
    expect(verschieben(senden)).toHaveLength(1);
  });

  it('die Pfeiltasten am Baustein-Griff verschieben in der Spalte um eine Stelle; am Rand passiert nichts', () => {
    const senden = starten(SEITE);
    hoverAuf(document.querySelectorAll('.w-baustein')[1]); // t1 = letzter in a0
    const taste = (key: string) =>
      bausteinGriff().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    taste('ArrowUp');
    expect(verschieben(senden).at(-1)).toEqual(
      M({
        was: 'verschieben',
        art: 'baustein',
        von: { i: 0, j: 0, k: 1 },
        nach: { i: 0, j: 0, k: 0 },
      }),
    );
    taste('ArrowDown'); // letzter: weiter nach unten gibt es nichts
    expect(verschieben(senden)).toHaveLength(1);
    hoverAuf(document.querySelectorAll('.w-baustein')[0]);
    taste('ArrowDown');
    expect(verschieben(senden).at(-1)).toMatchObject({ von: { k: 0 }, nach: { k: 2 } });
    taste('ArrowUp'); // erster: nach oben gibt es nichts
    expect(verschieben(senden)).toHaveLength(2);
  });
});

describe('Abschnitt ziehen', () => {
  it('an eine andere Stelle: die Nachricht trägt die Stelle zwischen den Abschnitten, nicht den Abschnitt selbst', () => {
    const senden = starten(SEITE);
    messen();
    hoverAuf(document.querySelectorAll('section.w-abschnitt')[0]);
    ziehen(abschnittGriff(), [20, 5], [100, 560]);
    expect(verschieben(senden)).toEqual([
      M({ was: 'verschieben', art: 'abschnitt', von: 0, nach: 2 }),
    ]);
  });

  it('nach oben: der zweite Abschnitt vor den ersten; Geist „Abschnitt: …“, Linie über die ganze Breite', () => {
    const senden = starten(SEITE);
    messen();
    hoverAuf(document.querySelectorAll('section.w-abschnitt')[1]);
    ziehen(abschnittGriff(), [20, 305], [100, 20], false);
    expect(document.querySelector('.b-geist')!.textContent).toMatch(/^Abschnitt: /);
    expect(document.querySelector<HTMLElement>('.b-linie')!.hidden).toBe(false);
    expect(document.querySelector('.b-ziel')).toBeNull(); // die Spalten-Markierung gibt es nur beim Baustein
    zeiger('pointerup', abschnittGriff(), 100, 20);
    expect(verschieben(senden)).toEqual([
      M({ was: 'verschieben', art: 'abschnitt', von: 1, nach: 0 }),
    ]);
  });

  it('Esc bricht auch hier ab', () => {
    const senden = starten(SEITE);
    messen();
    hoverAuf(document.querySelectorAll('section.w-abschnitt')[0]);
    ziehen(abschnittGriff(), [20, 5], [100, 560], false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    zeiger('pointerup', abschnittGriff(), 100, 560);
    expect(verschieben(senden)).toHaveLength(0);
    expect(document.querySelector('.b-quelle')).toBeNull();
  });
});

describe('Eigenes HTML und Handy', () => {
  const MIT_HTML = seite({
    abschnitte: [abschnitt([baustein('html', { id: 'h' }), baustein('text', { id: 't' })])],
  });

  it('ohne das Recht gibt es für „Eigenes HTML“ keinen Griff (die Leiste bleibt weg); der Text daneben lässt sich ziehen', () => {
    starten(MIT_HTML, { darfHtml: false });
    hoverAuf(document.querySelector('.w-b-html')!);
    const leiste = document.querySelector<HTMLElement>('.b-blockleiste')!;
    expect(leiste.hidden).toBe(true);
    hoverAuf(document.querySelector('.w-b-text')!);
    expect(leiste.hidden).toBe(false);
    expect(leiste.querySelector('.b-griff-baustein')).not.toBeNull();
  });

  it('mit dem Recht (Leitung) ist „Eigenes HTML“ ziehbar – gemeldet wird nur seine Stelle', () => {
    const senden = starten(MIT_HTML, { darfHtml: true });
    const sec = document.querySelector('section.w-abschnitt')!;
    maße(sec, 0, 0, 800, 300);
    maße(document.querySelector('.w-spalte')!, 0, 0, 800, 300);
    const b = [...document.querySelectorAll('.w-baustein')];
    maße(b[0], 0, 10, 800, 60);
    maße(b[1], 0, 100, 800, 150);
    hoverAuf(b[0]);
    expect((document.querySelector('.b-blockleiste') as HTMLElement).hidden).toBe(false);
    ziehen(bausteinGriff(), [20, 30], [100, 200]);
    expect(verschieben(senden)).toEqual([
      M({
        was: 'verschieben',
        art: 'baustein',
        von: { i: 0, j: 0, k: 0 },
        nach: { i: 0, j: 0, k: 2 },
      }),
    ]);
  });

  it('am Handy: kein Baustein-Griff, kein Ziehen des Abschnitts (nur die Pfeiltasten am Griff)', () => {
    const senden = starten(SEITE, { modus: 'handy' });
    messen();
    expect(document.querySelector('.b-griff-baustein')).toBeNull();
    document
      .querySelectorAll('section.w-abschnitt')[0]
      .dispatchEvent(new Event('pointerdown', { bubbles: true }));
    vi.advanceTimersByTime(100);
    ziehen(abschnittGriff(), [20, 5], [100, 560]);
    expect(verschieben(senden)).toHaveLength(0);
    expect(document.body.classList.contains('b-zieht')).toBe(false);
  });
});

describe('Rückgängig und Wiederholen: Tasten in der Vorschau', () => {
  const taste = (init: KeyboardEventInit) =>
    document.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }),
    );

  it('Strg/Cmd+Z meldet „rueckgaengig“, mit Umschalt (und Strg+Y) „wiederholen“ – ohne Inhalt', () => {
    const senden = starten(SEITE);
    taste({ key: 'z', ctrlKey: true });
    expect(gesendet(senden).at(-1)).toEqual(M({ was: 'rueckgaengig' }));
    taste({ key: 'z', metaKey: true, shiftKey: true });
    expect(gesendet(senden).at(-1)).toEqual(M({ was: 'wiederholen' }));
    taste({ key: 'y', ctrlKey: true });
    expect(gesendet(senden).at(-1)).toEqual(M({ was: 'wiederholen' }));
    const n = gesendet(senden).length;
    taste({ key: 'z' }); // ohne Strg/Cmd
    taste({ key: 'z', ctrlKey: true, altKey: true });
    expect(gesendet(senden)).toHaveLength(n);
  });

  it('im offenen Textfeld gilt der Verlauf des Feldes: dort meldet die Ebene nichts', () => {
    const senden = starten(SEITE);
    document.querySelector<HTMLElement>('.w-b-ueberschrift h2')!.click(); // Tippen beginnt
    expect(gesendet(senden).some((m) => m.was === 'tippen')).toBe(true);
    taste({ key: 'z', ctrlKey: true });
    expect(gesendet(senden).filter((m) => m.was === 'rueckgaengig')).toHaveLength(0);
  });

  it('während des Ziehens meldet es nichts', () => {
    const senden = starten(SEITE);
    messen();
    hoverAuf(document.querySelectorAll('.w-baustein')[1]);
    ziehen(bausteinGriff(), [20, 120], [500, 380], false);
    taste({ key: 'z', ctrlKey: true });
    expect(gesendet(senden).filter((m) => m.was === 'rueckgaengig')).toHaveLength(0);
  });
});
