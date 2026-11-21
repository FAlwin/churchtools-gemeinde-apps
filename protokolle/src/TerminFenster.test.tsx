// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { TerminZeile } from '@shared/protokolle/termine';
import * as K from './terminAnlegen';
import { TerminFenster } from './TerminFenster';

/** Das Fenster „In Kalender eintragen“ allein (W14): Welcher Kalender vorausgewählt ist und was ein Wechsel auslöst. */
vi.mock('./kalenderListe', () => ({
  ladeSchreibKalender: vi.fn(() =>
    Promise.resolve([
      { id: 4, name: 'Gemeindeleitung' },
      { id: 2, name: 'Gottesdienst' },
    ]),
  ),
}));
vi.mock('./terminAnlegen', async (orig) => ({
  ...(await orig<typeof import('./terminAnlegen')>()),
  kalenderTermineAmTag: vi.fn(),
}));
vi.mock('./terminEintragen', () => ({ terminLegen: vi.fn(), NICHT_NACHGELESEN: 'x' }));
vi.mock('./terminStandSchreiben', () => ({ terminVermerken: vi.fn() }));

const tag = vi.mocked(K.kalenderTermineAmTag);
const ZEILE: TerminZeile = {
  schluessel: 'termin-s-b',
  gruppe: { id: 11, name: 'Leitungsteam' },
  sitzung: { id: 's', schluessel: 'p:s', titel: 'Festplanung', beginn: '2026-11-21T18:00:00Z' },
  blockId: 'b',
  text: 'Heiligabend, 16 Uhr',
  datum: '2027-12-24',
  punkt: null,
};

const zeigen = (gruppenKalender: number | null) =>
  render(
    <TerminFenster
      zeile={ZEILE}
      gruppenKalender={gruppenKalender}
      schreibbar={[4, 2]}
      ort={{ modul: 24, kategorie: 61 }}
      ich={1}
      zeitzone="Europe/Berlin"
      onFertig={vi.fn()}
      onClose={vi.fn()}
    />,
  );
const kalenderWahl = async () => await screen.findByLabelText<HTMLSelectElement>('Kalender');

beforeEach(() => {
  tag.mockResolvedValue([]);
});
afterEach(cleanup);

describe('Kalender im Fenster', () => {
  it('vorausgewählt ist der Kalender der Gruppe, wenn man dort eintragen darf – auch wenn er nicht der erste ist', async () => {
    zeigen(2);
    await waitFor(async () => expect((await kalenderWahl()).value).toBe('2'));
    expect(tag).toHaveBeenCalledWith(2, '2027-12-24');
  });

  it('darf man im Kalender der Gruppe nicht eintragen (oder gibt es keinen), gilt der erste der Liste', async () => {
    zeigen(9);
    await waitFor(async () => expect((await kalenderWahl()).value).toBe('4'));
    cleanup();
    zeigen(null);
    await waitFor(async () => expect((await kalenderWahl()).value).toBe('4'));
  });

  it('ein anderer Kalender: der Tag wird dort noch einmal geprüft – und „Trotzdem neu“ gilt nicht mehr', async () => {
    tag.mockImplementation((kalender) =>
      Promise.resolve(
        kalender === 4
          ? [{ id: 161, titel: 'Heiligabend – Familiengottesdienst', beginn: '' }]
          : [],
      ),
    );
    zeigen(4);
    const f = await screen.findByRole('dialog', { name: 'In Kalender eintragen' });
    await within(f).findByText(/schon „Heiligabend – Familiengottesdienst“/);
    fireEvent.click(within(f).getByLabelText(/Trotzdem neu anlegen/));
    fireEvent.change(await kalenderWahl(), { target: { value: '2' } });
    await waitFor(() => expect(within(f).queryByText(/schon „/)).toBeNull());
    fireEvent.change(await kalenderWahl(), { target: { value: '4' } });
    await within(f).findByText(/schon „Heiligabend/);
    // Zurück im ersten Kalender: wieder „Nur verknüpfen“ vorgewählt, nicht das frühere „Trotzdem“.
    expect(within(f).getByLabelText<HTMLInputElement>(/Nur verknüpfen/).checked).toBe(true);
  });
});
