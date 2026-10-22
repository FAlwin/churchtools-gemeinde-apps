import { describe, expect, it } from 'vitest';
import { namenFinden, platzhalterAnwenden, zuruecksetzen, type Person } from './platzhalter';

const P = (id: number, vorname: string, nachname: string): Person => ({ id, vorname, nachname });
const ALWIN = P(1, 'Alwin', 'Friesen');
const PETER = P(3, 'Peter', 'Wiens');
const DANIEL = P(4, 'Daniel', 'Schmidt');
const ANNA = P(6, 'Anna', 'Klassen');
const ALLE = [ALWIN, PETER, DANIEL, ANNA, P(9, 'Peter', 'Neufeld')];
const GRUPPE = [ALWIN, PETER, DANIEL];

const TRANSKRIPT = `Alwin: Gut, dann fangen wir an. Peter hat heute die Andacht.
Peter Wiens: Römer 12. Lasst uns auch für Familie Neumann beten.
Alwin: Daniel, wie weit ist der Beamer? Anna Klassen hat auch gefragt.
Daniel: Zwei Angebote. Herr Becker meldet sich. Petersilie kaufen wir nicht.`;

describe('namenFinden', () => {
  const funde = namenFinden(TRANSKRIPT, { alle: ALLE, gruppe: GRUPPE }, ['Krankenhaus Siegburg']);

  it('findet Vornamen der Gruppe, volle Namen aller und Muster – in Reihenfolge des Auftretens', () => {
    expect(funde.map((f) => [f.text, f.platzhalter, f.art, f.anzahl])).toEqual([
      ['Alwin', '[Person 1]', 'vorname', 2],
      ['Peter', '[Person 2]', 'vorname', 1],
      ['Peter Wiens', '[Person 2]', 'person', 1],
      ['Familie Neumann', '[Person 3]', 'muster', 1],
      ['Daniel', '[Person 4]', 'vorname', 2],
      ['Anna Klassen', '[Person 5]', 'person', 1],
      ['Herr Becker', '[Person 6]', 'muster', 1],
    ]);
  });

  it('zählt einen vollen Namen nicht zusätzlich als Vorname und trifft nur ganze Wörter', () => {
    expect(funde.find((f) => f.text === 'Peter')?.anzahl).toBe(1); // nicht in „Peter Wiens“, nicht in „Petersilie“
  });

  it('nimmt eigene Begriffe nur, wenn sie vorkommen, und alle sind vorbelegt mit „ersetzen“', () => {
    expect(funde.some((f) => f.art === 'eigen')).toBe(false);
    expect(funde.every((f) => f.ersetzen)).toBe(true);
    const mitEigenem = namenFinden('Mutter im Krankenhaus Siegburg', { alle: [], gruppe: [] }, [
      'Krankenhaus Siegburg',
    ]);
    expect(mitEigenem).toEqual([
      {
        text: 'Krankenhaus Siegburg',
        platzhalter: '[Vertraulich 1]',
        art: 'eigen',
        anzahl: 1,
        ersetzen: true,
      },
    ]);
  });

  it('Vorname mehrerer Gruppenmitglieder: eigener Platzhalter, nicht einer Person zugeordnet', () => {
    const g = [PETER, P(9, 'Peter', 'Neufeld')];
    const f = namenFinden('Peter kommt. Peter Wiens auch.', { alle: g, gruppe: g });
    const vorname = f.find((x) => x.text === 'Peter')!;
    expect(vorname.personId).toBeUndefined();
    expect(vorname.platzhalter).not.toBe(f.find((x) => x.text === 'Peter Wiens')!.platzhalter);
  });
});

describe('platzhalterAnwenden / zuruecksetzen', () => {
  const funde = namenFinden(TRANSKRIPT, { alle: ALLE, gruppe: GRUPPE });

  it('im Auftrag steht kein einziger gefundener Name mehr', () => {
    const { text } = platzhalterAnwenden(TRANSKRIPT, funde);
    for (const f of funde)
      expect(text).not.toMatch(new RegExp(`(?<![\\p{L}])${f.text}(?![\\p{L}])`, 'u'));
    expect(text).toContain('Petersilie');
  });

  it('nicht angehakte Funde bleiben stehen', () => {
    const ohneAnna = funde.map((f) => (f.text === 'Anna Klassen' ? { ...f, ersetzen: false } : f));
    expect(platzhalterAnwenden(TRANSKRIPT, ohneAnna).text).toContain('Anna Klassen');
  });

  it('setzt in der Antwort die Namen zurück – bei geteiltem Platzhalter den vollen Namen', () => {
    const { zuordnung } = platzhalterAnwenden(TRANSKRIPT, funde);
    expect(zuordnung['[Person 2]']).toBe('Peter Wiens');
    expect(
      zuruecksetzen(
        '[Person 2] hält die Andacht. Gebet für [Person 3]. [Person 99] bleibt.',
        zuordnung,
      ),
    ).toBe('Peter Wiens hält die Andacht. Gebet für Familie Neumann. [Person 99] bleibt.');
  });
});
