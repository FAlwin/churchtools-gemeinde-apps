import { describe, expect, it } from 'vitest';
import { tagKurz, tagPunkt } from '../ct/datum';
import {
  GRUNDWERTE,
  sommerferienAus,
  uebergaenge,
  wechselGruppenRegeln,
  wechseljahre,
  type Uebergang,
  type Wechseljahr,
} from './gruppenwechsel';
import { einrichtungAus, type Einrichtung } from './gruppenwechselEinrichtung';
import {
  gruppenSicht,
  wechslerZahl,
  type GruppenStand,
  type KjDaten,
  type KjMitglied,
} from './gruppenwechselSicht';
import {
  jahrStaende,
  kurz,
  leitungenNachricht,
  regelnReichenBis,
  tageHinweis,
  wechseltageStand,
  wechseltagText,
  type GruppenRegeln,
  type JahrStand,
} from './wechseltage';

// ── Erzeuger statt Literale: Einrichtung über `einrichtungAus`, Jahre über `sommerferienAus` + `wechseljahre` ──────────

const SCHAF = 1;
const FISCHE = 2;
const JUNGSCHAR = 3;
const W_SCHAF = 11;
const W_FISCHE = 12;

const EINRICHTUNG: Einrichtung = einrichtungAus({
  einstellung: {
    ...GRUNDWERTE,
    stufen: [
      { gruppeId: SCHAF, name: 'Schäfchen', abAlter: 4 },
      { gruppeId: FISCHE, name: 'Fische 7–9', abAlter: 7 },
      { gruppeId: JUNGSCHAR, name: 'Jungschar', abAlter: 10 },
    ],
  },
  bereichGruppeId: 9,
  wechselGruppen: [
    { vonGruppeId: SCHAF, nachGruppeId: FISCHE, gruppeId: W_SCHAF },
    { vonGruppeId: FISCHE, nachGruppeId: JUNGSCHAR, gruppeId: W_FISCHE },
  ],
})!;

const JAHRE: Wechseljahr[] = wechseljahre(
  sommerferienAus(
    [
      { titel: 'Sommerferien Nordrhein-Westfalen 2027', beginn: '2027-07-19', ende: '2027-08-31' },
      { titel: 'Sommerferien Nordrhein-Westfalen 2028', beginn: '2028-07-10', ende: '2028-08-22' },
      { titel: 'Sommerferien Nordrhein-Westfalen 2029', beginn: '2029-07-16', ende: '2029-08-28' },
    ],
    GRUNDWERTE.ferienStichwort,
  ),
  GRUNDWERTE,
);
const [J27] = JAHRE;
const U: Uebergang[] = uebergaenge(EINRICHTUNG.einstellung);
const ROLLEN = { teilnehmer: 1, leiter: 2 };

describe('wechseltageStand – die eine Regel für „läuft aus“', () => {
  it('ohne lesbare Regeln ist es nicht bekannt (keine Erinnerung)', () => {
    expect(wechseltageStand(undefined, 2027)).toEqual({ art: 'unbekannt' });
    expect(tageHinweis({ art: 'unbekannt' }, 'Schulferien NRW')).toBeNull();
  });

  it('nur noch das nächste Jahr drin → läuft bald aus', () => {
    expect(wechseltageStand(2027, 2027)).toEqual({ art: 'baldAus', bis: 2027 });
  });

  it('das nächste Jahr steht schon nicht mehr drin → fehlt ab diesem Jahr', () => {
    expect(wechseltageStand(2026, 2027)).toEqual({ art: 'fehlt', bis: 2026, ab: 2027 });
    expect(wechseltageStand(2020, 2027)).toEqual({ art: 'fehlt', bis: 2020, ab: 2027 });
  });

  it('mehr als das nächste Jahr drin → in Ordnung, kein Hinweis', () => {
    const s = wechseltageStand(2029, 2027);
    expect(s).toEqual({ art: 'ok', bis: 2029 });
    expect(tageHinweis(s, 'Schulferien NRW')).toBeNull();
  });

  it('Hinweis „bald“: Titel und Jahr – ohne Versprechen („Einrichten“, „mit einem Klick“)', () => {
    const h = tageHinweis(wechseltageStand(2027, 2027), 'Schulferien NRW')!;
    expect(h.titel).toBe('Wechseltage fehlen bald.');
    expect(h.text).toBe('Die Regeln reichen nur noch bis 2027.');
    expect(h.kurz).toBe('Die Regeln reichen nur noch bis 2027. Mehr unter „Wechseltage“.');
    expect(`${h.titel}${h.text}${h.kurz}`).not.toMatch(/Klick|Einrichten|Admin/);
  });

  it('Hinweis „fehlt“: nennt das erste fehlende Jahr und den Kalender', () => {
    const h = tageHinweis(wechseltageStand(2026, 2027), 'Schulferien NRW')!;
    expect(h.titel).toBe('Ab 2027 fehlen Wechseltage in den Regeln.');
    expect(h.text).toBe(
      'Die Sommerferien dafür stehen schon im Kalender „Schulferien NRW“ – rechtzeitig nachtragen.',
    );
    expect(h.kurz).toContain('Mehr unter „Wechseltage“');
    expect(`${h.titel}${h.text}${h.kurz}`).not.toMatch(/Klick|Einrichten|Admin/);
  });
});

describe('jahrStaende – gegen den Erzeuger geprüft', () => {
  const rollen = ROLLEN;
  const regelnBis = (u: Uebergang, letztes: number) =>
    wechselGruppenRegeln(
      u,
      JAHRE.filter((j) => j.jahr <= letztes),
      rollen,
    );
  const gruppen = (bisA: number, bisB: number) => [
    { uebergang: U[0], regeln: regelnBis(U[0], bisA) },
    { uebergang: U[1], regeln: regelnBis(U[1], bisB) },
  ];
  const arten = (g: GruppenRegeln[]) => jahrStaende(g, JAHRE).map((x) => x.stand.art);

  /** ChurchTools darf die Schlüssel anders ordnen. */
  const umgekehrt = (x: unknown): unknown =>
    Array.isArray(x)
      ? x.map(umgekehrt)
      : x && typeof x === 'object'
        ? Object.fromEntries(
            Object.entries(x)
              .reverse()
              .map(([k, v]) => [k, umgekehrt(v)]),
          )
        : x;

  it('Regeln, wie die Erweiterung sie schreibt, ergeben „eingetragen“ für genau die Jahre darin', () => {
    expect(arten(gruppen(2028, 2028))).toEqual(['eingetragen', 'eingetragen', 'fehlt']);
    expect(arten(gruppen(2027, 2027))).toEqual(['eingetragen', 'fehlt', 'fehlt']);
    expect(arten(gruppen(2029, 2029))).toEqual(['eingetragen', 'eingetragen', 'eingetragen']);
  });

  it('auch in anderer Schlüsselreihenfolge und in `data` verpackt', () => {
    const g = gruppen(2028, 2028);
    expect(
      jahrStaende(
        g.map((x) => ({ ...x, regeln: umgekehrt(x.regeln) })),
        JAHRE,
      ).map((x) => x.stand.art),
    ).toEqual(['eingetragen', 'eingetragen', 'fehlt']);
    expect(
      jahrStaende(
        g.map((x) => ({ ...x, regeln: { data: x.regeln } })),
        JAHRE,
      ).map((x) => x.stand.art),
    ).toEqual(['eingetragen', 'eingetragen', 'fehlt']);
  });

  it('nur in einem Teil der Wechsel-Gruppen → „unvollständig“ mit den fehlenden Übergängen', () => {
    const st = jahrStaende(gruppen(2029, 2027), JAHRE);
    expect(st[0].stand).toEqual({ art: 'eingetragen' });
    expect(st[1].stand).toEqual({ art: 'unvollstaendig', fehlend: ['Fische 7–9 → Jungschar'] });
    expect(st[2].stand).toEqual({ art: 'unvollstaendig', fehlend: ['Fische 7–9 → Jungschar'] });
  });

  it('leere Regel-Liste: „fehlt“; Fenster einer anderen Stufe zählen nicht (anderes „geboren bis“)', () => {
    expect(arten([{ uebergang: U[1], regeln: [] }])).toEqual(['fehlt', 'fehlt', 'fehlt']);
    expect(arten([{ uebergang: U[1], regeln: wechselGruppenRegeln(U[0], JAHRE, rollen) }])).toEqual(
      ['fehlt', 'fehlt', 'fehlt'],
    );
  });

  it('ohne Wechsel-Gruppen ist nichts „eingetragen“', () => {
    expect(jahrStaende([], JAHRE).map((x) => x.stand.art)).toEqual(['fehlt', 'fehlt', 'fehlt']);
  });

  it('ein handgeschriebenes Fenster, das nicht dem Erzeuger entspricht, zählt nicht', () => {
    const hand = { and: [{ '<=': ['2026-11-01', { ct_date: ['now'] }] }] };
    expect(arten([{ uebergang: U[1], regeln: [{ filter: hand }] }])).toEqual([
      'fehlt',
      'fehlt',
      'fehlt',
    ]);
  });
});

describe('regelnReichenBis – lückenlose Kette ab dem nächsten Wechsel', () => {
  const e: JahrStand = { art: 'eingetragen' };
  const f: JahrStand = { art: 'fehlt' };
  const u: JahrStand = { art: 'unvollstaendig', fehlend: ['x'] };
  const st = (...arten: JahrStand[]) => arten.map((stand, i) => ({ jahr: 2027 + i, stand }));

  it('alles eingetragen → bis zum letzten Jahr', () => {
    expect(regelnReichenBis(st(e, e, e), 2027)).toBe(2029);
  });
  it('Kette bricht an einer Lücke ab – spätere Jahre zählen nicht', () => {
    expect(regelnReichenBis(st(e, f, e), 2027)).toBe(2027);
  });
  it('schon das nächste Jahr fehlt oder ist unvollständig → bis davor', () => {
    expect(regelnReichenBis(st(f, e, e), 2027)).toBe(2026);
    expect(regelnReichenBis(st(u, e, e), 2027)).toBe(2026);
  });
  it('Jahre vor dem nächsten Wechsel werden übersprungen', () => {
    expect(regelnReichenBis(st(f, e, e), 2028)).toBe(2029);
  });
  it('ohne Jahre: bis vor das nächste Jahr', () => {
    expect(regelnReichenBis([], 2027)).toBe(2026);
  });
});

describe('Datumstexte', () => {
  it('Wechseltag mit Wochentag aus den gemeinsamen Datums-Helfern', () => {
    expect(wechseltagText(J27.wechseltag)).toBe(
      `${tagKurz(J27.wechseltag).split(',')[0]}, ${tagPunkt(J27.wechseltag)}`,
    );
    expect(wechseltagText(J27.wechseltag)).toBe('Mo, 06.09.2027');
  });

  it('kurz: erster Teil des Namens', () => {
    expect(kurz('Fische 7–9')).toBe('Fische');
    expect(kurz('Jungschar')).toBe('Jungschar');
  });
});

describe('leitungenNachricht', () => {
  const kind = (personId: number, status: KjMitglied['status'] = 'active'): KjMitglied => ({
    personId,
    name: `Kind ${personId}`,
    leitung: false,
    status,
    statusGeaendert: null,
  });
  const sichtbar = (...mitglieder: KjMitglied[]): GruppenStand => ({ art: 'sichtbar', mitglieder });
  const daten = (ueber: Partial<Record<number, GruppenStand>> = {}): KjDaten => ({
    gruppen: new Map<number, GruppenStand>(
      Object.entries({
        [SCHAF]: sichtbar(kind(101)),
        [FISCHE]: sichtbar(kind(201), kind(202), kind(204)),
        [JUNGSCHAR]: sichtbar(kind(301)),
        [W_SCHAF]: sichtbar(),
        // Kind 204 ist als Ausnahme eingetragen (Status „zu löschen“ in der Wechsel-Gruppe).
        [W_FISCHE]: sichtbar(kind(204, 'to_delete')),
        ...ueber,
      }).map(([k, v]) => [Number(k), v]),
    ),
    geburtstage: new Map<number, string | null>([
      [101, '2020-09-30'], // am Stichtag 7 → wechselt zu den Fischen
      [201, '2017-09-30'], // am Stichtag 10 → wechselt
      [202, '2017-10-01'], // am Stichtag 9 → bleibt
      [204, '2016-05-05'], // alt genug, aber Ausnahme
      [301, '2009-01-01'],
    ]),
  });
  const sichten = (d: KjDaten) =>
    EINRICHTUNG.einstellung.stufen.flatMap(
      (s) => gruppenSicht(EINRICHTUNG, s.gruppeId, d, J27, J27.ankuendigung, 'immer') ?? [],
    );

  it('nennt den Wechseltag, bittet um Prüfung und zählt je Übergang – ohne Ausnahmen', () => {
    const s = sichten(daten());
    const fische = s.find((x) => x.stufe.gruppeId === FISCHE)!;
    // Die Ausnahme zählt zu „wechseln“ in der Liste, aber nicht als Wechsler.
    expect(fische.wechseln).toHaveLength(2);
    expect(wechslerZahl(fische)).toBe(1);
    const text = leitungenNachricht(J27, s);
    expect(text).toContain(`Wechseltag ist ${wechseltagText(J27.wechseltag)}.`);
    expect(text).toContain('Bitte schaut in ChurchTools im Organigramm unter „Kinder & Jugend“');
    expect(text).toContain(`• Fische → Jungschar: ${wechslerZahl(fische)} Kind\n`.trim());
    expect(text).toContain(
      `• Schäfchen → Fische: ${wechslerZahl(s.find((x) => x.stufe.gruppeId === SCHAF)!)} Kind`,
    );
    // Die letzte Stufe wechselt nirgends hin: keine Zeile.
    expect(text).not.toContain('Jungschar →');
  });

  it('jede Zahl ist dieselbe wie die der Übersicht; Mehrzahl heißt „Kinder“', () => {
    const d = daten({
      [FISCHE]: sichtbar(kind(201), kind(206)),
    });
    d.geburtstage = new Map([...d.geburtstage, [206, '2017-09-01']]);
    const s = sichten(d);
    const fische = s.find((x) => x.stufe.gruppeId === FISCHE)!;
    expect(wechslerZahl(fische)).toBe(2);
    expect(leitungenNachricht(J27, s)).toContain('• Fische → Jungschar: 2 Kinder');
  });

  it('nicht lesbare Stufe: keine erfundene Null', () => {
    const s = sichten(daten({ [FISCHE]: { art: 'verborgen' } }));
    const text = leitungenNachricht(J27, s);
    expect(text).toContain('• Fische → Jungschar: Zahl gerade nicht lesbar');
    expect(text).not.toContain('Fische → Jungschar: 0');
  });
});
