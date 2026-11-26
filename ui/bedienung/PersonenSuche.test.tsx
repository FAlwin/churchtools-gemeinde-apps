// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { personenSuchen, type Gefunden } from '../ct/personen';
import { PersonenSuche } from './PersonenSuche';

vi.mock('../ct/personen', () => ({ personenSuchen: vi.fn() }));
const suchen = vi.mocked(personenSuchen);

const person = (personId: number, vor: string, nach: string): Gefunden => ({
  personId,
  vor,
  nach,
  geburtstag: null,
  email: null,
  adresse: null,
});
const K = { form: 'f', feld: 'e', liste: 'l', zeile: 'z', leer: 'n', fehler: 'x' };

beforeEach(() => suchen.mockReset());

function zeigen(extra: Partial<Parameters<typeof PersonenSuche>[0]> = {}) {
  const onWahl = vi.fn();
  render(
    <PersonenSuche
      klassen={K}
      onWahl={onWahl}
      zeile={(p) => <span>{`${p.vor} ${p.nach}`}</span>}
      {...extra}
    />,
  );
  return onWahl;
}
const tippen = (text: string, label = 'Name') =>
  fireEvent.change(screen.getByRole('searchbox', { name: label }), { target: { value: text } });

describe('PersonenSuche', () => {
  it('sucht erst ab zwei Zeichen, zeigt die Treffer und meldet die Wahl', async () => {
    suchen.mockResolvedValue([person(1, 'Hanna', 'Handtest'), person(2, 'Otto', 'Ohne')]);
    const onWahl = zeigen();
    tippen('H');
    expect(screen.getByRole('button', { name: 'Suchen' })).toHaveProperty('disabled', true);
    fireEvent.submit(screen.getByRole('searchbox').closest('form')!);
    expect(suchen).not.toHaveBeenCalled();
    tippen('Ha');
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    const liste = await screen.findByRole('list', { name: 'Gefunden' });
    expect(suchen).toHaveBeenCalledWith('Ha');
    fireEvent.click(within(liste).getByRole('button', { name: 'Otto Ohne' }));
    expect(onWahl).toHaveBeenCalledWith(expect.objectContaining({ personId: 2 }));
  });

  it('gesperrte Treffer sind nicht wählbar; „Niemand gefunden.“ bei leerer Antwort', async () => {
    suchen.mockResolvedValueOnce([person(1, 'Hanna', 'Handtest')]);
    zeigen({ gesperrt: (p) => p.personId === 1 });
    tippen('Hanna');
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    const knopf = await screen.findByRole('button', { name: 'Hanna Handtest' });
    expect(knopf).toHaveProperty('disabled', true);
    suchen.mockResolvedValueOnce([]);
    tippen('Nie');
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    expect(await screen.findByText('Niemand gefunden.')).toBeTruthy();
  });

  it('Fehler von ChurchTools steht als Meldung da; `danach` bekommt den Suchtext', async () => {
    suchen.mockRejectedValueOnce(new Error('kaputt'));
    zeigen({ label: 'Person suchen', danach: (s) => <li>neu: {s}</li> });
    tippen('Hanna', 'Person suchen');
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    suchen.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByText('neu: Hanna')).toBeTruthy();
  });
});
