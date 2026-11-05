import { describe, expect, it } from 'vitest';
import {
  ID_LAENGE,
  ID_PRAEFIX,
  istGueltigeId,
  neuerZugang,
  PASSWORT_LAENGE,
  ZEICHEN,
  zufallsText,
  zugangAus,
} from './zugang';

/** Ein „Zufall“, der der Reihe nach diese Bytes liefert. */
const folge = (bytes: number[]) => {
  let i = 0;
  return (n: number) => Uint8Array.from({ length: n }, () => bytes[i++ % bytes.length]);
};

describe('zufallsText', () => {
  it('nur Zeichen aus dem Vorrat, in der verlangten Länge', () => {
    const t = zufallsText(40, (n) => crypto.getRandomValues(new Uint8Array(n)));
    expect(t).toHaveLength(40);
    expect([...t].every((c) => ZEICHEN.includes(c))).toBe(true);
  });

  it('verwirft Bytes oberhalb des letzten vollen Vielfachen – keine Schieflage zu den ersten Zeichen', () => {
    const grenze = 256 - (256 % ZEICHEN.length); // 248 bei 31 Zeichen
    // 255 und 248 würden gefaltet zu Zeichen 7 bzw. 0 – sie müssen übersprungen werden.
    expect(zufallsText(3, folge([255, 248, 0, 1, 2]))).toBe(ZEICHEN[0] + ZEICHEN[1] + ZEICHEN[2]);
    expect(zufallsText(1, folge([grenze - 1]))).toBe(ZEICHEN[(grenze - 1) % ZEICHEN.length]);
  });
});

describe('neuerZugang', () => {
  it('StreamID nimmt VDO.Ninja unverändert an (S0: nur Buchstaben und Ziffern)', () => {
    const z = neuerZugang(true, '2026-11-05T19:30:00.000Z');
    expect(istGueltigeId(z.streamId)).toBe(true);
    expect(z.streamId).toMatch(new RegExp(`^${ID_PRAEFIX}[a-z0-9]{${ID_LAENGE}}$`));
    expect(z.passwort).toHaveLength(PASSWORT_LAENGE);
    expect(z).toMatchObject({ mitBild: true, laeuftSeit: '2026-11-05T19:30:00.000Z' });
  });

  it('jeder Start bringt neue Daten – ein weitergegebener Link gilt nur einen Abend', () => {
    const a = neuerZugang(true, 'x');
    const b = neuerZugang(true, 'x');
    expect(a.streamId).not.toBe(b.streamId);
    expect(a.passwort).not.toBe(b.passwort);
  });
});

describe('zugangAus', () => {
  // Hin und zurück durch den Speicher prüft `ablage.test.ts`; hier nur, was als Zugang gilt.
  it('ein erzeugter Zugang bleibt unverändert', () => {
    const z = neuerZugang(false, '2026-11-05T19:30:00.000Z');
    expect(zugangAus(JSON.parse(JSON.stringify(z)))).toEqual(z);
  });

  it('fremder oder kaputter Inhalt gilt als „keine Übertragung“', () => {
    expect(zugangAus(null)).toBeNull();
    expect(zugangAus('kein Objekt')).toBeNull();
    const z = neuerZugang(true, 'x');
    // Bindestrich: VDO.Ninja würde ihn ersetzen – nicht „fast richtig“ weiterverwenden.
    expect(zugangAus({ ...z, streamId: 'ecg-don' })).toBeNull();
    expect(zugangAus({ ...z, passwort: '' })).toBeNull();
  });

  it('ohne Angabe: mit Bild, keine Übertragung', () => {
    expect(zugangAus({ streamId: 'gebetabc', passwort: 'p' })).toEqual({
      streamId: 'gebetabc',
      passwort: 'p',
      mitBild: true,
      laeuftSeit: null,
    });
  });
});
