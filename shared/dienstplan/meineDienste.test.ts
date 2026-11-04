import { describe, expect, it } from 'vitest';
import { dienstAusAnfragen } from './meineDienste';

describe('dienstAusAnfragen', () => {
  it('je Termin die eigenen Dienste, offen und zugesagt – wie `/persons/{ich}/servicerequests` sie liefert', () => {
    const je = dienstAusAnfragen([
      { serviceName: 'Ton', isAccepted: true, isValid: true, event: { id: 160 } },
      { serviceName: 'Gesang', isAccepted: false, isValid: true, event: { id: 160 } },
      { serviceName: 'Licht', isAccepted: true, event: { id: 163 } },
    ]);
    expect(je.get(160)).toEqual([
      { name: 'Ton', zugesagt: true },
      { name: 'Gesang', zugesagt: false },
    ]);
    expect(je.get(163)).toEqual([{ name: 'Licht', zugesagt: true }]);
  });

  it('ungültige (ersetzte) und unlesbare Einträge fallen weg; ohne Namen heißt es „Dienst“', () => {
    const je = dienstAusAnfragen([
      { serviceName: 'Ton', isAccepted: true, isValid: false, event: { id: 1 } },
      { serviceName: 'Ton', event: null },
      null,
      { serviceName: '  ', isAccepted: false, event: { id: 2 } },
    ]);
    expect(je.has(1)).toBe(false);
    expect(je.get(2)).toEqual([{ name: 'Dienst', zugesagt: false }]);
    expect(je.size).toBe(1);
  });
});
