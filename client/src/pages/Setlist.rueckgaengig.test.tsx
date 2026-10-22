// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AgendaItem, Service } from '@shared/types/index';
import type { GeloeschterPunkt } from '@shared/ct/schreibKern';
import { TOUR_SETLIST, TOUR_SETLIST_EDIT } from '../utils/onboarding';

// Das PDF-Teilen braucht pdf.js samt Worker – hier nicht gebraucht, jsdom kennt keinen Worker.
vi.mock('../pdfSetup', () => ({}));

const { Setlist } = await import('./Setlist');

/**
 * „Rückgängig" im Bearbeiten-Modus (Alwin, 12.10.2026): Nach dem Löschen steht unten „„X" gelöscht ·
 * Rückgängig"; ein Tipp holt den Punkt mit dem Merkzettel zurück, den das Löschen geliefert hat.
 * (Verschieben → Rückgängig prüft der E2E-Test – Ziehen geht in jsdom nicht.)
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
  type: 'text',
  isHeader: false,
  responsible: [],
  responsibleText: '',
  song: null,
  time: '10:00',
  vorBeginn: false,
  durationMin: 5,
} as unknown as AgendaItem;

const ZETTEL: GeloeschterPunkt = {
  felder: {
    type: 'text',
    title: 'Begrüßung',
    note: '',
    duration: 300,
    responsible: '',
    serviceGroupNotes: [],
  },
  nachId: null,
  vorBeginn: false,
};

function zeige(zettel: GeloeschterPunkt | null) {
  const actions = {
    reorder: vi.fn(() => Promise.resolve()),
    update: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve(zettel)),
    restore: vi.fn(() => Promise.resolve()),
    add: vi.fn(() => Promise.resolve()),
    setVorBeginn: vi.fn(() => Promise.resolve()),
    setWeggelassen: vi.fn(() => Promise.resolve()),
  };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Setlist
        service={SERVICE}
        items={[ITEM]}
        isLoading={false}
        isError={false}
        onRetry={() => Promise.resolve()}
        onSelect={() => {}}
        onBack={() => {}}
        actions={actions}
        services={[]}
        canEdit
      />
    </QueryClientProvider>,
  );
  return actions;
}

async function loeschen(): Promise<void> {
  fireEvent.click(screen.getByTitle('Ablauf bearbeiten'));
  fireEvent.click(screen.getAllByLabelText('Bearbeiten')[0]);
  fireEvent.click(await screen.findByText('Eintrag löschen'));
  fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(`worship:onboard-${TOUR_SETLIST}`, '1');
  localStorage.setItem(`worship:onboard-${TOUR_SETLIST_EDIT}`, '1');
});

describe('Rückgängig nach dem Löschen', () => {
  it('bietet es an und holt den Punkt mit dem Merkzettel zurück', async () => {
    const actions = zeige(ZETTEL);
    await loeschen();
    expect(await screen.findByText('„Begrüßung" gelöscht')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));
    await waitFor(() => expect(actions.restore).toHaveBeenCalledWith(ZETTEL));
    expect(screen.queryByText('„Begrüßung" gelöscht')).toBeNull();
  });

  it('war der Punkt schon weg (kein Merkzettel), gibt es nichts anzubieten', async () => {
    const actions = zeige(null);
    await loeschen();
    await waitFor(() => expect(actions.remove).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull();
  });

  it('„Fertig" beendet das Angebot', async () => {
    zeige(ZETTEL);
    await loeschen();
    await screen.findByText('„Begrüßung" gelöscht');
    fireEvent.click(screen.getByTitle('Fertig'));
    fireEvent.click(screen.getByTitle('Ablauf bearbeiten'));
    expect(screen.queryByText('„Begrüßung" gelöscht')).toBeNull();
  });

  it('scheitert das Zurückholen, steht die Meldung oben', async () => {
    const actions = zeige(ZETTEL);
    actions.restore.mockImplementation(() =>
      Promise.reject(new Error('Der Ablauf hat sich geändert.')),
    );
    await loeschen();
    fireEvent.click(await screen.findByRole('button', { name: 'Rückgängig' }));
    expect(await screen.findByText('Der Ablauf hat sich geändert.')).toBeTruthy();
  });
});
