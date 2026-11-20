// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from './App';
import { ladeStart, type Start } from './start';

vi.mock('./start', () => ({ ladeStart: vi.fn() }));
vi.mock('./naechsterTermin', () => ({ useNaechsterTermin: () => null }));
vi.mock('./Zuhoeren', () => ({ Zuhoeren: () => <p>Zuhören</p> }));
vi.mock('./Technik', () => ({ Technik: () => <p>Technik</p> }));
vi.mock('./EinstellungenFenster', () => ({
  EinstellungenFenster: () => <div role="dialog" aria-label="Einstellungen" />,
}));

const laden = vi.mocked(ladeStart);
const start = (teil: Partial<Start> = {}): Start => ({
  ichId: 1,
  vorname: 'Alwin',
  name: 'Alwin Friesen',
  gemeinde: 'ECG Donrath',
  modul: 35,
  einrichtung: { zugang: 5, einstellungen: 6 },
  darfAnlegen: false,
  technik: false,
  einstellungenAendern: false,
  ...teil,
});

beforeEach(() => laden.mockReset());
afterEach(cleanup);

describe('Gebetsabend: Kopf und „Einstellungen“ als letzter Reiter (E24, B8b)', () => {
  it('mit dem Recht: Reiter „Start“ · „Einstellungen“ (letzter); kein Knopf im Kopf; der Reiter öffnet das Fenster', async () => {
    laden.mockResolvedValue(start({ einstellungenAendern: true }));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Hallo Alwin' })).toBeTruthy();
    // Nur der App-Name, ohne Gemeinde.
    expect(screen.getByText('Gebetsabend')).toBeTruthy();
    expect(screen.queryByText(/ECG Donrath/)).toBeNull();
    const nav = screen.getByRole('navigation', { name: 'Bereiche' });
    const namen = within(nav)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(namen[namen.length - 1]).toBe('Einstellungen');
    // Genau ein „Einstellungen“ – der Knopf im Kopf ist weg.
    expect(screen.getAllByRole('button', { name: 'Einstellungen' })).toHaveLength(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(within(nav).getByRole('button', { name: 'Einstellungen' }));
    expect(screen.getByRole('dialog', { name: 'Einstellungen' })).toBeTruthy();
  });

  it('ohne das Recht: kein Reiter „Einstellungen“, keine Leiste', async () => {
    laden.mockResolvedValue(start());
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Hallo Alwin' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Einstellungen' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Bereiche' })).toBeNull();
  });
});
