// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError } from './api';
import { KeinSpeicherRecht } from './ctRuntime';
import { markReachable } from './reachability';
import { createPendingKeys } from './pendingKeys';
import { erstelleSchreibSchlange, VERZOEGERUNG_MS, WIEDERHOLEN_MS } from './schreibSchlange';

/**
 * Der gemeinsame Baustein der Speicher-Warteschlange (#846) – jeder Fehlerzweig einzeln.
 *
 * ⚠️ Fake-Timer überall: Mit echten Timern erledigt die Verzögerung oder das Wiederholen die Arbeit, die ein Test
 * einem Zweig zuschreibt – er wäre auch ohne diesen Zweig grün.
 */
const MERKER = 'test_schlange_pending';

function aufbau(
  o: {
    buendeln?: 'alle' | 'je-schluessel';
    zusammenfuehren?: (
      n: Record<string, unknown>,
      f: Record<string, unknown>,
    ) => Record<string, unknown>;
  } = {},
) {
  const merker = createPendingKeys(MERKER);
  const schreiben = vi.fn<
    (s: Map<string, Record<string, unknown>>, k: boolean) => Promise<unknown>
  >(() => Promise.resolve());
  const melden = vi.fn<(m: string) => void>();
  const schlange = erstelleSchreibSchlange<Record<string, unknown>>({
    merker,
    schreiben,
    buendeln: o.buendeln ?? 'je-schluessel',
    zusammenfuehren: o.zusammenfuehren,
    melden,
  });
  /** Was beim n-ten Upload hochging, als einfaches Objekt. */
  const stapel = (n: number) => Object.fromEntries(schreiben.mock.calls[n][0]);
  return { merker, schreiben, melden, schlange, stapel };
}

/** Bis der laufende Upload (auch sein `catch`/`finally`) abgearbeitet ist. */
const durch = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  markReachable(true);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('schreibSchlange: Verzögern und Bündeln', () => {
  it('lädt erst nach der Verzögerung hoch, mehrere Änderungen werden EIN Upload', async () => {
    const { schlange, schreiben, stapel } = aufbau();
    schlange.vormerken('a', (b) => ({ ...b, x: 1 }));
    await vi.advanceTimersByTimeAsync(VERZOEGERUNG_MS - 1);
    schlange.vormerken('a', (b) => ({ ...b, y: 2 }));
    await vi.advanceTimersByTimeAsync(VERZOEGERUNG_MS - 1);
    expect(schreiben).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(schreiben).toHaveBeenCalledTimes(1);
    expect(stapel(0)).toEqual({ a: { x: 1, y: 2 } });
  });

  it('`alle`: verschiedene Schlüssel gehen in EINEM Stapel hoch', async () => {
    const { schlange, schreiben, stapel } = aufbau({ buendeln: 'alle' });
    schlange.vormerken('a', () => ({ v: 1 }));
    schlange.vormerken('b', () => ({ v: 2 }));
    await vi.advanceTimersByTimeAsync(VERZOEGERUNG_MS);
    expect(schreiben).toHaveBeenCalledTimes(1);
    expect(stapel(0)).toEqual({ a: { v: 1 }, b: { v: 2 } });
  });

  it('`je-schluessel`: jeder Schlüssel einzeln', async () => {
    const { schlange, schreiben } = aufbau();
    schlange.vormerken('a', () => ({ v: 1 }));
    schlange.vormerken('b', () => ({ v: 2 }));
    await vi.advanceTimersByTimeAsync(VERZOEGERUNG_MS);
    expect(schreiben).toHaveBeenCalledTimes(2);
  });
});

describe('schreibSchlange: Merker', () => {
  it('Vormerken setzt den Merker, ein Erfolg nimmt ihn weg', async () => {
    const { schlange, merker } = aufbau();
    schlange.vormerken('a', () => ({ v: 1 }));
    expect(merker.read().has('a')).toBe(true);
    await vi.advanceTimersByTimeAsync(VERZOEGERUNG_MS);
    expect(merker.read().has('a')).toBe(false);
  });

  it('wird während des Uploads erneut geändert, bleibt der Merker nach dem Erfolg stehen', async () => {
    const { schlange, schreiben, merker } = aufbau();
    let freigeben!: () => void;
    schreiben.mockImplementationOnce(() => new Promise<void>((r) => (freigeben = r)));
    schlange.vormerken('a', () => ({ v: 1 }));
    await vi.advanceTimersByTimeAsync(VERZOEGERUNG_MS); // Upload läuft
    schlange.vormerken('a', () => ({ v: 2 })); // neue Änderung, noch nicht oben
    freigeben();
    await durch();
    // Ohne den Merker wäre v: 2 nach einem Neustart in dieser Lücke still weg.
    expect(merker.read().has('a')).toBe(true);
  });
});

describe('schreibSchlange: Fehlerzweige einzeln', () => {
  it('vorübergehender Fehler: zurücklegen, Merker bleibt, nach WIEDERHOLEN_MS erneut', async () => {
    const { schlange, schreiben, merker, melden, stapel } = aufbau();
    schreiben.mockRejectedValueOnce(new ApiError(502, 'Bad Gateway'));
    schlange.vormerken('a', () => ({ v: 1 }));
    await vi.advanceTimersByTimeAsync(VERZOEGERUNG_MS);
    expect(schreiben).toHaveBeenCalledTimes(1);
    expect(merker.read().has('a')).toBe(true);
    expect(melden).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(WIEDERHOLEN_MS - 1);
    expect(schreiben).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(schreiben).toHaveBeenCalledTimes(2);
    expect(stapel(1)).toEqual({ a: { v: 1 } });
    expect(merker.read().has('a')).toBe(false);
  });

  it('vorübergehend und offline: zurücklegen, aber nicht ins Leere wiederholen', async () => {
    const { schlange, schreiben } = aufbau();
    schreiben.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    schlange.vormerken('a', () => ({ v: 1 }));
    markReachable(false);
    await vi.advanceTimersByTimeAsync(VERZOEGERUNG_MS + WIEDERHOLEN_MS * 3);
    expect(schreiben).toHaveBeenCalledTimes(1);
    // Zurückgelegt: Beim Weglegen der App geht es mit.
    schlange.jetztAbschicken();
    await durch();
    expect(schreiben).toHaveBeenCalledTimes(2);
  });

  it('zurückgelegt: der neuere Wert gewinnt, `zusammenfuehren` ergänzt den Rest', async () => {
    const { schlange, schreiben, stapel } = aufbau({
      zusammenfuehren: (neuer, fehlgeschlagen) => ({ ...fehlgeschlagen, ...neuer }),
    });
    let ablehnen!: () => void;
    schreiben.mockImplementationOnce(
      () => new Promise((_r, rej) => (ablehnen = () => rej(new ApiError(504, 'weg')))),
    );
    schlange.vormerken('a', () => ({ strokes: 'alt', zoom: 1 }));
    await vi.advanceTimersByTimeAsync(VERZOEGERUNG_MS);
    schlange.vormerken('a', (b) => ({ ...b, strokes: 'neu' }));
    ablehnen();
    await vi.advanceTimersByTimeAsync(VERZOEGERUNG_MS);
    expect(stapel(1)).toEqual({ a: { strokes: 'neu', zoom: 1 } });
  });

  it('413: endgültig – melden, Merker weg, kein erneuter Versuch', async () => {
    const { schlange, schreiben, merker, melden } = aufbau();
    schreiben.mockRejectedValueOnce(new ApiError(413, 'Zu groß fürs Konto'));
    schlange.vormerken('a', () => ({ v: 1 }));
    await vi.advanceTimersByTimeAsync(VERZOEGERUNG_MS + WIEDERHOLEN_MS * 2);
    expect(schreiben).toHaveBeenCalledTimes(1);
    expect(melden).toHaveBeenCalledWith('Zu groß fürs Konto');
    expect(merker.read().has('a')).toBe(false);
    expect(schlange.istAus()).toBe(false);
  });

  it('401: abschalten, nicht melden, Merker bleibt für den nächsten Start', async () => {
    const { schlange, schreiben, merker, melden } = aufbau();
    schreiben.mockRejectedValueOnce(new ApiError(401, 'Nicht angemeldet'));
    schlange.vormerken('a', () => ({ v: 1 }));
    await vi.advanceTimersByTimeAsync(VERZOEGERUNG_MS + WIEDERHOLEN_MS * 2);
    expect(schreiben).toHaveBeenCalledTimes(1);
    expect(schlange.istAus()).toBe(true);
    expect(melden).not.toHaveBeenCalled();
    expect(merker.read().has('a')).toBe(true);
  });

  it('kein Recht: abschalten, melden, zurücklegen – nach dem Einschalten geht es mit hoch', async () => {
    const { schlange, schreiben, merker, melden, stapel } = aufbau();
    schreiben.mockRejectedValueOnce(new KeinSpeicherRecht('Dir fehlt das Recht'));
    schlange.vormerken('a', () => ({ v: 1 }));
    await vi.advanceTimersByTimeAsync(VERZOEGERUNG_MS + WIEDERHOLEN_MS * 2);
    expect(schreiben).toHaveBeenCalledTimes(1);
    expect(schlange.istAus()).toBe(true);
    expect(melden).toHaveBeenCalledWith('Dir fehlt das Recht');
    expect(merker.read().has('a')).toBe(true);
    schlange.einschalten();
    await schlange.abschicken();
    expect(stapel(1)).toEqual({ a: { v: 1 } });
  });

  it('abgeschaltet: Vormerken tut nichts, Ausstehendes wird liegen gelassen statt verworfen', async () => {
    const { schlange, schreiben } = aufbau();
    schlange.vormerken('a', () => ({ v: 1 }));
    schlange.fehlerBewerten(new ApiError(401, 'weg')); // z. B. ein Abgleich meldet 401
    await vi.advanceTimersByTimeAsync(VERZOEGERUNG_MS);
    schlange.vormerken('b', () => ({ v: 2 }));
    expect(schreiben).not.toHaveBeenCalled();
    schlange.einschalten();
    await schlange.abschicken();
    expect(schreiben).toHaveBeenCalledTimes(1);
    expect(schreiben.mock.calls[0][0].has('a')).toBe(true);
  });
});

describe('schreibSchlange: Schutz, Nachholen, Weglegen', () => {
  it('der Schutz deckt wartend, laufend und Merker ab', async () => {
    const { schlange, schreiben, merker } = aufbau();
    merker.mark('nachNeustart');
    schlange.vormerken('wartet', () => ({ v: 1 }));
    expect(schlange.schutz()('wartet')).toBe(true);
    expect(schlange.schutz()('nachNeustart')).toBe(true);
    expect(schlange.schutz()('fremd')).toBe(false);

    let freigeben!: () => void;
    schreiben.mockImplementationOnce(() => new Promise<void>((r) => (freigeben = r)));
    await vi.advanceTimersByTimeAsync(VERZOEGERUNG_MS);
    merker.unmark('wartet'); // nur „läuft" soll ihn jetzt noch schützen
    expect(schlange.schutz()('wartet')).toBe(true);
    freigeben();
    await durch();
    expect(schlange.schutz()('wartet')).toBe(false);
  });

  it('Einreihen + Abschicken lädt ohne Verzögerung hoch', async () => {
    const { schlange, schreiben } = aufbau();
    schlange.einreihen('a', { v: 1 });
    await schlange.abschicken();
    expect(schreiben).toHaveBeenCalledTimes(1);
  });

  it('Weglegen schickt sofort mit keepalive, ohne auf die Verzögerung zu warten', async () => {
    const { schlange, schreiben } = aufbau();
    schlange.vormerken('a', () => ({ v: 1 }));
    schlange.jetztAbschicken();
    await durch();
    expect(schreiben).toHaveBeenCalledTimes(1);
    expect(schreiben.mock.calls[0][1]).toBe(true);
    await vi.advanceTimersByTimeAsync(VERZOEGERUNG_MS);
    expect(schreiben).toHaveBeenCalledTimes(1); // nichts geht doppelt hoch
  });
});
