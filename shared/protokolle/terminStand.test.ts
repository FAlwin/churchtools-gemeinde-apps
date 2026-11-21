import { describe, expect, it } from 'vitest';
import {
  istTerminStand,
  neuerTerminStand,
  standNachId,
  terminStandId,
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
