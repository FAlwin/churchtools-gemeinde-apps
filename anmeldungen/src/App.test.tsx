// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { ChurchToolsBremst } from '@ui/ct/verbindung';
import { App } from './App';
import { fehlerZustand } from './zustand';
import { ladeStart } from './start';

vi.mock('./start', () => ({ ladeStart: vi.fn() }));
const laden = vi.mocked(ladeStart);

describe('Startseite der Anmeldungen (#474)', () => {
  it('zeigt Gruß, Gemeinde und die Gruppen mit Leitung/Mitglied', async () => {
    laden.mockResolvedValue({
      vorname: 'Alwin',
      gemeinde: 'Evangeliumschristen- Gemeinde e.V.',
      gruppen: [
        { id: 9, name: 'Lobpreisteam', leitung: true },
        { id: 7, name: 'Technik', leitung: false },
      ],
    });
    render(<App />);
    expect(await screen.findByText('Hallo, Alwin!')).toBeTruthy();
    expect(screen.getByText('Evangeliumschristen- Gemeinde e.V.')).toBeTruthy();
    const zeilen = screen.getAllByRole('listitem').map((z) => z.textContent);
    expect(zeilen).toEqual(['LobpreisteamLeitung', 'TechnikMitglied']);
  });

  it('keine Gruppen → erklärt, warum', async () => {
    laden.mockResolvedValue({ vorname: 'Alwin', gemeinde: null, gruppen: [] });
    render(<App />);
    expect(await screen.findByText(/Du bist in keiner Gruppe/)).toBeTruthy();
  });

  it('ChurchTools antwortet nicht → „Erneut versuchen" lädt neu', async () => {
    laden.mockRejectedValueOnce(new ApiError(502, 'x')).mockResolvedValueOnce({
      vorname: 'Alwin',
      gemeinde: null,
      gruppen: [],
    });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText('Hallo, Alwin!')).toBeTruthy();
    expect(laden).toHaveBeenCalledTimes(2);
  });
});

describe('fehlerZustand – die Zweige einzeln', () => {
  it('abgemeldet (401) → kein „Erneut versuchen", sondern neu anmelden', () => {
    expect(fehlerZustand(new ApiError(401, ''))).toMatchObject({ nochmal: false });
  });
  it('Bremse, 5xx und Netzfehler → vorübergehend, mit „Erneut versuchen"', () => {
    for (const e of [
      new ChurchToolsBremst(5000),
      new ApiError(504, ''),
      new TypeError('Failed to fetch'),
    ]) {
      expect(fehlerZustand(e)).toMatchObject({
        nochmal: true,
        text: expect.stringContaining('antwortet gerade nicht'),
      });
    }
  });
  it('anderer Fehler (z. B. fehlendes Recht) → die Meldung von ChurchTools', () => {
    expect(fehlerZustand(new ApiError(403, 'Keine ausreichende Berechtigung.'))).toMatchObject({
      text: 'Keine ausreichende Berechtigung.',
    });
  });
});
