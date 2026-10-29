import { describe, expect, it } from 'vitest';
import { passendeAnzahl, schritt, sichtbar } from './fenster';

describe('passendeAnzahl', () => {
  it('so viele Spalten, wie neben die Dienst-Spalte passen; mindestens eine', () => {
    expect(passendeAnzahl(1100, 'schmal', 20)).toBe(5); // (1100 − 180) / 176
    expect(passendeAnzahl(1100, 'breit', 20)).toBe(3); // (1100 − 180) / 256
    expect(passendeAnzahl(300, 'breit', 20)).toBe(1);
  });

  it('Breite unbekannt (0) → alle', () => {
    expect(passendeAnzahl(0, 'schmal', 8)).toBe(8);
  });
});

describe('Terminleiste', () => {
  const G = 10;
  const P = 4;
  const auf = (start: number, anzahl: number | null = null) => ({ start, anzahl });

  it('sichtbar: von/bis, davor/danach', () => {
    expect(sichtbar(auf(0), G, P)).toEqual({ von: 0, bis: 4, davor: false, danach: true });
    expect(sichtbar(auf(8), G, P)).toEqual({ von: 8, bis: 10, davor: true, danach: false });
  });

  it('zurück/weiter um einen Termin, am Rand nichts', () => {
    expect(schritt(auf(2), 'weiter', G, P)).toEqual(auf(3));
    expect(schritt(auf(2), 'zurueck', G, P)).toEqual(auf(1));
    expect(schritt(auf(0), 'zurueck', G, P)).toEqual(auf(0));
    expect(schritt(auf(5), 'weiter', G, P)).toEqual(auf(6)); // 5..8 sichtbar, 9 danach
    expect(schritt(auf(6), 'weiter', G, P)).toEqual(auf(6)); // 6..9 – der letzte ist schon sichtbar
    expect(schritt(auf(6, 4), 'weiter', G, P)).toEqual(auf(6, 4)); // 6..9 – nichts mehr danach
  });

  it('früheren/späteren dazunehmen: eine Spalte mehr, dann nicht mehr „passend“', () => {
    expect(schritt(auf(2), 'spaeterDazu', G, P)).toEqual(auf(2, 5));
    expect(schritt(auf(2), 'frueherDazu', G, P)).toEqual(auf(1, 5));
    expect(schritt(auf(0), 'frueherDazu', G, P)).toEqual(auf(0));
  });

  it('„an Fensterbreite anpassen“ hebt die feste Anzahl auf', () => {
    expect(schritt(auf(3, 7), 'passend', G, P)).toEqual(auf(3));
  });

  it('weniger Termine als Start (z. B. nach dem Filtern) → zurück an den letzten', () => {
    expect(sichtbar(auf(9), 3, P).von).toBe(2);
    expect(sichtbar(auf(0), 0, P)).toEqual({ von: 0, bis: 0, davor: false, danach: false });
  });
});
