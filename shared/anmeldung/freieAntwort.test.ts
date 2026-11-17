import { describe, expect, it } from 'vitest';
import {
  ctAblage,
  ctZusatzSpalten,
  feldFehler,
  pruefeAntworten,
  type Antworten,
  type Feld,
  type OeffentlicheEinstellungen,
} from './formular';
import { bedingungFehler, festeAntworten, leeren, wahlAntworten } from './bedingungen';
import { FREI_STANDARD, freiAnzeige, freiGewaehlt, freiMitText, kannFrei } from './freieAntwort';
import { anmeldungAufbauen, PasstNicht, type CtFormular, type FormWert } from './senden';
import { antworten } from './senden.testdaten';
import { CT_MIT_NR, FELDER, HEUTE, PERSONEN, STICHTAG, e } from './liste.testdaten';
import {
  anmeldungenAus,
  antwortText,
  antwortZeilen,
  mehrfachAntworten,
  mitgliederstandAus,
  type MitgliedRoh,
} from './liste';
import { antwortenAus } from './antwortenAusListe';
import { frageSumme, personSumme, personZeilen, personZellText } from './tabelle';
import { frageSchluessel } from './druckliste';

/**
 * F3a – die freie Antwort (Klick-Runde 9, Entwurf `f3-freie-antwort-v1`). Gebaut wird über die Erzeuger: Formular-
 * Antworten → `anmeldungAufbauen` → Mitglieder, wie ChurchTools sie liefert → Liste → Anzeige und Rückweg.
 */

const FOTO_TEXT = 630;
const BEREICH = 640;
const BEREICH_TEXT = 641;
const WEISS_NICHT = 'Weiß ich noch nicht';

/**
 * Kinder-Event: „Fotos?“ (Ja / Nein, Pflicht) mit freier Antwort „Weiß ich noch nicht“ (Textfeld klappt auf),
 * dazu „Bereiche“ (Mehrere Antworten, freiwillig) mit „Sonstiges“ (Textfeld steht immer da).
 */
function einst(textfeld: 'auf' | 'ohne' = 'auf'): OeffentlicheEinstellungen {
  // Mit Anmelde-Nr. (`liste.testdaten`) – sonst wäre jede Person eine eigene Anmeldung.
  const x = e();
  const foto = x.formular.person.find((f) => f.id === 'foto')!;
  foto.frei = { name: WEISS_NICHT, textfeld };
  x.formular.person.push({
    id: 'bereich',
    art: 'eigen',
    typ: 'multi',
    frage: 'Bereiche',
    hilfe: '',
    zustand: 'freiwillig',
    antworten: ['Küche', 'Technik'],
    frei: { name: FREI_STANDARD, textfeld: 'immer' },
  });
  x.ctFelder = {
    ...x.ctFelder,
    ...(textfeld === 'ohne' ? {} : { 'foto.frei': FOTO_TEXT }),
    bereich: BEREICH,
    'bereich.frei': BEREICH_TEXT,
  };
  return x;
}
const feld = (x: OeffentlicheEinstellungen, id: string) =>
  [...x.formular.anmeldung, ...x.formular.person].find((f) => f.id === id)!;

/** Das ChurchTools-Formular dazu: „Weiß ich noch nicht“ als dritte Option, die Text-Spalten. */
const CT3: CtFormular = {
  ...CT_MIT_NR,
  form: [
    ...CT_MIT_NR.form.map((f) =>
      f.id === 612
        ? { ...f, options: [...(f.options ?? []), { id: '117', name: WEISS_NICHT }] }
        : f,
    ),
    { id: FOTO_TEXT, type: 'custom', name: `Dürfen Fotos veröffentlicht werden? (${WEISS_NICHT})` },
    { id: BEREICH, type: 'custom', name: 'Bereiche' },
    { id: BEREICH_TEXT, type: 'custom', name: 'Bereiche (Sonstiges)' },
  ],
};
const FELDER3 = new Map(FELDER);
FELDER3.set(612, {
  ...FELDER.get(612)!,
  options: [...(FELDER.get(612)!.options ?? []), { id: '117', name: WEISS_NICHT }],
});
for (const [id, name] of [
  [FOTO_TEXT, `Fotos (${WEISS_NICHT})`],
  [BEREICH, 'Bereiche'],
  [BEREICH_TEXT, 'Bereiche (Sonstiges)'],
] as const)
  FELDER3.set(id, { id, name, fieldTypeCode: 'text' });

/** Jonas: „Weiß ich noch nicht“ + Text, Bereiche Küche + Sonstiges „Fotos, Video“; Lena: nur „Sonstiges“, ohne Text. */
function mitFrei(): Antworten {
  const a = antworten();
  a.personen[0] = {
    ...a.personen[0],
    foto: WEISS_NICHT,
    'foto.frei': ' frage die Eltern ',
    bereich: ['Küche', FREI_STANDARD],
    'bereich.frei': 'Fotos, Video',
  };
  a.personen[1] = { ...a.personen[1], bereich: [FREI_STANDARD] };
  return a;
}

/** Die Person in der Liste – die Liste ordnet selbst, deshalb über den Vornamen. */
const wer = <P extends { vor: string }>(personen: P[], vor: string) =>
  personen.find((p) => p.vor === vor)!;

/** Ein Wert als Text – Namen und Systemfelder (eine Mehrfachauswahl wäre eine Liste, F5c). */
const wert = (form: FormWert[], id: number) => {
  const v = form.find((x) => x.id === String(id))?.value;
  return typeof v === 'string' ? v : undefined;
};

/** Was ChurchTools aus der Anmeldung macht – wie `mitglieder` in den Testdaten, mit eigenem Formular. */
function gespeichert(x: OeffentlicheEinstellungen, a: Antworten, ct = CT3) {
  const anm = anmeldungAufbauen(x, a, { option: 0, extras: [] }, HEUTE, ct, {
    nr: 'AAAAAA',
    mitPlatz: [true, true],
  });
  const roh: MitgliedRoh[] = anm.forms.map((f, i) => ({
    personId: 10 + i,
    person: {
      title: `${wert(f.form, 2)} ${wert(f.form, 3)}`,
      domainAttributes: { firstName: wert(f.form, 2), lastName: wert(f.form, 3) },
    },
    groupTypeRoleId: 32,
    groupMemberStatus: 'active',
    waitinglistPosition: null,
    memberStartDate: '2026-10-19',
    fields: f.form
      .filter((y) => y.type === 'custom')
      .map((y) => ({ id: Number(y.id), value: y.value })),
  }));
  const st = mitgliederstandAus(roh, [], FELDER3, new Set([35]), PERSONEN);
  return { anm, liste: anmeldungenAus(x, st, STICHTAG) };
}

describe('Regeln der freien Antwort (F3a)', () => {
  it('Antworten: die feste Liste und am Ende die freie – auch bei Ja / Nein; in ChurchTools als Option', () => {
    const x = einst();
    expect(festeAntworten(feld(x, 'foto'))).toEqual(['Ja', 'Nein']);
    expect(wahlAntworten(feld(x, 'foto'))).toEqual(['Ja', 'Nein', WEISS_NICHT]);
    expect(wahlAntworten(feld(x, 'bereich'))).toEqual(['Küche', 'Technik', FREI_STANDARD]);
    expect(ctAblage(feld(x, 'foto'))).toEqual({
      ort: 'gruppenfeld',
      fieldTypeCode: 'radioselect',
      optionen: ['Ja', 'Nein', WEISS_NICHT],
    });
    const radio: Feld = { ...feld(x, 'bereich'), typ: 'radio' };
    const select: Feld = { ...feld(x, 'bereich'), typ: 'select' };
    expect(ctAblage(radio)).toMatchObject({ optionen: ['Küche', 'Technik', FREI_STANDARD] });
    expect(ctAblage(select)).toMatchObject({ optionen: ['Küche', 'Technik', FREI_STANDARD] });
  });

  it('nur bei Auswahlfragen – an einem Textfeld zählt sie nicht', () => {
    const text: Feld = { ...feld(einst(), 'allergy'), frei: { name: 'X', textfeld: 'auf' } };
    expect(kannFrei(text)).toBe(false);
    expect(wahlAntworten(text)).toEqual([]);
    expect(ctZusatzSpalten(text)).toEqual([]);
    expect(feldFehler({ ...text, art: 'eigen' })).toBe(
      'Eine freie Antwort gibt es nur bei Auswahlfragen.',
    );
  });

  it('zweite Spalte „Frage (Beschriftung)“ nur mit Textfeld', () => {
    expect(ctZusatzSpalten(feld(einst(), 'foto'))).toEqual([
      {
        schluessel: 'foto.frei',
        name: `Dürfen Fotos veröffentlicht werden? (${WEISS_NICHT})`,
        fieldTypeCode: 'text',
      },
    ]);
    expect(freiMitText(feld(einst('ohne'), 'foto'))).toBe(false);
    expect(ctZusatzSpalten(feld(einst('ohne'), 'foto'))).toEqual([]);
  });

  it('Feldfehler: Beschriftung leer oder wie eine feste Antwort', () => {
    const b = feld(einst(), 'bereich');
    expect(feldFehler(b)).toBeNull();
    expect(feldFehler({ ...b, frei: { name: '  ', textfeld: 'auf' } })).toBe(
      'Bitte eine Beschriftung für die freie Antwort eintragen.',
    );
    expect(feldFehler({ ...b, frei: { name: 'Küche ', textfeld: 'auf' } })).toBe(
      '„Küche“ gibt es schon als Antwort – die freie Antwort braucht eine eigene Beschriftung.',
    );
    expect(
      feldFehler({ ...feld(einst(), 'foto'), frei: { name: 'Ja', textfeld: 'ohne' } }),
    ).toMatch(/„Ja“ gibt es schon/);
  });

  it('eine Bedingung darf auf die freie Antwort schauen', () => {
    const x = einst();
    feld(x, 'bereich').bed = {
      modus: 'eine',
      regeln: [{ feld: 'foto', op: 'ist', wert: WEISS_NICHT }],
    };
    expect(bedingungFehler(x.formular)).toEqual([]);
  });

  it('gewählt? Bei einer Antwort der Wert, bei Mehrfachauswahl ein Eintrag', () => {
    const x = einst();
    expect(freiGewaehlt(feld(x, 'foto'), WEISS_NICHT)).toBe(true);
    expect(freiGewaehlt(feld(x, 'foto'), 'Ja')).toBe(false);
    expect(freiGewaehlt(feld(x, 'bereich'), ['Küche', FREI_STANDARD])).toBe(true);
    expect(freiGewaehlt(feld(x, 'bereich'), ['Küche'])).toBe(false);
  });
});

describe('Pflicht und Leeren (F3a)', () => {
  it('Pflichtfrage mit Textfeld: gewählt ohne Text fehlt der Text', () => {
    const x = einst();
    const a = mitFrei();
    delete a.personen[0]['foto.frei'];
    expect(pruefeAntworten(x.formular, a)).toEqual(['personen.0.foto.frei']);
    a.personen[0]['foto.frei'] = '   ';
    expect(pruefeAntworten(x.formular, a)).toEqual(['personen.0.foto.frei']);
    a.personen[0]['foto.frei'] = 'frage die Eltern';
    expect(pruefeAntworten(x.formular, a)).toEqual([]);
  });

  it('kein Fehler: freiwillige Frage, ohne Textfeld, oder die freie Antwort nicht gewählt', () => {
    // Lena hat „Sonstiges“ bei den freiwilligen Bereichen ohne Text gewählt.
    expect(pruefeAntworten(einst().formular, mitFrei())).toEqual([]);
    const ohne = mitFrei();
    delete ohne.personen[0]['foto.frei'];
    expect(pruefeAntworten(einst('ohne').formular, ohne)).toEqual([]);
    const ja = mitFrei();
    ja.personen[0].foto = 'Ja';
    delete ja.personen[0]['foto.frei'];
    expect(pruefeAntworten(einst().formular, ja)).toEqual([]);
  });

  it('Leeren: der Text geht nur mit, solange die freie Antwort gewählt ist (und die Frage zu sehen)', () => {
    const x = einst();
    const a = mitFrei();
    expect(leeren(x.formular, a).personen[0]['foto.frei']).toBe(' frage die Eltern ');
    a.personen[0].foto = 'Ja';
    a.personen[1]['bereich.frei'] = 'liegen geblieben';
    const l = leeren(x.formular, a);
    expect(l.personen[0]['foto.frei']).toBeUndefined();
    expect(l.personen[1]['bereich.frei']).toBe('liegen geblieben');
    // Frage ausgeblendet (Bedingung) → Antwort und Text weg.
    feld(x, 'bereich').bed = { modus: 'eine', regeln: [{ feld: 'tel', op: 'leer' }] };
    const weg = leeren(x.formular, mitFrei());
    expect(weg.personen[0].bereich).toBeUndefined();
    expect(weg.personen[0]['bereich.frei']).toBeUndefined();
    // Das Original bleibt, wie es war.
    expect(a.personen[0].foto).toBe('Ja');
  });
});

describe('Schreiben nach ChurchTools (F3a)', () => {
  it('die freie Antwort als Option, der Text getrimmt in seiner Spalte; ohne Text keine Spalte', () => {
    const { anm } = gespeichert(einst(), mitFrei());
    const [jonas, lena] = anm.forms.map((f) => f.form);
    expect(wert(jonas, 612)).toBe('117');
    expect(wert(jonas, FOTO_TEXT)).toBe('frage die Eltern');
    expect(wert(jonas, BEREICH)).toBe('Küche, Sonstiges');
    expect(wert(jonas, BEREICH_TEXT)).toBe('Fotos, Video');
    expect(wert(lena, BEREICH)).toBe('Sonstiges');
    expect(wert(lena, BEREICH_TEXT)).toBeUndefined();
  });

  it('abgewählt: der Text kommt nicht mit', () => {
    const a = mitFrei();
    a.personen[0].foto = 'Ja';
    const jonas = gespeichert(einst(), a).anm.forms[0].form;
    expect(wert(jonas, 612)).toBe('111');
    expect(wert(jonas, FOTO_TEXT)).toBeUndefined();
  });

  it('fehlt die Spalte in ChurchTools, sagt es das (statt den Text still zu verlieren)', () => {
    const x = einst();
    delete x.ctFelder['foto.frei'];
    expect(() => gespeichert(x, mitFrei())).toThrow(PasstNicht);
  });
});

describe('Anzeige und Rückweg (F3a)', () => {
  it('angezeigt wird nur der Text, wie eine eigene Antwort – ohne Text die Beschriftung', () => {
    const x = einst();
    const { liste } = gespeichert(x, mitFrei());
    const jonas = wer(liste[0].personen, 'Jonas');
    const lena = wer(liste[0].personen, 'Lena');
    expect(antwortText(feld(x, 'foto'), jonas.werte, x.ctFelder)).toBe('frage die Eltern');
    expect(antwortText(feld(x, 'bereich'), jonas.werte, x.ctFelder)).toBe('Küche · Fotos, Video');
    expect(antwortText(feld(x, 'bereich'), lena.werte, x.ctFelder)).toBe(FREI_STANDARD);
    expect(antwortZeilen(x.formular.person, jonas.werte, x.ctFelder)).toContainEqual({
      frage: feld(x, 'foto').frage,
      text: 'frage die Eltern',
    });
  });

  it('Tabelle je Person: Zelle und Summe zählen den Text als eigene Antwort', () => {
    const x = einst();
    const { liste } = gespeichert(x, mitFrei());
    const zeilen = personZeilen(liste);
    const k = frageSchluessel(feld(x, 'bereich'));
    expect(zeilen.map((z) => [z.p.vor, personZellText(x, k, z)])).toEqual(
      expect.arrayContaining([
        ['Jonas', 'Küche · Fotos, Video'],
        ['Lena', 'Sonstiges'],
      ]),
    );
    expect(personSumme(x, k, zeilen)?.text).toBe('Küche 1 · Sonstiges 1 · Fotos, Video 1');
    const foto = frageSchluessel(feld(x, 'foto'));
    expect(personSumme(x, foto, zeilen)?.text).toBe('0× Ja');
  });

  it('Rückweg: die Beschriftung als Wert, der Text unter `.frei` – Pflicht und Bedingungen rechnen damit', () => {
    const x = einst();
    const { liste } = gespeichert(x, mitFrei());
    const a = antwortenAus(x, liste[0]);
    const i = liste[0].personen.findIndex((p) => p.vor === 'Jonas');
    expect(a.personen[i]).toMatchObject({
      foto: WEISS_NICHT,
      'foto.frei': 'frage die Eltern',
      bereich: ['Küche', FREI_STANDARD],
      'bereich.frei': 'Fotos, Video',
    });
    expect(a.personen[1 - i].bereich).toEqual([FREI_STANDARD]);
    expect(a.personen[1 - i]['bereich.frei']).toBeUndefined();
    // Der Text ist zurück – die Pflicht der freien Antwort ist erfüllt (Name und E-Mail stehen an der Person).
    expect(pruefeAntworten(x.formular, a).filter((w) => w.endsWith('.frei'))).toEqual([]);
  });

  it('Mehrfachauswahl mit unbekannter Antwort: der Text aus ChurchTools bleibt, wie er ist', () => {
    const x = einst();
    expect(antwortText(feld(x, 'bereich'), { [BEREICH]: 'Küche, Wandern' }, x.ctFelder)).toBe(
      'Küche, Wandern',
    );
  });

  it('Summe: steht nur der eingetippte Text da, zählt er als eigene Antwort', () => {
    const b = feld(einst(), 'bereich');
    expect(frageSumme(b, ['Fotos machen', 'Küche · Fotos machen', null])?.text).toBe(
      'Küche 1 · Fotos machen 2',
    );
  });

  it('Mehrfachauswahl zerlegt mit der freien Antwort', () => {
    expect(mehrfachAntworten(feld(einst(), 'bereich'), 'Küche, Sonstiges')).toEqual([
      'Küche',
      FREI_STANDARD,
    ]);
  });

  it('freiAnzeige: nur die freie Antwort mit Textfeld wird ersetzt', () => {
    const x = einst();
    expect(freiAnzeige(feld(x, 'foto'), WEISS_NICHT, ' später ')).toBe('später');
    expect(freiAnzeige(feld(x, 'foto'), 'Ja', 'später')).toBe('Ja');
    expect(freiAnzeige(feld(x, 'foto'), WEISS_NICHT, '')).toBe(WEISS_NICHT);
    expect(freiAnzeige(feld(einst('ohne'), 'foto'), WEISS_NICHT, 'später')).toBe(WEISS_NICHT);
  });
});
