// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AgendaItem, Service } from '@shared/types/index';
import { vorlagenStandAus } from '@shared/ct/ablaufVorlagenListe';
import { vorlagenRechteAus } from '@shared/ct/ablaufRecht';
import { schluessel } from '../hooks/abfrageSchluessel';
import { SETLIST_EDIT_STEPS, TOUR_SETLIST, TOUR_SETLIST_EDIT } from '../utils/onboarding';

const api = vi.hoisted(() => ({
  getVorlagenStand: vi.fn(),
  vorlageAusTermin: vi.fn(),
  vorlageMitTerminErsetzen: vi.fn(),
}));
vi.mock('../services/churchtoolsApi', async (orig) => ({
  ...(await orig<typeof import('../services/churchtoolsApi')>()),
  ...api,
}));
vi.mock('@ui/teilen/pdfSetup', () => ({}));

const { Setlist } = await import('./Setlist');

/**
 * **„Als Vorlage …“ im Ablauf (Musik-App, E10-V5):** Link nur im Bearbeiten-Modus und nur mit Recht im Kalender des
 * Termins; der Zugriff geht durch die Weiche (`churchtoolsApi`, damit Erweiterung und Server dasselbe tun), und danach
 * wird der Vorlagen-Zwischenspeicher von „Ablauf anlegen“ verworfen.
 */
const SERVICE = {
  id: 9,
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
  kalenderId: 2,
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

function zeige(vorlagenKalender: number[] | null | undefined, isAdmin = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const verworfen = vi.spyOn(qc, 'invalidateQueries');
  const actions = {
    reorder: vi.fn(() => Promise.resolve()),
    update: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve(null)),
    restore: vi.fn(() => Promise.resolve()),
    add: vi.fn(() => Promise.resolve()),
    setVorBeginn: vi.fn(() => Promise.resolve()),
    setWeggelassen: vi.fn(() => Promise.resolve()),
  };
  render(
    <QueryClientProvider client={qc}>
      <Setlist
        service={SERVICE}
        items={[ITEM]}
        isLoading={false}
        isError={false}
        onRetry={() => Promise.resolve()}
        onSelect={() => {}}
        onBack={() => {}}
        actions={actions as never}
        services={[]}
        canEdit
        vorlagenRechte={
          vorlagenKalender === undefined
            ? undefined
            : vorlagenRechteAus({ isAdmin, vorlagenKalender })
        }
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByTitle('Ablauf bearbeiten'));
  return verworfen;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(`worship:onboard-${TOUR_SETLIST}`, '1');
  localStorage.setItem(`worship:onboard-${TOUR_SETLIST_EDIT}`, '1');
  vi.clearAllMocks();
  api.getVorlagenStand.mockResolvedValue(
    vorlagenStandAus(
      [
        { id: 11, name: 'Sonntag', calendarId: 2, items: [{}], meta: { modifiedDate: 'S' } },
      ] as never,
      [{ id: 2, name: 'Gottesdienst' }] as never,
      'Europe/Berlin',
    ),
  );
  api.vorlageAusTermin.mockResolvedValue(77);
  api.vorlageMitTerminErsetzen.mockResolvedValue(undefined);
});

/** Das „⋯“-Menü des Kopfs ist offen (B8, R6: „Als Vorlage …“ und „Neu aufsetzen …“ liegen darin, nicht mehr in der Hinweiszeile). */
const menue = () => {
  if (!screen.queryByRole('menu')) fireEvent.click(screen.getByRole('button', { name: 'Mehr' }));
};
const link = () => {
  menue();
  return screen.queryByRole('menuitem', { name: /Als Vorlage/ });
};

describe('Link', () => {
  it('mit Recht im Kalender des Termins: im Bearbeiten-Modus, im „⋯“-Menü direkt vor „Neu aufsetzen …“', () => {
    zeige([2]);
    menue();
    const namen = screen.getAllByRole('menuitem').map((b) => b.textContent?.trim());
    expect(namen.indexOf('Als Vorlage …')).toBe(namen.indexOf('Neu aufsetzen …') - 1);
  });

  it('Recht für alle Kalender (null) und Admin: Link da', () => {
    zeige(null);
    expect(link()).toBeTruthy();
  });

  it.each([
    ['Recht nur für einen anderen Kalender', [3]],
    ['kein Vorlagen-Recht', []],
    ['Rechte unbekannt', undefined],
  ])('%s: kein Link', (_n, rechte) => {
    zeige(rechte);
    expect(link()).toBeNull();
    expect(screen.getByRole('menuitem', { name: /Neu aufsetzen/ })).toBeTruthy();
  });

  it('in der Ansicht (ohne Bearbeiten) steht er nicht', () => {
    zeige([2]);
    fireEvent.click(screen.getByTitle('Fertig'));
    expect(link()).toBeNull();
  });
});

describe('Einführung', () => {
  it('der Schritt „Mehr“ der Bearbeiten-Tour zeigt auf das „⋯“, das den Link enthält – und nennt ihn (B8)', () => {
    zeige([2]);
    const schritt = SETLIST_EDIT_STEPS.find((s) => s.title.startsWith('Mehr'));
    expect(schritt).toBeTruthy();
    expect(document.querySelector(schritt!.selector)).toBe(
      screen.getByRole('button', { name: 'Mehr' }),
    );
    expect(schritt!.body).toContain('Als Vorlage');
    expect(link()).toBeTruthy();
    expect(TOUR_SETLIST_EDIT).not.toBe('setlist-edit-v6');
  });
});

describe('Speichern über die Weiche', () => {
  it('neue Vorlage: Termin 9 und die Eingaben gehen an die Weiche, Zwischenspeicher verworfen, Bestätigung', async () => {
    const verworfen = zeige([2]);
    fireEvent.click(link()!);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Speichern' })).toHaveProperty('disabled', false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Als Vorlage „Gottesdienst“ gespeichert.')).toBeTruthy();
    expect(api.vorlageAusTermin).toHaveBeenCalledWith(9, { name: 'Gottesdienst', kalenderId: 2 });
    expect(
      verworfen.mock.calls.filter(
        ([o]) => JSON.stringify(o?.queryKey) === JSON.stringify(schluessel.ablaufVorlagen()),
      ),
    ).toHaveLength(1);
  });

  it('ersetzen: Vorlage, Termin und Stempel', async () => {
    zeige([2]);
    fireEvent.click(link()!);
    fireEvent.click(await screen.findByRole('button', { name: 'Vorhandene Vorlage ersetzen' }));
    // Nichts ist vorausgewählt (Alwin, 17.11.2026): bewusst die Vorlage antippen.
    fireEvent.click(await screen.findByRole('button', { name: /Sonntag/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ersetzen' }));
    expect(await screen.findByText('Vorlage „Sonntag“ ersetzt.')).toBeTruthy();
    expect(api.vorlageMitTerminErsetzen).toHaveBeenCalledWith(11, 9, 'S');
  });
});
