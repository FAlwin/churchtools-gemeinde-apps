import { describe, expect, it } from 'vitest';
import type { Antworten, Feld, Formular } from '@shared/anmeldung/formular';
import { naechsterStand, type BedingtStand } from './useBedingungen';

/** F1b – wie die Eingabe Bedingungen anwendet: Wahl lösen, Hinweis halten oder vergessen. */

const feld = (id: string, typ: Feld['typ'], extra: Partial<Feld> = {}): Feld => ({
  id,
  art: 'eigen',
  typ,
  frage: id,
  hilfe: '',
  zustand: 'freiwillig',
  antworten: [],
  ...extra,
});
const f: Formular = {
  anmeldung: [feld('notiz', 'text')],
  person: [
    feld('taufe', 'janein'),
    feld('rolle', 'radio', {
      antworten: ['Teilnehmer', 'Gruppenleiter'],
      antwortBed: {
        Gruppenleiter: {
          modus: 'eine',
          regeln: [{ feld: 'taufe', op: 'ist', wert: 'Ja' }],
          art: 'grau',
          grund: 'nur für Getaufte',
        },
      },
    }),
  ],
};
const HINWEIS = '„Gruppenleiter“ ist nur für Getaufte möglich – bitte neu wählen.';
const stand = (a: Antworten, hinweise: Record<string, string> = {}): BedingtStand => ({
  antworten: a,
  hinweise,
});

describe('naechsterStand', () => {
  const leiter = { taufe: 'Ja', rolle: 'Gruppenleiter' };

  it('wird eine Wahl ungültig: lösen und den Hinweis an genau diese Frage hängen', () => {
    const neu = naechsterStand(f, stand({ anmeldung: {}, personen: [leiter] }), {
      anmeldung: {},
      personen: [{ taufe: 'Nein', rolle: 'Gruppenleiter' }],
    });
    expect(neu.antworten.personen[0].rolle).toBeUndefined();
    expect(neu.hinweise).toEqual({ 'personen.0.rolle': HINWEIS });
  });

  it('der Hinweis bleibt, solange an der Frage nichts geändert wird – und geht bei neuer Wahl', () => {
    const alt = stand(
      { anmeldung: {}, personen: [{ taufe: 'Nein' }] },
      { 'personen.0.rolle': HINWEIS },
    );
    const anderes = naechsterStand(f, alt, {
      anmeldung: { notiz: 'x' },
      personen: alt.antworten.personen,
    });
    expect(anderes.hinweise).toEqual({ 'personen.0.rolle': HINWEIS });
    const neuGewaehlt = naechsterStand(f, alt, {
      anmeldung: {},
      personen: [{ taufe: 'Nein', rolle: 'Teilnehmer' }],
    });
    expect(neuGewaehlt.hinweise).toEqual({});
  });

  it('fällt eine Person weg, verschieben sich die Nummern – die alten Hinweise je Person gelten nicht mehr', () => {
    const zweite = { taufe: 'Nein' };
    const alt = stand(
      { anmeldung: {}, personen: [{ taufe: 'Nein' }, zweite] },
      { 'personen.0.rolle': HINWEIS },
    );
    // Person 1 entfernt: die bisherige Person 2 rückt auf Platz 0 – ohne fremden Hinweis.
    expect(naechsterStand(f, alt, { anmeldung: {}, personen: [zweite] }).hinweise).toEqual({});
  });
});
