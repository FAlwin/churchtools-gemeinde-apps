// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { SetlistSong } from '@shared/types/index';
import { DEFAULT_SETTINGS } from '../utils/chartSettings';
import { ChartOverlays, type ChartOverlay } from './ChartOverlays';

/**
 * „‹“ in den Fenstern, die aus dem Lied-Menü aufgehen (Alwin, 02.11.2026: „Wechselt ein Screen im Fenster, soll es einen
 * Zurück-Pfeil geben“). Tonart, Kapo und Abschnitte öffnen NUR aus dem Lied-Menü – der Pfeil führt immer dorthin, das
 * X schließt ganz. Unten steht kein „Schließen“/„Fertig“ mehr: Es täte dasselbe wie das X.
 */
const SONG = { id: 7, title: 'Treu', targetKey: 'G', originalKey: 'G' } as unknown as SetlistSong;

function zeige(overlay: ChartOverlay) {
  const onOverlay = vi.fn();
  render(
    <ChartOverlays
      overlay={overlay}
      onOverlay={onOverlay}
      song={SONG}
      set={DEFAULT_SETTINGS}
      curKey="G"
      shapeKey="G"
      sections={[]}
      arrangements={[]}
      ablaufArrangementId={70}
      versions={[]}
      currentVersion={{ key: 'original', name: 'Original' } as never}
      isOriginal
      hasVersions={false}
      canEditSong={false}
      onSetting={vi.fn()}
      onSelectVersion={vi.fn()}
      onSharePdf={vi.fn()}
      onEditCurrent={vi.fn()}
      onOpenFiles={vi.fn()}
      onEditSong={vi.fn()}
      onNewVersion={vi.fn()}
      onDeleteVersion={vi.fn()}
    />,
  );
  return onOverlay;
}

afterEach(cleanup);

describe.each([
  ['key', 'Tonart wählen'],
  ['capo', 'Kapo'],
  ['sec', 'Abschnitte transponieren'],
] as const)('Fenster „%s“ aus dem Lied-Menü', (overlay, titel) => {
  it(`„${titel}“: ‹ zurück ins Lied-Menü, X schließt ganz, unten kein zweites Schließen`, () => {
    const onOverlay = zeige(overlay);
    expect(screen.getByRole('dialog', { name: titel })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(onOverlay).toHaveBeenLastCalledWith('menu');
    fireEvent.click(screen.getByRole('button', { name: 'Fenster schließen' }));
    expect(onOverlay).toHaveBeenLastCalledWith(null);
    for (const name of ['Schließen', 'Fertig', 'Abbrechen']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });
});
