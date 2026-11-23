// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { LeitungNichtFestgehalten } from './leitungFehler';
import { WerDarfWas } from './WerDarfWas';
import * as R from './rechte';

vi.mock('./rechte', () => ({ ladeWerDarfWas: vi.fn(), rechteSetzen: vi.fn() }));
const r = vi.mocked(R);

const KAT = { entwuerfe: 104, veroeffentlicht: 107 };
const ROLLEN = [
  { id: 1, name: 'Leiter', leitung: true },
  { id: 2, name: 'Mitarbeiter', leitung: false },
  { id: 3, name: 'Coach', leitung: false },
];
const stufe = (name: string) => screen.getByLabelText<HTMLSelectElement>(`Stufe von ${name}`).value;

beforeEach(() => {
  r.ladeWerDarfWas.mockResolvedValue({
    rollen: ROLLEN,
    ist: [
      { rolle: 1, stufe: 'leitung' },
      { rolle: 2, stufe: 'redakteur' },
      { rolle: 3, stufe: 'keine' },
    ],
  });
  r.rechteSetzen.mockResolvedValue(undefined);
});

describe('Wer darf was', () => {
  it('zeigt je Rolle die Stufe, die aus den Rechten in ChurchTools abgeleitet ist', async () => {
    render(<WerDarfWas gruppe={344} kategorien={KAT} />);
    await screen.findByLabelText('Stufe von Leiter');
    expect(stufe('Leiter')).toBe('leitung');
    expect(stufe('Mitarbeiter')).toBe('redakteur');
    expect(stufe('Coach')).toBe('keine');
    expect(r.ladeWerDarfWas).toHaveBeenCalledWith(344, KAT);
  });

  it('ein Mischzustand wird als „Weicht ab“ gezeigt – gewählt ist dann der Vorschlag der Rolle', async () => {
    r.ladeWerDarfWas.mockResolvedValue({
      rollen: ROLLEN,
      ist: [
        { rolle: 1, stufe: 'leitung' },
        { rolle: 2, stufe: 'abweicht' },
        { rolle: 3, stufe: 'keine' },
      ],
    });
    render(<WerDarfWas gruppe={344} kategorien={KAT} />);
    await screen.findByLabelText('Stufe von Mitarbeiter');
    expect(screen.getByText(/Weicht ab/)).toBeTruthy();
    expect(stufe('Mitarbeiter')).toBe('redakteur');
  });

  it('„Rechte setzen“ übergibt die gewählten Stufen, liest danach neu und meldet „nachgelesen“', async () => {
    render(<WerDarfWas gruppe={344} kategorien={KAT} />);
    await screen.findByLabelText('Stufe von Coach');
    fireEvent.change(screen.getByLabelText('Stufe von Coach'), { target: { value: 'leitung' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechte setzen' }));
    await screen.findByText(/Die Rechte sind gesetzt und nachgelesen/);
    expect(r.rechteSetzen).toHaveBeenCalledWith(344, KAT, [
      { rolle: 1, stufe: 'leitung' },
      { rolle: 2, stufe: 'redakteur' },
      { rolle: 3, stufe: 'leitung' },
    ]);
    expect(r.ladeWerDarfWas).toHaveBeenCalledTimes(2);
  });

  it('Fehler beim Setzen: Meldung mit Grund, die Wahl bleibt stehen, nichts gilt als gesetzt', async () => {
    r.rechteSetzen.mockRejectedValueOnce(new ApiError(503, 'kurz weg'));
    render(<WerDarfWas gruppe={344} kategorien={KAT} />);
    await screen.findByLabelText('Stufe von Coach');
    fireEvent.change(screen.getByLabelText('Stufe von Coach'), { target: { value: 'redakteur' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechte setzen' }));
    expect(await screen.findByText(/Noch nicht gesetzt/)).toBeTruthy();
    expect(screen.queryByText(/nachgelesen/)).toBeNull();
    expect(stufe('Coach')).toBe('redakteur');
    // Der zweite Versuch klappt und meldet es.
    fireEvent.click(screen.getByRole('button', { name: 'Rechte setzen' }));
    await screen.findByText(/Die Rechte sind gesetzt und nachgelesen/);
    expect(screen.queryByText(/Noch nicht gesetzt/)).toBeNull();
  });

  it('Rechte gesetzt, aber die Leitung ließ sich nicht festhalten (W3b-3): eigene Meldung OHNE „Noch nicht gesetzt“ – es IST gesetzt, die Stufen werden neu gelesen, ein zweiter Versuch geht', async () => {
    r.rechteSetzen.mockRejectedValueOnce(new LeitungNichtFestgehalten());
    render(<WerDarfWas gruppe={344} kategorien={KAT} />);
    await screen.findByLabelText('Stufe von Coach');
    fireEvent.click(screen.getByRole('button', { name: 'Rechte setzen' }));
    const meldung = await screen.findByText(
      /Die Rechte sind gesetzt\. ChurchTools hat aber nicht festgehalten/,
    );
    expect(meldung.textContent).not.toMatch(/Noch nicht gesetzt/);
    expect(screen.queryByText(/nachgelesen/)).toBeNull();
    // Gelesen wird neu: die Stufen zeigen, was jetzt gilt.
    expect(r.ladeWerDarfWas).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Rechte setzen' }));
    await screen.findByText(/Die Rechte sind gesetzt und nachgelesen/);
    expect(screen.queryByText(/nicht festgehalten/)).toBeNull();
  });

  it('Lesefehler: Meldung mit „Erneut versuchen“ statt einer leeren Liste', async () => {
    r.ladeWerDarfWas.mockRejectedValueOnce(new ApiError(504, 'x'));
    render(<WerDarfWas gruppe={344} kategorien={KAT} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    await screen.findByLabelText('Stufe von Leiter');
    expect(r.rechteSetzen).not.toHaveBeenCalled();
  });

  it('der Knopf ist während des Setzens gesperrt', async () => {
    let fertig: () => void = () => {};
    r.rechteSetzen.mockReturnValueOnce(new Promise<void>((ok) => (fertig = ok)));
    render(<WerDarfWas gruppe={344} kategorien={KAT} />);
    await screen.findByLabelText('Stufe von Coach');
    fireEvent.click(screen.getByRole('button', { name: 'Rechte setzen' }));
    expect(screen.getByRole('button', { name: /Rechte werden gesetzt/ })).toHaveProperty(
      'disabled',
      true,
    );
    fertig();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Rechte setzen' })).toBeTruthy());
  });
});
