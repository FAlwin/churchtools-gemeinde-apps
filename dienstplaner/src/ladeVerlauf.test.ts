import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wechselAus, type Wechsel } from '@shared/ct/liveVerlauf';
import { liveListe } from '@shared/ct/liveAgenda';
import type { VerlaufAlle } from '@shared/dienstplan/liveVerlaufSpeicher';
import type { CtAgendaItem } from '@shared/ct/typen';

const speicher = vi.hoisted(() => ({ alle: vi.fn() }));
vi.mock('./ladeEntwuerfe', () => ({ port: {}, modulId: () => Promise.resolve(16) }));
vi.mock('@shared/dienstplan/liveVerlaufSpeicher', () => ({
  verlaufAlleLesen: speicher.alle,
  verlaufLesen: vi.fn(),
  verlaufSchreiben: vi.fn(),
}));

import { ladeAlleVerlaeufe, verlaufCacheLeeren, verlaufImCacheErsetzen } from './ladeVerlauf';

const liste = liveListe([{ id: 1, title: 'A', type: 'normal', duration: 60 }] as CtAgendaItem[], 7);
const w = (stelle: number, zeit: number): Wechsel => wechselAus(liste, stelle, zeit);
const antwort = (termine: [number, Wechsel[]][]): VerlaufAlle => ({
  ok: true,
  termine: new Map(termine.map(([id, wechsel]) => [id, { wechsel, ausnahmen: [] }] as const)),
});

beforeEach(() => {
  speicher.alle.mockReset();
  verlaufCacheLeeren();
});
afterEach(() => verlaufCacheLeeren());

describe('ladeAlleVerlaeufe – höchstens einmal je Seitenaufruf (Wachstum)', () => {
  it('liest die Kategorie einmal, egal wie oft gefragt wird', async () => {
    speicher.alle.mockResolvedValue(antwort([[7, [w(1, 0)]]]));
    const [a, b] = await Promise.all([ladeAlleVerlaeufe(), ladeAlleVerlaeufe()]);
    const c = await ladeAlleVerlaeufe();
    expect(speicher.alle).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(c).toBe(a);
  });

  it('ein Fehler wird nicht gehalten: der nächste Aufruf versucht es wieder', async () => {
    speicher.alle.mockResolvedValueOnce({ ok: false, grund: 'voruebergehend' });
    speicher.alle.mockResolvedValueOnce(antwort([[7, [w(1, 0)]]]));
    expect((await ladeAlleVerlaeufe()).ok).toBe(false);
    expect((await ladeAlleVerlaeufe()).ok).toBe(true);
    expect(speicher.alle).toHaveBeenCalledTimes(2);
  });

  it('auch ein geworfener Fehler wird nicht gehalten', async () => {
    speicher.alle.mockRejectedValueOnce(new Error('Netz'));
    speicher.alle.mockResolvedValueOnce(antwort([]));
    await expect(ladeAlleVerlaeufe()).rejects.toThrow('Netz');
    await Promise.resolve();
    expect((await ladeAlleVerlaeufe()).ok).toBe(true);
  });

  it('nach `verlaufCacheLeeren` wird neu gelesen', async () => {
    speicher.alle.mockResolvedValue(antwort([]));
    await ladeAlleVerlaeufe();
    verlaufCacheLeeren();
    await ladeAlleVerlaeufe();
    expect(speicher.alle).toHaveBeenCalledTimes(2);
  });

  it('`verlaufImCacheErsetzen` ändert einen Termin im Gehaltenen, ohne neu zu lesen', async () => {
    speicher.alle.mockResolvedValue(
      antwort([
        [7, [w(1, 0)]],
        [8, [w(1, 5)]],
      ]),
    );
    await ladeAlleVerlaeufe();
    await verlaufImCacheErsetzen(7, {
      wechsel: [w(1, 0)],
      ausnahmen: [{ punkt: 1, zeit: 9, aus: true }],
    });
    const r = await ladeAlleVerlaeufe();
    expect(r.ok && r.termine.get(7)?.ausnahmen).toEqual([{ punkt: 1, zeit: 9, aus: true }]);
    expect(r.ok && r.termine.get(8)?.wechsel).toEqual([w(1, 5)]);
    expect(speicher.alle).toHaveBeenCalledTimes(1);
  });

  it('`verlaufImCacheErsetzen` ohne Gehaltenes tut nichts', async () => {
    await verlaufImCacheErsetzen(7, { wechsel: [], ausnahmen: [] });
    speicher.alle.mockResolvedValue(antwort([]));
    expect((await ladeAlleVerlaeufe()).ok).toBe(true);
    expect(speicher.alle).toHaveBeenCalledTimes(1);
  });
});
