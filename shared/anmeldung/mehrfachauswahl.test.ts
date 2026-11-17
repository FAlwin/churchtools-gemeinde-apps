import { describe, expect, it } from 'vitest';
import type { Antworten, OeffentlicheEinstellungen } from './formular';
import { anmeldungAufbauen, type CtFormular } from './senden';
import { antworten } from './senden.testdaten';
import { CT_MIT_NR, FELDER, HEUTE, PERSONEN, STICHTAG, e } from './liste.testdaten';
import {
  anmeldungenAus,
  antwortText,
  mitgliederstandAus,
  type Absage,
  type MitgliedRoh,
} from './liste';
import { antwortenAus } from './antwortenAusListe';
import { personSumme, personZeilen } from './tabelle';
import { frageSchluessel } from './druckliste';
import { zurueckPlan } from './bewegung';

/**
 * F5c – „Mehrere Antworten“ als echtes `multiselect` (gemessen 17.11.2026): geschrieben als Liste der Options-Nummern,
 * zurück aus der Mitgliederliste als Liste, im Verlauf als Text „A, B“.
 */
const BEREICH = 700;
const OPTIONEN = [
  { id: '235', name: 'Küche' },
  { id: '238', name: 'Technik' },
  { id: '241', name: 'Programm' },
];

function einst(): OeffentlicheEinstellungen {
  const x = e();
  x.formular.person.push({
    id: 'bereich',
    art: 'eigen',
    typ: 'multi',
    frage: 'Bereiche',
    hilfe: '',
    zustand: 'freiwillig',
    antworten: OPTIONEN.map((o) => o.name),
  });
  x.ctFelder = { ...x.ctFelder, bereich: BEREICH };
  return x;
}
const CT: CtFormular = {
  ...CT_MIT_NR,
  form: [
    ...CT_MIT_NR.form,
    {
      id: BEREICH,
      type: 'custom',
      name: 'Bereiche',
      fieldTypeCode: 'multiselect',
      options: OPTIONEN,
    },
  ],
};
const FELDER_M = new Map(FELDER);
FELDER_M.set(BEREICH, {
  id: BEREICH,
  name: 'Bereiche',
  fieldTypeCode: 'multiselect',
  options: OPTIONEN,
});

function mitBereich(): Antworten {
  const a = antworten();
  a.personen[0] = { ...a.personen[0], bereich: ['Küche', 'Programm'] };
  a.personen[1] = { ...a.personen[1], bereich: ['Technik'] };
  return a;
}

/** Schreiben wie das Formular, dann so zurück, wie ChurchTools die Mitglieder liefert. */
function gespeichert(x = einst()) {
  const anm = anmeldungAufbauen(x, mitBereich(), { option: 0, extras: [] }, HEUTE, CT, {
    nr: 'AAAAAA',
    mitPlatz: [true, true],
  });
  const roh: MitgliedRoh[] = anm.forms.map((f, i) => ({
    personId: 10 + i,
    person: {
      title: '',
      domainAttributes: { firstName: i ? 'Lena' : 'Jonas', lastName: 'Beispiel' },
    },
    groupTypeRoleId: 32,
    groupMemberStatus: 'active',
    waitinglistPosition: null,
    memberStartDate: '2026-10-19',
    fields: f.form
      .filter((y) => y.type === 'custom')
      .map((y) => ({ id: Number(y.id), value: y.value })),
  }));
  return {
    anm,
    roh,
    liste: anmeldungenAus(
      x,
      mitgliederstandAus(roh, [], FELDER_M, new Set([35]), PERSONEN),
      STICHTAG,
    ),
  };
}

describe('Mehrfachauswahl als multiselect (F5c)', () => {
  it('geschrieben als Liste der Options-Nummern', () => {
    const { anm } = gespeichert();
    const wert = (i: number) => anm.forms[i].form.find((y) => y.id === String(BEREICH))?.value;
    expect([wert(0), wert(1)]).toEqual([['235', '241'], ['238']]);
  });

  it('zurück aus der Liste: Anzeige, Summe und Rückweg wie bei der alten Text-Spalte', () => {
    const x = einst();
    const { liste } = gespeichert(x);
    const f = x.formular.person.find((y) => y.id === 'bereich')!;
    const jonas = liste[0].personen.find((p) => p.vor === 'Jonas')!;
    expect(antwortText(f, jonas.werte, x.ctFelder)).toBe('Küche · Programm');
    expect(personSumme(x, frageSchluessel(f), personZeilen(liste))?.text).toBe(
      'Küche 1 · Technik 1 · Programm 1',
    );
    const a = antwortenAus(x, liste[0]);
    const i = liste[0].personen.indexOf(jonas);
    expect(a.personen[i].bereich).toEqual(['Küche', 'Programm']);
  });

  it('geleert ([]) ist keine Antwort', () => {
    const x = einst();
    const { roh } = gespeichert(x);
    roh[0].fields = roh[0].fields!.map((y) => (y.id === BEREICH ? { ...y, value: [] } : y));
    const liste = anmeldungenAus(
      x,
      mitgliederstandAus(roh, [], FELDER_M, new Set([35]), PERSONEN),
      STICHTAG,
    );
    const f = x.formular.person.find((y) => y.id === 'bereich')!;
    const jonas = liste[0].personen.find((p) => p.vor === 'Jonas')!;
    expect(antwortText(f, jonas.werte, x.ctFelder)).toBeNull();
  });

  it('Zurückholen: aus dem Verlauf („Küche, Programm“) wieder die Liste der Nummern; Unbekanntes geht verloren', () => {
    const x = einst();
    const { liste } = gespeichert(x);
    const absage = (wert: string): Absage => ({
      personId: 12,
      name: 'Paul Beispiel',
      am: '2026-10-20',
      selbst: true,
      warVorher: 'aktiv',
      werte: { [BEREICH]: wert },
      angemeldetAm: '2026-10-19',
      email: null,
      geburtstag: null,
    });
    const gut = zurueckPlan(x, absage('Küche, Programm'), liste, FELDER_M, true, HEUTE);
    expect(gut.felder[BEREICH]).toEqual(['235', '241']);
    const weg = zurueckPlan(x, absage('Küche, Basteln'), liste, FELDER_M, true, HEUTE);
    expect(weg.felder[BEREICH]).toBeUndefined();
    expect(weg.verloren).toEqual(['Bereiche: Küche, Basteln']);
  });
});
