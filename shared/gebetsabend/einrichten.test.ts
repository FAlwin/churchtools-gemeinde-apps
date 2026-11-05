import { describe, expect, it } from 'vitest';
import {
  einrichtungAus,
  einrichtungsStand,
  KATEGORIE_EINSTELLUNGEN,
  KATEGORIE_ZUGANG,
} from './einrichten';

/** Aufbau wie `GET /custommodules/{id}/customdatacategories` (gemessen S0; nur die gelesenen Felder). */
const kat = (id: number, shorty: string) => ({ id, shorty });

describe('Einrichtung', () => {
  it('beide Kategorien sichtbar → fertig, egal ob man anlegen dürfte', () => {
    const e = einrichtungAus([
      kat(74, KATEGORIE_ZUGANG.kuerzel),
      kat(75, KATEGORIE_EINSTELLUNGEN.kuerzel),
    ]);
    expect(e).toEqual({ zugang: 74, einstellungen: 75 });
    expect(einrichtungsStand(e, false)).toBe('fertig');
  });

  it('dasselbe Kürzel zweimal (ChurchTools nimmt es an) → die kleinste ID, wie überall', () => {
    expect(
      einrichtungAus([kat(80, 'zugang'), kat(74, 'zugang'), kat(75, 'einstellungen')]).zugang,
    ).toBe(74);
  });

  it('fehlt eine: einrichten nur mit Recht zum Anlegen, sonst Hinweis', () => {
    const e = einrichtungAus([kat(74, KATEGORIE_ZUGANG.kuerzel)]);
    expect(e.einstellungen).toBeNull();
    expect(einrichtungsStand(e, true)).toBe('einrichten');
    expect(einrichtungsStand(e, false)).toBe('fehlt');
  });

  it('leere Liste (ohne Recht kommt nichts, gemessen) ist für Zuhörer „fehlt“', () => {
    expect(einrichtungsStand(einrichtungAus([]), false)).toBe('fehlt');
  });
});
