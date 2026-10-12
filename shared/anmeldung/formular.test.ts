import { describe, expect, it } from 'vitest';
import {
  BESCHREIBUNG_MAX,
  EINSTELLUNGEN_KENNUNG,
  alterAm,
  ctAblage,
  einstellungenAlsText,
  einstellungenLesen,
  geburtsdatumAn,
  pruefeAntworten,
  pruefeFormular,
  setzeGeburtsdatum,
  standardFormular,
  type Feld,
  type OeffentlicheEinstellungen,
} from './formular';

/** Formular-Modell (#474). Die ChurchTools-Regeln dahinter sind in A0 an der Test-Instanz gemessen. */

function eigen(typ: Feld['typ'], frage: string, extra: Partial<Feld> = {}): Feld {
  return {
    id: `q${frage.length}`,
    art: 'eigen',
    typ,
    frage,
    hilfe: '',
    zustand: 'freiwillig',
    antworten: [],
    ...extra,
  };
}

describe('standardFormular und Geburtsdatum', () => {
  it('Name, E-Mail und Datenschutz sind Pflicht, Geburtsdatum standardmäßig aus', () => {
    const f = standardFormular();
    expect(f.anmeldung.filter((x) => x.zustand === 'pflicht').map((x) => x.id)).toEqual([
      'name',
      'mail',
      'price',
      'priv',
    ]);
    expect(geburtsdatumAn(f)).toBe(false);
    expect(pruefeFormular(f)).toEqual([]);
  });

  it('Vorgaben für Kinder-Events', () => {
    const f = standardFormular({ geburtsdatum: true, telefon: 'pflicht', foto: 'pflicht' });
    expect(geburtsdatumAn(f)).toBe(true);
    expect(f.anmeldung.find((x) => x.id === 'tel')?.zustand).toBe('pflicht');
    expect(f.person.find((x) => x.id === 'foto')?.zustand).toBe('pflicht');
  });

  it('Geburtsdatum an und aus – nur „Pflicht“ oder „aus“, nie „freiwillig“', () => {
    const an = setzeGeburtsdatum(standardFormular(), true);
    expect(an.person.find((x) => x.id === 'birth')?.zustand).toBe('pflicht');
    expect(geburtsdatumAn(setzeGeburtsdatum(an, false))).toBe(false);
  });
});

describe('alterAm (Stichtag = erster Tag der Veranstaltung)', () => {
  it('Geburtstag am Stichtag zählt schon', () => {
    expect(alterAm('2019-12-28', '2026-12-28')).toBe(7);
  });
  it('Geburtstag einen Tag später zählt noch nicht', () => {
    expect(alterAm('2019-12-29', '2026-12-28')).toBe(6);
  });
  it('Geburtstag im späteren Monat', () => {
    expect(alterAm('2019-05-04', '2026-01-01')).toBe(6);
  });
  it('ohne oder mit unsinnigem Datum gibt es kein Alter', () => {
    expect(alterAm('', '2026-12-28')).toBeNull();
    expect(alterAm('2030-01-01', '2026-12-28')).toBeNull();
  });
});

describe('pruefeAntworten', () => {
  const f = standardFormular({ geburtsdatum: true });
  const gut = {
    anmeldung: { name: { vor: 'Anna', nach: 'Beispiel' }, mail: 'anna@example.org', priv: true },
    personen: [{ pname: { vor: 'Anna', nach: 'Beispiel' }, birth: '1988-04-12' }],
  };

  it('vollständige Anmeldung hat keine Lücken', () => {
    expect(pruefeAntworten(f, gut)).toEqual([]);
  });

  it('meldet fehlende Pflichtangaben mit Pfad', () => {
    const fehlt = pruefeAntworten(f, {
      anmeldung: { name: { vor: '', nach: 'Beispiel' }, mail: '', priv: false },
      personen: [{ pname: { vor: 'Ben', nach: '' } }],
    });
    expect(fehlt).toEqual([
      'anmeldung.name.vor',
      'anmeldung.mail',
      'anmeldung.priv',
      'personen.0.pname.nach',
      'personen.0.birth',
    ]);
  });

  it('eine ungültige E-Mail ist ein Fehler, auch wenn etwas drinsteht', () => {
    expect(pruefeAntworten(f, { ...gut, anmeldung: { ...gut.anmeldung, mail: 'anna@' } })).toEqual([
      'anmeldung.mail',
    ]);
  });

  it('ohne Personen geht es nicht', () => {
    expect(pruefeAntworten(f, { ...gut, personen: [] })).toEqual(['personen']);
  });

  it('Pflicht-Kästchen muss angekreuzt, Mehrfach-Pflicht mindestens eine Antwort haben', () => {
    const g = standardFormular();
    g.anmeldung.splice(
      3,
      0,
      eigen('check', 'Ich helfe beim Abbau', { id: 'q1', zustand: 'pflicht' }),
      eigen('multi', 'Was machst du mit?', { id: 'q2', zustand: 'pflicht', antworten: ['A', 'B'] }),
    );
    expect(
      pruefeAntworten(g, {
        anmeldung: { ...gut.anmeldung, q1: false, q2: [] },
        personen: [{ pname: { vor: 'A', nach: 'B' } }],
      }),
    ).toEqual(['anmeldung.q1', 'anmeldung.q2']);
  });

  it('ausgeschaltete und freiwillige Felder werden nicht verlangt', () => {
    const g = standardFormular();
    expect(
      pruefeAntworten(g, {
        anmeldung: gut.anmeldung,
        personen: [{ pname: { vor: 'A', nach: 'B' } }],
      }),
    ).toEqual([]);
  });
});

describe('ctAblage – nach den Messungen in A0', () => {
  it('Mehrere Antworten landen als Text (ChurchTools nimmt anonym nur einen Wert)', () => {
    expect(ctAblage(eigen('multi', 'Was?', { antworten: ['A', 'B'] }))).toEqual({
      ort: 'gruppenfeld',
      fieldTypeCode: 'text',
      optionen: [],
    });
  });
  it('Ja/Nein wird eine Auswahl mit genau „Ja“ und „Nein“', () => {
    expect(ctAblage(eigen('janein', 'Schwimmer?'))).toEqual({
      ort: 'gruppenfeld',
      fieldTypeCode: 'radioselect',
      optionen: ['Ja', 'Nein'],
    });
  });
  it('Name, E-Mail und Geburtsdatum sind Personenfelder; Hinweis, Preis, Datenschutz haben keins', () => {
    const f = standardFormular({ geburtsdatum: true });
    expect(f.anmeldung.map((x) => ctAblage(x).ort)).toEqual([
      'person',
      'person',
      'gruppenfeld',
      'gruppenfeld',
      'keins',
      'keins',
    ]);
    expect(ctAblage(f.person[1])).toEqual({ ort: 'person', feld: 'birthday' });
    expect(ctAblage(eigen('info', 'Hinweis')).ort).toBe('keins');
  });
  it('ein anderes Datum als das Geburtsdatum ist ein Gruppenfeld', () => {
    expect(ctAblage(eigen('date', 'Anreise'))).toEqual({
      ort: 'gruppenfeld',
      fieldTypeCode: 'date',
      optionen: [],
    });
  });
});

describe('pruefeFormular', () => {
  it('eine Auswahl braucht mindestens zwei Antworten, ein eigenes Feld eine Frage', () => {
    const f = standardFormular();
    f.person.push(
      eigen('select', 'Größe', { id: 'q9', antworten: ['S'] }),
      eigen('text', '', { id: 'q8' }),
    );
    expect(pruefeFormular(f)).toEqual([
      '„Größe“ braucht mindestens zwei Antworten.',
      'Ein Feld hat keine Frage.',
    ]);
  });
  it('ohne E-Mail ist das Formular ungültig', () => {
    const f = standardFormular();
    f.anmeldung = f.anmeldung.filter((x) => x.id !== 'mail');
    expect(pruefeFormular(f)).toContain('Name, E-Mail und Datenschutz müssen dabei sein.');
  });
});

describe('Einstellungen in der Gruppen-Beschreibung', () => {
  function einstellungen(): OeffentlicheEinstellungen {
    return {
      termin: {
        beginn: '2026-12-28T15:00',
        ende: '2027-01-02T11:00',
        ort: 'Haus Lutzenberg',
        terminId: 812,
      },
      preis: {
        grundpreis: {
          art: 'auswahl',
          betragCent: 0,
          gilt: 'person',
          auswahlName: 'Zimmertyp',
          optionen: [{ name: '4-Bett-Zimmer', preisCent: 6552, kontingent: 5, belegt: 0 }],
        },
        alter: [{ von: 0, bis: 2, art: 'frei', wert: 0 }],
        anpassungen: [],
        extras: [{ bezeichnung: 'Bettwäsche leihen', preisCent: 800, gilt: 'person' }],
      },
      formular: standardFormular({ geburtsdatum: true }),
      gestaltung: {
        vorlage: 'karte',
        farbe: '#c9a54a',
        feldstil: 'linie',
        knoepfe: 'eckig',
        text: 'Gemeinsam ins neue Jahr.',
        gemeindename: true,
      },
      ctFelder: { tel: 12, betrag: 33 },
      wer: 'familie',
      plaetze: { zeigen: 'knapp', knappUnter: 10 },
      loeschfristMonate: 6,
    };
  }

  it('hin und zurück ergibt dasselbe', () => {
    const text = einstellungenAlsText(einstellungen());
    expect(text.startsWith(EINSTELLUNGEN_KENNUNG)).toBe(true);
    expect(einstellungenLesen(text)).toEqual(einstellungen());
  });

  it('zu lang → Fehler mit Zahl statt still abgeschnitten', () => {
    const e = einstellungen();
    e.formular.person.push(
      ...Array.from({ length: 20 }, (_, i) =>
        eigen('textarea', `Frage ${i}`, { id: `l${i}`, hilfe: 'x'.repeat(390) }),
      ),
    );
    expect(() => einstellungenAlsText(e)).toThrow(`erlaubt sind ${BESCHREIBUNG_MAX}`);
  });

  it('eine normale Beschreibung ist keine Einstellung', () => {
    expect(einstellungenLesen('Wir essen gemeinsam nach dem Gottesdienst.')).toBeNull();
    expect(einstellungenLesen(null)).toBeNull();
  });

  it('ohne Datum (Entwurf) geht, ein Datum in anderer Schreibweise nicht', () => {
    const ohne = { ...einstellungen(), termin: null };
    expect(einstellungenLesen(einstellungenAlsText(ohne))).toEqual(ohne);
    const falsch = {
      ...einstellungen(),
      termin: { ...einstellungen().termin!, beginn: '28.12.2026' },
    };
    expect(() => einstellungenAlsText(falsch)).toThrow();
    expect(einstellungenLesen(EINSTELLUNGEN_KENNUNG + JSON.stringify(falsch))).toBeNull();
  });

  it('ältere Einstellungen ohne später hinzugekommene Angaben bleiben lesbar (mit Standardwert)', () => {
    const { termin: _t, loeschfristMonate: _l, ...alt } = einstellungen();
    const gelesen = einstellungenLesen(EINSTELLUNGEN_KENNUNG + JSON.stringify(alt));
    expect(gelesen?.termin).toBeNull();
    expect(gelesen?.loeschfristMonate).toBe(3);
  });

  it('kaputtes oder manipuliertes JSON wird abgelehnt, ohne zu werfen', () => {
    expect(einstellungenLesen(EINSTELLUNGEN_KENNUNG + '{kaputt')).toBeNull();
    const e = einstellungen() as unknown as { gestaltung: { farbe: string } };
    e.gestaltung.farbe = 'red;background:url(javascript:alert(1))';
    expect(einstellungenLesen(EINSTELLUNGEN_KENNUNG + JSON.stringify(e))).toBeNull();
  });
});
