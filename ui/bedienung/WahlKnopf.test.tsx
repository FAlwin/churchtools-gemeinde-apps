// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WahlKnopf } from './WahlKnopf';

/** „Sortieren“ in den To-Dos (Protokolle): am Handy nur das Symbol, und das Menü bleibt im Bild (18.11.2026). */

const OPTIONEN = [
  { wert: 'dringlichkeit', text: 'Dringlichkeit' },
  { wert: 'datum', text: 'Bis-Datum' },
] as const;

const knopf = (wert: 'dringlichkeit' | 'datum' = 'dringlichkeit') =>
  render(
    <WahlKnopf
      titel="Sortieren"
      icon="sortieren"
      optionen={OPTIONEN}
      wert={wert}
      vorgabe="dringlichkeit"
      onWahl={() => {}}
    />,
  );

afterEach(() => vi.restoreAllMocks());

describe('WahlKnopf', () => {
  it('das Wort steht im ausblendbaren Teil (`text`) – am Handy bleibt nur das Symbol, statt dass es überläuft', () => {
    knopf();
    expect(screen.getByText('Sortieren').className).toMatch(/text/);
    knopf('datum');
    expect(screen.getByText('Bis-Datum').className).toMatch(/text/);
  });

  it('ragt das Menü links aus dem Bild, rückt es nach rechts bis an den Rand (375 px breit, gemessen 18.11.2026)', () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(375);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: -42,
      right: 188,
      width: 230,
      top: 0,
      bottom: 200,
      height: 200,
      x: -42,
      y: 0,
      toJSON: () => ({}),
    });
    knopf();
    fireEvent.click(screen.getByRole('button', { name: 'Sortieren: Dringlichkeit' }));
    expect(screen.getByRole('dialog', { name: 'Sortieren' }).style.right).toBe('-58px');
  });
});
