/**
 * **Testdaten für die Liste** (A7-1) – Mitglieder, wie ChurchTools sie aus einer Anmeldung des Formulars macht
 * (`anmeldungAufbauen` mit den Daten aus `senden.testdaten.ts`), dazu Einträge im Verlauf. Für `liste.test.ts` und den
 * Test des Reiters in der Erweiterung.
 */
import {
  mitgliederstandAus,
  type CtGruppenfeld,
  type MitgliedRoh,
  type PersonDaten,
  type VerlaufRoh,
} from './liste';
import { anmeldungAufbauen, type FormWert } from './senden';
import { CT, antworten, einstellungen } from './senden.testdaten';

export const NR = 669;
export const BEZAHLT = 516;
export const BEZAHLT_AM = 519;
export const ZAHLART = 520;
export const HEUTE = '2026-10-17';
export const STICHTAG = '2026-11-20';

export function e() {
  const x = einstellungen();
  x.ctFelder = { ...x.ctFelder, nr: NR, bezahlt: BEZAHLT, bezahltAm: BEZAHLT_AM, zahlart: ZAHLART };
  return x;
}
export const CT_MIT_NR = {
  ...CT,
  form: [...CT.form, { id: NR, type: 'custom', name: 'Anmelde-Nr.' }],
};

/** Die Gruppenfelder, wie `/groups/{id}/memberfields` sie beschreibt. */
export const FELDER = new Map<number, CtGruppenfeld>(
  [
    ...CT_MIT_NR.form
      .filter((f) => f.type === 'custom')
      .map(
        (f): CtGruppenfeld => ({
          id: Number(f.id),
          name: f.name,
          fieldTypeCode: f.fieldTypeCode,
          options: f.options ?? undefined,
        }),
      ),
    { id: BEZAHLT, name: 'Bezahlt', fieldTypeCode: 'checkbox' },
    { id: BEZAHLT_AM, name: 'Bezahlt am', fieldTypeCode: 'date' },
    { id: ZAHLART, name: 'Zahlart', fieldTypeCode: 'text' },
  ].map((f): [number, CtGruppenfeld] => [f.id, f]),
);

const wert = (form: FormWert[], id: number) => form.find((x) => x.id === String(id))?.value;

/** Was ChurchTools aus einer Anmeldung als Mitglieder macht. */
export function mitglieder(
  nr: string | undefined,
  mitPlatz: boolean[],
  ersteId: number,
  extra: { bezahlt?: boolean } = {},
): MitgliedRoh[] {
  const a = anmeldungAufbauen(e(), antworten(), { option: 0, extras: [] }, HEUTE, CT_MIT_NR, {
    nr,
    mitPlatz,
  });
  return a.forms.map((f, i) => ({
    personId: ersteId + i,
    person: {
      title: `${wert(f.form, 2)} ${wert(f.form, 3)}`,
      domainAttributes: { firstName: wert(f.form, 2), lastName: wert(f.form, 3) },
    },
    groupTypeRoleId: 32,
    groupMemberStatus: mitPlatz[i] ? 'active' : 'waiting',
    waitinglistPosition: mitPlatz[i] ? null : 1,
    memberStartDate: '2026-10-19',
    fields: [
      ...f.form
        .filter((x) => x.type === 'custom')
        .map((x) => ({ id: Number(x.id), value: x.value })),
      { id: BEZAHLT, value: extra.bezahlt && i === 0 ? '1' : '0' },
      { id: BEZAHLT_AM, value: extra.bezahlt && i === 0 ? '2026-10-18' : null },
      { id: ZAHLART, value: extra.bezahlt && i === 0 ? 'Bar' : null },
    ],
  }));
}

/** Der Verlaufseintrag „ist dazugekommen“ (Anmeldetag). */
export const dazu = (memberId: number, am: string): VerlaufRoh => ({
  memberId,
  previous: { membershipStatus: null },
  current: { membershipStatus: 'active' },
  meta: { createdDate: `${am}T10:00:00Z`, createdPerson: { id: memberId } },
});

/** Eine Absage im Verlauf – die Felder mit Namen und lesbar, wie ChurchTools sie dort ablegt. */
export function absage(m: MitgliedRoh, am: string, von: number): VerlaufRoh {
  const fields: Record<string, unknown> = {};
  for (const f of m.fields ?? []) {
    const feld = FELDER.get(Number(f.id))!;
    const o = feld.options?.find((x) => String(x.id) === String(f.value));
    fields[feld.name] = o ? o.name : f.value;
  }
  return {
    memberId: m.personId,
    previous: { membershipStatus: m.groupMemberStatus, fields },
    current: { membershipStatus: null, fields: null },
    meta: { createdDate: `${am}T12:00:00Z`, createdPerson: { id: von } },
  };
}

export const PERSONEN = new Map<number, PersonDaten>([
  [10, { name: 'Jonas Beispiel', email: 'maria@beispiel.test', geburtstag: '2017-05-01' }],
  [11, { name: 'Lena Beispiel', email: 'maria@beispiel.test', geburtstag: '2019-02-02' }],
]);
export const stand = (roh: MitgliedRoh[], verlauf: VerlaufRoh[] = []) =>
  mitgliederstandAus(roh, verlauf, FELDER, new Set([35]), PERSONEN);
