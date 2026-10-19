// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { startFuer } from './start.testutil';
import { TerminAnsicht } from './TerminAnsicht';

/**
 * Die Termin-Ansicht (E6-1b) – mit dem echten Laden (`ladeTermin`, `ladeAblauf`), nur ChurchTools ist ersetzt.
 * So prüft der Test dieselben Regeln, die Liste und Matrix benutzen, statt handgeschriebener Pläne.
 */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const TERMIN = {
  id: 7,
  name: 'Gottesdienst',
  startDate: '2026-10-18T08:00:00Z',
  endDate: '2026-10-18T10:00:00Z',
  eventServices: [
    { serviceId: 6, personId: 1, name: 'Alwin', isAccepted: true },
    { serviceId: 7, personId: null, name: null },
  ],
};
const ABLAUF = {
  items: [
    {
      id: 1,
      type: 'normal',
      title: 'Soundcheck',
      isBeforeEvent: true,
      start: '2026-10-18T07:30:00Z',
      duration: 1800,
    },
    { id: 2, type: 'header', title: 'Ankommen', start: '2026-10-18T08:00:00Z' },
    {
      id: 3,
      type: 'song',
      title: 'Lied',
      song: { title: 'Du großer Gott' },
      start: '2026-10-18T08:05:00Z',
      duration: 300,
      note: 'mit Chor',
    },
  ],
};

function ct({
  termin = () => json(200, { data: TERMIN }),
  ablauf = () => json(200, { data: ABLAUF }),
}: { termin?: () => Response; ablauf?: () => Response } = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/agenda')) return Promise.resolve(ablauf());
    if (url.includes('/events/')) return Promise.resolve(termin());
    return Promise.resolve(json(200, { data: [] }));
  });
}

function zeige(p: { vorher?: number | null; nachher?: number | null } = {}) {
  const onTermin = vi.fn();
  const onZurueck = vi.fn();
  render(
    <TerminAnsicht
      start={startFuer()}
      terminId={7}
      zeitzone="Europe/Berlin"
      vorher={p.vorher ?? null}
      nachher={p.nachher ?? null}
      zurueck="Termine"
      onTermin={onTermin}
      onZurueck={onZurueck}
    />,
  );
  return { onTermin, onZurueck };
}

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TerminAnsicht (E6-1b)', () => {
  it('Kopf mit Datum, Beginn und Ende; der Ablauf mit Dauer neben der Zeit, Vorlauf und Linie „Beginn“', async () => {
    const spy = ct();
    zeige();
    expect(await screen.findByRole('heading', { name: 'Gottesdienst' })).toBeTruthy();
    const kopf = screen.getByRole('heading', { name: 'Gottesdienst' }).nextElementSibling!;
    expect(kopf.textContent).toBe('So, 18.10.2026 · 10:00 Uhr · Ende ca. 12:00 Uhr');
    const ablauf = screen.getByRole('region', { name: 'Ablauf' });
    expect(within(ablauf).getByText('Soundcheck')).toBeTruthy();
    expect(within(ablauf).getByText('30 Min')).toBeTruthy();
    expect(within(ablauf).getByText('Ankommen')).toBeTruthy();
    expect(within(ablauf).getByText(/Du großer Gott/)).toBeTruthy();
    expect(within(ablauf).getByText('mit Chor')).toBeTruthy();
    // Dauer steht in der Zeit-Spalte (Alwin: „Die Dauer bitte neben Zeit“) – nicht rechts am Titel.
    const zeit = within(ablauf).getByText('10:05').parentElement!;
    expect(zeit.textContent).toBe('10:055 Min');
    expect(within(ablauf).getByText(/Beginn/)).toBeTruthy();
    // Nur ansehen: Lieder sind keine Knöpfe.
    expect(within(ablauf).queryAllByRole('button')).toHaveLength(0);
    expect(
      spy.mock.calls.map((c) => new URL(String(c[0])).pathname + new URL(String(c[0])).search),
    ).toEqual(
      expect.arrayContaining(['/api/events/7?include=eventServices', '/api/events/7/agenda']),
    );
  });

  it('die Dienste nach Gruppe, mit denselben Plätzen wie in „Planen“ – offene Plätze als „frei“', async () => {
    ct();
    zeige();
    const dienste = await screen.findByRole('region', { name: 'Dienste' });
    expect(within(dienste).getByRole('heading', { name: 'Technik' })).toBeTruthy();
    expect(within(dienste).getByText('Ton')).toBeTruthy();
    expect(within(dienste).getByText('Licht')).toBeTruthy();
    expect(within(dienste).getByText('Alwin')).toBeTruthy();
    expect(within(dienste).getByText('frei')).toBeTruthy();
    // Nur ansehen: kein Platz ist ein Knopf.
    expect(within(dienste).queryAllByRole('button')).toHaveLength(0);
  });

  it('kein Ablauf (404) → „Noch kein Ablauf.“; leerer Ablauf → „noch leer“; die Dienste stehen trotzdem', async () => {
    ct({ ablauf: () => json(404, { message: 'Not found.' }) });
    zeige();
    expect(await screen.findByText('Noch kein Ablauf.')).toBeTruthy();
    expect(screen.getByText('Ton')).toBeTruthy();
    cleanup();
    vi.restoreAllMocks();
    ct({ ablauf: () => json(200, { data: { items: [] } }) });
    zeige();
    expect(await screen.findByText('Der Ablauf ist noch leer.')).toBeTruthy();
  });

  it('ein Termin ohne Dienste → Hinweis statt leerer Karte', async () => {
    ct({ termin: () => json(200, { data: { ...TERMIN, eventServices: [] } }) });
    zeige();
    expect(
      await screen.findByText('An diesem Termin stehen keine Dienste, die du sehen darfst.'),
    ).toBeTruthy();
  });

  it('Fehler → Fehlerkasten; „Erneut versuchen“ lädt neu; zurück geht auch im Fehlerfall', async () => {
    let erster = true;
    ct({
      termin: () => {
        if (erster) {
          erster = false;
          return json(502, {});
        }
        return json(200, { data: TERMIN });
      },
    });
    const { onZurueck } = zeige();
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByRole('heading', { name: 'Gottesdienst' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Termine/ }));
    expect(onZurueck).toHaveBeenCalled();
  });

  it('‹ › blättern zum vorigen/nächsten Termin; am Rand gesperrt', async () => {
    ct();
    const { onTermin } = zeige({ vorher: null, nachher: 9 });
    await screen.findByRole('heading', { name: 'Gottesdienst' });
    expect(screen.getByRole('button', { name: 'Voriger Termin' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Nächster Termin' }));
    expect(onTermin).toHaveBeenCalledWith(9);
  });
});
