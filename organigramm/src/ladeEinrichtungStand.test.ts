import { describe, expect, it } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import {
  alleRegeln,
  aufraeumRoutine,
  GRUNDWERTE,
  LEITER_RECHTE,
  uebergaenge,
} from '@shared/organigramm/gruppenwechsel';
import { einrichtungAus, type Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import { einrichtungStand } from '@shared/organigramm/einrichtungStand';
import { ladeEinrichtungStand, statusAus } from './ladeEinrichtungStand';

const E: Einrichtung = einrichtungAus({
  einstellung: {
    ...GRUNDWERTE,
    stufen: [
      { gruppeId: 1, name: 'Schäfchen', abAlter: 4 },
      { gruppeId: 2, name: 'Fische', abAlter: 7 },
      { gruppeId: 3, name: 'Jungschar', abAlter: 10 },
    ],
  },
  bereichGruppeId: 9,
  wechselGruppen: [
    { vonGruppeId: 1, nachGruppeId: 2, gruppeId: 11 },
    { vonGruppeId: 2, nachGruppeId: 3, gruppeId: 12 },
  ],
})!;
const [U1, U2] = uebergaenge(E.einstellung);
const ROLLEN = { teilnehmer: 45, leiter: 48 };
const ROLLEN_ROH = [
  { id: 3105, groupTypeRoleId: 48, type: 'leader' },
  { id: 3102, groupTypeRoleId: 45, type: 'participant' },
];

const REGELN = alleRegeln(
  E.einstellung,
  [],
  new Map([
    [1, 11],
    [2, 12],
  ]),
  ROLLEN,
  new Map([
    [1, 45],
    [2, 45],
    [3, 45],
  ]),
);
const routineVon = (u: typeof U1, w: number) => {
  const { neu, schritte } = aufraeumRoutine(u, w, ROLLEN, E.einstellung);
  return {
    id: w,
    groupId: w,
    groupTypeRoleId: neu.domainContext.groupTypeRoleId,
    groupMemberStatus: 'active',
    routine: { name: neu.name, isEnabled: true, steps: schritte },
  };
};

/** Antwortet je Pfad aus `je`, sonst wie ChurchTools mit 404; ein `Error` wird geworfen. Merkt Pfade und Gleichzeitigkeit. */
function falsch(je: Record<string, unknown>) {
  const pfade: string[] = [];
  const lauf = { jetzt: 0, max: 0 };
  const holen = async <T>(pfad: string): Promise<T> => {
    pfade.push(pfad);
    lauf.jetzt++;
    lauf.max = Math.max(lauf.max, lauf.jetzt);
    await Promise.resolve();
    await Promise.resolve();
    lauf.jetzt--;
    const a = pfad in je ? je[pfad] : new ApiError(404, `unbekannt: ${pfad}`);
    if (a instanceof Error) throw a;
    return a as T;
  };
  return { holen, pfade, lauf };
}

/** Der Stand, wie ihn „Einrichten“ hinterlässt – als Antworten von ChurchTools. */
function gutAntworten(): Record<string, unknown> {
  const je: Record<string, unknown> = {
    '/groups/11/roles': ROLLEN_ROH,
    '/groups/12/roles': ROLLEN_ROH,
    '/permissions/group_type_role/48': LEITER_RECHTE.map((r) => ({
      authId: r.authId,
      dataId: r.dataId,
      isInherited: false,
      type: 'group',
    })),
    '/permissions/group_type_role/45': [],
    '/groups/11/members/routines': [routineVon(U1, 11)],
    '/groups/12/members/routines': [routineVon(U2, 12)],
  };
  for (const [id, regeln] of REGELN) {
    je[`/dynamicgroups/${id}/ruleset`] = regeln;
    je[`/dynamicgroups/${id}/status`] = { dynamicGroupStatus: 'manual' };
  }
  return je;
}

describe('ladeEinrichtungStand', () => {
  it('liest je Wechsel-Gruppe Rollen und Routinen, je Gruppe Regeln und Status, die Rechte beider Typ-Rollen', async () => {
    const f = falsch(gutAntworten());
    await ladeEinrichtungStand(E, f.holen);
    expect(f.pfade.sort()).toEqual(
      [
        '/groups/11/roles',
        '/groups/12/roles',
        '/groups/11/members/routines',
        '/groups/12/members/routines',
        '/permissions/group_type_role/48',
        '/permissions/group_type_role/45',
        ...[1, 2, 3, 11, 12].flatMap((id) => [
          `/dynamicgroups/${id}/ruleset`,
          `/dynamicgroups/${id}/status`,
        ]),
      ].sort(),
    );
  });

  it('drosselt: höchstens vier Gruppen zugleich (je Regeln + Status), sonst antwortet ChurchTools mit 429', async () => {
    const viele = einrichtungAus({
      einstellung: {
        ...GRUNDWERTE,
        stufen: Array.from({ length: 9 }, (_, i) => ({
          gruppeId: i + 1,
          name: `S${i + 1}`,
          abAlter: i + 4,
        })),
      },
      bereichGruppeId: 99,
      wechselGruppen: Array.from({ length: 8 }, (_, i) => ({
        vonGruppeId: i + 1,
        nachGruppeId: i + 2,
        gruppeId: 100 + i,
      })),
    })!;
    const f = falsch({});
    await ladeEinrichtungStand(viele, f.holen);
    expect(f.pfade.length).toBeGreaterThan(30); // 17 Gruppen, je zwei Abfragen – ohne Grenze wären es so viele zugleich
    expect(f.lauf.max).toBeLessThanOrEqual(8);
    expect(f.lauf.max).toBeGreaterThan(1);
  });

  it('Ende zu Ende: was „Einrichten“ hinterlässt, ergibt lauter ✓', async () => {
    const d = await ladeEinrichtungStand(E, falsch(gutAntworten()).holen);
    const z = einrichtungStand(
      E,
      {
        gruppen: [1, 2, 3, 9, 11, 12].map((id) => ({
          id,
          name: `G${id}`,
          typId: id >= 11 ? 20 : 7,
          statusId: 1,
          farbe: null,
        })),
        eltern: new Map([
          [11, [9]],
          [12, [9]],
        ]),
        typNamen: new Map([[20, 'Gruppenwechsel']]),
      },
      d,
      // Die Wechseltage prüft `ladeRegelStand` – hier nur ein beliebiger, vollständiger Stand.
      { art: 'da', staende: [{ jahr: 2027, stand: { art: 'eingetragen' } }], bis: 2028 },
      2027,
    );
    expect(z.filter((x) => x.stand.art !== 'ok').map((x) => [x.id, x.stand])).toEqual([]);
  });

  it('404 beim Regel-Abruf heißt „keine Regeln“; bei allem anderen ist 404 „nicht gelesen“', async () => {
    const je = gutAntworten();
    delete je['/dynamicgroups/11/ruleset']; // → 404
    delete je['/groups/12/members/routines'];
    delete je['/dynamicgroups/12/status'];
    const d = await ladeEinrichtungStand(E, falsch(je).holen);
    expect(d.gruppen.get(11)!.regeln).toEqual({ ok: true, wert: [] });
    expect(d.routinen.get(12)).toEqual({ ok: false });
    expect(d.gruppen.get(12)!.status).toEqual({ ok: false });
  });

  it('401, 403, Netz und 5xx werfen nicht (kein Abmelden) und werden „nicht gelesen“ – nie „leer“', async () => {
    for (const fehler of [
      new ApiError(401, 'Unauthorized'),
      new ApiError(403, 'Forbidden'),
      new ApiError(503, 'weg'),
      new TypeError('Failed to fetch'),
    ]) {
      const je = Object.fromEntries(Object.keys(gutAntworten()).map((k) => [k, fehler]));
      const d = await ladeEinrichtungStand(E, falsch(je).holen);
      expect(d.rollen.get(11)).toEqual({ ok: false });
      expect(d.routinen.get(11)).toEqual({ ok: false });
      expect(d.gruppen.get(2)).toEqual({ regeln: { ok: false }, status: { ok: false } });
      expect(d.rechte).toEqual({ leiter: { ok: false }, teilnehmer: { ok: false } });
    }
  });

  it('eine Antwort, die keine Liste ist (oder gar keine), ist „nicht gelesen“ – keine leere Liste', async () => {
    const je = {
      ...gutAntworten(),
      '/groups/11/roles': { nope: 1 },
      '/groups/12/members/routines': null,
      '/dynamicgroups/1/ruleset': 'kaputt',
    };
    const d = await ladeEinrichtungStand(E, falsch(je).holen);
    expect(d.rollen.get(11)).toEqual({ ok: false });
    expect(d.routinen.get(12)).toEqual({ ok: false });
    expect(d.gruppen.get(1)!.regeln).toEqual({ ok: false });
  });

  it('die Regel-Liste darf auch in `dynamicGroupRuleSet` stecken', async () => {
    const je = {
      ...gutAntworten(),
      '/dynamicgroups/11/ruleset': { dynamicGroupRuleSet: REGELN.get(11) },
    };
    const d = await ladeEinrichtungStand(E, falsch(je).holen);
    expect(d.gruppen.get(11)!.regeln).toEqual({ ok: true, wert: REGELN.get(11) });
  });

  it('Rechte: sind die Rollen der ersten Wechsel-Gruppe nicht lesbar, gilt die nächste; ohne lesbare Rollen wird nichts gefragt', async () => {
    const je = { ...gutAntworten(), '/groups/11/roles': new ApiError(503, 'weg') };
    const f = falsch(je);
    const d = await ladeEinrichtungStand(E, f.holen);
    expect(d.rechte.leiter.ok).toBe(true);
    const keine = falsch({
      ...gutAntworten(),
      '/groups/11/roles': new ApiError(503, 'weg'),
      '/groups/12/roles': new ApiError(503, 'weg'),
    });
    const d2 = await ladeEinrichtungStand(E, keine.holen);
    expect(d2.rechte).toEqual({ leiter: { ok: false }, teilnehmer: { ok: false } });
    expect(keine.pfade.some((p) => p.startsWith('/permissions/'))).toBe(false);
  });

  it('Rollen ohne Leiter oder Teilnehmer: keine Rechte-Abfrage auf Verdacht', async () => {
    const f = falsch({
      ...gutAntworten(),
      '/groups/11/roles': [ROLLEN_ROH[0]],
      '/groups/12/roles': [ROLLEN_ROH[0]],
    });
    const d = await ladeEinrichtungStand(E, f.holen);
    expect(d.rechte.leiter.ok).toBe(false);
    expect(f.pfade.some((p) => p.startsWith('/permissions/'))).toBe(false);
  });
});

describe('statusAus', () => {
  it('Text, `dynamicGroupStatus` oder `status`; alles andere ist unbekannt', () => {
    expect(statusAus('manual')).toBe('manual');
    expect(statusAus({ dynamicGroupStatus: 'none' })).toBe('none');
    expect(statusAus({ status: 'active' })).toBe('active');
    expect(statusAus({})).toBeNull();
    expect(statusAus(null)).toBeNull();
    expect(statusAus('')).toBeNull();
    expect(statusAus(5)).toBeNull();
  });
});
