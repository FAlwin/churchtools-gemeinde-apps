import { describe, expect, it } from 'vitest';
import {
  alleRegeln,
  aufraeumRoutine,
  GRUNDWERTE,
  LEITER_RECHTE,
  REGELN,
  uebergaenge,
  wechselGruppenName,
} from './gruppenwechsel';
import { einrichtungAus, type Einrichtung } from './gruppenwechselEinrichtung';
import type { EinrichtungDaten, Gelesen, RegelRoh } from './einrichtungStand';
import {
  darfSchreiben,
  einrichtungsPlan,
  fremdeRegeln,
  istWechselTyp,
  WECHSEL_TYP_NAME,
  type PlanIst,
  type SchrittArt,
} from './einrichtungPlan';

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

const ok = <T>(wert: T): Gelesen<T> => ({ ok: true, wert });
const NICHT: Gelesen<never> = { ok: false };
const rollenRoh = [
  { groupTypeRoleId: ROLLEN.leiter, type: 'leader' },
  { groupTypeRoleId: ROLLEN.teilnehmer, type: 'participant' },
];
const rechtZeile = (r: { authId: number; dataId: number | null }) => ({ ...r, isInherited: false });

const GRUPPEN = new Map<number, string>([
  [1, 'Schäfchen'],
  [2, 'Fische'],
  [3, 'Jungschar'],
  [9, 'Kinder & Jugend'],
  [11, 'Schäfchen → Fische'],
  [12, 'Fische → Jungschar'],
]);

/** Was „Einrichten“ hinterlässt – aus den Erzeugern, nicht von Hand. */
function gut(): EinrichtungDaten {
  const regeln = alleRegeln(
    E.einstellung,
    [],
    new Map(E.wechselGruppen.map((w) => [w.vonGruppeId, w.gruppeId])),
    ROLLEN,
    new Map(E.einstellung.stufen.map((s) => [s.gruppeId, ROLLEN.teilnehmer])),
  );
  const routine = (u: typeof U1, w: number) => {
    const { neu, schritte } = aufraeumRoutine(u, w, ROLLEN, E.einstellung);
    return {
      groupId: w,
      groupTypeRoleId: neu.domainContext.groupTypeRoleId,
      groupMemberStatus: neu.domainContext.groupMemberStatus,
      routine: { name: neu.name, isEnabled: true, steps: schritte },
    };
  };
  return {
    rollen: new Map([
      [11, ok(rollenRoh)],
      [12, ok(rollenRoh)],
    ]),
    rechte: { leiter: ok(LEITER_RECHTE.map(rechtZeile)), teilnehmer: ok([]) },
    gruppen: new Map(
      [...regeln].map(([id, r]) => [id, { regeln: ok(r), status: ok('active') }] as const),
    ),
    routinen: new Map([
      [11, ok([routine(U1, 11)])],
      [12, ok([routine(U2, 12)])],
    ]),
    sichtbarkeit: new Map([
      [11, ok('restricted')],
      [12, ok('restricted')],
    ]),
  };
}

const ist = (o: Partial<PlanIst> = {}): PlanIst => ({
  typ: ok(true),
  alt: E,
  gruppen: GRUPPEN,
  stand: gut(),
  jahre: [2027, 2028, 2029],
  ...o,
});
const erstes = (o: Partial<PlanIst> = {}): PlanIst =>
  ist({ typ: ok(false), alt: null, stand: null, gruppen: new Map([...GRUPPEN].slice(0, 4)), ...o });

const zeile = (p: ReturnType<typeof einrichtungsPlan>, id: string) =>
  p.zeilen.find((z) => z.id === id)!;
const arten = (p: ReturnType<typeof einrichtungsPlan>): SchrittArt[] =>
  p.schritte.map((s) => s.art);

describe('einrichtungsPlan – erstes Einrichten', () => {
  const p = einrichtungsPlan(E, erstes());

  it('alles neu: Typ, Rechte, Wechsel-Gruppen, Routinen, Regeln', () => {
    expect(p.zeilen.map((z) => [z.id, z.art])).toEqual([
      ['typ', 'neu'],
      ['rechte', 'neu'],
      ['wechselGruppen', 'neu'],
      ['routinen', 'neu'],
      ['regeln', 'neu'],
    ]);
    expect(p.unsicher).toEqual([]);
  });

  it('die Zahlen und Namen kommen aus den Erzeugern', () => {
    expect(zeile(p, 'typ').titel).toBe(`Gruppentyp „${WECHSEL_TYP_NAME}“`);
    expect(zeile(p, 'wechselGruppen').titel).toBe('2 Wechsel-Gruppen unter „Kinder & Jugend“');
    expect(zeile(p, 'wechselGruppen').text).toContain(
      uebergaenge(E.einstellung).map(wechselGruppenName).join(', '),
    );
    expect(zeile(p, 'routinen').text).toContain(`${E.einstellung.aufraeumenTage} Tage`);
    // 3 Stufen + 2 Wechsel-Gruppen
    expect(zeile(p, 'regeln').titel).toBe('Regeln in 5 Gruppen');
    expect(zeile(p, 'regeln').text).toContain('2027, 2028 und 2029');
  });

  it('die Rechte der Leiter-Rolle sind genau die Namen aus LEITER_RECHTE', () => {
    expect(zeile(p, 'rechte').rechte).toEqual(LEITER_RECHTE.map((r) => r.name));
  });

  it('die Reihenfolge der Messung O9-5a: Typ → Rechte → Wechsel-Gruppen → Routinen → Regeln → Status → Regeln der Stufen → Status → neu berechnen → speichern', () => {
    expect(arten(p)).toEqual([
      'typ',
      'rechte',
      'wechselGruppe',
      'wechselGruppe',
      'routine',
      'routine',
      'regelnWechselGruppe',
      'regelnWechselGruppe',
      'statusWechselGruppe',
      'statusWechselGruppe',
      'regelnStufe',
      'regelnStufe',
      'regelnStufe',
      'statusStufe',
      'statusStufe',
      'statusStufe',
      'neuBerechnen',
      'neuBerechnen',
      'speichern',
    ]);
    expect(p.schritte.every((s) => s.aktion !== undefined)).toBe(true);
  });

  it('die Wechsel-Gruppe eines Übergangs hat noch keine Nummer, kennt aber Übergang und Namen', () => {
    const wg = p.schritte.find((s) => s.art === 'wechselGruppe')!;
    expect(wg.ziel).toEqual({
      art: 'uebergang',
      vonGruppeId: U1.von.gruppeId,
      nachGruppeId: U1.nach.gruppeId,
      name: wechselGruppenName(U1),
      gruppeId: null,
    });
  });

  it('der Typ ist da, aber noch keine Einrichtung: Typ „vorhanden“, Rechte werden ergänzt („ändern“), nie „neu“', () => {
    const q = einrichtungsPlan(E, erstes({ typ: ok(true) }));
    expect(zeile(q, 'typ').art).toBe('vorhanden');
    expect(zeile(q, 'rechte').art).toBe('aendern');
    expect(arten(q)).not.toContain('typ');
    expect(arten(q)).toContain('rechte');
  });
});

describe('einrichtungsPlan – Stufen ändern', () => {
  it('stimmt schon alles: alles „vorhanden“, die Regeln werden trotzdem (neu) geschrieben', () => {
    const p = einrichtungsPlan(E, ist());
    expect(p.zeilen.map((z) => z.art)).toEqual([
      'vorhanden',
      'vorhanden',
      'vorhanden',
      'vorhanden',
      'aendern',
    ]);
    expect(p.unsicher).toEqual([]);
    // Nichts anzulegen: keine Schritte für Typ, Rechte, Wechsel-Gruppen, Routinen und Status (läuft schon)
    expect(new Set(arten(p))).toEqual(
      new Set(['regelnWechselGruppe', 'regelnStufe', 'neuBerechnen', 'speichern']),
    );
    expect(
      p.schritte.filter((s) => s.art === 'regelnStufe').every((s) => s.aktion === 'aendern'),
    ).toBe(true);
  });

  it('eine neue Stufe am Ende: ihre Wechsel-Gruppe ist neu, die übrigen bleiben', () => {
    const neu = {
      ...E,
      einstellung: {
        ...E.einstellung,
        stufen: [...E.einstellung.stufen, { gruppeId: 4, name: 'Teeny', abAlter: 13 }],
      },
    };
    const p = einrichtungsPlan(neu, ist({ gruppen: new Map([...GRUPPEN, [4, 'Teeny']]) }));
    expect(zeile(p, 'wechselGruppen').art).toBe('aendern');
    expect(zeile(p, 'wechselGruppen').text).toContain('neu: Jungschar → Teeny');
    expect(p.schritte.filter((s) => s.art === 'wechselGruppe').map((s) => s.ziel)).toEqual([
      expect.objectContaining({ name: 'Jungschar → Teeny', gruppeId: null }),
    ]);
    // Routine nur für die neue; die vorhandenen Wechsel-Gruppen tragen ihre Nummer
    expect(p.schritte.filter((s) => s.art === 'routine')).toHaveLength(1);
    expect(
      p.schritte
        .filter((s) => s.art === 'regelnWechselGruppe')
        .map((s) => (s.ziel as { gruppeId: number | null }).gruppeId),
    ).toEqual([11, 12, null]);
  });

  it('wird eine Stufe ausgetauscht, passt die alte Wechsel-Gruppe nicht mehr (von UND nach müssen stimmen) und bleibt unberührt', () => {
    const neu = {
      ...E,
      einstellung: {
        ...E.einstellung,
        stufen: [
          E.einstellung.stufen[0],
          E.einstellung.stufen[1],
          { gruppeId: 5, name: 'Pfadfinder', abAlter: 10 },
        ],
      },
    };
    const p = einrichtungsPlan(neu, ist({ gruppen: new Map([...GRUPPEN, [5, 'Pfadfinder']]) }));
    expect(zeile(p, 'wechselGruppen').text).toContain('neu: Fische → Pfadfinder');
    expect(zeile(p, 'wechselGruppen').text).toContain(
      'Nicht mehr gebraucht und unverändert: Fische → Jungschar',
    );
  });

  it('eine Wechsel-Gruppe, die es in ChurchTools nicht mehr gibt, zählt als neu', () => {
    const ohne = new Map(GRUPPEN);
    ohne.delete(12);
    const p = einrichtungsPlan(E, ist({ gruppen: ohne }));
    expect(zeile(p, 'wechselGruppen').art).toBe('aendern');
    expect(p.schritte.find((s) => s.art === 'wechselGruppe')?.ziel).toEqual(
      expect.objectContaining({ name: wechselGruppenName(U2), gruppeId: null }),
    );
  });

  it('fehlt ein Recht, steht es im Plan und es gibt einen Schritt', () => {
    const stand = gut();
    stand.rechte = {
      leiter: ok(LEITER_RECHTE.filter((r) => r.authId !== 10102).map(rechtZeile)),
      teilnehmer: ok([]),
    };
    const p = einrichtungsPlan(E, ist({ stand }));
    expect(zeile(p, 'rechte').art).toBe('aendern');
    expect(zeile(p, 'rechte').text).toContain('„Gruppeninfos sehen“ fehlt');
    expect(arten(p)).toContain('rechte');
  });

  it('eine Routine mit anderer Wartezeit wird angepasst (ändern), eine fehlende ist neu', () => {
    const stand = gut();
    stand.routinen = new Map([
      [11, ok([])],
      [12, stand.routinen.get(12)!],
    ]);
    const p = einrichtungsPlan(
      { ...E, einstellung: { ...E.einstellung, aufraeumenTage: 120 } },
      ist({ stand }),
    );
    // 11: fehlt → neu; 12: wartet 90 statt 120 → ändern
    expect(p.schritte.filter((s) => s.art === 'routine').map((s) => s.aktion)).toEqual([
      'neu',
      'aendern',
    ]);
    expect(zeile(p, 'routinen').art).toBe('aendern');
  });

  it('Regeln, die schon laufen: kein Statusschritt; Status „none“: ein Schritt', () => {
    const stand = gut();
    const gruppen = new Map(stand.gruppen);
    gruppen.set(2, { regeln: stand.gruppen.get(2)!.regeln, status: ok('none') });
    stand.gruppen = gruppen;
    const p = einrichtungsPlan(E, ist({ stand }));
    expect(p.schritte.filter((s) => s.art === 'statusStufe').map((s) => s.ziel)).toEqual([
      expect.objectContaining({ gruppeId: 2 }),
    ]);
  });

  it('Regeln gibt es nur dort als „neu“, wo keine von uns stehen', () => {
    const stand = gut();
    const gruppen = new Map(stand.gruppen);
    gruppen.set(3, { regeln: ok([]), status: ok('none') });
    stand.gruppen = gruppen;
    const p = einrichtungsPlan(E, ist({ stand }));
    expect(
      p.schritte.find(
        (s) => s.art === 'regelnStufe' && (s.ziel as { gruppeId: number }).gruppeId === 3,
      )?.aktion,
    ).toBe('neu');
    expect(
      p.schritte.find(
        (s) => s.art === 'regelnStufe' && (s.ziel as { gruppeId: number }).gruppeId === 2,
      )?.aktion,
    ).toBe('aendern');
  });
});

describe('einrichtungsPlan – Status „aktiv“ ist das Soll (O9-5d)', () => {
  const mit = (status: string) => {
    const stand = gut();
    stand.gruppen = new Map(
      [...stand.gruppen].map(([id, g]) => [id, { ...g, status: ok(status) }] as const),
    );
    return stand;
  };

  it('„manual“ und „inactive“ rechnen nicht von selbst: Statusschritt für jede Wechsel-Gruppe und Stufe', () => {
    for (const status of ['manual', 'inactive', 'none']) {
      const p = einrichtungsPlan(E, ist({ stand: mit(status) }));
      expect(arten(p).filter((a) => a === 'statusWechselGruppe')).toHaveLength(2);
      expect(arten(p).filter((a) => a === 'statusStufe')).toHaveLength(3);
    }
  });

  it('„active“ ist schon gut: keine Statusschritte', () => {
    const p = einrichtungsPlan(E, ist({ stand: mit('active') }));
    expect(arten(p)).not.toContain('statusWechselGruppe');
    expect(arten(p)).not.toContain('statusStufe');
  });
});

describe('einrichtungsPlan – Wechsel-Gruppen müssen „eingeschränkt“ sein (Leitungen sehen versteckte nicht)', () => {
  const mit = (w11: Gelesen<string> | undefined, w12: Gelesen<string> = ok('restricted')) => {
    const stand = gut();
    const sichtbarkeit = new Map<number, Gelesen<string>>([[12, w12]]);
    if (w11) sichtbarkeit.set(11, w11);
    stand.sichtbarkeit = sichtbarkeit;
    return stand;
  };
  const schritte = (p: ReturnType<typeof einrichtungsPlan>) =>
    p.schritte.filter((s) => s.art === 'sichtbarkeitWechselGruppe');

  it('eine vorhandene Gruppe, die „hidden“ ist, bekommt einen Schritt – die eingeschränkte nicht', () => {
    const p = einrichtungsPlan(E, ist({ stand: mit(ok('hidden')) }));
    expect(schritte(p)).toEqual([
      expect.objectContaining({
        aktion: 'aendern',
        ziel: expect.objectContaining({ art: 'uebergang', gruppeId: 11 }),
      }),
    ]);
    expect(schritte(einrichtungsPlan(E, ist({ stand: mit(ok('restricted')) })))).toHaveLength(0);
  });

  it('jede andere Sichtbarkeit als „restricted“ zählt (auch „public“)', () => {
    expect(
      schritte(einrichtungsPlan(E, ist({ stand: mit(ok('hidden'), ok('public')) }))),
    ).toHaveLength(2);
  });

  it('nicht lesbar: kein Schritt (es wird nichts geraten), und das Schreiben wird deshalb nicht blockiert', () => {
    const p = einrichtungsPlan(E, ist({ stand: mit({ ok: false }) }));
    expect(schritte(p)).toHaveLength(0);
    expect(p.unsicher).toEqual([]);
  });

  it('der Schritt steht nach dem Anlegen der Wechsel-Gruppen und vor den Routinen', () => {
    const a = arten(einrichtungsPlan(E, ist({ stand: mit(ok('hidden')) })));
    expect(a.indexOf('sichtbarkeitWechselGruppe')).toBeGreaterThanOrEqual(0);
    expect(a.indexOf('sichtbarkeitWechselGruppe')).toBeLessThan(a.indexOf('regelnWechselGruppe'));
  });

  it('beim ersten Einrichten: keine Umstellung (neue Gruppen entstehen „eingeschränkt“), der Text sagt es', () => {
    const p = einrichtungsPlan(E, erstes());
    expect(schritte(p)).toHaveLength(0);
    expect(zeile(p, 'wechselGruppen').text).toContain('eingeschränkt sichtbar');
    expect(zeile(p, 'wechselGruppen').text).not.toContain('versteckt');
  });
});

describe('einrichtungsPlan – Stufen, die keine mehr sind (O9-5d)', () => {
  // Die Jungschar fällt weg: Ihre Regeln (Aufnahme aus „Fische → Jungschar“) sind unsere und gehen.
  const ohneJungschar: Einrichtung = {
    ...E,
    einstellung: { ...E.einstellung, stufen: E.einstellung.stufen.slice(0, 2) },
    wechselGruppen: [E.wechselGruppen[0]],
  };

  it('unsere Regeln in der entfernten Stufe und der Wechsel-Gruppe ohne Übergang werden entfernt – vor dem Neuberechnen', () => {
    const p = einrichtungsPlan(ohneJungschar, ist());
    const weg = p.schritte.filter((s) => s.art === 'regelnEntfernen');
    expect(weg.map((s) => s.ziel)).toEqual([
      { art: 'altGruppe', gruppeId: 3, name: 'Jungschar' },
      { art: 'altGruppe', gruppeId: 12, name: 'Fische → Jungschar' },
    ]);
    const a = arten(p);
    expect(a.indexOf('regelnEntfernen')).toBeGreaterThan(a.lastIndexOf('statusStufe'));
    expect(a.indexOf('regelnEntfernen')).toBeLessThan(a.indexOf('neuBerechnen'));
  });

  it('die Wechsel-Gruppe ohne Übergang wird NICHT gelöscht, sondern für „Fertig“ genannt', () => {
    const p = einrichtungsPlan(ohneJungschar, ist());
    expect(p.nichtMehrGebraucht).toEqual([{ gruppeId: 12, name: 'Fische → Jungschar' }]);
    expect(zeile(p, 'regeln').text).toContain('nicht mehr dazugehören');
  });

  it('hat die entfernte Gruppe keine Regeln von uns (mehr), gibt es keinen Schritt dafür', () => {
    const stand = gut();
    stand.gruppen = new Map(stand.gruppen).set(3, { regeln: ok([]), status: ok('none') });
    const p = einrichtungsPlan(ohneJungschar, ist({ stand }));
    expect(p.schritte.filter((s) => s.art === 'regelnEntfernen').map((s) => s.ziel)).toEqual([
      { art: 'altGruppe', gruppeId: 12, name: 'Fische → Jungschar' },
    ]);
  });

  it('ohne Änderung der Stufen: nichts zu entfernen, nichts „nicht mehr gebraucht“', () => {
    const p = einrichtungsPlan(E, ist());
    expect(arten(p)).not.toContain('regelnEntfernen');
    expect(p.nichtMehrGebraucht).toEqual([]);
  });
});

describe('einrichtungsPlan – der letzte Schritt ist das Speichern', () => {
  it('beim ersten Einrichten „neu“, beim Ändern „ändern“ – und immer nach dem Neuberechnen', () => {
    const neu = einrichtungsPlan(E, erstes());
    const alt = einrichtungsPlan(E, ist());
    expect(neu.schritte[neu.schritte.length - 1]).toEqual({
      art: 'speichern',
      aktion: 'neu',
      ziel: { art: 'einrichtung' },
    });
    expect(alt.schritte[alt.schritte.length - 1].aktion).toBe('aendern');
  });
});

describe('einrichtungsPlan – was sich nicht lesen ließ, wird nie „fehlt“', () => {
  it('Gruppentyp nicht lesbar: „unsicher“, kein Schritt für den Typ, weder „neu“ noch „vorhanden“', () => {
    const p = einrichtungsPlan(E, ist({ typ: NICHT }));
    expect(p.unsicher).toEqual([`Gruppentyp „${WECHSEL_TYP_NAME}“`]);
    expect(zeile(p, 'typ').text).toContain('nicht prüfen');
    expect(arten(p)).not.toContain('typ');
  });

  it('Stand der bisherigen Einrichtung nicht gelesen: „unsicher“ – die Wechsel-Gruppen sind trotzdem „vorhanden“, Rechte und Routinen werden (idempotent) „ändern“', () => {
    const p = einrichtungsPlan(E, ist({ stand: null }));
    expect(p.unsicher).toEqual(['Stand in ChurchTools']);
    expect(zeile(p, 'wechselGruppen').art).toBe('vorhanden');
    expect(zeile(p, 'rechte').art).toBe('aendern');
    expect(zeile(p, 'routinen').art).toBe('aendern');
  });

  it('Rechte der Leiter nicht lesbar: nie „vorhanden“', () => {
    const stand = gut();
    stand.rechte = { leiter: NICHT, teilnehmer: ok([]) };
    expect(zeile(einrichtungsPlan(E, ist({ stand })), 'rechte').art).toBe('aendern');
  });

  it('Regeln einer Gruppe nicht lesbar: nie „neu“ – es bleibt „ändern“', () => {
    const stand = gut();
    const gruppen = new Map(stand.gruppen);
    for (const id of [1, 2, 3, 11, 12]) gruppen.set(id, { regeln: NICHT, status: NICHT });
    stand.gruppen = gruppen;
    expect(zeile(einrichtungsPlan(E, ist({ stand })), 'regeln').art).toBe('aendern');
  });
});

describe('Typ „Gruppenwechsel“ erkennen', () => {
  it.each([
    ['Gruppenwechsel', true],
    ['  gruppenwechsel ', true],
    ['Gruppenwechsel 2', false],
    ['Dienst', false],
    [null, false],
    [7, false],
  ])('%j → %s', (name, erwartet) => {
    expect(istWechselTyp(name)).toBe(erwartet);
  });
});

describe('fremdeRegeln', () => {
  const stufen = [
    { gruppeId: 1, name: 'Schäfchen' },
    { gruppeId: 2, name: 'Teeny 13–16' },
  ];
  const regeln = (m: [number, Gelesen<readonly RegelRoh[]>][]) => new Map(m);
  const eigene = Object.values(REGELN).map((r) => ({ shorty: r.shorty }));

  it('keine Regeln und nur Regeln aus REGELN: frei – auch alle vier Kurznamen zusammen', () => {
    expect(
      fremdeRegeln(
        stufen,
        regeln([
          [1, ok([])],
          [2, ok(eigene)],
        ]),
      ),
    ).toEqual({ art: 'frei' });
  });

  it('eine Regel, deren Kurzname nicht in REGELN steht, ist fremd – mit Gruppe, Zahl und Beispiel', () => {
    const r = fremdeRegeln(
      stufen,
      regeln([
        [1, ok([])],
        [2, ok([{ shorty: 'jugendliste' }, { shorty: REGELN.kinder.shorty }, { shorty: 'ohne' }])],
      ]),
    );
    expect(r).toEqual({
      art: 'fremd',
      gruppen: [{ gruppeId: 2, name: 'Teeny 13–16', zahl: 2, beispiele: ['jugendliste', 'ohne'] }],
    });
  });

  it('eine Regel ohne Kurznamen ist fremd', () => {
    const r = fremdeRegeln(
      stufen,
      regeln([
        [1, ok([{}])],
        [2, ok([])],
      ]),
    );
    expect(r).toEqual({
      art: 'fremd',
      gruppen: [{ gruppeId: 1, name: 'Schäfchen', zahl: 1, beispiele: ['ohne Namen'] }],
    });
  });

  it('nicht lesbar (oder gar nicht gefragt): unlesbar – nie „frei“', () => {
    expect(
      fremdeRegeln(
        stufen,
        regeln([
          [1, ok([])],
          [2, NICHT],
        ]),
      ),
    ).toEqual({
      art: 'unlesbar',
      gruppen: [{ gruppeId: 2, name: 'Teeny 13–16' }],
    });
    expect(fremdeRegeln(stufen, regeln([[1, ok([])]])).art).toBe('unlesbar');
  });

  it('fremd geht vor unlesbar (das ist sicher)', () => {
    expect(
      fremdeRegeln(
        stufen,
        regeln([
          [1, NICHT],
          [2, ok([{ shorty: 'x' }])],
        ]),
      ).art,
    ).toBe('fremd');
  });
});

describe('darfSchreiben', () => {
  const plan = { unsicher: [] as string[] };
  const grundlage = {
    art: 'einrichten' as const,
    fehler: [] as string[],
    plan,
    fremd: { art: 'frei' } as const,
    jahre: 3,
    haken: true,
  };

  it('alles gut und der Haken gesetzt: an', () => {
    expect(darfSchreiben(grundlage)).toBe(true);
  });

  it('beim Einrichten braucht es den Haken (O9-F4), beim Ändern nicht', () => {
    expect(darfSchreiben({ ...grundlage, haken: false })).toBe(false);
    expect(darfSchreiben({ ...grundlage, art: 'aendern', haken: false })).toBe(true);
  });

  it('jeder Fehler der Einstellung hält auf', () => {
    expect(darfSchreiben({ ...grundlage, fehler: ['x'] })).toBe(false);
  });

  it('Plan noch nicht da oder etwas darin unsicher: aus', () => {
    expect(darfSchreiben({ ...grundlage, plan: null })).toBe(false);
    expect(darfSchreiben({ ...grundlage, plan: { unsicher: ['Gruppentyp'] } })).toBe(false);
  });

  it('fremde Regeln, unlesbare Regeln und noch nicht geladene Regeln: aus – auch mit Haken', () => {
    expect(darfSchreiben({ ...grundlage, fremd: { art: 'fremd', gruppen: [] } })).toBe(false);
    expect(darfSchreiben({ ...grundlage, fremd: { art: 'unlesbar', gruppen: [] } })).toBe(false);
    expect(darfSchreiben({ ...grundlage, fremd: null })).toBe(false);
  });

  it('ohne künftige Wechseltage: aus', () => {
    expect(darfSchreiben({ ...grundlage, jahre: 0 })).toBe(false);
  });
});
