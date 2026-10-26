// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_SITE_CONFIG } from '@shared/types/index';
import { knopfFolge } from '@ui/fenster/fenster.testutil';

/** Kalender und Speicher-Mutation als Attrappe – geprüft wird das Fenster selbst (E6-O F3, #726). */
vi.mock('../hooks/useSiteConfig', () => ({
  useUpdateSiteConfig: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useKalender: () => ({
    isLoading: false,
    isError: false,
    data: [
      { id: 2, name: 'Gottesdienste' },
      { id: 5, name: 'Jugend' },
    ],
  }),
}));

const { AblaufAnlegenManager } = await import('./AblaufAnlegenManager');

describe('AblaufAnlegenManager im ChurchTools-Aufbau', () => {
  it('eigenes Fenster; Speichern erscheint unten erst nach einer Änderung', () => {
    render(<AblaufAnlegenManager site={DEFAULT_SITE_CONFIG} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Termine ohne Ablauf' })).toBeTruthy();
    expect(knopfFolge()[0]).toBe('Fenster schließen');
    expect(knopfFolge().at(-1)).toBe('Abbrechen');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Gottesdienste' }));
    expect(knopfFolge().slice(-2)).toEqual(['Abbrechen', 'Speichern']);
  });
});
