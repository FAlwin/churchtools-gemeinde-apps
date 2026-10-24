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
    expect(knopfTexte()).toEqual(['Fenster schließen', 'Abbrechen', 'Hinzufügen']);

    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    expect(speichern).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Fenster schließen' }));
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
    expect(knopfTexte()).toEqual(['Fenster schließen', 'Fertig']);
  });

  it('`knoepfe={null}` (nur ansehen, E6-O F2 #720): ChurchTools-Aufbau, unten nur Schließen – X heißt anders', () => {
    const onClose = vi.fn();
    render(
      <Sheet title="T" onClose={onClose} cancelLabel="Schließen" knoepfe={null}>
        <p>Inhalt</p>
      </Sheet>,
    );
    expect(screen.getByRole('dialog', { name: 'T' })).toBeTruthy();
    expect(knopfTexte()).toEqual(['Fenster schließen', 'Schließen']);
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('`beschaeftigt` sperrt X, Abbrechen und den Klick daneben – die Knöpfe des Fensters bleiben dessen Sache', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Sheet
        title="T"
        onClose={onClose}
        beschaeftigt
        knoepfe={<FensterKnopf>Wird gespeichert …</FensterKnopf>}
      >
        <p>Inhalt</p>
      </Sheet>,
    );
    const x = screen.getByRole('button', { name: 'Fenster schließen' });
    const abbrechen = screen.getByRole('button', { name: 'Abbrechen' });
    expect(x).toHaveProperty('disabled', true);
    expect(abbrechen).toHaveProperty('disabled', true);
    fireEvent.click(x);
    fireEvent.click(abbrechen);
    fireEvent.click(container.firstElementChild as Element);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Wird gespeichert …' })).toHaveProperty(
      'disabled',
      false,
    );
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
