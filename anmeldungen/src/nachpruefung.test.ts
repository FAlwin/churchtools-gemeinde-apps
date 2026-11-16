import { describe, expect, it } from 'vitest';
import { STICHTAG, e, mitglieder, stand } from '@shared/anmeldung/liste.testdaten';
import { nachpruefungAus } from './nachpruefung';

describe('nachpruefungAus', () => {
  it('zählt die Plätze und prüft die Bedingungen an denselben Anmeldungen wie die Liste (F1e)', () => {
    const x = e();
    const st = stand(mitglieder('AAAAAA', [true, false], 10));
    expect(nachpruefungAus(x, st, 10, STICHTAG)).toMatchObject({
      plaetze: { belegt: 1, wartend: 1, max: 10 },
      bedingungen: [],
    });
    // Erst nachher eingestellt: Allergien nur ohne Telefon – Jonas hat welche angegeben, Maria ein Telefon.
    x.formular.person.find((f) => f.id === 'allergy')!.bed = {
      modus: 'eine',
      regeln: [{ feld: 'tel', op: 'leer' }],
    };
    const n = nachpruefungAus(x, st, 10, STICHTAG);
    expect(n.bedingungen.map((b) => [b.name, b.art])).toEqual([['Jonas Beispiel', 'frage']]);
    expect(n.hinweise).toBe(1);
  });
});
