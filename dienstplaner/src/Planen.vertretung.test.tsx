// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { planAus } from '@shared/dienstplan/plan';
import type { PersonenAntworten } from '@shared/dienstplan/personenAntworten';
import type { RohTermin } from '@shared/dienstplan/termine';
import type { Vertretung } from '@shared/dienstplan/verfuegbarkeit';
import { ApiError } from '@ui/ct/fehler';
import type { AntwortenLader } from './ladeAntworten';
import { daten, entwurf, nachgebaut } from './entwurfAnschluss.testutil';
import { Planen } from './Planen';
import { ganzSichtbar, planbar } from './start';
import { startFuer } from './start.testutil';

/**
 * **E5c-6, Entwurf Abschnitt 5:** In „Planen“ trägt ein **freier** Platz eines Dienstes, für den jemand eine Vertretung sucht,
 * das Schild „Vertretung gesucht“ (Hinweis: „Anna hat abgesagt · gefragt: Ben, Finn“). Der Platz bleibt, was er war. Echter
 * Plan und echte Matrix, die Antworten nachgebaut – die Markierung stammt aus `PersonenAntworten.vertretungen`.
 */
const START = startFuer();
const p = (serviceId: number, personId: number | null, name: string | null, index: number) => ({
  serviceId,
  personId,
  name,
  isAccepted: true,
  index,
});
const termin = (id: number, plaetze: ReturnType<typeof p>[]): RohTermin => ({
  id,
  name: 'Gottesdienst',
  startDate: '2026-11-20T18:00:00Z',
  endDate: '2026-11-20T19:30:00Z',
  eventServices: plaetze,
});
const planVon = (roh: RohTermin[]) =>
  planAus(roh, {
    ichId: START.ichId,
    dienste: START.dienste,
    dienstgruppen: START.dienstgruppen,
    zeitzone: 'Europe/Berlin',
    planbar: (d) => planbar(START, d),
    ganzSichtbar: (d) => ganzSichtbar(START, d),
  });

const MARKIERUNG: Vertretung = {
  dienst: 9,
  gefragt: [47, 48],
  seit: '2026-11-16T07:00:00.000Z',
  tag: '2026-11-20',
  index: 2,
  name: 'Anna Test',
  gefragtNamen: ['Ben Test', 'Finn Test'],
};
const antworten = (schluessel = '20:9', v: Vertretung = MARKIERUNG): PersonenAntworten => ({
  jePerson: new Map(),
  sichtbar: new Set([4]),
  vertretungen: new Map([[46, { [schluessel]: v }]]),
});

function zeige(
  roh: RohTermin[],
  lader: AntwortenLader | undefined,
  extra: Partial<ComponentProps<typeof Planen>> = {},
) {
  localStorage.setItem('dienstplaner.planen.ansicht', JSON.stringify({ unteransicht: 'matrix' }));
  return render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: planVon(roh), wochen: 8 }}
      handy={false}
      onNochmal={() => {}}
      onMehr={() => {}}
      mehrMoeglich={false}
      ladeZeitraum={() => new Promise<never>(() => {})}
      heute="2026-11-16"
      entwuerfe={nachgebaut({})}
      ladeMarkierungen={lader}
      {...extra}
    />,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const schild = () => screen.queryAllByText('Vertretung gesucht');
const FREI = [p(9, 5, 'Clara Test', 1), p(9, null, null, 2)];
const VOLL = [p(9, 5, 'Clara Test', 1), p(9, 7, 'Finn Test', 2)];

describe('Planen – Schild „Vertretung gesucht“ (E5c-6)', () => {
  it('am freien Platz des Dienstes: Schild mit dem Hinweis, der Platz bleibt ein Knopf zum Planen', async () => {
    zeige([termin(20, FREI)], () => Promise.resolve(antworten()));
    await waitFor(() => expect(schild()).toHaveLength(1));
    expect(schild()[0].closest('span')?.getAttribute('title')).toBe(
      'Anna Test hat abgesagt · gefragt: Ben Test, Finn Test',
    );
    // Planen geht dort normal weiter: Der freie Platz ist weiter der Knopf „Wer kann?“.
    expect(
      screen.getByRole('button', { name: /frei – Wer kann\? \(Platz 2 von 2\)/ }),
    ).toBeTruthy();
  });

  it('füllt schon ein Entwurf den freien Platz, bleibt das Schild trotzdem stehen – ChurchTools hat dort noch niemanden', async () => {
    const e = entwurf({ ort: { eventId: 20, serviceId: 9, index: 2 } });
    zeige([termin(20, FREI)], () => Promise.resolve(antworten()), {
      entwuerfe: nachgebaut({ laden: () => Promise.resolve(daten([e])) }),
    });
    await waitFor(() => expect(schild()).toHaveLength(1));
    expect(screen.queryByRole('button', { name: /frei – Wer kann\?/ })).toBeNull(); // der Platz zeigt den Entwurf
  });

  it('gilt nur, solange ein Platz frei ist: übernommen (kein freier Platz) → kein Schild, obwohl die Markierung noch steht', async () => {
    const lader = vi.fn<AntwortenLader>(() => Promise.resolve(antworten()));
    zeige([termin(20, VOLL)], lader);
    await waitFor(() => expect(lader).toHaveBeenCalled());
    await screen.findByText('Gesang');
    await new Promise((r) => setTimeout(r, 30)); // die Antworten sind da – dennoch kein Schild
    expect(schild()).toEqual([]);
  });

  it('Annas Platz 1 ist übernommen, Platz 2 war schon vorher frei: kein Schild – an Platz 2 sucht niemand', async () => {
    const lader = vi.fn<AntwortenLader>(() =>
      Promise.resolve(antworten('20:9', { ...MARKIERUNG, index: 1 })),
    );
    zeige([termin(20, [p(9, 7, 'Finn Test', 1), p(9, null, null, 2)])], lader);
    await waitFor(() => expect(lader).toHaveBeenCalled());
    await screen.findByText('Gesang');
    await new Promise((r) => setTimeout(r, 30));
    expect(schild()).toEqual([]);
  });

  it('zwei freie Plätze: das Schild steht nur an dem Platz mit dem gemerkten index (hier 2), nicht am ersten freien', async () => {
    zeige([termin(20, [p(9, null, null, 1), p(9, null, null, 2)])], () =>
      Promise.resolve(antworten()),
    );
    await waitFor(() => expect(schild()).toHaveLength(1));
    const platz2 = screen.getByRole('button', { name: /frei – Wer kann\? \(Platz 2 von 2\)/ });
    expect(platz2.nextElementSibling).toBe(schild()[0].closest('span'));
    const platz1 = screen.getByRole('button', { name: /frei – Wer kann\? \(Platz 1 von 2\)/ });
    expect(platz1.nextElementSibling).toBe(platz2);
  });

  it('nur zu diesem Termin und diesem Dienst: andere Termine und Dienste tragen es nicht', async () => {
    zeige([termin(20, [p(7, null, null, 1), p(9, 5, 'Clara Test', 1)])], () =>
      Promise.resolve(antworten('20:9')),
    );
    await screen.findByText('Gesang');
    await new Promise((r) => setTimeout(r, 30));
    // Licht (7) hat einen freien Platz, aber die Suche gilt für Gesang (9), und dort ist alles besetzt.
    expect(schild()).toEqual([]);
    cleanup();
    zeige([termin(21, FREI)], () => Promise.resolve(antworten('20:9')));
    await screen.findByText('Gesang');
    await new Promise((r) => setTimeout(r, 30));
    expect(schild()).toEqual([]);
  });

  it('ohne Lader und bei einem Ladefehler: kein Schild, die Matrix steht trotzdem (Beiwerk, kein Fehlerkasten)', async () => {
    zeige([termin(20, FREI)], undefined);
    expect(await screen.findByText('Gesang')).toBeTruthy();
    expect(schild()).toEqual([]);
    cleanup();
    zeige([termin(20, FREI)], () => Promise.reject(new ApiError(503, 'gerade nicht')));
    expect(await screen.findByText('Gesang')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 30));
    expect(schild()).toEqual([]);
    expect(screen.getByRole('button', { name: /frei – Wer kann\?/ })).toBeTruthy();
  });

  it('geladen wird für die planbaren Dienstgruppen (Technik 3, Musik 4) – die Suche läuft über die Antworten dieser Gruppen', async () => {
    const lader = vi.fn<AntwortenLader>(() => Promise.resolve(antworten()));
    zeige([termin(20, [...FREI, p(6, null, null, 1)])], lader);
    await waitFor(() => expect(lader).toHaveBeenCalled());
    expect([...lader.mock.calls[0][0]].sort()).toEqual([3, 4]);
  });
});
