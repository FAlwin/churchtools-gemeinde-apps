// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { nachbau } from '@shared/dienstplan/einteilen.testutil';
import type { PersonenAntworten } from '@shared/dienstplan/personenAntworten';
import type { RohPlatz } from '@shared/dienstplan/termine';
import type { Vertretung } from '@shared/dienstplan/verfuegbarkeit';
import { zeile } from '@shared/dienstplan/zeile.testutil';
import { ApiError } from '@ui/ct/fehler';
import { ladeAntworten } from './ladeAntworten';
import { startFuer } from './start.testutil';
import { useVertretung, uebernehmenText } from './useVertretung';

vi.mock('./ladeAntworten', () => ({ ladeAntworten: vi.fn() }));
const lade = vi.mocked(ladeAntworten);

afterEach(() => {
  cleanup();
});

const HEUTE = '2026-11-21';
const TAG = '2026-12-13';
const MARKIERUNG: Vertretung = {
  dienst: 9,
  gefragt: [47],
  seit: '2026-11-21T10:00:00.000Z',
  tag: TAG,
  name: 'Anna Test',
  gefragtNamen: ['Ben Test'],
};
const ANTWORTEN: PersonenAntworten = {
  jePerson: new Map(),
  sichtbar: new Set([4]),
  vertretungen: new Map([[46, { '246:9': MARKIERUNG }]]),
};
// Ben (47) ist im Lobpreisteam (Gruppe 9, Dienst 9 „Gesang“) – deshalb gehört Gesang zu seinen Diensten.
const BEN = startFuer({
  ichId: 47,
  vorname: 'Ben',
  nachname: 'Test',
  gruppen: [{ id: 9, name: 'Lobpreisteam', leitung: false }],
});
const ZEILEN = [zeile(246, 'Gottesdienst', TAG, { freieDienste: [9] })];
const frei = (extra: Partial<RohPlatz> = {}): RohPlatz => ({
  id: 700,
  serviceId: 9,
  index: 1,
  personId: null,
  name: null,
  isAccepted: false,
  permissions: { enterSelfIfFree: true },
  ...extra,
});

function hook(o: { aktiv?: boolean; start?: typeof BEN | null; platz?: RohPlatz[] } = {}) {
  const ct = nachbau(o.platz ?? [frei()]);
  const onGeaendert = vi.fn();
  const r = renderHook(() =>
    useVertretung({
      start: o.start === undefined ? BEN : o.start,
      zeilen: ZEILEN,
      heute: HEUTE,
      aktiv: o.aktiv ?? true,
      onGeaendert,
      port: ct.port,
    }),
  );
  return { ...r, ct, onGeaendert };
}

describe('useVertretung – „Für dich offen“ und Übernehmen', () => {
  it('lädt die Antworten der eigenen Dienstgruppe und zeigt die gesuchte Vertretung (Team: auch ohne gefragt zu sein)', async () => {
    lade.mockResolvedValue(ANTWORTEN);
    const { result } = hook();
    await waitFor(() => expect(result.current?.offen).toHaveLength(1));
    expect(result.current?.offen[0]).toMatchObject({
      name: 'Anna Test',
      dienst: 'Gesang',
      terminId: 246,
      gefragt: [47],
    });
    // Geladen wurden die EIGENEN Dienstgruppen (Musik), nicht die planbaren.
    expect(lade.mock.calls[0][0].map((g) => g.id)).toEqual([4]);
    expect(result.current?.ich).toEqual({ id: 47, name: 'Ben Test' });
  });

  it('nur solange die Startseite offen ist: sonst keine Abfrage', async () => {
    lade.mockResolvedValue(ANTWORTEN);
    const { result } = hook({ aktiv: false });
    expect(result.current).toBeDefined();
    await new Promise((r) => setTimeout(r, 20));
    expect(lade).not.toHaveBeenCalled();
    expect(result.current?.offen).toEqual([]);
  });

  it('ohne Start gibt es nichts; Laden scheitert: keine Zeilen, kein Absturz (Beiwerk)', async () => {
    lade.mockRejectedValue(new ApiError(503, 'gerade nicht'));
    const ohne = hook({ start: null });
    expect(ohne.result.current).toBeUndefined();
    cleanup();
    const { result } = hook();
    await waitFor(() => expect(lade).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current?.offen).toEqual([]);
  });

  it('Übernehmen: schreibt auf den freien Platz, meldet „Übernommen“, lädt Termine und Antworten neu', async () => {
    lade.mockResolvedValue(ANTWORTEN);
    const { result, ct, onGeaendert } = hook();
    await waitFor(() => expect(result.current?.offen).toHaveLength(1));
    const aufrufe = lade.mock.calls.length;
    await act(async () => {
      await result.current!.uebernehmen(result.current!.offen[0]);
    });
    expect(ct.ct.geschrieben.map((g) => g.pfad)).toEqual(['/persons/47/servicerequests/700']);
    expect(onGeaendert).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(lade.mock.calls.length).toBeGreaterThan(aufrufe));
    expect(result.current?.meldung).toMatch(/Übernommen – du hast jetzt Gesang am So, 13\.12\./);
    expect(result.current?.fehler('46|246|9')).toBeNull();
  });

  it('zu spät (schon übernommen): „Schon übernommen – danke!“, ohne zu schreiben, die Liste lädt neu', async () => {
    lade.mockResolvedValue(ANTWORTEN);
    const { result, ct, onGeaendert } = hook({
      platz: [frei({ personId: 48, name: 'Finn Test', isAccepted: true })],
    });
    await waitFor(() => expect(result.current?.offen).toHaveLength(1));
    await act(async () => {
      await result.current!.uebernehmen(result.current!.offen[0]);
    });
    expect(ct.ct.geschrieben).toEqual([]);
    expect(result.current?.meldung).toBe('Schon übernommen – danke!');
    expect(onGeaendert).toHaveBeenCalledTimes(1);
  });

  it('ohne Recht (enterSelfIfFree false oder 403): ehrlicher Satz an der Zeile, nichts neu geladen, nichts als „übernommen“ gemeldet', async () => {
    for (const platz of [
      frei({ permissions: { enterSelfIfFree: false } }),
      frei({ permissions: null }),
    ]) {
      lade.mockResolvedValue(ANTWORTEN);
      const { result, ct, onGeaendert } = hook({ platz: [platz] });
      ct.ct.selbstEintragenVerboten = true;
      await waitFor(() => expect(result.current?.offen).toHaveLength(1));
      await act(async () => {
        await result.current!.uebernehmen(result.current!.offen[0]);
      });
      expect(result.current?.fehler('46|246|9')).toBe(
        'Du darfst dich hier nicht selbst eintragen – frag die Leitung.',
      );
      expect(result.current?.meldung).toBeNull();
      expect(onGeaendert).not.toHaveBeenCalled();
      expect(ct.ct.plaetze[0].personId).toBeNull();
      cleanup();
    }
  });

  it('läuft: während des Schreibens ist die Zeile als laufend gemerkt; ein vorübergehender Fehler heißt „nicht bestätigt“', async () => {
    lade.mockResolvedValue(ANTWORTEN);
    const { result, ct } = hook();
    ct.ct.schreibenFehler = null; // keine Antwort
    await waitFor(() => expect(result.current?.offen).toHaveLength(1));
    let fertig!: Promise<void>;
    act(() => {
      fertig = result.current!.uebernehmen(result.current!.offen[0]);
    });
    expect(result.current?.laeuft('46|246|9')).toBe(true);
    await act(async () => {
      await fertig;
    });
    expect(result.current?.laeuft('46|246|9')).toBe(false);
    expect(result.current?.fehler('46|246|9')).toMatch(/nicht bestätigt/);
  });
});

describe('uebernehmenText', () => {
  it('jeder Grund hat seinen Satz', () => {
    expect(uebernehmenText('besetzt')).toBe('Schon übernommen – danke!');
    expect(uebernehmenText('kein-recht')).toMatch(/frag die Leitung/);
    expect(uebernehmenText('nicht-angekommen')).toMatch(/nicht übernommen/);
    expect(uebernehmenText('abgemeldet')).toMatch(/angemeldet/);
    expect(uebernehmenText('weg')).toMatch(/nicht mehr/);
    expect(uebernehmenText('voruebergehend')).toMatch(/nicht bestätigt/);
  });
});
