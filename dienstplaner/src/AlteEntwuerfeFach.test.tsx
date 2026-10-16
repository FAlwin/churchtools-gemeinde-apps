// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Entwurf, EntwurfErgebnis } from '@shared/dienstplan/entwuerfe';
import { AlteEntwuerfeFach, type AlterEntwurf } from './AlteEntwuerfeFach';

const entwurf = (eventId: number, x: Partial<Entwurf> = {}): Entwurf => ({
  ort: { eventId, serviceId: 6, index: null },
  ziel: { art: 'person', personId: 46, name: 'Ben Test' },
  modus: 'anfrage',
  gesehen: { art: 'frei' },
  von: { personId: 1, name: 'Alwin' },
  zeit: '2026-10-01T08:00:00.000Z',
  version: 1,
  ...x,
});
const ZEILEN: AlterEntwurf[] = [
  {
    entwurf: entwurf(90),
    gruppeId: 3,
    grund: 'vorbei',
    termin: { name: 'Gottesdienst', tag: '2026-10-04' },
    dienst: 'Ton',
  },
  {
    entwurf: entwurf(91, { von: { personId: 19, name: 'Spike' } }),
    gruppeId: 3,
    grund: 'termin-weg',
  },
  {
    entwurf: entwurf(92, { ziel: { art: 'gast', name: 'Max' } }),
    gruppeId: 4,
    grund: 'dienst-weg',
    termin: { name: 'Gebetsabend', tag: '2026-10-22' },
  },
];
type Verwerfen = (a: AlterEntwurf) => Promise<EntwurfErgebnis>;

function zeige(verwerfen: Verwerfen = () => Promise.resolve({ ok: true, entwurf: null })) {
  const p = { verwerfen: vi.fn(verwerfen), onClose: vi.fn() };
  render(<AlteEntwuerfeFach zeilen={ZEILEN} ichId={1} {...p} />);
  return p;
}

describe('AlteEntwuerfeFach (#582)', () => {
  it('je Zeile was und warum – vorbei, gelöscht, Dienst weg; „von X“ nur bei fremden', () => {
    zeige();
    expect(screen.getByText('Gottesdienst, So, 04.10. – vorbei')).toBeTruthy();
    expect(screen.getByText('Termin gelöscht · von Spike')).toBeTruthy();
    expect(
      screen.getByText('Gebetsabend, Do, 22.10. – Dienst gehört nicht mehr zum Termin'),
    ).toBeTruthy();
    expect(screen.getByText('Gast eintragen: Max')).toBeTruthy();
    expect(screen.getByText('Ton')).toBeTruthy();
  });

  it('„Alle verwerfen“: einer nach dem anderen, Ergebnis je Zeile; Schließen meldet „geändert“', async () => {
    const verwerfen = vi
      .fn<Verwerfen>()
      .mockResolvedValueOnce({ ok: true, entwurf: null })
      .mockResolvedValueOnce({ ok: false, grund: 'konflikt', jetzt: null })
      .mockResolvedValueOnce({ ok: false, grund: 'voruebergehend' });
    const p = zeige(verwerfen);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Alle 3 verwerfen' }));
      await Promise.resolve();
    });
    expect(await screen.findByText('1 von 3 verworfen')).toBeTruthy();
    expect(verwerfen.mock.calls.map((c) => c[0].entwurf.ort.eventId)).toEqual([90, 91, 92]);
    expect(screen.getByText('verworfen')).toBeTruthy();
    expect(screen.getByText('Inzwischen geändert – nicht verworfen.')).toBeTruthy();
    expect(screen.getByText(/antwortet gerade nicht/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(p.onClose).toHaveBeenCalledWith(true);
  });

  it('während des Verwerfens nicht schließbar; nichts verworfen → „nicht geändert“', async () => {
    let fertig!: (r: EntwurfErgebnis) => void;
    const verwerfen = vi
      .fn<Verwerfen>()
      .mockImplementationOnce(() => new Promise((r) => (fertig = r)))
      .mockResolvedValue({ ok: false, grund: 'kein-recht' });
    const p = zeige(verwerfen);
    fireEvent.click(screen.getByRole('button', { name: 'Alle 3 verwerfen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bitte warten …' }));
    expect(p.onClose).not.toHaveBeenCalled();
    await act(async () => fertig({ ok: false, grund: 'kein-recht' }));
    expect(await screen.findByText('0 von 3 verworfen')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(p.onClose).toHaveBeenCalledWith(false);
  });
});
