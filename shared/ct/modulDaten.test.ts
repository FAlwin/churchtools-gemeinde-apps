import { describe, expect, it } from 'vitest';
import { kategorieSuchen, modulSuchen, type ModulPort } from './modulDaten';

function port(antworten: Record<string, unknown>): ModulPort {
  return {
    kuerzel: () => 'dienstplaner',
    daten: <T>(pfad: string) => Promise.resolve(antworten[pfad] as T),
    schreibe: () => Promise.resolve(),
    fehler: (status, meldung) => Object.assign(new Error(meldung), { status }),
    istKeinRecht: () => false,
    istNichtGefunden: () => false,
  };
}

describe('kategorieSuchen', () => {
  it('dasselbe Kürzel zweimal (ChurchTools nimmt das an, gemessen 14.10.2026) → immer die kleinste ID', async () => {
    const liste = [
      { id: 27, shorty: 'dienstplaner-entwuerfe-3' },
      { id: 5, shorty: 'anderes' },
      { id: 24, shorty: 'dienstplaner-entwuerfe-3' },
    ];
    const p = port({ '/custommodules/16/customdatacategories': liste });
    expect(await kategorieSuchen(p, 16, 'dienstplaner-entwuerfe-3')).toBe(24);
    // Reihenfolge der Antwort spielt keine Rolle – jedes Gerät nimmt dieselbe.
    const p2 = port({ '/custommodules/16/customdatacategories': [...liste].reverse() });
    expect(await kategorieSuchen(p2, 16, 'dienstplaner-entwuerfe-3')).toBe(24);
  });

  it('nicht da oder nicht zu sehen (leere Liste) → null', async () => {
    const p = port({ '/custommodules/16/customdatacategories': [] });
    expect(await kategorieSuchen(p, 16, 'dienstplaner-entwuerfe-3')).toBeNull();
    expect(await kategorieSuchen(port({}), 16, 'x')).toBeNull();
  });
});

describe('modulSuchen', () => {
  it('kein Modul mit dem Kürzel → 404 mit dem Namen des Aufrufers, nicht fest „Musik App“', async () => {
    const p = port({ '/custommodules': [{ id: 10, shorty: 'musik-app' }] });
    await expect(modulSuchen(p, 'Der Dienstplaner')).rejects.toMatchObject({
      status: 404,
      message: 'Der Dienstplaner ist in ChurchTools nicht zu finden.',
    });
    const q = port({ '/custommodules': [{ id: 16, shorty: 'dienstplaner' }] });
    expect(await modulSuchen(q, 'Der Dienstplaner')).toBe(16);
  });
});
