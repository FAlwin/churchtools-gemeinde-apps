// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Absence, AbsenceEvent } from '@shared/types/index';
import type { AbwesenheitenDienst } from '@ui/abwesenheiten/ctDienst';
import { Abwesenheiten, DienstHinweis } from './Abwesenheiten';
import { ladeMeineDienste } from './ladeBeiwerk';

const dienst = {
  meine: vi.fn<AbwesenheitenDienst['meine']>(),
  termine: vi.fn<AbwesenheitenDienst['termine']>(),
  gruende: vi.fn<AbwesenheitenDienst['gruende']>(),
  anlegen: vi.fn<AbwesenheitenDienst['anlegen']>(),
  aendern: vi.fn<AbwesenheitenDienst['aendern']>(),
  loeschen: vi.fn<AbwesenheitenDienst['loeschen']>(),
};
const erstellt = vi.fn();
vi.mock('@ui/abwesenheiten/ctDienst', () => ({
  abwesenheitenDienst: (opt: unknown) => {
    erstellt(opt);
    return dienst;
  },
}));
vi.mock('./ladeBeiwerk', () => ({ ladeMeineDienste: vi.fn() }));
const meineDienste = vi.mocked(ladeMeineDienste);

const HEUTE = '2026-11-04';
const ev = (id: number, name: string, tag: string): AbsenceEvent => ({
  id,
  name,
  date: tag,
  startDate: `${tag}T09:00:00Z`,
  endDate: `${tag}T10:30:00Z`,
});
const TERMINE = [
  ev(1, 'Gottesdienst', '2026-11-08'),
  ev(2, 'Gebetsabend', '2026-11-11'),
  ev(3, 'Gottesdienst', '2026-11-15'),
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  dienst.meine.mockResolvedValue([]);
  dienst.termine.mockResolvedValue(TERMINE);
  dienst.gruende.mockResolvedValue([{ id: 1, name: 'Abwesend', standard: true }]);
  dienst.anlegen.mockResolvedValue({} as Absence);
  meineDienste.mockResolvedValue(
    new Map([
      [1, [{ name: 'Ton', zugesagt: true }]],
      [3, [{ name: 'Gesang', zugesagt: false }]],
    ]),
  );
});

const zeige = () => render(<Abwesenheiten ichId={19} zeitzone="Europe/Berlin" heute={HEUTE} />);
const kasten = (name: RegExp) => screen.getByRole<HTMLButtonElement>('button', { name });

describe('Abwesenheiten im Dienstplaner (E7-2c)', () => {
  it('nutzt die eigene Person und die Zeitzone; zeigt die Termine ab heute', async () => {
    zeige();
    expect(await screen.findByText('Gebetsabend')).not.toBeNull();
    expect(erstellt).toHaveBeenCalledWith(expect.objectContaining({ zeitzone: 'Europe/Berlin' }));
    expect(dienst.termine).toHaveBeenCalledWith(HEUTE, expect.any(String));
    expect(meineDienste).toHaveBeenCalledWith(19);
  });

  it('unter einem Termin die eigenen Dienste – eingeteilt bzw. angefragt', async () => {
    zeige();
    expect(await screen.findByText('Du bist eingeteilt: Ton')).not.toBeNull();
    expect(screen.getByText('Angefragt: Gesang')).not.toBeNull();
  });

  it('abgehakt an einem Termin mit Dienst → in Rot „bitte auch den Dienst absagen“; Speichern trägt ein', async () => {
    zeige();
    await screen.findByText('Du bist eingeteilt: Ton');
    fireEvent.click(kasten(/Abwesend – Gottesdienst, So, 08\.11\./));
    expect(
      screen.getByText('Du bist eingeteilt: Ton – bitte auch den Dienst absagen'),
    ).not.toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
      await Promise.resolve();
    });
    expect(dienst.anlegen).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime: '2026-11-08T09:00:00Z',
        endTime: '2026-11-08T10:30:00Z',
      }),
    );
    // Nach dem Schreiben holt die Seite die Einträge neu.
    await waitFor(() => expect(dienst.meine).toHaveBeenCalledTimes(2));
  });

  it('der Filter bietet die Veranstaltungen wie in „Dienste“ (Gottesdienst kommt zweimal vor)', async () => {
    zeige();
    await screen.findByText('Gebetsabend');
    expect(screen.getByRole('button', { name: /Filter/ })).not.toBeNull();
  });

  it('Laden scheitert → „Erneut versuchen“, danach geht es', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    dienst.meine.mockRejectedValueOnce(new Error('503'));
    zeige();
    const nochmal = await screen.findByRole('button', { name: /Erneut versuchen/ });
    fireEvent.click(nochmal);
    expect(await screen.findByText('Gebetsabend')).not.toBeNull();
  });

  it('eigene Dienste nicht ladbar → nur der Hinweis fehlt, die Seite steht', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    meineDienste.mockRejectedValue(new Error('weg'));
    zeige();
    expect(await screen.findByText('Gebetsabend')).not.toBeNull();
    expect(screen.queryByText(/Du bist eingeteilt/)).toBeNull();
  });
});

describe('DienstHinweis', () => {
  it('mehrere Dienste an einem Termin – zusammen, abgehakt „die Dienste“', () => {
    const dienste = [
      { name: 'Ton', zugesagt: true },
      { name: 'Licht', zugesagt: true },
      { name: 'Gesang', zugesagt: false },
    ];
    const { rerender } = render(<DienstHinweis dienste={dienste} abwesend={false} />);
    expect(screen.getByText('Du bist eingeteilt: Ton, Licht · Angefragt: Gesang')).not.toBeNull();
    rerender(<DienstHinweis dienste={dienste} abwesend />);
    expect(
      screen.getByText(
        'Du bist eingeteilt: Ton, Licht · Angefragt: Gesang – bitte auch die Dienste absagen',
      ),
    ).not.toBeNull();
  });

  it('ohne Dienst nichts', () => {
    const { container } = render(<DienstHinweis dienste={undefined} abwesend />);
    expect(container.textContent).toBe('');
  });
});
