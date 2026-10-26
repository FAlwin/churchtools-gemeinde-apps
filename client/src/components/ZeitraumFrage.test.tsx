// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Absence } from '@shared/types/index';
import { ZeitraumFrage } from './ZeitraumFrage';
import { knopfFolge } from '@ui/fenster/fenster.testutil';

const URLAUB: Absence = {
  id: 1,
  startDate: '2026-11-02',
  endDate: '2026-11-08',
  startTime: null,
  endTime: null,
  comment: '',
  reason: 'Urlaub',
  reasonId: 3,
  vonApp: false,
};
/** Fenster wie ChurchTools (E6-O F3, #726): Löschen (rot) und Anpassen (blau) unten rechts (Alwin). */
describe('ZeitraumFrage im ChurchTools-Aufbau', () => {
  it('unten: Abbrechen · Zeitraum löschen · Zeitraum anpassen', () => {
    const onLoeschen = vi.fn();
    const onAnpassen = vi.fn();
    render(
      <ZeitraumFrage
        tag="2026-11-04"
        absence={URLAUB}
        onLoeschen={onLoeschen}
        onAnpassen={onAnpassen}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Teil eines Zeitraums' })).toBeTruthy();
    expect(knopfFolge()).toEqual([
      'Fenster schließen',
      'Abbrechen',
      'Zeitraum löschen',
      'Zeitraum anpassen',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum löschen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum anpassen' }));
    expect([onLoeschen.mock.calls.length, onAnpassen.mock.calls.length]).toEqual([1, 1]);
  });

  it('ganzer Tag: „Eintrag“ statt „Zeitraum“', () => {
    render(
      <ZeitraumFrage
        tag="2026-11-04"
        absence={{ ...URLAUB, endDate: '2026-11-04', startDate: '2026-11-04' }}
        weitereTermine={['Gebetsabend']}
        onLoeschen={vi.fn()}
        onAnpassen={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(knopfFolge().slice(-2)).toEqual(['Eintrag löschen', 'Eintrag anpassen']);
  });
});
