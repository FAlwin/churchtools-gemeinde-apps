// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WEBSITE_LEITUNG } from '@shared/website/zugang';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { Einrichtung } from './Einrichtung';
import * as E from './einrichten';
import * as R from './rechte';
import type { Start } from './start';

vi.mock('./einrichten', () => ({ einrichten: vi.fn(), ladeGruppen: vi.fn() }));
vi.mock('./rechte', () => ({ ladeRollen: vi.fn(), rechteSetzen: vi.fn() }));
const e = vi.mocked(E);
const re = vi.mocked(R);

const START: Start = {
  ichId: 1,
  vorname: 'Helene',
  name: 'Helene Wiebe',
  gemeinde: 'ECG',
  modul: 26,
  einrichtung: null,
  stand: 'einrichten',
  admin: true,
  zugang: WEBSITE_LEITUNG,
  darfRechteSetzen: false,
  leitungOhneRechte: false,
};

beforeEach(() => {
  e.ladeGruppen.mockResolvedValue([
    { id: 3, name: 'Gottesdienstteam' },
    { id: 7, name: 'Website' },
    { id: 9, name: 'Jugend' },
  ]);
  e.einrichten.mockResolvedValue({ entwuerfe: 20, veroeffentlicht: 21 });
  re.ladeRollen.mockResolvedValue([
    { id: 1, name: 'Leiter', leitung: true },
    { id: 2, name: 'Co-Leiter', leitung: true },
    { id: 3, name: 'Mitarbeiter', leitung: false },
  ]);
  re.rechteSetzen.mockResolvedValue(undefined);
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

describe('Einrichtung: Rechte je Rolle (W3b-1)', () => {
  const MIT_RECHTEN: Start = { ...START, darfRechteSetzen: true };
  const stufe = (name: string) =>
    screen.getByLabelText<HTMLSelectElement>(`Stufe von ${name}`).value;

  it('vorbelegt: Rollen mit Leiter-Kennzeichen = Leitung, alle anderen = Redakteur', async () => {
    render(<Einrichtung start={MIT_RECHTEN} onEingerichtet={() => {}} />);
    await screen.findByLabelText('Stufe von Leiter');
    expect(stufe('Leiter')).toBe('leitung');
    expect(stufe('Co-Leiter')).toBe('leitung');
    expect(stufe('Mitarbeiter')).toBe('redakteur');
    expect(re.ladeRollen).toHaveBeenCalledWith(7);
  });

  it('„Einrichten“ legt die Kategorien an und setzt DANACH die gewählten Stufen für genau diese Kategorien', async () => {
    const fertig = vi.fn();
    render(<Einrichtung start={MIT_RECHTEN} onEingerichtet={fertig} />);
    await screen.findByLabelText('Stufe von Mitarbeiter');
    fireEvent.change(screen.getByLabelText('Stufe von Mitarbeiter'), {
      target: { value: 'keine' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Einrichten' }));
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    expect(re.rechteSetzen).toHaveBeenCalledWith(7, { entwuerfe: 20, veroeffentlicht: 21 }, [
      { rolle: 1, stufe: 'leitung' },
      { rolle: 2, stufe: 'leitung' },
      { rolle: 3, stufe: 'keine' },
    ]);
    expect(e.einrichten.mock.invocationCallOrder[0]).toBeLessThan(
      re.rechteSetzen.mock.invocationCallOrder[0],
    );
  });

  it('wer keine Rechte setzen darf: keine Stufen-Liste, es werden nur die Kategorien angelegt, mit Hinweis', async () => {
    const fertig = vi.fn();
    render(<Einrichtung start={START} onEingerichtet={fertig} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Einrichten' })).toHaveProperty('disabled', false),
    );
    expect(
      screen.getByText(/fehlt in ChurchTools das Recht „Personen administrieren“/),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Stufe von Leiter')).toBeNull();
    expect(re.ladeRollen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Einrichten' }));
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    expect(re.rechteSetzen).not.toHaveBeenCalled();
  });

  it('Fehler beim Setzen der Rechte: Meldung, NICHT „eingerichtet“; „Erneut versuchen“ wiederholt beides', async () => {
    re.rechteSetzen.mockRejectedValueOnce(new ApiError(504, 'x'));
    const fertig = vi.fn();
    render(<Einrichtung start={MIT_RECHTEN} onEingerichtet={fertig} />);
    await screen.findByLabelText('Stufe von Leiter');
    fireEvent.click(screen.getByRole('button', { name: 'Einrichten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    expect(e.einrichten).toHaveBeenCalledTimes(2);
    expect(re.rechteSetzen).toHaveBeenCalledTimes(2);
  });

  it('„Einrichten“ wartet, bis die Rollen geladen sind (sonst würde ohne Wahl eingerichtet)', async () => {
    let ok: (r: Awaited<ReturnType<typeof R.ladeRollen>>) => void = () => {};
    re.ladeRollen.mockReturnValueOnce(new Promise((res) => (ok = res)));
    render(<Einrichtung start={MIT_RECHTEN} onEingerichtet={() => {}} />);
    await screen.findByText(/Rollen werden geladen/);
    expect(screen.getByRole('button', { name: 'Einrichten' })).toHaveProperty('disabled', true);
    ok([{ id: 1, name: 'Leiter', leitung: true }]);
    await screen.findByLabelText('Stufe von Leiter');
    expect(screen.getByRole('button', { name: 'Einrichten' })).toHaveProperty('disabled', false);
  });

  it('wechselt die Gruppe, gilt wieder der Vorschlag (nicht die Wahl der alten Gruppe)', async () => {
    render(<Einrichtung start={MIT_RECHTEN} onEingerichtet={() => {}} />);
    await screen.findByLabelText('Stufe von Mitarbeiter');
    fireEvent.change(screen.getByLabelText('Stufe von Mitarbeiter'), {
      target: { value: 'keine' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /Gruppe/ }), { target: { value: '9' } });
    await waitFor(() => expect(re.ladeRollen).toHaveBeenCalledWith(9));
    await waitFor(() => expect(stufe('Mitarbeiter')).toBe('redakteur'));
  });
});
