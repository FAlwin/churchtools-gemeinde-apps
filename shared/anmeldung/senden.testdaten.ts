/**
 * **Testdaten zum Anmelden** – gemeinsam für `senden.test.ts` und `liste.test.ts` (A7-1): Die Liste wird mit dem
 * gefüttert, was `anmeldungAufbauen` aus diesen Daten macht – so prüft ihr Test, dass sie liest, was das Formular
 * schreibt.
 */
import type { Antworten, OeffentlicheEinstellungen } from './formular';
import { neueEinstellungen } from './vorlagen';
import { unterschriftText } from './unterschrift';
import type { CtFormular } from './senden';

/**
 * Die Anmeldung für ChurchTools (A6-2, #548, Variante A). Das ChurchTools-Formular ist dem nachgebaut, was
 * `/publicgroups/174/form` am 14.10.2026 geliefert hat (Messgruppe, Kopie von 165).
 */
export const CT: CtFormular = {
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
export function einstellungen(): OeffentlicheEinstellungen {
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

export const STRICHE = unterschriftText([
  [
    [10, 10],
    [50, 40],
  ],
])!;

export function antworten(): Antworten {
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
