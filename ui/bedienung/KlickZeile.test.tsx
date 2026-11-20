// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KlickZeile } from './KlickZeile';

afterEach(cleanup);

describe('KlickZeile (E24, B7)', () => {
  it('mit onClick ein Knopf: der Name ist der Inhalt, ein Klick ruft den Aufrufer, hinten „›“', () => {
    const f = vi.fn();
    render(
      <KlickZeile onClick={f}>
        <b>Worship-Workshop</b>
        <small>wartet auf Freigabe</small>
      </KlickZeile>,
    );
    const knopf = screen.getByRole('button', { name: 'Worship-Workshop wartet auf Freigabe' });
    expect(knopf.querySelector('svg')).not.toBeNull();
    fireEvent.click(knopf);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('mit href ein echter Link, kein Knopf', () => {
    render(
      <KlickZeile href="https://ct.example/groups/5">
        <b>Camp</b>
      </KlickZeile>,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('link', { name: 'Camp' }).getAttribute('href')).toBe(
      'https://ct.example/groups/5',
    );
  });

  it('klappt etwas auf: aria-expanded folgt dem Aufrufer', () => {
    render(
      <KlickZeile onClick={() => {}} ariaExpanded pfeil="auf">
        <b>Alle anzeigen</b>
      </KlickZeile>,
    );
    expect(
      screen.getByRole('button', { name: 'Alle anzeigen' }).getAttribute('aria-expanded'),
    ).toBe('true');
  });
});
