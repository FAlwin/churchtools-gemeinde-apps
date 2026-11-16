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
  abweichungText,
  jahrStatus,
  kurz,
  leitungenNachricht,
  regelAbweichungen,
  tageHinweis,
  wechseltageStand,
  wechseltagText,
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
const [J27, J28, J29] = JAHRE;
const U: Uebergang[] = uebergaenge(EINRICHTUNG.einstellung);
const FISCHE_JUNGSCHAR = U[1];
const ROLLEN = { teilnehmer: 1, leiter: 2 };

describe('wechseltageStand – die eine Regel für „läuft aus“', () => {
  it('ohne „eingetragen bis“ ist es nicht bekannt (kein Hinweis)', () => {
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

  it('Hinweis „bald“: Titel, Jahr und Weg – auf der Seite ausführlich, in der Übersicht kurz', () => {
    const h = tageHinweis(wechseltageStand(2027, 2027), 'Schulferien NRW')!;
    expect(h.titel).toBe('Wechseltage fehlen bald.');
    expect(h.text).toContain('nur noch bis 2027');
    expect(h.text).toContain('Admin Bescheid geben');
    expect(h.kurz).toBe('Eingetragen sind sie nur noch bis 2027. Mehr unter „Wechseltage“.');
  });

  it('Hinweis „fehlt“: nennt das erste fehlende Jahr und den Kalender', () => {
    const h = tageHinweis(wechseltageStand(2026, 2027), 'Schulferien NRW')!;
    expect(h.titel).toBe('Ab 2027 fehlen Wechseltage.');
    expect(h.text).toContain('„Schulferien NRW“');
    expect(h.kurz).toContain('Mehr unter „Wechseltage“');
  });

  it('Status je Jahr: bis einschließlich „eingetragen bis“ eingetragen, danach fehlt es, ohne Angabe unbekannt', () => {
    expect(jahrStatus(2028, 2028)).toBe('eingetragen');
    expect(jahrStatus(2028, 2027)).toBe('eingetragen');
    expect(jahrStatus(2028, 2029)).toBe('fehlt');
    expect(jahrStatus(undefined, 2029)).toBe('unbekannt');
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

describe('regelAbweichungen – gegen den Erzeuger geprüft', () => {
  const regelnBis = (letztes: number) =>
    wechselGruppenRegeln(
      FISCHE_JUNGSCHAR,
      JAHRE.filter((j) => j.jahr <= letztes),
      ROLLEN,
    );
  const abw = (bis: number, regeln: unknown, jahre: readonly Wechseljahr[] = JAHRE) =>
    regelAbweichungen(FISCHE_JUNGSCHAR, W_FISCHE, jahre, bis, regeln);

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

  it('Regeln, wie die Erweiterung sie schreibt, passen zu „eingetragen bis“ – für jedes Jahr', () => {
    expect(abw(2028, regelnBis(2028))).toEqual([]);
    expect(abw(2027, regelnBis(2027))).toEqual([]);
    expect(abw(2029, regelnBis(2029))).toEqual([]);
  });

  it('auch in anderer Schlüsselreihenfolge und in `data` verpackt', () => {
    expect(abw(2028, umgekehrt(regelnBis(2028)))).toEqual([]);
    expect(abw(2028, { data: regelnBis(2028) })).toEqual([]);
  });

  it('ein Jahr bis „eingetragen bis“ fehlt in den Regeln → „fehlt“ mit Gruppe und Jahr', () => {
    expect(abw(2029, regelnBis(2028))).toEqual([
      { gruppeId: W_FISCHE, uebergang: 'Fische 7–9 → Jungschar', jahr: 2029, art: 'fehlt' },
    ]);
  });

  it('Jahre über „eingetragen bis“ hinaus in den Regeln → „zuviel“', () => {
    expect(abw(2027, regelnBis(2029))).toEqual([
      expect.objectContaining({ jahr: 2028, art: 'zuviel' }),
      expect.objectContaining({ jahr: 2029, art: 'zuviel' }),
    ]);
  });

  it('leere Regel-Liste: alle eingetragenen Jahre fehlen', () => {
    expect(abw(2028, []).map((a) => [a.jahr, a.art])).toEqual([
      [2027, 'fehlt'],
      [2028, 'fehlt'],
    ]);
  });

  it('Fenster einer anderen Stufe zählen nicht (anderes „geboren bis“)', () => {
    const andere = wechselGruppenRegeln(U[0], JAHRE, ROLLEN);
    expect(abw(2029, andere).map((a) => a.art)).toEqual(['fehlt', 'fehlt', 'fehlt']);
  });

  it('nur die übergebenen Jahre werden geprüft (ein vergangenes darf aus den Regeln gefallen sein)', () => {
    expect(abw(2029, regelnBis(2029).slice(0, 0), [J28, J29]).map((a) => a.jahr)).toEqual([
      2028, 2029,
    ]);
    expect(J27.jahr).toBe(2027);
  });

  it('Text: Gruppe, Jahr und Art der Abweichung', () => {
    const text = abweichungText(
      [...abw(2029, regelnBis(2028)), ...abw(2027, regelnBis(2028))],
      2029,
    );
    expect(text).toBe(
      'Die Regeln in ChurchTools passen nicht zu „eingetragen bis 2029“: Fische 7–9 → Jungschar: 2029 fehlt, 2028 steht zusätzlich da.',
    );
  });
});
