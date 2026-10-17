// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRef, type MutableRefObject } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ScrollDeck } from './ScrollDeck';
import { SCROLL_START, type ScrollPosition } from '../utils/scrollPosition';
import { textSchluessel } from '../utils/annotationKeys';
import type { PedalRichtung } from '../utils/pedalTasten';
import { satzplaene } from '../utils/chordPdf';
import type { Anmerkungsquelle } from '../utils/rollenAbbildung';

const KEINE = (): Anmerkungsquelle => ({ seiten: [{ own: null, over: null }] });

/**
 * Scroll-Modus (#551). Was die Geometrie braucht (Seiten untereinander, Kopfzeile folgt der Bildmitte,
 * Zurückkehren nach dem Malen), prüft `e2e/chart-scrollen.spec.ts` im echten Browser. Hier: dass die
 * Anmerkungen derselben Regeln folgen wie beim Blättern, der Pedal-Schritt ⅔ beträgt und ein Tipp die
 * Leisten schaltet.
 */
function seite(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 100;
  c.height = 141;
  return c;
}

function text(id: number, t: string) {
  return { id, fx: 0.5, fy: 0.5, text: t, color: '#000', sizeCqh: 2 };
}

function zeige(p: {
  anmerkungFuer?: (n: number) => Anmerkungsquelle;
  pages?: HTMLCanvasElement[];
  onTipp?: () => void;
}) {
  const schrittRef = createRef<((r: PedalRichtung) => void) | null>() as MutableRefObject<
    ((r: PedalRichtung) => void) | null
  >;
  const positionRef: MutableRefObject<ScrollPosition> = { current: SCROLL_START };
  render(
    <ScrollDeck
      pages={p.pages ?? [seite(), seite()]}
      loading={false}
      error={null}
      loadingLabel="lädt"
      anmerkungFuer={p.anmerkungFuer ?? KEINE}
      seite={0}
      onSeite={vi.fn()}
      positionRef={positionRef}
      onTipp={p.onTipp}
      schrittRef={schrittRef}
    />,
  );
  return { schrittRef, deck: screen.getByTestId('scroll-deck') };
}

// jsdom kann nicht zeichnen – die Leinwand bleibt leer, getestet wird hier nur, was um sie herum passiert.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('ScrollDeck – Anmerkungen wie beim Blättern', () => {
  it('zeigt die Texte jeder Seite: eigene und angesehene fremde', () => {
    localStorage.setItem(textSchluessel('eigen_1'), JSON.stringify([text(1, 'leise!')]));
    localStorage.setItem(textSchluessel('fremd_0'), JSON.stringify([text(2, '2× Refrain')]));
    zeige({
      anmerkungFuer: (n) => ({ seiten: [{ own: `eigen_${n}`, over: n === 0 ? 'fremd_0' : null }] }),
    });
    expect(screen.getByText('leise!')).toBeTruthy();
    expect(screen.getByText('2× Refrain')).toBeTruthy();
  });

  it('ohne eigenen Schlüssel (fremde Notizen werden angesehen) bleibt die eigene Ebene weg', () => {
    localStorage.setItem(textSchluessel('eigen_0'), JSON.stringify([text(1, 'meins')]));
    zeige({ anmerkungFuer: () => ({ seiten: [{ own: null, over: null }] }) });
    expect(screen.queryByText('meins')).toBeNull();
  });
});

describe('ScrollDeck – Bedienung', () => {
  it('Pedal: ein Schritt ist ⅔ der Höhe, vor und zurück', () => {
    const { schrittRef, deck } = zeige({});
    Object.defineProperty(deck, 'clientHeight', { value: 600 });
    Object.defineProperty(deck, 'scrollHeight', { value: 5000 });
    deck.scrollTop = 300;
    const ziele: number[] = [];
    deck.scrollTo = ((o: ScrollToOptions) => ziele.push(o.top ?? NaN)) as typeof deck.scrollTo;
    schrittRef.current?.(1);
    schrittRef.current?.(-1);
    // ⅔ ist eine Entscheidung (Alwin, 14.10.2026: 85 % war zu weit) – deshalb die Zahl, nicht die Konstante.
    expect(ziele).toEqual([700, -100]);
  });

  it('ein Tipp aufs Blatt schaltet die Leisten', () => {
    const onTipp = vi.fn();
    const { deck } = zeige({ onTipp });
    fireEvent.click(deck);
    expect(onTipp).toHaveBeenCalledTimes(1);
  });

  it('räumt den Pedal-Schritt beim Verlassen ab – sonst scrollte das Pedal ins Leere', () => {
    const schrittRef = { current: null } as MutableRefObject<((r: PedalRichtung) => void) | null>;
    const { unmount } = render(
      <ScrollDeck
        pages={[seite()]}
        loading={false}
        error={null}
        loadingLabel=""
        anmerkungFuer={KEINE}
        seite={0}
        onSeite={vi.fn()}
        positionRef={{ current: SCROLL_START }}
        schrittRef={schrittRef}
      />,
    );
    expect(schrittRef.current).not.toBeNull();
    unmount();
    expect(schrittRef.current).toBeNull();
  });
});

describe('ScrollDeck – die Rolle zeigt die Anmerkungen der A4-Seiten (#614)', () => {
  it('Texte von A4-Seite 2 stehen auf der Rolle beim richtigen Teil – höher gerückt', () => {
    // Sechs Teile à neun Zeilen: Teil 6 springt auf A4-Seite 2.
    const chordpro = Array.from(
      { length: 6 },
      (_, n) =>
        `{comment: Vers ${n + 1}}\n${Array.from({ length: 9 }, () => '[C]Zeile').join('\n')}`,
    ).join('\n');
    const abbildung = satzplaene({
      title: 'T',
      author: '',
      chordpro,
      originalKey: 'C',
      targetKey: 'C',
      bpm: null,
      timeSig: null,
      ccli: null,
    });
    expect(abbildung.a4.seiten).toBeGreaterThanOrEqual(2);
    const anfang = abbildung.a4.stuecke.find((s) => s.seite === 1)!;
    // Ein Text am Anfang des Teils auf Seite 2 (A4: oben auf der Seite).
    localStorage.setItem(
      textSchluessel('a4_1'),
      JSON.stringify([{ ...text(7, 'hier!'), fx: 0.5, fy: (anfang.y0 + 2) / 297, sizeCqh: 2 }]),
    );
    const rolleMm = abbildung.rolle.hoehe;
    const rolle = document.createElement('canvas');
    rolle.width = 210;
    rolle.height = Math.round(rolleMm);
    zeige({
      pages: [rolle],
      anmerkungFuer: () => ({
        seiten: Array.from({ length: abbildung.a4.seiten }, (_, i) => ({
          own: `a4_${i}`,
          over: null,
        })),
        abbildung,
      }),
    });
    const el = screen.getByText('hier!');
    const r = abbildung.rolle.stuecke.find((s) => s.teil === anfang.teil)!;
    const top = parseFloat(el.style.top);
    // Auf der Rolle beim Teil, nicht 297 mm tiefer.
    expect(top / 100).toBeCloseTo((r.y0 + 2) / (210 * (rolle.height / rolle.width)), 2);
    // Die Größe (cqh) kann jsdom nicht lesen – geprüft in `rollenAbbildung.test.ts` (textAufRolle).
  });
});
