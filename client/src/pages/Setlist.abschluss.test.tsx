// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { schluessel } from '../hooks/abfrageSchluessel';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApiError } from '../services/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AgendaItem, Service } from '@shared/types/index';
import { ABLAUF_ABGESCHLOSSEN } from '@shared/ct/schreibKern';
import { TOUR_SETLIST, TOUR_SETLIST_EDIT } from '../utils/onboarding';

const api = vi.hoisted(() => ({ setAblaufAbgeschlossen: vi.fn() }));
vi.mock('../services/churchtoolsApi', async (orig) => ({
  ...(await orig<typeof import('../services/churchtoolsApi')>()),
  setAblaufAbgeschlossen: api.setAblaufAbgeschlossen,
}));

// Das PDF-Teilen braucht pdf.js samt Worker – hier nicht gebraucht, jsdom kennt keinen Worker.
vi.mock('../pdfSetup', () => ({}));

const { Setlist } = await import('./Setlist');

/**
 * **Abgeschlossener Ablauf** (Alwin, 09.10.2026): Beim Bearbeiten sagt die App, dass der Ablauf in
 * ChurchTools abgeschlossen ist, sperrt das Ändern und bietet „Ablauf öffnen" an. Ist er offen, schließt
 * das Schloss ihn nach Rückfrage ab. In der Ansicht bewusst kein Hinweis (Alwin).
 */
const SERVICE = {
  id: 1,
  day: '11',
  month: 'Okt',
  weekday: 'Sonntag',
  name: 'Gottesdienst',
  subtitle: null,
  date: '2026-10-11',
  start: '2026-10-11T10:00:00',
  time: '10:00',
  location: '',
  songCount: 0,
  setlistChanged: false,
} satisfies Service;

const ITEM = {
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
} as unknown as AgendaItem;

function zeige(
  abgeschlossen: boolean,
  remove: () => Promise<unknown> = () => Promise.resolve(),
  items: AgendaItem[] = [ITEM],
  gruppenVerborgen = false,
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const actions = {
    reorder: vi.fn(() => Promise.resolve()),
    update: vi.fn(() => Promise.resolve()),
    remove: vi.fn(remove),
    add: vi.fn(() => Promise.resolve()),
    setVorBeginn: vi.fn(() => Promise.resolve()),
    setWeggelassen: vi.fn(() => Promise.resolve()),
  };
  render(
    <QueryClientProvider client={qc}>
      <Setlist
        service={{ ...SERVICE, ablaufAbgeschlossen: abgeschlossen }}
        items={items}
        isLoading={false}
        isError={false}
        onRetry={() => Promise.resolve()}
        onSelect={() => {}}
        onBack={() => {}}
        actions={actions as never}
        services={[]}
        canEdit
        gruppenVerborgen={gruppenVerborgen}
      />
    </QueryClientProvider>,
  );
  return qc;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(`worship:onboard-${TOUR_SETLIST}`, '1');
  localStorage.setItem(`worship:onboard-${TOUR_SETLIST_EDIT}`, '1');
  api.setAblaufAbgeschlossen.mockReset().mockResolvedValue({ ok: true });
});

describe('Ablauf abgeschlossen', () => {
  it('in der Ansicht kein Hinweis und kein Schloss', () => {
    zeige(true);
    expect(screen.queryByText(/abgeschlossen/)).toBeNull();
    expect(screen.queryByTitle('Ablauf öffnen')).toBeNull();
  });

  /**
   * Alwin, 13.10.2026: „nur der Knopf" – kein Kasten mehr über dem Ablauf. Oben rechts „Ablauf öffnen"
   * statt „Ablauf abschließen"; wer trotzdem etwas ändern will, bekommt den Hinweis.
   */
  it('beim Bearbeiten: kein Kasten, oben „Ablauf öffnen" – öffnet ohne Rückfrage', async () => {
    zeige(true);
    fireEvent.click(screen.getByTitle('Ablauf bearbeiten'));
    expect(screen.queryByText(/abgeschlossen/)).toBeNull();
    expect(screen.queryByTitle('Ablauf abschließen')).toBeNull();
    fireEvent.click(screen.getByTitle('Ablauf öffnen'));
    await waitFor(() => expect(api.setAblaufAbgeschlossen).toHaveBeenCalledWith(1, false));
  });

  it('wer trotzdem ändern will – Punkt antippen oder Plus –, bekommt den Hinweis', async () => {
    zeige(true);
    fireEvent.click(screen.getByTitle('Ablauf bearbeiten'));
    fireEvent.click(screen.getAllByLabelText('Bearbeiten')[0]);
    expect(await screen.findByText(/Dieser Ablauf ist in ChurchTools abgeschlossen/)).toBeTruthy();
    expect(screen.queryByText('Eintrag löschen')).toBeNull(); // kein Bearbeiten-Fenster
  });

  it('auch das Plus zeigt den Hinweis statt des Fensters', async () => {
    zeige(true);
    fireEvent.click(screen.getByTitle('Ablauf bearbeiten'));
    fireEvent.click(screen.getByLabelText('Eintrag hinzufügen'));
    expect(await screen.findByText(/Dieser Ablauf ist in ChurchTools abgeschlossen/)).toBeTruthy();
    expect(screen.queryByText('Neuer Eintrag')).toBeNull();
  });

  it('offen: das Schloss schließt erst nach der Rückfrage ab', async () => {
    zeige(false);
    fireEvent.click(screen.getByTitle('Ablauf bearbeiten'));
    fireEvent.click(screen.getByTitle('Ablauf abschließen'));
    expect(api.setAblaufAbgeschlossen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Abschließen' }));
    await waitFor(() => expect(api.setAblaufAbgeschlossen).toHaveBeenCalledWith(1, true));
  });

  it('schließt ihn jemand anderes während des Bearbeitens: Meldung, und der Termin wird neu geholt', async () => {
    const qc = zeige(false, () => Promise.reject(new ApiError(423, ABLAUF_ABGESCHLOSSEN)));
    const neu = vi.spyOn(qc, 'invalidateQueries');
    fireEvent.click(screen.getByTitle('Ablauf bearbeiten'));
    fireEvent.click(screen.getAllByLabelText('Bearbeiten')[0]);
    fireEvent.click(await screen.findByText('Eintrag löschen'));
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(await screen.findByText(ABLAUF_ABGESCHLOSSEN)).toBeTruthy();
    expect(neu).toHaveBeenCalledWith({ queryKey: schluessel.termine() });
  });
});

describe('Leerer Ablauf (13.10.2026)', () => {
  it('hat trotzdem den Stift – sonst ließe sich ein leer angelegter Ablauf nicht füllen', () => {
    zeige(false, undefined, []);
    fireEvent.click(screen.getByTitle('Ablauf bearbeiten'));
    expect(screen.getByLabelText('Eintrag hinzufügen')).toBeTruthy();
  });
});

describe('Hinweis: nicht alle Dienstgruppen sichtbar (#676)', () => {
  it('die Musik-App reicht ihn an die Bearbeiten-Liste weiter', () => {
    zeige(false, undefined, [ITEM], true);
    fireEvent.click(screen.getByTitle('Ablauf bearbeiten'));
    expect(screen.getByText(/Du siehst nicht alle Dienstgruppen/)).toBeTruthy();
  });
});
