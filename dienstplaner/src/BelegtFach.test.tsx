// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { EntwurfErgebnis } from '@shared/dienstplan/entwuerfe';
import { BelegtFach } from './BelegtFach';
import type { Eintragen, FreierPlatz } from './WerKann';
import { knopfFolge } from '@ui/fenster/fenster.testutil';

const PLATZ: FreierPlatz & { bisher: NonNullable<FreierPlatz['bisher']> } = {
  eventId: 142,
  serviceId: 7,
  dienst: 'Licht',
  termin: 'Gottesdienst',
  tag: 'So 18.10.',
  uhrzeit: '10:00',
  monat: '2026-10',
  monatName: 'Oktober',
  nr: 1,
  von: 1,
  schonDa: [49],
  index: null,
  gruppeId: 3,
  bisher: { belegung: { art: 'anfrage', personId: 49 }, name: 'Ben Test', gast: false },
};
const BEREIT: Eintragen = { art: 'bereit', onWahl: vi.fn() };

function zeige(x: Partial<Parameters<typeof BelegtFach>[0]> = {}) {
  const p = {
    platz: PLATZ,
    eintragen: BEREIT,
    onZurueckziehen: vi.fn(
      (): Promise<EntwurfErgebnis> => Promise.resolve({ ok: true, entwurf: null }),
    ),
    onAnderePerson: vi.fn(),
    onClose: vi.fn(),
    ...x,
  };
  render(<BelegtFach {...p} />);
  return p;
}

describe('BelegtFach (E4-5-2)', () => {
  it('wer und wie – angefragt, zugesagt, Gast', () => {
    zeige();
    expect(screen.getByText(/– angefragt, noch keine Antwort\./)).toBeTruthy();
    expect(screen.getByText('Gottesdienst um 10:00 Uhr · Platz 1 von 1')).toBeTruthy();
  });

  it('beide Wege mit ihrer gemessenen Folge; Gast: keine Warnung', () => {
    zeige({
      platz: { ...PLATZ, bisher: { ...PLATZ.bisher, belegung: { art: 'zusage', personId: 49 } } },
    });
    expect(screen.getByText(/– hat zugesagt\./)).toBeTruthy();
    expect(screen.getByText(/ChurchTools sagt Ben Test nicht Bescheid/)).toBeTruthy();
    expect(
      screen.getByText(/Ben Test bekommt von ChurchTools „Du wurdest … ausgetragen“/),
    ).toBeTruthy();
  });

  it('Gast: „als Gast eingetragen“, keine Warnung', () => {
    zeige({
      platz: {
        ...PLATZ,
        bisher: { belegung: { art: 'gast', name: 'Max' }, name: 'Max', gast: true },
      },
    });
    expect(screen.getByText(/– als Gast eingetragen\./)).toBeTruthy();
    expect(screen.queryByText(/nicht Bescheid/)).toBeNull();
    expect(screen.queryByText(/ausgetragen“/)).toBeNull();
  });

  it('Zurückziehen und Andere Person gehen an den Aufrufer', async () => {
    const p = zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Andere Person wählen' }));
    expect(p.onAnderePerson).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Zurückziehen' }));
    await waitFor(() => expect(p.onZurueckziehen).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Fehler → eigener Text, das Fenster bleibt; ohne Recht nur der Hinweis, keine Knöpfe', async () => {
    const onZurueckziehen = vi.fn(
      (): Promise<EntwurfErgebnis> => Promise.resolve({ ok: false, grund: 'kein-recht' }),
    );
    const p = zeige({ onZurueckziehen });
    fireEvent.click(screen.getByRole('button', { name: 'Zurückziehen' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/erlaubt dir nicht/);
    expect(p.onClose).not.toHaveBeenCalled();
  });

  it('nicht bereit (gesperrt) → nur der Text, keine Knöpfe', () => {
    zeige({ eintragen: { art: 'gesperrt', text: 'Du darfst die Entwürfe nur ansehen.' } });
    expect(screen.getByText('Du darfst die Entwürfe nur ansehen.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Zurückziehen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Andere Person wählen' })).toBeNull();
  });
});

describe('BelegtFach im ChurchTools-Aufbau', () => {
  it('nur ansehen: X oben, unten nur Schließen', () => {
    zeige();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(knopfFolge()[0]).toBe('Fenster schließen');
    expect(knopfFolge().at(-1)).toBe('Schließen');
  });
});
