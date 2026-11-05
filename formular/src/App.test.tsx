// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { einstellungenAlsText } from '@shared/anmeldung/formular';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import { App } from './App';
import { WARTEN_MS, vergissInstanzen } from './laden';
import { _vergissGemeindeZeitzone, gemeindeZeitzone, geraeteZeitzone } from '@shared/ct/zeit';

/**
 * Das öffentliche Formular (A6-1, #542) gegen ein nachgestelltes ChurchTools – so, wie es ohne Login antwortet
 * (gemessen 14.10.2026). Jeder Fehlerfall einzeln.
 */
const GRUPPE = {
  id: 66,
  name: 'Kindertag',
  information: { note: einstellungenAlsText(neueEinstellungen('kinder')), imageUrl: null },
  maxMemberCount: 20,
  currentMemberCount: 4,
  allowWaitinglist: true,
  canSignUp: true,
};

type Antwort = { status: number; body?: unknown } | 'netz' | 'haengt';
let antworten: Record<string, Antwort[]>;
let aufrufe: { url: string; credentials?: RequestCredentials }[];

function antwort(a: Antwort, signal?: AbortSignal | null): Promise<Response> {
  if (a === 'netz') return Promise.reject(new TypeError('Failed to fetch'));
  if (a === 'haengt')
    return new Promise((_, nein) =>
      signal?.addEventListener('abort', () => nein(new DOMException('abgebrochen', 'AbortError'))),
    );
  return Promise.resolve(
    new Response(JSON.stringify(a.body ?? {}), {
      status: a.status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

beforeEach(() => {
  aufrufe = [];
  vergissInstanzen();
  antworten = {
    // Die Liste der Gemeinde auf dem Webspace (#843) – ohne sie spricht das Formular kein ChurchTools an.
    '/instanzen.json': [{ status: 200, body: ['test.church.tools'] }],
    '/api/publicgroups/66': [{ status: 200, body: { data: GRUPPE } }],
    '/api/info': [{ status: 200, body: { siteName: 'Gemeinde Test' } }],
  };
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = new URL(String(input));
    aufrufe.push({ url: String(input), credentials: init?.credentials });
    const liste = antworten[url.pathname] ?? [{ status: 404 }];
    const a = liste.length > 1 ? liste.shift()! : liste[0];
    return antwort(a, init?.signal);
  });
  window.location.hash = '#test.church.tools/66';
});
afterEach(() => {
  _vergissGemeindeZeitzone();
  vi.useRealTimers();
  window.location.hash = '';
});

describe('Zeitzone der Gemeinde (#847)', () => {
  it('wird beim Laden aus /api/config der Instanz gelesen', async () => {
    antworten['/api/config'] = [{ status: 200, body: { timezone: 'Pacific/Kiritimati' } }];
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Kindertag' })).toBeTruthy();
    expect(gemeindeZeitzone()).toBe('Pacific/Kiritimati');
  });

  it('antwortet /api/config nicht, steht das Formular trotzdem da – mit der Zeitzone des Geräts', async () => {
    antworten['/api/config'] = [{ status: 503 }];
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Kindertag' })).toBeTruthy();
    expect(gemeindeZeitzone()).toBe(geraeteZeitzone());
  });
});

describe('Nur die Instanzen der Gemeinde (#843)', () => {
  const anCt = () => aufrufe.filter((a) => !a.url.endsWith('/instanzen.json'));

  it('Link auf eine fremde Instanz → „gibt es hier nicht“, und die fremde Seite wird NICHT gefragt', async () => {
    // Der Angriff: ein Link mit fremder Instanz, dort eine nachgebaute Schnittstelle mit fremder IBAN.
    window.location.hash = '#fremde-seite.example/66';
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'Diese Anmeldung gibt es hier nicht' }),
    ).toBeTruthy();
    expect(anCt()).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Noch einmal versuchen' })).toBeNull();
  });

  it('Groß geschrieben im Link ist dieselbe Instanz', async () => {
    window.location.hash = '#TEST.church.tools/66';
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Kindertag' })).toBeTruthy();
  });

  it('fehlt instanzen.json auf dem Webspace → „noch nicht eingerichtet“, keine Anfrage an ChurchTools', async () => {
    antworten['/instanzen.json'] = [{ status: 404 }];
    render(<App />);
    expect(
      await screen.findByRole('heading', {
        name: 'Diese Anmeldeseite ist noch nicht eingerichtet',
      }),
    ).toBeTruthy();
    expect(anCt()).toEqual([]);
  });

  it('steht keine gültige Instanz in der Datei → ebenfalls „noch nicht eingerichtet“', async () => {
    antworten['/instanzen.json'] = [{ status: 200, body: ['https://test.church.tools/', 7] }];
    render(<App />);
    expect(
      await screen.findByRole('heading', {
        name: 'Diese Anmeldeseite ist noch nicht eingerichtet',
      }),
    ).toBeTruthy();
    expect(anCt()).toEqual([]);
  });

  it('ist die Datei vorübergehend nicht zu lesen (503) → „Nochmal“, und der zweite Versuch liest sie neu', async () => {
    // Vorübergehend ist nicht ungültig: Gemerkt wird nur eine gelesene Liste.
    antworten['/instanzen.json'] = [{ status: 503 }, { status: 200, body: ['test.church.tools'] }];
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Noch einmal versuchen' }));
    expect(await screen.findByRole('heading', { name: 'Kindertag' })).toBeTruthy();
  });
});

describe('Öffentliches Formular (A6-1)', () => {
  it('zeigt die Veranstaltung – ohne Login gelesen, an der Instanz aus dem Link', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Kindertag' })).toBeTruthy();
    expect(aufrufe.map((a) => a.url)).toEqual([
      // Zuerst die Liste der Gemeinde (#843): Erst danach geht eine Anfrage an die Instanz aus dem Link.
      `${window.location.origin}/instanzen.json`,
      'https://test.church.tools/api/publicgroups/66',
      'https://test.church.tools/api/info',
      // Die Zeitzone der Gemeinde (#847).
      'https://test.church.tools/api/config',
    ]);
    expect(aufrufe.every((a) => a.credentials === 'omit')).toBe(true);
    // Ohne `?probe` ist es kein Probelauf mehr (A6-2).
    expect(screen.queryByText(/Probelauf/)).toBeNull();
    expect(screen.queryByText(/gerade nicht anmelden/)).toBeNull();
  });

  it('nimmt ChurchTools keine Anmeldungen an, steht das oben', async () => {
    antworten['/api/publicgroups/66'] = [
      { status: 200, body: { data: { ...GRUPPE, canSignUp: false } } },
    ];
    render(<App />);
    expect(await screen.findByText(/gerade nicht anmelden/)).toBeTruthy();
  });

  it('ohne Gemeindename (info scheitert) trotzdem das Formular', async () => {
    antworten['/api/info'] = [{ status: 500 }];
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Kindertag' })).toBeTruthy();
  });

  it('kaputter Link → Hinweis, ohne ChurchTools zu fragen', async () => {
    window.location.hash = '#nur-text';
    render(<App />);
    expect(await screen.findByText('Dieser Link ist unvollständig')).toBeTruthy();
    expect(aufrufe).toEqual([]);
  });

  it('403 (nicht freigegeben) und 404 – endgültig, ohne „Nochmal“', async () => {
    antworten['/api/publicgroups/66'] = [{ status: 403 }];
    const { unmount } = render(<App />);
    expect(await screen.findByText('Diese Anmeldung ist nicht geöffnet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Noch einmal versuchen' })).toBeNull();
    unmount();
    antworten['/api/publicgroups/66'] = [{ status: 404 }];
    render(<App />);
    expect(await screen.findByText('Diese Anmeldung gibt es nicht')).toBeTruthy();
  });

  it('Gruppe ohne Einstellungen der Anmeldungen → eigener Hinweis', async () => {
    antworten['/api/publicgroups/66'] = [
      { status: 200, body: { data: { ...GRUPPE, information: { note: 'Probe donnerstags' } } } },
    ];
    render(<App />);
    expect(await screen.findByText('Hier ist kein Anmeldeformular hinterlegt')).toBeTruthy();
  });

  it('vorübergehend (503) → „Nochmal“ lädt neu und zeigt dann das Formular', async () => {
    antworten['/api/publicgroups/66'] = [{ status: 503 }, { status: 200, body: { data: GRUPPE } }];
    render(<App />);
    expect(await screen.findByText('ChurchTools antwortet gerade nicht')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Noch einmal versuchen' }));
    expect(await screen.findByRole('heading', { name: 'Kindertag' })).toBeTruthy();
  });

  it('keine Antwort (Netz weg / Herkunft nicht erlaubt) → eigener Hinweis mit „Nochmal“', async () => {
    antworten['/api/publicgroups/66'] = ['netz'];
    render(<App />);
    expect(await screen.findByText('Keine Verbindung zur Gemeinde')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Noch einmal versuchen' })).toBeTruthy();
  });

  it('Zeitüberschreitung → nach der Wartezeit „antwortet gerade nicht“, nicht vorher', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    antworten['/api/publicgroups/66'] = ['haengt'];
    render(<App />);
    // Erst wenn die Anfrage an ChurchTools unterwegs ist, läuft ihre Uhr – davor wird `instanzen.json` gelesen (#843).
    for (let i = 0; i < 50 && !aufrufe.some((a) => a.url.endsWith('/publicgroups/66')); i++) {
      await act(() => Promise.resolve());
    }
    expect(aufrufe.some((a) => a.url.endsWith('/publicgroups/66'))).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(WARTEN_MS - 1);
    });
    expect(screen.queryByText('ChurchTools antwortet gerade nicht')).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    vi.useRealTimers();
    await waitFor(() =>
      expect(screen.getByText('ChurchTools antwortet gerade nicht')).toBeTruthy(),
    );
  });
});
