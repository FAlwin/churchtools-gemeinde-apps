// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { diensteAus } from '@shared/ct/dienste';
import { mitAntworten, RUECKGAENGIG_MS } from '@shared/dienstplan/antworten';
import { termineAus, type RohPlatz, type RohTermin } from '@shared/dienstplan/termine';
import { LEERER_PLAN } from '@shared/dienstplan/zeile.testutil';
import { Startseite } from './Startseite';
import { Termine } from './Termine';
import { startFuer } from './start.testutil';
import { useAntworten } from './useAntworten';

/**
 * **Anfragen beantworten (E7-1) über die ganze Kette** – Startseite bzw. „Dienste“ → `useAntworten` → Kern → Browser-
 * Anschluss → ChurchTools. Ersetzt ist nur ChurchTools, nachgebaut wie gemessen (03.11.2026, `docs/messung-e7.md`):
 * `accept` sagt zu (neue ID), `decline` leert den Platz und hängt den Grund an, `undo` setzt zurück – nach einer Zusage
 * mit deren ID, nach einer Absage mit der ursprünglichen; sonst 400.
 */
vi.mock('./ladeBeiwerk', () => ({
  ladeLieder: vi.fn(() => Promise.resolve([])),
  ladeAbwesenheiten: vi.fn(() => Promise.resolve([])),
  ladeMusikApp: vi.fn(() => Promise.resolve(null)),
}));

const ICH = 19;
const tag = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const DIENSTE = diensteAus([
  { id: 9, name: 'Gesang', serviceGroupId: 4, allowDecline: true },
  { id: 6, name: 'Ton', serviceGroupId: 3, allowDecline: false },
]);

function json(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * ChurchTools mit Spikes offenen Anfragen: Gesang am Termin 166, Ton am Termin 167 (Ton erlaubt kein Absagen).
 * `ohneRecht`: Spike hat kein Recht auf die Dienste – ein Termin zeigt ihm nur seine eigenen Plätze (gemessen 03.11.2026).
 */
function ct({ ohneRecht = false } = {}) {
  let naechste = 900;
  const termine: RohTermin[] = [
    {
      id: 166,
      name: 'Gottesdienst',
      startDate: `${tag(5)}T09:00:00Z`,
      endDate: `${tag(5)}T10:30:00Z`,
      eventServices: [
        { id: 753, serviceId: 9, index: 1, personId: ICH, name: 'Spike', isAccepted: false },
      ],
    },
    {
      id: 167,
      name: 'Gebetsabend',
      startDate: `${tag(9)}T17:00:00Z`,
      endDate: `${tag(9)}T18:30:00Z`,
      eventServices: [
        { id: 760, serviceId: 6, index: null, personId: ICH, name: 'Spike', isAccepted: false },
      ],
    },
  ];
  const abgesagt = new Map<number, RohPlatz>();
  const anfragen: { pfad: string; rumpf: unknown }[] = [];
  let undoZuSpaet = false;
  const platzMit = (id: number) => {
    for (const t of termine) {
      const p = t.eventServices!.find((x) => x.id === id);
      if (p) return { t, p };
    }
    return null;
  };
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = new URL(String(input));
    const methode = init?.method ?? 'GET';
    if (url.pathname.endsWith('/csrftoken')) return Promise.resolve(json(200, { data: 't' }));
    const ev = /^\/api\/events\/(\d+)$/.exec(url.pathname);
    if (ev && methode === 'GET') {
      const t = termine.find((x) => x.id === Number(ev[1]));
      if (!t) return Promise.resolve(json(404, {}));
      const sicht = structuredClone(t);
      if (ohneRecht) sicht.eventServices = sicht.eventServices!.filter((p) => p.personId === ICH);
      return Promise.resolve(json(200, { data: sicht }));
    }
    const m = /^\/api\/events\/\d+\/servicerequests\/(\d+)\/(accept|decline|undo)$/.exec(
      url.pathname,
    );
    if (m && methode === 'POST') {
      const id = Number(m[1]);
      const rumpf = JSON.parse(String(init?.body ?? 'null')) as unknown;
      anfragen.push({ pfad: url.pathname, rumpf });
      const f = platzMit(id);
      if (m[2] === 'accept' && f) Object.assign(f.p, { id: naechste++, isAccepted: true });
      if (m[2] === 'decline' && f) {
        abgesagt.set(id, { ...f.p });
        const grund = (rumpf as { comment: string | null }).comment;
        Object.assign(f.p, { id: naechste++, personId: null, name: null, comment: grund });
      }
      if (m[2] === 'undo') {
        const alt = abgesagt.get(id);
        if (undoZuSpaet || (!alt && !(f && f.p.isAccepted))) {
          return Promise.resolve(json(400, { message: 'zu spät' }));
        }
        if (f) f.p.isAccepted = false;
        else if (alt) {
          const t = termine.find((x) =>
            x.eventServices!.some((p) => p.serviceId === alt.serviceId),
          )!;
          const i = t.eventServices!.findIndex((p) => p.serviceId === alt.serviceId);
          t.eventServices![i] = { ...alt, isAccepted: false };
          abgesagt.delete(id);
        }
      }
      return Promise.resolve(json(200, { data: null }));
    }
    return Promise.resolve(json(200, { data: [] }));
  });
  return {
    termine,
    anfragen,
    zuSpaet: () => (undoZuSpaet = true),
    /** Der Planer zieht die Anfrage zurück (in ChurchTools). */
    zurueckgezogen: (eventId: number) => {
      const p = termine.find((t) => t.id === eventId)!.eventServices![0];
      Object.assign(p, { id: naechste++, personId: null, name: null });
    },
  };
}

/** Startseite oder „Dienste“ mit dem echten Hook; nach jeder Antwort liest sie die Termine neu (wie die App). */
function Kette({ c, wo }: { c: ReturnType<typeof ct>; wo: 'start' | 'dienste' }) {
  const [roh, setRoh] = useState(() => structuredClone(c.termine));
  const a = useAntworten(ICH, () => setRoh(structuredClone(c.termine)));
  const zeilen = mitAntworten(
    termineAus(roh, {
      ichId: ICH,
      dienste: DIENSTE,
      planbar: () => false,
      zeitzone: 'Europe/Berlin',
    }),
    a.karte,
    a.jetzt,
  );
  const zustand = { art: 'fertig' as const, zeilen, plan: LEERER_PLAN, wochen: 8 };
  return wo === 'start' ? (
    <Startseite
      start={startFuer({ ichId: ICH })}
      termine={zustand}
      heute={tag(0)}
      onNochmal={() => {}}
      onMeineTermine={() => {}}
      antworten={a}
    />
  ) : (
    <Termine
      onTermin={() => {}}
      zustand={zustand}
      planer={false}
      onNochmal={() => {}}
      onMehr={() => {}}
      antworten={a}
    />
  );
}

const offen = () => within(screen.getByRole('region', { name: 'Für dich offen' }));

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Anfragen beantworten (E7-1)', () => {
  it('Zusagen: accept ohne Kommentar; danach „zugesagt“ mit „Rückgängig“ – „Rückgängig“ nimmt es zurück', async () => {
    const c = ct();
    render(<Kette c={c} wo="start" />);
    expect(screen.getByRole('button', { name: 'Alle zusagen' })).toBeTruthy();
    const gesang = offen().getByText('Gesang · Gottesdienst').closest('li')!;
    fireEvent.click(within(gesang).getByRole('button', { name: 'Zusagen' }));
    await within(gesang).findByText('zugesagt');
    expect(c.anfragen).toEqual([
      { pfad: '/api/events/166/servicerequests/753/accept', rumpf: { comment: null } },
    ]);
    // Nur noch eine offen: kein „Alle zusagen“ mehr.
    expect(screen.queryByRole('button', { name: 'Alle zusagen' })).toBeNull();
    fireEvent.click(within(gesang).getByRole('button', { name: 'Rückgängig' }));
    await within(gesang).findByRole('button', { name: 'Zusagen' });
    expect(c.anfragen.at(-1)).toEqual({
      pfad: '/api/events/166/servicerequests/900/undo',
      rumpf: { personId: ICH },
    });
  });

  it('Absagen: Fenster mit freiwilligem Grund; decline mit Grund; die Absage bleibt mit „Rückgängig“ stehen, undo mit der alten ID', async () => {
    const c = ct();
    render(<Kette c={c} wo="start" />);
    const gesang = offen().getByText('Gesang · Gottesdienst').closest('li')!;
    fireEvent.click(within(gesang).getByRole('button', { name: 'Absagen' }));
    const f = screen.getByRole('dialog', { name: 'Anfrage absagen' });
    expect(within(f).getByText(/Gesang · Gottesdienst/)).toBeTruthy();
    fireEvent.change(within(f).getByRole('textbox', { name: 'Grund (optional)' }), {
      target: { value: 'bin im Urlaub' },
    });
    fireEvent.click(within(f).getByRole('button', { name: 'Absagen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(c.anfragen).toEqual([
      { pfad: '/api/events/166/servicerequests/753/decline', rumpf: { comment: 'bin im Urlaub' } },
    ]);
    // ChurchTools kennt die Anfrage nicht mehr – sie steht trotzdem da, mit „Rückgängig“.
    const zeile = offen().getByText('Gesang · Gottesdienst').closest('li')!;
    expect(within(zeile).getByText('abgesagt')).toBeTruthy();
    // Die Plakette oben („Als Nächstes“) sagt dasselbe – nicht weiter „angefragt“.
    expect(screen.getByText('Gesang').closest('span')?.textContent).toMatch(/Gesang · abgesagt/);
    fireEvent.click(within(zeile).getByRole('button', { name: 'Rückgängig' }));
    await within(zeile).findByRole('button', { name: 'Zusagen' });
    expect(c.anfragen.at(-1)).toEqual({
      pfad: '/api/events/166/servicerequests/753/undo',
      rumpf: { personId: ICH },
    });
  });

  it('ohne Recht auf den Dienst (der freie Platz ist danach unsichtbar): abgesagt statt „gibt es nicht mehr“, Rückgängig klappt', async () => {
    const c = ct({ ohneRecht: true });
    render(<Kette c={c} wo="start" />);
    const gesang = offen().getByText('Gesang · Gottesdienst').closest('li')!;
    fireEvent.click(within(gesang).getByRole('button', { name: 'Absagen' }));
    const f = screen.getByRole('dialog', { name: 'Anfrage absagen' });
    fireEvent.click(within(f).getByRole('button', { name: 'Absagen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const zeile = offen().getByText('Gesang · Gottesdienst').closest('li')!;
    expect(within(zeile).getByText('abgesagt')).toBeTruthy();
    expect(screen.queryByText('Den Termin oder Platz gibt es nicht mehr.')).toBeNull();
    fireEvent.click(within(zeile).getByRole('button', { name: 'Rückgängig' }));
    await within(zeile).findByRole('button', { name: 'Zusagen' });
    expect(c.anfragen.map((a) => a.pfad)).toEqual([
      '/api/events/166/servicerequests/753/decline',
      '/api/events/166/servicerequests/753/undo',
    ]);
    expect(screen.queryByText('Den Termin oder Platz gibt es nicht mehr.')).toBeNull();
  });

  it('während des Absagens: nur „Sagt ab …“, der Zusagen-Knopf bleibt beschriftet, beide gesperrt', async () => {
    ct();
    render(<Kette c={ct()} wo="start" />);
    const fetch = vi.mocked(globalThis.fetch);
    const echt = fetch.getMockImplementation()!;
    fetch.mockImplementation((input, init) =>
      String(input).includes('/decline') ? new Promise<Response>(() => {}) : echt(input, init),
    );
    const gesang = offen().getByText('Gesang · Gottesdienst').closest('li')!;
    fireEvent.click(within(gesang).getByRole('button', { name: 'Absagen' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Anfrage absagen' })).getByRole('button', {
        name: 'Absagen',
      }),
    );
    expect(await screen.findByRole('button', { name: 'Sagt ab …' })).toBeTruthy();
    const zu = within(gesang).getByRole('button', { name: 'Zusagen' });
    expect(zu.hasAttribute('disabled')).toBe(true);
  });

  it('Dienst ohne „Absagen erlaubt“: Hinweis statt Knopf', () => {
    ct();
    render(<Kette c={ct()} wo="start" />);
    const ton = offen().getByText('Ton · Gebetsabend').closest('li')!;
    expect(within(ton).queryByRole('button', { name: 'Absagen' })).toBeNull();
    expect(
      within(ton).getByText('Absagen geht hier nicht – bitte sprich mit dem Planer.'),
    ).toBeTruthy();
  });

  it('„Alle zusagen“ ab zwei offenen Anfragen – eine nach der anderen', async () => {
    const c = ct();
    render(<Kette c={c} wo="start" />);
    fireEvent.click(screen.getByRole('button', { name: 'Alle zusagen' }));
    await waitFor(() => expect(offen().getAllByText('zugesagt')).toHaveLength(2));
    expect(c.anfragen.map((a) => a.pfad)).toEqual([
      '/api/events/166/servicerequests/753/accept',
      '/api/events/167/servicerequests/760/accept',
    ]);
    // Nichts mehr offen: kein „Alle zusagen“.
    expect(screen.queryByRole('button', { name: 'Alle zusagen' })).toBeNull();
  });

  it('inzwischen zurückgezogen: Meldung, nichts geschrieben, die Liste lädt neu', async () => {
    const c = ct();
    render(<Kette c={c} wo="start" />);
    c.zurueckgezogen(166);
    const gesang = offen().getByText('Gesang · Gottesdienst').closest('li')!;
    fireEvent.click(within(gesang).getByRole('button', { name: 'Zusagen' }));
    // Der Hinweis steht unten (Toast) – die Zeile verschwindet, weil die Liste neu lädt.
    expect((await screen.findByRole('status')).textContent).toMatch(
      /Die Anfrage hat sich inzwischen geändert/,
    );
    expect(c.anfragen).toEqual([]);
    // Neu geladen: Die Anfrage ist weg.
    await waitFor(() => expect(screen.queryByText('Gesang · Gottesdienst')).toBeNull());
  });

  it('zu spät fürs Rückgängig (400): Meldung, „Rückgängig“ verschwindet', async () => {
    const c = ct();
    render(<Kette c={c} wo="start" />);
    const gesang = offen().getByText('Gesang · Gottesdienst').closest('li')!;
    fireEvent.click(within(gesang).getByRole('button', { name: 'Zusagen' }));
    await within(gesang).findByText('zugesagt');
    c.zuSpaet();
    fireEvent.click(within(gesang).getByRole('button', { name: 'Rückgängig' }));
    expect(await within(gesang).findByRole('alert')).toHaveProperty(
      'textContent',
      'Zurücknehmen geht nur zehn Minuten lang – bitte in ChurchTools ändern.',
    );
    expect(within(gesang).queryByRole('button', { name: 'Rückgängig' })).toBeNull();
  });

  it('nach zehn Minuten fällt „Rückgängig“ weg – die Zusage steht dann unter „Deine nächsten Dienste“', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const c = ct();
    render(<Kette c={c} wo="start" />);
    const gesang = offen().getByText('Gesang · Gottesdienst').closest('li')!;
    fireEvent.click(within(gesang).getByRole('button', { name: 'Zusagen' }));
    await within(gesang).findByText('zugesagt');
    await act(async () => {
      vi.advanceTimersByTime(RUECKGAENGIG_MS - 30_000);
    });
    expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(45_000);
    });
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull();
    // Aus „Für dich offen“ verschwunden; der Termin ist „Als Nächstes“ und zeigt die Zusage dort.
    expect(offen().queryByText('Gesang · Gottesdienst')).toBeNull();
    expect(screen.getByText('Gesang').closest('span')?.textContent).toMatch(/Gesang · zugesagt/);
  });

  it('unter „Dienste“: „Gesang zusagen“ am Termin, darunter derselbe Zustand', async () => {
    const c = ct();
    render(<Kette c={c} wo="dienste" />);
    fireEvent.click(screen.getByRole('button', { name: 'Gesang zusagen' }));
    expect(await screen.findByText('Gesang zugesagt')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeTruthy();
    expect(c.anfragen).toEqual([
      { pfad: '/api/events/166/servicerequests/753/accept', rumpf: { comment: null } },
    ]);
  });
});
