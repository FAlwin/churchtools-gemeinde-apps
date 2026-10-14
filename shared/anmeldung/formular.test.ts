import { describe, expect, it } from 'vitest';
import { deflateSync, strToU8 } from 'fflate';
import {
  BESCHREIBUNG_MAX,
  EINSTELLUNGEN_KENNUNG,
  HINWEIS_SATZ,
  SICHERUNG_MAX,
  VERWEIS,
  einstellungenPacken,
  istAltesFormat,
  platzBelegt,
  sicherungLesen,
  sicherungTeile,
  sichtbarerText,
  traegtEinstellungen,
  alterAm,
  ctAblage,
  einstellungenAlsText,
  einstellungenLesen,
  feldFehler,
  geburtsdatumAn,
  nurText,
  pruefeAntworten,
  pruefeFormular,
  mitWer,
  setzeGeburtsdatum,
  standardFormular,
  type Feld,
  type OeffentlicheEinstellungen,
} from './formular';
import { STANDARD_BEZAHLUNG } from './bezahlung';
import { mitVorgaben } from './gestaltung';
import { neueEinstellungen } from './vorlagen';

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

  it('mitWer: setzt „Wer meldet sich an?“ und das Geburtsdatum, sonst nichts', () => {
    const e = neueEinstellungen('einfach');
    const neu = mitWer(e, 'kinder', true);
    expect(neu.wer).toBe('kinder');
    expect(geburtsdatumAn(neu.formular)).toBe(true);
    expect({ ...neu, wer: e.wer, formular: e.formular }).toEqual(e);
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
      '„Größe“: Bitte mindestens zwei Antworten eintragen.',
      'Bitte eine Frage eintragen.',
    ]);
  });
  it('Text-Bausteine (A5): Trennlinie ohne Text ist in Ordnung, Überschrift und Hinweis brauchen einen', () => {
    const f = standardFormular();
    f.person.push(
      eigen('trenner', '', { id: 'q7' }),
      eigen('ueberschrift', ' ', { id: 'q6' }),
      eigen('info', 'Bitte Sonnencreme mitbringen', { id: 'q5' }),
    );
    expect(pruefeFormular(f)).toEqual(['Bitte einen Text eintragen.']);
    // Einzeln, weil `pruefeFormular` gleiche Meldungen zusammenfasst – sonst fiele eine leere Trennlinie hier nicht auf.
    expect(feldFehler(eigen('trenner', '', { id: 'q7' }))).toBeNull();
    expect(feldFehler(eigen('info', '', { id: 'q5' }))).toBe('Bitte einen Text eintragen.');
  });
  it('Text-Bausteine haben keine Spalte und keine Pflicht – auch auf „Pflicht“ gesetzt nicht', () => {
    for (const typ of ['info', 'ueberschrift', 'trenner'] as const) {
      expect(nurText(typ)).toBe(true);
      expect(ctAblage(eigen(typ, 'x'))).toEqual({ ort: 'keins' });
    }
    expect(nurText('text')).toBe(false);
    const f = standardFormular();
    f.person.push(eigen('ueberschrift', 'Zum Kind', { id: 'q4', zustand: 'pflicht' }));
    expect(pruefeAntworten(f, { anmeldung: {}, personen: [{}] })).not.toContain('personen.0.q4');
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
      gestaltung: mitVorgaben({
        vorlage: 'karte',
        farbe: '#c9a54a',
        feldstil: 'linie',
        knoepfe: 'eckig',
        text: 'Gemeinsam ins neue Jahr.',
      }),
      ctFelder: { tel: 12, betrag: 33 },
      wer: 'familie',
      plaetze: { zeigen: 'knapp', knappUnter: 10 },
      loeschfristMonate: 6,
      bezahlung: {
        kontoinhaber: 'Gemeinde e.V.',
        iban: 'DE89370400440532013000',
        bic: '',
        fristTage: 14,
        zweck: 'Silvester [Nachname]',
      },
    };
  }

  it('hin und zurück ergibt dasselbe – sichtbar nur der Hinweissatz, der Code als unsichtbare Markdown-Zeile', () => {
    const text = einstellungenAlsText(einstellungen());
    const [sichtbar, , zeile, ...rest] = text.split('\n');
    expect(sichtbar).toBe(HINWEIS_SATZ);
    // Eine Markdown-Link-Definition – ChurchTools zeigt sie nicht an (gemessen 13.10.2026).
    expect(zeile).toMatch(/^\[anmeldung\]: #v2:[A-Za-z0-9_-]+$/);
    expect(rest).toEqual([]);
    expect(einstellungenLesen(text)).toEqual(einstellungen());
  });

  it('eigener Text in ChurchTools bleibt stehen; die Zeile wird darunter gesetzt', () => {
    const alt = einstellungenAlsText(einstellungen());
    const zeile = alt.split('\n').at(-1)!;
    const vomTeam = `Treffpunkt ist der Parkplatz.\n\n${zeile}`;
    expect(sichtbarerText(vomTeam)).toBe('Treffpunkt ist der Parkplatz.');
    const neu = einstellungenAlsText(einstellungen(), sichtbarerText(vomTeam));
    expect(neu.startsWith('Treffpunkt ist der Parkplatz.\n\n' + VERWEIS)).toBe(true);
    // Die Zeile darf irgendwo stehen – auch mitten im Text.
    expect(einstellungenLesen(`oben\n${zeile}\nunten`)).toEqual(einstellungen());
    expect(sichtbarerText(null)).toBe(HINWEIS_SATZ);
    expect(sichtbarerText(zeile)).toBe(HINWEIS_SATZ);
  });

  it('das alte, sichtbare Format (bis A4) wird weiter gelesen – und als alt erkannt', () => {
    const v1 = EINSTELLUNGEN_KENNUNG + JSON.stringify(einstellungen());
    expect(einstellungenLesen(v1)).toEqual(einstellungen());
    expect(istAltesFormat(v1)).toBe(true);
    expect(istAltesFormat(einstellungenAlsText(einstellungen()))).toBe(false);
    // Beim Umstellen verschwindet der alte Block aus dem sichtbaren Text.
    expect(sichtbarerText(v1)).toBe(HINWEIS_SATZ);
  });

  it('traegtEinstellungen: altes und neues Format, auch kaputt – ein normaler Text nicht', () => {
    expect(traegtEinstellungen(einstellungenAlsText(einstellungen()))).toBe(true);
    expect(traegtEinstellungen(EINSTELLUNGEN_KENNUNG + '{kaputt')).toBe(true);
    expect(traegtEinstellungen(`${HINWEIS_SATZ}\n\n${VERWEIS}AAAA`)).toBe(true);
    expect(traegtEinstellungen('Wir essen gemeinsam.')).toBe(false);
    expect(traegtEinstellungen(null)).toBe(false);
  });

  it('gepackt passt eine große Freizeit, die ungepackt zu lang war (A5-Messung: 5.532 Zeichen)', () => {
    const e = einstellungen();
    for (let i = 0; i < 10; i++)
      e.formular.person.push(
        eigen('select', `Eine typische Frage Nummer ${i} an alle Teilnehmenden?`, {
          id: `g${i}`,
          hilfe: 'Ein kurzer Hilfetext dazu',
          antworten: ['Antwort eins', 'Antwort zwei', 'Antwort drei', 'Antwort vier'],
        }),
      );
    e.gestaltung.text = 'Wir freuen uns auf euch! Bringt gute Laune und warme Sachen mit. '.repeat(
      12,
    );
    expect(JSON.stringify(e).length).toBeGreaterThan(BESCHREIBUNG_MAX);
    expect(einstellungenAlsText(e).length).toBeLessThan(BESCHREIBUNG_MAX / 2);
    expect(platzBelegt(e)).toBeLessThan(0.5);
  });

  it('zu lang → Fehler mit Zahl statt still abgeschnitten', () => {
    const e = einstellungen();
    e.formular.person.push(
      ...Array.from({ length: 20 }, (_, i) =>
        eigen('textarea', `Frage ${i}`, { id: `l${i}`, hilfe: unpackbar(390, i) }),
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
    const { termin: _t, loeschfristMonate: _l, bezahlung: _b, ...alt } = einstellungen();
    const gelesen = einstellungenLesen(EINSTELLUNGEN_KENNUNG + JSON.stringify(alt));
    expect(gelesen?.termin).toBeNull();
    expect(gelesen?.loeschfristMonate).toBe(3);
    // Seit A4: ohne Bankverbindung, 14 Tage, Zweck nur mit Nachnamen.
    expect(gelesen?.bezahlung).toEqual(STANDARD_BEZAHLUNG);
    // Jede gelesene Veranstaltung bekommt ihr eigenes Objekt – sonst änderte eine die nächste mit.
    const zweite = einstellungenLesen(EINSTELLUNGEN_KENNUNG + JSON.stringify(alt));
    expect(zweite?.bezahlung).not.toBe(gelesen?.bezahlung);
    expect(gelesen?.bezahlung).not.toBe(STANDARD_BEZAHLUNG);
  });

  it('kaputtes oder manipuliertes JSON wird abgelehnt, ohne zu werfen – in beiden Formaten', () => {
    expect(einstellungenLesen(EINSTELLUNGEN_KENNUNG + '{kaputt')).toBeNull();
    expect(einstellungenLesen(`${VERWEIS}kaputt`)).toBeNull();
    const e = einstellungen() as unknown as { gestaltung: { farbe: string } };
    e.gestaltung.farbe = 'red;background:url(javascript:alert(1))';
    expect(einstellungenLesen(EINSTELLUNGEN_KENNUNG + JSON.stringify(e))).toBeNull();
    // Dasselbe gepackt (an der Prüfung vorbei gepackt): beim Lesen abgelehnt.
    const roh = btoa(String.fromCharCode(...deflateSync(strToU8(JSON.stringify(e)))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(einstellungenLesen(`${VERWEIS}${roh}`)).toBeNull();
    expect(() => einstellungenPacken(e as unknown as OeffentlicheEinstellungen)).toThrow();
  });

  describe('Sicherung in den Feldbeschreibungen (A5)', () => {
    it('zurückgelesen in beliebiger Reihenfolge; fremde Notizen stören nicht', () => {
      const text = einstellungenAlsText(einstellungen());
      const teile = sicherungTeile(text)!;
      expect(teile.length).toBeGreaterThanOrEqual(1);
      expect(sicherungLesen([null, 'Hinweis vom Team', ...teile, ''])).toEqual(einstellungen());
    });

    it('große Einstellungen: mehrere Teile, jeder höchstens 1.024 Zeichen; fehlt einer → nichts', () => {
      const e = einstellungen();
      e.gestaltung.text = unpackbar(700, 7);
      for (let i = 0; i < 4; i++)
        e.formular.person.push(
          eigen('text', unpackbar(150, i), { id: `s${i}`, hilfe: unpackbar(300, i + 9) }),
        );
      const teile = sicherungTeile(einstellungenAlsText(e))!;
      expect(teile.length).toBeGreaterThan(1);
      for (const t of teile) expect(t.length).toBeLessThanOrEqual(SICHERUNG_MAX);
      expect(sicherungLesen([...teile].reverse())).toEqual(e);
      expect(sicherungLesen(teile.slice(1))).toBeNull();
    });

    it('ohne Code in der Beschreibung gibt es nichts zu sichern', () => {
      expect(sicherungTeile('Nur ein Text.')).toBeNull();
    });
  });
});

/** Text, der sich kaum packen lässt (Zufall mit festem Startwert) – für „zu lang“ trotz Packen. */
function unpackbar(n: number, start: number): string {
  let x = start + 1;
  let t = '';
  while (t.length < n) {
    x = (x * 1103515245 + 12345) % 2147483648;
    t += String.fromCharCode(33 + (x % 90));
  }
  return t;
}
