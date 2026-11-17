/**
 * Gemeinsame Testdaten für das Fenster „Gruppenwechsel einrichten“ (O9-5c-2): eine Einrichtung, der Stand, den
 * ChurchTools dazu zurückgibt – **aus den Erzeugern**, nicht von Hand –, und ein `Start`.
 */
import {
  alleRegeln,
  aufraeumRoutine,
  GRUNDWERTE,
  LEITER_RECHTE,
  uebergaenge,
} from '@shared/organigramm/gruppenwechsel';
import { einrichtungAus, type Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import type { EinrichtungDaten, Gelesen } from '@shared/organigramm/einrichtungStand';
import type { OrgRechte } from '@shared/organigramm/rechte';
import type { Knoten } from '@shared/organigramm/gruppen';
import type { Start } from './start';

export const SCHAEFCHEN = 1;
export const FISCHE = 2;
export const JUNGSCHAR = 3;
export const TEENY = 4;
export const BEREICH = 9;

export const EINRICHTUNG: Einrichtung = einrichtungAus({
  einstellung: {
    ...GRUNDWERTE,
    stufen: [
      { gruppeId: SCHAEFCHEN, name: 'Schäfchen', abAlter: 4 },
      { gruppeId: FISCHE, name: 'Fische', abAlter: 7 },
      { gruppeId: JUNGSCHAR, name: 'Jungschar', abAlter: 10 },
    ],
  },
  bereichGruppeId: BEREICH,
  wechselGruppen: [
    { vonGruppeId: SCHAEFCHEN, nachGruppeId: FISCHE, gruppeId: 11 },
    { vonGruppeId: FISCHE, nachGruppeId: JUNGSCHAR, gruppeId: 12 },
  ],
})!;

const ROLLEN = { teilnehmer: 45, leiter: 48 };
const ok = <T>(wert: T): Gelesen<T> => ({ ok: true, wert });
const rollenRoh = [
  { groupTypeRoleId: ROLLEN.leiter, type: 'leader' },
  { groupTypeRoleId: ROLLEN.teilnehmer, type: 'participant' },
];

/** Was „Einrichten“ hinterlässt, wie ChurchTools es zurückgibt. */
export function gutesStand(): EinrichtungDaten {
  const e = EINRICHTUNG;
  const regeln = alleRegeln(
    e.einstellung,
    [],
    new Map(e.wechselGruppen.map((w) => [w.vonGruppeId, w.gruppeId])),
    ROLLEN,
    new Map(e.einstellung.stufen.map((s) => [s.gruppeId, ROLLEN.teilnehmer])),
  );
  const routine = (u: ReturnType<typeof uebergaenge>[number], w: number) => {
    const { neu, schritte } = aufraeumRoutine(u, w, ROLLEN, e.einstellung);
    return {
      groupId: w,
      groupTypeRoleId: neu.domainContext.groupTypeRoleId,
      groupMemberStatus: neu.domainContext.groupMemberStatus,
      routine: { name: neu.name, isEnabled: true, steps: schritte },
    };
  };
  const [u1, u2] = uebergaenge(e.einstellung);
  return {
    rollen: new Map([
      [11, ok(rollenRoh)],
      [12, ok(rollenRoh)],
    ]),
    rechte: {
      leiter: ok(LEITER_RECHTE.map((r) => ({ ...r, isInherited: false }))),
      teilnehmer: ok([]),
    },
    gruppen: new Map(
      [...regeln].map(([id, r]) => [id, { regeln: ok(r), status: ok('active') }] as const),
    ),
    routinen: new Map([
      [11, ok([routine(u1, 11)])],
      [12, ok([routine(u2, 12)])],
    ]),
  };
}

const g = (id: number, name: string, kinder: Knoten[] = []): Knoten => ({
  gruppe: { id, name, typId: 7, statusId: 1, farbe: null },
  kinder,
});

/** Die sichtbaren Gruppen: „Kinder & Jugend“ mit den drei Stufen, daneben „Teeny“ und „Gottesdienst“. */
export const BAUM: Knoten[] = [
  g(BEREICH, 'Kinder & Jugend', [
    g(SCHAEFCHEN, 'Schäfchen'),
    g(FISCHE, 'Fische'),
    g(JUNGSCHAR, 'Jungschar'),
    g(TEENY, 'Teeny'),
  ]),
  g(20, 'Gottesdienst'),
];

const flach = (ks: Knoten[]): Knoten['gruppe'][] =>
  ks.flatMap((k) => [k.gruppe, ...flach(k.kinder)]);

export const rechte = (rechteVerwalten: boolean): OrgRechte => ({
  gruppenVerwalten: true,
  rechteVerwalten,
  anlegbareTypen: [],
  bearbeitbareGruppen: [],
  bearbeitbareTypen: [],
  mitgliederAlle: false,
  mitgliederGruppen: [],
  mitgliederTypen: [],
});

export const START = {
  rollen: new Map(),
  baum: BAUM,
  gruppen: [
    ...flach(BAUM),
    { id: 11, name: 'Schäfchen → Fische', typId: 20, statusId: 1, farbe: null },
    { id: 12, name: 'Fische → Jungschar', typId: 20, statusId: 1, farbe: null },
  ],
  eltern: new Map([
    [11, [BEREICH]],
    [12, [BEREICH]],
  ]),
  typNamen: new Map([[20, 'Gruppenwechsel']]),
  rechte: rechte(true),
} as unknown as Start;
