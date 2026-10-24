// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LIEDINFO_FELDER, LIEDINFO_ZEILE, TONART_ZEILE } from '@shared/ct/liedinfo';
import { EinfuegenMenue } from './EinfuegenMenue';
import { ANDERE, TEILE } from '../utils/einfuegen';

/** Lied-Editor L6 (24.10.2026): Menü „Einfügen“ statt Format-Menü (Variante B). */
function zeige(offen = true) {
  const waehlen = vi.fn();
  const umschalten = vi.fn();
  render(<EinfuegenMenue offen={offen} umschalten={umschalten} waehlen={waehlen} />);
  return { waehlen, umschalten };
}

describe('EinfuegenMenue', () => {
  it('zu: nur der Knopf, ein Tipp schaltet um', () => {
    const { umschalten } = zeige(false);
    expect(screen.queryByText('Neuer Teil')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Einfügen' }));
    expect(umschalten).toHaveBeenCalledOnce();
  });

  it('Teil, Pedal-Halt und „andere Programme“ melden, was eingefügt werden soll', () => {
    const { waehlen } = zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Refrain' }));
    fireEvent.click(screen.getByRole('button', { name: /Pedal-Halt/ }));
    fireEvent.click(screen.getByRole('button', { name: /Kapo/ }));
    expect(waehlen.mock.calls.map((c) => c[0])).toEqual([
      { art: 'teil', name: 'Refrain' },
      { art: 'pedal' },
      { art: 'anderes', tag: 'capo', mitWert: true },
    ]);
    expect(screen.getAllByRole('button')).toHaveLength(1 + TEILE.length + 1 + ANDERE.length);
  });

  it('keine Kopfangabe im Menü – die gehören in die Liedinfo und wären im Text unsichtbar', () => {
    const kopf = [...LIEDINFO_FELDER.map((f) => f.zeile), 'key'];
    for (const a of ANDERE) {
      expect(kopf).not.toContain(a.tag);
      // Was das Menü einfügt, blendet der Editor nicht aus.
      const zeile = a.mitWert ? `{${a.tag}: 2}` : `{${a.tag}}`;
      expect(LIEDINFO_ZEILE.test(zeile) || TONART_ZEILE.test(zeile)).toBe(false);
    }
  });
});
