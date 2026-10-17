import { describe, expect, it } from 'vitest';
import type { Antworten, OeffentlicheEinstellungen } from './formular';
import { neueEinstellungen } from './vorlagen';
import { unterschriftText } from './unterschrift';
import {
  PasstNicht,
  anmeldungAufbauen,
  aufschluesselungText,
  betragAus,
  buchungAus,
  neueAnmeldeNr,
  ctWert,
  type CtFormular,
} from './senden';

/**
 * Die Anmeldung für ChurchTools (A6-2, #548, Variante A). Das ChurchTools-Formular ist dem nachgebaut, was
 * `/publicgroups/174/form` am 14.10.2026 geliefert hat (Messgruppe, Kopie von 165).
 */
const CT: CtFormular = {
  form: [
    { id: 2, type: 'person', name: 'firstName' },
    { id: 3, type: 'person', name: 'lastName' },
    { id: 14, type: 'person', name: 'email' },
    { id: 580, type: 'custom', name: 'Angemeldet von' },
    { id: 585, type: 'custom', name: 'Betrag' },
    { id: 588, type: 'custom', name: 'Aufschlüsselung' },
    { id: 591, type: 'custom', name: 'Auswahl' },
    { id: 594, type: 'custom', name: 'Extras' },
    { id: 603, type: 'custom', name: 'Telefon' },
    { id: 606, type: 'custom', name: 'Bemerkungen' },
    { id: 609, type: 'custom', name: 'Allergien oder Unverträglichkeiten' },
    {
      id: 612,
      type: 'custom',
      name: 'Dürfen Fotos veröffentlicht werden?',
      fieldTypeCode: 'radioselect',
      options: [
        { id: '111', name: 'Ja' },
        { id: '114', name: 'Nein' },
      ],
    },
    // A6-2b: Erziehungsberechtigte (eine Spalte), Unterschrift (lesbar + Striche).
    { id: 615, type: 'custom', name: 'Erziehungsberechtigte' },
    { id: 618, type: 'custom', name: 'Unterschrift' },
    { id: 621, type: 'custom', name: 'Unterschrift (Daten)' },
    { id: -2, type: 'privacy', name: 'privacy' },
  ],
  addChildForm: [{ id: 16, type: 'person', name: 'birthday' }],
};

/** Kinder-Event, 6 € je Kind, Felder wie in ChurchTools angelegt. */
function einstellungen(): OeffentlicheEinstellungen {
  const e = neueEinstellungen('kinder');
  e.termin = {
    beginn: '2026-11-20T10:00',
    ende: null,
    ort: null,
    zeitzone: 'Europe/Berlin',
  } as never;
  e.preis = {
    ...e.preis,
    grundpreis: { art: 'fest', betragCent: 600, gilt: 'person', auswahlName: '', optionen: [] },
    alter: [],
    anpassungen: [],
    extras: [],
  };
  e.ctFelder = {
    kontakt: 580,
    betrag: 585,
    aufschluesselung: 588,
    auswahl: 591,
    extras: 594,
    tel: 603,
    note: 606,
    allergy: 609,
    foto: 612,
    eltern: 615,
    sign: 618,
    'sign.daten': 621,
  };
  return e;
}

const STRICHE = unterschriftText([
  [
    [10, 10],
    [50, 40],
  ],
])!;

function antworten(): Antworten {
  return {
    anmeldung: {
      name: { vor: 'Maria', nach: 'Beispiel' },
      mail: 'maria@beispiel.test',
      tel: '0151 111',
      note: '',
      eltern: {
        personen: [
          { vor: 'Maria', nach: 'Beispiel', tel: '0151 111' },
          { vor: 'Tom', nach: 'Beispiel', tel: '' },
        ],
        einverstanden: true,
      },
      sign: { striche: STRICHE },
      priv: true,
    },
    personen: [
      {
        pname: { vor: 'Jonas', nach: 'Beispiel' },
        birth: '2017-05-01',
        allergy: 'Nüsse',
        foto: 'Ja',
      },
      { pname: { vor: 'Lena', nach: 'Beispiel' }, birth: '2019-02-02', foto: 'Nein' },
    ],
  };
}

const HEUTE = '2026-10-14';
const wert = (form: { id: string; value: string }[], id: string | number) =>
  form.find((x) => x.id === String(id))?.value;

describe('anmeldungAufbauen – Variante A', () => {
  it('Mitglied werden nur die Teilnehmenden; die Eltern (Kontakt) nicht', () => {
    const a = anmeldungAufbauen(einstellungen(), antworten(), { option: 0, extras: [] }, HEUTE, CT);
    expect(a.forms).toHaveLength(2);
    expect(a.forms.map((f) => `${wert(f.form, 2)} ${wert(f.form, 3)}`)).toEqual([
      'Jonas Beispiel',
      'Lena Beispiel',
    ]);
    // Alle mit der Adresse der Kontaktperson; Datenschutz je Person und oben.
    expect(a.forms.every((f) => wert(f.form, 14) === 'maria@beispiel.test')).toBe(true);
    expect(a.forms.every((f) => wert(f.form, -2) === 'true')).toBe(true);
    expect(a.hasAcceptedPrivacyForSelf).toBe(true);
  });

  it('„einmal je Anmeldung“ steht bei der ersten Person: Kontaktname, Telefon, Betrag, Aufschlüsselung', () => {
    const [erste, zweite] = anmeldungAufbauen(
      einstellungen(),
      antworten(),
      { option: 0, extras: [] },
      HEUTE,
      CT,
    ).forms;
    expect(wert(erste.form, 580)).toBe('Maria Beispiel');
    expect(wert(erste.form, 603)).toBe('0151 111');
    // 2 Kinder × 6 € = 12 € – von Hand gerechnet.
    expect(wert(erste.form, 585)).toBe('12,00 €');
    expect(wert(erste.form, 588)).toMatch(/Gesamt: 12,00 €$/);
    for (const id of [580, 603, 585, 588])
      expect(wert(zweite.form, id), String(id)).toBeUndefined();
    // Leere Bemerkung wird nicht geschickt.
    expect(wert(erste.form, 606)).toBeUndefined();
  });

  it('je Person: Geburtstag, eigene Felder; Ja/Nein als Options-ID', () => {
    const [erste, zweite] = anmeldungAufbauen(
      einstellungen(),
      antworten(),
      { option: 0, extras: [] },
      HEUTE,
      CT,
    ).forms;
    expect(wert(erste.form, 16)).toBe('2017-05-01');
    expect(wert(erste.form, 609)).toBe('Nüsse');
    expect(wert(erste.form, 612)).toBe('111');
    expect(wert(zweite.form, 612)).toBe('114');
    expect(wert(zweite.form, 609)).toBeUndefined();
  });

  it('Geburtsdatum aus → wird nicht geschickt, auch wenn ein Wert da ist', () => {
    const e = einstellungen();
    e.formular.person = e.formular.person.map((f) =>
      f.id === 'birth' ? { ...f, zustand: 'aus' as const } : f,
    );
    const [erste] = anmeldungAufbauen(e, antworten(), { option: 0, extras: [] }, HEUTE, CT).forms;
    expect(wert(erste.form, 16)).toBeUndefined();
  });

  it('fehlt ein Feld oder eine Antwort in ChurchTools → PasstNicht, statt still etwas zu verlieren', () => {
    const ohneAllergie = { ...CT, form: CT.form.filter((x) => x.id !== 609) };
    expect(() =>
      anmeldungAufbauen(
        einstellungen(),
        antworten(),
        { option: 0, extras: [] },
        HEUTE,
        ohneAllergie,
      ),
    ).toThrow(PasstNicht);
    const ohneKontakt = einstellungen();
    delete ohneKontakt.ctFelder.kontakt;
    expect(() =>
      anmeldungAufbauen(ohneKontakt, antworten(), { option: 0, extras: [] }, HEUTE, CT),
    ).toThrow(/kontakt/);
    const a = antworten();
    a.personen[0].foto = 'Vielleicht';
    expect(() =>
      anmeldungAufbauen(einstellungen(), a, { option: 0, extras: [] }, HEUTE, CT),
    ).toThrow(/Vielleicht/);
  });

  it('A6-2b: Erziehungsberechtigte lesbar und die Unterschrift in zwei Spalten – nur bei der ersten Person', () => {
    const [erste, zweite] = anmeldungAufbauen(
      einstellungen(),
      antworten(),
      { option: 0, extras: [] },
      HEUTE,
      CT,
    ).forms;
    expect(wert(erste.form, 615)).toBe(
      'Maria Beispiel, 0151 111\nTom Beispiel\n✓ erziehungsberechtigt und einverstanden',
    );
    // Unterschrieben hat die erste erziehungsberechtigte Person, am Tag der Anmeldung.
    expect(wert(erste.form, 618)).toBe('✓ Maria Beispiel, 14.10.2026');
    expect(wert(erste.form, 621)).toBe(STRICHE);
    for (const id of [615, 618, 621]) expect(wert(zweite.form, id), String(id)).toBeUndefined();
  });

  it('A6-2b: ohne Erziehungsberechtigte unterschreibt der Kontakt; ohne Unterschrift (freiwillig) keine der Spalten', () => {
    const e = einstellungen();
    e.formular.anmeldung = e.formular.anmeldung.map((f) =>
      f.id === 'eltern' ? { ...f, zustand: 'aus' as const } : f,
    );
    const [erste] = anmeldungAufbauen(e, antworten(), { option: 0, extras: [] }, HEUTE, CT).forms;
    expect(wert(erste.form, 615)).toBeUndefined();
    expect(wert(erste.form, 618)).toBe('✓ Maria Beispiel, 14.10.2026');
    const a = antworten();
    a.anmeldung.name = { vor: '', nach: '' };
    a.anmeldung.sign = { striche: '' };
    const [ohne] = anmeldungAufbauen(e, a, { option: 0, extras: [] }, HEUTE, CT).forms;
    expect(wert(ohne.form, 618)).toBeUndefined();
    expect(wert(ohne.form, 621)).toBeUndefined();
  });

  it('A6-2b: fehlt die Spalte für die Striche → PasstNicht (sonst wäre nur „✓“ gespeichert, ohne Unterschrift)', () => {
    const e = einstellungen();
    delete e.ctFelder['sign.daten'];
    expect(() => anmeldungAufbauen(e, antworten(), { option: 0, extras: [] }, HEUTE, CT)).toThrow(
      /Unterschrift \(Daten\)/,
    );
  });

  it('Auswahl und Extras als Namen', () => {
    const e = einstellungen();
    e.preis.grundpreis = {
      art: 'auswahl',
      betragCent: 0,
      gilt: 'person',
      auswahlName: 'Zimmer',
      optionen: [
        { name: '2-Bett', preisCent: 1000, kontingent: 0, belegt: 0 },
        { name: '4-Bett', preisCent: 800, kontingent: 0, belegt: 0 },
      ],
    };
    e.preis.extras = [
      { bezeichnung: 'Bettwäsche', preisCent: 500, gilt: 'person' },
      { bezeichnung: 'Bus', preisCent: 300, gilt: 'anmeldung' },
    ] as never;
    const [erste] = anmeldungAufbauen(
      e,
      antworten(),
      { option: 1, extras: [true, true] },
      HEUTE,
      CT,
    ).forms;
    expect(wert(erste.form, 591)).toBe('4-Bett');
    expect(wert(erste.form, 594)).toBe('Bettwäsche, Bus');
  });
});

describe('ctWert – jede Feldart', () => {
  const ct = { id: 1, type: 'custom', name: 'x', options: [{ id: 7, name: 'Kids' }] };
  const feld = (typ: string) =>
    ({
      id: 'f',
      art: 'eigen',
      typ,
      frage: 'F',
      hilfe: '',
      zustand: 'freiwillig',
      antworten: ['Kids'],
    }) as never;
  it('Ankreuzen 1, sonst nichts; Mehrfachauswahl als Text; Auswahl als ID; leer → null', () => {
    expect(ctWert(feld('check'), true, ct)).toBe('1');
    expect(ctWert(feld('check'), false, ct)).toBeNull();
    expect(ctWert(feld('multi'), ['A', 'B'], ct)).toBe('A, B');
    expect(ctWert(feld('multi'), [], ct)).toBeNull();
    expect(ctWert(feld('radio'), 'Kids', ct)).toBe('7');
    expect(ctWert(feld('select'), ' Kids ', ct)).toBe('7');
    expect(ctWert(feld('text'), '  ', ct)).toBeNull();
    expect(ctWert(feld('number'), '3', ct)).toBe('3');
  });
});

describe('buchungAus – dieselbe Buchung für Anzeige und Speichern', () => {
  it('Alter am ersten Tag nur, wenn das Geburtsdatum abgefragt wird', () => {
    const e = einstellungen();
    expect(buchungAus(e, antworten(), { option: 0, extras: [] }, HEUTE).alter).toEqual([9, 7]);
    e.formular.person = e.formular.person.map((f) =>
      f.id === 'birth' ? { ...f, zustand: 'aus' as const } : f,
    );
    expect(buchungAus(e, antworten(), { option: 0, extras: [] }, HEUTE).alter).toEqual([
      null,
      null,
    ]);
  });
  it('Aufschlüsselung: eine Zeile je Posten, Summe darunter', () => {
    expect(
      aufschluesselungText({
        posten: [
          { text: 'Grundpreis', hinweis: '2 × 6,00 €', betragCent: 1200 },
          { text: 'Frühbucher', hinweis: '', betragCent: -200 },
          { text: 'Gilt nicht', hinweis: '', betragCent: null },
        ],
        gesamtCent: 1000,
        ausgebucht: false,
      }),
    ).toBe('Grundpreis (2 × 6,00 €): 12,00 €\nFrühbucher: −2,00 €\nGesamt: 10,00 €');
  });
});

describe('A6-5a (#612): Anmelde-Nr. und Betrag nur für Personen mit Platz', () => {
  const MIT_NR: CtFormular = {
    ...CT,
    form: [...CT.form, { id: 700, type: 'custom', name: 'Anmelde-Nr.' }],
  };
  const mitNr = () => {
    const e = einstellungen();
    e.ctFelder = { ...e.ctFelder, nr: 700 };
    return e;
  };
  const wahl = { option: 0, extras: [] };

  it('die Nr. steht bei JEDER Person, derselbe Wert', () => {
    const [erste, zweite] = anmeldungAufbauen(mitNr(), antworten(), wahl, HEUTE, MIT_NR, {
      nr: '7K2P9X',
    }).forms;
    expect([wert(erste.form, 700), wert(zweite.form, 700)]).toEqual(['7K2P9X', '7K2P9X']);
  });

  it('ältere Veranstaltung ohne das Feld → ohne Nr., kein Fehler', () => {
    const [erste] = anmeldungAufbauen(einstellungen(), antworten(), wahl, HEUTE, CT, {
      nr: '7K2P9X',
    }).forms;
    expect(erste.form.some((x) => x.value === '7K2P9X')).toBe(false);
  });

  it('Lena wartet → Betrag nur für Jonas, Aufschlüsselung nennt Lena', () => {
    const [erste, zweite] = anmeldungAufbauen(einstellungen(), antworten(), wahl, HEUTE, CT, {
      mitPlatz: [true, false],
    }).forms;
    expect(wert(erste.form, 585)).toBe('6,00 €');
    expect(wert(erste.form, 588)).toMatch(
      /Gesamt: 6,00 €\nLena Beispiel: Warteliste – Betrag folgt beim Nachrücken$/,
    );
    expect(wert(zweite.form, 585)).toBeUndefined();
  });

  it('alle warten → Betrag 0, nur die Wartelisten-Zeilen – auch keine Gebühr je Anmeldung', () => {
    const e = einstellungen();
    e.preis.grundpreis.gilt = 'anmeldung';
    expect(betragAus(e, antworten(), wahl, HEUTE, [true, false]).gesamtCent).toBe(600);
    const b = betragAus(e, antworten(), wahl, HEUTE, [false, false]);
    expect([b.gesamtCent, b.posten, b.warten]).toEqual([
      0,
      [],
      ['Jonas Beispiel', 'Lena Beispiel'],
    ]);
  });

  it('ohne Angabe zählen alle (wie bisher)', () => {
    expect(betragAus(einstellungen(), antworten(), wahl, HEUTE).gesamtCent).toBe(1200);
  });

  it('neueAnmeldeNr: sechs Zeichen ohne verwechselbare (0, O, 1, I, L)', () => {
    for (let i = 0; i < 200; i++) expect(neueAnmeldeNr()).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);
  });
});
