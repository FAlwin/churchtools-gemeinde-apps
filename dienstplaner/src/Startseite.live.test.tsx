// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LEERER_PLAN, zeile, mein } from '@shared/dienstplan/zeile.testutil';
import { utcAus } from '@shared/ct/zeit';
import { Startseite } from './Startseite';
import { startFuer } from './start.testutil';
import { ladeAbwesenheiten, ladeAblauf, ladeLieder, ladeMusikApp } from './ladeBeiwerk';
import { ladeLiveLaeuft } from './ladeLive';

/**
 * **Knopf „Live-Ansicht“ in „Als Nächstes“** (Alwin 23.11.2026): am Tag des Termins ab 0 Uhr Ortszeit bis zum Ende, nur mit
 * Ablauf; ein Klick ruft `onLive` mit dem Termin. Feste Uhr (`Date`), die Zeitpunkte aus der Ortszeit (`utcAus`).
 * Gegenstück zur Zeitrechnung: `liveFenster.test.ts`; die Regel „läuft“: `ladeLive.test.ts`.
 */
vi.mock('./ladeBeiwerk', () => ({
  ladeLieder: vi.fn(),
  ladeAblauf: vi.fn(),
  ladeAbwesenheiten: vi.fn(),
  ladeMusikApp: vi.fn(),
}));
vi.mock('./ladeLive', () => ({ ladeLiveLaeuft: vi.fn() }));
const ablauf = vi.mocked(ladeAblauf);
const laeuft = vi.mocked(ladeLiveLaeuft);

const ZONE = 'Europe/Berlin';
const GOTTESDIENST = zeile(7, 'Gottesdienst', '2026-11-29', {
  beginn: utcAus('2026-11-29T10:00', ZONE),
  ende: utcAus('2026-11-29T11:30', ZONE),
  meine: [mein('Ton', true)],
});
const NACHT = zeile(8, 'Nachtgebet', '2026-11-28', {
  beginn: utcAus('2026-11-28T23:00', ZONE),
  ende: utcAus('2026-11-29T01:00', ZONE),
  uhrzeit: '23:00',
});

function uhr(lokal: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(utcAus(lokal, ZONE)));
}
function zeige(termin = GOTTESDIENST, mitLive = true) {
  const onLive = vi.fn();
  render(
    <Startseite
      start={startFuer({ gemeinde: null })}
      termine={{ art: 'fertig', zeilen: [termin], plan: LEERER_PLAN, wochen: 8 }}
      heute={termin.tag}
      zeitzone={ZONE}
      onNochmal={() => {}}
      onMeineTermine={() => {}}
      onTermin={() => {}}
      onLive={mitLive ? onLive : undefined}
    />,
  );
  return { onLive };
}
const knopf = () => screen.queryByRole('button', { name: /Live-Ansicht/ });

beforeEach(() => {
  vi.mocked(ladeLieder).mockResolvedValue([]);
  vi.mocked(ladeAbwesenheiten).mockResolvedValue([]);
  vi.mocked(ladeMusikApp).mockResolvedValue(null);
  ablauf.mockResolvedValue({ id: 31, items: [] });
  laeuft.mockResolvedValue(false);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Startseite: Knopf „Live-Ansicht“', () => {
  it('am Vortag 23:59 nicht – und es wird auch nichts nachgesehen', async () => {
    uhr('2026-11-28T23:59');
    zeige();
    await screen.findByText(/Du:/);
    expect(knopf()).toBeNull();
    expect(ablauf).not.toHaveBeenCalled();
  });

  it('am Tag um 00:00 ja – ein Klick öffnet genau diesen Termin', async () => {
    uhr('2026-11-29T00:00');
    const { onLive } = zeige();
    fireEvent.click(await screen.findByRole('button', { name: 'Live-Ansicht öffnen' }));
    expect(onLive).toHaveBeenCalledWith(7);
    expect(ablauf).toHaveBeenCalledWith(7);
  });

  it('läuft die Live-Agenda gerade, trägt der Knopf den roten Punkt und sagt es im Namen', async () => {
    uhr('2026-11-29T09:00');
    laeuft.mockResolvedValue(true);
    zeige();
    const k = await screen.findByRole('button', {
      name: 'Live-Ansicht – läuft gerade in ChurchTools',
    });
    expect(within(k).getByTestId('live-punkt')).toBeTruthy();
    expect(laeuft).toHaveBeenCalledWith(7, 31, []);
  });

  it('läuft sie nicht, oder ist das Nachsehen gescheitert: Knopf ohne Punkt', async () => {
    uhr('2026-11-29T09:00');
    zeige();
    const k = await screen.findByRole('button', { name: 'Live-Ansicht öffnen' });
    expect(within(k).queryByTestId('live-punkt')).toBeNull();
    cleanup();
    laeuft.mockRejectedValue(new Error('Netz'));
    zeige();
    const k2 = await screen.findByRole('button', { name: 'Live-Ansicht öffnen' });
    expect(within(k2).queryByTestId('live-punkt')).toBeNull();
  });

  it('nach dem Ende gibt es keinen Knopf (der Termin ist auch nicht mehr „Als Nächstes“)', async () => {
    uhr('2026-11-29T11:31');
    zeige();
    await waitFor(() => expect(screen.getByText(/keine Termine an/)).toBeTruthy());
    expect(knopf()).toBeNull();
  });

  it('Termin über Mitternacht: um 00:30 am Folgetag noch da, um 01:01 nicht mehr', async () => {
    uhr('2026-11-29T00:30');
    zeige(NACHT);
    expect(await screen.findByRole('button', { name: 'Live-Ansicht öffnen' })).toBeTruthy();
    cleanup();
    uhr('2026-11-29T01:01');
    zeige(NACHT);
    await screen.findByText(/keine Termine an/);
    expect(knopf()).toBeNull();
  });

  it('ohne Ablauf (404) kein Knopf – die Live-Ansicht hätte nichts zu zeigen', async () => {
    uhr('2026-11-29T09:00');
    ablauf.mockResolvedValue(null);
    zeige();
    await waitFor(() => expect(ablauf).toHaveBeenCalled());
    await screen.findByText(/Du:/);
    expect(knopf()).toBeNull();
  });

  it('ohne `onLive` (kein Anschluss) kein Knopf und kein Nachsehen', async () => {
    uhr('2026-11-29T09:00');
    zeige(GOTTESDIENST, false);
    await screen.findByText(/Du:/);
    expect(knopf()).toBeNull();
    expect(ablauf).not.toHaveBeenCalled();
  });
});
