import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Block } from '@shared/protokolle/dokument';
import type { ProtokollKopf, Sperre } from '@shared/protokolle/speicher';
import type { SchreibErgebnis } from './schreiben';
import { ERNEUT_MS, PAUSE_MS, SchreibSteuerung, type Anschluss } from './schreibSteuerung';

/** Die Zeitregeln des automatischen Speicherns (S4-1) – mit Fake-Timern, sonst täte die Pause die Arbeit des Tests. */

const kopf = (stand: string) => ({ stand }) as ProtokollKopf;
const ok = (stand: string): SchreibErgebnis => ({ art: 'ok', kopf: kopf(stand) });
const JOHANN: Sperre = { von: 7, name: 'Johann', seit: '2026-10-24T18:00:00Z', fenster: 'j' };

let doc: Block[];
let n: number;
let a: { [K in keyof Anschluss]: Mock<Anschluss[K]> };

/** Wartet, bis alle anstehenden Versprechen erledigt sind (ohne Zeit vorzuspulen). */
const ruhe = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-24T18:00:00Z'));
  doc = [];
  n = 0;
  const anschluss = {
    sperreNehmen: vi.fn(async () => ok('s0')),
    speichern: vi.fn(async () => ok(`s${++n}`)),
    dokument: vi.fn(() => doc),
    jetzt: vi.fn(() => new Date()),
  };
  a = anschluss;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('SchreibSteuerung', () => {
  it('erste Änderung: sofort Sperre nehmen und speichern', async () => {
    const s = new SchreibSteuerung(a, kopf('s0'));
    s.geaendert();
    await ruhe();
    expect(a.sperreNehmen).toHaveBeenCalledWith('s0');
    expect(a.speichern).toHaveBeenCalledTimes(1);
    expect(s.zustand).toMatchObject({ lage: 'schreibe', offen: false, speichert: false });
    expect(s.zustand.zuletzt).not.toBeNull();
    expect(s.basisStand).toBe('s1');
  });

  it('danach erst nach der Pause – viele Eingaben, ein Speichern, auf dem neuen Stand', async () => {
    const s = new SchreibSteuerung(a, kopf('s0'));
    s.geaendert();
    await ruhe();
    for (let i = 0; i < 5; i++) {
      s.geaendert();
      await vi.advanceTimersByTimeAsync(PAUSE_MS - 500);
    }
    expect(a.speichern).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(a.speichern).toHaveBeenCalledTimes(2);
    expect(a.speichern).toHaveBeenLastCalledWith('s1', doc);
    expect(a.sperreNehmen).toHaveBeenCalledTimes(1);
  });

  it('Eingabe während des Speicherns: danach gleich noch einmal', async () => {
    let fertig!: () => void;
    a.speichern.mockImplementationOnce(
      () =>
        new Promise<SchreibErgebnis>((r) => {
          fertig = () => r(ok('s1'));
        }),
    );
    const s = new SchreibSteuerung(a, kopf('s0'), 'schreibe');
    s.geaendert();
    await vi.advanceTimersByTimeAsync(PAUSE_MS);
    expect(a.speichern).toHaveBeenCalledTimes(1);
    s.geaendert();
    await vi.advanceTimersByTimeAsync(PAUSE_MS);
    expect(a.speichern).toHaveBeenCalledTimes(1); // läuft noch – kein zweites gleichzeitig
    fertig();
    await ruhe();
    expect(a.speichern).toHaveBeenCalledTimes(2);
    expect(a.speichern).toHaveBeenLastCalledWith('s1', doc);
    expect(s.zustand.offen).toBe(false);
  });

  it('Fehler: nichts verworfen, „nicht gespeichert“ sichtbar, neuer Versuch nach ERNEUT_MS', async () => {
    a.speichern.mockRejectedValueOnce(new Error('Zeitüberschreitung'));
    const s = new SchreibSteuerung(a, kopf('s0'), 'schreibe');
    s.geaendert();
    await vi.advanceTimersByTimeAsync(PAUSE_MS);
    expect(s.zustand).toMatchObject({ offen: true, fehler: 'Zeitüberschreitung' });
    await vi.advanceTimersByTimeAsync(ERNEUT_MS - 1);
    expect(a.speichern).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(a.speichern).toHaveBeenCalledTimes(2);
    expect(s.zustand).toMatchObject({ offen: false, fehler: null });
  });

  it('Fehler beim Sperre-Nehmen: ebenfalls erneut versucht', async () => {
    a.sperreNehmen.mockRejectedValueOnce(new Error('503'));
    const s = new SchreibSteuerung(a, kopf('s0'));
    s.geaendert();
    await ruhe();
    expect(s.zustand).toMatchObject({ lage: 'frei', offen: true, fehler: '503' });
    await vi.advanceTimersByTimeAsync(ERNEUT_MS);
    expect(s.zustand).toMatchObject({ lage: 'schreibe', offen: false });
  });

  it('jemand anderes schreibt schon: nicht speichern, Sperre zeigen, weitere Eingaben ignorieren', async () => {
    a.sperreNehmen.mockResolvedValueOnce({ art: 'gesperrt', sperre: JOHANN });
    const s = new SchreibSteuerung(a, kopf('s0'));
    s.geaendert();
    await ruhe();
    expect(a.speichern).not.toHaveBeenCalled();
    expect(s.zustand).toMatchObject({ lage: 'gesperrt', sperre: JOHANN });
    s.geaendert();
    await vi.advanceTimersByTimeAsync(PAUSE_MS * 3);
    expect(a.sperreNehmen).toHaveBeenCalledTimes(1);
  });

  it('beim Speichern übernommen: nicht mehr speichern, eigene Änderung bleibt als offen markiert', async () => {
    const s = new SchreibSteuerung(a, kopf('s0'), 'schreibe');
    a.speichern.mockResolvedValueOnce({ art: 'gesperrt', sperre: JOHANN });
    s.geaendert();
    await vi.advanceTimersByTimeAsync(PAUSE_MS);
    expect(s.zustand).toMatchObject({ lage: 'gesperrt', offen: true, sperre: JOHANN });
    s.geaendert();
    await vi.advanceTimersByTimeAsync(ERNEUT_MS * 2);
    expect(a.speichern).toHaveBeenCalledTimes(1);
  });

  it('jetzt(): speichert Offenes sofort und meldet, ob alles gespeichert ist', async () => {
    const s = new SchreibSteuerung(a, kopf('s0'), 'schreibe');
    s.geaendert();
    expect(await s.jetzt()).toBe(true);
    expect(a.speichern).toHaveBeenCalledTimes(1);
    a.speichern.mockRejectedValueOnce(new Error('weg'));
    s.geaendert();
    expect(await s.jetzt()).toBe(false);
  });

  it('jetzt() während eines laufenden Speicherns: wartet es ab und auch das Speichern des Neuen', async () => {
    const offen: (() => void)[] = [];
    const haengt = () =>
      new Promise<SchreibErgebnis>((r) => {
        offen.push(() => r(ok(`s${offen.length}`)));
      });
    a.speichern.mockImplementationOnce(haengt).mockImplementationOnce(haengt);
    const s = new SchreibSteuerung(a, kopf('s0'), 'schreibe');
    s.geaendert();
    await vi.advanceTimersByTimeAsync(PAUSE_MS);
    s.geaendert();
    let fertig = false;
    const ergebnis = s.jetzt().then((x) => {
      fertig = true;
      return x;
    });
    offen[0]();
    await ruhe();
    expect(a.speichern).toHaveBeenCalledTimes(2);
    // Erst wenn auch das zweite Speichern durch ist – sonst gäbe „Zurück“ die Sperre frei, und das noch laufende
    // Speichern setzte sie gleich wieder.
    expect(fertig).toBe(false);
    offen[1]();
    expect(await ergebnis).toBe(true);
  });

  it('neuAufsetzen (nach Übernehmen): neuer Stand, nichts offen, weiter mit Pause', async () => {
    const s = new SchreibSteuerung(a, kopf('s0'), 'gesperrt', JOHANN);
    s.neuAufsetzen(kopf('s9'), 'schreibe');
    s.geaendert();
    await vi.advanceTimersByTimeAsync(PAUSE_MS);
    expect(a.speichern).toHaveBeenCalledWith('s9', doc);
    expect(a.sperreNehmen).not.toHaveBeenCalled();
  });
});
