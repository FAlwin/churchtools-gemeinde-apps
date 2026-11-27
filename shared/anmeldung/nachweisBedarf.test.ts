import { describe, expect, it } from 'vitest';
import { anmeldungenAus, mitgliederstandAus, type ListenAnmeldung } from './liste';
import { FELDER, PERSONEN, STICHTAG, e, mitglieder } from './liste.testdaten';
import { antworten } from './senden.testdaten';
import {
  einstellungenAlsText,
  einstellungenLesen,
  type Feld,
  type OeffentlicheEinstellungen,
} from './formular';
import { personZeilen } from './tabelle';
import { passtPerson } from './tabellenFilter';
import {
  NACHWEISE_MAX,
  brauchtNachweis,
  mitNachweisBedarf,
  mitNachweisenUmbenannt,
  nachweisBedarfSatz,
  nachweisBedarfVon,
  nachweisBedingungSatz,
  nachweisFragen,
  nachweisProblem,
  nachweisProblemText,
  type NachweisBedarf,
} from './nachweisBedarf';

/**
 * Wer braucht den Nachweis? (N3b, E20) – gegen Anmeldungen, wie das Formular sie schreibt (`liste.testdaten.ts`):
 *  - AAAAAA: Jonas (Fotos Ja) und Lena (Fotos Nein), beide mit Platz,
 *  - BBBBBB: dieselben Antworten, Lena auf der Warteliste,
 *  - CCCCCC: beide Fotos Nein.
 * Die Regel nutzt die Filter der Tabelle – die Tests prüfen sie gegen `passtPerson` selbst, nicht gegen Literale allein.
 */
const ohneAllergie = () => {
  const a = antworten();
  a.anmeldung.tel = '';
  a.personen = a.personen.map((p) => ({ ...p, allergy: '', foto: 'Nein' }));
  return a;
};
const personen = new Map([
  ...PERSONEN,
  ...[20, 30].map((id) => [id, PERSONEN.get(10)!] as const),
  ...[21, 31].map((id) => [id, PERSONEN.get(11)!] as const),
]);
const liste = (x: OeffentlicheEinstellungen = e()) => {
  const roh = [
    ...mitglieder('AAAAAA', [true, true], 10, { bezahlt: true }),
    ...mitglieder('BBBBBB', [true, false], 20),
    ...mitglieder('CCCCCC', [true, true], 30, { antworten: ohneAllergie() }),
  ];
  return anmeldungenAus(x, mitgliederstandAus(roh, [], FELDER, new Set([35]), personen), STICHTAG);
};

const FOTO = 'frage:foto';
const ALLE = 61;
const NUR = 62;
const wer = (
  x: OeffentlicheEinstellungen,
  b: NachweisBedarf | undefined,
  l: ListenAnmeldung[] = liste(x),
) => personZeilen(l).map((z) => (brauchtNachweis(x, b, z) ? `${z.p.vor} ${z.x.nr}` : null));
const wenige = (a: (string | null)[]) => a.filter((s): s is string => s !== null);

/** Eine Frage der Anmeldung mit Gruppenfeld; der Wert steht, wie ChurchTools ihn liefert. */
const frage = (id: string, typ: Feld['typ'], antw: string[] = []): Feld => ({
  id,
  art: 'eigen',
  typ,
  frage: id,
  hilfe: '',
  zustand: 'freiwillig',
  antworten: antw,
});
const mitFrage = (f: Feld, ctId: number, bereich: 'anmeldung' | 'person' = 'anmeldung') => {
  const x = e();
  x.formular[bereich].push(f);
  x.ctFelder = { ...x.ctFelder, [f.id]: ctId };
  return x;
};
const nurWenn = (feld: string, antw: string[]): NachweisBedarf => ({
  artGruppeId: NUR,
  fuer: 'nurWenn',
  feld,
  antworten: antw,
});

describe('brauchtNachweis', () => {
  it('nicht eingeschaltet → niemand; „alle“ → jede Person, auch Wartende (das entscheidet N3c)', () => {
    const x = e();
    expect(wenige(wer(x, undefined))).toEqual([]);
    expect(wenige(wer(x, { artGruppeId: ALLE, fuer: 'alle' }))).toHaveLength(6);
  });

  it('Frage je Person: die Antwort der Person zählt (Jonas Fotos Ja, Lena Nein)', () => {
    const x = e();
    expect(wenige(wer(x, nurWenn(FOTO, ['Ja'])))).toEqual(['Jonas AAAAAA', 'Jonas BBBBBB']);
    expect(wenige(wer(x, nurWenn(FOTO, ['Nein'])))).toEqual([
      'Lena AAAAAA',
      'Lena BBBBBB',
      'Jonas CCCCCC',
      'Lena CCCCCC',
    ]);
    expect(wenige(wer(x, nurWenn(FOTO, ['Ja', 'Nein'])))).toHaveLength(6);
  });

  it('Frage an den Kontakt (Anmeldung): die Antwort gilt für alle Personen der Anmeldung', () => {
    const x = mitFrage(frage('team', 'janein'), 710);
    const l = liste(x);
    l[0].einmal[710] = 'Ja';
    l[1].einmal[710] = 'Nein';
    // CCCCCC hat keine Antwort.
    expect(wenige(wer(x, nurWenn('frage:team', ['Ja']), l))).toEqual([
      'Jonas AAAAAA',
      'Lena AAAAAA',
    ]);
    expect(wenige(wer(x, nurWenn('frage:team', ['Nein']), l))).toEqual([
      'Jonas BBBBBB',
      'Lena BBBBBB',
    ]);
  });

  it('Mehrfachauswahl: eine der gewählten Antworten reicht', () => {
    const x = mitFrage(frage('tage', 'multi', ['Fr', 'Sa', 'So']), 700);
    const l = liste(x);
    l[0].einmal[700] = 'Fr, Sa';
    l[1].einmal[700] = 'So';
    expect(wenige(wer(x, nurWenn('frage:tage', ['Sa']), l))).toEqual([
      'Jonas AAAAAA',
      'Lena AAAAAA',
    ]);
    expect(wenige(wer(x, nurWenn('frage:tage', ['Sa', 'So']), l))).toHaveLength(4);
    expect(wenige(wer(x, nurWenn('frage:tage', ['Fr']), l))).toHaveLength(2);
  });

  it('Ankreuzen: „angekreuzt“ und „nicht angekreuzt“', () => {
    const x = mitFrage(frage('agb', 'check'), 704);
    const l = liste(x);
    l[0].einmal[704] = '1';
    expect(nachweisFragen(x).find((q) => q.feld === 'frage:agb')).toBeDefined();
    expect(wenige(wer(x, nurWenn('frage:agb', ['angekreuzt']), l))).toEqual([
      'Jonas AAAAAA',
      'Lena AAAAAA',
    ]);
    expect(wenige(wer(x, nurWenn('frage:agb', ['nicht angekreuzt']), l))).toHaveLength(4);
  });

  it('freie Antwort: gefiltert wird nach ihrer Beschriftung, nicht nach dem Getippten', () => {
    const f = {
      ...frage('hilfe', 'radio', ['Küche']),
      frei: { name: 'Sonstiges', textfeld: 'auf' as const },
    };
    const x = mitFrage(f, 701);
    x.ctFelder['hilfe.frei'] = 702;
    const l = liste(x);
    l[0].einmal[701] = 'Küche';
    l[1].einmal[701] = 'Sonstiges';
    l[1].einmal[702] = 'Fotos machen';
    expect(wenige(wer(x, nurWenn('frage:hilfe', ['Sonstiges']), l))).toEqual([
      'Jonas BBBBBB',
      'Lena BBBBBB',
    ]);
    expect(wenige(wer(x, nurWenn('frage:hilfe', ['Fotos machen']), l))).toEqual([]);
  });

  it('keine zweite Vergleichslogik: dieselbe Antwort wie `passtPerson` mit dem Filter der Tabelle', () => {
    const x = e();
    const b = nurWenn(FOTO, ['Ja']);
    for (const z of personZeilen(liste(x)))
      expect(brauchtNachweis(x, b, z)).toBe(passtPerson(x, [{ spalte: FOTO, werte: ['Ja'] }], z));
  });
});

describe('kaputte Bedingung (Frage gelöscht, ausgeschaltet, Antwort entfernt)', () => {
  it('Frage gelöscht: niemand braucht den Nachweis – nie „alle“ –, und das Problem ist benannt', () => {
    const x = e();
    const b = nurWenn('frage:gibtsnicht', ['Ja']);
    expect(wenige(wer(x, b))).toEqual([]);
    expect(nachweisProblem(x, b)).toEqual({ art: 'frage' });
    expect(nachweisProblemText(x, b)).toContain('gibt es nicht mehr');
  });

  it('Frage ausgeschaltet oder jetzt eine Textfrage: dasselbe', () => {
    const aus = e();
    aus.formular.person = aus.formular.person.map((f) =>
      f.id === 'foto' ? { ...f, zustand: 'aus' as const } : f,
    );
    expect(wenige(wer(aus, nurWenn(FOTO, ['Ja'])))).toEqual([]);
    expect(nachweisProblem(aus, nurWenn(FOTO, ['Ja']))).toEqual({ art: 'frage' });

    const text = e();
    text.formular.person = text.formular.person.map((f) =>
      f.id === 'foto' ? { ...f, typ: 'text' as const } : f,
    );
    expect(wenige(wer(text, nurWenn(FOTO, ['Ja'])))).toEqual([]);
    expect(nachweisProblem(text, nurWenn(FOTO, ['Ja']))).toEqual({ art: 'frage' });
  });

  it('Antwort entfernt: die Regel gilt weiter (frühere Antworten stehen so in ChurchTools), mit Hinweis', () => {
    const x = e();
    const b = nurWenn(FOTO, ['Ja', 'Vielleicht']);
    expect(nachweisProblem(x, b)).toEqual({ art: 'antworten', fehlen: ['Vielleicht'] });
    expect(nachweisProblemText(x, b)).toContain('„Vielleicht“');
    expect(nachweisProblemText(x, b)).toContain('weiter');
    expect(wenige(wer(x, b))).toEqual(['Jonas AAAAAA', 'Jonas BBBBBB']);
  });

  it('„alle“ und eine heile Bedingung haben kein Problem', () => {
    const x = e();
    expect(nachweisProblem(x, { artGruppeId: ALLE, fuer: 'alle' })).toBeNull();
    expect(nachweisProblemText(x, { artGruppeId: ALLE, fuer: 'alle' })).toBeNull();
    expect(nachweisProblem(x, nurWenn(FOTO, ['Ja']))).toBeNull();
    expect(nachweisProblemText(x, nurWenn(FOTO, ['Ja']))).toBeNull();
  });
});

describe('Fragen zur Wahl und Sätze', () => {
  it('nur Fragen mit festen Antworten; je Person oder Kontakt, in Formular-Reihenfolge', () => {
    const x = mitFrage(frage('team', 'janein'), 710);
    x.formular.anmeldung.push(frage('zahl', 'number'));
    x.ctFelder.zahl = 711;
    const q = nachweisFragen(x);
    expect(q.find((f) => f.feld === FOTO)).toMatchObject({ jePerson: true });
    expect(q.find((f) => f.feld === 'frage:team')).toMatchObject({ jePerson: false });
    // Freitext, Zahl, Telefon, Name … taugen nicht.
    expect(q.map((f) => f.feld)).not.toContain('frage:zahl');
    expect(q.map((f) => f.feld)).not.toContain('frage:allergy');
    expect(q.map((f) => f.feld)).not.toContain('frage:tel');
  });

  it('Sätze für die Karte', () => {
    const x = e();
    expect(nachweisBedarfSatz(x, { artGruppeId: ALLE, fuer: 'alle' })).toBe('alle Angemeldeten');
    const b = nurWenn(FOTO, ['Ja', 'Nein']);
    expect(nachweisBedarfSatz(x, b)).toBe(
      'nur wenn Dürfen Fotos veröffentlicht w… ist Ja oder Nein',
    );
    expect(
      nachweisBedingungSatz(x, {
        artGruppeId: NUR,
        fuer: 'nurWenn',
        feld: 'frage:weg',
        antworten: ['A'],
      }),
    ).toBe('(Frage fehlt) ist A');
  });
});

/** Die Testeinstellungen mit einem Termin, wie das Schema ihn will – sonst scheitert das Packen schon daran. */
const gueltig = (x: OeffentlicheEinstellungen): OeffentlicheEinstellungen => ({
  ...x,
  termin: { beginn: '2026-11-20T10:00', ende: null, ort: '', terminId: null },
});

describe('Einstellung ändern', () => {
  const alle: NachweisBedarf = { artGruppeId: ALLE, fuer: 'alle' };

  it('einschalten, ersetzen, ausschalten – die übrigen Arten und ihre Reihenfolge bleiben', () => {
    let x = e();
    expect(x.nachweise).toBeUndefined();
    x = mitNachweisBedarf(x, ALLE, alle);
    x = mitNachweisBedarf(x, NUR, nurWenn(FOTO, ['Ja']));
    x = mitNachweisBedarf(x, 63, { artGruppeId: 63, fuer: 'alle' });
    expect(x.nachweise!.map((b) => b.artGruppeId)).toEqual([ALLE, NUR, 63]);
    x = mitNachweisBedarf(x, NUR, nurWenn(FOTO, ['Nein']));
    expect(x.nachweise!.map((b) => b.artGruppeId)).toEqual([ALLE, NUR, 63]);
    expect(nachweisBedarfVon(x, NUR)).toEqual(nurWenn(FOTO, ['Nein']));
    x = mitNachweisBedarf(x, ALLE, null);
    expect(x.nachweise!.map((b) => b.artGruppeId)).toEqual([NUR, 63]);
    // Eine Art, die gar nicht eingeschaltet ist, auszuschalten ändert nichts.
    expect(mitNachweisBedarf(x, 99, null).nachweise).toEqual(x.nachweise);
  });

  it('die letzte ausgeschaltet → die Angabe fällt ganz weg (hält die Einstellungen kurz); das Original bleibt', () => {
    const x = mitNachweisBedarf(e(), ALLE, alle);
    const y = mitNachweisBedarf(x, ALLE, null);
    expect('nachweise' in y).toBe(false);
    expect(x.nachweise).toHaveLength(1);
  });

  it('wirft bei „Nur wenn“ ohne Antwort, bei falscher Art und bei zu vielen Arten', () => {
    expect(() => mitNachweisBedarf(e(), NUR, nurWenn(FOTO, []))).toThrow(/mindestens eine Antwort/);
    expect(() => mitNachweisBedarf(e(), NUR, nurWenn('', ['Ja']))).toThrow();
    expect(() => mitNachweisBedarf(e(), 5, alle)).toThrow(/Falsche/);
    let x = e();
    for (let i = 1; i <= NACHWEISE_MAX; i++)
      x = mitNachweisBedarf(x, i, { artGruppeId: i, fuer: 'alle' });
    expect(() => mitNachweisBedarf(x, 999, { artGruppeId: 999, fuer: 'alle' })).toThrow(
      /Höchstens/,
    );
    // Eine vorhandene zu ändern geht auch bei voller Liste.
    expect(() =>
      mitNachweisBedarf(x, 1, { ...nurWenn(FOTO, ['Ja']), artGruppeId: 1 }),
    ).not.toThrow();
  });

  it('übersteht Packen und Lesen (das Schema wirft Unbekanntes still weg) – und lehnt Kaputtes ab', () => {
    const x = mitNachweisBedarf(mitNachweisBedarf(e(), ALLE, alle), NUR, nurWenn(FOTO, ['Ja']));
    const text = einstellungenAlsText(gueltig(x));
    expect(einstellungenLesen(text)?.nachweise).toEqual(x.nachweise);
    const kaputt = {
      ...x,
      nachweise: [{ artGruppeId: NUR, fuer: 'nurWenn', feld: FOTO, antworten: [] }],
    };
    expect(() =>
      einstellungenAlsText(gueltig(kaputt as unknown as OeffentlicheEinstellungen)),
    ).toThrow(/nachweise/);
    const zuViele = {
      ...x,
      nachweise: Array.from({ length: NACHWEISE_MAX + 1 }, (_, i) => ({
        artGruppeId: i + 1,
        fuer: 'alle',
      })),
    };
    expect(() =>
      einstellungenAlsText(gueltig(zuViele as unknown as OeffentlicheEinstellungen)),
    ).toThrow(/nachweise/);
  });

  it('der Platz reicht für alle Arten mit langen Bedingungen (Grenze der Einstellungen: 5.000 Zeichen)', () => {
    const lang = Array.from(
      { length: 40 },
      (_, i) => `Antwort ${i} mit etwas längerem Text zum Messen`,
    );
    let x = e();
    for (let i = 1; i <= NACHWEISE_MAX; i++)
      x = mitNachweisBedarf(x, i, { ...nurWenn(FOTO, lang), artGruppeId: i });
    const mit = einstellungenAlsText(gueltig(x)).length;
    const ohne = einstellungenAlsText(gueltig(e())).length;
    expect(mit - ohne).toBeLessThan(1500);
  });
});

describe('Antworten umbenannt (zieht mit wie die Bedingungen im Formular)', () => {
  const x = (): OeffentlicheEinstellungen => ({
    ...e(),
    nachweise: [
      nurWenn('frage:f1', ['M', 'L']),
      { artGruppeId: 63, fuer: 'nurWenn', feld: 'frage:f2', antworten: ['M'] },
      { artGruppeId: 64, fuer: 'alle' },
    ],
  });

  it('nur die Bedingungen an dieser Frage; andere Fragen und „alle“ bleiben', () => {
    const neu = mitNachweisenUmbenannt(x(), 'f1', { M: 'Medium' });
    expect(neu.nachweise).toEqual([
      nurWenn('frage:f1', ['Medium', 'L']),
      { artGruppeId: 63, fuer: 'nurWenn', feld: 'frage:f2', antworten: ['M'] },
      { artGruppeId: 64, fuer: 'alle' },
    ]);
  });

  it('ein Tausch geht, zwei gleiche Namen werden eine; ohne Änderung kommt dasselbe Objekt zurück', () => {
    expect(mitNachweisenUmbenannt(x(), 'f1', { M: 'L', L: 'M' }).nachweise![0]).toEqual(
      nurWenn('frage:f1', ['L', 'M']),
    );
    expect(mitNachweisenUmbenannt(x(), 'f1', { M: 'L' }).nachweise![0]).toEqual(
      nurWenn('frage:f1', ['L']),
    );
    const eins = x();
    expect(mitNachweisenUmbenannt(eins, 'f1', {})).toBe(eins);
    expect(mitNachweisenUmbenannt(eins, 'f1', { X: 'Y' })).toBe(eins);
    expect(mitNachweisenUmbenannt(eins, 'f9', { M: 'Medium' })).toBe(eins);
    const ohne = e();
    expect(mitNachweisenUmbenannt(ohne, 'f1', { M: 'Medium' })).toBe(ohne);
  });
});
