import { describe, expect, it } from 'vitest';
import { anmeldungenAus } from './liste';
import { nachpruefen, pruefMitgliederAus } from './nachpruefung';
import { leeren, type AntwortBedingung, type Bedingung } from './bedingungen';
import type { Feld, OeffentlicheEinstellungen } from './formular';
import { FELDER, HEUTE, STICHTAG, e, mitglieder, stand } from './liste.testdaten';
import { antworten } from './senden.testdaten';
import { handFelder, handStart } from './vonHand';
import { antwortenAus, bedingungsBefunde, bedingungsText } from './antwortenAusListe';

/**
 * F1e (Klick-Runde 6, 16.11.2026): Antworten aus ChurchTools zurück – für die Nachprüfung und „Person dazu“. Gebaut
 * wird über die Erzeuger: Formular-Antworten → `anmeldungAufbauen` → Mitglieder → Liste → zurück.
 */

const JONAS = 10;
const wenn = (feld: string, op: Bedingung['regeln'][number]['op'], wert?: string): Bedingung => ({
  modus: 'eine',
  regeln: [{ feld, op, ...(wert === undefined ? {} : { wert }) }],
});
const feld = (x: OeffentlicheEinstellungen, id: string) =>
  [...x.formular.anmeldung, ...x.formular.person].find((f) => f.id === id)!;
/** Die Anmeldung von Maria mit Jonas und Lena – so, wie die Liste sie aus ChurchTools liest. */
const gespeichert = (x: OeffentlicheEinstellungen) =>
  anmeldungenAus(x, stand(mitglieder('AAAAAA', [true, true], JONAS)), STICHTAG)[0];

describe('antwortenAus – der Rückweg', () => {
  it('liest zurück, was das Formular geschickt hat (Text, Ja/Nein, E-Mail, Geburtsdatum)', () => {
    const x = e();
    const a = antwortenAus(x, gespeichert(x));
    const vorher = leeren(x.formular, antworten());
    expect(a.anmeldung.tel).toBe(vorher.anmeldung.tel);
    expect(a.anmeldung.mail).toBe(vorher.anmeldung.mail);
    expect(a.personen.map((p) => [p.allergy, p.foto, p.birth])).toEqual([
      ['Nüsse', 'Ja', '2017-05-01'],
      [undefined, 'Nein', '2019-02-02'],
    ]);
    // Leer Geschicktes kommt nicht als Antwort zurück.
    expect('note' in a.anmeldung).toBe(false);
  });

  it('Ankreuzen als `true`, Mehrfachauswahl als Liste – so erwarten es die Bedingungen', () => {
    const x = e();
    const anm = gespeichert(x);
    const f1: Feld = {
      id: 'k1',
      art: 'eigen',
      typ: 'check',
      frage: 'Ich helfe mit',
      hilfe: '',
      zustand: 'freiwillig',
      antworten: [],
    };
    const f2: Feld = {
      ...f1,
      id: 'k2',
      typ: 'multi',
      frage: 'Tage',
      antworten: ['Fr, abends', 'Sa'],
    };
    const y = { ...x, formular: { ...x.formular, anmeldung: [...x.formular.anmeldung, f1, f2] } };
    y.ctFelder = { ...y.ctFelder, k1: 901, k2: 902 };
    const mit = { ...anm, einmal: { ...anm.einmal, 901: '1', 902: 'Fr, abends, Sa' } };
    const a = antwortenAus(y, mit);
    expect(a.anmeldung.k1).toBe(true);
    expect(a.anmeldung.k2).toEqual(['Fr, abends', 'Sa']);
  });

  it('je Anmeldung einmal gerechnet – mit anderen Einstellungen neu', () => {
    const x = e();
    const anm = gespeichert(x);
    expect(antwortenAus(x, anm)).toBe(antwortenAus(x, anm));
    const y = e();
    expect(antwortenAus(y, anm)).not.toBe(antwortenAus(x, anm));
  });
});

describe('bedingungsBefunde – was das Formular verhindert hätte (Nachprüfung)', () => {
  it('ohne Bedingungen nichts', () => {
    const x = e();
    expect(bedingungsBefunde(x, [gespeichert(x)])).toEqual([]);
  });

  it('eine gesperrte Antwort, je Person – mit dem Hinweis der Antwort', () => {
    const x = e();
    const anm = gespeichert(x);
    // Erst nachher eingestellt: „Ja“ bei Fotos nur ohne Telefon – Maria hat eins angegeben.
    feld(x, 'foto').antwortBed = {
      Ja: { ...wenn('tel', 'leer'), art: 'grau', grund: 'nur ohne Telefon' },
    };
    const b = bedingungsBefunde(x, [anm]);
    expect(b).toEqual([
      {
        schluessel: anm.schluessel,
        nr: 'AAAAAA',
        name: 'Jonas Beispiel',
        art: 'antwort',
        frage: feld(x, 'foto').frage,
        antwort: 'Ja',
        bedingung: '„Telefon“ ist leer',
        grund: 'nur ohne Telefon',
      },
    ]);
    expect(bedingungsText(b[0])).toBe(
      `„${feld(x, 'foto').frage}“: „Ja“ gewählt – nur ohne Telefon`,
    );
  });

  it('ausgeblendete Antwort ohne Hinweis: der Satz nennt die Bedingung', () => {
    const x = e();
    const anm = gespeichert(x);
    const weg: AntwortBedingung = { ...wenn('tel', 'leer'), art: 'weg', grund: 'liegen geblieben' };
    feld(x, 'foto').antwortBed = { Ja: weg };
    const [b] = bedingungsBefunde(x, [anm]);
    expect(b.grund).toBeUndefined();
    expect(bedingungsText(b)).toBe(
      `„${feld(x, 'foto').frage}“: „Ja“ gewählt – nur wählbar, wenn „Telefon“ ist leer`,
    );
  });

  it('eine beantwortete Frage, die gar nicht gezeigt worden wäre', () => {
    const x = e();
    const anm = gespeichert(x);
    feld(x, 'allergy').bed = wenn('tel', 'leer');
    const b = bedingungsBefunde(x, [anm]);
    // Nur Jonas – Lena hat die Frage nicht beantwortet.
    expect(b.map((y) => [y.name, y.art, y.bedingung])).toEqual([
      ['Jonas Beispiel', 'frage', '„Telefon“ ist leer'],
    ]);
    expect(bedingungsText(b[0])).toBe(
      `„${feld(x, 'allergy').frage}“ beantwortet – die Frage erscheint nur, wenn „Telefon“ ist leer`,
    );
  });

  it('was die Bedingung erfüllt, ist kein Befund', () => {
    const x = e();
    const anm = gespeichert(x);
    feld(x, 'allergy').bed = wenn('tel', 'ausgefuellt');
    feld(x, 'foto').antwortBed = { Ja: { ...wenn('tel', 'ausgefuellt'), art: 'grau' } };
    expect(bedingungsBefunde(x, [anm])).toEqual([]);
  });

  it('Kontakt-Fragen: der Name ist „Angemeldet von“', () => {
    const x = e();
    const anm = gespeichert(x);
    feld(x, 'tel').bed = wenn('mail', 'leer');
    expect(bedingungsBefunde(x, [anm]).map((y) => y.name)).toEqual([anm.wer]);
  });

  it('die Nachprüfung zählt sie als Hinweise', () => {
    const x = e();
    const st = stand(mitglieder('AAAAAA', [true, true], JONAS));
    feld(x, 'allergy').bed = wenn('tel', 'leer');
    const liste = anmeldungenAus(x, st, STICHTAG);
    const ohne = nachpruefen(x, pruefMitgliederAus(x, st), { belegt: 2, wartend: 0, max: 10 });
    const mit = nachpruefen(
      x,
      pruefMitgliederAus(x, st),
      { belegt: 2, wartend: 0, max: 10 },
      liste,
    );
    expect(ohne.bedingungen).toEqual([]);
    expect(mit.bedingungen).toHaveLength(1);
    expect(mit.hinweise).toBe(ohne.hinweise + 1);
  });
});

describe('bedingungsBefunde – Fragen in einem übersprungenen Schritt (F2d)', () => {
  /** Ein Schritt „Allergien“ vor `allergy`, nur wenn kein Telefon angegeben ist – Maria hat eins. */
  function mitSchritt(bed = wenn('tel', 'leer')): OeffentlicheEinstellungen {
    const x = e();
    const i = x.formular.person.findIndex((f) => f.id === 'allergy');
    const schritt: Feld = {
      id: 's2',
      art: 'eigen',
      typ: 'schritt',
      frage: 'Allergien',
      hilfe: '',
      zustand: 'freiwillig',
      antworten: [],
      bed,
    };
    x.formular.person.splice(i, 0, schritt);
    return x;
  }

  it('beantwortet, obwohl der Schritt übersprungen worden wäre – der Satz nennt den Schritt und seine Bedingung', () => {
    const x = mitSchritt();
    const anm = gespeichert(x);
    // Ohne eigene Bedingung an der Frage – nur der Schritt hätte sie ausgeblendet.
    expect(feld(x, 'allergy').bed).toBeUndefined();
    const b = bedingungsBefunde(x, [anm]);
    // Alles hinter dem Schritt gehört zu ihm: Allergien (nur Jonas hat sie beantwortet) und die Foto-Erlaubnis.
    const allergie = feld(x, 'allergy').frage;
    const foto = feld(x, 'foto').frage;
    expect(b.map((y) => [y.name, y.frage, y.art, y.schritt, y.bedingung])).toEqual([
      ['Jonas Beispiel', allergie, 'frage', 'Allergien', '„Telefon“ ist leer'],
      ['Jonas Beispiel', foto, 'frage', 'Allergien', '„Telefon“ ist leer'],
      ['Lena Beispiel', foto, 'frage', 'Allergien', '„Telefon“ ist leer'],
    ]);
    expect(bedingungsText(b[0])).toBe(
      `„${feld(x, 'allergy').frage}“ beantwortet – die Frage steht im Schritt „Allergien“, der nur erscheint, wenn „Telefon“ ist leer`,
    );
  });

  it('wird der Schritt gezeigt, ist es kein Befund', () => {
    const x = mitSchritt(wenn('tel', 'ausgefuellt'));
    expect(bedingungsBefunde(x, [gespeichert(x)])).toEqual([]);
  });

  it('Schritt gezeigt, die Frage selbst nicht: der Satz nennt ihre eigene Bedingung, keinen Schritt', () => {
    const x = mitSchritt(wenn('tel', 'ausgefuellt'));
    const anm = gespeichert(x);
    feld(x, 'allergy').bed = wenn('mail', 'leer');
    const [b] = bedingungsBefunde(x, [anm]);
    expect([b.schritt, b.bedingung]).toEqual([undefined, '„E-Mail“ ist leer']);
  });
});

describe('„Person dazu“ mit den Kontakt-Antworten (F1e)', () => {
  it('startet mit den Kontakt-Antworten der Anmeldung', () => {
    const x = e();
    const anm = gespeichert(x);
    const a = handStart(
      x,
      { vor: 'Paul', nach: 'Beispiel', geburtstag: null, email: null, adresse: null },
      anm,
    );
    expect(a.anmeldung).toEqual(antwortenAus(x, anm).anmeldung);
    expect(a.anmeldung.tel).toBe('0151 111');
  });

  it('eine Frage der Person, die auf eine Kontakt-Frage schaut, wird gespeichert', () => {
    const x = e();
    const anm = gespeichert(x);
    feld(x, 'allergy').bed = wenn('tel', 'ausgefuellt');
    const paul = {
      vor: 'Paul',
      nach: 'Beispiel',
      geburtstag: '2018-04-03',
      email: null,
      adresse: null,
    };
    const speichern = (start: ReturnType<typeof handStart>) => {
      start.personen[0].allergy = 'Gluten';
      return handFelder(x, start, { option: 0, extras: [] }, HEUTE, FELDER, {
        nr: 'AAAAAA',
        mitPlatz: true,
        papier: null,
        nurPerson: true,
      });
    };
    expect(speichern(handStart(x, paul, anm))[x.ctFelder.allergy]).toBe('Gluten');
    // Ohne die Kontakt-Antworten wäre sie unsichtbar und fiele beim Speichern weg (so war es bis F1e).
    expect(speichern(handStart(x, paul))[x.ctFelder.allergy]).toBeUndefined();
    // Die Kontakt-Felder selbst werden bei „Person dazu“ nicht geschrieben.
    expect(speichern(handStart(x, paul, anm))[x.ctFelder.tel]).toBeUndefined();
  });

  it('eine Kontakt-Antwort, die ChurchTools so nicht mehr kennt, bricht „Person dazu“ nicht ab', () => {
    const x = e();
    const anm = gespeichert(x);
    // Ein Kontakt-Feld, dessen Spalte im Anmeldeformular fehlt – umgerechnet würde es scheitern.
    const k: Feld = {
      id: 'k9',
      art: 'eigen',
      typ: 'text',
      frage: 'Gemeinde',
      hilfe: '',
      zustand: 'freiwillig',
      antworten: [],
    };
    x.formular.anmeldung.push(k);
    x.ctFelder = { ...x.ctFelder, k9: 999 };
    const start = handStart(
      x,
      { vor: 'Paul', nach: 'Beispiel', geburtstag: null, email: null, adresse: null },
      anm,
    );
    start.anmeldung.k9 = 'Donrath';
    const w = { nr: 'AAAAAA', mitPlatz: true, papier: null };
    expect(() =>
      handFelder(x, start, { option: 0, extras: [] }, HEUTE, FELDER, { ...w, nurPerson: true }),
    ).not.toThrow();
    // Gegenprobe: als ganze Anmeldung umgerechnet scheitert es tatsächlich.
    expect(() => handFelder(x, start, { option: 0, extras: [] }, HEUTE, FELDER, w)).toThrow(
      /Gemeinde/,
    );
  });
});
