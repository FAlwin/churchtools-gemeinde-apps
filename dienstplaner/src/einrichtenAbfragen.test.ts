import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import type { AbfragenInhalt } from '@shared/dienstplan/abfragen';
import { standardInhalt, type AbfragenStand } from '@shared/dienstplan/abfragenSpeicher';
import { einrichten, lageLesen, type EinrichtenAnschluss } from './einrichtenAbfragen';

/**
 * **Erinnerungen in ChurchTools einrichten** (R-5a): der Schreibteil gegen eine nachgebaute ChurchTools-Welt. Die Regeln
 * (Planer-Liste, Soll/Ist) prüft `abfrageAutomatik.test.ts`; hier geht es um den Ablauf: Reihenfolge, Nachlesen, Fehlerzweige
 * (jeder einzeln) und Wiederholen ohne Doppel.
 */
const MUSIK = { id: 4, name: 'Musik' };
const GRUPPEN_IDS = [21];
const TYP = 13;
const R_TEILNEHMER = 52;
const R_LEITER = 55;
const AUTH_SEHEN = 1104;
const AUTH_BEARBEITEN = 1112;
const R_CT_LEITER = 16;
const R_CT_MITARBEITER = 17;
const GNAME = 'Dienstplaner: Antwort fehlt – Musik';
const RNAME = 'Dienstplaner: Erinnerungen Musik';

interface Gruppe {
  id: number;
  name: string;
  typ: number;
  status: number;
  note: string | null;
  autoAccept: boolean;
}
interface Routine {
  id: number;
  gruppe: number;
  rolle: number;
  name: string;
  isEnabled: boolean;
}
interface Mitglied {
  gruppe: number;
  person: number;
  rolle: number;
}

/** Was man in einem Test schief gehen lassen kann. */
interface Stoerung {
  /** Dieser Aufruf (`METHODE pfad`) wirft. */
  wirft?: { auf: string; fehler: unknown };
  /** ChurchTools sagt 200 und übernimmt nichts: `'routine'`, `'autoAccept'`, `'rechte'`, `'note'`. */
  schluckt?: Set<string>;
  /** Ein `PUT` auf ein Recht ERSETZT die bisherigen `dataId`s dieses Rechts (statt eine hinzuzufügen) – ungemessen, deshalb geprüft. */
  ersetzt?: boolean;
}

function welt(
  o: {
    typen?: { id: number; name: string }[];
    gruppen?: Gruppe[];
    routinen?: Routine[];
    mitglieder?: Mitglied[];
    rechtPersonen?: unknown;
    /** Rechte je Person (`authId` + `dataId`), so wie `GET /permissions/person/{id}` sie liefert. */
    rechte?: Record<number, { authId: number; dataId: number }[]>;
    inhalt?: AbfragenInhalt;
    stand?: Partial<AbfragenStand>;
    konflikt?: boolean;
  } = {},
) {
  const w = {
    typen: o.typen ?? [{ id: TYP, name: 'Dienstplaner' }],
    gruppen: o.gruppen ?? [],
    routinen: o.routinen ?? [],
    mitglieder: o.mitglieder ?? [],
    // Recht „Dienste bearbeiten“ für Musik: Person 1 und 2. Leiter der CT-Gruppe 21: 2 und 3; 9 ist nur Mitarbeiter.
    rechtPersonen: o.rechtPersonen ?? {
      authId: 305,
      selections: [{ dataId: 4, personIds: [1, 2] }],
    },
    ctGruppe: [
      { personId: 2, person: { title: 'Bea Beispiel' }, groupTypeRoleId: R_CT_LEITER },
      { personId: 3, person: { title: 'Carl Test' }, groupTypeRoleId: R_CT_LEITER },
      { personId: 9, person: { title: 'Dora Dabei' }, groupTypeRoleId: R_CT_MITARBEITER },
    ].map((m) => ({ ...m, groupMemberStatus: 'active' })),
    rechte: Object.fromEntries(
      Object.entries(o.rechte ?? {}).map(([k, v]) => [k, v.map((x) => ({ ...x }))]),
    ) as Record<number, { authId: number; dataId: number }[]>,
    naechste: 100,
    /** Alle Aufrufe, in der Reihenfolge – `GET` ausgenommen. */
    log: [] as string[],
    stoerung: {} as Stoerung,
    gespeichert: [] as AbfragenInhalt[],
    inhalt: o.inhalt ?? standardInhalt(),
  };
  const schluckt = (was: string) => w.stoerung.schluckt?.has(was) === true;
  const pruefeWurf = (methode: string, pfad: string) => {
    if (methode !== 'GET') w.log.push(`${methode} ${pfad}`);
    const s = w.stoerung.wirft;
    if (s && s.auf === `${methode} ${pfad}`) throw s.fehler;
  };
  const gruppeRoh = (g: Gruppe) => ({
    id: g.id,
    name: g.name,
    information: { groupTypeId: g.typ, groupStatusId: g.status, note: g.note },
    settings: { autoAccept: g.autoAccept },
  });
  const mitgliedRoh = (m: Mitglied) => ({
    personId: m.person,
    person: { title: `Person ${m.person}` },
    groupTypeRoleId: m.rolle,
    groupMemberStatus: 'active',
  });
  const port: EinrichtenAnschluss['port'] = {
    holen<T>(pfad: string): Promise<T> {
      pruefeWurf('GET', pfad);
      let m: RegExpExecArray | null;
      if (pfad === '/group/grouptypes') return Promise.resolve(w.typen as T);
      if (pfad === '/group/roles')
        return Promise.resolve([
          { id: R_TEILNEHMER, groupTypeId: TYP, isLeader: false, isDefault: true },
          { id: R_LEITER, groupTypeId: TYP, isLeader: true },
          { id: R_CT_LEITER, groupTypeId: 2, isLeader: true },
          { id: R_CT_MITARBEITER, groupTypeId: 2, isLeader: false, isDefault: true },
        ] as T);
      if (pfad === '/permissions/definitions')
        return Promise.resolve({
          modules: [
            { key: 'churchservice', permissions: [{ key: 'edit servicegroup', authId: 305 }] },
          ],
        } as T);
      if (pfad === '/permissions/definitions?scope=global')
        return Promise.resolve({
          modules: [
            {
              key: 'churchgroup',
              permissions: [
                { key: 'view group', authId: AUTH_SEHEN },
                { key: 'edit group memberships of group', authId: AUTH_BEARBEITEN },
              ],
            },
          ],
        } as T);
      if ((m = /^\/permissions\/person\/(\d+)$/.exec(pfad)))
        return Promise.resolve((w.rechte[Number(m[1])] ?? []) as T);
      if (pfad === '/permissions/global/auths/305/persons?data_id=4')
        return Promise.resolve(w.rechtPersonen as T);
      if ((m = /^\/groups\/(\d+)\/members\/routines$/.exec(pfad)))
        return Promise.resolve(
          w.routinen
            .filter((r) => r.gruppe === Number(m![1]))
            .map((r) => ({
              id: r.id,
              groupId: r.gruppe,
              groupTypeRoleId: r.rolle,
              groupMemberStatus: 'active',
              routine: { name: r.name, isEnabled: r.isEnabled, steps: [] },
            })) as T,
        );
      if ((m = /^\/groups\/(\d+)$/.exec(pfad))) {
        const g = w.gruppen.find((x) => x.id === Number(m![1]));
        return g ? Promise.resolve(gruppeRoh(g) as T) : Promise.reject(new ApiError(404, 'nein'));
      }
      return Promise.reject(new Error(`unerwartet: GET ${pfad}`));
    },
    liste<T>(pfad: string): Promise<T[]> {
      pruefeWurf('GET', pfad);
      let m: RegExpExecArray | null;
      if (pfad === `/groups/${GRUPPEN_IDS[0]}/members`) return Promise.resolve(w.ctGruppe as T[]);
      if ((m = /^\/groups\/(\d+)\/members$/.exec(pfad)))
        return Promise.resolve(
          w.mitglieder.filter((x) => x.gruppe === Number(m![1])).map(mitgliedRoh) as T[],
        );
      if (pfad === `/groups?group_type_ids[]=${TYP}`)
        return Promise.resolve(w.gruppen.map(gruppeRoh) as T[]);
      return Promise.reject(new Error(`unerwartet: LISTE ${pfad}`));
    },
    schicken(pfad, methode, json): Promise<unknown> {
      pruefeWurf(methode, pfad);
      const rumpf = json as Record<string, unknown>;
      let m: RegExpExecArray | null;
      if (methode === 'PUT' && (m = /^\/permissions\/person\/(\d+)$/.exec(pfad))) {
        const person = Number(m[1]);
        const zeile = { authId: Number(rumpf.authId), dataId: (rumpf.dataId as number[])[0] };
        if (!schluckt('rechte')) {
          const alt = w.rechte[person] ?? [];
          w.rechte[person] = [
            ...(w.stoerung.ersetzt ? alt.filter((x) => x.authId !== zeile.authId) : alt),
            zeile,
          ];
        }
        return Promise.resolve({});
      }
      if (methode === 'POST' && pfad === '/groups') {
        const g: Gruppe = {
          id: w.naechste++,
          name: String(rumpf.name),
          typ: Number(rumpf.groupTypeId),
          status: Number(rumpf.groupStatusId),
          note: null,
          autoAccept: false,
        };
        w.gruppen.push(g);
        return Promise.resolve({ id: g.id });
      }
      if (methode === 'PATCH' && (m = /^\/groups\/(\d+)$/.exec(pfad))) {
        const g = w.gruppen.find((x) => x.id === Number(m![1]))!;
        if ('note' in rumpf && !schluckt('note')) g.note = String(rumpf.note);
        if ('autoAccept' in rumpf && !schluckt('autoAccept'))
          g.autoAccept = rumpf.autoAccept === true;
        return Promise.resolve({});
      }
      if (methode === 'POST' && pfad === '/routines') {
        const dc = rumpf.domainContext as { groupId: number; groupTypeRoleId: number };
        const id = w.naechste++;
        if (!schluckt('routine'))
          w.routinen.push({
            id,
            gruppe: dc.groupId,
            rolle: dc.groupTypeRoleId,
            name: String(rumpf.name),
            isEnabled: rumpf.isEnabled === true,
          });
        return Promise.resolve({ id });
      }
      if (methode === 'PATCH' && (m = /^\/routines\/(\d+)$/.exec(pfad))) {
        const r = w.routinen.find((x) => x.id === Number(m![1]))!;
        if ('isEnabled' in rumpf) r.isEnabled = rumpf.isEnabled === true;
        return Promise.resolve({});
      }
      return Promise.reject(new Error(`unerwartet: ${methode} ${pfad}`));
    },
  };
  const abfragenStand = (): AbfragenStand => ({
    inhalt: w.inhalt,
    gespeichert: { version: 7, zeit: 'z', von: { personId: 1, name: 'Alwin' }, inhalt: w.inhalt },
    unlesbar: false,
    fehler: null,
    ...o.stand,
  });
  const a: EinrichtenAnschluss = {
    port,
    mitgliedAnlegen: (gruppe, person, angaben) => {
      pruefeWurf('PUT', `/groups/${gruppe}/members/${person}`);
      w.mitglieder.push({ gruppe, person, rolle: Number(angaben.groupTypeRoleId) });
      return Promise.resolve();
    },
    mitgliedEntfernen: () => Promise.resolve(),
    mitgliedOderNichts: () => Promise.resolve(null),
    namen: (ids) => Promise.resolve(new Map(ids.map((id) => [id, `Planer ${id}`]))),
    abfragen: {
      lesen: vi.fn(() => Promise.resolve(abfragenStand())),
      speichern: vi.fn((_g, neu, von, erwartet) => {
        w.log.push(`SPEICHERN erwartet=${String(erwartet)}`);
        if (o.konflikt) return Promise.resolve({ ok: false as const, grund: 'konflikt' as const });
        w.gespeichert.push(neu);
        w.inhalt = neu;
        return Promise.resolve({
          ok: true as const,
          daten: { version: (erwartet ?? 0) + 1, zeit: 'z', von, inhalt: neu },
        });
      }),
      ich: { personId: 1, name: 'Alwin' },
    },
  };
  return { w, a };
}

const schreibend = (log: string[]) => log.filter((z) => !z.startsWith('GET'));
const zahl = (log: string[], muster: RegExp | string) =>
  log.filter((z) => (typeof muster === 'string' ? z === muster : muster.test(z))).length;

/** Beide Rechte für die Gruppe 50. */
const BEIDE = (gruppe: number) => [
  { authId: AUTH_SEHEN, dataId: gruppe },
  { authId: AUTH_BEARBEITEN, dataId: gruppe },
];

/** Eine fertig eingerichtete Welt: Gruppe 50, Routine 60, die Planer 1, 2, 3 mit beiden Rechten für 50, Einrichtung im Dokument. */
function fertigeWelt(extra: Partial<Parameters<typeof welt>[0]> = {}) {
  return welt({
    gruppen: [{ id: 50, name: GNAME, typ: TYP, status: 1, note: 'x', autoAccept: true }],
    routinen: [{ id: 60, gruppe: 50, rolle: R_TEILNEHMER, name: RNAME, isEnabled: true }],
    rechte: { 1: BEIDE(50), 2: BEIDE(50), 3: BEIDE(50) },
    inhalt: { ...standardInhalt(), einrichtung: { gruppeId: 50, routineId: 60 } },
    ...extra,
  });
}

describe('lageLesen – nur lesen, nichts schreiben', () => {
  it('nichts da: Planer aus beiden Quellen (Recht 1, 2; Leitung 2, 3) – ohne Doppel, mit Namen', async () => {
    const { w, a } = welt();
    const l = await lageLesen(MUSIK, GRUPPEN_IDS, a);
    expect(l).toMatchObject({
      art: 'bereit',
      gruppeId: null,
      gruppeName: GNAME,
      routineName: RNAME,
      fertig: false,
      plan: { gruppeAnlegen: true, routineAnlegen: true, einrichtungSchreiben: true },
    });
    if (l.art !== 'bereit') throw new Error('bereit erwartet');
    expect(l.planer.map((p) => p.id)).toEqual([1, 2, 3]);
    // Namen aus der Gruppenliste, wo es sie gibt (Bea, Carl); Person 1 kam nur über das Recht und wird nachgefragt.
    expect(l.planer.map((p) => p.name)).toEqual(['Planer 1', 'Bea Beispiel', 'Carl Test']);
    expect(schreibend(w.log)).toEqual([]);
  });

  it('alles da → fertig, nichts zu tun', async () => {
    const { a } = fertigeWelt();
    expect(await lageLesen(MUSIK, GRUPPEN_IDS, a)).toMatchObject({
      art: 'bereit',
      fertig: true,
      gruppeId: 50,
      routineId: 60,
    });
  });

  it('einem Planer fehlt ein Recht → nur er steht im Plan, mit genau dem fehlenden Recht (Name wie in ChurchTools)', async () => {
    const { w, a } = fertigeWelt({ rechte: { 1: BEIDE(50), 2: BEIDE(50), 3: [BEIDE(50)[0]] } });
    const l = await lageLesen(MUSIK, GRUPPEN_IDS, a);
    if (l.art !== 'bereit') throw new Error('bereit erwartet');
    expect(l.fertig).toBe(false);
    expect(l.rechteNachtragen).toEqual([
      {
        person: { id: 3, name: 'Carl Test' },
        fehlt: [
          { schluessel: 'bearbeiten', name: 'Gruppenmitgliedschaften einer Gruppe bearbeiten' },
        ],
      },
    ]);
    expect(l.plan).toMatchObject({ gruppeAnlegen: false, routineAnlegen: false });
    expect(schreibend(w.log)).toEqual([]);
  });

  it('Rechte für eine ANDERE Hilfsgruppe zählen nicht; -1 (alle Gruppen) zählt', async () => {
    const { a } = fertigeWelt({
      rechte: {
        1: BEIDE(77),
        2: [
          { authId: AUTH_SEHEN, dataId: -1 },
          { authId: AUTH_BEARBEITEN, dataId: -1 },
        ],
        3: BEIDE(50),
      },
    });
    const l = await lageLesen(MUSIK, GRUPPEN_IDS, a);
    if (l.art !== 'bereit') throw new Error('bereit erwartet');
    expect(l.rechteNachtragen.map((r) => r.person.id)).toEqual([1]);
  });

  it('die Rechte eines Planers in unbekannter Gestalt → Stopp, nie „hat nichts“ (nichts geschrieben)', async () => {
    const { w, a } = fertigeWelt();
    const echt = a.port.holen.bind(a.port);
    vi.spyOn(a.port, 'holen').mockImplementation((pfad: string) =>
      pfad === '/permissions/person/2' ? Promise.resolve({ unbekannt: true }) : echt(pfad),
    );
    const l = await lageLesen(MUSIK, GRUPPEN_IDS, a);
    expect(l).toMatchObject({ art: 'gestoppt', nochmal: true });
    expect((l as { text: string }).text).toContain('nicht in der erwarteten Form');
    expect(schreibend(w.log)).toEqual([]);
  });

  it('die Nummern der zwei Rechte kommen aus den Definitionen (globaler Bereich), nie als feste Zahl', async () => {
    const { a } = fertigeWelt();
    const l = await lageLesen(MUSIK, GRUPPEN_IDS, a);
    if (l.art !== 'bereit') throw new Error('bereit erwartet');
    expect(l.gruppenRechtIds).toEqual({ sehen: AUTH_SEHEN, bearbeiten: AUTH_BEARBEITEN });
  });

  it('ohne Hilfsgruppe wird nichts über Rechte gelesen (nichts zu lesen) – alle Planer bekommen beide', async () => {
    const { w, a } = welt();
    const l = await lageLesen(MUSIK, GRUPPEN_IDS, a);
    if (l.art !== 'bereit') throw new Error('bereit erwartet');
    expect(l.rechteNachtragen.map((r) => [r.person.id, r.fehlt.length])).toEqual([
      [1, 2],
      [2, 2],
      [3, 2],
    ]);
    expect(w.log).toEqual([]);
  });

  it('Gruppentyp „Dienstplaner“ fehlt → klarer Grund, nichts angelegt', async () => {
    const { w, a } = welt({ typen: [{ id: 1, name: 'Kleingruppe' }] });
    const l = await lageLesen(MUSIK, GRUPPEN_IDS, a);
    expect(l).toMatchObject({ art: 'gestoppt', nochmal: false });
    expect((l as { text: string }).text).toContain('Gruppentyp „Dienstplaner“ fehlt');
    expect((l as { text: string }).text).toContain('siehe Anleitung');
    expect(schreibend(w.log)).toEqual([]);
  });

  it.each([
    ['keine Auswahl', { fehler: 1 }],
    ['eine Liste statt der gemessenen Form', [1, 2]],
    [
      'ein Eintrag ohne Nummer',
      { authId: 305, selections: [{ dataId: 4, personIds: [1, { name: 'x' }] }] },
    ],
    [
      'kein Eintrag für diese Dienstgruppe',
      { authId: 305, selections: [{ dataId: 3, personIds: [1] }] },
    ],
  ])('Planer nicht vollständig lesbar (%s) → Stopp, nie „keine Planer“', async (_n, roh) => {
    const { w, a } = welt({ rechtPersonen: roh });
    const l = await lageLesen(MUSIK, GRUPPEN_IDS, a);
    expect(l).toMatchObject({ art: 'gestoppt', nochmal: true });
    // Der Stopp kommt von der Prüfung der Antwort – nicht zufällig von einem Absturz weiter hinten.
    expect((l as { text: string }).text).toContain('nicht in der erwarteten Form');
    expect(schreibend(w.log)).toEqual([]);
  });

  it('Abfragen-Dokument nicht lesbar → Stopp (nie auf „kein Wert“ hin schreiben)', async () => {
    const fehler = welt({ stand: { fehler: 'voruebergehend' } });
    expect(await lageLesen(MUSIK, GRUPPEN_IDS, fehler.a)).toMatchObject({
      art: 'gestoppt',
      nochmal: true,
    });
    const unlesbar = welt({ stand: { unlesbar: true } });
    expect(await lageLesen(MUSIK, GRUPPEN_IDS, unlesbar.a)).toMatchObject({
      art: 'gestoppt',
      nochmal: false,
    });
  });

  it('gespeicherte Gruppe nur bei 404 „verschwunden“ – jeder andere Lesefehler stoppt', async () => {
    const weg = welt({
      inhalt: { ...standardInhalt(), einrichtung: { gruppeId: 50, routineId: 60 } },
    });
    expect(await lageLesen(MUSIK, GRUPPEN_IDS, weg.a)).toMatchObject({
      art: 'bereit',
      verschwunden: true,
      gruppeId: null,
    });
    const aussetzer = fertigeWelt();
    aussetzer.w.stoerung.wirft = { auf: 'GET /groups/50', fehler: new ApiError(503, 'ct') };
    expect(await lageLesen(MUSIK, GRUPPEN_IDS, aussetzer.a)).toMatchObject({
      art: 'gestoppt',
      nochmal: true,
    });
  });

  it('eine Gruppe gleichen Namens im Typ wird übernommen; mehrere gleiche = Stopp mit Nummern', async () => {
    const eine = welt({
      gruppen: [{ id: 70, name: GNAME, typ: TYP, status: 1, note: null, autoAccept: false }],
    });
    expect(await lageLesen(MUSIK, GRUPPEN_IDS, eine.a)).toMatchObject({
      art: 'bereit',
      gruppeId: 70,
      uebernommen: true,
      plan: { gruppeAnlegen: false, routineAnlegen: true },
    });
    const zwei = welt({
      gruppen: [70, 71].map((id) => ({
        id,
        name: GNAME,
        typ: TYP,
        status: 1,
        note: null,
        autoAccept: false,
      })),
    });
    const l = await lageLesen(MUSIK, GRUPPEN_IDS, zwei.a);
    expect(l).toMatchObject({ art: 'gestoppt' });
    expect((l as { text: string }).text).toContain('70, 71');
  });

  it('eine fremde Routine an der Teilnehmer-Rolle bleibt unangetastet (Stopp)', async () => {
    const { w, a } = fertigeWelt({
      routinen: [
        { id: 61, gruppe: 50, rolle: R_TEILNEHMER, name: 'Meine Routine', isEnabled: true },
      ],
    });
    const l = await lageLesen(MUSIK, GRUPPEN_IDS, a);
    expect(l).toMatchObject({ art: 'gestoppt', nochmal: false });
    expect((l as { text: string }).text).toContain('Meine Routine');
    expect(schreibend(w.log)).toEqual([]);
  });
});

describe('einrichten', () => {
  it('nichts da → Gruppe, Beschreibung, „automatisch annehmen“, Routine, Dokument, dann die Leiter – alles nachgelesen', async () => {
    const { w, a } = welt();
    const r = await einrichten(MUSIK, GRUPPEN_IDS, a);
    expect(r).toMatchObject({ art: 'gelaufen', ok: true, fehler: null });
    // Die Welt ist so, wie sie sein soll.
    const g = w.gruppen[0];
    expect(g).toMatchObject({ name: GNAME, typ: TYP, status: 1, autoAccept: true });
    expect(g.note).toContain('Musik');
    expect(g.note).toContain('trägt Personen ein und wieder aus');
    expect(w.routinen).toEqual([
      { id: expect.any(Number), gruppe: g.id, rolle: R_TEILNEHMER, name: RNAME, isEnabled: true },
    ]);
    // Planer wie alle: keine Leiter-Rolle, keine Mitgliedschaft – zwei Rechte je Planer, nur für diese Gruppe.
    expect(w.mitglieder).toEqual([]);
    for (const person of [1, 2, 3]) expect(w.rechte[person]).toEqual(BEIDE(g.id));
    expect(w.gespeichert).toHaveLength(1);
    expect(w.gespeichert[0].einrichtung).toEqual({ gruppeId: g.id, routineId: w.routinen[0].id });
    // Der Bericht nennt, was angelegt wurde.
    expect((r as { angelegt: string[] }).angelegt.join(' | ')).toContain(
      `Gruppe „${GNAME}“ angelegt`,
    );
    expect((r as { angelegt: string[] }).angelegt.join(' | ')).toContain('Routine');
    expect((r as { angelegt: string[] }).angelegt.join(' | ')).toContain(
      `Rechte für Planer 1: Gruppe inkl. ihrer Gruppenmitglieder sehen, Gruppenmitgliedschaften einer Gruppe bearbeiten (nur für „${GNAME}“)`,
    );
  });

  it('die Rechte: PUT je fehlendem Recht mit Gruppe als dataId, type grant und dem Grund = Name der Routine', async () => {
    const { a } = welt();
    const schicken = vi.spyOn(a.port, 'schicken');
    await einrichten(MUSIK, GRUPPEN_IDS, a);
    const puts = schicken.mock.calls.filter((c) => /^\/permissions\/person\//.test(c[0]));
    expect(puts).toHaveLength(6);
    expect(puts[0]).toEqual([
      '/permissions/person/1',
      'PUT',
      { authId: AUTH_SEHEN, dataId: [100], type: 'grant', reason: RNAME },
    ]);
    expect(puts[1][2]).toMatchObject({ authId: AUTH_BEARBEITEN, dataId: [100] });
  });

  it('gelesen wird VOR und NACH dem Schreiben je Planer (Beleg statt Zusage)', async () => {
    const { w, a } = fertigeWelt({ rechte: { 1: BEIDE(50), 2: BEIDE(50), 3: [] } });
    const gelesen: string[] = [];
    const echt = a.port.holen.bind(a.port);
    vi.spyOn(a.port, 'holen').mockImplementation((pfad: string) => {
      if (pfad === '/permissions/person/3') gelesen.push(`GET ${w.rechte[3].length}`);
      return echt(pfad);
    });
    expect(await einrichten(MUSIK, GRUPPEN_IDS, a)).toMatchObject({ ok: true });
    // Lage (0), vor dem Schreiben (0), nach dem Schreiben (2).
    expect(gelesen).toEqual(['GET 0', 'GET 0', 'GET 2']);
  });

  it('ein ERSETZENDES PUT, das ein Recht für eine andere Hilfsgruppe kostet, bricht ab und sagt es', async () => {
    // Planer 3 plant zwei Dienstgruppen: Er hat „sehen“ schon für die Gruppe 77. Ersetzt das PUT, wäre 77 weg.
    const { w, a } = fertigeWelt({
      rechte: { 1: BEIDE(50), 2: BEIDE(50), 3: [{ authId: AUTH_SEHEN, dataId: 77 }] },
    });
    w.stoerung.ersetzt = true;
    const r = await einrichten(MUSIK, GRUPPEN_IDS, a);
    expect(r).toMatchObject({ art: 'gelaufen', ok: false, fehler: { nochmal: false } });
    expect((r as { fehler: { text: string } }).fehler.text).toContain('ersetzt');
    expect((r as { fehler: { text: string } }).fehler.text).toContain(
      'Gruppe inkl. ihrer Gruppenmitglieder sehen',
    );
  });

  it('ein hinzufügendes PUT lässt die Rechte anderer Hilfsgruppen stehen – der Lauf gelingt', async () => {
    const { w, a } = fertigeWelt({
      rechte: { 1: BEIDE(50), 2: BEIDE(50), 3: [{ authId: AUTH_SEHEN, dataId: 77 }] },
    });
    expect(await einrichten(MUSIK, GRUPPEN_IDS, a)).toMatchObject({ ok: true });
    expect(w.rechte[3]).toEqual(
      expect.arrayContaining([
        { authId: AUTH_SEHEN, dataId: 77 },
        { authId: AUTH_SEHEN, dataId: 50 },
        { authId: AUTH_BEARBEITEN, dataId: 50 },
      ]),
    );
  });

  it('Leiter aus früheren Probe-Einrichtungen werden nicht angefasst – weder ausgetragen noch umgestellt', async () => {
    const { w, a } = fertigeWelt({
      mitglieder: [
        { gruppe: 50, person: 1, rolle: R_LEITER },
        { gruppe: 50, person: 8, rolle: R_LEITER },
        { gruppe: 50, person: 2, rolle: R_TEILNEHMER },
      ],
    });
    expect(await einrichten(MUSIK, GRUPPEN_IDS, a)).toMatchObject({ ok: true });
    expect(schreibend(w.log)).toEqual([]);
    expect(w.mitglieder).toHaveLength(3);
  });

  it('Reihenfolge: Dokument erst NACH Gruppe und Routine, die Leiter danach; Version wie gelesen', async () => {
    const { w, a } = welt();
    await einrichten(MUSIK, GRUPPEN_IDS, a);
    const i = (m: RegExp | string) =>
      w.log.findIndex((z) => (typeof m === 'string' ? z === m : m.test(z)));
    expect(i('POST /groups')).toBeGreaterThanOrEqual(0);
    expect(i('POST /groups')).toBeLessThan(i('POST /routines'));
    expect(i('POST /routines')).toBeLessThan(i(/^SPEICHERN/));
    expect(i(/^SPEICHERN/)).toBeLessThan(i(/^PUT /));
    expect(w.log.find((z) => z.startsWith('SPEICHERN'))).toBe('SPEICHERN erwartet=7');
  });

  it('der Rumpf der Gruppe: Name, Gruppentyp, Status aktiv, ohne Obergruppe', async () => {
    const { a } = welt();
    const schicken = vi.spyOn(a.port, 'schicken');
    await einrichten(MUSIK, GRUPPEN_IDS, a);
    expect(schicken).toHaveBeenCalledWith('/groups', 'POST', {
      name: GNAME,
      groupTypeId: TYP,
      groupStatusId: 1,
    });
    const routine = schicken.mock.calls.find((c) => c[0] === '/routines')![2] as {
      domainContext: unknown;
      isEnabled: boolean;
    };
    // Eine Routine ohne Schritte (R-5b füllt sie), an der Teilnehmer-Rolle, eingeschaltet.
    expect(routine).toMatchObject({
      name: RNAME,
      domainType: 'group_membership',
      isEnabled: true,
      domainContext: { groupTypeRoleId: R_TEILNEHMER, groupMemberStatus: 'active' },
    });
    expect(routine).not.toHaveProperty('steps');
  });

  it('alles da → es wird nichts geschrieben', async () => {
    const { w, a } = fertigeWelt();
    expect(await einrichten(MUSIK, GRUPPEN_IDS, a)).toMatchObject({ ok: true, angelegt: [] });
    expect(schreibend(w.log)).toEqual([]);
  });

  it('einem Planer fehlt ein Recht → nur dieses wird nachgetragen, keine zweite Gruppe, keine zweite Routine', async () => {
    const { w, a } = fertigeWelt({ rechte: { 1: BEIDE(50), 2: BEIDE(50), 3: [BEIDE(50)[0]] } });
    const r = await einrichten(MUSIK, GRUPPEN_IDS, a);
    expect(r).toMatchObject({ ok: true });
    expect(schreibend(w.log)).toEqual(['PUT /permissions/person/3']);
    expect(w.rechte[3]).toEqual(BEIDE(50));
    expect(w.gruppen).toHaveLength(1);
    expect(w.routinen).toHaveLength(1);
  });

  it('Gruppentyp fehlt → nichts geschrieben', async () => {
    const { w, a } = welt({ typen: [] });
    expect(await einrichten(MUSIK, GRUPPEN_IDS, a)).toMatchObject({ art: 'gestoppt' });
    expect(schreibend(w.log)).toEqual([]);
    expect(w.gespeichert).toEqual([]);
  });

  describe('Nachlesen – ohne Beleg kein „eingerichtet“', () => {
    it('ChurchTools sagt „Routine angelegt“ und übernimmt nichts → Fehler, das Dokument bleibt unberührt', async () => {
      const { w, a } = welt();
      w.stoerung.schluckt = new Set(['routine']);
      const r = await einrichten(MUSIK, GRUPPEN_IDS, a);
      expect(r).toMatchObject({ art: 'gelaufen', ok: false });
      expect((r as { fehler: { text: string } }).fehler.text).toContain('Routine');
      expect(w.gespeichert).toEqual([]);
      expect(zahl(w.log, /^PUT /)).toBe(0);
    });

    it('„Anfragen automatisch annehmen“ wird nicht übernommen → Fehler, keine Routine, kein Dokument', async () => {
      const { w, a } = welt();
      w.stoerung.schluckt = new Set(['autoAccept']);
      const r = await einrichten(MUSIK, GRUPPEN_IDS, a);
      expect(r).toMatchObject({ ok: false });
      expect(zahl(w.log, 'POST /routines')).toBe(0);
      expect(w.gespeichert).toEqual([]);
    });

    it('die Beschreibung wird nicht übernommen → Fehler', async () => {
      const { w, a } = welt();
      w.stoerung.schluckt = new Set(['note']);
      expect(await einrichten(MUSIK, GRUPPEN_IDS, a)).toMatchObject({ ok: false });
      expect(w.gespeichert).toEqual([]);
    });

    it('ein Recht steht nachgelesen nicht da → Fehler mit dem Namen des Planers, kein Erfolg', async () => {
      const { w, a } = welt();
      w.stoerung.schluckt = new Set(['rechte']);
      const r = await einrichten(MUSIK, GRUPPEN_IDS, a);
      expect(r).toMatchObject({ art: 'gelaufen', ok: false });
      expect((r as { fehler: { text: string } }).fehler.text).toContain('Planer 1');
    });

    it('eine Gruppe im Entwurf-Status führt keine Routinen aus → Stopp vor der Routine', async () => {
      const { w, a } = welt({
        gruppen: [{ id: 70, name: GNAME, typ: TYP, status: 2, note: null, autoAccept: false }],
      });
      const r = await einrichten(MUSIK, GRUPPEN_IDS, a);
      expect(r).toMatchObject({ ok: false });
      expect((r as { fehler: { text: string } }).fehler.text).toContain('nicht aktiv');
      expect(zahl(w.log, 'POST /routines')).toBe(0);
    });

    it('eine ausgeschaltete Routine wird eingeschaltet und nachgelesen', async () => {
      const { w, a } = fertigeWelt();
      w.routinen[0].isEnabled = false;
      expect(await einrichten(MUSIK, GRUPPEN_IDS, a)).toMatchObject({ ok: true });
      expect(w.routinen[0].isEnabled).toBe(true);
      expect(schreibend(w.log)).toEqual(['PATCH /routines/60']);
    });
  });

  describe('vorübergehende Fehler – nichts zerstört, nichts automatisch wiederholt, die Meldung nennt das Angelegte', () => {
    it('503 bei der Routine: Gruppe steht, genau EIN Versuch, Meldung nennt die Gruppe', async () => {
      const { w, a } = welt();
      w.stoerung.wirft = { auf: 'POST /routines', fehler: new ApiError(503, 'ct') };
      const r = await einrichten(MUSIK, GRUPPEN_IDS, a);
      expect(r).toMatchObject({ art: 'gelaufen', ok: false });
      const f = r as { fehler: { nochmal: boolean }; angelegt: string[] };
      expect(f.fehler.nochmal).toBe(true);
      expect(f.angelegt.join(' ')).toContain(`Gruppe „${GNAME}“ angelegt`);
      expect(zahl(w.log, 'POST /routines')).toBe(1);
      expect(w.gruppen).toHaveLength(1);
      expect(w.gespeichert).toEqual([]);
    });

    it('Netzfehler (kein ApiError) mitten in den Rechten: das Dokument steht, der Rest ist offen, nichts entfernt', async () => {
      const { w, a } = welt();
      w.stoerung.wirft = {
        auf: 'PUT /permissions/person/2',
        fehler: new TypeError('Failed to fetch'),
      };
      const r = await einrichten(MUSIK, GRUPPEN_IDS, a);
      expect(r).toMatchObject({ ok: false, fehler: { nochmal: true } });
      expect(w.gespeichert).toHaveLength(1);
      expect(w.rechte[1]).toEqual(BEIDE(100));
      expect(w.rechte[2]).toBeUndefined();
      expect(w.rechte[3]).toBeUndefined();
      expect(zahl(w.log, /^PUT \/permissions/)).toBe(3);
    });

    it('Wiederholen nach dem Abbruch übernimmt die Gruppe und die Routine – nichts doppelt', async () => {
      const { w, a } = welt();
      w.stoerung.wirft = { auf: 'POST /routines', fehler: new ApiError(504, 'ct') };
      await einrichten(MUSIK, GRUPPEN_IDS, a);
      w.stoerung.wirft = undefined;
      // Das Dokument kennt die Gruppe nicht (nie gespeichert) – gefunden wird sie über Namen und Typ.
      const zweite = await einrichten(MUSIK, GRUPPEN_IDS, a);
      expect(zweite).toMatchObject({ ok: true });
      expect(w.gruppen).toHaveLength(1);
      expect(w.routinen).toHaveLength(1);
      expect(zahl(w.log, 'POST /groups')).toBe(1);
      for (const person of [1, 2, 3]) expect(w.rechte[person]).toEqual(BEIDE(100));
    });

    it('Abbruch NACH dem Anlegen der Routine (vor dem Dokument): die Wiederholung übernimmt auch sie', async () => {
      const { w, a } = welt();
      vi.mocked(a.abfragen.speichern).mockResolvedValueOnce({ ok: false, grund: 'voruebergehend' });
      const r = await einrichten(MUSIK, GRUPPEN_IDS, a);
      expect(r).toMatchObject({ ok: false, fehler: { nochmal: true } });
      expect((r as { angelegt: string[] }).angelegt.join(' ')).toContain('Routine');
      const zweite = await einrichten(MUSIK, GRUPPEN_IDS, a);
      expect(zweite).toMatchObject({ ok: true });
      expect(zahl(w.log, 'POST /routines')).toBe(1);
      expect(w.gespeichert).toHaveLength(1);
    });

    it('Konflikt beim Speichern: nichts überschrieben, die Meldung sagt, dass Gruppe und Routine stehen; keine Rechte', async () => {
      const { w, a } = welt({ konflikt: true });
      const r = await einrichten(MUSIK, GRUPPEN_IDS, a);
      expect(r).toMatchObject({ ok: false });
      expect((r as { fehler: { text: string } }).fehler.text).toContain(
        'Gruppe und Routine stehen',
      );
      expect(zahl(w.log, /^PUT /)).toBe(0);
      expect(w.gespeichert).toEqual([]);
    });
  });

  describe('verschwundene Gruppe, Hinweise', () => {
    it('Gruppe weg (404): eine neue wird angelegt und es wird gemeldet', async () => {
      const { w, a } = welt({
        inhalt: { ...standardInhalt(), einrichtung: { gruppeId: 50, routineId: 60 } },
      });
      const r = await einrichten(MUSIK, GRUPPEN_IDS, a);
      expect(r).toMatchObject({ ok: true });
      expect((r as { hinweise: string[] }).hinweise.join(' ')).toContain(
        'gibt es in ChurchTools nicht mehr',
      );
      expect(w.gespeichert[0].einrichtung?.gruppeId).toBe(w.gruppen[0].id);
    });
  });
});
