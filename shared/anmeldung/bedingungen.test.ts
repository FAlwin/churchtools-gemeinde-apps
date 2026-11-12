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
  bedingungAufbereiten,
  gemeinsameQuellen,
  gleicheBedingung,
  kannBedingungTragen,
  regelGruppen,
  regelSetzen,
  zielKandidaten,
  bedingungFehler,
  bedingungSatz,
  bedingungenAufraeumen,
  bedingungenNachziehen,
  bedingungenUmbenennen,
  istQuelle,
  kaputteStellen,
  umbenannteAntworten,
  verschiebenSperre,
  weggefallenText,
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
import { geburtsdatumAn, mitWer } from './formular';
import { einordnen } from './baukasten';

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

// ── F1c: Bedingungen ziehen mit (Alwin, 12.11.2026) ─────────────────────────────────────────────

describe('kaputteStellen – die EINE Prüfung hinter bedingungFehler', () => {
  const f = acFormular();
  it('nennt Ziel, Antwort, Regel, Quelle und Grund', () => {
    const ohneTaufe: Formular = {
      ...f,
      anmeldung: f.anmeldung.map((x) => (x.id === 'taufe' ? { ...x, zustand: 'aus' } : x)),
    };
    expect(
      kaputteStellen(ohneTaufe).map((s) => [s.ziel.id, s.antwort, s.regel, s.quelle?.id, s.grund]),
    ).toEqual([
      ['taufHinweis', undefined, 0, 'taufe', 'aus'],
      ['kids1', 'Gruppenleiter', 0, 'taufe', 'aus'],
      ['kids2', 'Gruppenleiter', 0, 'taufe', 'aus'],
    ]);
    expect(bedingungFehler(ohneTaufe)).toEqual(kaputteStellen(ohneTaufe).map((s) => s.text));
  });
});

describe('bedingungenUmbenennen – umbenannte Antworten ziehen mit', () => {
  it('Regeln anderer Fragen und die Bedingung AN der Antwort', () => {
    const f = acFormular();
    const neu = bedingungenUmbenennen(f, 'kids1', { Gruppenleiter: 'Gruppenleitung' });
    expect(feld(neu, 'kidsLeiter').bed!.regeln).toEqual([
      { feld: 'kids1', op: 'ist', wert: 'Gruppenleitung' },
      // kids2 heißt weiter „Gruppenleiter“ – nur Regeln auf kids1 ziehen mit.
      { feld: 'kids2', op: 'ist', wert: 'Gruppenleiter' },
    ]);
    expect(Object.keys(feld(neu, 'kids1').antwortBed!)).toEqual(['Gruppenleitung']);
    expect(Object.keys(feld(neu, 'kids2').antwortBed!)).toEqual(['Gruppenleiter']);
    // Das alte Formular bleibt unberührt.
    expect(Object.keys(feld(f, 'kids1').antwortBed!)).toEqual(['Gruppenleiter']);
  });

  it('ein Tausch (A ↔ B) geht in einem Schritt', () => {
    const f = acFormular();
    const neu = bedingungenUmbenennen(f, 'zeitraum', {
      KidsWoche: 'TeensWoche',
      TeensWoche: 'KidsWoche',
    });
    expect(feld(neu, 'kids1').bed!.regeln[0].wert).toBe('TeensWoche');
  });

  it('umbenannteAntworten: nur, was sich wirklich geändert hat (ohne Leerzeichen am Rand)', () => {
    expect(
      umbenannteAntworten([
        { text: 'Gruppenleitung ', von: 'Gruppenleiter' },
        { text: 'Küche', von: 'Küche' },
        { text: 'Neu' },
      ]),
    ).toEqual({ Gruppenleiter: 'Gruppenleitung' });
    expect(umbenannteAntworten(undefined)).toEqual({});
  });
});

describe('bedingungenAufraeumen – „Bedingung fällt mit weg“', () => {
  const ohne = (f: Formular, id: string): Formular => ({
    anmeldung: f.anmeldung.filter((x) => x.id !== id),
    person: f.person.filter((x) => x.id !== id),
  });

  it('Quelle entfernt: die Bedingung fällt ganz weg, die Frage ist danach immer zu sehen', () => {
    const { formular, weggefallen } = bedingungenAufraeumen(ohne(acFormular(), 'begleit'));
    expect(feld(formular, 'begleitNamen').bed).toBeUndefined();
    expect(weggefallen.map((w) => [w.ziel.id, w.antwort, w.ganz])).toEqual([
      ['begleitNamen', undefined, true],
    ]);
    expect(bedingungFehler(formular)).toEqual([]);
  });

  it('eine von zwei Regeln fällt weg: der Rest bleibt, als Teil gemeldet', () => {
    const { formular, weggefallen } = bedingungenAufraeumen(ohne(acFormular(), 'kids2'));
    expect(feld(formular, 'kidsLeiter').bed).toEqual({
      modus: 'eine',
      regeln: [{ feld: 'kids1', op: 'ist', wert: 'Gruppenleiter' }],
    });
    expect(weggefallen.map((w) => [w.ziel.id, w.ganz])).toEqual([['kidsLeiter', false]]);
  });

  it('Antwort der Quelle entfernt, Antwort mit Bedingung entfernt, Quelle ausgeschaltet', () => {
    const f = acFormular();
    const mit = (id: string, x: Partial<Feld>): Formular => ({
      ...f,
      anmeldung: f.anmeldung.map((y) => (y.id === id ? { ...y, ...x } : y)),
    });
    // „KidsWoche“ aus dem Zeitraum entfernt → beide Kids-Fragen ohne Bedingung.
    const a = bedingungenAufraeumen(mit('zeitraum', { antworten: ['Aufbauwoche', 'TeensWoche'] }));
    expect([feld(a.formular, 'kids1').bed, feld(a.formular, 'kids2').bed]).toEqual([
      undefined,
      undefined,
    ]);
    // „Gruppenleiter“ aus kids1 entfernt → seine Antwort-Bedingung fällt weg, ebenso die Regel des Leiter-Wunschs.
    const b = bedingungenAufraeumen(mit('kids1', { antworten: ['Küche', 'Media'] }));
    expect(feld(b.formular, 'kids1').antwortBed).toBeUndefined();
    expect(feld(b.formular, 'kidsLeiter').bed!.regeln).toEqual([
      { feld: 'kids2', op: 'ist', wert: 'Gruppenleiter' },
    ]);
    expect(b.weggefallen.map((w) => [w.ziel.id, w.antwort, w.ganz])).toEqual([
      ['kids1', 'Gruppenleiter', true],
      ['kidsLeiter', undefined, false],
    ]);
    // Taufe ausgeschaltet → Hinweis und beide Antwort-Bedingungen weg.
    const c = bedingungenAufraeumen(mit('taufe', { zustand: 'aus' }));
    expect(bedingungFehler(c.formular)).toEqual([]);
    expect(c.weggefallen).toHaveLength(3);
  });

  it('ein anderer Fragetyp: Vergleich passt nicht mehr → weg', () => {
    const f = acFormular();
    const { formular } = bedingungenAufraeumen({
      ...f,
      anmeldung: f.anmeldung.map((y) =>
        y.id === 'zeitraum' ? { ...y, typ: 'text', antworten: [] } : y,
      ),
    });
    expect(feld(formular, 'kids1').bed).toBeUndefined();
  });

  it('„steht dahinter“ räumt es NICHT auf (das verhindert die Sperre), und ohne Fund kommt dasselbe Formular', () => {
    const f = acFormular();
    const verdreht = einordnen(f, 'taufe', 'anmeldung', null);
    expect(bedingungenAufraeumen(verdreht).formular).toBe(verdreht);
    expect(bedingungenAufraeumen(f)).toEqual({ formular: f, weggefallen: [] });
    expect(bedingungenAufraeumen(f).formular).toBe(f);
  });

  it('bedingungenNachziehen: erst umbenennen, dann aufräumen – Umbenanntes bleibt', () => {
    const f = acFormular();
    const kids1 = { ...feld(f, 'kids1'), antworten: ['Küche', 'Gruppenleitung', 'Media'] };
    const geaendert: Formular = {
      ...f,
      anmeldung: f.anmeldung.map((y) => (y.id === 'kids1' ? kids1 : y)),
    };
    const { formular, weggefallen } = bedingungenNachziehen(geaendert, {
      feldId: 'kids1',
      antworten: { Gruppenleiter: 'Gruppenleitung' },
    });
    expect(weggefallen).toEqual([]);
    expect(Object.keys(feld(formular, 'kids1').antwortBed!)).toEqual(['Gruppenleitung']);
    expect(feld(formular, 'kidsLeiter').bed!.regeln[0].wert).toBe('Gruppenleitung');
  });

  it('mitWer: Geburtsdatum ausgeschaltet → Bedingungen darauf fallen weg', () => {
    const e = neueEinstellungen('freizeit');
    const ziel = frage('kurs', 'text', { bed: wenn('birth', 'ausgefuellt') });
    e.formular.person.push(ziel);
    expect(geburtsdatumAn(e.formular)).toBe(true);
    const neu = mitWer(e, e.wer, false);
    expect(feld(neu.formular, 'kurs').bed).toBeUndefined();
    expect(bedingungFehler(neu.formular)).toEqual([]);
  });
});

describe('weggefallenText – der Satz zur Meldung', () => {
  const f = acFormular();
  it('ganz, mehrere, ein Teil, beides, nichts', () => {
    const z = (id: string) => feld(f, id);
    expect(weggefallenText([{ ziel: z('kids1'), ganz: true }])).toBe(
      'Die Bedingung bei „Frage kids1“ fällt mit weg.',
    );
    expect(
      weggefallenText([
        { ziel: z('kids1'), ganz: true },
        { ziel: z('kids2'), antwort: 'Gruppenleiter', ganz: true },
        { ziel: z('taufHinweis'), ganz: true },
      ]),
    ).toBe(
      'Die Bedingungen bei „Frage kids1“, „Frage kids2“ (Antwort „Gruppenleiter“) und „Frage taufHinweis“ fallen mit weg.',
    );
    expect(weggefallenText([{ ziel: z('kidsLeiter'), ganz: false }])).toBe(
      'Bei „Frage kidsLeiter“ fällt ein Teil der Bedingung weg.',
    );
    expect(
      weggefallenText([
        { ziel: z('kids1'), ganz: true },
        { ziel: z('kidsLeiter'), ganz: false },
      ]),
    ).toBe(
      'Die Bedingung bei „Frage kids1“ fällt mit weg. Bei „Frage kidsLeiter“ fällt ein Teil der Bedingung weg.',
    );
    expect(weggefallenText([])).toBe('');
  });
});

describe('verschiebenSperre – „Verschieben sperren“', () => {
  const f = acFormular();
  it('Quelle hinter ihr Ziel oder Ziel vor seine Quelle → gesperrt, mit Satz', () => {
    expect(verschiebenSperre(f, einordnen(f, 'begleit', 'anmeldung', null))).toBe(
      '„Frage begleit“ muss vor „Frage begleitNamen“ bleiben – dort ist sie Bedingung.',
    );
    expect(verschiebenSperre(f, einordnen(f, 'begleitNamen', 'anmeldung', 'begleit'))).toBe(
      '„Frage begleit“ muss vor „Frage begleitNamen“ bleiben – dort ist sie Bedingung.',
    );
  });

  it('Kontakt-Frage als Quelle zu den Fragen je Person → gesperrt, anderer Satz', () => {
    expect(verschiebenSperre(f, einordnen(f, 'begleit', 'person', null))).toBe(
      '„Frage begleitNamen“ schaut auf „Frage begleit“ – beide müssen bei den Kontakt-Fragen stehen, „Frage begleit“ davor.',
    );
  });

  it('erlaubt: unbeteiligte Felder, das Ziel nach unten, ein Ziel je Person auf eine Kontakt-Frage', () => {
    expect(verschiebenSperre(f, einordnen(f, 'tel', 'anmeldung', null))).toBeNull();
    expect(verschiebenSperre(f, einordnen(f, 'begleitNamen', 'anmeldung', null))).toBeNull();
    expect(verschiebenSperre(f, einordnen(f, 'begleitNamen', 'person', null))).toBeNull();
  });

  it('was schon vorher kaputt war, sperrt nicht noch einmal', () => {
    const kaputt = einordnen(f, 'begleit', 'anmeldung', null);
    expect(verschiebenSperre(kaputt, einordnen(kaputt, 'tel', 'anmeldung', null))).toBeNull();
  });
});

describe('istQuelle und bedingungSatz', () => {
  const f = acFormular();
  it('istQuelle: Fragen und Antworten zählen, ohne Bedingung nicht', () => {
    expect(istQuelle(f, 'zeitraum')).toBe(true);
    expect(istQuelle(f, 'taufe')).toBe(true); // nur über Antwort-Bedingungen und den Hinweis
    expect(istQuelle(f, 'kids2')).toBe(true);
    expect(istQuelle(f, 'begleitNamen')).toBe(false);
  });
  it('bedingungSatz: mit Kurzname, „oder“/„und“, ohne Wert bei „ist ausgefüllt“, fehlende Quelle', () => {
    const k = { ...feld(f, 'zeitraum'), kurz: 'Zeitraum' };
    const mitKurz = { ...f, anmeldung: f.anmeldung.map((x) => (x.id === 'zeitraum' ? k : x)) };
    expect(bedingungSatz(mitKurz, feld(f, 'kids1').bed!)).toBe('„Zeitraum“ enthält KidsWoche');
    expect(bedingungSatz(f, feld(f, 'kidsLeiter').bed!)).toBe(
      '„Frage kids1“ ist Gruppenleiter oder „Frage kids2“ ist Gruppenleiter',
    );
    expect(
      bedingungSatz(f, {
        modus: 'alle',
        regeln: [
          { feld: 'begleit', op: 'ausgefuellt' },
          { feld: 'weg', op: 'leer' },
        ],
      }),
    ).toBe('„Frage begleit“ ist ausgefüllt und (Frage fehlt) ist leer');
  });
});

describe('Regel-Liste (F1d) – gleiche Bedingungen zusammengefasst', () => {
  it('fasst gleiche Bedingungen zu einer Regel – Fragen und Antworten getrennt, in der Reihenfolge des Formulars', () => {
    const g = regelGruppen(acFormular());
    expect(g.map((x) => ({ antwort: x.antwort, ziele: x.ziele.map((z) => z.id) }))).toEqual([
      { antwort: undefined, ziele: ['taufHinweis'] },
      { antwort: undefined, ziele: ['kids1', 'kids2'] },
      { antwort: 'Gruppenleiter', ziele: ['kids1', 'kids2'] },
      { antwort: undefined, ziele: ['kidsLeiter'] },
      { antwort: undefined, ziele: ['begleitNamen'] },
    ]);
    expect(g[2].ziele).toEqual([
      { id: 'kids1', antwort: 'Gruppenleiter' },
      { id: 'kids2', antwort: 'Gruppenleiter' },
    ]);
  });

  it('gleich heißt: dieselben Regeln, derselbe Umschalter (bei einer Regel egal), an Antworten dieselbe Darstellung', () => {
    const f = acFormular();
    const mit = (id: string, x: Partial<Feld>) => {
      const neu = structuredClone(f);
      Object.assign(feld(neu, id), x);
      return neu;
    };
    const anzahl = (fo: Formular) => regelGruppen(fo).length;
    // Bei einer Regel ist der Umschalter egal …
    expect(
      anzahl(
        mit('kids2', { bed: { ...wenn('zeitraum', 'enthaelt', 'KidsWoche'), modus: 'alle' } }),
      ),
    ).toBe(5);
    // … eine andere Antwort, ein anderer Vergleich, ein anderer Hinweis, „ausblenden“ trennt.
    expect(anzahl(mit('kids2', { bed: wenn('zeitraum', 'enthaelt', 'TeensWoche') }))).toBe(6);
    expect(anzahl(mit('kids2', { bed: wenn('zeitraum', 'enthaeltNicht', 'KidsWoche') }))).toBe(6);
    expect(
      anzahl(
        mit('kids2', { antwortBed: { Gruppenleiter: { ...nurGetauft(), grund: 'nur Getaufte' } } }),
      ),
    ).toBe(6);
    expect(
      anzahl(mit('kids2', { antwortBed: { Gruppenleiter: { ...nurGetauft(), art: 'weg' } } })),
    ).toBe(6);
    // „ausblenden“ ohne Hinweis: ein liegengebliebener Hinweis zählt nicht.
    const weg = (grund?: string): AntwortBedingung => ({ ...nurGetauft(), art: 'weg', grund });
    const beide = structuredClone(f);
    feld(beide, 'kids1').antwortBed = { Gruppenleiter: weg('alt') };
    feld(beide, 'kids2').antwortBed = { Gruppenleiter: weg() };
    expect(anzahl(beide)).toBe(5);
    // Mehrere Regeln: der Umschalter zählt.
    const zwei: Bedingung = {
      modus: 'eine',
      regeln: [
        { feld: 'taufe', op: 'ist', wert: 'Ja' },
        { feld: 'begleit', op: 'ist', wert: 'Ja' },
      ],
    };
    const z = structuredClone(f);
    z.anmeldung.push(
      frage('a', 'text', { bed: zwei }),
      frage('b', 'text', { bed: { ...zwei, modus: 'alle' } }),
    );
    expect(
      regelGruppen(z)
        .slice(-2)
        .map((x) => x.ziele.map((y) => y.id)),
    ).toEqual([['a'], ['b']]);
  });

  it('dieselbe Bedingung an verschiedenen Antworten bleibt getrennt (wie im Entwurf)', () => {
    const f = acFormular();
    feld(f, 'kids1').antwortBed = { Gruppenleiter: nurGetauft(), Media: nurGetauft() };
    const antworten = regelGruppen(f)
      .filter((g) => g.antwort)
      .map((g) => [g.antwort, g.ziele.map((z) => z.id)]);
    expect(antworten).toEqual([
      ['Gruppenleiter', ['kids1', 'kids2']],
      ['Media', ['kids1']],
    ]);
  });

  it('gleicheBedingung nennt die anderen Ziele derselben Regel – für den Hinweis im Fenster am Feld', () => {
    const f = acFormular();
    expect(gleicheBedingung(f, { id: 'kids1' })).toEqual([{ id: 'kids2' }]);
    expect(gleicheBedingung(f, { id: 'kids2', antwort: 'Gruppenleiter' })).toEqual([
      { id: 'kids1', antwort: 'Gruppenleiter' },
    ]);
    expect(gleicheBedingung(f, { id: 'kidsLeiter' })).toEqual([]);
    expect(gleicheBedingung(f, { id: 'taufe' })).toEqual([]);
  });
});

describe('regelSetzen – eine Regel an allen Zielen zugleich (F1d)', () => {
  it('neue Regel mit mehreren Zielen setzt dieselbe Bedingung an jedes', () => {
    const f = acFormular();
    const bed = wenn('taufe', 'ist', 'Ja');
    const neu = regelSetzen(f, [], [{ id: 'begleit' }, { id: 'begleitNamen' }], bed);
    expect(feld(neu, 'begleit').bed).toEqual(bed);
    expect(feld(neu, 'begleitNamen').bed).toEqual(bed); // die andere Bedingung ist ersetzt
    expect(
      regelGruppen(neu).find((g) => g.ziele.length === 2 && g.ziele[0].id === 'begleit'),
    ).toBeTruthy();
    expect(bedingungFehler(neu)).toEqual([]);
    // Das alte Formular bleibt, wie es war.
    expect(feld(f, 'begleit').bed).toBeUndefined();
  });

  it('bearbeiten: ein abgewähltes Ziel verliert die Bedingung, ein neues bekommt sie', () => {
    const f = acFormular();
    const bed = wenn('zeitraum', 'enthaelt', 'TeensWoche');
    const neu = regelSetzen(
      f,
      [{ id: 'kids1' }, { id: 'kids2' }],
      [{ id: 'kids2' }, { id: 'kidsLeiter' }],
      bed,
    );
    expect(feld(neu, 'kids1').bed).toBeUndefined();
    expect(feld(neu, 'kids2').bed).toEqual(bed);
    expect(feld(neu, 'kidsLeiter').bed).toEqual(bed);
    // Die Antwort-Bedingungen an diesen Feldern bleiben unberührt.
    expect(feld(neu, 'kids1').antwortBed).toEqual({ Gruppenleiter: nurGetauft() });
  });

  it('entfernen (`null`) nimmt die Bedingung von allen Zielen', () => {
    const f = acFormular();
    const neu = regelSetzen(
      f,
      [{ id: 'kids1' }, { id: 'kids2' }],
      [{ id: 'kids1' }, { id: 'kids2' }],
      null,
    );
    expect(feld(neu, 'kids1').bed).toBeUndefined();
    expect(feld(neu, 'kids2').bed).toBeUndefined();
    expect('bed' in feld(neu, 'kids1')).toBe(false);
  });

  it('Antwort-Regel: setzt und entfernt nur an dieser Antwort; leer wird `antwortBed` ganz entfernt', () => {
    const f = acFormular();
    feld(f, 'kids1').antwortBed = { Gruppenleiter: nurGetauft(), Media: nurGetauft() };
    const alt = [
      { id: 'kids1', antwort: 'Gruppenleiter' },
      { id: 'kids2', antwort: 'Gruppenleiter' },
    ];
    const weg: AntwortBedingung = { ...wenn('taufe', 'ist', 'Ja'), art: 'weg' };
    const neu = regelSetzen(f, alt, alt, weg);
    expect(feld(neu, 'kids1').antwortBed).toEqual({ Gruppenleiter: weg, Media: nurGetauft() });
    expect(feld(neu, 'kids2').antwortBed).toEqual({ Gruppenleiter: weg });
    const ohne = regelSetzen(f, alt, alt, null);
    expect(feld(ohne, 'kids1').antwortBed).toEqual({ Media: nurGetauft() });
    expect('antwortBed' in feld(ohne, 'kids2')).toBe(false);
  });

  it('an einer Frage landen nur Regeln und Umschalter – kein `art`/`grund` aus einem Antwort-Fenster', () => {
    const neu = regelSetzen(acFormular(), [], [{ id: 'begleit' }], nurGetauft());
    expect(feld(neu, 'begleit').bed).toEqual(wenn('taufe', 'ist', 'Ja'));
  });
});

describe('Quellen und Ziele einer Regel (F1d) – keine Kreise', () => {
  it('zielKandidaten: nur Felder nach allen Quellen, die eine Bedingung tragen können', () => {
    const f = acFormular();
    f.anmeldung.push(frage('aus', 'text', { zustand: 'aus' }));
    const ids = (bed: Bedingung) => zielKandidaten(f, bed).map((x) => x.id);
    const nachZeitraum = ids(wenn('zeitraum', 'ist', 'KidsWoche'));
    expect(nachZeitraum).toContain('kids1');
    expect(nachZeitraum).toContain('begleitNamen');
    expect(nachZeitraum).not.toContain('zeitraum'); // nicht auf sich selbst
    expect(nachZeitraum).not.toContain('taufe'); // steht davor
    expect(nachZeitraum).not.toContain('aus'); // ausgeschaltet
    // Name, E-Mail, Datenschutz (immer dabei) nie.
    expect(
      f.anmeldung.filter((x) => x.art === 'fest').some((x) => nachZeitraum.includes(x.id)),
    ).toBe(false);
    // Mit zwei Quellen: nach der letzten.
    const zwei = ids({
      modus: 'alle',
      regeln: [
        { feld: 'taufe', op: 'ist', wert: 'Ja' },
        { feld: 'begleit', op: 'ist', wert: 'Ja' },
      ],
    });
    expect(zwei).toContain('begleitNamen');
    expect(zwei).not.toContain('kids1');
    // Fragen je Person dürfen auf Kontakt-Fragen schauen.
    const person = f.person.filter(kannBedingungTragen).map((x) => x.id);
    expect(person.length).toBeGreaterThan(0);
    for (const id of person) expect(nachZeitraum).toContain(id);
  });

  it('gemeinsameQuellen: nur Fragen, die vor ALLEN Zielen stehen; ohne Ziel jede mögliche Quelle', () => {
    const f = acFormular();
    const quellen = (ids: string[]) =>
      gemeinsameQuellen(
        f,
        ids.map((id) => feld(f, id)),
      ).map((x) => x.id);
    expect(quellen(['kids2', 'begleitNamen'])).toEqual(quellen(['kids2']));
    expect(quellen(['kids2'])).toContain('kids1');
    expect(quellen(['kids1', 'kids2'])).not.toContain('kids1');
    const alle = quellen([]);
    expect(alle).toContain('taufe');
    expect(alle).toContain('begleit');
    expect(alle).not.toContain('taufHinweis'); // Hinweistext ist keine Quelle
    // Eine Quelle, für die ein Ziel möglich ist, findet auch zielKandidaten wieder.
    for (const id of alle)
      expect(zielKandidaten(f, wenn(id, 'ausgefuellt')).length).toBeGreaterThan(0);
  });

  it('kannBedingungTragen ist dieselbe Regel wie die Prüfung „immer dabei“', () => {
    const f = standardFormular();
    for (const x of [...f.anmeldung, ...f.person]) {
      const mit = { ...x, zustand: 'freiwillig' as const, bed: wenn('nirgends', 'ausgefuellt') };
      const fest = kaputteStellen({ anmeldung: [mit], person: [] }).some((s) => s.grund === 'fest');
      expect(kannBedingungTragen(mit)).toBe(!fest);
    }
  });
});

describe('bedingungAufbereiten – was ein Fenster speichert', () => {
  const roh: AntwortBedingung = {
    modus: 'alle',
    regeln: [
      { feld: 'taufe', op: 'ausgefuellt', wert: 'Ja' },
      { feld: 'zeitraum', op: 'enthaelt', wert: 'KidsWoche' },
    ],
    art: 'grau',
    grund: '  nur für Getaufte ',
  };
  it('an einer Frage: nur Umschalter und Regeln, ohne Wert bei „ist ausgefüllt“', () => {
    expect(bedingungAufbereiten(roh, false)).toEqual({
      modus: 'alle',
      regeln: [
        { feld: 'taufe', op: 'ausgefuellt' },
        { feld: 'zeitraum', op: 'enthaelt', wert: 'KidsWoche' },
      ],
    });
  });
  it('an einer Antwort: Hinweis getrimmt, nur beim Ausgrauen; leerer Hinweis fällt weg', () => {
    expect(bedingungAufbereiten(roh, true)).toMatchObject({
      art: 'grau',
      grund: 'nur für Getaufte',
    });
    expect(bedingungAufbereiten({ ...roh, art: 'weg' }, true)).not.toHaveProperty('grund');
    expect(bedingungAufbereiten({ ...roh, grund: '  ' }, true)).not.toHaveProperty('grund');
  });
  it('ohne Regel: `null` (= entfernen)', () => {
    expect(bedingungAufbereiten({ ...roh, regeln: [] }, true)).toBeNull();
    expect(bedingungAufbereiten({ ...roh, regeln: [] }, false)).toBeNull();
  });
});
