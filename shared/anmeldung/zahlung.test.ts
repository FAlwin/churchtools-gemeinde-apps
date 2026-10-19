import { describe, expect, it } from 'vitest';
import {
  STANDARD_ZAHLARTEN,
  aufschluesselungMitHand,
  vonHandBetrag,
  vonHandZeile,
  zahlartenFuer,
  zahlartenSauber,
} from './zahlung';
import { nachpruefen, pruefMitgliederAus } from './nachpruefung';
import { e, mitglieder, stand } from './liste.testdaten';

/** Zahlung (A7-2): Zahlarten je Gemeinde und Veranstaltung, Betrag von Hand – und die Gegenseite in der Nachprüfung. */
describe('Zahlarten', () => {
  it('bereinigt: getrimmt, ohne leere, ohne doppelte (auch in anderer Schreibweise)', () => {
    expect(zahlartenSauber([' Bar ', 'bar', '', 3, 'Kartenzahlung'])).toEqual([
      'Bar',
      'Kartenzahlung',
    ]);
  });
  it('je Veranstaltung: die der Gemeinde ohne die abgewählten', () => {
    expect(zahlartenFuer([...STANDARD_ZAHLARTEN], ['PayPal', 'gibt es nicht'])).toEqual([
      'Überweisung',
      'Bar',
    ]);
  });
});

describe('Betrag von Hand', () => {
  it('die Zeile in der Aufschlüsselung wird erkannt; eine neue ersetzt die alte', () => {
    const eins = aufschluesselungMitHand(
      'Kind (8 J.): 15,00 €\nGesamt: 15,00 €',
      3000,
      '2026-10-19',
    );
    expect(eins.split('\n').at(-1)).toBe(vonHandZeile(3000, '2026-10-19'));
    expect(vonHandBetrag(eins)).toBe(3000);
    const zwei = aufschluesselungMitHand(eins, 2500, '2026-10-20');
    expect(zwei.match(/Von Hand/g)).toHaveLength(1);
    expect(vonHandBetrag(zwei)).toBe(2500);
    expect(vonHandBetrag('Gesamt: 15,00 €')).toBeNull();
  });

  it('Nachprüfung: von Hand gesetzt → kein Befund; danach wieder geändert → Befund', () => {
    const x = e();
    const roh = mitglieder('AAAAAA', [true, true], 10);
    const erste = roh[0].fields!;
    const setze = (feld: number, wert: string) => (erste.find((f) => f.id === feld)!.value = wert);
    // Statt 12 € nach Absprache 10 €.
    setze(x.ctFelder.betrag, '10,00 €');
    const auf = String(erste.find((f) => f.id === x.ctFelder.aufschluesselung)!.value);
    setze(x.ctFelder.aufschluesselung, aufschluesselungMitHand(auf, 1000, '2026-10-19'));
    const plaetze = { belegt: 2, wartend: 0, max: 10 };
    expect(nachpruefen(x, pruefMitgliederAus(x, stand(roh)), plaetze).betraege).toEqual([]);
    // Jemand ändert in ChurchTools den Betrag, ohne die Zeile → wieder ein Befund.
    setze(x.ctFelder.betrag, '0,00 €');
    expect(nachpruefen(x, pruefMitgliederAus(x, stand(roh)), plaetze).betraege[0].grund).toBe(
      'abweichend',
    );
  });
});
