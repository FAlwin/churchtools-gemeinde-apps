import { describe, expect, it } from 'vitest';
import { aehnlich, aehnlicheZeile, MIN_GEMEINSAM, SCHWELLE, STAMM, woerter } from './doppelt';

describe('woerter', () => {
  it('Groß-/Kleinschreibung, Satzzeichen, Umlaut-Schreibweise und Füllwörter spielen keine Rolle', () => {
    expect([...woerter('Für die Küche: Das Kochteam steht!')].sort()).toEqual(
      [...woerter('fuer kueche kochteam STEHT')].sort(),
    );
    expect(woerter('Der Hund und die Katze').has('der')).toBe(false);
  });
  it('lange Wörter werden auf den Stamm gekürzt, Zahlen bleiben', () => {
    expect(woerter('Eishalle')).toEqual(woerter('Eishallen'));
    expect(woerter('anfragen')).toEqual(woerter('Anfrage'));
    expect(woerter('12:30 Uhr')).toEqual(new Set(['12', '30', 'uhr']));
    expect([...woerter('Troisdorf')][0]).toHaveLength(STAMM);
  });
});

describe('aehnlich – Schwelle und Mindestzahl', () => {
  it('der Fall aus dem Entwurf: Eishalle anfragen – sonst/alternativ Wiehl', () => {
    expect(
      aehnlich(
        'Eishalle in Troisdorf anfragen, sonst Wiehl',
        'Eishalle Troisdorf anfragen, alternativ Wiehl.',
      ),
    ).toBe(true);
  });
  it('ein knapper Stichpunkt, der ganz in der längeren Zeile steckt, ist ein Doppelter (in beide Richtungen)', () => {
    const lang = 'Das Kochteam steht, wir kochen für 70 Personen.';
    expect(aehnlich('Kochteam steht', lang)).toBe(true);
    expect(aehnlich(lang, 'Kochteam steht')).toBe(true);
  });
  it('Schwelle: 3 von 4 Wörtern des kürzeren Textes reichen (75 %), 2 von 4 nicht', () => {
    expect(SCHWELLE).toBe(0.75);
    expect(aehnlich('Alpha Bravo Charlie Delta', 'Alpha Bravo Charlie Echo Foxtrot')).toBe(true);
    expect(aehnlich('Alpha Bravo Charlie Delta', 'Alpha Bravo Golf Hotel India')).toBe(false);
    // knapp darunter: 3 von 5
    expect(aehnlich('Alpha Bravo Charlie Delta Echo', 'Alpha Bravo Charlie Golf Hotel')).toBe(false);
  });
  it('mindestens zwei gemeinsame Wörter: „Uhr“ allein macht noch keinen Doppelten', () => {
    expect(MIN_GEMEINSAM).toBe(2);
    expect(aehnlich('Essen um 12:30 Uhr', 'Aufbau um 15 Uhr')).toBe(false);
    expect(aehnlich('Aufbau 15 Uhr', 'Aufbau am Samstag um 15 Uhr')).toBe(true);
  });
  it('ein Ein-Wort-Text zählt nur gegen einen Ein-Wort-Text', () => {
    expect(aehnlich('Eislaufen', 'Eislaufen')).toBe(true);
    expect(aehnlich('Eislaufen', 'Eislaufen am 06.01. mit Essen')).toBe(false);
  });
  it('leer oder nur Füllwörter: nie ähnlich', () => {
    expect(aehnlich('', 'Eislaufen am Sonntag')).toBe(false);
    expect(aehnlich('der die das', 'der die das')).toBe(false);
  });
});

describe('aehnlicheZeile', () => {
  const zeilen = [
    { text: 'Kuchen mitbringen', id: 1 },
    { text: 'Eishalle Troisdorf anfragen, alternativ Wiehl.', id: 2 },
  ];
  it('liefert die erste passende Zeile oder null', () => {
    expect(aehnlicheZeile('Eishalle in Troisdorf anfragen', zeilen)?.id).toBe(2);
    expect(aehnlicheZeile('Etwas ganz anderes hier', zeilen)).toBeNull();
    expect(aehnlicheZeile('x', [])).toBeNull();
  });
});
