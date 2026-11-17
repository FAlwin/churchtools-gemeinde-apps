import { describe, expect, it } from 'vitest';
import { CT, antworten, einstellungen } from './senden.testdaten';
import { PasstNicht, anmeldungAufbauen, type CtFormular } from './senden';
import { ADRESSE_TEILE, adresseText, adresseWerte } from './adresse';
import { EMPFOHLEN } from './baukasten';
import { ctAblage, pruefeAntworten, type Feld, type OeffentlicheEinstellungen } from './formular';

/**
 * **F4 Adresse** (Entwurf `f4-adresse-v1`, gemessen M1 17.11.2026): drei Teile in den Personenfeldern, einmal je
 * Anmeldung (für alle Personen) oder je Person; leere Teile werden nie geschickt.
 */
const HEUTE = '2026-10-14';
const WAHL = { option: 0, extras: [] };
/** Das ChurchTools-Formular mit Straße, PLZ, Ort – Nummern wie auf der Test-Instanz (F0/M1). */
const CT_ADRESSE: CtFormular = {
  ...CT,
  form: [
    ...CT.form,
    { id: 4, type: 'person', name: 'street' },
    { id: 6, type: 'person', name: 'zip' },
    { id: 7, type: 'person', name: 'city' },
  ],
};
const wert = (form: { id: string; type: string; value: string | string[] }[], id: number) =>
  form.find((x) => x.id === String(id) && x.type === 'person')?.value;
const baustein = (zustand: Feld['zustand'] = 'freiwillig'): Feld => ({
  ...EMPFOHLEN.find((x) => x.id === 'adresse')!.feld,
  zustand,
});
/** Die Einstellungen mit der Adresse – „einmal je Anmeldung“ oder „je Person“. */
function mitAdresse(
  wo: 'anmeldung' | 'person',
  zustand?: Feld['zustand'],
): OeffentlicheEinstellungen {
  const e = einstellungen();
  const liste = e.formular[wo];
  // Vor die festen Felder am Ende (Preis, Datenschutz) – wie im Baukasten.
  e.formular[wo] = [...liste.slice(0, 2), baustein(zustand), ...liste.slice(2)];
  return e;
}
const HAUPT = { strasse: ' Hauptstr. 4 ', plz: '53797', ort: 'Lohmar' };

describe('Baustein „Adresse“ (F4)', () => {
  it('ist ein Personenfeld – keine Spalte in der Mitgliederliste', () => {
    expect(ctAblage(baustein())).toEqual({ ort: 'person', feld: 'adresse' });
  });

  it('ersetzt in „Empfohlen“ die frühere „Anschrift“ (Textfeld)', () => {
    expect(EMPFOHLEN.map((x) => x.id)).toContain('adresse');
    expect(EMPFOHLEN.map((x) => x.id)).not.toContain('addr');
    expect(EMPFOHLEN.find((x) => x.id === 'adresse')).toMatchObject({
      name: 'Adresse',
      bereich: 'anmeldung',
      feld: { typ: 'adresse', art: 'standard', zustand: 'freiwillig' },
    });
  });

  it('Teile und Längen wie in ChurchTools (Straße 100, PLZ 20, Ort 40)', () => {
    expect(ADRESSE_TEILE.map((t) => [t.ct, t.max])).toEqual([
      ['street', 100],
      ['zip', 20],
      ['city', 40],
    ]);
  });

  it('„Hauptstr. 4, 53797 Lohmar“ – fehlende Teile fallen weg', () => {
    expect(adresseText(HAUPT)).toBe('Hauptstr. 4, 53797 Lohmar');
    expect(adresseText({ strasse: '', plz: '', ort: 'Lohmar' })).toBe('Lohmar');
    expect(adresseText(undefined)).toBe('');
    expect(adresseText('kaputt')).toBe('');
  });

  it('geschickt wird nur, was eingetragen ist – getrimmt und gekürzt', () => {
    expect(adresseWerte({ strasse: '  ', plz: '53797', ort: '' })).toEqual([
      { ct: 'zip', wert: '53797' },
    ]);
    expect(adresseWerte({ strasse: 'x'.repeat(130), plz: '', ort: '' })[0].wert).toHaveLength(100);
  });
});

describe('Pflicht (F4)', () => {
  it('Pflicht: jeder fehlende Teil einzeln', () => {
    const e = mitAdresse('anmeldung', 'pflicht');
    const a = antworten();
    a.anmeldung.adresse = { strasse: 'Hauptstr. 4', plz: ' ', ort: '' };
    expect(pruefeAntworten(e.formular, a)).toEqual([
      'anmeldung.adresse.plz',
      'anmeldung.adresse.ort',
    ]);
    a.anmeldung.adresse = HAUPT;
    expect(pruefeAntworten(e.formular, a)).toEqual([]);
  });

  it('je Person: der Pfad nennt die Person', () => {
    const e = mitAdresse('person', 'pflicht');
    const a = antworten();
    a.personen[0].adresse = HAUPT;
    expect(pruefeAntworten(e.formular, a)).toEqual([
      'personen.1.adresse.strasse',
      'personen.1.adresse.plz',
      'personen.1.adresse.ort',
    ]);
  });

  it('freiwillig: leer ist in Ordnung', () => {
    expect(pruefeAntworten(mitAdresse('anmeldung').formular, antworten())).toEqual([]);
  });
});

describe('Absenden (F4)', () => {
  it('einmal je Anmeldung: jede Person bekommt dieselbe Adresse in ihre Personenfelder', () => {
    const a = antworten();
    a.anmeldung.adresse = HAUPT;
    const forms = anmeldungAufbauen(mitAdresse('anmeldung'), a, WAHL, HEUTE, CT_ADRESSE).forms;
    expect(forms).toHaveLength(2);
    for (const f of forms) {
      expect(wert(f.form, 4)).toBe('Hauptstr. 4');
      expect(wert(f.form, 6)).toBe('53797');
      expect(wert(f.form, 7)).toBe('Lohmar');
    }
  });

  it('je Person: jede ihre eigene', () => {
    const a = antworten();
    a.personen[0].adresse = HAUPT;
    a.personen[1].adresse = { strasse: 'Am Bach 2', plz: '51766', ort: 'Engelskirchen' };
    const [jonas, lena] = anmeldungAufbauen(mitAdresse('person'), a, WAHL, HEUTE, CT_ADRESSE).forms;
    expect(wert(jonas.form, 7)).toBe('Lohmar');
    expect(wert(lena.form, 7)).toBe('Engelskirchen');
    expect(wert(lena.form, 4)).toBe('Am Bach 2');
  });

  it('leere Teile werden nicht geschickt – sie würden eine vorhandene Adresse löschen (M1)', () => {
    const a = antworten();
    a.anmeldung.adresse = { strasse: '', plz: '53797', ort: '  ' };
    const [erste] = anmeldungAufbauen(mitAdresse('anmeldung'), a, WAHL, HEUTE, CT_ADRESSE).forms;
    expect(wert(erste.form, 6)).toBe('53797');
    expect(wert(erste.form, 4)).toBeUndefined();
    expect(wert(erste.form, 7)).toBeUndefined();
  });

  it('ohne Antwort oder ausgeschaltet: keine Personenfelder', () => {
    const ohne = anmeldungAufbauen(mitAdresse('anmeldung'), antworten(), WAHL, HEUTE, CT_ADRESSE);
    expect(ohne.forms.flatMap((f) => f.form.filter((x) => ['4', '6', '7'].includes(x.id)))).toEqual(
      [],
    );
    const a = antworten();
    a.anmeldung.adresse = HAUPT;
    const aus = anmeldungAufbauen(mitAdresse('anmeldung', 'aus'), a, WAHL, HEUTE, CT_ADRESSE);
    expect(wert(aus.forms[0].form, 4)).toBeUndefined();
  });

  it('fehlen die Felder im ChurchTools-Formular, wird nichts geschickt (PasstNicht)', () => {
    const a = antworten();
    a.anmeldung.adresse = HAUPT;
    expect(() => anmeldungAufbauen(mitAdresse('anmeldung'), a, WAHL, HEUTE, CT)).toThrow(
      PasstNicht,
    );
  });
});
