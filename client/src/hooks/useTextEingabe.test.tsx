// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createRef, type MutableRefObject } from 'react';
import { useTextEingabe } from './useTextEingabe';
import type { usePageDraw } from './usePageDraw';

/**
 * Textfelder auf einer Fläche (#608 aus `PageDeck` herausgelöst, damit die Rolle dieselbe Bedienung
 * bekommt). Die Regeln waren bis dahin ungetestet – hier festgehalten, was Blättern und Rolle teilen.
 */
type PageDraw = ReturnType<typeof usePageDraw>;

function zeichnung(over: Partial<PageDraw> = {}): PageDraw {
  return {
    texts: [],
    selectedId: null,
    setSelectedId: vi.fn(),
    pending: null,
    placeText: vi.fn(),
    confirmText: vi.fn(),
    pushHistory: vi.fn(),
    setSize: vi.fn(),
    ...over,
  } as unknown as PageDraw;
}

function ebene(): MutableRefObject<HTMLDivElement | null> {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ left: 100, top: 200, width: 400, height: 800 }) as DOMRect;
  Object.defineProperty(el, 'clientHeight', { value: 800 });
  return { current: el };
}

function zeige(over: { draw?: PageDraw; drawMode?: boolean; drawTool?: 'text' | 'pen' } = {}) {
  const draw = over.draw ?? zeichnung();
  const props = {
    rootRef: createRef<HTMLDivElement>() as MutableRefObject<HTMLDivElement | null>,
    draws: [draw],
    layerRefs: [ebene()],
    drawMode: over.drawMode ?? true,
    drawTool: over.drawTool ?? ('text' as const),
    drawColor: '#d92d20',
    perView: 1,
    activeSlot: 0,
    pageIndex: 0,
    onActivePage: vi.fn(),
  };
  const r = renderHook((p: typeof props) => useTextEingabe(p), { initialProps: props });
  return { ...r, draw, props };
}

/** Ein Tipp auf die Text-Ebene. */
const tipp = (x: number, y: number) =>
  ({ clientX: x, clientY: y, stopPropagation: vi.fn() }) as unknown as React.PointerEvent;

describe('useTextEingabe – Text platzieren', () => {
  it('mit dem Text-Werkzeug: neues Feld an der Tippstelle (als Anteil der Fläche)', () => {
    const { result, draw } = zeige();
    act(() => result.current.layerDown(tipp(300, 400), 0));
    expect(draw.placeText).toHaveBeenCalledWith(0.5, 0.25, 300, 400);
  });

  it('mit einem anderen Werkzeug oder außerhalb des Malmodus: nichts', () => {
    const a = zeige({ drawTool: 'pen' });
    act(() => a.result.current.layerDown(tipp(300, 400), 0));
    expect(a.draw.placeText).not.toHaveBeenCalled();
    const b = zeige({ drawMode: false });
    act(() => b.result.current.layerDown(tipp(300, 400), 0));
    expect(b.draw.placeText).not.toHaveBeenCalled();
  });

  it('ein Tipp ins Leere hebt eine Auswahl auf – statt ein neues Feld zu öffnen', () => {
    const draw = zeichnung({ selectedId: 7 });
    const { result } = zeige({ draw });
    act(() => result.current.layerDown(tipp(300, 400), 0));
    expect(draw.setSelectedId).toHaveBeenCalledWith(null);
    expect(draw.placeText).not.toHaveBeenCalled();
  });
});

describe('useTextEingabe – offene Eingabe übernehmen', () => {
  it('ein Tipp daneben übernimmt den getippten Text mit Farbe, Größe und Stil – genau einmal', () => {
    const draw = zeichnung({ pending: { fx: 0.5, fy: 0.5, cx: 0, cy: 0 } });
    const { result } = zeige({ draw });
    const feld = document.createElement('span');
    Object.defineProperty(feld, 'innerText', { value: '  2× Refrain  ' });
    result.current.editRefs.current[0] = feld;
    act(() => result.current.layerDown(tipp(300, 400), 0));
    // Blur im selben Moment: die Sperre verhindert ein zweites Übernehmen.
    act(() => result.current.commitInlineText(0));
    expect(draw.confirmText).toHaveBeenCalledTimes(1);
    expect(draw.confirmText).toHaveBeenCalledWith(
      '2× Refrain',
      '#d92d20',
      1.5,
      expect.objectContaining({ align: 'center' }),
    );
  });
});

describe('useTextEingabe – Malmodus verlassen', () => {
  it('keine Auswahl bleibt stehen', () => {
    const { rerender, draw, props } = zeige();
    rerender({ ...props, drawMode: false });
    expect(draw.setSelectedId).toHaveBeenCalledWith(null);
  });
});

describe('useTextEingabe – Größe am Griff ziehen', () => {
  it('nach unten ziehen vergrößert um den Weg in Prozent der Flächenhöhe', () => {
    const { result, draw } = zeige();
    const griff = document.createElement('div');
    griff.setPointerCapture = vi.fn();
    act(() =>
      result.current.handleResizeDown(
        {
          clientY: 300,
          stopPropagation: vi.fn(),
          currentTarget: griff,
          pointerId: 1,
        } as unknown as React.PointerEvent,
        0,
        5,
        2,
      ),
    );
    expect(draw.pushHistory).toHaveBeenCalledTimes(1);
    act(() =>
      result.current.handleResizeMove({
        clientY: 340,
        stopPropagation: vi.fn(),
      } as unknown as React.PointerEvent),
    );
    // 40 px von 800 px = 5 % → 2 + 5.
    expect(draw.setSize).toHaveBeenCalledWith(5, 7);
  });
});
