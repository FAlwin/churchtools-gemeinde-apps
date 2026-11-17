import { describe, expect, it } from 'vitest';
import {
  alleRegeln,
  aufraeumRoutine,
  GRUNDWERTE,
  LEITER_RECHTE,
  REGELN,
  sommerferienAus,
  uebergaenge,
  wechselGruppenName,
  wechselGruppenRegeln,
  wechseljahre,
} from './gruppenwechsel';
import { einrichtungAus, type Einrichtung } from './gruppenwechselEinrichtung';
import { jahrStaende, regelnReichenBis } from './wechseltage';
import {
  einrichtungStand,
  fehlendeLeiterRechte,
  leiterRolleAus,
  listeAuf,
  sammelHinweis,
  stufenAnzeige,
  type EinrichtungDaten,
  type Gelesen,
  type RegelStandRoh,
  routineBefund,
  type StandQuelle,
  type StandZeile,
  type ZeilenId,
  waiseKandidaten,
  wechselTypIds,
} from './einrichtungStand';

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
const JAHRE = wechseljahre(
  sommerferienAus(
    [
      { titel: 'Sommerferien NRW 2027', beginn: '2027-07-19', ende: '2027-08-31' },
      { titel: 'Sommerferien NRW 2028', beginn: '2028-07-10', ende: '2028-08-22' },
      { titel: 'Sommerferien NRW 2029', beginn: '2029-07-16', ende: '2029-08-28' },
    ],
    GRUNDWERTE.ferienStichwort,
  ),
  GRUNDWERTE,
);
const ROLLEN = { teilnehmer: 45, leiter: 48 };
const TYP = 20;

const QUELLE: StandQuelle = {
  gruppen: [
    { id: 1, name: 'Schäfchen', typId: 7, statusId: 1, farbe: null },
    { id: 2, name: 'Fische', typId: 7, statusId: 1, farbe: null },
    { id: 3, name: 'Jungschar', typId: 7, statusId: 1, farbe: null },
    { id: 9, name: 'Kinder & Jugend', typId: 2, statusId: 1, farbe: null },
    { id: 11, name: 'Schäfchen → Fische', typId: TYP, statusId: 1, farbe: null },
    { id: 12, name: 'Fische → Jungschar', typId: TYP, statusId: 1, farbe: null },
  ],
  eltern: new Map([
    [11, [9]],
    [12, [9]],
  ]),
  typNamen: new Map([[TYP, 'Gruppenwechsel']]),
};

const ok = <T>(wert: T): Gelesen<T> => ({ ok: true, wert });
const NICHT: Gelesen<never> = { ok: false };
const rollenRoh = [
  { groupTypeRoleId: ROLLEN.leiter, type: 'leader' },
  { groupTypeRoleId: ROLLEN.teilnehmer, type: 'participant' },
];
const rechtZeile = (r: { authId: number; dataId: number | null }) => ({
  ...r,
  isInherited: false,
  type: 'group',
});

/** Der Stand, wie ihn „Einrichten“ hinterlässt – aus den Erzeugern, nicht von Hand. */
function gut(): EinrichtungDaten {
  const karte = new Map(E.wechselGruppen.map((w) => [w.vonGruppeId, w.gruppeId]));
  const regeln = alleRegeln(
    E.einstellung,
    JAHRE,
    karte,
    ROLLEN,
    new Map(E.einstellung.stufen.map((s) => [s.gruppeId, ROLLEN.teilnehmer])),
  );
  const routine = (u: typeof U1, w: number) => {
    const { neu, schritte } = aufraeumRoutine(u, w, ROLLEN, E.einstellung);
    return {
      id: 100 + w,
      groupId: w,
      groupTypeRoleId: neu.domainContext.groupTypeRoleId,
      groupMemberStatus: neu.domainContext.groupMemberStatus,
      routine: {
        name: neu.name,
        isEnabled: neu.isEnabled,
        // ChurchTools gibt `remove-member` mit `actionData: null` zurück (gemessen 16.11.2026).
        steps: schritte.map((s) =>
          s.actionKey === 'remove-member' ? { ...s, actionData: null } : s,
        ),
      },
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
  };
}

const staendeBis = (bis: number): RegelStandRoh => {
  const staende = jahrStaende(
    [U1, U2].map((u) => ({
      uebergang: u,
      regeln: wechselGruppenRegeln(
        u,
        JAHRE.filter((j) => j.jahr <= bis),
        ROLLEN,
      ),
    })),
    JAHRE,
  );
  return { art: 'da', staende, bis: regelnReichenBis(staende, 2027) };
};

const zeilen = (
  d: EinrichtungDaten = gut(),
  regel: RegelStandRoh = staendeBis(2029),
  e: Einrichtung = E,
  q: StandQuelle = QUELLE,
) => einrichtungStand(e, q, d, regel, 2027);
const zeile = (z: StandZeile[], id: ZeilenId) => z.find((x) => x.id === id)!.stand;

describe('einrichtungStand – der Stand, den „Einrichten“ hinterlässt', () => {
  it('alles aus den Erzeugern → alle sechs Zeilen in Ordnung, kein Sammelhinweis', () => {
    const z = zeilen();
    expect(z.map((x) => x.id)).toEqual([
      'typ',
      'rechte',
      'wechselGruppen',
      'wechseltage',
      'regeln',
      'routinen',
    ]);
    expect(z.map((x) => x.stand.art)).toEqual(Array(6).fill('ok'));
    expect(sammelHinweis(z)).toBeNull();
    expect(zeile(z, 'wechseltage')).toEqual({
      art: 'ok',
      text: '2027, 2028 und 2029 – in allen Gruppen gleich',
    });
    expect(zeile(z, 'rechte')).toEqual({
      art: 'ok',
      text: LEITER_RECHTE.map((r) => r.name).join(' · '),
    });
    expect(z.find((x) => x.id === 'typ')!.titel).toBe('Gruppentyp „Gruppenwechsel“');
  });
});

describe('Zeile Gruppentyp', () => {
  it('verschiedene Typen → Warnung mit den Gruppen', () => {
    const q = {
      ...QUELLE,
      gruppen: QUELLE.gruppen.map((g) => (g.id === 12 ? { ...g, typId: 7 } : g)),
    };
    const s = zeile(zeilen(gut(), undefined, E, q), 'typ');
    expect(s.art).toBe('warn');
    expect(s.text).toContain('verschiedene Typen');
    expect(s.text).toContain('„Fische → Jungschar“');
  });

  it('eine Rolle fehlt → Warnung mit Gruppe und Rolle', () => {
    const d = gut();
    d.rollen = new Map([
      [11, ok([rollenRoh[1]])],
      [12, ok(rollenRoh)],
    ]);
    const s = zeile(zeilen(d), 'typ');
    expect(s).toEqual({ art: 'warn', text: '„Schäfchen → Fische“: die Rolle Leiter fehlt' });
  });

  it('Rollen nicht lesbar → nicht prüfbar, nie „fehlt“', () => {
    const d = gut();
    d.rollen = new Map([
      [11, NICHT],
      [12, ok(rollenRoh)],
    ]);
    expect(zeile(zeilen(d), 'typ').art).toBe('nichtPruefbar');
  });

  it('eine nachweislich fehlende Rolle gilt auch, wenn eine andere Gruppe nicht lesbar war', () => {
    const d = gut();
    d.rollen = new Map([
      [11, NICHT],
      [12, ok([rollenRoh[0]])],
    ]);
    expect(zeile(zeilen(d), 'typ')).toMatchObject({ art: 'warn' });
  });

  it('ohne Wechsel-Gruppe gibt es nichts zu prüfen → nicht prüfbar', () => {
    const leer: Einrichtung = { ...E, wechselGruppen: [] };
    expect(zeile(zeilen(gut(), undefined, leer), 'typ').art).toBe('nichtPruefbar');
  });
});

describe('Zeile Rechte der Leitung am Typ', () => {
  it('ein Recht fehlt → Warnung mit dem Namen aus LEITER_RECHTE; fehlt „Gruppeninfos sehen“, steht die Folge dabei', () => {
    const d = gut();
    d.rechte = {
      leiter: ok(LEITER_RECHTE.filter((r) => r.authId !== 10102).map(rechtZeile)),
      teilnehmer: ok([]),
    };
    const s = zeile(zeilen(d), 'rechte');
    const name = LEITER_RECHTE.find((r) => r.authId === 10102)!.name;
    expect(s.art).toBe('warn');
    expect(s.text).toContain(`fehlt: ${name} (Stufe 1)`);
    expect(s.text).toContain('sehen die Leitungen ihre Wechsel-Gruppe nicht');
  });

  it('ein Recht ohne Stufe (dataId null) fehlt → ohne Stufe genannt, ohne die Folge für „Gruppeninfos“', () => {
    const d = gut();
    d.rechte = {
      leiter: ok(LEITER_RECHTE.filter((r) => r.dataId !== null).map(rechtZeile)),
      teilnehmer: ok([]),
    };
    const s = zeile(zeilen(d), 'rechte');
    const name = LEITER_RECHTE.find((r) => r.dataId === null)!.name;
    expect(s).toEqual({ art: 'warn', text: `fehlt: ${name}` });
  });

  it('dasselbe Recht mit anderer Stufe zählt nicht als vorhanden', () => {
    const d = gut();
    d.rechte = {
      leiter: ok(
        LEITER_RECHTE.map((r) => rechtZeile(r.authId === 10101 ? { ...r, dataId: 2 } : r)),
      ),
      teilnehmer: ok([]),
    };
    const s = zeile(zeilen(d), 'rechte');
    expect(s.text).toContain('fehlt:');
    expect(s.text).toContain('zusätzlich bei der Leitung:');
  });

  it('ein zusätzliches Recht der Leitung → Warnung; unbekannte Nummer als „Recht N“', () => {
    const d = gut();
    d.rechte = {
      leiter: ok([...LEITER_RECHTE.map(rechtZeile), rechtZeile({ authId: 99999, dataId: null })]),
      teilnehmer: ok([]),
    };
    expect(zeile(zeilen(d), 'rechte')).toEqual({
      art: 'warn',
      text: 'zusätzlich bei der Leitung: Recht 99999',
    });
  });

  it('Teilnehmer mit Rechten → Warnung', () => {
    const d = gut();
    d.rechte = {
      leiter: ok(LEITER_RECHTE.map(rechtZeile)),
      teilnehmer: ok([rechtZeile({ authId: 10101, dataId: 1 })]),
    };
    const s = zeile(zeilen(d), 'rechte');
    expect(s.art).toBe('warn');
    expect(s.text).toContain('zusätzlich bei den Teilnehmern');
  });

  it('geerbte Rechte zählen als vorhanden und werden nicht als „zusätzlich“ gemeldet', () => {
    const d = gut();
    d.rechte = {
      leiter: ok([
        ...LEITER_RECHTE.map((r) => ({ ...rechtZeile(r), isInherited: true })),
        { ...rechtZeile({ authId: 99999, dataId: null }), isInherited: true },
      ]),
      teilnehmer: ok([{ ...rechtZeile({ authId: 10101, dataId: 1 }), isInherited: true }]),
    };
    expect(zeile(zeilen(d), 'rechte').art).toBe('ok');
  });

  it('Rechte nicht lesbar (z. B. 401 ohne Recht) → nicht prüfbar, nicht „fehlt“', () => {
    for (const rechte of [
      { leiter: NICHT, teilnehmer: ok([]) },
      { leiter: ok(LEITER_RECHTE.map(rechtZeile)), teilnehmer: NICHT },
      { leiter: NICHT, teilnehmer: NICHT },
    ]) {
      const d = gut();
      d.rechte = rechte;
      expect(zeile(zeilen(d), 'rechte').art).toBe('nichtPruefbar');
    }
  });

  it('nachweislich Falsches gilt auch, wenn die andere Rolle nicht lesbar war', () => {
    const d = gut();
    d.rechte = { leiter: ok([]), teilnehmer: NICHT };
    expect(zeile(zeilen(d), 'rechte').art).toBe('warn');
  });
});

describe('Zeile Wechsel-Gruppen', () => {
  it('fehlt eine, steht der Übergang da', () => {
    const e: Einrichtung = { ...E, wechselGruppen: [E.wechselGruppen[0]] };
    const z = zeile(zeilen(gut(), undefined, e), 'wechselGruppen');
    expect(z.art).toBe('warn');
    // Die Gruppe 12 gibt es unter dem Bereich mit dem Namen des Übergangs – sie ist nur nicht eingetragen (O9-5d).
    expect(z.art === 'warn' && z.liste?.[0]).toBe(`${wechselGruppenName(U2)}: fehlt`);
  });

  it('eine Gruppe, die es (für mich) nicht gibt → Warnung', () => {
    const q = { ...QUELLE, gruppen: QUELLE.gruppen.filter((g) => g.id !== 12) };
    const s = zeile(zeilen(gut(), undefined, E, q), 'wechselGruppen');
    expect(s.art).toBe('warn');
    expect(s.text).toContain(`${wechselGruppenName(U2)}: Gruppe 12 ist nicht zu sehen`);
  });

  it('hängt nicht unter der Bereichsgruppe → Warnung mit deren Namen', () => {
    const q = { ...QUELLE, eltern: new Map([[11, [9]]]) };
    expect(zeile(zeilen(gut(), undefined, E, q), 'wechselGruppen')).toEqual({
      art: 'warn',
      text: `${wechselGruppenName(U2)}: hängt nicht unter „Kinder & Jugend“`,
    });
  });
});

describe('Zeile Wechsel-Gruppen – angelegt, aber nicht eingetragen (O9-5d)', () => {
  // Die Lücke: Abbruch nach dem Anlegen und vor dem Speichern der Einrichtung.
  const ohne12: Einrichtung = { ...E, wechselGruppen: [E.wechselGruppen[0]] };

  it('eine Gruppe mit dem Namen des Übergangs, Typ „Gruppenwechsel“, unter dem Bereich – aber nicht eingetragen → ⚠ mit Nummer', () => {
    const z = zeile(zeilen(gut(), undefined, ohne12), 'wechselGruppen');
    expect(z.art).toBe('warn');
    expect(z.art === 'warn' && z.liste).toEqual([
      `${wechselGruppenName(U2)}: fehlt`,
      expect.stringContaining('Gruppe 12 steht unter „Kinder & Jugend“'),
    ]);
  });

  it('nicht gemeldet: andere Typ, anderer Name oder nicht unter dem Bereich', () => {
    const q = (ersetze: (g: StandQuelle['gruppen'][number]) => StandQuelle['gruppen'][number]) => ({
      ...QUELLE,
      gruppen: QUELLE.gruppen.map((g) => (g.id === 12 ? ersetze(g) : g)),
    });
    for (const quelle of [
      q((g) => ({ ...g, typId: 7 })),
      q((g) => ({ ...g, name: 'Etwas anderes' })),
      { ...QUELLE, eltern: new Map([[11, [9]]]) },
    ]) {
      const z = zeile(zeilen(gut(), undefined, ohne12, quelle), 'wechselGruppen');
      expect(z.art === 'warn' && z.liste).toBeFalsy();
    }
  });

  it('eingetragene Gruppen sind keine Waisen', () => {
    expect(zeile(zeilen(gut()), 'wechselGruppen').art).toBe('ok');
  });
});

describe('waiseKandidaten', () => {
  it('liefert nur Gruppen mit Namen, Typ und Obergruppe – und nicht die schon benutzten', () => {
    const a = {
      name: wechselGruppenName(U2),
      bereichId: 9,
      typIds: wechselTypIds(QUELLE.typNamen),
      gruppen: QUELLE.gruppen,
      eltern: QUELLE.eltern,
      benutzt: new Set<number>(),
    };
    expect(waiseKandidaten(a).map((g) => g.id)).toEqual([12]);
    expect(waiseKandidaten({ ...a, benutzt: new Set([12]) })).toEqual([]);
    expect(waiseKandidaten({ ...a, bereichId: 5 })).toEqual([]);
  });
});

describe('Zeile Regeln – nur „aktiv“ rechnet von selbst (O9-5d)', () => {
  const mitStatus = (status: string) => {
    const d = gut();
    d.gruppen = new Map(
      [...d.gruppen].map(([id, g]) => [id, { ...g, status: ok(status) }] as const),
    );
    return zeile(zeilen(d), 'regeln');
  };

  it('„manual“ und „inactive“ → ⚠ „rechnet nicht von selbst neu“ mit dem Status', () => {
    for (const [status, wort] of [
      ['manual', 'manuell'],
      ['inactive', 'inaktiv'],
    ]) {
      const z = mitStatus(status);
      expect(z.art).toBe('warn');
      expect(JSON.stringify(z)).toContain(
        `rechnet nicht von selbst neu – der Status steht auf „${wort}“`,
      );
    }
  });

  it('„none“ bleibt „läuft nicht“, „active“ ist in Ordnung', () => {
    expect(JSON.stringify(mitStatus('none'))).toContain('läuft nicht');
    expect(mitStatus('active').art).toBe('ok');
  });
});

describe('Zeile Wechseltage in den Regeln', () => {
  it('Regeln reichen bis zum nächsten Jahr → „nur noch bis“', () => {
    expect(zeile(zeilen(gut(), staendeBis(2027)), 'wechseltage')).toMatchObject({
      art: 'warn',
      text: expect.stringContaining('nur noch bis 2027'),
    });
  });

  it('nur noch in einer Gruppe eingetragen → die Lücke wird genannt', () => {
    const regel = staendeBis(2027);
    if (regel.art !== 'da') throw new Error('Erzeuger liefert „da“');
    // 2028 nur in der ersten Wechsel-Gruppe: wie ein halb geschriebener Lauf.
    const halb: RegelStandRoh = {
      ...regel,
      staende: regel.staende.map((s) =>
        s.jahr === 2028
          ? { ...s, stand: { art: 'unvollstaendig' as const, fehlend: [wechselGruppenName(U2)] } }
          : s,
      ),
    };
    const s = zeile(zeilen(gut(), halb), 'wechseltage');
    expect(s.art).toBe('warn');
    expect(s.text).toContain(`2028 steht nur teilweise drin (fehlt bei ${wechselGruppenName(U2)})`);
  });

  it('stehen schon die nächsten nicht mehr drin → „fehlen ab“', () => {
    const s = zeile(zeilen(gut(), { art: 'da', staende: [], bis: 2026 }), 'wechseltage');
    // Kein „reichen nur bis 2026“: Vor dem nächsten Wechsel steht nichts von uns drin, der Zusatz sagte nichts.
    expect(s).toEqual({ art: 'warn', text: 'fehlen ab 2027' });
  });

  it('Regeln nicht lesbar → nicht prüfbar', () => {
    expect(zeile(zeilen(gut(), { art: 'nichtPruefbar' }), 'wechseltage').art).toBe('nichtPruefbar');
  });
});

describe('Überschriften in Einzahl und Mehrzahl', () => {
  it('ein Übergang → „1 Wechsel-Gruppe“, „1 Routine“; zwei → Mehrzahl', () => {
    const eins = einrichtungAus({
      einstellung: { ...E.einstellung, stufen: E.einstellung.stufen.slice(0, 2) },
      bereichGruppeId: 9,
      wechselGruppen: [E.wechselGruppen[0]],
    })!;
    const titel = (z: StandZeile[], id: ZeilenId) => z.find((x) => x.id === id)!.titel;
    const z1 = zeilen(gut(), staendeBis(2029), eins);
    expect(titel(z1, 'wechselGruppen')).toBe('1 Wechsel-Gruppe');
    expect(titel(z1, 'routinen')).toBe('1 Routine');
    expect(z1.find((x) => x.id === 'routinen')!.stand.text).toBe(
      `räumt die Wechsel-Gruppe ${E.einstellung.aufraeumenTage} Tage nach dem Wechsel auf`,
    );
    const z2 = zeilen();
    expect(titel(z2, 'wechselGruppen')).toBe('2 Wechsel-Gruppen');
    expect(titel(z2, 'routinen')).toBe('2 Routinen');
  });
});

describe('Zeile Regeln der Gruppen', () => {
  it('fehlt eine Regel, steht ihr Kurzname (aus REGELN) und die Gruppe da', () => {
    const d = gut();
    const w = d.gruppen.get(11)!;
    if (!w.regeln.ok) throw new Error('gelesen');
    const [kinder, leitung] = wechselGruppenRegeln(U1, JAHRE, ROLLEN);
    expect(kinder.shorty).toBe(REGELN.kinder.shorty);
    d.gruppen = new Map(d.gruppen).set(11, { ...w, regeln: ok([leitung]) });
    const s = zeile(zeilen(d), 'regeln');
    expect(s).toEqual({
      art: 'warn',
      text: `Schäfchen → Fische: ${REGELN.kinder.name} fehlt`,
    });
  });

  it('die Aufnahme in der neuen Gruppe fehlt → Warnung bei der Stufe', () => {
    const d = gut();
    d.gruppen = new Map(d.gruppen).set(2, {
      regeln: ok(
        (d.gruppen.get(2)!.regeln as { ok: true; wert: { shorty?: unknown }[] }).wert.filter(
          (r) => r.shorty !== REGELN.aufnahme.shorty,
        ),
      ),
      status: ok('active'),
    });
    const s = zeile(zeilen(d), 'regeln');
    expect(s.art).toBe('warn');
    expect(s.text).toBe(`Fische: ${REGELN.aufnahme.name} fehlt`);
  });

  it('eine fremde Regel → Warnung mit ihrem Namen (sie wäre beim Schreiben weg)', () => {
    const d = gut();
    const alt = d.gruppen.get(2)!;
    if (!alt.regeln.ok) throw new Error('gelesen');
    d.gruppen = new Map(d.gruppen).set(2, {
      ...alt,
      regeln: ok([...alt.regeln.wert, { shorty: 'meineregel' }, {}]),
    });
    const s = zeile(zeilen(d), 'regeln');
    expect(s.art).toBe('warn');
    expect(s.text).toBe(
      'Fische: fremde Regeln „meineregel“ und ohne Namen (nicht von dieser Erweiterung)',
    );
  });

  it('Status „none“ → Warnung: läuft nicht', () => {
    const d = gut();
    d.gruppen = new Map(d.gruppen).set(12, { ...d.gruppen.get(12)!, status: ok('none') });
    const s = zeile(zeilen(d), 'regeln');
    expect(s.art).toBe('warn');
    expect(s.text).toBe(
      'Fische → Jungschar: läuft nicht – die Gruppe ist nicht als dynamisch eingeschaltet',
    );
  });

  it('keine Regeln (404 → leere Liste) in einer Gruppe → fehlt, mit allen ihren Regeln', () => {
    const d = gut();
    d.gruppen = new Map(d.gruppen).set(11, { regeln: ok([]), status: ok('none') });
    const s = zeile(zeilen(d), 'regeln');
    expect(s.art).toBe('warn');
    // EINE Zeile je Gruppe mit allen Befunden – nicht drei einzelne.
    expect(s.text).toBe(
      `Schäfchen → Fische: ${REGELN.kinder.name} und ${REGELN.leitung.name} fehlen; läuft nicht – die Gruppe ist nicht als dynamisch eingeschaltet`,
    );
  });

  it('Befunde in mehreren Gruppen → je Gruppe eine Listenzeile, darüber die Zahl', () => {
    const d = gut();
    d.gruppen = new Map(d.gruppen)
      .set(11, { ...d.gruppen.get(11)!, status: ok('none') })
      .set(12, { ...d.gruppen.get(12)!, status: ok('none') });
    expect(zeile(zeilen(d), 'regeln')).toEqual({
      art: 'warn',
      text: '2 Gruppen stimmen nicht',
      liste: [
        'Schäfchen → Fische: läuft nicht – die Gruppe ist nicht als dynamisch eingeschaltet',
        'Fische → Jungschar: läuft nicht – die Gruppe ist nicht als dynamisch eingeschaltet',
      ],
    });
  });

  it('Regeln oder Status nicht lesbar → nicht prüfbar, nie „fehlt“', () => {
    const regelnNicht = gut();
    regelnNicht.gruppen = new Map(regelnNicht.gruppen).set(11, {
      regeln: NICHT,
      status: ok('active'),
    });
    expect(zeile(zeilen(regelnNicht), 'regeln').art).toBe('nichtPruefbar');
    const statusNicht = gut();
    statusNicht.gruppen = new Map(statusNicht.gruppen).set(11, {
      ...statusNicht.gruppen.get(11)!,
      status: NICHT,
    });
    expect(zeile(zeilen(statusNicht), 'regeln').art).toBe('nichtPruefbar');
    const fehltGanz = gut();
    fehltGanz.gruppen = new Map([...fehltGanz.gruppen].filter(([id]) => id !== 3));
    expect(zeile(zeilen(fehltGanz), 'regeln').art).toBe('nichtPruefbar');
  });

  it('fehlt die Wechsel-Gruppe eines Übergangs, gilt die Aufnahme dort nicht als „fremd“ und nicht als fehlend', () => {
    const e: Einrichtung = { ...E, wechselGruppen: [E.wechselGruppen[0]] };
    const d = gut();
    // Die Stufe „Jungschar“ trägt (noch) die Aufnahme des zweiten Übergangs – „Einrichten“ schriebe sie dort auch.
    const erz = alleRegeln(
      E.einstellung,
      JAHRE,
      new Map([
        [1, 11],
        [2, 12],
      ]),
      ROLLEN,
      new Map([
        [2, 45],
        [3, 45],
      ]),
    ).get(3)!;
    d.gruppen = new Map(d.gruppen).set(3, { regeln: ok(erz), status: ok('active') });
    expect(zeile(zeilen(d, undefined, e), 'regeln').art).toBe('ok');
  });
});

describe('Zeile Routinen', () => {
  interface R {
    groupTypeRoleId: number;
    routine: {
      isEnabled: boolean;
      steps: { actionKey: string; isEnabled: boolean; actionData: unknown }[];
    };
  }
  /** Die Routine der ersten Wechsel-Gruppe, so verändert. */
  const mit = (aendern: (r: R) => R) => {
    const d = gut();
    const liste = d.routinen.get(11)!;
    if (!liste.ok) throw new Error('gelesen');
    d.routinen = new Map(d.routinen).set(11, ok([aendern(liste.wert[0] as unknown as R)]));
    return d;
  };

  it('Routine fehlt → Warnung mit Übergang', () => {
    const d = gut();
    d.routinen = new Map(d.routinen).set(12, ok([]));
    expect(zeile(zeilen(d), 'routinen')).toEqual({
      art: 'warn',
      text: `${wechselGruppenName(U2)}: Routine fehlt`,
    });
  });

  it('eine Routine für eine andere Rolle zählt nicht', () => {
    const d = mit((r) => ({ ...r, groupTypeRoleId: ROLLEN.leiter }));
    expect(zeile(zeilen(d), 'routinen').text).toContain('Routine fehlt');
  });

  it('wartet nicht so lange wie eingestellt → „wartet N statt M Tage“', () => {
    const d = mit((r) => ({
      ...r,
      routine: {
        ...r.routine,
        steps: r.routine.steps.map((s) =>
          s.actionKey === 'special:wait' ? { ...s, actionData: { duration: { numDays: 60 } } } : s,
        ),
      },
    }));
    expect(zeile(zeilen(d), 'routinen')).toEqual({
      art: 'warn',
      text: `${wechselGruppenName(U1)}: Routine wartet 60 statt ${E.einstellung.aufraeumenTage} Tage`,
    });
  });

  it('Routine ausgeschaltet → Warnung', () => {
    const d = mit((r) => ({ ...r, routine: { ...r.routine, isEnabled: false } }));
    expect(zeile(zeilen(d), 'routinen').text).toContain('Routine ist ausgeschaltet');
  });

  it('ein Schritt ausgeschaltet oder das Austragen fehlt → Warnung', () => {
    const aus = mit((r) => ({
      ...r,
      routine: {
        ...r.routine,
        steps: r.routine.steps.map((s) => ({ ...s, isEnabled: false })),
      },
    }));
    expect(zeile(zeilen(aus), 'routinen').text).toContain('ausgeschaltete Schritte');
    const ohne = mit((r) => ({
      ...r,
      routine: {
        ...r.routine,
        steps: r.routine.steps.filter((s) => s.actionKey !== 'remove-member'),
      },
    }));
    expect(zeile(zeilen(ohne), 'routinen').text).toContain('trägt nicht aus');
  });

  it('„remove-member“ mit `{}` (so schreibt es der Erzeuger) und mit `null` (so liefert es ChurchTools) ist dasselbe', () => {
    const { schritte } = aufraeumRoutine(U1, 11, ROLLEN, E.einstellung);
    expect(schritte[1].actionData).toEqual({});
    const mitLeer = mit((r) => ({
      ...r,
      routine: { ...r.routine, steps: schritte },
    }));
    expect(zeile(zeilen(mitLeer), 'routinen').art).toBe('ok');
    expect(zeile(zeilen(), 'routinen').art).toBe('ok'); // `null` aus `gut()`
  });

  it('Routinen nicht lesbar → nicht prüfbar, nie „fehlt“; Warnung der anderen gilt trotzdem', () => {
    const d = gut();
    d.routinen = new Map(d.routinen).set(11, NICHT);
    expect(zeile(zeilen(d), 'routinen').art).toBe('nichtPruefbar');
    d.routinen = new Map(d.routinen).set(12, ok([]));
    expect(zeile(zeilen(d), 'routinen').art).toBe('warn');
  });
});

describe('Sammelhinweis und Stufen', () => {
  it('zählt nur Warnungen; „nicht prüfbar“ ist keine Aufgabe', () => {
    const z = (arten: ('ok' | 'warn' | 'nichtPruefbar')[]): StandZeile[] =>
      arten.map((art, i) => ({
        id: `z${i}` as ZeilenId,
        titel: 't',
        stand: { art, text: '' },
      }));
    expect(sammelHinweis(z(['ok', 'nichtPruefbar']))).toBeNull();
    expect(sammelHinweis(z(['warn', 'ok']))).toEqual({
      titel: 'Eine Sache braucht dich.',
      text: 'Unten steht, was nicht stimmt.',
    });
    expect(sammelHinweis(z(['warn', 'warn']))!.titel).toBe('Zwei Dinge brauchen dich.');
    expect(sammelHinweis(z(Array(8).fill('warn')))!.titel).toBe('8 Dinge brauchen dich.');
  });

  it('stufenAnzeige: Kette, Bereich, Stichtag und Ankündigung aus der Einstellung', () => {
    expect(stufenAnzeige(E, QUELLE)).toEqual({
      kette: [
        { name: 'Schäfchen', abAlter: 4 },
        { name: 'Fische', abAlter: 7 },
        { name: 'Jungschar', abAlter: 10 },
      ],
      bereich: 'Kinder & Jugend',
      ferien: GRUNDWERTE.ferienkalender,
      stichtag: '30.09.',
      ankuendigung: '8 Wochen vor dem Wechseltag',
    });
    const krumm = { ...E, einstellung: { ...E.einstellung, ankuendigungTage: 10 } };
    expect(stufenAnzeige(krumm, QUELLE).ankuendigung).toBe('10 Tage vor dem Wechseltag');
    const eine = { ...E, einstellung: { ...E.einstellung, ankuendigungTage: 7 } };
    expect(stufenAnzeige(eine, QUELLE).ankuendigung).toBe('1 Woche vor dem Wechseltag');
  });

  it('listeAuf und leiterRolleAus', () => {
    expect(listeAuf(['2027'])).toBe('2027');
    expect(listeAuf(['2027', '2028'])).toBe('2027 und 2028');
    expect(listeAuf(['a', 'b', 'c'])).toBe('a, b und c');
    expect(leiterRolleAus(rollenRoh)).toBe(ROLLEN.leiter);
    expect(leiterRolleAus([{ groupTypeRoleId: 1, type: 'leader', isHidden: true }])).toBeNull();
    expect(leiterRolleAus(null)).toBeNull();
  });
});

describe('fehlendeLeiterRechte und routineBefund (eine Stelle für Zeile und Plan, O9-5c-2)', () => {
  it('fehlendeLeiterRechte: alle da → leer; eins weg → genau dieses, mit Stufe; geerbt zählt als da', () => {
    expect(fehlendeLeiterRechte(LEITER_RECHTE.map(rechtZeile))).toEqual([]);
    const ohne = LEITER_RECHTE.filter((r) => r.authId !== 10102);
    expect(fehlendeLeiterRechte(ohne.map(rechtZeile)).map((r) => r.authId)).toEqual([10102]);
    expect(fehlendeLeiterRechte([])).toEqual(LEITER_RECHTE);
    const geerbt = LEITER_RECHTE.map((r) => ({ ...rechtZeile(r), isInherited: true }));
    expect(fehlendeLeiterRechte(geerbt)).toEqual([]);
  });

  it('routineBefund: gut → ok; keine → fehlt; andere Wartezeit → Problem; nicht lesbar → unlesbar; andere Wartezeit der Einstellung', () => {
    const d = gut();
    expect(routineBefund(E.einstellung, U1, 11, d)).toEqual({ art: 'ok' });
    expect(routineBefund({ aufraeumenTage: 120 }, U1, 11, d)).toEqual({
      art: 'problem',
      text: `wartet ${E.einstellung.aufraeumenTage} statt 120 Tage`,
    });
    expect(
      routineBefund(E.einstellung, U1, 11, { ...d, routinen: new Map([[11, ok([])]]) }),
    ).toEqual({
      art: 'fehlt',
    });
    expect(
      routineBefund(E.einstellung, U1, 11, { ...d, routinen: new Map([[11, NICHT]]) }),
    ).toEqual({
      art: 'unlesbar',
    });
    expect(routineBefund(E.einstellung, U1, 99, d)).toEqual({ art: 'unlesbar' });
  });
});
