// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ablaufZeileAus, type AblaufZeile } from '@shared/ct/ablaufZeile';
import { useAblaufBearbeiten, type AblaufAktionen } from './useAblaufBearbeiten';
import { Bereich, platzIn, type BereichWert, type Platz, type ZiehSpalte } from './ablaufZiehen';

/**
 * Ziehen zwischen Abläufen (E6-6b): wo ein Punkt in der Ziel-Spalte landet (`platzIn`) und wie die Liste im Zieh-Bereich
 * mitspielt (anmelden, gestrichelte Stelle am Beginn-Balken). Das Ziehen selbst (dnd-kit) ist im Browser geprüft – in
 * jsdom haben Elemente keine Maße.
 */
afterEach(cleanup);

const zeile = (id: number, title: string, vorBeginn = false): AblaufZeile => ({
  ...ablaufZeileAus({ id, title, type: 'normal' }, 7, 'Europe/Berlin'),
  vorBeginn,
});
// Vorlauf: Gebet; danach Way Maker, Segen.
const ZIEL = [zeile(21, 'Gebet', true), zeile(22, 'Way Maker'), zeile(23, 'Segen')];
const punkt = (itemId: number) => ({ art: 'punkt' as const, spalte: 9, itemId });
const RECT = { top: 100, height: 40 }; // Mitte bei 120

describe('platzIn – wo der Punkt landet', () => {
  it('über der oberen Hälfte davor, über der unteren dahinter', () => {
    expect(platzIn(9, ZIEL, punkt(22), 110, RECT)).toEqual({
      spalte: 9,
      index: 1,
      vorBeginn: false,
    });
    expect(platzIn(9, ZIEL, punkt(22), 130, RECT)).toEqual({
      spalte: 9,
      index: 2,
      vorBeginn: false,
    });
  });

  it('hinter den letzten Vorlauf-Punkt: noch im Vorlauf; vor den ersten danach: nicht (gleiche Stelle, andere Seite)', () => {
    expect(platzIn(9, ZIEL, punkt(21), 130, RECT)).toEqual({
      spalte: 9,
      index: 1,
      vorBeginn: true,
    });
    expect(platzIn(9, ZIEL, punkt(22), 110, RECT)).toEqual({
      spalte: 9,
      index: 1,
      vorBeginn: false,
    });
  });

  it('ganz vorne vor einen Vorlauf-Punkt: im Vorlauf', () => {
    expect(platzIn(9, ZIEL, punkt(21), 105, RECT)).toEqual({
      spalte: 9,
      index: 0,
      vorBeginn: true,
    });
  });

  it('die freie Fläche der Zelle: ans Ende, nicht im Vorlauf – auch bei leerem Ablauf', () => {
    const flaeche = { art: 'flaeche' as const, spalte: 9 };
    expect(platzIn(9, ZIEL, flaeche, 500, null)).toEqual({ spalte: 9, index: 3, vorBeginn: false });
    expect(platzIn(9, [], flaeche, 500, null)).toEqual({ spalte: 9, index: 0, vorBeginn: false });
  });

  it('ohne Zeiger (Tastatur) davor; ein Punkt, der nicht mehr in der Spalte steht: nirgends', () => {
    expect(platzIn(9, ZIEL, punkt(23), null, RECT)?.index).toBe(2);
    expect(platzIn(9, ZIEL, punkt(99), 110, RECT)).toBeNull();
  });
});

const aktionen = (): AblaufAktionen => ({
  reorder: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve(null)),
  restore: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  setVorBeginn: vi.fn(() => Promise.resolve()),
  setWeggelassen: vi.fn(() => Promise.resolve()),
  add: vi.fn(() => Promise.resolve()),
});

function Liste({ spalte }: { spalte?: number }) {
  const b = useAblaufBearbeiten({
    aktiv: true,
    bereit: true,
    items: ZIEL,
    beginn: '09:00',
    abgeschlossen: false,
    sperrHinweis: 'gesperrt',
    aktionen: aktionen(),
    dienste: [],
    schmal: true,
    ziehen: spalte === undefined ? undefined : { spalte, neuLaden: () => {} },
  });
  return <div data-testid="liste">{b.liste}</div>;
}

function imBereich(platz: Platz | null, spalte: number | null = 9) {
  const angemeldet = new Map<number, () => ZiehSpalte>();
  const wert: BereichWert = {
    anmelden: (s, lies) => {
      angemeldet.set(s, lies);
      return () => angemeldet.delete(s);
    },
    platz,
  };
  render(
    <Bereich.Provider value={wert}>
      <Liste spalte={spalte ?? undefined} />
    </Bereich.Provider>,
  );
  return angemeldet;
}

/** Die Liste als Folge: Titel, „Beginn“ und „STELLE“ für die gestrichelte Stelle. */
function folge(): string[] {
  const liste = screen.getByTestId('liste');
  return [
    ...liste.querySelectorAll(
      '[role="separator"], [data-testid="ablage-stelle"], button[aria-label="Verschieben"]',
    ),
  ].map((el) =>
    el.getAttribute('data-testid') === 'ablage-stelle'
      ? 'STELLE'
      : el.getAttribute('role') === 'separator'
        ? 'Beginn'
        : (el.parentElement?.textContent ?? '').replace(/\s+/g, ' ').trim().split(' ').pop()!,
  );
}

describe('Liste im Zieh-Bereich (Matrix)', () => {
  it('meldet sich mit ihrer Spalte und ihren Punkten an', () => {
    const angemeldet = imBereich(null);
    expect(
      angemeldet
        .get(9)?.()
        .items.map((i) => i.title),
    ).toEqual(['Gebet', 'Way Maker', 'Segen']);
  });

  it('ohne `ziehen` meldet sie sich nicht an (Termin-Ansicht, Handy)', () => {
    expect(imBereich(null, null).size).toBe(0);
  });

  it('die Stelle am Beginn-Balken: davor, wenn der Punkt in den Vorlauf kommt, sonst dahinter', () => {
    imBereich({ spalte: 9, index: 1, vorBeginn: true });
    expect(folge()).toEqual(['Gebet', 'STELLE', 'Beginn', 'Maker', 'Segen']);
    cleanup();
    imBereich({ spalte: 9, index: 1, vorBeginn: false });
    expect(folge()).toEqual(['Gebet', 'Beginn', 'STELLE', 'Maker', 'Segen']);
  });

  it('am Ende und mitten drin; die Stelle einer anderen Spalte nicht', () => {
    imBereich({ spalte: 9, index: 3, vorBeginn: false });
    expect(folge()).toEqual(['Gebet', 'Beginn', 'Maker', 'Segen', 'STELLE']);
    cleanup();
    imBereich({ spalte: 9, index: 2, vorBeginn: false });
    expect(folge()).toEqual(['Gebet', 'Beginn', 'Maker', 'STELLE', 'Segen']);
    cleanup();
    imBereich({ spalte: 4, index: 2, vorBeginn: false });
    expect(folge()).not.toContain('STELLE');
  });
});
