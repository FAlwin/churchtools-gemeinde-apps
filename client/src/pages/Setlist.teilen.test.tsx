// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AgendaItem, Service } from '@shared/types/index';
import type { BlattGruppe, TerminBlatt } from '@shared/ct/terminBlatt';
import { mapEventToService } from '@shared/ct/mapEvent';

/**
 * **Teilen in der Musik-App** (E8-1b): oben die Wahl „Liedblätter | Termin-Blatt“; ohne Liedblätter gleich das
 * Termin-Blatt. Die Dienste kommen nur in ChurchTools – auf dem eigenen Server steht das in der Zeile „Dienste“.
 */
const api = vi.hoisted(() => ({
  getTerminDienste: vi.fn<(id: number) => Promise<BlattGruppe[] | null>>(),
}));
vi.mock('../services/churchtoolsApi', async (orig) => ({
  ...(await orig<typeof import('../services/churchtoolsApi')>()),
  getTerminDienste: api.getTerminDienste,
}));
vi.mock('@ui/teilen/pdfSetup', () => ({}));
vi.mock('@ui/teilen/pdfSeiten', () => ({
  renderPdfToCanvases: vi.fn(() => Promise.resolve([])),
  renderPdfSeite: vi.fn(() => Promise.reject(new Error('jsdom'))),
}));
// Das Blatt wird festgehalten statt gezeichnet – geprüft wird, was die Musik-App hineingibt.
const blaetter = vi.hoisted(() => [] as unknown[]);
vi.mock('@ui/teilen/terminBlattPdf', () => ({
  terminBlattPdf: vi.fn(async (b: unknown) => {
    blaetter.push(b);
    const { jsPDF } = await import('jspdf');
    return new jsPDF();
  }),
}));

const { Setlist } = await import('./Setlist');

// Mit dem echten Erzeuger (`mapEventToService`) – seine Uhrzeit heißt „10:00 Uhr“. Ein Termin von Hand mit „10:00“ ließ
// den Fehler „10:00 Uhr Uhr“ im Kopf durch (Abnahme 05.11.2026).
const SERVICE: Service = mapEventToService(
  {
    id: 3,
    name: 'Gottesdienst',
    startDate: '2026-11-01T09:00:00Z',
    endDate: '2026-11-01T10:30:00Z',
  },
  1,
  null,
  'Europe/Berlin',
);

const BEGRUESSUNG = {
  id: 5,
  title: 'Begrüßung',
  type: 'normal',
  isHeader: false,
  responsible: [],
  responsibleText: '',
  song: null,
  time: '10:00',
  vorBeginn: false,
  durationMin: 5,
  note: '',
} as unknown as AgendaItem;

const LIED = {
  ...BEGRUESSUNG,
  id: 6,
  title: 'Lied',
  type: 'song',
  time: '10:05',
  song: {
    id: 11,
    title: 'Treu',
    chordpro: '{title: Treu}\n[G]Treu ist er',
    documents: [],
    versions: [],
    originalKey: 'G',
    bpm: 72,
    arrangementId: 1,
    arrangementName: 'Standard',
  },
} as unknown as AgendaItem;

const TECHNIK: BlattGruppe[] = [
  {
    id: 3,
    name: 'Technik',
    dienste: [{ name: 'Ton', personen: [{ name: 'Tobias Hahn', angefragt: false }], frei: 0 }],
  },
];

function zeige(items: AgendaItem[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <Setlist
        service={SERVICE}
        items={items}
        isLoading={false}
        isError={false}
        onRetry={() => Promise.resolve()}
        onSelect={() => {}}
        onBack={() => {}}
        actions={{} as never}
        services={[]}
      />
    </QueryClientProvider>,
  );
}
const teilen = () => fireEvent.click(screen.getByRole('button', { name: 'Ablauf als PDF teilen' }));
const letztesBlatt = () => blaetter.at(-1) as TerminBlatt;

beforeEach(() => {
  blaetter.length = 0;
  localStorage.clear();
});
afterEach(cleanup);

describe('Teilen in der Musik-App (E8-1b)', () => {
  it('ohne Liedblätter: „Teilen“ öffnet gleich das Termin-Blatt – mit den Diensten aus ChurchTools', async () => {
    api.getTerminDienste.mockResolvedValue(TECHNIK);
    zeige([BEGRUESSUNG]);
    teilen();
    expect(await screen.findByRole('dialog', { name: 'Termin teilen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Liedblätter' })).toBeNull();
    await waitFor(() => expect(letztesBlatt()?.dienste).toEqual(TECHNIK));
    expect(api.getTerminDienste).toHaveBeenCalledWith(3);
    const b = letztesBlatt();
    expect(b.app).toBe('Musik-App');
    expect(b.untertitel).toBe('Sonntag, 1. November 2026 · 10:00 – 10:05 Uhr');
    expect(b.ablauf?.zeilen.find((z) => z.art === 'beginn')).toEqual({
      art: 'beginn',
      zeit: '10:00',
    });
    expect(b.ablauf?.zeilen.at(-1)).toMatchObject({
      art: 'ende',
      zeit: '10:05',
      dauer: 'Dauer 5 Min',
    });
    expect(screen.getByRole('button', { name: /^Dienste/ }).textContent).toContain('Technik');
  });

  it('auf dem eigenen Server: die Zeile „Dienste“ sagt es, aufs Blatt kommen keine', async () => {
    api.getTerminDienste.mockResolvedValue(null);
    zeige([BEGRUESSUNG]);
    teilen();
    const zeile = await screen.findByRole('button', { name: /^Dienste/ });
    await waitFor(() => expect(zeile.textContent).toContain('nur in ChurchTools'));
    expect((zeile as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(letztesBlatt()?.dienste).toEqual([]));
  });

  it('Dienste nicht lesbar → Hinweis statt leerer Gruppen', async () => {
    api.getTerminDienste.mockRejectedValue(new Error('503'));
    zeige([BEGRUESSUNG]);
    teilen();
    const zeile = await screen.findByRole('button', { name: /^Dienste/ });
    await waitFor(() => expect(zeile.textContent).toContain('ließen sich gerade nicht laden'));
  });

  it('mit Liedblättern: erst „Liedblätter“, umschalten auf „Termin-Blatt“ – Lied mit Tonart und Arrangement', async () => {
    api.getTerminDienste.mockResolvedValue(TECHNIK);
    zeige([BEGRUESSUNG, LIED]);
    teilen();
    expect(await screen.findByRole('dialog', { name: 'Ablauf teilen' })).toBeTruthy();
    expect(api.getTerminDienste).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Termin-Blatt' }));
    expect(await screen.findByRole('dialog', { name: 'Termin teilen' })).toBeTruthy();
    // Arrangement einschalten – dann steht es am Lied.
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Termin teilen' })).getByRole('button', {
        name: /^Ablauf/,
      }),
    );
    fireEvent.click(screen.getByLabelText('Arrangement'));
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    await waitFor(() => {
      const lied = letztesBlatt()
        ?.ablauf?.zeilen.flatMap((z) => (z.art === 'eintrag' ? [z.zellen[2]] : []))
        .map((c) => c.absaetze.map((a) => a.laeufe.map((l) => l.text).join('')).join(' / '))
        .find((t) => t.includes('Treu'));
      expect(lied).toBe('Lied · TreuG / Arrangement Standard');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Liedblätter' }));
    expect(await screen.findByRole('dialog', { name: 'Ablauf teilen' })).toBeTruthy();
  });
});
