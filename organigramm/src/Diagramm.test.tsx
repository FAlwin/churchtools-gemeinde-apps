// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { anfangsOffen, anordnen, sichtbarerBaum } from '@shared/organigramm/ansichten';
import type { Knoten } from '@shared/organigramm/gruppen';
import { sichtFarbe, TAILWIND_500 } from '@shared/organigramm/farbe';
import type { PersonenWahl } from '@shared/organigramm/personen';
import { anfang, ganz } from './leinwand';
import { Diagramm } from './Diagramm';
import type { KastenInhalt } from './kastenPersonen';
import { messung, NAME_NACH_KACHEL } from './messung';

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
// So misst das Diagramm – der Erzeuger selbst (mit der gemockten Textbreite), keine nachgebaute Formel.
const { breite } = messung({ name: 'Lato, sans-serif', stand: 0 });
/** Typfarben wie in der Test-Instanz: Dienste lime. */
const FARBE = sichtFarbe(new Map([[2, 'lime']]));
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
  const r = render(
    <Diagramm art={art} sicht={s} onGruppe={onGruppe} onUmklappen={onUmklappen} farbe={FARBE} />,
  );
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
        farbe={FARBE}
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
    rerender(
      <Diagramm
        art="oben"
        sicht={auf}
        onGruppe={onGruppe}
        onUmklappen={onUmklappen}
        farbe={FARBE}
      />,
    );
    expect(screen.getByRole('button', { name: 'Stream' })).toBeTruthy();
    expect(blick()).toBe(gezoomt);
    rerender(
      <Diagramm
        art="mindmap"
        sicht={auf}
        onGruppe={onGruppe}
        onUmklappen={onUmklappen}
        farbe={FARBE}
      />,
    );
    expect(blick()).toBe(alsText(anfang(anordnen('mindmap', auf, breite), FLAECHE)));
    const ab = sichtbarerBaum(BAUM, 'ECG', '10', new Set(['10']));
    fireEvent.click(screen.getByRole('button', { name: 'Vergrößern' }));
    rerender(
      <Diagramm
        art="mindmap"
        sicht={ab}
        onGruppe={onGruppe}
        onUmklappen={onUmklappen}
        farbe={FARBE}
      />,
    );
    expect(blick()).toBe(alsText(anfang(anordnen('mindmap', ab, breite), FLAECHE)));
  });

  it('eine andere Personen-Wahl fängt neu an (die Kästchen ändern ihre Größe); nachgeladene Mitglieder allein nicht (O7b-6)', () => {
    const inhalt = (): KastenInhalt => ({
      art: 'rollen',
      gruppen: [{ rolle: 'Leiter', namen: ['Alwin Friesen', 'Bea Berg'], nurZahl: false }],
    });
    const { rerender, onGruppe, onUmklappen } = zeigen();
    const mit = (wahl: PersonenWahl, i: () => KastenInhalt) => (
      <Diagramm
        art="oben"
        sicht={sicht()}
        onGruppe={onGruppe}
        onUmklappen={onUmklappen}
        farbe={FARBE}
        personen={{ wahl, inhalt: i }}
      />
    );
    rerender(mit('rollen', inhalt));
    const m = messung({ name: 'Lato, sans-serif', stand: 0 }, inhalt);
    expect(blick()).toBe(alsText(anfang(anordnen('oben', sicht(), m.breite, m.hoehe), FLAECHE)));
    fireEvent.click(screen.getByRole('button', { name: 'Vergrößern' }));
    const gezoomt = blick();
    // Neue Mitglieder (ein neuer `inhalt`) messen die Kästchen neu, lassen den Blick aber stehen.
    rerender(mit('rollen', () => inhalt()));
    expect(blick()).toBe(gezoomt);
    rerender(mit('alle', inhalt));
    expect(blick()).not.toBe(gezoomt);
    expect(blick()).toBe(alsText(anfang(anordnen('oben', sicht(), m.breite, m.hoehe), FLAECHE)));
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
    // Die Gruppe darunter: erst der Buchstabe ihrer Kachel (O7b-8), dann der gekürzte Name.
    expect(texte[1]).toBe('E');
    expect(texte[2]).toMatch(/…$/);
  });

  it('vor jedem Namen die Kachel in der Gruppenfarbe (O7b-8) – nicht bei der Gemeinde; der Name steht dahinter', () => {
    zeigen('oben', sicht(new Set([...anfangsOffen(BAUM), '10/7'])));
    const diagramm = screen.getByRole('group', { name: 'Organigramm' });
    const kaesten = [...diagramm.querySelectorAll('g')].filter((g) =>
      g.querySelector(':scope > title'),
    );
    for (const k of kaesten) {
      const name = k.querySelector('title')!.textContent;
      const [kasten, kachel] = k.querySelectorAll('rect');
      if (name === 'ECG') {
        expect(kachel).toBeUndefined();
        continue;
      }
      expect(kachel.style.fill, name).toBe(TAILWIND_500.lime); // die Typfarbe der Dienste
      const [buchstabe, text] = k.querySelectorAll('text');
      expect(buchstabe.textContent).toBe(name[0]);
      // Der Name beginnt hinter der Kachel (links ausgerichtet), nicht mehr in der Mitte des Kästchens.
      expect(Number(text.getAttribute('x'))).toBe(
        Number(kasten.getAttribute('x')) + NAME_NACH_KACHEL,
      );
      expect(Number(text.getAttribute('x'))).toBeGreaterThan(
        Number(kachel.getAttribute('x')) + Number(kachel.getAttribute('width')),
      );
      expect(Number(kachel.getAttribute('x'))).toBeGreaterThan(Number(kasten.getAttribute('x')));
    }
  });

  it('kein +/− liegt auf einer Kachel – in allen drei Ansichten, mit und ohne Personen (Demo 29.10.2026: 1 bzw. 2 px)', () => {
    const inhalt = (): KastenInhalt => ({
      art: 'rollen',
      gruppen: [{ rolle: 'Leiter', namen: ['Alwin Friesen'], nurZahl: false }],
    });
    const auf = sicht(new Set([...anfangsOffen(BAUM), '10/7']));
    for (const art of ['oben', 'links', 'mindmap'] as const)
      for (const personen of [undefined, { wahl: 'rollen' as const, inhalt }]) {
        const { unmount } = render(
          <Diagramm
            art={art}
            sicht={auf}
            onGruppe={vi.fn()}
            onUmklappen={vi.fn()}
            farbe={FARBE}
            personen={personen}
          />,
        );
        const svg = screen.getByRole('group', { name: 'Organigramm' });
        const kreise = [...svg.querySelectorAll('circle')].map((c) => ({
          x: Number(c.getAttribute('cx')),
          y: Number(c.getAttribute('cy')),
          r: Number(c.getAttribute('r')),
        }));
        const kacheln = [...svg.querySelectorAll('rect')]
          .filter((r) => r.style.fill)
          .map((r) => ({
            x: Number(r.getAttribute('x')),
            y: Number(r.getAttribute('y')),
            w: Number(r.getAttribute('width')),
          }));
        expect(kacheln.length).toBeGreaterThan(3);
        for (const k of kacheln)
          for (const c of kreise) {
            // Abstand vom Mittelpunkt des +/− zum nächsten Punkt der Kachel – mindestens der Halbmesser.
            const nx = Math.max(k.x, Math.min(c.x, k.x + k.w));
            const ny = Math.max(k.y, Math.min(c.y, k.y + k.w));
            expect(
              Math.hypot(nx - c.x, ny - c.y),
              `${art} ${personen ? 'mit' : 'ohne'}`,
            ).toBeGreaterThanOrEqual(c.r);
          }
        unmount();
      }
  });

  it('lange Namen werden mit … gekürzt, der volle Name steht im Titel', () => {
    const lang = [g(1, 'Ein ausgesprochen langer Gruppenname, der nicht passt')];
    zeigen('oben', sichtbarerBaum(lang, 'ECG', null, anfangsOffen(lang)));
    const k = screen.getByRole('button', {
      name: 'Ein ausgesprochen langer Gruppenname, der nicht passt',
    });
    // Der erste Text ist der Buchstabe der Kachel (O7b-8), dann der Name.
    expect(k.querySelectorAll('text')[1].textContent).toMatch(/…$/);
    expect(k.querySelector('title')!.textContent).toBe(
      'Ein ausgesprochen langer Gruppenname, der nicht passt',
    );
  });
});
