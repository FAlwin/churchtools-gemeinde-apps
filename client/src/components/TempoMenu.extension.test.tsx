// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Das Tempo-Menü in der ChurchTools-Erweiterung (#337, Alwin am 07.10.2026): Dort gibt es das
 * Speichern in ChurchTools noch nicht (Phase 3b). Vorher stand „Zum Ändern in ChurchTools fehlt dir
 * die Berechtigung" – falsch für jeden, der das Recht hat. Jetzt nennt das Menü den wahren Grund und
 * zeigt keinen Knopf, der nichts tun kann. (Der Rahmen springt dabei nicht: Der Knopf fehlt in der
 * Erweiterung immer, nicht mal so und mal so.)
 */
vi.mock('../services/funktionen', async (original) => ({
  ...(await original<typeof import('../services/funktionen')>()),
  funktionen: {
    ...(await original<typeof import('../services/funktionen')>()).funktionen,
    schreibenInChurchTools: false,
  },
}));

const { TempoMenu } = await import('./TempoMenu');

function zeige(darfSpeichern: boolean): void {
  render(
    <TempoMenu
      liedTempo={120}
      wert={132}
      onWert={vi.fn()}
      timeSig="4/4"
      zaehlweise={null}
      onZaehlweise={vi.fn()}
      puls={false}
      onPuls={vi.fn()}
      klick="aus"
      onKlick={vi.fn()}
      darfSpeichern={darfSpeichern}
      onSpeichern={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

describe('Tempo-Menü in der ChurchTools-Erweiterung', () => {
  it('behauptet keine fehlende Berechtigung – nennt den wahren Grund', () => {
    zeige(false);
    expect(screen.queryByText(/Berechtigung/)).toBeNull();
    expect(screen.getByText(/In der Erweiterung gilt das Tempo nur hier/)).toBeTruthy();
  });

  it('zeigt keinen Speichern-Knopf, der nichts tun kann', () => {
    zeige(true);
    expect(screen.queryByRole('button', { name: /in ChurchTools speichern/ })).toBeNull();
  });
});
