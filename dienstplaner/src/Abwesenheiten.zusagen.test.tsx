// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Absence, AbsenceEvent } from '@shared/types/index';
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import type { Antworten } from '@shared/dienstplan/verfuegbarkeit';
import type { AbwesenheitenDienst } from '@ui/abwesenheiten/ctDienst';
import { Abwesenheiten } from './Abwesenheiten';
import { ladeMeineDienste } from './ladeBeiwerk';
import {
  KEINE_VERFUEGBARKEIT,
  ladeVerfuegbarkeit,
  richteAntwortenEin,
  speichereVerfuegbarkeit,
  type Verfuegbarkeit,
} from './ladeVerfuegbarkeit';

/**
 * **„Verfügbarkeit“ (E5c-1c)** – die Seite mit Ja · Vielleicht · Nein im Dienstplaner. Die Abwesenheiten (Nein) laufen
 * gegen eine Attrappe des ChurchTools-Dienstes, Ja/Vielleicht gegen eine Attrappe des Speichers, die wie ChurchTools
 * den geschriebenen Stand beim nächsten Laden zurückgibt. Wie Speicher und Rechte wirklich rechnen, prüft
 * `ladeVerfuegbarkeit.test.ts` (und im Kern `verfuegbarkeit.test.ts`).
 */
const dienst = {
  meine: vi.fn<AbwesenheitenDienst['meine']>(),
  termine: vi.fn<AbwesenheitenDienst['termine']>(),
  gruende: vi.fn<AbwesenheitenDienst['gruende']>(),
  anlegen: vi.fn<AbwesenheitenDienst['anlegen']>(),
  aendern: vi.fn<AbwesenheitenDienst['aendern']>(),
  loeschen: vi.fn<AbwesenheitenDienst['loeschen']>(),
};
vi.mock('@ui/abwesenheiten/ctDienst', () => ({ abwesenheitenDienst: () => dienst }));
vi.mock('./ladeBeiwerk', () => ({ ladeMeineDienste: vi.fn() }));
vi.mock('./ladeVerfuegbarkeit', async (orig) => ({
  ...(await orig<typeof import('./ladeVerfuegbarkeit')>()),
  ladeVerfuegbarkeit: vi.fn(),
  speichereVerfuegbarkeit: vi.fn(),
  richteAntwortenEin: vi.fn(),
}));
const laden = vi.mocked(ladeVerfuegbarkeit);
const speichern = vi.mocked(speichereVerfuegbarkeit);
const einrichten = vi.mocked(richteAntwortenEin);

const HEUTE = '2026-11-04';
const ev = (id: number, name: string, tag: string): AbsenceEvent => ({
  id,
  name,
  date: tag,
  startDate: `${tag}T09:00:00Z`,
  endDate: `${tag}T10:30:00Z`,
});
const TERMINE = [
  ev(1, 'Gottesdienst', '2026-11-08'),
  ev(2, 'Gebetsabend', '2026-11-11'),
  ev(3, 'Gottesdienst', '2026-11-15'),
];
const TECHNIK: Dienstgruppe = { id: 3, name: 'Technik', fuerAlle: false };
const GRUPPEN = [TECHNIK];

const antw = (x: Record<string, ['ja' | 'vielleicht', string]>): Antworten =>
  Object.fromEntries(Object.entries(x).map(([t, [a, tag]]) => [t, { a, tag }]));

/** Eine Abwesenheit, die genau einen Termin (den ganzen Tag) trifft. */
const abw = (id: number, von: string, bis: string = von): Absence => ({
  id,
  startDate: von,
  endDate: bis,
  startTime: null,
  endTime: null,
  reason: 'Abwesend',
  reasonId: 1,
  comment: '',
  vonApp: false,
});

/** Der Stand des Speichers – wird von der Attrappe beim erfolgreichen Speichern nachgezogen. */
let stand: Verfuegbarkeit;
const bereit = (antworten: Antworten = {}): Verfuegbarkeit => ({
  modul: 16,
  gruppen: [{ gruppe: TECHNIK, kategorie: 30, stand: 'bereit' }],
  bereit: [30],
  antworten,
  vertretungen: {},
  lesefehler: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  stand = bereit();
  dienst.meine.mockResolvedValue([]);
  dienst.termine.mockResolvedValue(TERMINE);
  dienst.gruende.mockResolvedValue([{ id: 1, name: 'Abwesend', standard: true }]);
  dienst.anlegen.mockResolvedValue({} as Absence);
  dienst.loeschen.mockResolvedValue(undefined);
  vi.mocked(ladeMeineDienste).mockResolvedValue(new Map());
  laden.mockImplementation(() => Promise.resolve(stand));
  speichern.mockImplementation((_v, _p, antworten) => {
    stand = { ...stand, antworten };
    return Promise.resolve({ ok: true });
  });
  einrichten.mockResolvedValue(undefined);
});

const zeige = (gruppen = GRUPPEN) =>
  render(
    <Abwesenheiten ichId={19} zeitzone="Europe/Berlin" heute={HEUTE} dienstgruppen={gruppen} />,
  );
/** Der Knopf „Ja“/„Vielleicht“/„Nein“ eines Termins. */
const knopf = (wahl: 'Ja' | 'Vielleicht' | 'Nein', name: string, tag: string) =>
  screen.getByRole<HTMLButtonElement>('button', { name: `${wahl} – ${name}, ${tag}` });
const GD1 = 'So, 08.11.';
const GA = 'Mi, 11.11.';
/** Warten, bis die Seite Termine UND die Antworten geladen hat. */
const bereitSein = async () => {
  await screen.findByText('Gebetsabend');
  await waitFor(() => expect(laden).toHaveBeenCalled());
  await act(async () => {
    await Promise.resolve();
  });
};
const klick = async (el: HTMLElement) => {
  await act(async () => {
    fireEvent.click(el);
    await Promise.resolve();
  });
};
const speichereKlick = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await new Promise((r) => setTimeout(r, 0));
  });
};
/** Die Speichern-Leiste (der Toast hat dieselbe Rolle). */
const leiste = () =>
  screen.queryAllByRole('status').find((e) => /vorgemerkt/.test(e.textContent ?? ''));
const gedrueckt = (el: HTMLElement) => el.getAttribute('aria-pressed') === 'true';

describe('Drei Knöpfe statt des Hakens', () => {
  it('je Termin Ja · Vielleicht · Nein in einer Gruppe; nichts gewählt, kein „Abwesend“-Haken mehr', async () => {
    zeige();
    await bereitSein();
    expect(screen.getAllByRole('group', { name: /^Antwort – / })).toHaveLength(3);
    for (const w of ['Ja', 'Vielleicht', 'Nein'] as const) {
      expect(gedrueckt(knopf(w, 'Gottesdienst', GD1))).toBe(false);
    }
    expect(screen.queryByRole('button', { name: /^Abwesend – / })).toBeNull();
  });

  it('gespeicherte Antworten sind gewählt gezeigt, ohne Vormerkung (keine Leiste)', async () => {
    stand = bereit(antw({ '1': ['ja', '2026-11-08'], '2': ['vielleicht', '2026-11-11'] }));
    zeige();
    await bereitSein();
    expect(gedrueckt(knopf('Ja', 'Gottesdienst', GD1))).toBe(true);
    expect(gedrueckt(knopf('Vielleicht', 'Gebetsabend', GA))).toBe(true);
    expect(leiste()).toBeUndefined();
  });

  it('Ja/Vielleicht vormerken: gewählt, Leiste zählt, „Verwerfen“ nimmt alles zurück', async () => {
    zeige();
    await bereitSein();
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    await klick(knopf('Vielleicht', 'Gebetsabend', GA));
    expect(gedrueckt(knopf('Ja', 'Gottesdienst', GD1))).toBe(true);
    expect(leiste()!.textContent).toContain('2 Änderungen vorgemerkt');
    await klick(screen.getByRole('button', { name: 'Verwerfen' }));
    expect(gedrueckt(knopf('Ja', 'Gottesdienst', GD1))).toBe(false);
    expect(gedrueckt(knopf('Vielleicht', 'Gebetsabend', GA))).toBe(false);
    expect(leiste()).toBeUndefined();
    expect(speichern).not.toHaveBeenCalled();
  });

  it('Ja ↔ Vielleicht wechselt; noch einmal auf den aktiven Knopf → Vormerkung weg', async () => {
    zeige();
    await bereitSein();
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    await klick(knopf('Vielleicht', 'Gottesdienst', GD1));
    expect(gedrueckt(knopf('Ja', 'Gottesdienst', GD1))).toBe(false);
    expect(gedrueckt(knopf('Vielleicht', 'Gottesdienst', GD1))).toBe(true);
    await klick(knopf('Vielleicht', 'Gottesdienst', GD1));
    expect(gedrueckt(knopf('Vielleicht', 'Gottesdienst', GD1))).toBe(false);
    expect(leiste()).toBeUndefined();
  });
});

describe('Speichern', () => {
  it('erst die Abwesenheiten, danach EIN Aufruf mit der vollständigen Karte (gespeichert + vorgemerkt, Tag des Termins)', async () => {
    stand = bereit(antw({ '3': ['vielleicht', '2026-11-15'] }));
    zeige();
    await bereitSein();
    await klick(knopf('Nein', 'Gottesdienst', GD1));
    await klick(knopf('Ja', 'Gebetsabend', GA));
    await speichereKlick();
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(dienst.anlegen).toHaveBeenCalledTimes(1);
    expect(dienst.anlegen.mock.calls[0][0]).toMatchObject({ startDate: '2026-11-08' });
    expect(speichern.mock.calls[0][2]).toEqual(
      antw({ '2': ['ja', '2026-11-11'], '3': ['vielleicht', '2026-11-15'] }),
    );
    expect(speichern.mock.calls[0][3]).toBe(HEUTE);
    // Reihenfolge: die Abwesenheit zuerst.
    expect(dienst.anlegen.mock.invocationCallOrder[0]).toBeLessThan(
      speichern.mock.invocationCallOrder[0],
    );
    expect(await screen.findByText(/2 Änderungen gespeichert/)).not.toBeNull();
    // Danach neu geladen: die gespeicherte Antwort steht ohne Vormerkung da.
    await waitFor(() => expect(leiste()).toBeUndefined());
    expect(gedrueckt(knopf('Ja', 'Gebetsabend', GA))).toBe(true);
  });

  it('noch einmal auf eine gespeicherte Antwort → sie fällt aus der Karte', async () => {
    stand = bereit(antw({ '1': ['ja', '2026-11-08'], '3': ['vielleicht', '2026-11-15'] }));
    zeige();
    await bereitSein();
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    expect(gedrueckt(knopf('Ja', 'Gottesdienst', GD1))).toBe(false);
    await speichereKlick();
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(speichern.mock.calls[0][2]).toEqual(antw({ '3': ['vielleicht', '2026-11-15'] }));
  });

  it('nur Abwesenheiten geändert, Antworten gleich → kein Aufruf an den Speicher', async () => {
    zeige();
    await bereitSein();
    await klick(knopf('Nein', 'Gottesdienst', GD1));
    await speichereKlick();
    await waitFor(() => expect(dienst.anlegen).toHaveBeenCalledTimes(1));
    expect(speichern).not.toHaveBeenCalled();
  });

  it('Ja → Nein: die Abwesenheit wird eingetragen UND die Ja-Antwort beim Speichern entfernt', async () => {
    stand = bereit(antw({ '1': ['ja', '2026-11-08'], '3': ['ja', '2026-11-15'] }));
    zeige();
    await bereitSein();
    await klick(knopf('Nein', 'Gottesdienst', GD1));
    expect(gedrueckt(knopf('Nein', 'Gottesdienst', GD1))).toBe(true);
    expect(gedrueckt(knopf('Ja', 'Gottesdienst', GD1))).toBe(false);
    // Ein Schritt für die Person: eine Änderung.
    expect(leiste()!.textContent).toContain('1 Änderung vorgemerkt');
    await speichereKlick();
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(dienst.anlegen).toHaveBeenCalledTimes(1);
    expect(speichern.mock.calls[0][2]).toEqual(antw({ '3': ['ja', '2026-11-15'] }));
  });

  it('Nein → Ja: die Abwesenheit wird entfernt (vorhandener Weg) und Ja vorgemerkt – eine Änderung', async () => {
    dienst.meine.mockResolvedValue([abw(77, '2026-11-08')]);
    zeige();
    await bereitSein();
    expect(gedrueckt(knopf('Nein', 'Gottesdienst', GD1))).toBe(true);
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    expect(gedrueckt(knopf('Ja', 'Gottesdienst', GD1))).toBe(true);
    expect(gedrueckt(knopf('Nein', 'Gottesdienst', GD1))).toBe(false);
    expect(leiste()!.textContent).toContain('1 Änderung vorgemerkt');
    await speichereKlick();
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(dienst.loeschen).toHaveBeenCalledWith(77);
    expect(dienst.loeschen.mock.invocationCallOrder[0]).toBeLessThan(
      speichern.mock.invocationCallOrder[0],
    );
    expect(speichern.mock.calls[0][2]).toEqual(antw({ '1': ['ja', '2026-11-08'] }));
  });

  it('Nein → Ja bei einem Zeitraum: erst die Rückfrage; Ja wird erst mit „Zeitraum löschen“ vorgemerkt', async () => {
    dienst.meine.mockResolvedValue([abw(78, '2026-11-08', '2026-11-10')]);
    zeige();
    await bereitSein();
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    expect(screen.getByText('Teil eines Zeitraums')).not.toBeNull();
    // Nichts vorgemerkt, solange nicht entschieden ist.
    expect(leiste()).toBeUndefined();
    await klick(screen.getByRole('button', { name: 'Zeitraum löschen' }));
    expect(gedrueckt(knopf('Ja', 'Gottesdienst', GD1))).toBe(true);
    expect(leiste()!.textContent).toContain('1 Änderung vorgemerkt');
    await speichereKlick();
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(dienst.loeschen).toHaveBeenCalledWith(78);
    expect(speichern.mock.calls[0][2]).toEqual(antw({ '1': ['ja', '2026-11-08'] }));
  });

  it('Rückfrage abgebrochen → keine Ja-Vormerkung', async () => {
    dienst.meine.mockResolvedValue([abw(78, '2026-11-08', '2026-11-10')]);
    zeige();
    await bereitSein();
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    fireEvent.keyDown(document, { key: 'Escape' });
    // Egal wie das Fenster zugeht: ohne „Zeitraum löschen“ ist nichts vorgemerkt.
    expect(gedrueckt(knopf('Nein', 'Gottesdienst', GD1))).toBe(true);
    expect(gedrueckt(knopf('Ja', 'Gottesdienst', GD1))).toBe(false);
  });
});

describe('Die ChurchTools-Abwesenheit gilt', () => {
  it('steht eine Abwesenheit, zeigt der Termin „Nein“ – auch bei einer alten Ja-Antwort (und es wird nichts vorgemerkt)', async () => {
    stand = bereit(antw({ '1': ['ja', '2026-11-08'] }));
    dienst.meine.mockResolvedValue([abw(77, '2026-11-08')]);
    zeige();
    await bereitSein();
    expect(gedrueckt(knopf('Nein', 'Gottesdienst', GD1))).toBe(true);
    expect(gedrueckt(knopf('Ja', 'Gottesdienst', GD1))).toBe(false);
    expect(leiste()).toBeUndefined();
  });

  it('Nein wieder wegnehmen: die vorgemerkte Ja-Antwort kommt zurück, nichts bleibt vorgemerkt', async () => {
    stand = bereit(antw({ '1': ['ja', '2026-11-08'] }));
    zeige();
    await bereitSein();
    await klick(knopf('Nein', 'Gottesdienst', GD1));
    await klick(knopf('Nein', 'Gottesdienst', GD1));
    expect(gedrueckt(knopf('Ja', 'Gottesdienst', GD1))).toBe(true);
    expect(leiste()).toBeUndefined();
  });
});

describe('Teilergebnisse werden ehrlich gemeldet', () => {
  it('Abwesenheit gespeichert, Ja/Vielleicht nicht → die Meldung sagt beides; die Antwort bleibt vorgemerkt', async () => {
    speichern.mockResolvedValue({
      ok: false,
      text: 'Für „Technik“ nicht gespeichert: ChurchTools antwortet gerade nicht. Nichts verloren – bitte gleich noch einmal versuchen.',
    });
    zeige();
    await bereitSein();
    await klick(knopf('Nein', 'Gottesdienst', GD1));
    await klick(knopf('Ja', 'Gebetsabend', GA));
    await speichereKlick();
    const meldung = await screen.findByText(/Abwesenheiten gespeichert\./);
    expect(meldung.textContent).toContain('Für „Technik“ nicht gespeichert');
    expect(dienst.anlegen).toHaveBeenCalledTimes(1);
    // Die Abwesenheit ist durch; übrig bleibt nur die Ja-Antwort – „noch einmal“ schreibt keine Abwesenheit doppelt.
    await waitFor(() => expect(leiste()!.textContent).toContain('1 Änderung'));
    expect(gedrueckt(knopf('Ja', 'Gebetsabend', GA))).toBe(true);
    await speichereKlick();
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(2));
    expect(dienst.anlegen).toHaveBeenCalledTimes(1);
  });

  it('nur Ja/Vielleicht geändert und gescheitert → die Meldung ohne „Abwesenheiten gespeichert“', async () => {
    speichern.mockResolvedValue({ ok: false, text: 'Für „Technik“ nicht gespeichert: Test.' });
    zeige();
    await bereitSein();
    await klick(knopf('Vielleicht', 'Gebetsabend', GA));
    await speichereKlick();
    expect(await screen.findByText('Für „Technik“ nicht gespeichert: Test.')).not.toBeNull();
    expect(screen.queryByText(/Abwesenheiten gespeichert/)).toBeNull();
    expect(leiste()!.textContent).toContain('1 Änderung');
  });

  /**
   * Fund 18.11.2026 (Test-Instanz): Jemand hatte anderswo inzwischen umgestellt, das Speichern scheiterte an der
   * Abwesenheit. Die Abwesenheiten kamen frisch, Ja/Vielleicht blieben auf dem alten Stand – der Termin stand ohne
   * Antwort da, obwohl im Speicher „Vielleicht“ lag. Nach JEDEM Speicherversuch müssen beide neu geladen werden.
   */
  it('Abwesenheit scheitert → Ja/Vielleicht werden trotzdem frisch geladen (anderswo Geändertes erscheint)', async () => {
    dienst.anlegen.mockRejectedValue(new Error('weg'));
    zeige();
    await bereitSein();
    expect(gedrueckt(knopf('Vielleicht', 'Gebetsabend', GA))).toBe(false);
    // Inzwischen sagt dieselbe Person auf einem anderen Gerät „Vielleicht“ zum Gebetsabend.
    stand = bereit(antw({ '2': ['vielleicht', '2026-11-11'] }));
    await klick(knopf('Nein', 'Gottesdienst', GD1));
    await speichereKlick();
    expect(await screen.findByText(/Konnte nicht gespeichert werden/)).not.toBeNull();
    expect(speichern).not.toHaveBeenCalled();
    await waitFor(() => expect(gedrueckt(knopf('Vielleicht', 'Gebetsabend', GA))).toBe(true));
  });

  it('der Speicher wirft → eine verständliche Meldung, nichts geht verloren', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    speichern.mockRejectedValue(new Error('boom'));
    zeige();
    await bereitSein();
    await klick(knopf('Ja', 'Gebetsabend', GA));
    await speichereKlick();
    expect(
      await screen.findByText(/Ja\/Vielleicht konnte nicht gespeichert werden/),
    ).not.toBeNull();
    expect(gedrueckt(knopf('Ja', 'Gebetsabend', GA))).toBe(true);
  });
});

describe('Gesperrt, wenn Ja/Vielleicht nicht gespeichert werden kann', () => {
  it('keine bereite Kategorie: Ja und Vielleicht gesperrt, Hinweis oben, Nein geht', async () => {
    stand = {
      ...bereit(),
      bereit: [],
      gruppen: [{ gruppe: TECHNIK, kategorie: 30, stand: 'nur-lesen' }],
    };
    zeige();
    await bereitSein();
    expect(
      screen.getByText(/Ja\/Vielleicht ist für deine Dienstgruppen noch nicht eingerichtet/),
    ).not.toBeNull();
    expect(knopf('Ja', 'Gottesdienst', GD1).disabled).toBe(true);
    expect(knopf('Vielleicht', 'Gottesdienst', GD1).disabled).toBe(true);
    expect(knopf('Nein', 'Gottesdienst', GD1).disabled).toBe(false);
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    expect(leiste()).toBeUndefined();
    await klick(knopf('Nein', 'Gottesdienst', GD1));
    expect(leiste()!.textContent).toContain('1 Änderung');
  });

  it('ohne eigene Dienstgruppe: gesperrt, ohne Netzaufruf', async () => {
    laden.mockImplementation(() => Promise.resolve(KEINE_VERFUEGBARKEIT));
    zeige([]);
    await bereitSein();
    expect(screen.getByText(/in keiner Dienstgruppe/)).not.toBeNull();
    expect(knopf('Ja', 'Gottesdienst', GD1).disabled).toBe(true);
  });

  it('Laden der Antworten scheitert → gesperrt mit Hinweis, die Seite (Nein) geht weiter', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    laden.mockRejectedValue(new Error('504'));
    zeige();
    await bereitSein();
    expect(await screen.findByText(/Ja\/Vielleicht geht gerade nicht/)).not.toBeNull();
    expect(knopf('Ja', 'Gottesdienst', GD1).disabled).toBe(true);
    expect(knopf('Nein', 'Gottesdienst', GD1).disabled).toBe(false);
  });

  it('darf man Kategorien anlegen: „Einrichten“ daneben, danach sind Ja/Vielleicht frei', async () => {
    stand = {
      modul: 16,
      gruppen: [{ gruppe: TECHNIK, kategorie: null, stand: 'einrichtbar' }],
      bereit: [],
      antworten: {},
      vertretungen: {},
      lesefehler: null,
    };
    zeige();
    await bereitSein();
    expect(knopf('Ja', 'Gottesdienst', GD1).disabled).toBe(true);
    expect(screen.getByText(/Für „Technik“ einrichten/)).not.toBeNull();
    einrichten.mockImplementation(() => {
      stand = bereit();
      return Promise.resolve();
    });
    await klick(screen.getByRole('button', { name: 'Einrichten' }));
    await waitFor(() => expect(knopf('Ja', 'Gottesdienst', GD1).disabled).toBe(false));
    expect(einrichten).toHaveBeenCalledWith([TECHNIK]);
    expect(screen.queryByRole('button', { name: 'Einrichten' })).toBeNull();
  });

  it('Einrichten scheitert → der Grund steht da', async () => {
    stand = {
      modul: 16,
      gruppen: [{ gruppe: TECHNIK, kategorie: null, stand: 'einrichtbar' }],
      bereit: [],
      antworten: {},
      vertretungen: {},
      lesefehler: null,
    };
    einrichten.mockRejectedValue(new Error('ChurchTools erlaubt dir nicht, Kategorien anzulegen.'));
    zeige();
    await bereitSein();
    await klick(screen.getByRole('button', { name: 'Einrichten' }));
    expect((await screen.findByRole('alert')).textContent).toContain('erlaubt dir nicht');
  });
});
