// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ErweiterungsRahmen } from './ErweiterungsSeite';
import { SchwebePlus } from '../bedienung/SchwebePlus';

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

  /**
   * **Das schwebende Plus liegt nie im Rollbereich** (B8a, 20.11.2026): In „Wann kann ich?“ des Dienstplaners rief die Seite
   * es in einer Karte mit `overflow: hidden` auf, und es landete am Kartenende unter dem Bildschirmrand (y≈1000 bei 844 px).
   * Der Rahmen reicht seine Fläche außerhalb des Rollbereichs herein; das Plus zeichnet sich dorthin.
   */
  it('das schwebende Plus steht auf der Fläche neben dem Rollbereich, nicht im Inhalt', () => {
    render(
      <ErweiterungsRahmen unten={<nav>Leiste</nav>}>
        <section style={{ overflow: 'hidden' }} data-testid="karte">
          <SchwebePlus label="Zeitraum eintragen" onClick={() => {}} />
        </section>
      </ErweiterungsRahmen>,
    );
    const plus = screen.getByRole('button', { name: 'Zeitraum eintragen' });
    const rolle = screen.getByTestId('karte').closest('main')!.parentElement!;
    expect(rolle.contains(plus)).toBe(false);
    // Es hängt an der Fläche (`position: relative`), die auch den Rollbereich trägt – nicht an der Leiste darunter.
    const flaeche = rolle.parentElement!;
    expect(plus.parentElement).toBe(flaeche);
    expect(screen.getByText('Leiste').contains(plus)).toBe(false);
  });
});
