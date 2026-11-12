import { describe, expect, it } from 'vitest';
import { alterAm, plusTage } from '../ct/datum';
import {
  GRUNDWERTE,
  LEITER_RECHTE,
  alleRegeln,
  aufnahmeRegel,
  aufraeumRoutine,
  austragRegel,
  einstellungFehler,
  ferienkalenderFinden,
  geborenBis,
  sommerferienAus,
  uebergaenge,
  wechselGruppenName,
  wechselGruppenRegeln,
  wechseljahre,
  wechseltagNach,
  werWechselt,
  type GruppenwechselEinstellung,
  type Regel,
} from './gruppenwechsel';

// Unsere Stufen (4.23) mit erfundenen Gruppen-IDs.
const E: GruppenwechselEinstellung = {
  ...GRUNDWERTE,
  stufen: [
    { gruppeId: 1, name: 'Schäfchen', abAlter: 4 },
    { gruppeId: 2, name: 'Fische', abAlter: 7 },
    { gruppeId: 3, name: 'Jungschar', abAlter: 10 },
    { gruppeId: 4, name: 'Teeny', abAlter: 13 },
    { gruppeId: 5, name: 'Jugend ab 16', abAlter: 16 },
  ],
};
const [, FISCHE_JUNGSCHAR] = uebergaenge(E);
const ROLLEN = { teilnehmer: 45, leiter: 48 };

// So stehen die Sommerferien im Abo „Schulferien NRW“ (Test-Instanz, Kalender 6, gelesen 11.11.2026).
const TERMINE = [
  { titel: 'Osterferien Nordrhein-Westfalen 2027', beginn: '2027-03-22', ende: '2027-04-03' },
  { titel: 'Sommerferien Nordrhein-Westfalen 2027', beginn: '2027-07-19', ende: '2027-08-31' },
  { titel: 'Sommerferien Nordrhein-Westfalen 2028', beginn: '2028-07-10', ende: '2028-08-22' },
  { titel: 'Herbstferien Nordrhein-Westfalen 2028', beginn: '2028-10-23', ende: '2028-11-04' },
  { titel: 'Sommerferien Nordrhein-Westfalen 2029', beginn: '2029-07-02', ende: '2029-08-14' },
];
const JAHRE = wechseljahre(sommerferienAus(TERMINE, E.ferienStichwort), E);
const J2027 = JAHRE[0];

// ── Ein kleiner Nachbau der ChurchTools-Auswertung, nur für die Bausteine, die der Kern schreibt ───────────────
// Eine Zeile je Mitgliedschaft (wie ChurchQuery: Person × Gruppe); eine Person passt, wenn eine ihrer Zeilen passt.
interface Zeile {
  'person.id': number;
  'person.birthday': string | null;
  'groupmember.groupId': number;
  'groupmember.groupMemberStatus': string;
  'role.type': 'participant' | 'leader';
}

function auswerten(ausdruck: unknown, z: Zeile, heute: string): unknown {
  if (typeof ausdruck !== 'object' || ausdruck === null) return ausdruck;
  const [[op, arg]] = Object.entries(ausdruck);
  const a = arg as unknown[];
  const w = (x: unknown) => auswerten(x, z, heute);
  switch (op) {
    case 'and':
      return a.every((x) => w(x) === true);
    case 'or':
      return a.some((x) => w(x) === true);
    case '==':
      return w(a[0]) === w(a[1]);
    case '<=':
    case '<': {
      const l = w(a[0]);
      const r = w(a[1]);
      if (l === null || r === null) return false; // ohne Geburtstag passt niemand
      return op === '<' ? String(l) < String(r) : String(l) <= String(r);
    }
    case 'var':
      return z[arg as keyof Zeile];
    case 'ct_date':
      return heute;
    default:
      throw new Error(`Der Nachbau kennt „${op}“ nicht – ChurchTools vielleicht auch nicht.`);
  }
}

const passt = (r: Regel, zeilen: Zeile[], heute: string): number[] => [
  ...new Set(
    zeilen
      .filter((z) => auswerten(r.query.params.filter, z, heute) === true)
      .map((z) => z['person.id']),
  ),
];

const kind = (id: number, geb: string | null, gruppe: number, status = 'active'): Zeile => ({
  'person.id': id,
  'person.birthday': geb,
  'groupmember.groupId': gruppe,
  'groupmember.groupMemberStatus': status,
  'role.type': 'participant',
});
const leitung = (id: number, gruppe: number): Zeile => ({
  ...kind(id, '1990-01-01', gruppe),
  'role.type': 'leader',
});

/** Alle Operatoren eines Ausdrucks, um `in` und Unbekanntes zu finden. */
const operatoren = (x: unknown): string[] =>
  typeof x !== 'object' || x === null
    ? []
    : Array.isArray(x)
      ? x.flatMap(operatoren)
      : Object.entries(x).flatMap(([k, v]) => [k, ...operatoren(v)]);

// ────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Wechseltag und Ferien', () => {
  it('Wechseltag = erster Montag nach den Sommerferien – mit den echten NRW-Ferien wie im Entwurf', () => {
    expect(JAHRE.map((j) => j.wechseltag)).toEqual(['2027-09-06', '2028-08-28', '2029-08-20']);
  });

  it('enden die Ferien sonntags, ist es der Montag danach; enden sie montags, der nächste Montag', () => {
    expect(wechseltagNach('2026-08-30')).toBe('2026-08-31'); // Sonntag
    expect(wechseltagNach('2026-08-31')).toBe('2026-09-07'); // Montag
    expect(wechseltagNach('2026-09-05')).toBe('2026-09-07'); // Samstag
  });

  it('Ankündigung 8 Wochen vorher, Aufnahme 14 Tage ab dem Wechseltag, Stichtag 30.09.', () => {
    expect(J2027).toEqual({
      jahr: 2027,
      stichtag: '2027-09-30',
      wechseltag: '2027-09-06',
      ankuendigung: '2027-07-12',
      aufnahmeBis: '2027-09-20',
    });
  });

  it('nimmt nur Sommerferien, je Jahr einmal, sortiert', () => {
    // Abo zweimal importiert, der zweite Termin weicht ab: der erste zählt.
    const doppelt = [...TERMINE].reverse().concat({ ...TERMINE[1], ende: '2027-08-24' });
    const ferien = sommerferienAus(doppelt, 'sommerferien');
    expect(ferien.map((f) => f.jahr)).toEqual([2027, 2028, 2029]);
    expect(ferien[0].ende).toBe('2027-08-31');
    expect(sommerferienAus(TERMINE, '  ')).toEqual([]);
  });

  it('findet den Ferienkalender nach Name, egal wie geschrieben', () => {
    const k = [
      { id: 2, name: 'Gemeinde' },
      { id: 20, name: ' schulferien nrw ' },
    ];
    expect(ferienkalenderFinden(k, 'Schulferien NRW')?.id).toBe(20);
    expect(ferienkalenderFinden(k, 'Schulferien Bayern')).toBeNull();
  });
});

describe('Wer wechselt (Vorschau)', () => {
  it('„geboren bis“ in der Regel sagt dasselbe wie das Alter am Stichtag – auch an den Rändern', () => {
    for (const alter of [4, 7, 10, 13, 16]) {
      const grenze = geborenBis(J2027, alter);
      for (const geb of [
        grenze,
        '2017-10-01',
        '2017-09-29',
        `${2027 - alter}-10-01`,
        `${2026 - alter}-12-31`,
      ]) {
        expect(geb <= grenze, `${geb} / ${alter}`).toBe(
          (alterAm(geb, J2027.stichtag) ?? -1) >= alter,
        );
      }
    }
  });

  it('wechselt eine Stufe weiter, bleibt zu jung stehen, ohne Geburtstag gesondert; letzte Stufe und Fremde nicht', () => {
    const w = werWechselt(
      [
        { personId: 11, gruppeId: 2, geburtstag: '2017-09-30' }, // am 30.09.2027 genau zehn
        { personId: 12, gruppeId: 2, geburtstag: '2017-10-01T00:00:00Z' }, // erst danach zehn
        { personId: 13, gruppeId: 2, geburtstag: null },
        { personId: 14, gruppeId: 2, geburtstag: '2013-01-01' }, // für zwei Stufen alt genug
        { personId: 15, gruppeId: 5, geburtstag: '2008-01-01' }, // Jugend: keine Stufe danach
        { personId: 16, gruppeId: 99, geburtstag: '2017-01-01' }, // nicht in den Stufen
      ],
      E,
      J2027,
    );
    expect(w.map((x) => [x.personId, x.art, x.art === 'wechselt' ? x.nach.name : null])).toEqual([
      [11, 'wechselt', 'Jungschar'],
      [12, 'bleibt', null],
      [13, 'ohneGeburtstag', null],
      [14, 'wechselt', 'Jungschar'],
      [15, 'bleibt', null],
    ]);
  });
});

describe('Regeln der Wechsel-Gruppe', () => {
  const [kinder, leitungen] = wechselGruppenRegeln(FISCHE_JUNGSCHAR, JAHRE, ROLLEN);
  const ZEILEN = [
    kind(11, '2017-09-30', 2),
    kind(12, '2017-10-01', 2),
    kind(13, null, 2),
    kind(14, '2013-01-01', 2),
    kind(17, '2017-01-01', 3), // schon in der Jungschar
    leitung(21, 2),
    leitung(22, 3),
    leitung(23, 4),
  ];

  it('nimmt im Fenster genau die Kinder auf, die laut Vorschau wechseln', () => {
    const vorschau = werWechselt(
      ZEILEN.filter((z) => z['role.type'] === 'participant').map((z) => ({
        personId: z['person.id'],
        gruppeId: z['groupmember.groupId'],
        geburtstag: z['person.birthday'],
      })),
      E,
      J2027,
    )
      .filter((x) => x.art === 'wechselt' && x.von.gruppeId === 2)
      .map((x) => x.personId);
    expect(vorschau).toEqual([11, 14]);
    for (const heute of [J2027.ankuendigung, J2027.wechseltag, '2027-09-19'])
      expect(passt(kinder, ZEILEN, heute), heute).toEqual(vorschau);
  });

  it('außerhalb der Fenster niemand: vor der Ankündigung, ab Ende der Aufnahme', () => {
    expect(passt(kinder, ZEILEN, '2027-07-11')).toEqual([]);
    expect(passt(kinder, ZEILEN, J2027.aufnahmeBis)).toEqual([]);
    expect(passt(kinder, ZEILEN, '2027-12-24')).toEqual([]);
  });

  it('im Folgejahr gilt der Stichtag des Folgejahres', () => {
    // 12 ist am 30.09.2028 elf → wechselt 2028; 11 ebenfalls noch (steht nach wie vor bei den Fischen).
    expect(passt(kinder, ZEILEN, JAHRE[1].wechseltag)).toEqual([11, 12, 14]);
  });

  it('Leitungs-Regel: Leitungen alter und neuer Gruppe, nicht die der übernächsten', () => {
    expect(passt(leitungen, ZEILEN, '2027-01-01')).toEqual([21, 22]);
    expect(leitungen.process.queryResultOnly).toEqual({
      none: { handleMembership: { groupTypeRoleId: 48, groupMemberStatus: 'active' } },
    });
  });

  it('nimmt als Teilnehmer der Wechsel-Gruppe auf', () => {
    expect(kinder.process.queryResultOnly).toEqual({
      none: { handleMembership: { groupTypeRoleId: 45, groupMemberStatus: 'active' } },
    });
  });
});

describe('Aufnahme in die neue, Austragen aus der alten Gruppe', () => {
  const W = 900;
  const aufnahme = aufnahmeRegel(FISCHE_JUNGSCHAR, W, JAHRE, 77);
  const ZEILEN = [
    kind(11, '2017-09-30', W),
    kind(12, '2017-01-01', W, 'to_delete'),
    leitung(21, W),
  ];

  it('nimmt am Wechseltag die aktiven Kinder auf, die Ausnahme („zu löschen“) und die Leitung nicht', () => {
    expect(passt(aufnahme, ZEILEN, J2027.wechseltag)).toEqual([11]);
    expect(aufnahme.process.queryResultOnly).toEqual({
      none: { handleMembership: { groupTypeRoleId: 77, groupMemberStatus: 'active' } },
    });
  });

  it('nur im Fenster ab dem Wechseltag – eine im Winter aufgehobene Ausnahme wirkt erst nächstes Jahr', () => {
    expect(passt(aufnahme, ZEILEN, plusTage(J2027.wechseltag, -1))).toEqual([]);
    expect(passt(aufnahme, ZEILEN, J2027.aufnahmeBis)).toEqual([]);
    const aufgehoben = [kind(12, '2017-01-01', W)];
    expect(passt(aufnahme, aufgehoben, '2028-01-15')).toEqual([]);
    expect(passt(aufnahme, aufgehoben, JAHRE[1].wechseltag)).toEqual([12]);
  });

  it('Austragen: wer aktiv als Teilnehmer in der neuen Gruppe ist – nur dann entfernt die Regel', () => {
    const r = austragRegel(FISCHE_JUNGSCHAR);
    expect(
      passt(r, [kind(11, null, 3), kind(12, null, 3, 'to_delete'), leitung(21, 3)], '2027-09-07'),
    ).toEqual([11]);
    expect(r.process.groupAndQueryResult.active).toEqual({
      handleMembership: { groupMemberStatus: 'none' },
    });
    expect(r.process.queryResultOnly).toEqual({ none: {} });
  });
});

describe('alle Regeln zusammen', () => {
  const WECHSEL = new Map([
    [1, 901],
    [2, 902],
    [3, 903],
    [4, 904],
  ]);
  const TEILNEHMER = new Map([1, 2, 3, 4, 5].map((g) => [g, 70 + g]));
  const ALLE = alleRegeln(E, JAHRE, WECHSEL, ROLLEN, TEILNEHMER);
  const kurz = (g: number) => (ALLE.get(g) ?? []).map((r) => r.shorty);

  it('je Gruppe die ganze Liste: erste Stufe nur austragen, mittlere beides, letzte nur aufnehmen', () => {
    expect(kurz(1)).toEqual(['gwaustragen']);
    expect(kurz(3)).toEqual(['gwaufnahme', 'gwaustragen']);
    expect(kurz(5)).toEqual(['gwaufnahme']);
    for (const w of WECHSEL.values()) expect(kurz(w)).toEqual(['gwkinder', 'gwleitung']);
  });

  it('die Aufnahme nimmt mit der Teilnehmer-Rolle der neuen Gruppe auf und liest aus der richtigen Wechsel-Gruppe', () => {
    const [aufnahme] = ALLE.get(3) ?? [];
    expect(aufnahme.process.queryResultOnly.none).toEqual({
      handleMembership: { groupTypeRoleId: 73, groupMemberStatus: 'active' },
    });
    expect(passt(aufnahme, [kind(11, null, 902), kind(12, null, 901)], J2027.wechseltag)).toEqual([
      11,
    ]);
  });

  it('fehlt die Wechsel-Gruppe eines Übergangs, fehlen dessen Regeln ganz', () => {
    const ohne = alleRegeln(E, JAHRE, new Map([[1, 901]]), ROLLEN, TEILNEHMER);
    expect([...ohne.keys()].sort()).toEqual([1, 2, 901]);
  });

  it('keine Regel entfernt jemanden – außer dem Austragen aus der alten Gruppe (T3)', () => {
    for (const regeln of ALLE.values())
      for (const r of regeln) {
        const entfernt = Object.entries({
          ...r.process.groupOnly,
          ...r.process.groupAndQueryResult,
        })
          .filter(([, v]) => JSON.stringify(v).includes('"none"'))
          .map(([k]) => k);
        expect(entfernt, r.shorty).toEqual(r.shorty === 'gwaustragen' ? ['active'] : []);
      }
  });

  it('jeder Status steht ausdrücklich da – auch „zu löschen“ (die Ausnahme) und angefragte/wartende Mitglieder', () => {
    for (const regeln of ALLE.values())
      for (const r of regeln)
        for (const teil of [r.process.groupOnly, r.process.groupAndQueryResult])
          expect(Object.keys(teil).sort(), r.shorty).toEqual([
            'active',
            'requested',
            'to_delete',
            'waiting',
          ]);
  });

  it('nur Operatoren, die ChurchTools kennt – kein `in` (O9-0)', () => {
    const erlaubt = new Set(['and', 'or', '==', '<', '<=', 'var', 'ct_date']);
    for (const regeln of ALLE.values())
      for (const r of regeln)
        for (const op of operatoren(r.query.params.filter))
          expect(erlaubt.has(op), `${r.shorty}: ${op}`).toBe(true);
  });
});

describe('Routine und Rechte', () => {
  it('Aufräum-Routine: aktive Teilnehmer nach 90 Tagen austragen', () => {
    expect(aufraeumRoutine(FISCHE_JUNGSCHAR, 902, ROLLEN, E)).toEqual({
      neu: {
        name: 'Gruppenwechsel Fische → Jungschar: aufräumen',
        domainType: 'group_membership',
        domainContext: { groupId: 902, groupTypeRoleId: 45, groupMemberStatus: 'active' },
        isEnabled: true,
      },
      schritte: [
        { actionKey: 'special:wait', isEnabled: true, actionData: { duration: { numDays: 90 } } },
        { actionKey: 'remove-member', isEnabled: true, actionData: {} },
      ],
    });
  });

  it('wer am ersten Tag der Ankündigung hineinkommt, ist erst nach dem Ende der Aufnahme wieder draußen', () => {
    for (const j of JAHRE)
      expect(plusTage(j.ankuendigung, E.aufraeumenTage) > j.aufnahmeBis).toBe(true);
  });

  it('Leiter-Rechte wie in O9-0 gemessen', () => {
    expect(LEITER_RECHTE.map((r) => [r.authId, r.dataId])).toEqual([
      [10101, 1],
      [10102, 1],
      [10108, null],
    ]);
  });

  it('Name der Wechsel-Gruppe', () => {
    expect(wechselGruppenName(FISCHE_JUNGSCHAR)).toBe('Fische → Jungschar');
  });
});

describe('einstellungFehler', () => {
  it('unsere Werte taugen', () => {
    expect(einstellungFehler(E)).toEqual([]);
  });

  it.each([
    ['nur eine Gruppe', { stufen: E.stufen.slice(0, 1) }, 'mindestens zwei'],
    ['Alter nicht steigend', { stufen: [E.stufen[1], E.stufen[0]] }, 'höheres Alter'],
    ['Gruppe doppelt', { stufen: [E.stufen[0], { ...E.stufen[1], gruppeId: 1 }] }, 'zweimal'],
    ['ohne Namen', { stufen: [E.stufen[0], { ...E.stufen[1], name: ' ' }] }, 'keinen Namen'],
    ['29.02.', { stichtag: '02-29' }, 'Stichtag'],
    ['Monat 13', { stichtag: '13-01' }, 'Stichtag'],
    ['falsches Format', { stichtag: '30.09.' }, 'Stichtag'],
    ['Aufräumen zu früh', { aufraeumenTage: 70 }, 'Aufräumen'],
    ['keine Aufnahme', { aufnahmeTage: 0 }, 'aufnehmen'],
    ['halbe Tage', { ankuendigungTage: 1.5 }, 'Ankündigung'],
    ['ohne Kalender', { ferienkalender: '' }, 'Ferienkalenders'],
  ] as const)('%s', (_, aenderung, teil) => {
    const f = einstellungFehler({ ...E, ...aenderung } as GruppenwechselEinstellung);
    expect(f.join(' ')).toContain(teil);
  });
});
