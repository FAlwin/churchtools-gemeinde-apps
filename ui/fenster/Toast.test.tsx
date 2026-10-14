// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BEREICH_ATTRIBUT } from '../erweiterung/cssBereich';
import { Toast } from './Toast';

afterEach(cleanup);

/**
 * Der Hinweis hängt an `body` (12.10.2026): Mitten im Inhalt gezeichnet, saß er oben statt unten, weil
 * ein Vorfahr per `transform` verschoben ist (Ziehen zum Aktualisieren). Die Lage selbst kann jsdom
 * nicht messen – geprüft wird, WO er hängt und dass er in der Erweiterung unsere Stile bekommt.
 */
describe('Toast', () => {
  it('hängt direkt an body, nicht im (verschobenen) Inhalt', () => {
    render(
      <div style={{ transform: 'translateY(0px)' }}>
        <Toast message="Ablauf aktualisiert" />
      </div>,
    );
    const hinweis = screen.getByRole('status');
    expect(hinweis.parentElement).toBe(document.body);
    expect(hinweis.hasAttribute(BEREICH_ATTRIBUT)).toBe(true);
  });

  it('ohne Text nichts', () => {
    render(<Toast message={null} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
