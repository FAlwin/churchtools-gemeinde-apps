// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { anfangsOffen, anordnen, sichtbarerBaum } from '@shared/organigramm/ansichten';
import type { Knoten } from '@shared/organigramm/gruppen';
import { anfang, ganz } from './leinwand';
import { Diagramm } from './Diagramm';

// jsdom hat keine Zeichenfläche zum Messen – geschätzt wie im Browser ohne Canvas.
vi.mock('./textBreite', () => ({ textBreite: (t: string) => t.length * 8 }));

const g = (id: number, name: string, kinder: Knoten[] = []): Knoten => ({
  gruppe: { id, name, typId: 2, statusId: 1, farbe: null },
  kinder,
});
const BAUM = [
  g(10, 'Gottesdienst', [g(7, 'Technik', [g(12, 'Stream'), g(15, 'Ton')]), g(8, 'Predigt')]),
  g(47, 'Café'),
];
const sicht = (offen = anfangsOffen(BAUM)) => sichtbarerBaum(BAUM, 'ECG', null, offen);
// So misst das Diagramm (gemockte Textbreite + Rand, zwischen 72 und 220 – die Spitze bis 320).
const breite = (k: { name: string; ebene: number }) =>
  Math.min(k.ebene === 0 ? 320 : 220, Math.max(72, Math.ceil(k.name.length * 8) + 28));
const FLAECHE = { breite: 800, hoehe: 600 };

const blick = () =>
  screen.getByRole('group', { name: 'Organigramm' }).querySelector('g')!.getAttribute('transform');
const alsText = (b: { s: number; x: number; y: number }) =>
  `translate(${b.x} ${b.y}) scale(${b.s})`;

/** jsdom kennt kein `PointerEvent` – ohne dieses kämen Koordinaten und Zeiger-Nummer beim Ziehen nicht an. */
class ZeigerEreignis extends MouseEvent {
  pointerId: number;
  constructor(typ: string, init: PointerEventInit = {}) {
    super(typ, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

beforeEach(() => {
  vi.stubGlobal('PointerEvent', ZeigerEreignis);
  // jsdom misst nichts – die Fläche des Diagramms ist hier 800 × 600.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    x: 0,
    y: 0,
    width: FLAECHE.breite,
    height: FLAECHE.hoehe,
    right: FLAECHE.breite,
    bottom: FLAECHE.hoehe,
    toJSON: () => ({}),
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function zeigen(art: 'oben' | 'links' | 'mindmap' = 'oben', s = sicht()) {
  const onGruppe = vi.fn();
  const onUmklappen = vi.fn();
  const r = render(<Diagramm art={art} sicht={s} onGruppe={onGruppe} onUmklappen={onUmklappen} />);
  return { onGruppe, onUmklappen, ...r };
}

describe('Diagramm (O7b-5)', () => {
  it('„klickbar“ wählt, welche Kästchen etwas öffnen – die anderen sind keine Knöpfe', () => {
    render(
      <Diagramm
        art="oben"
        sicht={sicht()}
        onGruppe={vi.fn()}
        onUmklappen={vi.fn()}
        klickbar={(id) => id === 10}
      />,
    );
    expect(screen.getByRole('button', { name: 'Gottesdienst' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Café' })).toBeNull();
  });

  it('„Ganz zeigen“ misst den Streifen der Knöpfe und lässt ihn frei', () => {
    const ganzeFlaeche = {
      left: 0,
      top: 0,
      x: 0,
      y: 0,
      width: FLAECHE.breite,
      height: FLAECHE.hoehe,
      right: FLAECHE.breite,
      bottom: FLAECHE.hoehe,
      toJSON: () => ({}),
    };
    vi.mocked(Element.prototype.getBoundingClientRect).mockImplementation(function (this: Element) {
      // Die Knopfleiste: unten in der Fläche, 50 px über dem Rand.
      return this.querySelector?.('[aria-label="Vergrößern"]')
        ? { ...ganzeFlaeche, top: 550, y: 550, height: 38, bottom: 588 }
        : ganzeFlaeche;
    });
    zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Ganz zeigen' }));
    expect(blick()).toBe(
      alsText(ganz(anordnen('oben', sicht(), breite).rahmen, { ...FLAECHE, unten: 50 })),
    );
  });
});

describe('Diagramm (O7b-3)', () => {
  it('jede sichtbare Gruppe ein Kästchen zum Klicken – die Gemeinde selbst nicht', () => {
    zeigen();
    for (const n of ['Gottesdienst', 'Technik', 'Predigt', 'Café'])
      expect(screen.getByRole('button', { name: n })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Stream' })).toBeNull(); // Technik ist zu
    expect(screen.queryByRole('button', { name: 'ECG' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Organigramm' }).textContent).toContain('ECG');
  });

  it('Klick und Enter öffnen die Gruppe', () => {
    const { onGruppe } = zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Predigt' }));
    expect(onGruppe).toHaveBeenLastCalledWith(8);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Café' }), { key: 'Enter' });
    expect(onGruppe).toHaveBeenLastCalledWith(47);
  });

  it('der Schalter zeigt die Zahl der versteckten Untergruppen, klappt über den Pfad – auch mit der Leertaste', () => {
    const { onUmklappen } = zeigen();
    const technik = screen.getByRole('button', { name: 'Technik aufklappen' });
    expect(technik.getAttribute('aria-expanded')).toBe('false');
    expect(technik.textContent).toBe('2');
    fireEvent.click(technik);
    expect(onUmklappen).toHaveBeenLastCalledWith('10/7');
    const gd = screen.getByRole('button', { name: 'Gottesdienst zuklappen' });
    expect(gd.textContent).toBe('−');
    fireEvent.keyDown(gd, { key: ' ' });
    expect(onUmklappen).toHaveBeenLastCalledWith('10');
  });

  it('Ziehen verschiebt – und ein Ziehen, das auf einem Kästchen beginnt, öffnet es nicht', () => {
    const { onGruppe } = zeigen();
    const flaeche = screen.getByRole('group', { name: 'Organigramm' });
    const vorher = blick();
    const kaestchen = screen.getByRole('button', { name: 'Predigt' });
    fireEvent.pointerDown(kaestchen, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(flaeche, { pointerId: 1, clientX: 130, clientY: 90 });
    fireEvent.pointerUp(flaeche, { pointerId: 1, clientX: 130, clientY: 90 });
    fireEvent.click(kaestchen);
    expect(onGruppe).not.toHaveBeenCalled();
    const b = anfang(anordnen('oben', sicht(), breite), FLAECHE);
    expect(vorher).toBe(alsText(b));
    // Die erste Bewegung (über 4 px) zählt schon mit: 30 nach rechts, 10 nach oben.
    expect(blick()).toBe(alsText({ ...b, x: b.x + 30, y: b.y - 10 }));
  });

  it('lässt sich der Zeiger nicht festhalten, wird trotzdem gezogen (Test-Instanz 28.10.2026)', () => {
    const { onGruppe } = zeigen();
    const flaeche = screen.getByRole('group', { name: 'Organigramm' });
    (flaeche as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {
      throw new DOMException('Kein aktiver Zeiger', 'NotFoundError');
    };
    const vorher = blick();
    const kaestchen = screen.getByRole('button', { name: 'Predigt' });
    fireEvent.pointerDown(kaestchen, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(flaeche, { pointerId: 1, clientX: 130, clientY: 100 });
    fireEvent.pointerUp(flaeche, { pointerId: 1, clientX: 130, clientY: 100 });
    fireEvent.click(kaestchen);
    expect(blick()).not.toBe(vorher);
    expect(onGruppe).not.toHaveBeenCalled();
  });

  it('ein Wackeln unter 4 px ist noch ein Klick', () => {
    const { onGruppe } = zeigen();
    const kaestchen = screen.getByRole('button', { name: 'Predigt' });
    fireEvent.pointerDown(kaestchen, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(kaestchen, { pointerId: 1, clientX: 102, clientY: 101 });
    fireEvent.pointerUp(kaestchen, { pointerId: 1, clientX: 102, clientY: 101 });
    fireEvent.click(kaestchen);
    expect(onGruppe).toHaveBeenCalledWith(8);
  });

  it('Mausrad und + vergrößern, − verkleinert, „Ganz zeigen“ passt alles ein', () => {
    zeigen();
    const s = () => Number(/scale\(([\d.]+)\)/.exec(blick()!)![1]);
    const s0 = s();
    fireEvent.wheel(screen.getByRole('group', { name: 'Organigramm' }), {
      deltaY: -100,
      clientX: 400,
      clientY: 300,
    });
    expect(s()).toBeGreaterThan(s0);
    const s1 = s();
    fireEvent.click(screen.getByRole('button', { name: 'Vergrößern' }));
    expect(s()).toBeCloseTo(s1 * 1.25);
    fireEvent.click(screen.getByRole('button', { name: 'Verkleinern' }));
    expect(s()).toBeCloseTo(s1);
    fireEvent.click(screen.getByRole('button', { name: 'Ganz zeigen' }));
    expect(blick()).toBe(alsText(ganz(anordnen('oben', sicht(), breite).rahmen, FLAECHE)));
  });

  it('auf- und zuklappen lässt den Blick stehen; eine neue Ansicht oder Spitze fängt neu an', () => {
    const { rerender, onGruppe, onUmklappen } = zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Vergrößern' }));
    const gezoomt = blick();
    const auf = sicht(new Set([...anfangsOffen(BAUM), '10/7']));
    rerender(<Diagramm art="oben" sicht={auf} onGruppe={onGruppe} onUmklappen={onUmklappen} />);
    expect(screen.getByRole('button', { name: 'Stream' })).toBeTruthy();
    expect(blick()).toBe(gezoomt);
    rerender(<Diagramm art="mindmap" sicht={auf} onGruppe={onGruppe} onUmklappen={onUmklappen} />);
    expect(blick()).toBe(alsText(anfang(anordnen('mindmap', auf, breite), FLAECHE)));
    const ab = sichtbarerBaum(BAUM, 'ECG', '10', new Set(['10']));
    fireEvent.click(screen.getByRole('button', { name: 'Vergrößern' }));
    rerender(<Diagramm art="mindmap" sicht={ab} onGruppe={onGruppe} onUmklappen={onUmklappen} />);
    expect(blick()).toBe(alsText(anfang(anordnen('mindmap', ab, breite), FLAECHE)));
  });

  it('mit der Tastatur zu einem Kästchen außerhalb des Blicks → dorthin geschoben', () => {
    zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Ganz zeigen' }));
    // Weit weg schieben: alles liegt links außerhalb.
    const flaeche = screen.getByRole('group', { name: 'Organigramm' });
    fireEvent.pointerDown(flaeche, { pointerId: 1, clientX: 700, clientY: 300 });
    fireEvent.pointerMove(flaeche, { pointerId: 1, clientX: -2000, clientY: 300 });
    fireEvent.pointerUp(flaeche, { pointerId: 1 });
    const weg = blick();
    fireEvent.focus(screen.getByRole('button', { name: 'Café' }));
    expect(blick()).not.toBe(weg);
    const m = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/.exec(blick()!)!;
    const a = anordnen('oben', sicht(), breite);
    const cafe = a.knoten.find((k) => k.knoten.name === 'Café')!;
    const mitte = (cafe.x + cafe.breite / 2) * Number(m[3]) + Number(m[1]);
    expect(mitte).toBeCloseTo(FLAECHE.breite / 2);
  });

  it('der lange Name der Gemeinde an der Spitze bleibt ganz – als Gruppe darunter würde er gekürzt (Test-Instanz 28.10.2026)', () => {
    const name = 'Evangeliumschristen- Gemeinde e.V.';
    const baum = [g(1, name)];
    zeigen('oben', sichtbarerBaum(baum, name, null, anfangsOffen(baum)));
    const texte = [
      ...screen.getByRole('group', { name: 'Organigramm' }).querySelectorAll('text'),
    ].map((t) => t.textContent);
    expect(texte[0]).toBe(name);
    expect(texte[1]).toMatch(/…$/);
  });

  it('lange Namen werden mit … gekürzt, der volle Name steht im Titel', () => {
    const lang = [g(1, 'Ein ausgesprochen langer Gruppenname, der nicht passt')];
    zeigen('oben', sichtbarerBaum(lang, 'ECG', null, anfangsOffen(lang)));
    const k = screen.getByRole('button', {
      name: 'Ein ausgesprochen langer Gruppenname, der nicht passt',
    });
    expect(k.querySelector('text')!.textContent).toMatch(/…$/);
    expect(k.querySelector('title')!.textContent).toBe(
      'Ein ausgesprochen langer Gruppenname, der nicht passt',
    );
  });
});
