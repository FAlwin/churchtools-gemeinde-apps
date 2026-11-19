// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { Einrichtung } from './Einrichtung';
import * as E from './einrichten';
import type { Start } from './start';

vi.mock('./einrichten', () => ({ einrichten: vi.fn(), ladeGruppen: vi.fn() }));
const e = vi.mocked(E);

const START: Start = {
  ichId: 1,
  vorname: 'Helene',
  gemeinde: 'ECG',
  modul: 26,
  einrichtung: null,
  stand: 'einrichten',
  admin: true,
  zugang: 'admin',
};

beforeEach(() => {
  e.ladeGruppen.mockResolvedValue([
    { id: 3, name: 'Gottesdienstteam' },
    { id: 7, name: 'Website' },
    { id: 9, name: 'Jugend' },
  ]);
  e.einrichten.mockResolvedValue(undefined);
});

describe('Einrichtung', () => {
  it('die Gruppe „Website“ ist vorgewählt; „Einrichten“ legt für genau diese Gruppe an und meldet es', async () => {
    const fertig = vi.fn();
    render(<Einrichtung start={START} onEingerichtet={fertig} />);
    const wahl = await screen.findByRole('combobox');
    await waitFor(() => expect(wahl).toHaveProperty('value', '7'));
    fireEvent.click(screen.getByRole('button', { name: 'Einrichten' }));
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    expect(e.einrichten).toHaveBeenCalledWith(26, { id: 7, name: 'Website' });
  });

  it('eine andere Gruppe lässt sich wählen', async () => {
    render(<Einrichtung start={START} onEingerichtet={() => {}} />);
    const wahl = await screen.findByRole('combobox');
    fireEvent.change(wahl, { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einrichten' }));
    await waitFor(() => expect(e.einrichten).toHaveBeenCalledWith(26, { id: 9, name: 'Jugend' }));
  });

  it('ohne gewählte Gruppe ist „Einrichten“ gesperrt – und es gibt einen Tipp, wenn es keine Gruppe „Website“ gibt', async () => {
    e.ladeGruppen.mockResolvedValue([{ id: 3, name: 'Gottesdienstteam' }]);
    render(<Einrichtung start={START} onEingerichtet={() => {}} />);
    await screen.findByRole('combobox');
    expect(screen.getByRole('button', { name: 'Einrichten' })).toHaveProperty('disabled', true);
    expect(screen.getByText(/Lege in ChurchTools eine Gruppe „Website“ an/)).toBeTruthy();
  });

  it('Fehler beim Einrichten: Meldung mit „Erneut versuchen“, nichts meldet „eingerichtet“', async () => {
    e.einrichten.mockRejectedValueOnce(new ApiError(504, 'x'));
    const fertig = vi.fn();
    render(<Einrichtung start={START} onEingerichtet={fertig} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Einrichten' })).toHaveProperty('disabled', false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Einrichten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    expect(e.einrichten).toHaveBeenCalledTimes(2);
  });

  it('nur zum Teil eingerichtet: die Gruppe steht fest (keine Wahl), „Einrichten“ ergänzt', async () => {
    render(
      <Einrichtung
        start={{
          ...START,
          einrichtung: { gruppe: 7, name: 'Website', entwuerfe: 20, veroeffentlicht: null },
        }}
        onEingerichtet={() => {}}
      />,
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(e.ladeGruppen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Einrichten' }));
    await waitFor(() => expect(e.einrichten).toHaveBeenCalledWith(26, { id: 7, name: 'Website' }));
  });
});
