/**
 * **Eine Anmeldung so einrichten, dass ChurchTools Anmeldungen annimmt** (A6-2, #548) – ohne Oberfläche.
 * Gemessen 14.10.2026 (`messung-a6-2026-10-14.md`): ChurchTools nimmt erst an, wenn die Gruppe eine **Leitung**
 * hat und **Vorgaben für neue Personen** (Status, Standort, Bereich) stehen; welche Bedingung fehlt, sagt
 * `signUpConditions` in `/publicgroups/{id}`.
 */

/** Ein Eintrag der Stammdaten (`/statuses`, `/campuses`, `/departments`). */
export interface Stammdatum {
  id: number;
  name: string;
  nameTranslated?: string | null;
  isMember?: boolean;
}

export interface Stammdaten {
  status: Stammdatum[];
  standorte: Stammdatum[];
  bereiche: Stammdatum[];
}

/** Was neue Personen bekommen, die sich anmelden. */
export interface NeuePersonVorgaben {
  statusId: number;
  campusId: number;
  departmentId: number;
}

/** Der lesbare Name eines Stammdatums. */
export function stammName(s: Stammdatum): string {
  return (s.nameTranslated ?? '').trim() || s.name;
}

/**
 * **Der Vorschlag** (Alwin, 14.10.2026: „einmal je Gemeinde“, Vorschlag Interessent + einziger Standort/Bereich):
 * Status „Interessent“ (`status.potential`), Standort und Bereich nur, wenn es genau einen gibt. Was sich nicht
 * eindeutig vorschlagen lässt, bleibt offen – dann muss ein Gruppen-Admin es festlegen.
 */
export function vorgabenVorschlag(s: Stammdaten): Partial<NeuePersonVorgaben> {
  const v: Partial<NeuePersonVorgaben> = {};
  const interessent = s.status.find((x) => x.name === 'status.potential' && !x.isMember);
  if (interessent) v.statusId = interessent.id;
  if (s.standorte.length === 1) v.campusId = s.standorte[0].id;
  if (s.bereiche.length === 1) v.departmentId = s.bereiche[0].id;
  return v;
}

export function vorgabenVollstaendig(
  v: Partial<NeuePersonVorgaben> | null | undefined,
): v is NeuePersonVorgaben {
  return (
    !!v &&
    typeof v.statusId === 'number' &&
    typeof v.campusId === 'number' &&
    typeof v.departmentId === 'number'
  );
}

/** Die Vorgaben als Satz: „Interessent · Zentrale · Gemeindeliste“. */
export function vorgabenText(v: NeuePersonVorgaben, s: Stammdaten): string {
  const n = (liste: Stammdatum[], id: number) => {
    const x = liste.find((y) => y.id === id);
    return x ? stammName(x) : `Nr. ${id}`;
  };
  return [n(s.status, v.statusId), n(s.standorte, v.campusId), n(s.bereiche, v.departmentId)].join(
    ' · ',
  );
}

/**
 * Was eine fehlende Bedingung bedeutet – in Worten des Teams. Abgeleitete Angaben (`canSignUp`, `canContactLeader`
 * …) stehen hier nicht: Sie fehlen nur, weil etwas anderes fehlt.
 */
const BEDINGUNG: Record<string, string> = {
  groupIsActive: 'Die Veranstaltung ist nicht freigegeben.',
  groupIsPublic: 'Die Veranstaltung ist nicht öffentlich.',
  groupIsNotHidden: 'Die Gruppe ist in ChurchTools ausgeblendet.',
  groupIsOpenForMembers: 'Der Anmeldezeitraum hat noch nicht begonnen oder ist vorbei.',
  endDateNotPassed: 'Der Anmeldezeitraum ist vorbei.',
  groupHasLeader: 'Die Gruppe hat keine Leitung.',
  atLeastOneLeaderCanCreateNewPerson:
    'Niemand aus der Leitung darf in ChurchTools neue Personen anlegen.',
  newPersonStationIsSet: 'Für neue Personen fehlt der Standort.',
  newPersonStatusIsSet: 'Für neue Personen fehlt der Status.',
  newPersonDepartmentIsSet: 'Für neue Personen fehlt der Bereich.',
  signUpRoleSetInGroup: 'In der Gruppe fehlt die Rolle für Teilnehmende.',
  groupIsNotFull: 'Alle Plätze sind belegt (ohne Warteliste).',
};
const ABGELEITET = new Set([
  'canSignUp',
  'canSignUpAsNewPerson',
  'canContactLeader',
  'groupHasSpaceForRequests',
  'groupAllowsWaitinglist',
  'groupHasSpaceOnWaitinglist',
  'defaultRoleSetInGroup',
]);

/** **Was ChurchTools noch fehlt**, als Sätze. Leer = Anmeldungen werden angenommen. */
export function fehlendeBedingungen(c: Record<string, unknown> | null | undefined): string[] {
  if (!c) return [];
  // Voll, aber mit Warteliste: Anmeldungen kommen auf die Warteliste – das ist kein Fehler.
  const warteliste = c.groupAllowsWaitinglist === true && c.groupHasSpaceOnWaitinglist !== false;
  return Object.entries(c)
    .filter(([k, v]) => v === false && !ABGELEITET.has(k))
    .filter(([k]) => !(k === 'groupIsNotFull' && warteliste))
    .map(([k]) => BEDINGUNG[k] ?? `ChurchTools meldet: ${k}`);
}
