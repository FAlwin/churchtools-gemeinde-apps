import { describe, expect, it } from 'vitest';
import { KEINE_VERBINDUNGEN, verbindungenNach, zuhoererListe, type Verbindungen } from './werHoert';
import { meldungAus } from './zustand';

// Die Meldungen in der Form, wie VDO.Ninja sie schickt (`pokeIframeAPI`: {action, value, UUID}) – durch `meldungAus`,
// wie in der Seite, nicht als fertige Objekte.
const melde = (v: Verbindungen, roh: unknown, jetzt = '2026-11-12T18:31:00.000Z') =>
  verbindungenNach(v, meldungAus(roh)!, jetzt);
const kommt = (uuid: string) => ({ action: 'push-connection', value: true, UUID: uuid });
const name = (uuid: string, label: unknown) => ({
  action: 'push-connection-info',
  value: { label, useragent: 'x', platform: 'iPhone' },
  UUID: uuid,
});
const geht = (uuid: string) => ({ action: 'push-connection', value: false, UUID: uuid });

describe('verbindungenNach', () => {
  it('kommt → Verbindung ohne Namen; Info → mit Name; geht → weg', () => {
    let v = melde(KEINE_VERBINDUNGEN, kommt('a'), '2026-11-12T18:31:00.000Z');
    expect(v).toEqual({ a: { name: null, seit: '2026-11-12T18:31:00.000Z' } });
    v = melde(v, name('a', ' Helene Wiebe '), '2026-11-12T18:31:02.000Z');
    expect(v).toEqual({ a: { name: 'Helene Wiebe', seit: '2026-11-12T18:31:00.000Z' } });
    v = melde(v, geht('a'));
    expect(v).toEqual({});
  });

  it('das ältere `new-push-connection` zählt ebenso – doppelt gemeldet bleibt es EINE Verbindung', () => {
    let v = melde(KEINE_VERBINDUNGEN, { action: 'new-push-connection', value: true, UUID: 'a' });
    v = melde(v, kommt('a'));
    expect(Object.keys(v)).toEqual(['a']);
    v = melde(v, { action: 'new-push-connection', value: false, UUID: 'a' });
    expect(v).toEqual({});
  });

  it('Info vor „kommt“ legt die Verbindung an; ein späteres „kommt“ verliert den Namen nicht', () => {
    let v = melde(KEINE_VERBINDUNGEN, name('a', 'Jakob Penner'));
    v = melde(v, kommt('a'));
    expect(v.a.name).toBe('Jakob Penner');
  });

  it('leerer oder fehlender Name bleibt „ohne Namen“; ein schon gemeldeter Name bleibt stehen', () => {
    expect(melde(KEINE_VERBINDUNGEN, name('a', '  ')).a.name).toBeNull();
    expect(melde(KEINE_VERBINDUNGEN, name('a', false)).a.name).toBeNull();
    const v = melde(melde(KEINE_VERBINDUNGEN, name('a', 'Maria Klassen')), name('a', ''));
    expect(v.a.name).toBe('Maria Klassen');
  });

  it('fremde Meldungen, Meldungen ohne UUID und „geht“ einer unbekannten Verbindung ändern nichts', () => {
    const v = melde(KEINE_VERBINDUNGEN, kommt('a'));
    expect(melde(v, { action: 'tally', value: { connected: false }, UUID: 'a' })).toBe(v);
    expect(melde(v, { action: 'push-connection', value: true })).toBe(v);
    expect(melde(v, geht('x'))).toBe(v);
  });
});

describe('zuhoererListe', () => {
  it('still neu verbunden (neue UUID) → weiter EINE Person; seit = früheste offene Verbindung', () => {
    let v = melde(KEINE_VERBINDUNGEN, kommt('a'), '2026-11-12T18:31:00.000Z');
    v = melde(v, name('a', 'Helene Wiebe'));
    v = melde(v, kommt('b'), '2026-11-12T18:35:00.000Z');
    v = melde(v, name('b', 'Helene Wiebe'));
    expect(zuhoererListe(v)).toEqual({
      liste: [{ name: 'Helene Wiebe', seit: '2026-11-12T18:31:00.000Z', geraete: 2 }],
      zahl: 1,
    });
  });

  it('A–Z nach Name; ohne Namen zusammen am Ende, jede Verbindung zählt als eigene Person', () => {
    let v: Verbindungen = KEINE_VERBINDUNGEN;
    for (const [u, n] of [
      ['a', 'Maria Klassen'],
      ['b', 'Ännchen Dyck'],
      ['c', ''],
      ['d', 'Jakob Penner'],
      ['e', ''],
    ] as const) {
      v = melde(melde(v, kommt(u)), name(u, n));
    }
    const { liste, zahl } = zuhoererListe(v);
    expect(liste.map((z) => z.name)).toEqual([
      'Ännchen Dyck',
      'Jakob Penner',
      'Maria Klassen',
      null,
    ]);
    expect(liste.at(-1)?.geraete).toBe(2);
    expect(zahl).toBe(5);
  });

  it('niemand → leere Liste, Zahl 0', () => {
    expect(zuhoererListe(KEINE_VERBINDUNGEN)).toEqual({ liste: [], zahl: 0 });
  });
});
