import { describe, it, expect } from 'vitest';
import type { AgendaItem } from '@shared/types/index';
import { beginnStelle, vorlaufNachUmsortieren } from './vorlauf';

/**
 * #423: Wo die Linie „Beginn" steht und wie sie beim Umsortieren an ihrem Platz bleibt. Beides teilen
 * Ansicht und Bearbeiten-Liste – stünde die Linie in einer der beiden woanders, sprängen die Zeilen
 * beim Umschalten.
 */
const punkt = (id: number, vorBeginn: boolean): AgendaItem =>
  ({ id, title: `P${id}`, vorBeginn }) as unknown as AgendaItem;

describe('beginnStelle', () => {
  it('ohne Vorlauf keine Linie', () => {
    expect(beginnStelle([punkt(1, false), punkt(2, false)])).toBe(-1);
  });

  it('vor dem ersten Punkt nach dem Vorlauf', () => {
    expect(beginnStelle([punkt(1, true), punkt(2, true), punkt(3, false)])).toBe(2);
  });

  it('sind alle Punkte Vorlauf, steht sie am Ende', () => {
    expect(beginnStelle([punkt(1, true), punkt(2, true)])).toBe(2);
  });

  it('„entfernt"-Platzhalter ziehen die Linie nicht vor sich', () => {
    // Ein zerfallender Punkt zwischen Vorlauf und Gottesdienst: Die Linie gehört vor den echten Punkt.
    const zeilen = [punkt(1, true), { removed: true }, punkt(3, false)];
    expect(beginnStelle(zeilen)).toBe(2);
  });

  it('leerer Ablauf: keine Linie', () => {
    expect(beginnStelle([])).toBe(-1);
  });
});

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
