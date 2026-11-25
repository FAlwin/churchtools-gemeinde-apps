import { describe, expect, it } from 'vitest';
import {
  istTerminStand,
  neuerTerminStand,
  standNachId,
  terminStandGeloescht,
  terminStandId,
  terminStandNach,
  terminStandWiederDa,
  wennNochOffen,
} from './terminStand';

const ZIEL = { gruppe: 11, sitzung: 's1', block: 'b1' };
const KAL = { kalender: 4, id: 160, name: 'Gemeindeleitung', zeit: 'ganztägig' };
const AM = '2026-11-21T10:00:00Z';

describe('Stand eines Termin-Bausteins', () => {
  it('der Schlüssel kommt aus Protokoll und Block – derselbe Baustein, derselbe Schlüssel', () => {
    expect(terminStandId('s1', 'b1')).toBe('termin-s1-b1');
    expect(neuerTerminStand(ZIEL, 'offen', null, 1, AM).id).toBe(terminStandId('s1', 'b1'));
  });

  it('Erzeuger und Prüfer gehören zusammen: jeder erzeugte Stand ist gültig', () => {
    for (const s of [
      neuerTerminStand(ZIEL, 'imKalender', KAL, 1, AM),
      neuerTerminStand(ZIEL, 'nichtEintragen', null, 1, AM),
      neuerTerminStand(ZIEL, 'offen', null, 1, AM),
    ])
      expect(istTerminStand(JSON.parse(JSON.stringify(s)))).toBe(true);
  });

  it('der Kalender wird nur bei „im Kalender“ gespeichert', () => {
    expect(neuerTerminStand(ZIEL, 'nichtEintragen', KAL, 1, AM).kalender).toBeNull();
    expect(neuerTerminStand(ZIEL, 'imKalender', KAL, 1, AM).kalender).toEqual(KAL);
  });

  it('„im Kalender“ ohne Kalender, Fremdes und Kaputtes sind kein Stand', () => {
    const ok = neuerTerminStand(ZIEL, 'imKalender', KAL, 1, AM);
    for (const x of [
      null,
      {},
      { ...ok, kalender: null },
      { ...ok, kalender: { kalender: 'x', id: 1, name: 'n', zeit: 'z' } },
      { ...ok, stand: 'weg' },
      { ...ok, fassung: 2 },
      { ...ok, art: 'aufgabe' },
      { ...ok, von: 'x' },
    ])
      expect(istTerminStand(x)).toBe(false);
  });

  it('„Nicht eintragen“ überschreibt nie einen Eintrag im Kalender', () => {
    const drin = neuerTerminStand(ZIEL, 'imKalender', KAL, 1, AM);
    const nicht = neuerTerminStand(ZIEL, 'nichtEintragen', null, 7, AM);
    expect(wennNochOffen(drin, nicht)).toBe(drin);
    expect(wennNochOffen(nicht, neuerTerminStand(ZIEL, 'offen', null, 7, AM)).stand).toBe('offen');
    expect(wennNochOffen(neuerTerminStand(ZIEL, 'offen', null, 1, AM), nicht)).toBe(nicht);
  });

  it('standNachId: nach Schlüssel', () => {
    const a = neuerTerminStand(ZIEL, 'offen', null, 1, AM);
    expect(standNachId([a]).get(a.id)).toBe(a);
  });
});

describe('terminStandGeloescht – das Protokoll wurde gelöscht (W6)', () => {
  it('derselbe Stand mit Vermerk „gelöscht“ (wer, wann) – und weiterhin ein gültiger Stand', () => {
    const alt = neuerTerminStand(ZIEL, 'imKalender', KAL, 1, AM);
    const weg = terminStandGeloescht(alt, 7, '2026-11-25T10:00:00Z');
    expect(weg).toEqual({ ...alt, geloescht: { von: 7, am: '2026-11-25T10:00:00Z' } });
    expect(istTerminStand(JSON.parse(JSON.stringify(weg)))).toBe(true);
  });

  it('ein schon vermerkter bleibt, wie er ist (zweiter Versuch schreibt nichts doppelt)', () => {
    const weg = terminStandGeloescht(neuerTerminStand(ZIEL, 'offen', null, 1, AM), 7, AM);
    expect(terminStandGeloescht(weg, 9, '2027-01-01T00:00:00Z')).toBe(weg);
  });

  it('ein kaputter Vermerk macht den Wert ungültig', () => {
    const ok = neuerTerminStand(ZIEL, 'offen', null, 1, AM);
    for (const geloescht of [null, true, { von: '7', am: AM }, { von: 7 }])
      expect(istTerminStand({ ...ok, geloescht })).toBe(false);
  });
});

describe('terminStandNach – der Stand passend zum Protokoll (Baustein entfernt bzw. zurückgeholt)', () => {
  const B1 = neuerTerminStand(ZIEL, 'imKalender', KAL, 1, AM);
  const WEG = terminStandGeloescht(B1, 7, AM);

  it('Baustein nicht mehr im Protokoll → als gelöscht vermerkt, Stand und Kalender bleiben', () => {
    expect(terminStandNach(B1, new Set(['b2']), 7, AM)).toEqual(WEG);
  });

  it('Protokoll gelöscht (`null`) → als gelöscht vermerkt, auch wenn der Baustein zuletzt drin stand', () => {
    expect(terminStandNach(B1, null, 7, AM)).toEqual(WEG);
  });

  it('Baustein noch da → derselbe Stand (gleiche Referenz: nichts zu schreiben)', () => {
    expect(terminStandNach(B1, new Set(['b1']), 7, AM)).toBe(B1);
  });

  it('Baustein wieder da (Rückgängig) → ohne Vermerk, sonst unverändert', () => {
    const da = terminStandNach(WEG, new Set(['b1']), 9, AM);
    expect(da).toEqual(B1);
    expect('geloescht' in da).toBe(false);
  });

  it('schon vermerkt und weiter weg → derselbe Stand (der erste Vermerk bleibt)', () => {
    expect(terminStandNach(WEG, new Set(), 9, '2027-01-01T00:00:00Z')).toBe(WEG);
    expect(terminStandNach(WEG, null, 9, '2027-01-01T00:00:00Z')).toBe(WEG);
  });

  it('terminStandWiederDa: ohne Vermerk derselbe Stand', () => {
    expect(terminStandWiederDa(B1)).toBe(B1);
  });
});
