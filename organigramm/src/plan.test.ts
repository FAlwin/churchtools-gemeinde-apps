import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KAT, MODUL, speicher } from '@shared/dienstplan/entwuerfe.testutil';
import { KEINE_AENDERUNGEN, neueGruppe, PLAN_ART } from '@shared/organigramm/plan';

// Gegen den nachgebauten Speicher (wie gemessen); Modul und Kategorie sind gefunden bzw. fehlen.
const h = vi.hoisted(() => ({ kategorie: null as number | null, port: null as object | null }));
// Der Anschluss wird beim Laden des Moduls einmal geholt – er verweist hier auf den Speicher des jeweiligen Tests.
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
const { ladePlan, speicherePlan, verwerfePlan, _vergissModul } = await import('./plan');

const ALEX = { personId: 1, name: 'Alex' };
let sp: ReturnType<typeof speicher>;
beforeEach(() => {
  sp = speicher();
  h.port = sp.port;
  h.kategorie = null;
  _vergissModul();
});

describe('Plan im Speicher der Erweiterung (O7-1)', () => {
  it('ohne Kategorie (nie gespeichert) → kein Plan', async () => {
    expect(await ladePlan()).toEqual({ ok: true, daten: null });
  });

  it('anlegen (legt die Kategorie an), wieder laden; zweites Speichern mit Version', async () => {
    const a = neueGruppe(KEINE_AENDERUNGEN, 'Gemeinschaft', 2, null).aenderungen;
    expect(await speicherePlan(a, ALEX, null)).toMatchObject({ ok: true, daten: { version: 1 } });
    expect(await ladePlan()).toMatchObject({
      ok: true,
      daten: { version: 1, inhalt: a, von: ALEX },
    });
    expect(await speicherePlan(KEINE_AENDERUNGEN, ALEX, 1)).toMatchObject({
      ok: true,
      daten: { version: 2 },
    });
  });

  it('ein Wert, der kein Plan ist, zählt wie „kein Plan“', async () => {
    h.kategorie = KAT;
    sp.s.werte.push({
      id: 1,
      dataCategoryId: KAT,
      value: JSON.stringify({ ...PLAN_ART, version: 1, zeit: 'z', von: ALEX, inhalt: 'Unsinn' }),
    });
    expect(await ladePlan()).toEqual({ ok: true, daten: null });
  });

  it('verwerfen mit der gesehenen Version; danach kein Plan', async () => {
    await speicherePlan(KEINE_AENDERUNGEN, ALEX, null);
    expect(await verwerfePlan(1)).toEqual({ ok: true, daten: null });
    expect(await ladePlan()).toEqual({ ok: true, daten: null });
  });
});
