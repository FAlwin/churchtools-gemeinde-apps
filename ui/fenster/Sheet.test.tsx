// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Sheet } from './Sheet';
import { FensterKnopf } from './FensterKnopf';

/**
 * Zwei Aufbauten nebeneinander, bis alle Fenster umgezogen sind (E6-O F1, #716): Wer `knoepfe` reicht, bekommt den
 * ChurchTools-Aufbau (Kopf mit X, Knöpfe unten rechts), alle anderen sehen aus wie vorher.
 */
afterEach(cleanup);

const knopfTexte = () =>
  screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);

describe('Sheet', () => {
  it('mit Knöpfen: Titel benennt das Fenster, X und Abbrechen schließen, die Knöpfe stehen nach Abbrechen', () => {
    const onClose = vi.fn();
    const speichern = vi.fn();
    render(
      <Sheet
        title="Neuer Eintrag"
        onClose={onClose}
        knoepfe={<FensterKnopf onClick={speichern}>Hinzufügen</FensterKnopf>}
      >
        <p>Inhalt</p>
      </Sheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Neuer Eintrag' })).toBeTruthy();
    expect(knopfTexte()).toEqual(['Schließen', 'Abbrechen', 'Hinzufügen']);

    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    expect(speichern).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('mit Knöpfen und `cancelLabel={null}`: kein Abbrechen, das X bleibt', () => {
    render(
      <Sheet
        title="T"
        onClose={vi.fn()}
        cancelLabel={null}
        knoepfe={<FensterKnopf>Fertig</FensterKnopf>}
      >
        <p>Inhalt</p>
      </Sheet>,
    );
    expect(knopfTexte()).toEqual(['Schließen', 'Fertig']);
  });

  it('ohne Knöpfe: der alte Aufbau – kein X, Abbrechen unten', () => {
    render(
      <Sheet title="T" onClose={vi.fn()} cancelLabel="Fertig">
        <p>Inhalt</p>
      </Sheet>,
    );
    expect(knopfTexte()).toEqual(['Fertig']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
