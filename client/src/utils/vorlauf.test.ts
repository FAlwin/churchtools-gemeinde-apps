import { describe, it, expect } from 'vitest';
import type { AgendaItem } from '@shared/types/index';
import { vorlaufNachUmsortieren } from './vorlauf';

/**
 * #423: Wo die Linie „Beginn" steht und wie sie beim Umsortieren an ihrem Platz bleibt. Beides teilen
 * Ansicht und Bearbeiten-Liste – stünde die Linie in einer der beiden woanders, sprängen die Zeilen
 * beim Umschalten.
 */
const punkt = (id: number, vorBeginn: boolean): AgendaItem =>
  ({ id, title: `P${id}`, vorBeginn }) as unknown as AgendaItem;

describe('vorlaufNachUmsortieren – die Grenze ist eine Platznummer (wie in ChurchTools)', () => {
  const vorher = [punkt(1, true), punkt(2, true), punkt(3, false), punkt(4, false)];

  it('ein Punkt aus dem Gottesdienst nach oben geschoben wird Vorlauf, der letzte Vorlauf rutscht raus', () => {
    const nachher = vorlaufNachUmsortieren(vorher, [vorher[3], vorher[0], vorher[1], vorher[2]]);
    expect(nachher.map((i) => [i.id, i.vorBeginn])).toEqual([
      [4, true],
      [1, true],
      [2, false],
      [3, false],
    ]);
  });

  it('innerhalb des Gottesdienstes umsortiert: der Vorlauf bleibt, wie er ist', () => {
    const nachher = vorlaufNachUmsortieren(vorher, [vorher[0], vorher[1], vorher[3], vorher[2]]);
    expect(nachher.map((i) => i.vorBeginn)).toEqual([true, true, false, false]);
    expect(nachher[0]).toBe(vorher[0]); // unveränderte Punkte bleiben dieselben Objekte
  });

  it('ohne Vorlauf ändert Umsortieren nichts daran', () => {
    const ohne = [punkt(1, false), punkt(2, false)];
    expect(vorlaufNachUmsortieren(ohne, [ohne[1], ohne[0]]).map((i) => i.vorBeginn)).toEqual([
      false,
      false,
    ]);
  });
});
