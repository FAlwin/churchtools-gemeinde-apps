// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { endeStelle, liveListe } from '@shared/ct/liveAgenda';
import { ausnahmeSetzen, wechselAus, zusammenfuehren, type Wechsel } from '@shared/ct/liveVerlauf';
import type { VerlaufTermin } from '@shared/ct/liveRueckblick';
import type { CtAgendaItem } from '@shared/ct/typen';
import { startFuer } from './start.testutil';
import { TerminAnsicht } from './TerminAnsicht';
import { AnzeigeKontext, STANDARD_ANZEIGE, type MeineAnzeige } from './meineAnzeige';

/**
 * **Rückblick und Ø in der Termin-Ansicht (L4-4)** – mit dem echten Laden des Termins (ChurchTools ist ersetzt) und dem
 * Live-Verlauf als Attrappe der Ablage (`./ladeVerlauf`). Die Verläufe entstehen aus den Erzeugern (`wechselAus`).
 */
const ablage = vi.hoisted(() => ({
  alle: vi.fn(),
  schreibeAusnahmen: vi.fn(),
  leeren: vi.fn(),
  ersetzen: vi.fn(),
}));
vi.mock('./ladeVerlauf', () => ({
  ladeAlleVerlaeufe: ablage.alle,
  schreibeAusnahmen: ablage.schreibeAusnahmen,
  verlaufCacheLeeren: ablage.leeren,
  verlaufImCacheErsetzen: ablage.ersetzen,
  ladeVerlauf: vi.fn(() =>
    Promise.resolve({ ok: true, wechsel: [], ausnahmen: [], vorhanden: false }),
  ),
  schreibeVerlauf: vi.fn(() => Promise.resolve({ ok: true, wechsel: [], ausnahmen: [] })),
}));

const T0 = Date.parse('2026-10-18T08:00:00Z');
const ITEMS = [
  { id: 1, type: 'normal', title: 'Begrüßung', duration: 600, at: 0 },
  { id: 2, type: 'song', title: 'Lied', duration: 300, song: { title: 'Halleluja' }, at: 10 },
  { id: 3, type: 'normal', title: 'Predigt', duration: 1800, at: 15 },
].map(({ at, ...i }) => ({
  ...i,
  startTimes: { '7': new Date(T0 + at * 60_000).toISOString() },
})) as CtAgendaItem[];
const liste = liveListe(ITEMS, 7);
const ENDE = endeStelle(liste);

const verlaufVon = (schritte: [number, number][], ab = T0): Wechsel[] =>
  schritte.reduce<Wechsel[]>(
    (acc, [stelle, sek]) => zusammenfuehren(acc, [wechselAus(liste, stelle, ab + sek * 1000)]),
    [],
  );
/** Beendet: Begrüßung 8 Min (Plan 10), Lied 4 Min, Predigt 36:40. */
const BEENDET = verlaufVon([
  [1, 0],
  [2, 480],
  [3, 720],
  [ENDE, 720 + 2200],
]);
const OFFEN = verlaufVon([
  [1, 0],
  [2, 480],
]);

const alsAntwort = (termine: Record<number, VerlaufTermin>) => ({
  ok: true as const,
  termine: new Map(Object.entries(termine).map(([k, v]) => [Number(k), v] as const)),
});

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
  calendar: { domainIdentifier: '2' },
  eventServices: [{ serviceId: 6, personId: 1, name: 'Alwin', isAccepted: true }],
};

function ct() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/csrftoken')) return Promise.resolve(json(200, { data: 'tok' }));
    if (url.pathname.endsWith('/agenda')) {
      return Promise.resolve(
        json(200, {
          data: {
            id: 907,
            calendarId: 2,
            isLocked: false,
            items: ITEMS.map((i, n) => ({ ...i, position: n })),
          },
        }),
      );
    }
    if (url.pathname.startsWith('/api/events/'))
      return Promise.resolve(json(200, { data: TERMIN }));
    return Promise.resolve(json(200, { data: [] }));
  });
}

const START = startFuer({
  rechte: { ...startFuer().rechte, ablaufKalender: [2] },
});
/** Wer nichts planen darf: die Dienste des Termins sind für ihn nicht planbar. */
const NUR_ANSEHEN = startFuer({
  rechte: { ...startFuer().rechte, planbareDienstgruppen: [], ablaufKalender: [] },
});

function zeige(start = START, terminId = 7, anzeige: Partial<MeineAnzeige> = {}) {
  const ansicht = (id: number) => (
    <AnzeigeKontext.Provider
      value={{
        anzeige: { ...STANDARD_ANZEIGE, ...anzeige },
        setzen: () => {},
        abgleichFehler: false,
      }}
    >
      <TerminAnsicht
        start={start}
        terminId={id}
        zeitzone="Europe/Berlin"
        vorher={null}
        nachher={null}
        zurueck="Termine"
        onTermin={vi.fn()}
        onZurueck={vi.fn()}
        heute="2026-10-30"
        handy={false}
      />
    </AnzeigeKontext.Provider>
  );
  const r = render(ansicht(terminId));
  return { ...r, wechsel: (id: number) => r.rerender(ansicht(id)) };
}

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  ablage.alle.mockReset();
  ablage.schreibeAusnahmen.mockReset();
  ablage.leeren.mockReset();
  ablage.ersetzen.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const rueckblick = () => screen.queryByRole('region', { name: 'Rückblick' });

describe('Rückblick im Termin (L4-4)', () => {
  it('zeigt die Karte unter dem Ablauf, sobald Live zu Ende war', async () => {
    ct();
    ablage.alle.mockResolvedValue(alsAntwort({ 7: { wechsel: BEENDET, ausnahmen: [] } }));
    zeige();
    const karte = await screen.findByRole('region', { name: 'Rückblick' });
    expect(within(karte).getByRole('heading', { name: /Live am 18\.10\./ })).toBeTruthy();
    const regionen = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(regionen.indexOf('Rückblick')).toBe(regionen.indexOf('Ablauf') + 1);
    // Gelaufen 8:00 (Plan 10:00): ± +2:00; Predigt 36:40
    expect(within(karte).getByText('36:40')).toBeTruthy();
  });

  it('läuft Live noch (kein „Ende“), gibt es keine Karte', async () => {
    ct();
    ablage.alle.mockResolvedValue(alsAntwort({ 7: { wechsel: OFFEN, ausnahmen: [] } }));
    zeige();
    await screen.findByRole('region', { name: 'Ablauf' });
    await waitFor(() => expect(ablage.alle).toHaveBeenCalled());
    expect(rueckblick()).toBeNull();
  });

  it('ohne Verlauf für diesen Termin (nur andere) keine Karte', async () => {
    ct();
    ablage.alle.mockResolvedValue(alsAntwort({ 99: { wechsel: BEENDET, ausnahmen: [] } }));
    zeige();
    await screen.findByRole('region', { name: 'Ablauf' });
    await waitFor(() => expect(ablage.alle).toHaveBeenCalled());
    expect(rueckblick()).toBeNull();
  });

  it('scheitert das Lesen (kein Recht, Netz): keine Karte, der Termin ist trotzdem ganz da', async () => {
    ct();
    ablage.alle.mockResolvedValue({ ok: false, grund: 'kein-recht' });
    zeige();
    await screen.findByRole('region', { name: 'Ablauf' });
    expect(screen.getByRole('region', { name: 'Dienste' })).toBeTruthy();
    await waitFor(() => expect(ablage.alle).toHaveBeenCalled());
    expect(rueckblick()).toBeNull();
  });

  it('wirft das Lesen, ist der Termin trotzdem ganz da', async () => {
    ct();
    ablage.alle.mockRejectedValue(new Error('Netz'));
    zeige();
    await screen.findByRole('region', { name: 'Ablauf' });
    await waitFor(() => expect(ablage.alle).toHaveBeenCalled());
    expect(rueckblick()).toBeNull();
  });

  it('gelesen wird einmal – auch beim Blättern zu einem anderen Termin', async () => {
    ct();
    ablage.alle.mockResolvedValue(alsAntwort({ 7: { wechsel: BEENDET, ausnahmen: [] } }));
    const { wechsel } = zeige();
    await screen.findByRole('region', { name: 'Rückblick' });
    wechsel(8);
    await screen.findByRole('region', { name: 'Ablauf' });
    expect(ablage.alle).toHaveBeenCalledTimes(1);
  });

  it('nach „Live“ wird der Verlauf neu gelesen – der Rückblick ist gleich da', async () => {
    ct();
    ablage.alle.mockResolvedValueOnce(alsAntwort({ 7: { wechsel: OFFEN, ausnahmen: [] } }));
    ablage.alle.mockResolvedValue(alsAntwort({ 7: { wechsel: BEENDET, ausnahmen: [] } }));
    zeige();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Live-Agenda von ChurchTools folgen' }),
    );
    await screen.findByRole('dialog', { name: /^Live:/ });
    expect(rueckblick()).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByRole('region', { name: 'Rückblick' })).toBeTruthy();
    expect(ablage.leeren).toHaveBeenCalledTimes(1);
    expect(ablage.alle).toHaveBeenCalledTimes(2);
  });

  it('Planer sehen „⋯“ und nehmen einen Punkt aus dem Schnitt – die Zeile trägt danach das Etikett', async () => {
    ct();
    ablage.alle.mockResolvedValue(alsAntwort({ 7: { wechsel: BEENDET, ausnahmen: [] } }));
    ablage.schreibeAusnahmen.mockImplementation((_t: number, neue: unknown[]) =>
      Promise.resolve({ ok: true, wechsel: BEENDET, ausnahmen: neue }),
    );
    zeige();
    const karte = await screen.findByRole('region', { name: 'Rückblick' });
    fireEvent.click(within(karte).getByRole('button', { name: 'Mehr – Predigt' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Aus dem Schnitt nehmen' }));
    await waitFor(() => expect(ablage.schreibeAusnahmen).toHaveBeenCalled());
    expect(ablage.schreibeAusnahmen.mock.calls[0][1]).toMatchObject([{ punkt: 3, aus: true }]);
    expect(await within(karte).findByText('nicht im Schnitt')).toBeTruthy();
    // Gemerkt auch im gehaltenen Stand – ohne neu zu lesen
    expect(ablage.ersetzen).toHaveBeenCalledWith(7, expect.objectContaining({ wechsel: BEENDET }));
    expect(ablage.alle).toHaveBeenCalledTimes(1);
  });

  it('wer nicht planen darf, sieht den Rückblick, aber kein „⋯“', async () => {
    ct();
    ablage.alle.mockResolvedValue(alsAntwort({ 7: { wechsel: BEENDET, ausnahmen: [] } }));
    zeige(NUR_ANSEHEN);
    const karte = await screen.findByRole('region', { name: 'Rückblick' });
    expect(within(karte).queryByRole('button', { name: /^Mehr/ })).toBeNull();
  });

  it('eine vorhandene Markierung kommt aus dem Speicher mit', async () => {
    ct();
    ablage.alle.mockResolvedValue(
      alsAntwort({ 7: { wechsel: BEENDET, ausnahmen: ausnahmeSetzen([], 3, true, T0) } }),
    );
    zeige();
    const karte = await screen.findByRole('region', { name: 'Rückblick' });
    expect(within(karte).getByText('nicht im Schnitt')).toBeTruthy();
  });
});

describe('Ø beim Ablauf bearbeiten (L4-4, A8)', () => {
  const VORHER = verlaufVon(
    [
      [1, 0],
      [2, 420],
      [3, 720],
      [ENDE, 720 + 1500],
    ],
    T0 - 7 * 86_400_000,
  );

  async function bearbeiten() {
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    return screen.getByRole('region', { name: 'Ablauf' });
  }

  it('leises „Ø m:ss“ unter der Dauer – Lieder zusammen, sonst nach Titel', async () => {
    ct();
    ablage.alle.mockResolvedValue(
      alsAntwort({
        7: { wechsel: BEENDET, ausnahmen: [] },
        6: { wechsel: VORHER, ausnahmen: [] },
      }),
    );
    zeige();
    await screen.findByRole('region', { name: 'Rückblick' });
    const ablauf = await bearbeiten();
    // Begrüßung: (8:00 + 7:00) / 2 = 7:30 · Lied (4:00 + 5:00) / 2 = 4:30 · Predigt (36:40 + 25:00) / 2 = 30:50
    expect(within(ablauf).getByText('Ø 7:30')).toBeTruthy();
    expect(within(ablauf).getByText('Ø 4:30')).toBeTruthy();
    expect(within(ablauf).getByText('Ø 30:50')).toBeTruthy();
  });

  it('in der Ansicht (nicht beim Bearbeiten) steht kein Ø im Ablauf', async () => {
    ct();
    ablage.alle.mockResolvedValue(
      alsAntwort({ 7: { wechsel: BEENDET, ausnahmen: [] }, 6: { wechsel: VORHER, ausnahmen: [] } }),
    );
    zeige();
    const ablauf = await screen.findByRole('region', { name: 'Ablauf' });
    await screen.findByRole('region', { name: 'Rückblick' });
    expect(within(ablauf).queryByText(/^Ø /)).toBeNull();
  });

  it('ohne Schnitt (noch keine Verläufe) steht nichts da', async () => {
    ct();
    ablage.alle.mockResolvedValue(alsAntwort({}));
    zeige();
    const ablauf = await bearbeiten();
    await waitFor(() => expect(ablage.alle).toHaveBeenCalled());
    expect(within(ablauf).queryByText(/^Ø /)).toBeNull();
  });

  it('ein ausgenommener Termin zählt im Ø nicht mit', async () => {
    ct();
    ablage.alle.mockResolvedValue(
      alsAntwort({
        7: { wechsel: BEENDET, ausnahmen: ausnahmeSetzen([], null, true, T0) },
        6: { wechsel: VORHER, ausnahmen: [] },
      }),
    );
    zeige();
    await screen.findByRole('region', { name: 'Rückblick' });
    const ablauf = await bearbeiten();
    expect(within(ablauf).getByText('Ø 7:00')).toBeTruthy();
    expect(within(ablauf).getByText('Ø 25:00')).toBeTruthy();
  });
});

describe('Meine Anzeige: Rückblick und Ø ausschalten (L4-5, A15)', () => {
  const VORHER = verlaufVon(
    [
      [1, 0],
      [2, 420],
      [3, 720],
      [ENDE, 720 + 1500],
    ],
    T0 - 7 * 86_400_000,
  );
  const beide = () =>
    ablage.alle.mockResolvedValue(
      alsAntwort({ 7: { wechsel: BEENDET, ausnahmen: [] }, 6: { wechsel: VORHER, ausnahmen: [] } }),
    );

  it('„Rückblick im Termin zeigen“ aus: keine Karte – das Ø beim Bearbeiten bleibt (eigener Schalter)', async () => {
    ct();
    beide();
    zeige(START, 7, { rueckblick: false });
    await screen.findByRole('region', { name: 'Ablauf' });
    await waitFor(() => expect(ablage.alle).toHaveBeenCalled());
    expect(rueckblick()).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    const ablauf = await screen.findByRole('region', { name: 'Ablauf' });
    expect(await within(ablauf).findByText('Ø 7:30')).toBeTruthy();
  });

  it('„Durchschnitt beim Ablauf bearbeiten“ aus: kein Ø – der Rückblick bleibt (eigener Schalter)', async () => {
    ct();
    beide();
    zeige(START, 7, { schnittBeimPlanen: false });
    await screen.findByRole('region', { name: 'Rückblick' });
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    const ablauf = screen.getByRole('region', { name: 'Ablauf' });
    expect(within(ablauf).queryByText(/^Ø /)).toBeNull();
  });

  it('Spalten: „Ø bisher“ und „±“ lassen sich einzeln ausblenden', async () => {
    ct();
    beide();
    zeige(START, 7, { spalteSchnitt: false });
    const karte = await screen.findByRole('region', { name: 'Rückblick' });
    expect(within(karte).queryByRole('columnheader', { name: 'Ø bisher' })).toBeNull();
    expect(within(karte).getByRole('columnheader', { name: '±' })).toBeTruthy();
    cleanup();
    zeige(START, 7, { spalteAbweichung: false });
    const karte2 = await screen.findByRole('region', { name: 'Rückblick' });
    expect(within(karte2).getByRole('columnheader', { name: 'Ø bisher' })).toBeTruthy();
    expect(within(karte2).queryByRole('columnheader', { name: '±' })).toBeNull();
  });
});
