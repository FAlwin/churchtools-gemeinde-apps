// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { diensteAus } from '@shared/ct/dienste';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import type { Plan } from '@shared/dienstplan/plan';
import { nachgebaut } from './entwurfAnschluss.testutil';
import { ladeTermin, ladeZeitraum } from './ladeTermine';
import { katalogAus } from './planEntwuerfe';
import { Planen } from './Planen';
import { startFuer } from './start.testutil';

/**
 * **Jeder Dienst, den man planen darf, steht in „Planen“ – auch ohne Platz** (Fund 20.11.2026: „Abendmahl“ in
 * „Moderation & Predigt“ war nirgends vorgesehen und deshalb weder im Filter noch als Zeile zu finden). Der Plan kommt
 * aus dem Lader (`ladeZeitraum` mit einer nachgebauten ChurchTools-Antwort), nicht aus einem handgebauten `planAus`.
 */
const START = startFuer({
  dienstgruppen: [
    { id: 3, name: 'Technik', fuerAlle: false },
    { id: 5, name: 'Moderation & Predigt', fuerAlle: false },
    { id: 6, name: 'Nur sehen', fuerAlle: false },
  ],
  dienste: diensteAus([
    { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7] },
    { id: 24, name: 'Abendmahl', serviceGroupId: 5, groupIds: [9] },
    { id: 30, name: 'Heimlich', serviceGroupId: 6, groupIds: [11] },
  ]),
  rechte: {
    planbareDienstgruppen: [3, 5],
    sichtbareDienstgruppen: null,
    ablaufKalender: [],
    terminKalender: [],
    abwesenheitenAller: false,
  },
});

const TERMIN = {
  id: 20,
  name: 'Gottesdienst',
  startDate: '2026-11-08T09:00:00Z',
  endDate: '2026-11-08T10:30:00Z',
  eventServices: [{ serviceId: 6, personId: null, name: null, index: 1 }],
};

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  window.settings = { base_url: 'https://ct.test/' };
  vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
    Promise.resolve(
      String(url).includes('/events/20') ? json({ data: TERMIN }) : json({ data: [TERMIN] }),
    ),
  );
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

const zeige = (plan: Plan, anzahl = vi.fn()) => {
  anzahl.mockImplementation((_e: number, _s: number, _g: number, neu: number) =>
    Promise.resolve({ ok: true as const, anzahl: neu }),
  );
  render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan, wochen: 8 }}
      handy={false}
      onNochmal={() => {}}
      onMehr={() => {}}
      mehrMoeglich={false}
      ladeZeitraum={() => new Promise<never>(() => {})}
      heute="2026-11-01"
      entwuerfe={nachgebaut({ anzahl })}
      katalog={katalogAus(START)}
    />,
  );
  return anzahl;
};

describe('Planen – Dienste ohne Platz', () => {
  it('ein planbarer, nirgends vorgesehener Dienst steht in der Matrix und lässt sich einschalten', async () => {
    const { plan } = await ladeZeitraum(START, '2026-11-01', '2026-11-30', 'Europe/Berlin');
    const anzahl = zeige(plan);
    // Die Gruppe und der Dienst sind da – mit „nicht vorgesehen“ am Termin.
    const zeile = (await screen.findByText('Abendmahl')).closest('tr')!;
    expect(within(zeile).getByLabelText('nicht vorgesehen')).toBeTruthy();
    // Über den Regler der Gruppe einschalten.
    fireEvent.click(
      screen.getByRole('button', { name: 'Plätze Moderation & Predigt am So, 08.11. ändern' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Abendmahl: ein Platz mehr' }));
    await waitFor(() => expect(anzahl).toHaveBeenCalledWith(20, 24, 0, 1));
  });

  it('auch im Filter-Menü ist der Dienst zu finden', async () => {
    const { plan } = await ladeZeitraum(START, '2026-11-01', '2026-11-30', 'Europe/Berlin');
    zeige(plan);
    fireEvent.click(await screen.findByRole('button', { name: /Filter/ }));
    expect(await screen.findAllByText('Abendmahl')).not.toHaveLength(0);
  });

  it('ein Dienst, den man nur sehen darf, bekommt keine leere Zeile', async () => {
    const { plan } = await ladeZeitraum(START, '2026-11-01', '2026-11-30', 'Europe/Berlin');
    expect(plan.gruppen.flatMap((g) => g.zeilen.map((z) => z.dienst.name))).toEqual([
      'Ton',
      'Abendmahl',
    ]);
  });

  it('die Termin-Ansicht bleibt bei dem, was es an dem Termin gibt', async () => {
    const { plan } = await ladeTermin(START, 20, 'Europe/Berlin');
    expect(plan.gruppen.flatMap((g) => g.zeilen.map((z) => z.dienst.name))).toEqual(['Ton']);
  });
});
