// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ErweiterungsRahmen } from './ErweiterungsSeite';

/**
 * **Der Rahmen bleibt derselbe, mit und ohne Leiste unten** (E6b-1, 30.10.2026). Vorher gab es ohne `unten` nur den
 * Rollbereich, mit `unten` zwei Hüllen mehr – wechselte die Breite über die Handy-Grenze (Handy quer drehen), baute
 * React die ganze Seite neu, und offene Fenster („Ablauf zeigen“, Punkt-Fenster) gingen zu.
 */
afterEach(cleanup);

function Zaehler() {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>gezählt {n}</button>;
}

describe('ErweiterungsRahmen', () => {
  it('mit und ohne Leiste: der Inhalt behält seinen Zustand', () => {
    const { rerender } = render(
      <ErweiterungsRahmen>
        <Zaehler />
      </ErweiterungsRahmen>,
    );
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('gezählt 2');
    rerender(
      <ErweiterungsRahmen unten={<nav>Leiste</nav>}>
        <Zaehler />
      </ErweiterungsRahmen>,
    );
    expect(screen.getByText('Leiste')).toBeTruthy();
    expect(screen.getByRole('button').textContent).toBe('gezählt 2');
    rerender(
      <ErweiterungsRahmen>
        <Zaehler />
      </ErweiterungsRahmen>,
    );
    expect(screen.getByRole('button').textContent).toBe('gezählt 2');
  });
});
