// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DEFAULT_SITE_CONFIG } from '@shared/types/index';

/** Nur die Speicher-Mutation als Attrappe – geprüft wird das Fenster selbst (E6-O F3, #726). */
vi.mock('../hooks/useSiteConfig', () => ({
  useUpdateSiteConfig: () => ({ mutate: vi.fn(), isPending: false }),
}));

const { LinksManager } = await import('./LinksManager');

const knopfFolge = () =>
  screen.getAllByRole('button').map((b) => (b.getAttribute('aria-label') ?? b.textContent)?.trim());

describe('LinksManager im ChurchTools-Aufbau', () => {
  it('eigenes Fenster „Links verwalten“, unten Abbrechen und Speichern', () => {
    render(<LinksManager site={DEFAULT_SITE_CONFIG} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Links verwalten' })).toBeTruthy();
    expect(knopfFolge()[0]).toBe('Fenster schließen');
    expect(knopfFolge().slice(-2)).toEqual(['Abbrechen', 'Speichern']);
  });
});
