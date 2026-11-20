// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SchwebePlus } from './SchwebePlus';
import { SchwebeFlaeche } from './SchwebeFlaeche';

afterEach(cleanup);

/**
 * **Das grüne Plus am Handy** (R3/E10/E14, B8a): grün wie `KopfKnopf neu`, und es schwebt dort, wo die Seite es hinhängt –
 * auch wenn der Aufrufer es tief in einem Kasten mit `overflow: hidden` aufruft.
 *
 * Der Fehler vom 20.11.2026: In „Wann kann ich?“ des Dienstplaners lag das Plus in einer Karte mit `overflow: hidden`, und
 * seine klebende Hülle (`position: sticky`) bezog sich deshalb auf die Karte statt auf den Rollbereich – das Plus stand am
 * Kartenende, bei 844 px Höhe auf y≈1000, also unter dem Bildschirmrand. Die Layout-Zahl misst jsdom nicht; festgenagelt
 * wird hier, WO im Baum das Plus hängt: **außerhalb** von allem, was der Aufrufer um es herum baut.
 */
describe('SchwebePlus', () => {
  it('ohne Fläche steht es dort, wo es aufgerufen wird (Musik-App: `SeitenGeruest.ueberlagerung`)', () => {
    const { container } = render(
      <div data-testid="inhalt">
        <SchwebePlus label="Neues Lied" onClick={() => {}} />
      </div>,
    );
    expect(screen.getByTestId('inhalt').contains(screen.getByRole('button'))).toBe(true);
    expect(container.querySelector('button')?.className).toMatch(/plus/);
  });

  it('mit Fläche zeichnet es sich dorthin – nicht in den Kasten, in dem es aufgerufen wurde', () => {
    const flaeche = document.createElement('div');
    document.body.append(flaeche);
    const onClick = vi.fn();
    render(
      <SchwebeFlaeche.Provider value={flaeche}>
        <section data-testid="karte" style={{ overflow: 'hidden' }}>
          <SchwebePlus label="Zeitraum eintragen" onClick={onClick} dataTour="verf-plus" />
        </section>
      </SchwebeFlaeche.Provider>,
    );
    const plus = screen.getByRole('button', { name: 'Zeitraum eintragen' });
    expect(flaeche.contains(plus)).toBe(true);
    expect(screen.getByTestId('karte').contains(plus)).toBe(false);
    expect(plus.getAttribute('data-tour')).toBe('verf-plus');
    // Der Klick kommt trotz Portal an.
    fireEvent.click(plus);
    expect(onClick).toHaveBeenCalledOnce();
    flaeche.remove();
  });
});
