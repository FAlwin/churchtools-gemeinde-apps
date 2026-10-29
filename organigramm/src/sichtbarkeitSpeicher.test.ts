import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KAT, MODUL, speicher } from '@shared/dienstplan/entwuerfe.testutil';
import { SICHT_ART } from '@shared/organigramm/sichtbarkeit';

// Gegen den nachgebauten Speicher (wie beim Plan); Modul und Kategorie sind gefunden bzw. fehlen.
const h = vi.hoisted(() => ({ kategorie: null as number | null, port: null as object | null }));
vi.mock('@ui/ct/modulPort', () => ({
  versionPortFuer: () => new Proxy({}, { get: (_ziel, k) => Reflect.get(h.port ?? {}, k) }),
}));
vi.mock('@shared/ct/modulDaten', async (original) => ({
  ...(await original<typeof import('@shared/ct/modulDaten')>()),
  modulSuchen: () => Promise.resolve(MODUL),
  kategorieSuchen: () => Promise.resolve(h.kategorie),
  kategorieSicherstellen: () => {
    h.kategorie = KAT;
    return Promise.resolve(KAT);
  },
}));
const { ladeSichtbarkeit, speichereSichtbarkeit } = await import('./sichtbarkeitSpeicher');
const { _vergissModul } = await import('./speicher');

const ALEX = { personId: 1, name: 'Alex' };
let sp: ReturnType<typeof speicher>;
beforeEach(() => {
  sp = speicher();
  h.port = sp.port;
  h.kategorie = null;
  _vergissModul();
});

describe('Was das Organigramm zeigt – im Speicher der Erweiterung (O7b-7)', () => {
  it('ohne Kategorie (nie gespeichert oder kein Leserecht) → nichts für alle ausgeblendet', async () => {
    expect(await ladeSichtbarkeit()).toEqual({ ok: true, daten: null });
  });

  it('speichern legt die Kategorie an; wieder gelesen steht es da, das zweite Mal mit Version', async () => {
    const s = { typen: [9], gruppen: [7] };
    expect(await speichereSichtbarkeit(s, ALEX, null)).toMatchObject({
      ok: true,
      daten: { version: 1, inhalt: s, von: ALEX },
    });
    expect(await ladeSichtbarkeit()).toMatchObject({ ok: true, daten: { version: 1, inhalt: s } });
    expect(await speichereSichtbarkeit({ typen: [], gruppen: [] }, ALEX, 1)).toMatchObject({
      ok: true,
      daten: { version: 2 },
    });
  });

  it('ein anderer war schneller → Konflikt, nichts überschrieben, mit dem, was jetzt dasteht', async () => {
    await speichereSichtbarkeit({ typen: [9], gruppen: [] }, ALEX, null);
    await speichereSichtbarkeit({ typen: [9], gruppen: [7] }, { personId: 2, name: 'Bea' }, 1);
    const r = await speichereSichtbarkeit({ typen: [], gruppen: [] }, ALEX, 1);
    expect(r).toMatchObject({
      ok: false,
      grund: 'konflikt',
      jetzt: { version: 2, von: { name: 'Bea' } },
    });
    expect(await ladeSichtbarkeit()).toMatchObject({
      daten: { inhalt: { typen: [9], gruppen: [7] } },
    });
  });

  it('ein Wert in anderem Format zählt wie keiner', async () => {
    await speichereSichtbarkeit({ typen: [9], gruppen: [] }, ALEX, null);
    // Von Hand verdorben: Gruppen fehlen.
    sp.s.werte[0].value = JSON.stringify({
      ...SICHT_ART,
      version: 1,
      zeit: '',
      von: ALEX,
      inhalt: { typen: [9] },
    });
    expect(await ladeSichtbarkeit()).toEqual({ ok: true, daten: null });
  });
});
