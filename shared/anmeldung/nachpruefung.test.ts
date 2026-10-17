import { describe, expect, it } from 'vitest';
import { neueEinstellungen } from './vorlagen';
import { nachpruefen, type PruefMitglied } from './nachpruefung';
import { aufschluesselungText, betragAus, wartelistenZeile } from './senden';
import { euroText } from './preis';
import type { OeffentlicheEinstellungen } from './formular';

/**
 * Nachprüfung (A6-5c, #623). Die gemeldeten Beträge kommen aus `betragAus` – dem Erzeuger im Formular –, nicht aus
 * handgeschriebenen Zahlen: So prüft der Test, dass Formular und Nachprüfung dieselbe Regel haben.
 */
function kinder15(): OeffentlicheEinstellungen {
  const e = neueEinstellungen('kinder');
  e.preis.grundpreis = { ...e.preis.grundpreis, art: 'fest', betragCent: 1500, gilt: 'person' };
  return e;
}
const ANGEMELDET = '2026-10-17';

let naechste = 1;
function person(
  name: string,
  status: PruefMitglied['status'],
  felder: PruefMitglied['felder'] = {},
  seit = ANGEMELDET,
): PruefMitglied {
  return { personId: naechste++, name, status, seit, geburtstag: '2018-05-01', felder };
}

/** Was das Formular bei der ersten Person schreibt – mit seinem eigenen Rechenweg. */
function erste(
  e: OeffentlicheEinstellungen,
  name: string,
  nr: string,
  personen: { name: string; platz: boolean }[],
  status: PruefMitglied['status'] = 'aktiv',
): PruefMitglied {
  const b = betragAus(
    e,
    {
      anmeldung: {},
      personen: personen.map((p) => ({
        pname: { vor: p.name.split(' ')[0], nach: p.name.split(' ')[1] },
        birth: '2018-05-01',
      })),
    },
    { option: 0, extras: [] },
    ANGEMELDET,
    personen.map((p) => p.platz),
  );
  return person(name, status, {
    nr,
    kontakt: 'Erna Nummer',
    betrag: euroText(b.gesamtCent),
    aufschluesselung: [
      ...(b.posten.length ? [aufschluesselungText(b.preis)] : []),
      ...b.warten.map(wartelistenZeile),
    ].join('\n'),
  });
}

const PLAETZE = { belegt: 5, wartend: 0, max: 10 };

describe('Beträge', () => {
  it('stimmt alles → kein Befund, aber geprüft', () => {
    const e = kinder15();
    const n = nachpruefen(
      e,
      [
        erste(e, 'Kalle Nummer', 'AAAAAA', [
          { name: 'Kalle Nummer', platz: true },
          { name: 'Kira Nummer', platz: true },
        ]),
        person('Kira Nummer', 'aktiv', { nr: 'AAAAAA' }),
      ],
      PLAETZE,
    );
    expect([n.betraege, n.geprueft, n.hinweise]).toEqual([[], 1, 0]);
  });

  it('Kira stand auf der Warteliste und ist nachgerückt → „nachgerückt“, neuer Betrag', () => {
    const e = kinder15();
    const n = nachpruefen(
      e,
      [
        erste(e, 'Kalle Nummer', 'AAAAAA', [
          { name: 'Kalle Nummer', platz: true },
          { name: 'Kira Nummer', platz: false },
        ]),
        person('Kira Nummer', 'aktiv', { nr: 'AAAAAA' }),
      ],
      PLAETZE,
    );
    expect(n.betraege).toEqual([
      expect.objectContaining({
        grund: 'nachgerueckt',
        name: 'Erna Nummer',
        gemeldetCent: 1500,
        sollCent: 3000,
        nachgerueckt: ['Kira Nummer'],
      }),
    ]);
    expect(n.hinweise).toBe(1);
  });

  it('Kira wartet noch → stimmt (sie zählt erst beim Nachrücken)', () => {
    const e = kinder15();
    const n = nachpruefen(
      e,
      [
        erste(e, 'Kalle Nummer', 'AAAAAA', [
          { name: 'Kalle Nummer', platz: true },
          { name: 'Kira Nummer', platz: false },
        ]),
        person('Kira Nummer', 'wartet', { nr: 'AAAAAA' }),
      ],
      PLAETZE,
    );
    expect(n.betraege).toEqual([]);
  });

  it('zu wenig gemeldet (z. B. untergeschoben) → „weicht ab“', () => {
    const e = kinder15();
    const k = erste(e, 'Kalle Nummer', 'AAAAAA', [{ name: 'Kalle Nummer', platz: true }]);
    k.felder.betrag = euroText(0);
    const n = nachpruefen(e, [k], PLAETZE);
    expect(n.betraege).toEqual([
      expect.objectContaining({ grund: 'abweichend', gemeldetCent: 0, sollCent: 1500 }),
    ]);
  });

  it('mehr gemeldet als jetzt nötig (jemand hat abgesagt) → „weniger“', () => {
    const e = kinder15();
    const n = nachpruefen(
      e,
      [
        erste(e, 'Kalle Nummer', 'AAAAAA', [
          { name: 'Kalle Nummer', platz: true },
          { name: 'Kira Nummer', platz: true },
        ]),
        // Kira hat abgesagt – sie ist nicht mehr in der Gruppe.
      ],
      PLAETZE,
    );
    expect(n.betraege).toEqual([
      expect.objectContaining({ grund: 'weniger', gemeldetCent: 3000, sollCent: 1500 }),
    ]);
  });

  it('Preise nach der Anmeldung geändert → nur Info, zählt nicht als Hinweis', () => {
    const vorher = kinder15();
    const k = erste(vorher, 'Kalle Nummer', 'AAAAAA', [{ name: 'Kalle Nummer', platz: true }]);
    const jetzt = kinder15();
    jetzt.preis.grundpreis.betragCent = 2000;
    jetzt.preiseGeaendert = '2026-10-18';
    const n = nachpruefen(jetzt, [k], PLAETZE);
    expect(n.betraege).toEqual([
      expect.objectContaining({
        grund: 'preise',
        angemeldetAm: ANGEMELDET,
        preiseGeaendert: '2026-10-18',
      }),
    ]);
    expect(n.hinweise).toBe(0);
  });

  it('Preise VOR der Anmeldung geändert → kein Grund, der Betrag weicht ab', () => {
    const e = kinder15();
    const k = erste(e, 'Kalle Nummer', 'AAAAAA', [{ name: 'Kalle Nummer', platz: true }]);
    k.felder.betrag = euroText(500);
    e.preiseGeaendert = '2026-10-01';
    expect(nachpruefen(e, [k], PLAETZE).betraege[0].grund).toBe('abweichend');
  });

  it('ohne Anmelde-Nr. (vor A6-5a) und kostenlos → nicht geprüft', () => {
    const e = kinder15();
    const ohneNr = erste(e, 'Kalle Alt', 'X', [{ name: 'Kalle Alt', platz: true }]);
    delete ohneNr.felder.nr;
    ohneNr.felder.betrag = euroText(0);
    expect(nachpruefen(e, [ohneNr], PLAETZE).geprueft).toBe(0);
    const frei = neueEinstellungen('kinder');
    const k = erste(frei, 'Kalle Nummer', 'AAAAAA', [{ name: 'Kalle Nummer', platz: true }]);
    expect(nachpruefen(frei, [k], PLAETZE).geprueft).toBe(0);
  });
});

describe('Plätze und Auswahl', () => {
  it('Plätze frei, aber jemand wartet → Hinweis; voll mit Wartenden → kein Hinweis', () => {
    const e = kinder15();
    expect(nachpruefen(e, [], { belegt: 9, wartend: 2, max: 10 }).plaetze.wartenTrotzPlatz).toBe(
      true,
    );
    expect(nachpruefen(e, [], { belegt: 10, wartend: 2, max: 10 }).plaetze.wartenTrotzPlatz).toBe(
      false,
    );
    expect(nachpruefen(e, [], { belegt: 3, wartend: 1, max: null }).hinweise).toBe(1);
  });

  it('Belegung je Auswahl: ausgebucht, überbucht (zählt als Hinweis), unbegrenzt', () => {
    const e = kinder15();
    e.preis.grundpreis = {
      art: 'auswahl',
      betragCent: 0,
      gilt: 'person',
      auswahlName: 'Zimmer',
      optionen: [
        { name: 'Zwei', preisCent: 0, kontingent: 1, belegt: 0, personenJe: 2 },
        { name: 'Drei', preisCent: 0, kontingent: 1, belegt: 0, personenJe: 3 },
        { name: 'Vier', preisCent: 0, kontingent: 0, belegt: 0, personenJe: 0 },
      ],
    };
    const m = (nr: string, wahl: string) => person(nr, 'aktiv', { nr, auswahl: wahl });
    const n = nachpruefen(
      e,
      [m('A', 'Zwei'), m('B', 'Drei'), m('C', 'Drei'), m('D', 'Vier')],
      PLAETZE,
    );
    expect(n.auswahl?.optionen.map((o) => [o.name, o.belegt, o.zustand])).toEqual([
      ['Zwei', 1, 'ausgebucht'],
      ['Drei', 2, 'ueberbucht'],
      ['Vier', 1, 'unbegrenzt'],
    ]);
    expect(n.hinweise).toBe(1);
    expect(nachpruefen(kinder15(), [], PLAETZE).auswahl).toBeNull();
  });
});
