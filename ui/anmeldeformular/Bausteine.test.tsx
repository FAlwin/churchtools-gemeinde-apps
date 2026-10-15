// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { EMPFOHLEN } from '@shared/anmeldung/baukasten';
import type { Antwort } from '@shared/anmeldung/formular';
import { unterschriftLesen } from '@shared/anmeldung/unterschrift';
import { ErziehungsEingabe, UnterschriftEingabe } from './Bausteine';

const ELTERN = EMPFOHLEN.find((x) => x.id === 'eltern')!.feld;
const SIGN = EMPFOHLEN.find((x) => x.id === 'sign')!.feld;

let handy = false;
beforeEach(() => {
  handy = false;
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return handy;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  // jsdom zeichnet nicht (kein Canvas) – die Striche zählen, nicht das Bild.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  // jsdom misst nichts – die Zeichenfläche ist hier 600 × 300 Pixel groß, also 1:1 die gespeicherte Fläche.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 600,
    height: 300,
    right: 600,
    bottom: 300,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Hält den Wert wie das Formular und meldet jeden neuen. */
function Halter({
  art,
  start,
  melde,
  fehler = [],
}: {
  art: 'eltern' | 'sign';
  start?: Antwort;
  melde: (w: Antwort) => void;
  fehler?: string[];
}) {
  const [w, setW] = useState<Antwort>(start);
  const Eingabe = art === 'eltern' ? ErziehungsEingabe : UnterschriftEingabe;
  return (
    <Eingabe
      feld={art === 'eltern' ? ELTERN : SIGN}
      wert={w}
      onWert={(neu) => {
        setW(neu);
        melde(neu);
      }}
      pfad={`anmeldung.${art}`}
      fehler={fehler}
      gesperrt={false}
      zusatz={null}
    />
  );
}

/**
 * Ein Strich mit der Maus/dem Finger über die Zeichenfläche. jsdom kennt `PointerEvent` ohne Koordinaten –
 * deshalb `MouseEvent` mit dem Namen des Pointer-Ereignisses (React hört auf den Namen).
 */
function strich(canvas: Element, punkte: [number, number][]) {
  const los = (typ: string, [x, y]: [number, number]) =>
    fireEvent(canvas, new MouseEvent(typ, { clientX: x, clientY: y, bubbles: true }));
  los('pointerdown', punkte[0]);
  for (const p of punkte.slice(1)) los('pointermove', p);
  los('pointerup', punkte[punkte.length - 1]);
}

describe('Erziehungsberechtigte (A6-2b)', () => {
  it('erste Person, zweite freiwillig dazu und wieder weg, Häkchen', () => {
    const melde = vi.fn();
    render(<Halter art="eltern" melde={melde} />);
    fireEvent.change(screen.getByLabelText(/^Vorname/), { target: { value: 'Erna' } });
    fireEvent.change(screen.getByLabelText(/^Telefon \(während/), { target: { value: '0151' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Zweite erziehungsberechtigte Person' }));
    expect(screen.getAllByLabelText(/^Vorname/)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Zweite erziehungsberechtigte/ })).toBeNull();
    fireEvent.change(screen.getAllByLabelText(/^Vorname/)[1], { target: { value: 'Tom' } });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(melde).toHaveBeenLastCalledWith({
      personen: [
        { vor: 'Erna', nach: '', tel: '0151' },
        { vor: 'Tom', nach: '', tel: '' },
      ],
      einverstanden: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    expect(screen.getAllByLabelText(/^Vorname/)).toHaveLength(1);
    expect(melde).toHaveBeenLastCalledWith({
      personen: [{ vor: 'Erna', nach: '', tel: '0151' }],
      einverstanden: true,
    });
  });

  it('zeigt die Fehler aus der Prüfung an den richtigen Stellen', () => {
    render(
      <Halter
        art="eltern"
        melde={() => {}}
        fehler={['anmeldung.eltern.0.nach', 'anmeldung.eltern.0.tel', 'anmeldung.eltern.ok']}
      />,
    );
    expect(screen.getByText('Bitte Nachnamen eintragen.')).toBeTruthy();
    expect(screen.queryByText('Bitte Vornamen eintragen.')).toBeNull();
    expect(screen.getByText('Bitte eine Telefonnummer eintragen.')).toBeTruthy();
    expect(screen.getByText('Bitte ankreuzen.')).toBeTruthy();
  });
});

describe('Unterschrift (A6-2b)', () => {
  it('am Computer: direkt im Formular zeichnen; jeder Strich wird gespeichert; Löschen leert', () => {
    const melde = vi.fn();
    render(<Halter art="sign" melde={melde} />);
    const flaeche = screen.getByLabelText('Hier unterschreiben');
    strich(flaeche, [
      [10, 10],
      [100, 80],
      [200, 20],
    ]);
    const erster = melde.mock.lastCall![0] as { striche: string };
    expect(unterschriftLesen(erster.striche)).toEqual([
      [
        [10, 10],
        [100, 80],
        [200, 20],
      ],
    ]);
    strich(flaeche, [
      [300, 150],
      [350, 160],
    ]);
    const beide = melde.mock.lastCall![0] as { striche: string };
    expect(unterschriftLesen(beide.striche)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(melde).toHaveBeenLastCalledWith({ striche: '' });
  });

  it('am Handy: Tippen öffnet das Vollbild; „Fertig“ übernimmt, die Vorschau zeigt die Unterschrift', () => {
    handy = true;
    const melde = vi.fn();
    render(<Halter art="sign" melde={melde} />);
    // Im Formular keine Zeichenfläche – nur das Feld zum Antippen.
    expect(screen.queryByLabelText('Hier unterschreiben')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Tippen zum Unterschreiben/ }));
    const dialog = screen.getByRole('dialog', { name: 'Unterschreiben' });
    strich(within(dialog).getByLabelText('Hier unterschreiben'), [
      [50, 50],
      [250, 200],
    ]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fertig' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('img', { name: 'Unterschrift' })).toBeTruthy();
    expect(
      unterschriftLesen((melde.mock.lastCall![0] as { striche: string }).striche),
    ).toHaveLength(1);
  });

  it('am Handy: „Abbrechen“ stellt die Unterschrift von vorher wieder her', () => {
    handy = true;
    const melde = vi.fn();
    render(<Halter art="sign" melde={melde} start={{ striche: '' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Tippen zum Unterschreiben/ }));
    const dialog = screen.getByRole('dialog');
    strich(within(dialog).getByLabelText('Hier unterschreiben'), [
      [50, 50],
      [250, 200],
    ]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(melde).toHaveBeenLastCalledWith({ striche: '' });
    expect(screen.getByRole('button', { name: /Tippen zum Unterschreiben/ })).toBeTruthy();
  });

  it('Pflicht und leer → „Bitte unterschreiben.“', () => {
    render(<Halter art="sign" melde={() => {}} fehler={['anmeldung.sign']} />);
    expect(screen.getByText('Bitte unterschreiben.')).toBeTruthy();
  });
});
