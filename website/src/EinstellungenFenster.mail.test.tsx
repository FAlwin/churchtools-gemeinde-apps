// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import type { Einstellungen } from '@shared/website/modell';
import type { WebsiteStand } from '@shared/website/speicher';
import { einstellungen, seite } from '@shared/website/website.testdaten';
import * as D from './daten';
import { EinstellungenFenster } from './EinstellungenFenster';
import { EinstellungenProvider } from './EinstellungenQuelle';

/**
 * Der Schalter „Mails im Freigabe-Weg“ im Fenster „Einstellungen“ (W3b-3): wirkt **sofort**, als eigener Wert – unabhängig vom
 * „Speichern“ des Fensters. Ein Fehler hier ist nie ein Fehler der Einstellungen und umgekehrt.
 */
vi.mock('./daten', () => ({
  ladeWebsite: vi.fn(),
  speichereEinstellungen: vi.fn(),
  beginneEinstellungen: vi.fn(),
  uebernimmEinstellungen: vi.fn(),
  beendeEinstellungen: vi.fn(),
  ladeMailAn: vi.fn(),
  setzeMailAn: vi.fn(),
}));
const d = vi.mocked(D);

const ORT = { modul: 7, kategorie: 20 };
const ICH = { person: 1, name: 'Helene Wiebe', fenster: 'f1' };
const START = seite({ id: 's', titel: 'Startseite', pfad: 'start', startseite: true });
const stand = (): WebsiteStand => ({
  seiten: [START],
  menue: null,
  einstellungen: einstellungen({ name: 'ECG' }),
  probleme: [],
  verwaist: 0,
  sperren: {},
  einstellungenSperre: null,
  status: {},
  staende: [],
});

let server: { einstellungen: Einstellungen | null };
const schliessen = vi.fn();

const zeige = async (mail: typeof ORT | null = ORT) => {
  const s = stand();
  server = { einstellungen: s.einstellungen };
  d.ladeWebsite.mockResolvedValue(s);
  render(
    <EinstellungenProvider ort={ORT} gemeinde="ECG" ich={ICH}>
      <EinstellungenFenster onSchliessen={schliessen} mail={mail ?? undefined} />
    </EinstellungenProvider>,
  );
  await act(async () => {});
};
const schalter = () =>
  screen.getByRole<HTMLInputElement>('checkbox', { name: 'Mails im Freigabe-Weg' });
const umschalten = () =>
  act(async () => {
    fireEvent.click(schalter());
  });
const klick = async (name: string | RegExp) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  schliessen.mockReset();
  d.beginneEinstellungen.mockImplementation(async () => ({
    art: 'ok',
    einstellungen: server.einstellungen,
  }));
  d.uebernimmEinstellungen.mockImplementation(async () => ({
    art: 'ok',
    einstellungen: server.einstellungen,
  }));
  d.beendeEinstellungen.mockResolvedValue(undefined);
  d.speichereEinstellungen.mockImplementation(async (_o, e) => {
    server.einstellungen = e;
  });
  d.ladeMailAn.mockResolvedValue(true);
  d.setzeMailAn.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Schalter „Mails im Freigabe-Weg“ im Fenster „Einstellungen“', () => {
  it('steht im Fenster, liest den gespeicherten Stand (kein Wert = an) und erklärt, wann Mails gehen und dass er sofort wirkt', async () => {
    await zeige();
    expect(d.ladeMailAn).toHaveBeenCalledWith(ORT);
    expect(schalter().checked).toBe(true);
    const bereich = screen.getByRole('region', { name: 'Mails im Freigabe-Weg' });
    expect(bereich.textContent).toMatch(/Einreichen/);
    expect(bereich.textContent).toMatch(/Löschen anfragen/);
    expect(bereich.textContent).toMatch(/Zurückgeben/);
    expect(bereich.textContent).toMatch(/Freigeben/);
    expect(bereich.textContent).toMatch(/wirkt sofort/);
  });

  it('ist er aus gespeichert, zeigt er „aus“', async () => {
    d.ladeMailAn.mockResolvedValue(false);
    await zeige();
    expect(schalter().checked).toBe(false);
  });

  it('ohne Ort (alte Aufrufer): kein Schalter', async () => {
    await zeige(null);
    expect(screen.queryByRole('region', { name: 'Mails im Freigabe-Weg' })).toBeNull();
    expect(d.ladeMailAn).not.toHaveBeenCalled();
  });

  it('Umschalten schreibt SOFORT als eigener Wert – ohne „Speichern“, ohne die Einstellungen anzufassen, das Fenster bleibt offen', async () => {
    await zeige();
    await umschalten();
    expect(d.setzeMailAn).toHaveBeenCalledWith(ORT, false);
    expect(schalter().checked).toBe(false);
    expect(d.speichereEinstellungen).not.toHaveBeenCalled();
    expect(schliessen).not.toHaveBeenCalled();
    await umschalten();
    expect(d.setzeMailAn).toHaveBeenLastCalledWith(ORT, true);
    expect(schalter().checked).toBe(true);
  });

  it('scheitert das Schreiben (503): der Schalter bleibt, wie er war, die Meldung sagt „Nicht gespeichert“ – die Einstellungen sind davon unberührt', async () => {
    d.setzeMailAn.mockRejectedValueOnce(new ApiError(503, 'weg'));
    await zeige();
    await umschalten();
    expect(schalter().checked).toBe(true);
    expect(screen.getByRole('alert').textContent).toMatch(/^Nicht gespeichert – /);
    // Die Einstellungen lassen sich davon unabhängig speichern.
    await klick('Speichern');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(d.speichereEinstellungen).toHaveBeenCalledTimes(1);
    expect(schliessen).toHaveBeenCalledTimes(1);
  });

  it('scheitert das Speichern der Einstellungen, ist das ihre Meldung – der Schalter zeigt keinen Fehler und bleibt bedienbar', async () => {
    d.speichereEinstellungen.mockRejectedValueOnce(new ApiError(503, 'Dienst nicht erreichbar'));
    await zeige();
    await klick('Speichern');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const meldungen = screen.getAllByRole('alert').map((a) => a.textContent ?? '');
    expect(meldungen).toHaveLength(1);
    expect(meldungen[0]).toMatch(/Nicht gespeichert/);
    expect(meldungen[0]).toMatch(/Deine Eingaben bleiben/);
    await umschalten();
    expect(d.setzeMailAn).toHaveBeenCalledWith(ORT, false);
  });

  it('der Schalter lässt sich nicht lesen (503): Meldung statt eines geratenen Stands, kein Knopf', async () => {
    d.ladeMailAn.mockRejectedValue(new ApiError(503, 'weg'));
    await zeige();
    expect(screen.getByRole('alert').textContent).toMatch(/Der Schalter ließ sich nicht lesen/);
    expect(screen.queryByRole('checkbox', { name: 'Mails im Freigabe-Weg' })).toBeNull();
  });

  it('während des Schreibens ist der Schalter gesperrt – kein zweites Umschalten dazwischen', async () => {
    let fertig: () => void = () => {};
    d.setzeMailAn.mockReturnValueOnce(new Promise<void>((ok) => (fertig = ok)));
    await zeige();
    await umschalten();
    expect(schalter()).toHaveProperty('disabled', true);
    await act(async () => fertig());
    expect(schalter()).toHaveProperty('disabled', false);
    expect(d.setzeMailAn).toHaveBeenCalledTimes(1);
  });
});
