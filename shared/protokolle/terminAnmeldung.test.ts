import { describe, expect, it } from 'vitest';
import { eintragVorbelegung, type Eintrag } from './termine';
import { eintragZusatz } from './terminFelder';
import { WIEDERHOLUNG } from './terminWiederholung';
import {
  anmeldungErklaerung,
  anmeldungFuss,
  anmeldungHinweis,
  anmeldungSchalterText,
  anmeldungTermine,
  anmeldungVorgabe,
  gruppenAus,
  gruppenName,
  gruppentypenAus,
  signupAus,
  signupRumpf,
  tageOptionen,
  vorschauText,
} from './terminAnmeldung';

/** Anmeldung (W15-5): Regeln ohne ChurchTools – gemessen 25.11.2026 (TEST-Termin 496). */
const TYPEN = [
  { id: 5, name: 'Anmeldung' },
  { id: 1, name: 'Kleingruppe' },
];
/** Der gemessene TEST-Termin: wöchentlich 26.11.–24.12.2026 18:00Z (= 19:00 Ortszeit), Beginn 26.11. */
const reihe = (extra: Partial<Eintrag> = {}): Eintrag => ({
  ...eintragVorbelegung({ text: 'TEST, 19 Uhr', datum: '2026-11-26' }, 4),
  art: WIEDERHOLUNG.woechentlich,
  frequenz: 1,
  wiederBis: '2026-12-24',
  ...extra,
});
const einzeln = (): Eintrag => eintragVorbelegung({ text: 'TEST, 19 Uhr', datum: '2026-11-30' }, 4);

describe('anmeldungVorgabe', () => {
  it('Kleingruppe (1), wenn erlaubt – auch wenn sie nicht vorn steht', () => {
    expect(anmeldungVorgabe(TYPEN)).toEqual({ typ: 1, tage: 14, vorlage: null, beenden: null });
  });
  it('sonst der erste erlaubte', () => {
    expect(
      anmeldungVorgabe([
        { id: 5, name: 'A' },
        { id: 7, name: 'B' },
      ]).typ,
    ).toBe(5);
  });
  it('ohne Typ: null (der Aufrufer zeigt den Schalter dann gar nicht erst)', () => {
    expect(anmeldungVorgabe([]).typ).toBeNull();
  });
});

describe('gruppentypenAus', () => {
  const roh = [
    { id: 1, name: 'Kleingruppe', nameTranslated: 'Kleingruppe (de)' },
    { id: 2, name: 'Dienst' },
    { id: 5, name: 'Anmeldung', nameTranslated: '' },
    { id: '6', name: 'Text-ID' },
    null,
  ];
  it('nur die erlaubten, in der Reihenfolge von ChurchTools; übersetzter Name vor dem Namen', () => {
    expect(gruppentypenAus(roh, new Set([5, 1]))).toEqual([
      { id: 1, name: 'Kleingruppe (de)' },
      { id: 5, name: 'Anmeldung' },
    ]);
  });
  it('keine Liste oder keine erlaubten: leer', () => {
    expect(gruppentypenAus(null, new Set([1]))).toEqual([]);
    expect(gruppentypenAus(roh, new Set())).toEqual([]);
  });
});

describe('gruppenAus und tageOptionen', () => {
  it('Gruppen nach Name sortiert, ohne Einträge ohne Nummer', () => {
    expect(gruppenAus([{ id: 2, name: 'b' }, { id: 1, name: 'a' }, { name: 'x' }, null])).toEqual([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ]);
  });
  it('die festen Tage – und ein fremder Wert aus einer Vorlage kommt dazu (keine unsichtbare Wahl)', () => {
    expect(tageOptionen(14)).toEqual([1, 7, 14, 30, 90, 365]);
    expect(tageOptionen(null)).toEqual([1, 7, 14, 30, 90, 365]);
    expect(tageOptionen(21)).toEqual([1, 7, 14, 21, 30, 90, 365]);
  });
});

describe('anmeldungTermine (die eine Rechnung für Vorschau, Fuß und Nachlesen)', () => {
  const an = { tage: 14 };
  it('gemessen: heute 25.11. + 14 Tage → 26.11. und 03.12., nicht 10.12.', () => {
    expect(anmeldungTermine(reihe(), an, '2026-11-25').map((t) => t.tag)).toEqual([
      '2026-11-26',
      '2026-12-03',
    ]);
  });
  it('die Grenzen gelten einschließlich: heute selbst und heute + N', () => {
    const e = reihe({ tag: '2026-11-25', wiederBis: '2026-12-09' });
    expect(anmeldungTermine(e, an, '2026-11-25').map((t) => t.tag)).toEqual([
      '2026-11-25',
      '2026-12-02',
      '2026-12-09',
    ]);
    // einen Tag später: der 25.11. liegt in der Vergangenheit, der 16.12. noch außerhalb
    expect(anmeldungTermine(e, an, '2026-11-26').map((t) => t.tag)).toEqual([
      '2026-12-02',
      '2026-12-09',
    ]);
  });
  it('Termine in der Vergangenheit und hinter der Grenze zählen nicht', () => {
    expect(anmeldungTermine(einzeln(), an, '2026-12-15')).toEqual([]);
    expect(anmeldungTermine(einzeln(), { tage: 1 }, '2026-11-20')).toEqual([]);
    expect(anmeldungTermine(einzeln(), { tage: 7 }, '2026-11-23')).toEqual([
      { tag: '2026-11-30', zeit: '19:00' },
    ]);
  });
  it('mehr Tage im Voraus → mehr Gruppen', () => {
    expect(anmeldungTermine(reihe(), { tage: 30 }, '2026-11-25')).toHaveLength(5);
  });
  it('Ausnahmen und weitere Termine rechnet die Reihe selbst', () => {
    const e = reihe({ ausnahmen: ['2026-12-03'], weitere: ['2026-12-01'] });
    expect(anmeldungTermine(e, an, '2026-11-25').map((t) => t.tag)).toEqual([
      '2026-11-26',
      '2026-12-01',
    ]);
  });
  it('ohne Schalter keine; ganztägig ohne Uhrzeit', () => {
    expect(anmeldungTermine(reihe(), null, '2026-11-25')).toEqual([]);
    const ganz = { ...einzeln(), ganztaegig: true };
    expect(anmeldungTermine(ganz, { tage: 90 }, '2026-11-25')).toEqual([
      { tag: '2026-11-30', zeit: '' },
    ]);
  });
});

describe('Namen und Texte', () => {
  it('Vorschau „– 30.11.2026 14:00“ (ohne Komma), Gruppenname „<Titel> – 30.11.2026, 14:00“ (mit Komma)', () => {
    const t = { tag: '2026-11-30', zeit: '14:00' };
    expect(vorschauText(t)).toBe('– 30.11.2026 14:00');
    expect(gruppenName(' TEST ', t)).toBe('TEST – 30.11.2026, 14:00');
    const g = { tag: '2026-11-30', zeit: '' };
    expect(vorschauText(g)).toBe('– 30.11.2026');
    expect(gruppenName('TEST', g)).toBe('TEST – 30.11.2026');
  });
  it('Einzahl bei genau einem Einzeltermin, sonst Mehrzahl mit dem Satz zur Wiederholung', () => {
    expect(anmeldungSchalterText(1)).toBe('Gruppe für Anmeldung erstellen');
    expect(anmeldungSchalterText(5)).toBe('Gruppen für Anmeldung erstellen');
    expect(anmeldungErklaerung(1)).toBe(
      'Für einen Kalendereintrag wird automatisch eine Gruppe erstellt. Dies hat keine Auswirkung auf bereits erstellte Gruppen.',
    );
    expect(anmeldungErklaerung(4)).toBe(
      `${anmeldungErklaerung(1)} Für jede Wiederholung wird eine separate Gruppe erstellt.`,
    );
  });
  it('der Fuß nennt die Zahl; bei 0 sagt er nichts', () => {
    expect(anmeldungFuss(0)).toBeNull();
    expect(anmeldungFuss(1)).toBe('Beim Speichern legt ChurchTools sofort 1 Gruppe an.');
    expect(anmeldungFuss(2)).toBe('Beim Speichern legt ChurchTools sofort 2 Gruppen an.');
  });
});

describe('signupRumpf und eintragZusatz', () => {
  it('Schalter aus oder kein Typ: kein signup', () => {
    expect(signupRumpf(null)).toBeNull();
    expect(signupRumpf({ typ: null, tage: 14, vorlage: null, beenden: null })).toBeNull();
  });
  it('leere Auswahlen fehlen – die Namen wie gemessen', () => {
    expect(signupRumpf({ typ: 5, tage: 14, vorlage: null, beenden: null })).toEqual({
      signupGroupTypeId: 5,
      signupDaysForwardNo: 14,
    });
    expect(signupRumpf({ typ: 5, tage: 14, vorlage: 352, beenden: 7 })).toEqual({
      signupGroupTypeId: 5,
      signupDaysForwardNo: 14,
      signupTemplateGroupId: 352,
      signupDaysArchiveGroupNo: 7,
    });
  });
  it('der Eintrag wird dazu übersetzt – ohne Schalter nichts', () => {
    expect(eintragZusatz(reihe(), false).signup).toBeUndefined();
    const e = reihe({ anmeldung: { typ: 5, tage: 14, vorlage: null, beenden: 7 } });
    expect(eintragZusatz(e, false).signup).toEqual({
      signupGroupTypeId: 5,
      signupDaysForwardNo: 14,
      signupDaysArchiveGroupNo: 7,
    });
  });
});

describe('signupAus', () => {
  it('liest Typ und Tage – auch den veralteten Doppelgänger', () => {
    expect(signupAus({ signupGroupTypeId: 5, signupDaysForwardNo: 14 })).toEqual({
      typ: 5,
      tage: 14,
    });
    expect(signupAus({ signupGroupTypeId: 5, singupDaysForwardNo: 7 })).toEqual({
      typ: 5,
      tage: 7,
    });
  });
  it('null, Liste oder Zahl: keine Anmeldung', () => {
    for (const x of [null, undefined, [], 3, 'x']) expect(signupAus(x)).toBeNull();
  });
});

describe('anmeldungHinweis', () => {
  const ok = { signupFehlt: false, fehlend: [], unklar: false };
  it('alles da: kein Hinweis', () => {
    expect(anmeldungHinweis(ok)).toBeNull();
  });
  it('signup nicht gespeichert, Gruppe fehlt, Lesefehler: drei verschiedene Sätze', () => {
    const a = anmeldungHinweis({ ...ok, signupFehlt: true });
    const b = anmeldungHinweis({ ...ok, fehlend: ['TEST – 26.11.2026, 19:00'] });
    const c = anmeldungHinweis({ ...ok, unklar: true });
    expect(new Set([a, b, c]).size).toBe(3);
    expect(a).toContain('nicht gespeichert');
    expect(b).toContain('„TEST – 26.11.2026, 19:00“');
    expect(c).toContain('nicht nachlesen');
    // Lesefehler heißt nie „fehlt“.
    expect(c).not.toContain('nicht angelegt');
  });
  it('mehrere fehlende: Mehrzahl', () => {
    expect(anmeldungHinweis({ ...ok, fehlend: ['a', 'b'] })).toContain(
      'Diese Gruppen wurden nicht angelegt',
    );
  });
});
