// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiedSucheKopf } from './LiedSucheKopf';

/**
 * Das eine Suchfeld (#378, seit 03.09.2026 ohne Umschalter).
 *
 * Geprüft wird, was der Nutzer anfassen kann: Der Platzhalter, und was die Eingabetaste tut – nämlich
 * NUR dort etwas, wo es SongSelect gibt. Die Regeln, wann eine Quelle gefragt wird, liegen in
 * `useLiedSuche` und werden dort geprüft.
 */
const onEingabe = vi.fn();
const onSongSelectSuchen = vi.fn();

beforeEach(() => vi.clearAllMocks());

describe('LiedSucheKopf', () => {
  it('ein Platzhalter für alle Stellen – Lied oder Autor', () => {
    render(<LiedSucheKopf eingabe="" onEingabe={onEingabe} />);
    expect(screen.getByPlaceholderText('Lied oder Autor suchen…')).toBeTruthy();
  });

  it('meldet jede Eingabe', () => {
    render(<LiedSucheKopf eingabe="" onEingabe={onEingabe} />);
    fireEvent.change(screen.getByPlaceholderText(/Lied oder Autor/), { target: { value: 'Gna' } });
    expect(onEingabe).toHaveBeenCalledWith('Gna');
  });

  it('die Eingabetaste schickt an SongSelect, wenn es den Weg gibt', () => {
    render(
      <LiedSucheKopf
        eingabe="Treu"
        onEingabe={onEingabe}
        onSongSelectSuchen={onSongSelectSuchen}
      />,
    );
    fireEvent.keyDown(screen.getByPlaceholderText(/Lied oder Autor/), { key: 'Enter' });
    expect(onSongSelectSuchen).toHaveBeenCalledTimes(1);
  });

  it('ohne den Weg tut die Eingabetaste NICHTS', () => {
    // Liederheft und „Lied verknüpfen": Die Bibliothek ist beim Tippen längst gefiltert, es gibt nichts
    // abzuschicken.
    render(<LiedSucheKopf eingabe="Treu" onEingabe={onEingabe} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/Lied oder Autor/), { key: 'Enter' });
    expect(onSongSelectSuchen).not.toHaveBeenCalled();
  });

  it('es gibt keinen Umschalter und keinen Such-Knopf mehr', () => {
    // Gegenprobe zur Entscheidung vom 03.09.2026: ein Feld, sonst nichts.
    render(
      <LiedSucheKopf
        eingabe="Treu"
        onEingabe={onEingabe}
        onSongSelectSuchen={onSongSelectSuchen}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});

/**
 * Autofokus nur mit Maus (Alwin am iPad, 27.11.2026): Am Finger-Gerät ginge beim Öffnen von „Lied verknüpfen“ sofort die
 * Tastatur auf und verdeckte die Liederliste. `matchMedia` ist in jsdom nicht vorhanden – hier mit der Abfrage
 * `(pointer: coarse)` nachgestellt.
 */
describe('LiedSucheKopf – Autofokus', () => {
  const fokusMit = (grob: boolean) => {
    vi.stubGlobal('matchMedia', (abfrage: string) => ({
      matches: abfrage === '(pointer: coarse)' ? grob : false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    render(<LiedSucheKopf eingabe="" onEingabe={onEingabe} autoFocus />);
    return document.activeElement === screen.getByPlaceholderText(/Lied oder Autor/);
  };
  afterEach(() => vi.unstubAllGlobals());

  it('am Rechner (feiner Zeiger) steht der Cursor sofort im Feld', () => {
    expect(fokusMit(false)).toBe(true);
  });

  it('am iPad/Handy (Finger) bleibt der Fokus draußen – die Tastatur öffnet erst der Tipp', () => {
    expect(fokusMit(true)).toBe(false);
  });

  it('ohne autoFocus-Wunsch nie ein Fokus', () => {
    render(<LiedSucheKopf eingabe="" onEingabe={onEingabe} />);
    expect(document.activeElement).toBe(document.body);
  });
});
