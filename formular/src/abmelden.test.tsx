// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { einstellungenAlsText } from '@shared/anmeldung/formular';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import { App } from './App';

/**
 * „Deine Anmeldung“ (A6-4) gegen ein nachgestelltes ChurchTools – `signoutdata` und `signout` so, wie am 16.10.2026
 * an der Test-Instanz gemessen (ohne Login, Schlüssel aus der Mail). Jeder Fehlerfall einzeln.
 */
function einstellungen() {
  const e = neueEinstellungen('einfach');
  e.preis.grundpreis.betragCent = 1500;
  e.bezahlung = { ...e.bezahlung, iban: 'DE89370400440532013000', kontoinhaber: 'Gemeinde e.V.' };
  e.kontakt = 'kinder@gemeinde.test';
  return e;
}
const GRUPPE = {
  id: 66,
  name: 'Kinderbibeltag',
  information: { note: einstellungenAlsText(einstellungen()), imageUrl: null },
  maxMemberCount: null,
  currentMemberCount: 2,
  allowWaitinglist: false,
  canSignUp: true,
};
const person = (id: number, title: string) => ({ domainIdentifier: String(id), title });
const daten = (personen: { domainIdentifier: string; title: string }[]) => ({
  status: 200,
  body: {
    data: {
      requester: { title: 'Erna Muster', domainAttributes: { lastName: 'Muster' } },
      requesterEmail: 'erna@beispiel.test',
      group: { title: 'Kinderbibeltag' },
      selfSignOutPersons: personen,
      leaderSignOutPersons: [],
      groupHasAutoAccept: true,
    },
  },
});
const BEIDE = daten([person(84, 'Kalle Muster'), person(85, 'Kira Muster')]);
const NUR_KIRA = daten([person(85, 'Kira Muster')]);

type Antwort = { status: number; body?: unknown } | 'netz';
let antworten: Record<string, Antwort[]>;
let aufrufe: {
  methode: string;
  pfad: string;
  suche: string;
  body?: unknown;
  credentials?: string;
}[];

beforeEach(() => {
  aufrufe = [];
  antworten = {
    'GET /api/publicgroups/66': [{ status: 200, body: { data: GRUPPE } }],
    'GET /api/info': [{ status: 200, body: { siteName: 'Gemeinde Test' } }],
    'GET /api/publicgroups/66/signoutdata': [BEIDE],
    'POST /api/publicgroups/66/signout': [{ status: 204 }],
  };
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = new URL(String(input));
    const methode = (init?.method ?? 'GET').toUpperCase();
    aufrufe.push({
      methode,
      pfad: url.pathname,
      suche: url.search,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      credentials: init?.credentials,
    });
    const liste = antworten[`${methode} ${url.pathname}`] ?? [{ status: 404 }];
    const a = liste.length > 1 ? liste.shift()! : liste[0];
    if (a === 'netz') return Promise.reject(new TypeError('Failed to fetch'));
    return Promise.resolve(
      a.status === 204
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify(a.body ?? {}), {
            status: a.status,
            headers: { 'Content-Type': 'application/json' },
          }),
    );
  });
  window.location.hash = '#test.church.tools/66/abmelden/ltmB5wFTNw2N8Izw1bJ3';
});
afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = '';
});

const signouts = () => aufrufe.filter((a) => a.pfad.endsWith('/signout'));

async function kalleAbsagen() {
  render(<App />);
  const kalle = (await screen.findByText('Kalle Muster')).closest('div')!.parentElement!;
  fireEvent.click(within(kalle).getByRole('button', { name: 'Absagen' }));
  fireEvent.click(screen.getByRole('button', { name: 'Ja, absagen' }));
}

describe('Deine Anmeldung (A6-4)', () => {
  it('zeigt die Angemeldeten, die Bezahlung und den Kontakt – im Design der Veranstaltung, ohne Login', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Kinderbibeltag' })).toBeTruthy();
    expect(screen.getByText('Kalle Muster')).toBeTruthy();
    expect(screen.getByText('Kira Muster')).toBeTruthy();
    expect(screen.getByText('erna@beispiel.test')).toBeTruthy();
    const bank = screen.getByRole('region', { name: 'Bezahlung' });
    expect(bank.textContent).toMatch(/DE89 3704 0044 0532 0130 00/);
    expect(bank.textContent).toMatch(/Gemeinde e\.V\./);
    expect(screen.getByRole('link', { name: 'kinder@gemeinde.test' }).getAttribute('href')).toBe(
      'mailto:kinder@gemeinde.test',
    );
    expect(screen.getByRole('link', { name: 'Weitere Person anmelden' }).getAttribute('href')).toBe(
      `${window.location.origin}/#test.church.tools/66`,
    );
    expect(aufrufe.find((a) => a.pfad.endsWith('/signoutdata'))?.suche).toBe(
      '?token=ltmB5wFTNw2N8Izw1bJ3',
    );
    expect(aufrufe.every((a) => a.credentials === 'omit')).toBe(true);
    expect(signouts()).toHaveLength(0);
  });

  it('Absagen mit Rückfrage → signout mit Schlüssel und Person, nachgelesen, dann „abgesagt“', async () => {
    antworten['GET /api/publicgroups/66/signoutdata'] = [BEIDE, NUR_KIRA];
    await kalleAbsagen();
    expect(await screen.findByText(/– abgesagt/)).toBeTruthy();
    expect(signouts().map((a) => a.body)).toEqual([
      { token: 'ltmB5wFTNw2N8Izw1bJ3', personIds: [84] },
    ]);
    // Nach dem Absagen nachgelesen – und Kira bleibt angemeldet.
    expect(aufrufe.filter((a) => a.pfad.endsWith('/signoutdata'))).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Absagen' })).toHaveLength(1);
  });

  it('„Nein, angemeldet bleiben“ → nichts geschickt', async () => {
    render(<App />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Absagen' }))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Nein, angemeldet bleiben' }));
    expect(screen.queryByRole('button', { name: 'Ja, absagen' })).toBeNull();
    expect(signouts()).toHaveLength(0);
  });

  it('204, aber die Person steht noch da → keine Erfolgsmeldung, sondern Fehler', async () => {
    await kalleAbsagen();
    expect((await screen.findByRole('alert')).textContent).toMatch(/nicht übernommen/);
    expect(screen.queryByText(/– abgesagt/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Ja, absagen' })).toBeTruthy();
  });

  it('vorübergehend (503 beim Absagen) → Meldung, Rückfrage bleibt, zweiter Klick schickt erneut', async () => {
    antworten['POST /api/publicgroups/66/signout'] = [{ status: 503 }, { status: 204 }];
    antworten['GET /api/publicgroups/66/signoutdata'] = [BEIDE, NUR_KIRA];
    await kalleAbsagen();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText(/– abgesagt/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ja, absagen' }));
    expect(await screen.findByText(/– abgesagt/)).toBeTruthy();
    expect(signouts()).toHaveLength(2);
  });

  it('falscher oder verbrauchter Link (404) → „Dieser Link gilt nicht“, ohne „Nochmal“', async () => {
    antworten['GET /api/publicgroups/66/signoutdata'] = [{ status: 404 }];
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Dieser Link gilt nicht' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Noch einmal versuchen' })).toBeNull();
  });

  it('vorübergehend (503 beim Laden) → „Nochmal“ lädt neu', async () => {
    antworten['GET /api/publicgroups/66/signoutdata'] = [{ status: 503 }, BEIDE];
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Noch einmal versuchen' }));
    expect(await screen.findByText('Kalle Muster')).toBeTruthy();
  });

  it('Veranstaltung nicht mehr freigegeben (403) → trotzdem absagen, Name aus ChurchTools', async () => {
    antworten['GET /api/publicgroups/66'] = [{ status: 403 }];
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Kinderbibeltag' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Absagen' })).toHaveLength(2);
    // Ohne Einstellungen keine Bankdaten und kein Kontakt.
    expect(screen.queryByRole('region', { name: 'Bezahlung' })).toBeNull();
    expect(screen.getByText(/Wende dich dafür an die Gemeinde/)).toBeTruthy();
  });

  it('niemand mehr angemeldet → Hinweis statt leerer Liste', async () => {
    antworten['GET /api/publicgroups/66/signoutdata'] = [daten([])];
    render(<App />);
    expect(await screen.findByText(/niemand mehr angemeldet/)).toBeTruthy();
  });
});

describe('Ein gewöhnlicher Formular-Link bleibt das Formular', () => {
  it('#instanz/gruppe ohne „abmelden“ → Anmeldeformular, kein signoutdata', async () => {
    window.location.hash = '#test.church.tools/66';
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Verbindlich anmelden' })).toBeTruthy();
    await waitFor(() => expect(aufrufe.some((a) => a.pfad.endsWith('/signoutdata'))).toBe(false));
  });
});
