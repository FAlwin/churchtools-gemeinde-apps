// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as E from './einrichten';
import * as G from './gemeinde';
import { GemeindeFenster } from './GemeindeFenster';

vi.mock('./einrichten', async (original) => ({
  ...(await original<typeof import('./einrichten')>()),
  stammdaten: vi.fn(),
}));
vi.mock('./gemeinde', () => ({
  gemeindeVorgaben: vi.fn(),
  gespeicherteVorgaben: vi.fn(),
  speichereGemeindeVorgaben: vi.fn(),
}));
const ei = vi.mocked(E);
const gm = vi.mocked(G);

beforeEach(() => {
  ei.stammdaten.mockResolvedValue({
    status: [
      { id: 2, name: 'status.potential', nameTranslated: 'Interessent', isMember: false },
      { id: 3, name: 'status.member', nameTranslated: 'Mitglied', isMember: true },
    ],
    standorte: [
      { id: 0, name: 'Zentrale' },
      { id: 5, name: 'Nord' },
    ],
    bereiche: [{ id: 1, name: 'Gemeindeliste' }],
  });
  gm.gemeindeVorgaben.mockResolvedValue({ statusId: 2, departmentId: 1 });
  gm.gespeicherteVorgaben.mockResolvedValue(null);
  gm.speichereGemeindeVorgaben.mockResolvedValue();
});

describe('Einstellungen der Gemeinde (A6-2)', () => {
  it('Vorschlag vorbelegt; Standort muss man bei zwei wählen; „Mitglied“ steht nicht zur Wahl; Speichern', async () => {
    const gespeichert = vi.fn();
    render(<GemeindeFenster onClose={() => {}} onGespeichert={gespeichert} />);
    const status = await screen.findByLabelText<HTMLSelectElement>('Status');
    expect(status.value).toBe('2');
    expect([...status.options].map((o) => o.textContent)).toEqual([
      'Bitte wählen …',
      'Interessent',
    ]);
    expect(screen.getByText(/Noch nicht gespeichert – das ist der Vorschlag/)).toBeTruthy();
    const knopf = screen.getByRole('button', { name: 'Speichern' });
    expect(knopf).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Standort'), { target: { value: '5' } });
    fireEvent.click(knopf);
    await waitFor(() =>
      expect(gm.speichereGemeindeVorgaben).toHaveBeenCalledWith({
        statusId: 2,
        campusId: 5,
        departmentId: 1,
      }),
    );
    expect(gespeichert).toHaveBeenCalled();
  });
});
