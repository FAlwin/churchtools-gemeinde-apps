// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { SongLibraryEntry } from '@shared/types/index';
import { LiedSchonVorhanden } from './LiedSchonVorhanden';
import { knopfFolge } from '@ui/fenster/fenster.testutil';

const LIED: SongLibraryEntry = {
  songId: 5,
  name: 'Treu',
  author: 'Tobias Gerster',
  ccli: '7001234',
  key: 'E',
  arrangementId: 50,
};
/** Fenster wie ChurchTools (E6-O F3, #726): zwei Wege unten rechts, der Hauptweg zuletzt (Alwin). */
describe('LiedSchonVorhanden im ChurchTools-Aufbau', () => {
  it('unten: Zurück zum Formular · Trotzdem neu anlegen · Vorhandenes verwenden', () => {
    const onVerwenden = vi.fn();
    const onTrotzdem = vi.fn();
    render(
      <LiedSchonVorhanden
        vorhanden={LIED}
        onVerwenden={onVerwenden}
        onTrotzdem={onTrotzdem}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Dieses Lied gibt es schon' })).toBeTruthy();
    expect(knopfFolge()).toEqual([
      'Fenster schließen',
      'Zurück zum Formular',
      'Trotzdem neu anlegen',
      '„Treu" verwenden',
    ]);
    fireEvent.click(screen.getByRole('button', { name: '„Treu" verwenden' }));
    expect(onVerwenden).toHaveBeenCalledWith(LIED);
    fireEvent.click(screen.getByRole('button', { name: 'Trotzdem neu anlegen' }));
    expect(onTrotzdem).toHaveBeenCalled();
  });

  it('ohne „verwenden“ ist „Trotzdem neu anlegen“ der Hauptweg', () => {
    render(<LiedSchonVorhanden vorhanden={LIED} onTrotzdem={vi.fn()} onClose={vi.fn()} />);
    expect(knopfFolge()).toEqual([
      'Fenster schließen',
      'Zurück zum Formular',
      'Trotzdem neu anlegen',
    ]);
  });
});
