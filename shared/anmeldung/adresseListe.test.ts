import { describe, expect, it } from 'vitest';
import { anmeldungenAus, mitgliederstandAus, type PersonDaten } from './liste';
import { FELDER, PERSONEN, STICHTAG, e, mitglieder } from './liste.testdaten';
import { adresseVonPerson } from './adresse';
import { EMPFOHLEN } from './baukasten';
import {
  frageAntwort,
  fragen,
  frageSchluessel,
  teilnehmerSpalten,
  teilnehmerZelle,
} from './druckliste';
import { personZeilen, personZellText, spaltenKatalog, summe, zellText } from './tabelle';
import { antwortenAus, bedingungsBefunde } from './antwortenAusListe';
import type { Feld, OeffentlicheEinstellungen } from './formular';

/**
 * **F4b: Die Adresse in der Erweiterung** – aus dem Profil der Person (`GET /persons`), nicht aus einer Spalte. Eine
 * Regel für Tabelle, Druckliste und „Anmeldung ansehen“: `fragen` + `frageAntwort` (druckliste.ts).
 */
const HAUPT = { strasse: 'Hauptstr. 4', plz: '53797', ort: 'Lohmar' };
const BACH = { strasse: 'Am Bach 2', plz: '51766', ort: 'Engelskirchen' };
const baustein = (zustand: Feld['zustand'] = 'freiwillig'): Feld => ({
  ...EMPFOHLEN.find((x) => x.id === 'adresse')!.feld,
  zustand,
});
function mitAdresse(
  wo: 'anmeldung' | 'person',
  zustand?: Feld['zustand'],
): OeffentlicheEinstellungen {
  const x = e();
  x.formular[wo] = [...x.formular[wo].slice(0, 2), baustein(zustand), ...x.formular[wo].slice(2)];
  return x;
}
/** Jonas (10) und Lena (11) – Lena wohnt woanders. */
const personen = (lena: PersonDaten['adresse'] = BACH) =>
  new Map<number, PersonDaten>([
    [10, { ...PERSONEN.get(10)!, adresse: HAUPT }],
    [11, { ...PERSONEN.get(11)!, adresse: lena }],
  ]);
const liste = (x: OeffentlicheEinstellungen, p = personen()) =>
  anmeldungenAus(
    x,
    mitgliederstandAus(mitglieder('AAAAAA', [true, true], 10), [], FELDER, new Set([35]), p),
    STICHTAG,
  );
const schluessel = frageSchluessel(baustein());

describe('Adresse aus dem Profil (F4b)', () => {
  it('liest Straße, PLZ, Ort der Person – leer oder nicht zu sehen ist null', () => {
    expect(adresseVonPerson({ street: ' Hauptstr. 4 ', zip: '53797', city: 'Lohmar' })).toEqual(
      HAUPT,
    );
    expect(adresseVonPerson({ street: '', zip: null, city: undefined })).toBeNull();
    expect(adresseVonPerson({})).toBeNull();
  });

  it('jede Person trägt ihre Adresse in die Liste', () => {
    const [x] = liste(mitAdresse('person'));
    expect(x.personen.map((p) => p.adresse)).toEqual([HAUPT, BACH]);
  });

  it('ist eine Frage des Katalogs, solange sie im Formular ist', () => {
    expect(fragen(mitAdresse('anmeldung')).map((f) => f.id)).toContain('adresse');
    expect(fragen(mitAdresse('anmeldung', 'aus')).map((f) => f.id)).not.toContain('adresse');
    expect(
      teilnehmerSpalten(mitAdresse('person')).find((s) => s.schluessel === schluessel)?.titel,
    ).toBe('Adresse');
  });
});

describe('Tabelle und Druckliste (F4b)', () => {
  it('je Person: jede ihre eigene', () => {
    const x = mitAdresse('person');
    const [a] = liste(x);
    expect(a.personen.map((p) => teilnehmerZelle(x, schluessel, a, p))).toEqual([
      'Hauptstr. 4, 53797 Lohmar',
      'Am Bach 2, 51766 Engelskirchen',
    ]);
    // Je Anmeldung gibt es Fragen je Person nicht.
    expect(frageAntwort(x, x.formular.person.find((f) => f.id === 'adresse')!, a, null)).toBeNull();
  });

  it('einmal je Anmeldung: in der Zeile der Anmeldung die der ersten Person, je Person ihre aktuelle', () => {
    const x = mitAdresse('anmeldung');
    const [a] = liste(x);
    expect(spaltenKatalog(x, 'anmeldung').map((s) => s.schluessel)).toContain(schluessel);
    expect(zellText(x, schluessel, a)).toBe('Hauptstr. 4, 53797 Lohmar');
    expect(personZeilen([a]).map((z) => personZellText(x, schluessel, z))).toEqual([
      'Hauptstr. 4, 53797 Lohmar',
      'Am Bach 2, 51766 Engelskirchen',
    ]);
  });

  it('ohne Adresse im Profil bleibt die Zelle leer; die Summe zählt die ausgefüllten', () => {
    const x = mitAdresse('anmeldung');
    const leer = new Map<number, PersonDaten>([
      [10, { ...PERSONEN.get(10)!, adresse: null }],
      [11, { ...PERSONEN.get(11)!, adresse: null }],
    ]);
    const [a] = liste(x, leer);
    expect(zellText(x, schluessel, a)).toBe('');
    expect(summe(x, schluessel, [a])).toEqual({ text: '0 ausgefüllt' });
    expect(summe(x, schluessel, liste(x))).toEqual({ text: '1 ausgefüllt' });
  });
});

describe('Nicht im Rückweg der Antworten (F4b)', () => {
  it('die Adresse im Profil gilt nicht als Antwort – auch eine ausgeblendete Adresse meldet die Nachprüfung nicht', () => {
    const x = mitAdresse('person');
    // Nur zeigen, wenn Fotos erlaubt sind – Lena hat „Nein“, ihre Adresse steht trotzdem im Profil.
    const foto = x.formular.person.findIndex((f) => f.id === 'foto');
    const [f] = x.formular.person.splice(foto, 1);
    x.formular.person.splice(1, 0, f);
    x.formular.person = x.formular.person.map((y) =>
      y.id === 'adresse'
        ? {
            ...y,
            bed: {
              modus: 'eine' as const,
              regeln: [{ feld: 'foto', op: 'ist' as const, wert: 'Ja' }],
            },
          }
        : y,
    );
    const l = liste(x);
    expect(antwortenAus(x, l[0]).personen.every((p) => p.adresse === undefined)).toBe(true);
    expect(bedingungsBefunde(x, l)).toEqual([]);
  });
});
