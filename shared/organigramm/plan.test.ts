import { describe, expect, it } from 'vitest';
import type { OrgGruppe } from './gruppen';
import {
  angelegt,
  archivieren,
  einhaengen,
  hatAenderungen,
  KEINE_AENDERUNGEN,
  neueEntfernen,
  neueGruppe,
  planAus,
  planGruppen,
  planUntergruppen,
  umbauSchritte,
  umbenennen,
  wieHeute,
  type Heute,
  type PlanAenderungen,
} from './plan';

const g = (id: number, name: string, statusId = 1, typId = 2): OrgGruppe => ({
  id,
  name,
  typId,
  statusId,
  farbe: null,
});
// Wie im Entwurf: Gottesdienst (10) → Technik (7) → Stream (12); Café Team (47); Bibelarbeit (37); Sommerfest (50)
const HEUTE: Heute = {
  gruppen: [
    g(10, 'Gottesdienst'),
    g(7, 'Technik'),
    g(12, 'Stream'),
    g(47, 'Café Team'),
    g(37, 'Bibelarbeit'),
    g(50, 'Sommerfest'),
  ],
  eltern: new Map([
    [7, [10]],
    [12, [7]],
  ]),
};
const ARCHIVIERT = 3;
const zeile = (a: PlanAenderungen, ref: number | string) =>
  planGruppen(HEUTE, a).find((x) => x.ref === ref)!;

/** Der Plan aus dem Entwurf: Bereich „Gemeinschaft“ neu, Café Team + Bibelarbeit hinein, Bibelarbeit → „Bibelabend“,
 * „Hauskreise“ neu unter Gemeinschaft, Sommerfest archivieren. */
function beispiel() {
  const { aenderungen: a1, id: gem } = neueGruppe(KEINE_AENDERUNGEN, 'Gemeinschaft', 2, null);
  let a = einhaengen(HEUTE, a1, 47, gem);
  a = einhaengen(HEUTE, a, 37, gem);
  a = umbenennen(HEUTE, a, 37, 'Bibelabend');
  a = neueGruppe(a, 'Hauskreise', 1, gem).aenderungen;
  a = archivieren(a, 50, true);
  return { a, gem };
}

describe('planGruppen – heute + Änderungen', () => {
  it('ohne Änderungen = Kopie von heute (erste sichtbare Obergruppe)', () => {
    const p = planGruppen(HEUTE, KEINE_AENDERUNGEN);
    expect(p.map((x) => [x.ref, x.eltern])).toEqual([
      [10, null],
      [7, 10],
      [12, 7],
      [47, null],
      [37, null],
      [50, null],
    ]);
    expect(hatAenderungen(KEINE_AENDERUNGEN)).toBe(false);
  });

  it('Beispiel aus dem Entwurf: neu, umgehängt, umbenannt (mit „heute“), archiviert', () => {
    const { a, gem } = beispiel();
    expect(zeile(a, gem)).toMatchObject({
      name: 'Gemeinschaft',
      neu: true,
      eltern: null,
      heute: null,
    });
    expect(zeile(a, 37)).toMatchObject({
      name: 'Bibelabend',
      eltern: gem,
      heute: { name: 'Bibelarbeit', eltern: null },
    });
    expect(zeile(a, 50).archiv).toBe(true);
    expect(zeile(a, 'n2')).toMatchObject({ name: 'Hauskreise', eltern: gem, typId: 1 });
  });

  it('Obergruppe = die erste SICHTBARE (eine unsichtbare davor zählt nicht)', () => {
    const mitUnsichtbarer: Heute = {
      ...HEUTE,
      eltern: new Map([...HEUTE.eltern, [47, [999, 10]]]),
    };
    expect(planGruppen(mitUnsichtbarer, KEINE_AENDERUNGEN).find((x) => x.ref === 47)?.eltern).toBe(
      10,
    );
  });

  it('eine später in ChurchTools angelegte Gruppe erscheint von selbst im Plan', () => {
    const { a } = beispiel();
    const spaeter: Heute = { ...HEUTE, gruppen: [...HEUTE.gruppen, g(99, 'Neu in CT')] };
    expect(planGruppen(spaeter, a).some((x) => x.ref === 99)).toBe(true);
  });

  it('Verweis auf eine Gruppe, die es nicht mehr gibt → eigener Bereich', () => {
    const a = einhaengen(HEUTE, KEINE_AENDERUNGEN, 47, 777);
    expect(zeile(a, 47).eltern).toBeNull();
  });
});

describe('Änderungen – „wie heute“ fällt wieder heraus', () => {
  it('zurück zum heutigen Namen / zur heutigen Obergruppe → keine Änderung mehr', () => {
    let a = umbenennen(HEUTE, KEINE_AENDERUNGEN, 7, 'Medien');
    a = umbenennen(HEUTE, a, 7, ' Technik ');
    a = einhaengen(HEUTE, a, 12, 10);
    a = einhaengen(HEUTE, a, 12, 7);
    expect(hatAenderungen(a)).toBe(false);
  });

  it('wieHeute nimmt Name, Obergruppe und Archiv zurück', () => {
    const { a } = beispiel();
    const b = wieHeute(wieHeute(a, 37), 50);
    expect(zeile(b, 37)).toMatchObject({ name: 'Bibelarbeit', eltern: null });
    expect(zeile(b, 50).archiv).toBe(false);
  });

  it('neue Gruppe entfernen: neue darunter mit weg, bestehende bleiben, wo sie heute sind', () => {
    const { a, gem } = beispiel();
    // Stream hängt heute unter Technik – der Plan wollte es in die neue Gruppe
    const mitStream = einhaengen(HEUTE, a, 12, gem);
    const b = neueEntfernen(HEUTE, mitStream, gem);
    expect(b.neu).toEqual([]);
    expect(zeile(b, 47).eltern).toBeNull();
    expect(zeile(b, 12).eltern).toBe(7);
    expect(umbauSchritte(HEUTE, b, ARCHIVIERT).some((x) => x.art === 'um')).toBe(false);
    expect(b.namen).toEqual({ '37': 'Bibelabend' });
  });

  it('angelegt: eigene ID wird überall zur echten', () => {
    const { a, gem } = beispiel();
    const b = angelegt(a, gem, 500);
    expect(b.neu.map((x) => [x.name, x.eltern])).toEqual([['Hauskreise', 500]]);
    expect(b.eltern).toEqual({ '47': 500, '37': 500 });
  });

  it('planUntergruppen: über neue und bestehende Gruppen (für „kein Kreis“)', () => {
    const { a, gem } = beispiel();
    expect([...planUntergruppen(planGruppen(HEUTE, a), gem)].sort()).toEqual([37, 47, 'n2']);
    expect([...planUntergruppen(planGruppen(HEUTE, a), 10)].sort()).toEqual([12, 7]);
  });
});

describe('umbauSchritte', () => {
  it('Reihenfolge neu → umhängen → umbenennen → archivieren; Einhängen in Neues wartet', () => {
    const { a, gem } = beispiel();
    const s = umbauSchritte(HEUTE, a, ARCHIVIERT);
    expect(s.map((x) => x.art)).toEqual(['neu', 'neu', 'um', 'um', 'name', 'arch']);
    expect(s.map((x) => x.wartetAuf)).toEqual([null, gem, gem, gem, null, null]);
    expect(s.every((x) => !x.erledigt)).toBe(true);
  });

  it('erledigt, sobald ChurchTools so aussieht – auch wenn es jemand direkt dort gemacht hat', () => {
    const { a } = beispiel();
    const b = angelegt(a, 'n1', 500);
    const danach: Heute = {
      gruppen: [
        ...HEUTE.gruppen.map((x) =>
          x.id === 37
            ? { ...x, name: 'Bibelabend' }
            : x.id === 50
              ? { ...x, statusId: ARCHIVIERT }
              : x,
        ),
        g(500, 'Gemeinschaft'),
      ],
      eltern: new Map([...HEUTE.eltern, [47, [500]], [37, [500]]]),
    };
    const s = umbauSchritte(danach, b, ARCHIVIERT);
    expect(s.filter((x) => x.art !== 'neu').every((x) => x.erledigt)).toBe(true);
    // Hauskreise wartet nicht mehr (Gemeinschaft gibt es jetzt), ist aber noch offen
    expect(s[0]).toMatchObject({
      art: 'neu',
      name: 'Hauskreise',
      wartetAuf: null,
      erledigt: false,
    });
  });

  it('Umhängen ersetzt ALLE heutigen Obergruppen: zwei Obergruppen → noch nicht erledigt', () => {
    const a = einhaengen(HEUTE, KEINE_AENDERUNGEN, 12, 10);
    const zwei: Heute = { ...HEUTE, eltern: new Map([...HEUTE.eltern, [12, [7, 10]]]) };
    expect(umbauSchritte(zwei, a, ARCHIVIERT)[0].erledigt).toBe(false);
  });

  it('neue Gruppe schon da (gleicher Name, gleiche Obergruppe) → erledigt, mit gefundener ID', () => {
    const a = neueGruppe(KEINE_AENDERUNGEN, 'Kamera', 2, 7).aenderungen;
    const da: Heute = {
      ...HEUTE,
      gruppen: [...HEUTE.gruppen, g(88, 'kamera')],
      eltern: new Map([...HEUTE.eltern, [88, [7]]]),
    };
    expect(umbauSchritte(da, a, ARCHIVIERT)[0]).toMatchObject({ erledigt: true, gefunden: 88 });
    // gleicher Name, aber woanders → nicht dieselbe
    const woanders: Heute = {
      ...HEUTE,
      gruppen: [...HEUTE.gruppen, g(88, 'Kamera')],
      eltern: new Map([...HEUTE.eltern, [88, [10]]]),
    };
    expect(umbauSchritte(woanders, a, ARCHIVIERT)[0].erledigt).toBe(false);
  });

  it('Archivieren ohne bekannten Status „archiviert“ gilt nie als erledigt; Gruppen, die es nicht mehr gibt, fallen weg', () => {
    const a = archivieren(einhaengen(HEUTE, KEINE_AENDERUNGEN, 999, 10), 50, true);
    const s = umbauSchritte(
      { ...HEUTE, gruppen: HEUTE.gruppen.map((x) => (x.id === 50 ? { ...x, statusId: 3 } : x)) },
      a,
      null,
    );
    expect(s).toEqual([{ art: 'arch', id: 50, erledigt: false, wartetAuf: null }]);
    // auch wenn ChurchTools für die Gruppe keinen Status nennt (null === null wäre sonst „erledigt“)
    const ohneStatus: Heute = {
      ...HEUTE,
      gruppen: HEUTE.gruppen.map((x) => (x.id === 50 ? { ...x, statusId: null } : x)),
    };
    expect(
      umbauSchritte(ohneStatus, archivieren(KEINE_AENDERUNGEN, 50, true), null)[0].erledigt,
    ).toBe(false);
  });
});

describe('planAus – gespeicherten Inhalt prüfen', () => {
  it('ein gültiger Plan kommt unverändert zurück', () => {
    const { a } = beispiel();
    expect(planAus(JSON.parse(JSON.stringify(a)))).toEqual(a);
  });

  it('kaputte Teile fallen weg, statt die Seite zu brechen; kein Objekt → null', () => {
    expect(
      planAus({
        neu: [
          { id: 'n1', name: 'Gut', typId: 2, eltern: null },
          { id: 'x', name: 'Böse' },
          { id: 'n2', name: '  ', typId: 2, eltern: null },
          null,
        ],
        eltern: { '7': 10, abc: 1, '12': 'kaputt' },
        namen: { '7': 'Medien', '9': '' },
        archiv: [50, 'x', 1.5],
      }),
    ).toEqual({
      neu: [{ id: 'n1', name: 'Gut', typId: 2, eltern: null }],
      eltern: { '7': 10 },
      namen: { '7': 'Medien' },
      archiv: [50],
    });
    expect(planAus('kein Plan')).toBeNull();
    expect(planAus(null)).toBeNull();
  });
});
