// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import * as A from '@shared/gebetsabend/ablage';
import { ctDaten } from '@ui/ct/verbindung';
import type { Start } from './start';
import { EinstellungenFenster } from './EinstellungenFenster';

vi.mock('@shared/gebetsabend/ablage', async (orig) => ({
  ...(await orig<typeof import('@shared/gebetsabend/ablage')>()),
  einstellungenLesen: vi.fn(),
  einstellungenSpeichern: vi.fn(),
}));
vi.mock('@ui/ct/verbindung', async (orig) => ({
  ...(await orig<typeof import('@ui/ct/verbindung')>()),
  ctDaten: vi.fn(),
}));
const lesen = vi.mocked(A.einstellungenLesen);
const speichern = vi.mocked(A.einstellungenSpeichern);
const daten = vi.mocked(ctDaten);

const START: Start = {
  ichId: 7,
  vorname: 'Jakob',
  name: 'Jakob Penner',
  gemeinde: 'ECG',
  modul: 29,
  einrichtung: { zugang: 77, einstellungen: 80 },
  darfAnlegen: false,
  technik: true,
  einstellungenAendern: true,
};
const gespeichert = vi.fn();
const schliessen = vi.fn();

async function oeffnen(kalender: number | null = 2) {
  lesen.mockResolvedValue({
    ok: true,
    stand: { version: 5, inhalt: { kalender, suchwort: 'Gebet' } },
  });
  daten.mockResolvedValue([
    { id: 1, name: 'Sonstige Veranstaltung' },
    { id: 2, name: 'Gottesdienst' },
    { kaputt: true },
  ]);
  render(
    <EinstellungenFenster
      start={START}
      kategorie={80}
      onGespeichert={gespeichert}
      onSchliessen={schliessen}
    />,
  );
  await act(async () => {
    await Promise.resolve();
  });
}

const auswahl = () => screen.getByLabelText<HTMLSelectElement>('Kalender des Gebetsabends');
const wort = () => screen.getByLabelText<HTMLInputElement>('Termin erkennen am Wort im Titel');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EinstellungenFenster', () => {
  it('zeigt die sichtbaren Kalender und den gespeicherten Stand', async () => {
    await oeffnen();
    expect([...auswahl().options].map((o) => o.textContent)).toEqual([
      '– kein Termin anzeigen –',
      'Sonstige Veranstaltung',
      'Gottesdienst',
    ]);
    expect(auswahl().value).toBe('2');
    expect(wort().value).toBe('Gebet');
    expect(daten).toHaveBeenCalledWith('/calendars');
  });

  it('Speichern mit der gesehenen Version, Wort getrimmt → Termin lädt neu, Fenster zu', async () => {
    await oeffnen();
    speichern.mockResolvedValue({
      ok: true,
      stand: { version: 6, inhalt: { kalender: 1, suchwort: 'Gebetsabend' } },
    });
    fireEvent.change(auswahl(), { target: { value: '1' } });
    fireEvent.change(wort(), { target: { value: '  Gebetsabend ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
      await Promise.resolve();
    });
    const [, modul, kategorie, e, von, erwartet] = speichern.mock.calls[0];
    expect([modul, kategorie, erwartet]).toEqual([29, 80, 5]);
    expect(e).toEqual({ kalender: 1, suchwort: 'Gebetsabend' });
    expect(von).toEqual({ personId: 7, name: 'Jakob Penner' });
    expect(gespeichert).toHaveBeenCalledOnce();
    expect(schliessen).toHaveBeenCalledOnce();
  });

  it('ein anderer war schneller → nichts überschrieben, dessen Stand steht im Fenster, Fenster bleibt offen', async () => {
    await oeffnen();
    speichern.mockResolvedValue({
      ok: false,
      grund: 'konflikt',
      jetzt: { version: 6, inhalt: { kalender: 1, suchwort: 'Andacht' } },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
      await Promise.resolve();
    });
    expect(auswahl().value).toBe('1');
    expect(wort().value).toBe('Andacht');
    expect(screen.getByRole('alert').textContent).toContain('nichts überschrieben');
    expect(schliessen).not.toHaveBeenCalled();
    expect(gespeichert).not.toHaveBeenCalled();

    // Nochmal speichern: jetzt mit der Version des anderen – sonst gäbe es nur wieder „konflikt“.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
      await Promise.resolve();
    });
    expect(speichern.mock.calls[1][5]).toBe(6);
    expect(speichern.mock.calls[1][3]).toEqual({ kalender: 1, suchwort: 'Andacht' });
  });

  it('ein gespeicherter Kalender, den man selbst nicht sieht, bleibt gewählt statt still zu verschwinden', async () => {
    await oeffnen(9);
    expect(auswahl().value).toBe('9');
    expect(auswahl().selectedOptions[0].textContent).toBe('Kalender 9');
  });

  it('Lesen scheitert → Fehler statt Feldern, Speichern gesperrt', async () => {
    lesen.mockResolvedValue({ ok: false, grund: 'voruebergehend' });
    daten.mockResolvedValue([]);
    render(
      <EinstellungenFenster
        start={START}
        kategorie={80}
        onGespeichert={gespeichert}
        onSchliessen={schliessen}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByLabelText('Kalender des Gebetsabends')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('ChurchTools antwortet gerade nicht');
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveProperty('disabled', true);
  });

  it('die Kalender lassen sich nicht holen → Fehler über fehlerMeldung, Speichern gesperrt', async () => {
    lesen.mockResolvedValue({
      ok: true,
      stand: { version: 5, inhalt: { kalender: 2, suchwort: '' } },
    });
    daten.mockRejectedValue(new TypeError('Failed to fetch'));
    render(
      <EinstellungenFenster
        start={START}
        kategorie={80}
        onGespeichert={gespeichert}
        onSchliessen={schliessen}
      />,
    );
    expect(screen.getByText('Wird geladen …')).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByLabelText('Kalender des Gebetsabends')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('ChurchTools antwortet gerade nicht');
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveProperty('disabled', true);
  });
});
