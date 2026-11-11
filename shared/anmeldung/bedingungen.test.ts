import { describe, expect, it } from 'vitest';
import {
  BESCHREIBUNG_MAX,
  einstellungenAlsText,
  einstellungenLesen,
  platzBelegt,
  pruefeAntworten,
  pruefeFormular,
  standardFormular,
  type Antworten,
  type Feld,
  type Formular,
} from './formular';
import {
  antwortFrei,
  antwortZustand,
  bedingungFehler,
  feldSichtbar,
  geloestHinweis,
  kurzname,
  leeren,
  loesen,
  moeglicheQuellen,
  ungueltigeAntworten,
  wahlAntworten,
  type AntwortBedingung,
  type Bedingung,
} from './bedingungen';
import { neueEinstellungen } from './vorlagen';

/** F1a – Bedingungen im Formular (Entwurf f1-bedingungen-nachweise-v1, Klick-Runden 07.–11.11.2026). */

function frage(id: string, typ: Feld['typ'], extra: Partial<Feld> = {}): Feld {
  return {
    id,
    art: 'eigen',
    typ,
    frage: `Frage ${id}`,
    hilfe: '',
    zustand: 'freiwillig',
    antworten: [],
    ...extra,
  };
}
const wenn = (feld: string, op: Bedingung['regeln'][number]['op'], wert?: string): Bedingung => ({
  modus: 'eine',
  regeln: [{ feld, op, ...(wert === undefined ? {} : { wert }) }],
});
const nurGetauft = (): AntwortBedingung => ({
  ...wenn('taufe', 'ist', 'Ja'),
  art: 'grau',
  grund: 'nur für Getaufte',
});

const BEREICHE = ['Küche', 'Gruppenleiter', 'Media'];
const ZEITRAUM = ['Aufbauwoche', 'KidsWoche', 'TeensWoche'];

/** Ein Ausschnitt der AC-Mitarbeiter-Anmeldung 2027 (Jotform 263026008688056) – die Regeln von dort. */
function acFormular(): Formular {
  const basis = standardFormular();
  return {
    anmeldung: [
      ...basis.anmeldung,
      frage('taufe', 'janein', { zustand: 'pflicht' }),
      frage('taufHinweis', 'info', { bed: wenn('taufe', 'ist', 'Nein') }),
      frage('zeitraum', 'multi', { antworten: ZEITRAUM, zustand: 'pflicht' }),
      frage('kids1', 'radio', {
        antworten: BEREICHE,
        zustand: 'pflicht',
        bed: wenn('zeitraum', 'enthaelt', 'KidsWoche'),
        antwortBed: { Gruppenleiter: nurGetauft() },
      }),
      frage('kids2', 'radio', {
        antworten: BEREICHE,
        bed: wenn('zeitraum', 'enthaelt', 'KidsWoche'),
        antwortBed: { Gruppenleiter: nurGetauft() },
      }),
      frage('kidsLeiter', 'text', {
        bed: {
          modus: 'eine',
          regeln: [
            { feld: 'kids1', op: 'ist', wert: 'Gruppenleiter' },
            { feld: 'kids2', op: 'ist', wert: 'Gruppenleiter' },
          ],
        },
      }),
      frage('begleit', 'janein', { zustand: 'pflicht' }),
      frage('begleitNamen', 'textarea', { zustand: 'pflicht', bed: wenn('begleit', 'ist', 'Ja') }),
    ],
    person: basis.person,
  };
}

const kontakt = { name: { vor: 'Anna', nach: 'Beispiel' }, mail: 'anna@example.org', priv: true };
function antworten(
  anmeldung: Antworten['anmeldung'],
  personen: Antworten['personen'] = [{ pname: { vor: 'Anna', nach: 'Beispiel' } }],
): Antworten {
  return { anmeldung: { ...kontakt, ...anmeldung }, personen };
}
const feld = (f: Formular, id: string) => [...f.anmeldung, ...f.person].find((x) => x.id === id)!;

describe('feldSichtbar – die Vergleiche', () => {
  const f = acFormular();

  it('ohne Bedingung immer zu sehen', () => {
    expect(feldSichtbar(f, feld(f, 'taufe'), antworten({}))).toBe(true);
  });

  it('„ist“ und „ist nicht“ (Ja/Nein)', () => {
    expect(feldSichtbar(f, feld(f, 'taufHinweis'), antworten({ taufe: 'Nein' }))).toBe(true);
    expect(feldSichtbar(f, feld(f, 'taufHinweis'), antworten({ taufe: 'Ja' }))).toBe(false);
    expect(feldSichtbar(f, feld(f, 'taufHinweis'), antworten({}))).toBe(false);
    const g: Formular = {
      ...f,
      anmeldung: f.anmeldung.map((x) =>
        x.id === 'taufHinweis' ? { ...x, bed: wenn('taufe', 'istNicht', 'Ja') } : x,
      ),
    };
    expect(feldSichtbar(g, feld(g, 'taufHinweis'), antworten({ taufe: 'Nein' }))).toBe(true);
    // „ist nicht“ heißt: beantwortet, aber anders – unbeantwortet zählt nicht.
    expect(feldSichtbar(g, feld(g, 'taufHinweis'), antworten({}))).toBe(false);
  });

  it('„enthält“ und „enthält nicht“ (Mehrfachauswahl)', () => {
    expect(
      feldSichtbar(f, feld(f, 'kids1'), antworten({ zeitraum: ['Aufbauwoche', 'KidsWoche'] })),
    ).toBe(true);
    expect(feldSichtbar(f, feld(f, 'kids1'), antworten({ zeitraum: ['TeensWoche'] }))).toBe(false);
    const g: Formular = {
      ...f,
      anmeldung: f.anmeldung.map((x) =>
        x.id === 'kids1' ? { ...x, bed: wenn('zeitraum', 'enthaeltNicht', 'KidsWoche') } : x,
      ),
    };
    expect(feldSichtbar(g, feld(g, 'kids1'), antworten({ zeitraum: ['TeensWoche'] }))).toBe(true);
    expect(feldSichtbar(g, feld(g, 'kids1'), antworten({ zeitraum: ['KidsWoche'] }))).toBe(false);
  });

  it('„ist ausgefüllt“ und „ist leer“', () => {
    const g: Formular = {
      ...f,
      anmeldung: [
        ...f.anmeldung,
        frage('a', 'text', { bed: wenn('begleitNamen', 'ausgefuellt') }),
        frage('b', 'text', { bed: wenn('begleit', 'leer') }),
      ],
    };
    const voll = antworten({ begleit: 'Ja', begleitNamen: 'Mia, 2.3.2022' });
    expect(feldSichtbar(g, feld(g, 'a'), voll)).toBe(true);
    expect(feldSichtbar(g, feld(g, 'a'), antworten({ begleit: 'Ja', begleitNamen: '   ' }))).toBe(
      false,
    );
    expect(feldSichtbar(g, feld(g, 'b'), antworten({}))).toBe(true);
    expect(feldSichtbar(g, feld(g, 'b'), voll)).toBe(false);
  });

  it('„eine reicht“ und „alle müssen“', () => {
    const leiter = feld(f, 'kidsLeiter');
    const kids = { zeitraum: ['KidsWoche'], taufe: 'Ja' };
    expect(
      feldSichtbar(f, leiter, antworten({ ...kids, kids1: 'Küche', kids2: 'Gruppenleiter' })),
    ).toBe(true);
    const alle = { ...leiter, bed: { ...leiter.bed!, modus: 'alle' as const } };
    expect(
      feldSichtbar(f, alle, antworten({ ...kids, kids1: 'Küche', kids2: 'Gruppenleiter' })),
    ).toBe(false);
    expect(
      feldSichtbar(f, alle, antworten({ ...kids, kids1: 'Gruppenleiter', kids2: 'Gruppenleiter' })),
    ).toBe(true);
  });

  it('ist die Quelle ausgeblendet, gilt ihre Bedingung als nicht erfüllt (mehrstufig)', () => {
    // kids1 = Gruppenleiter steht noch in den Antworten, aber KidsWoche ist abgewählt → kids1 unsichtbar → Leiter weg.
    const a = antworten({ zeitraum: ['TeensWoche'], taufe: 'Ja', kids1: 'Gruppenleiter' });
    expect(feldSichtbar(f, feld(f, 'kidsLeiter'), a)).toBe(false);
  });
});

describe('Kontakt und Personen (Klick-Runde 4)', () => {
  const basis = standardFormular();
  const f: Formular = {
    anmeldung: [...basis.anmeldung, frage('nacht', 'janein')],
    person: [
      ...basis.person,
      frage('zelt', 'radio', {
        antworten: ['eigenes', 'Gruppenzelt'],
        bed: wenn('nacht', 'ist', 'Ja'),
      }),
      frage('essen', 'janein'),
      frage('allergie', 'text', { bed: wenn('essen', 'ist', 'Ja') }),
    ],
  };

  it('eine Frage je Person darf auf eine Kontakt-Frage schauen', () => {
    expect(feldSichtbar(f, feld(f, 'zelt'), antworten({ nacht: 'Ja' }, [{}, {}]), 1)).toBe(true);
    expect(feldSichtbar(f, feld(f, 'zelt'), antworten({ nacht: 'Nein' }, [{}]), 0)).toBe(false);
  });

  it('auf Fragen derselben Person – jede Person für sich', () => {
    const a = antworten({}, [{ essen: 'Ja' }, { essen: 'Nein' }]);
    expect(feldSichtbar(f, feld(f, 'allergie'), a, 0)).toBe(true);
    expect(feldSichtbar(f, feld(f, 'allergie'), a, 1)).toBe(false);
  });

  it('eine Kontakt-Frage schaut nie auf eine Frage je Person; Quellen nur davor', () => {
    const g: Formular = {
      ...f,
      anmeldung: [...f.anmeldung, frage('k', 'text', { bed: wenn('essen', 'ist', 'Ja') })],
    };
    expect(feldSichtbar(g, feld(g, 'k'), antworten({}, [{ essen: 'Ja' }]))).toBe(false);
    expect(moeglicheQuellen(g, feld(g, 'k')).map((x) => x.id)).toEqual([
      'mail',
      'tel',
      'note',
      'nacht',
    ]);
    // Geburtsdatum und Foto-Erlaubnis stehen im Standard auf „aus“ – keine Quelle.
    expect(moeglicheQuellen(f, feld(f, 'allergie')).map((x) => x.id)).toEqual([
      'mail',
      'tel',
      'note',
      'nacht',
      'allergy',
      'zelt',
      'essen',
    ]);
  });
});

describe('pruefeAntworten – Pflicht nur, solange sichtbar', () => {
  const f = acFormular();
  const basis = { taufe: 'Ja', zeitraum: ['TeensWoche'], begleit: 'Nein' };

  it('ausgeblendete Pflichtfragen halten nicht auf', () => {
    expect(pruefeAntworten(f, antworten(basis))).toEqual([]);
  });

  it('auch je Person – jede Person für sich', () => {
    const basis = standardFormular();
    const g: Formular = {
      anmeldung: basis.anmeldung,
      person: [
        ...basis.person,
        frage('essen', 'janein'),
        frage('allergie', 'text', { zustand: 'pflicht', bed: wenn('essen', 'ist', 'Ja') }),
      ],
    };
    const p = (essen: string) => ({ pname: { vor: 'A', nach: 'B' }, essen });
    expect(pruefeAntworten(g, antworten({}, [p('Nein'), p('Ja')]))).toEqual([
      'personen.1.allergie',
    ]);
  });

  it('sichtbare Pflichtfragen schon', () => {
    expect(
      pruefeAntworten(f, antworten({ ...basis, zeitraum: ['KidsWoche'], begleit: 'Ja' })),
    ).toEqual(['anmeldung.kids1', 'anmeldung.begleitNamen']);
  });
});

describe('Antworten mit Bedingung („Gruppenleiter“ nur für Getaufte)', () => {
  const f = acFormular();
  const kids1 = feld(f, 'kids1');

  it('antwortFrei', () => {
    expect(antwortFrei(f, kids1, 'Gruppenleiter', antworten({ taufe: 'Ja' }))).toBe(true);
    expect(antwortFrei(f, kids1, 'Gruppenleiter', antworten({ taufe: 'Nein' }))).toBe(false);
    expect(antwortFrei(f, kids1, 'Küche', antworten({ taufe: 'Nein' }))).toBe(true);
  });

  it('ungueltigeAntworten findet die Wahl, geloestHinweis sagt warum', () => {
    const a = antworten({ taufe: 'Nein', zeitraum: ['KidsWoche'], kids1: 'Gruppenleiter' });
    const u = ungueltigeAntworten(f, a);
    expect(u.map((x) => [x.pfad, x.antwort])).toEqual([['anmeldung.kids1', 'Gruppenleiter']]);
    expect(geloestHinweis(u[0])).toBe(
      '„Gruppenleiter“ ist nur für Getaufte möglich – bitte neu wählen.',
    );
    const ohneGrund = {
      ...u[0],
      feld: { ...kids1, antwortBed: { Gruppenleiter: { ...nurGetauft(), grund: '' } } },
    };
    expect(geloestHinweis(ohneGrund)).toBe(
      '„Gruppenleiter“ ist jetzt nicht mehr möglich – bitte neu wählen.',
    );
  });

  it('in einer ausgeblendeten Frage ist nichts „ungültig“ – die leert leeren() ganz', () => {
    expect(
      ungueltigeAntworten(
        f,
        antworten({ taufe: 'Nein', zeitraum: ['TeensWoche'], kids1: 'Gruppenleiter' }),
      ),
    ).toEqual([]);
  });
});

describe('loesen – während man tippt (F1b)', () => {
  const f = acFormular();

  it('löst nur die ungültige Wahl – Ausgeblendetes behält seinen Wert, die alten Antworten bleiben unberührt', () => {
    const vorher = antworten({
      taufe: 'Nein',
      zeitraum: ['KidsWoche'],
      kids1: 'Gruppenleiter',
      kids2: 'Küche',
      begleit: 'Nein',
      begleitNamen: 'Max',
    });
    const { antworten: nachher, geloest } = loesen(f, vorher);
    expect(nachher.anmeldung.kids1).toBeUndefined();
    expect(nachher.anmeldung.kids2).toBe('Küche');
    // Ausgeblendet (begleit = Nein), aber nicht geleert – taucht die Frage wieder auf, ist der Wert noch da.
    expect(nachher.anmeldung.begleitNamen).toBe('Max');
    expect(geloest.map((u) => [u.pfad, u.antwort])).toEqual([['anmeldung.kids1', 'Gruppenleiter']]);
    expect(vorher.anmeldung.kids1).toBe('Gruppenleiter');
  });

  it('mehrstufig: eine gelöste Wahl sperrt die nächste Antwort', () => {
    const g: Formular = {
      anmeldung: [
        frage('q1', 'janein'),
        frage('q2', 'radio', {
          antworten: ['A', 'B'],
          antwortBed: { A: { ...wenn('q1', 'ist', 'Ja'), art: 'grau' } },
        }),
        frage('q3', 'radio', {
          antworten: ['X', 'Y'],
          antwortBed: { X: { ...wenn('q2', 'ist', 'A'), art: 'weg' } },
        }),
      ],
      person: [],
    };
    const { antworten: nachher, geloest } = loesen(g, {
      anmeldung: { q1: 'Nein', q2: 'A', q3: 'X' },
      personen: [],
    });
    expect(nachher.anmeldung).toEqual({ q1: 'Nein', q2: undefined, q3: undefined });
    expect(geloest.map((u) => u.pfad)).toEqual(['anmeldung.q2', 'anmeldung.q3']);
  });

  it('nichts ungültig → nichts gelöst', () => {
    const a = antworten({ taufe: 'Ja', zeitraum: ['KidsWoche'], kids1: 'Gruppenleiter' });
    expect(loesen(f, a)).toEqual({ antworten: a, geloest: [] });
  });
});

describe('antwortZustand – wie eine Antwort erscheint (F1b)', () => {
  const f = acFormular();
  const kids1 = feld(f, 'kids1');

  it('frei, grau mit Grund, grau ohne Grund, weg', () => {
    expect(antwortZustand(f, kids1, 'Küche', antworten({ taufe: 'Nein' }))).toEqual({
      art: 'frei',
    });
    expect(antwortZustand(f, kids1, 'Gruppenleiter', antworten({ taufe: 'Ja' }))).toEqual({
      art: 'frei',
    });
    expect(antwortZustand(f, kids1, 'Gruppenleiter', antworten({ taufe: 'Nein' }))).toEqual({
      art: 'grau',
      grund: 'nur für Getaufte',
    });
    const ohneGrund = {
      ...kids1,
      antwortBed: { Gruppenleiter: { ...nurGetauft(), grund: '  ' } },
    };
    expect(antwortZustand(f, ohneGrund, 'Gruppenleiter', antworten({ taufe: 'Nein' }))).toEqual({
      art: 'grau',
      grund: undefined,
    });
    const weg = {
      ...kids1,
      antwortBed: { Gruppenleiter: { ...nurGetauft(), art: 'weg' as const } },
    };
    expect(antwortZustand(f, weg, 'Gruppenleiter', antworten({ taufe: 'Nein' }))).toEqual({
      art: 'weg',
    });
  });
});

describe('leeren – vor dem Absenden', () => {
  const f = acFormular();

  it('löst die ungültige Wahl und leert, was dadurch ausgeblendet wird (mehrstufig)', () => {
    const vorher = antworten({
      taufe: 'Nein',
      zeitraum: ['KidsWoche'],
      kids1: 'Gruppenleiter',
      kidsLeiter: 'Lena',
      begleit: 'Nein',
      begleitNamen: 'alt',
    });
    const nachher = leeren(f, vorher);
    expect(nachher.anmeldung.kids1).toBeUndefined();
    expect('kidsLeiter' in nachher.anmeldung).toBe(false);
    expect('begleitNamen' in nachher.anmeldung).toBe(false);
    expect(nachher.anmeldung.zeitraum).toEqual(['KidsWoche']);
    // Die alten Antworten bleiben unberührt.
    expect(vorher.anmeldung.kids1).toBe('Gruppenleiter');
    expect(vorher.anmeldung.kidsLeiter).toBe('Lena');
  });

  it('nimmt bei Mehrfachauswahl nur die ungültige Antwort heraus', () => {
    const g: Formular = {
      ...f,
      anmeldung: f.anmeldung.map((x) =>
        x.id === 'zeitraum'
          ? {
              ...x,
              antwortBed: { Aufbauwoche: { ...wenn('taufe', 'ist', 'Ja'), art: 'weg' as const } },
            }
          : x,
      ),
    };
    const n = leeren(g, antworten({ taufe: 'Nein', zeitraum: ['Aufbauwoche', 'KidsWoche'] }));
    expect(n.anmeldung.zeitraum).toEqual(['KidsWoche']);
  });

  it('leert Fragen je Person einzeln', () => {
    const basis = standardFormular();
    const g: Formular = {
      anmeldung: basis.anmeldung,
      person: [
        ...basis.person,
        frage('essen', 'janein'),
        frage('allergie', 'text', { bed: wenn('essen', 'ist', 'Ja') }),
      ],
    };
    const n = leeren(
      g,
      antworten({}, [
        { essen: 'Ja', allergie: 'Nüsse' },
        { essen: 'Nein', allergie: 'alt' },
      ]),
    );
    expect(n.personen[0].allergie).toBe('Nüsse');
    expect('allergie' in n.personen[1]).toBe(false);
  });

  it('braucht mehrere Runden, wenn eine gelöste Antwort die nächste ungültig macht', () => {
    // x = „a“ nur für Getaufte; y = „b“ nur, wenn x = „a“. Taufe „Nein“ → erst x lösen, dann wird y ungültig.
    const basis = standardFormular();
    const g: Formular = {
      anmeldung: [
        ...basis.anmeldung,
        frage('taufe', 'janein'),
        frage('x', 'radio', { antworten: ['a', 'z'], antwortBed: { a: nurGetauft() } }),
        frage('y', 'radio', {
          antworten: ['b', 'c'],
          antwortBed: { b: { ...wenn('x', 'ist', 'a'), art: 'grau' } },
        }),
      ],
      person: basis.person,
    };
    const n = leeren(g, antworten({ taufe: 'Nein', x: 'a', y: 'b' }));
    expect(n.anmeldung.x).toBeUndefined();
    expect(n.anmeldung.y).toBeUndefined();
  });

  it('ohne Bedingungen ändert sich nichts', () => {
    const a = antworten({
      taufe: 'Ja',
      zeitraum: ['KidsWoche'],
      kids1: 'Gruppenleiter',
      kidsLeiter: 'Lena',
      begleit: 'Nein',
    });
    expect(leeren(f, a)).toEqual(a);
  });
});

describe('bedingungFehler – kaputte Bedingungen werden nicht gespeichert', () => {
  const f = acFormular();
  const mit = (id: string, aenderung: Partial<Feld>): Formular => ({
    ...f,
    anmeldung: f.anmeldung.map((x) => (x.id === id ? { ...x, ...aenderung } : x)),
  });

  it('das AC-Formular ist in Ordnung', () => {
    expect(bedingungFehler(f)).toEqual([]);
    expect(pruefeFormular(f)).toEqual([]);
  });

  it('Quelle gelöscht, Quelle dahinter, Vergleich passt nicht, Antwort umbenannt, leer', () => {
    expect(bedingungFehler(mit('kids1', { bed: wenn('weg', 'ist', 'x') }))).toEqual([
      '„Frage kids1“: Die Frage, auf die die Bedingung schaut, gibt es nicht mehr.',
    ]);
    expect(bedingungFehler(mit('taufHinweis', { bed: wenn('begleit', 'ist', 'Ja') }))).toEqual([
      '„Frage taufHinweis“: Die Bedingung schaut auf „Frage begleit“ – die muss davor stehen.',
    ]);
    expect(bedingungFehler(mit('kids1', { bed: wenn('zeitraum', 'ist', 'KidsWoche') }))).toEqual([
      '„Frage kids1“: Dieser Vergleich passt nicht zu „Frage zeitraum“.',
    ]);
    expect(
      bedingungFehler(mit('kids1', { bed: wenn('zeitraum', 'enthaelt', 'Kids-Woche') })),
    ).toEqual(['„Frage kids1“: Die Antwort „Kids-Woche“ gibt es bei „Frage zeitraum“ nicht mehr.']);
    expect(bedingungFehler(mit('kids1', { bed: { modus: 'eine', regeln: [] } }))).toEqual([
      '„Frage kids1“: Die Bedingung ist leer.',
    ]);
    expect(bedingungFehler(mit('taufe', { zustand: 'aus' }))).toEqual([
      '„Frage taufHinweis“: Die Bedingung schaut auf „Frage taufe“ – die ist ausgeschaltet.',
      '„Frage kids1“, Antwort „Gruppenleiter“: Die Bedingung schaut auf „Frage taufe“ – die ist ausgeschaltet.',
      '„Frage kids2“, Antwort „Gruppenleiter“: Die Bedingung schaut auf „Frage taufe“ – die ist ausgeschaltet.',
    ]);
  });

  it('Antwort mit Bedingung, die es nicht mehr gibt; feste Felder ohne Bedingung', () => {
    // Umbenannt trifft beide: die Antwort-Bedingung UND den Leiter-Wunsch, der auf „Gruppenleiter“ schaut.
    expect(bedingungFehler(mit('kids1', { antworten: ['Küche', 'Leitung', 'Media'] }))).toEqual([
      '„Frage kids1“: Die Antwort „Gruppenleiter“ mit Bedingung gibt es nicht mehr.',
      '„Frage kidsLeiter“: Die Antwort „Gruppenleiter“ gibt es bei „Frage kids1“ nicht mehr.',
    ]);
    expect(bedingungFehler(mit('mail', { bed: wenn('taufe', 'ist', 'Ja') }))).toEqual([
      '„E-Mail“ ist immer dabei und kann keine Bedingung haben.',
    ]);
  });

  it('pruefeFormular meldet sie mit', () => {
    expect(pruefeFormular(mit('kids1', { bed: wenn('weg', 'ist', 'x') }))).toContain(
      '„Frage kids1“: Die Frage, auf die die Bedingung schaut, gibt es nicht mehr.',
    );
  });
});

describe('Speichern in der Beschreibung', () => {
  function acEinstellungen() {
    const e = neueEinstellungen('einfach');
    // So groß wie die echte AC-2027-Anmeldung: rund 37 Felder (mit Hinweisen, Trennlinien, Schritten), Bedingungen
    // an Fragen und Antworten, lange Texte.
    const lang = (n: number) =>
      `Eine lange Frage aus dem AC-Mitarbeiterformular Nummer ${n}, wie sie wirklich gestellt wird?`;
    const viele: Feld[] = Array.from({ length: 24 }, (_, i) =>
      frage(`x${i}`, i % 3 ? 'radio' : 'text', {
        frage: lang(i),
        hilfe: 'Ein Hilfetext darunter, damit es realistisch lang wird.',
        antworten:
          i % 3
            ? [
                'Küche (Warteliste)',
                'Springer (Warteliste)',
                'Gruppenleiter (Warteliste)',
                'Media',
                'Erste Hilfe (Warteliste)',
                'Weitere (nach Rücksprache)',
              ]
            : [],
      }),
    );
    e.formular = { anmeldung: [...acFormular().anmeldung, ...viele], person: e.formular.person };
    e.ctFelder = Object.fromEntries(e.formular.anmeldung.map((x, i) => [x.id, 1400 + i]));
    return e;
  }

  it('Bedingungen, Antwort-Bedingungen und Kurzname überstehen Packen und Lesen', () => {
    const e = acEinstellungen();
    e.formular.anmeldung[e.formular.anmeldung.length - 1].kurz = 'Kurz';
    const zurueck = einstellungenLesen(einstellungenAlsText(e))!;
    expect(zurueck.formular).toEqual(e.formular);
  });

  it('das ganze AC-2027-Formular passt in die 5.000 Zeichen', () => {
    const e = acEinstellungen();
    expect(e.formular.anmeldung.length).toBeGreaterThanOrEqual(37);
    expect(einstellungenAlsText(e).length).toBeLessThan(BESCHREIBUNG_MAX);
    expect(platzBelegt(e)).toBeLessThan(0.6);
  });

  it('ein unbekannter Vergleich wird nicht gespeichert (kein stilles Weglassen)', () => {
    const e = acEinstellungen();
    (e.formular.anmeldung.find((x) => x.id === 'kids1')!.bed!.regeln[0] as { op: string }).op =
      'gleich';
    expect(() => einstellungenAlsText(e)).toThrow();
  });
});

describe('kleine Helfer', () => {
  it('kurzname: eigener Kurzname, sonst gekürzt', () => {
    expect(kurzname(frage('a', 'text', { kurz: ' Leiter-Wunsch Kids ' }))).toBe(
      'Leiter-Wunsch Kids',
    );
    expect(kurzname(frage('a', 'text', { frage: 'Kurz?' }))).toBe('Kurz?');
    const lang = kurzname(
      frage('a', 'text', {
        frage: 'Mit welchem Leiter möchtest du gerne zusammen in eine Gruppe? (KidsWoche)',
      }),
    );
    expect(lang.length).toBe(45);
    expect(lang.endsWith('…')).toBe(true);
  });

  it('wahlAntworten: Ja/Nein fest, sonst die eigenen', () => {
    expect(wahlAntworten(frage('a', 'janein'))).toEqual(['Ja', 'Nein']);
    expect(wahlAntworten(frage('a', 'radio', { antworten: ['x', 'y'] }))).toEqual(['x', 'y']);
  });
});
