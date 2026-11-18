// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Block } from '@shared/protokolle/dokument';
import { gliederung, punktVerschieben } from '@shared/protokolle/gliederung';
import { PunkteOrdnen } from './PunkteOrdnen';

/**
 * **Das Fenster „Punkte ordnen“** (W7): Bedienung mit Knöpfen, Tastatur und Ziehen – gegen die echte Regel
 * (`punktVerschieben`), nicht gegen handgeschriebene Ergebnisse. Die Lage der Zeilen (jsdom kennt kein Layout) wird
 * nachgestellt: jede Zeile 100 hoch, in der Reihenfolge des Dokuments.
 */

const h = (id: string, text: string, level = 1): Block => ({
  id,
  type: 'heading',
  props: { level },
  content: text,
});
const DOK: Block[] = [
  { id: 'vor', type: 'paragraph', content: 'Vorspann' },
  h('P1', 'Anwesenheit'),
  { id: 'anw', type: 'verweis', props: { art: 'anwesenheit' } },
  h('P2', 'Andacht'),
  { id: 'a1', type: 'bulletListItem', content: 'Impuls' },
  h('P3', 'Rückblick'),
  { id: 'r1', type: 'bulletListItem', content: 'Lief gut' },
  { id: 'todo', type: 'aufgabe', props: { aufgabe: 'aufgabe-3' }, content: 'Messen' },
  h('P4', 'Abläufe'),
  h('U1', 'Ton', 2),
  { id: 't1', type: 'bulletListItem', content: 'Funk' },
  h('U2', 'Bild', 2),
  h('U3', 'Stream', 2),
];

let onClose: ReturnType<typeof vi.fn<() => void>>;
let onUebernehmen: ReturnType<typeof vi.fn<(r: string[]) => boolean>>;

function zeige(dok: readonly Block[] = DOK) {
  render(<PunkteOrdnen dokument={dok} onUebernehmen={onUebernehmen} onClose={onClose} />);
}

beforeEach(() => {
  onClose = vi.fn<() => void>();
  onUebernehmen = vi.fn<(r: string[]) => boolean>(() => true);
  // Jede Zeile (`li[data-punkt]`) 100 hoch, untereinander in Dokument-Reihenfolge; die Liste beginnt bei 0.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const alle = [...document.querySelectorAll<HTMLElement>('li[data-punkt]')];
    const i = alle.indexOf(this);
    const top = i < 0 ? 0 : i * 100;
    const hoch = i < 0 ? 1000 : 90;
    return {
      top,
      bottom: top + hoch,
      left: 0,
      right: 300,
      width: 300,
      height: hoch,
      x: 0,
      y: top,
      toJSON: () => ({}),
    };
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const titel = (): string[] =>
  [...document.querySelectorAll('li[data-punkt] > div b')].map((b) => b.textContent ?? '');
const reihe = (): string[] => [
  ...[...document.querySelectorAll('li[data-punkt]')].map((l) => (l as HTMLElement).dataset.punkt!),
];
const uebernehmen = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Übernehmen' });
const rueckgaengig = () => screen.getByRole<HTMLButtonElement>('button', { name: /Rückgängig/ });
const knopf = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });

/** Die ID-Folge der obersten Blöcke, so wie die Regel sie für diesen Schritt ausrechnet. */
const erwartet = (id: string, platz: number, dok: readonly Block[] = DOK): string[] =>
  punktVerschieben(dok, id, platz)!.bloecke.map((b) => b.id);

describe('Anzeige', () => {
  it('Punkte und eingerückte Unterpunkte mit Nummer, Titel und „was mitwandert“', () => {
    zeige();
    expect(titel()).toEqual([
      'Anwesenheit',
      'Andacht',
      'Rückblick',
      'Abläufe',
      'Ton',
      'Bild',
      'Stream',
    ]);
    const nummern = [
      ...document.querySelectorAll('li[data-punkt] > div > span:nth-of-type(1)'),
    ].map((n) => n.textContent);
    expect(nummern).toEqual(['1.', '2.', '3.', '4.', '4.1', '4.2', '4.3']);
    const g = gliederung(DOK);
    expect(screen.getByText(g[0].mit)).toBeTruthy();
    expect(screen.getByText('fester Punkt · Anwesenheitsliste')).toBeTruthy();
    expect(screen.getByText('1 Stichpunkt · 1 To-Do')).toBeTruthy();
    expect(screen.getByText('3 Unterpunkte')).toBeTruthy();
    // Die Unterpunkte stehen in einer eigenen Liste unter dem Punkt.
    expect(document.querySelector('li[data-punkt="P4"] ul li[data-punkt="U1"]')).not.toBeNull();
  });

  it('ohne Änderung: „Übernehmen“ und „Rückgängig“ sind aus', () => {
    zeige();
    expect(uebernehmen().disabled).toBe(true);
    expect(rueckgaengig().disabled).toBe(true);
    expect(screen.getByText('Noch nichts verschoben.')).toBeTruthy();
  });

  it('Knöpfe am Rand der Liste sind aus – ein Unterpunkt springt nie in den nächsten Punkt', () => {
    zeige();
    expect(knopf('Anwesenheit nach oben').disabled).toBe(true);
    expect(knopf('Anwesenheit nach unten').disabled).toBe(false);
    expect(knopf('Abläufe nach unten').disabled).toBe(true);
    expect(knopf('Ton nach oben').disabled).toBe(true);
    expect(knopf('Stream nach unten').disabled).toBe(true);
    expect(knopf('Bild nach unten').disabled).toBe(false);
  });
});

describe('Umstellen mit Knöpfen und Tastatur', () => {
  it('↓ stellt den Punkt samt Inhalt um, sagt es, aktiviert „Übernehmen“ und hält den Fokus', () => {
    zeige();
    fireEvent.click(knopf('Andacht nach unten'));
    expect(titel().slice(0, 3)).toEqual(['Anwesenheit', 'Rückblick', 'Andacht']);
    expect(screen.getByText('„Andacht“ nach unten verschoben (jetzt 3.)')).toBeTruthy();
    expect(uebernehmen().disabled).toBe(false);
    expect(document.activeElement).toBe(knopf('Andacht nach unten'));
  });

  it('Pfeiltasten auf dem Griff verschieben ebenso – der Fokus bleibt auf dem Griff', () => {
    zeige();
    const griff = () => document.querySelector<HTMLElement>('li[data-punkt="P3"] [data-griff]')!;
    griff().focus();
    fireEvent.keyDown(griff(), { key: 'ArrowUp' });
    expect(titel().slice(0, 3)).toEqual(['Anwesenheit', 'Rückblick', 'Andacht']);
    expect(document.activeElement).toBe(griff());
    fireEvent.keyDown(griff(), { key: 'ArrowUp' });
    expect(titel().slice(0, 3)).toEqual(['Rückblick', 'Anwesenheit', 'Andacht']);
    // Am Rand: nichts.
    fireEvent.keyDown(griff(), { key: 'ArrowUp' });
    expect(titel().slice(0, 3)).toEqual(['Rückblick', 'Anwesenheit', 'Andacht']);
  });

  it('ein Unterpunkt bleibt in seinem Punkt', () => {
    zeige();
    fireEvent.click(knopf('Ton nach unten'));
    expect(titel().slice(3)).toEqual(['Abläufe', 'Bild', 'Ton', 'Stream']);
    expect(document.querySelector('li[data-punkt="P4"] li[data-punkt="Ton"]')).toBeNull();
    expect(document.querySelectorAll('li[data-punkt="P4"] > ul > li')).toHaveLength(3);
  });

  it('„Rückgängig“ holt den letzten Schritt im Fenster zurück – einen nach dem anderen', () => {
    zeige();
    fireEvent.click(knopf('Andacht nach unten'));
    fireEvent.click(knopf('Anwesenheit nach unten'));
    expect(reihe().slice(0, 3)).toEqual(['P3', 'P1', 'P2']);
    fireEvent.click(rueckgaengig());
    expect(titel().slice(0, 3)).toEqual(['Anwesenheit', 'Rückblick', 'Andacht']);
    expect(screen.getByText(/^Rückgängig: „Anwesenheit“ nach unten/)).toBeTruthy();
    expect(uebernehmen().disabled).toBe(false);
    fireEvent.click(rueckgaengig());
    expect(titel().slice(0, 3)).toEqual(['Anwesenheit', 'Andacht', 'Rückblick']);
    expect(rueckgaengig().disabled).toBe(true);
    expect(uebernehmen().disabled).toBe(true);
  });

  it('hin und zurück verschoben: „Übernehmen“ bleibt aus (nichts hat sich geändert)', () => {
    zeige();
    fireEvent.click(knopf('Andacht nach unten'));
    fireEvent.click(knopf('Andacht nach oben'));
    expect(uebernehmen().disabled).toBe(true);
  });
});

describe('Übernehmen, Abbrechen, Schließen', () => {
  it('Übernehmen gibt die Reihenfolge der Regel zurück und schließt', () => {
    zeige();
    fireEvent.click(knopf('Andacht nach unten'));
    fireEvent.click(knopf('Ton nach unten'));
    fireEvent.click(uebernehmen());
    const erst = punktVerschieben(DOK, 'P2', 2)!.bloecke;
    expect(onUebernehmen).toHaveBeenCalledTimes(1);
    expect(onUebernehmen).toHaveBeenCalledWith(
      punktVerschieben(erst, 'U1', 1)!.bloecke.map((b) => b.id),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Abbrechen ändert nichts: nichts übernommen, Fenster zu', () => {
    zeige();
    fireEvent.click(knopf('Andacht nach unten'));
    fireEvent.click(knopf('Abbrechen'));
    expect(onUebernehmen).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ging die Übernahme nicht (Dokument inzwischen verändert): Meldung, Fenster bleibt offen', () => {
    onUebernehmen.mockReturnValue(false);
    zeige();
    fireEvent.click(knopf('Andacht nach unten'));
    fireEvent.click(uebernehmen());
    expect(screen.getByRole('alert').textContent).toMatch(/inzwischen verändert/);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Esc ohne Änderung schließt; mit Änderung schließt es nicht und sagt, was zu tun ist', () => {
    zeige();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(knopf('Andacht nach unten'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert').textContent).toBe(
      'Erst „Übernehmen“ oder „Abbrechen“ wählen.',
    );
  });

  it('das X mit Änderung schließt nicht; ohne Änderung schon', () => {
    zeige();
    fireEvent.click(knopf('Fenster schließen'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(knopf('Andacht nach unten'));
    fireEvent.click(knopf('Fenster schließen'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});

describe('Ziehen am Griff', () => {
  const griff = (id: string) =>
    document.querySelector<HTMLElement>(`li[data-punkt="${id}"] [data-griff]`)!;
  /** jsdom kennt kein `PointerEvent` – ein Mausereignis mit den Zeiger-Eigenschaften tut es für React und für `window`. */
  const zeiger = (ziel: EventTarget, art: string, y: number, pointerType = 'mouse') =>
    act(() => {
      const e = new MouseEvent(art, { bubbles: true, cancelable: true, clientX: 10, clientY: y });
      Object.defineProperties(e, {
        pointerId: { value: 1 },
        pointerType: { value: pointerType },
      });
      ziel.dispatchEvent(e);
    });
  const druecken = (id: string, y: number, art = 'mouse') =>
    zeiger(griff(id), 'pointerdown', y, art);
  const bewegen = (y: number) => zeiger(window, 'pointermove', y);
  const loslassen = (y: number) => zeiger(window, 'pointerup', y);

  it('Maus: ein Punkt wandert an die Stelle unter dem Zeiger – mit Unterpunkten, Linie nur dort', () => {
    zeige();
    // „Abläufe“ (Zeile 3, Mitte 345) nach ganz oben ziehen: über die Mitte der ersten Zeile.
    druecken('P4', 345);
    bewegen(200);
    bewegen(10);
    expect(document.querySelector('[class*="linie"]')).not.toBeNull();
    loslassen(10);
    expect(document.querySelector('[class*="linie"]')).toBeNull();
    expect(titel()).toEqual([
      'Abläufe',
      'Ton',
      'Bild',
      'Stream',
      'Anwesenheit',
      'Andacht',
      'Rückblick',
    ]);
    expect(screen.getByText('„Abläufe“ nach oben verschoben (jetzt 1.)')).toBeTruthy();
    expect(uebernehmen().disabled).toBe(false);
  });

  it('ein Unterpunkt kommt nie aus seinem Punkt heraus – auch nicht beim Ziehen über die ganze Liste', () => {
    zeige();
    // „Stream“ (letzte Zeile, Mitte 645) ganz nach oben ziehen – über alle Punkte hinweg.
    druecken('U3', 645);
    bewegen(300);
    bewegen(0);
    // Die Linie steht über „Ton“ (Zeile 5, Oberkante 400) – nicht über „Anwesenheit“ (0): andere Stellen gibt es nicht.
    expect(document.querySelector<HTMLElement>('[class*="linie"]')?.style.top).toBe('400px');
    loslassen(0);
    expect(titel()).toEqual([
      'Anwesenheit',
      'Andacht',
      'Rückblick',
      'Abläufe',
      'Stream',
      'Ton',
      'Bild',
    ]);
    expect(document.querySelectorAll('li[data-punkt="P4"] > ul > li')).toHaveLength(3);
    expect(
      document.querySelectorAll('ul[aria-label="Tagesordnung"] > li[data-punkt]'),
    ).toHaveLength(4);
  });

  it('Esc bricht das Ziehen ab – nichts verschoben, das Fenster bleibt offen', () => {
    zeige();
    druecken('P4', 345);
    bewegen(10);
    fireEvent.keyDown(document, { key: 'Escape' });
    loslassen(10);
    expect(titel().slice(0, 4)).toEqual(['Anwesenheit', 'Andacht', 'Rückblick', 'Abläufe']);
    expect(uebernehmen().disabled).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('[class*="linie"]')).toBeNull();
  });

  it('ohne Bewegung ist es ein Tipp, kein Ziehen', () => {
    zeige();
    druecken('P4', 345);
    bewegen(347);
    loslassen(347);
    expect(uebernehmen().disabled).toBe(true);
    expect(document.querySelector('[class*="linie"]')).toBeNull();
  });

  it('Finger: erst nach dem Halten – wer vorher wischt, blättert nur', () => {
    vi.useFakeTimers();
    try {
      zeige();
      druecken('P4', 345, 'touch');
      bewegen(300); // 45 px gewischt, bevor 0,3 s um sind → Blättern, kein Ziehen
      act(() => {
        vi.advanceTimersByTime(400);
      });
      bewegen(10);
      loslassen(10);
      expect(uebernehmen().disabled).toBe(true);

      druecken('P4', 345, 'touch');
      act(() => {
        vi.advanceTimersByTime(350);
      });
      bewegen(10);
      loslassen(10);
      expect(titel()[0]).toBe('Abläufe');
    } finally {
      vi.useRealTimers();
    }
  });

  it('das Ergebnis des Ziehens ist dasselbe wie das der Regel', () => {
    zeige();
    druecken('P1', 145);
    bewegen(445);
    loslassen(445);
    fireEvent.click(uebernehmen());
    // Bis 445 liegen die Mitten aller drei anderen Punkte (145, 245, 345) über dem Zeiger: ans Ende.
    expect(onUebernehmen).toHaveBeenCalledWith(erwartet('P1', 3));
  });
});
