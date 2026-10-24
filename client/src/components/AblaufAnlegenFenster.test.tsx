// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AblaufVorlage, Service } from '@shared/types/index';
import { ABLAUF_SCHON_DA } from '@shared/ct/ablaufAnlegen';
import { ApiError } from '../services/api';

const api = vi.hoisted(() => ({ getAblaufVorlagen: vi.fn(), ablaufAnlegen: vi.fn() }));
vi.mock('../services/churchtoolsApi', async (orig) => ({
  ...(await orig<typeof import('../services/churchtoolsApi')>()),
  getAblaufVorlagen: api.getAblaufVorlagen,
  ablaufAnlegen: api.ablaufAnlegen,
}));

const { AblaufAnlegenFenster } = await import('./AblaufAnlegenFenster');

/**
 * Das Fenster „Ablauf anlegen" (13.10.2026): „Vorlage zuerst" vorausgewählt, die Wahl landet als
 * richtige Quelle bei der API, und ein Fehler (etwa „gibt es schon") steht im Fenster.
 */
function termin(id: number, tag: string, kalenderId = 2, songCount = 0): Service {
  return {
    id,
    day: tag.slice(8, 10),
    month: 'Okt',
    weekday: 'Sonntag',
    name: 'Gottesdienst',
    subtitle: null,
    date: tag,
    start: `${tag}T09:00:00Z`,
    time: '10:00 Uhr',
    location: 'Gottesdienst',
    songCount,
    setlistChanged: false,
    kalenderId,
  };
}

const ZIEL = termin(148, '2026-10-25');
const FRUEHER = [termin(1, '2026-10-18', 2, 4), termin(2, '2026-10-11', 2, 3)];
const VORLAGEN: AblaufVorlage[] = [
  { id: 30, name: 'Jugend', kalenderId: 3, punkte: 4 },
  { id: 28, name: 'Sonntag', kalenderId: 2, punkte: 5 },
];

function zeige(onAngelegt = vi.fn(), ziel: Service = ZIEL) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <AblaufAnlegenFenster
        termin={ziel}
        mitAblauf={FRUEHER}
        onClose={vi.fn()}
        onAngelegt={onAngelegt}
      />
    </QueryClientProvider>,
  );
  return { onAngelegt };
}

beforeEach(() => {
  api.getAblaufVorlagen.mockResolvedValue(VORLAGEN);
  api.ablaufAnlegen.mockResolvedValue({ ok: true });
});

describe('AblaufAnlegenFenster', () => {
  it('Vorlage zuerst: die des eigenen Kalenders ist vorausgewählt und wird angelegt', async () => {
    const { onAngelegt } = zeige();
    const sonntag = await screen.findByRole('button', { name: /Sonntag/ });
    expect(sonntag.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));
    await waitFor(() => expect(onAngelegt).toHaveBeenCalledWith(ZIEL));
    expect(api.ablaufAnlegen).toHaveBeenCalledWith(148, 2, { art: 'vorlage', vorlageId: 28 });
  });

  it('im ChurchTools-Aufbau (E6-O F1, #716): X oben, unten Abbrechen und dann Anlegen', async () => {
    zeige();
    await screen.findByRole('button', { name: /Sonntag/ });
    const knoepfe = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(knoepfe[0]).toBe('Schließen');
    expect(knoepfe.slice(-2)).toEqual(['Abbrechen', 'Anlegen']);
  });

  it('„Wie eine frühere": die jüngste frühere ist gewählt – Kopie davon', async () => {
    zeige();
    await screen.findByRole('button', { name: /Sonntag/ });
    fireEvent.click(screen.getByRole('button', { name: 'Wie eine frühere' }));
    expect(screen.getByRole('button', { name: /18\. Okt/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));
    await waitFor(() =>
      expect(api.ablaufAnlegen).toHaveBeenCalledWith(148, 2, { art: 'kopie', eventId: 1 }),
    );
  });

  it('„Leer"', async () => {
    zeige();
    await screen.findByRole('button', { name: /Sonntag/ });
    fireEvent.click(screen.getByRole('button', { name: 'Leer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));
    await waitFor(() => expect(api.ablaufAnlegen).toHaveBeenCalledWith(148, 2, { art: 'leer' }));
  });

  it('ohne Vorlagen ist die jüngste frühere vorausgewählt, und das Fenster sagt es', async () => {
    api.getAblaufVorlagen.mockResolvedValue([]);
    zeige();
    expect(
      await screen.findByText('In ChurchTools gibt es noch keine Ablauf-Vorlage.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /18\. Okt/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('ein Fehler steht im Fenster, und es bleibt offen', async () => {
    api.ablaufAnlegen.mockRejectedValue(new ApiError(409, ABLAUF_SCHON_DA));
    const { onAngelegt } = zeige();
    await screen.findByRole('button', { name: /Sonntag/ });
    fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));
    expect((await screen.findByRole('alert')).textContent).toContain(ABLAUF_SCHON_DA);
    expect(onAngelegt).not.toHaveBeenCalled();
  });

  it('Kalender unbekannt → Meldung im Fenster, nichts angelegt', async () => {
    const { kalenderId: _k, ...ohneKalender } = ZIEL;
    const { onAngelegt } = zeige(vi.fn(), ohneKalender);
    await screen.findByRole('button', { name: /Sonntag/ });
    fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /Kalender dieser Veranstaltung ist unbekannt/,
    );
    expect(api.ablaufAnlegen).not.toHaveBeenCalled();
    expect(onAngelegt).not.toHaveBeenCalled();
  });
});
