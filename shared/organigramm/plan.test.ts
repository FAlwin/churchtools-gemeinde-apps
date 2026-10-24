import { describe, expect, it } from 'vitest';
import type { OrgGruppe } from './gruppen';
import {
  angelegt,
  archivieren,
  ausfuehrbar,
  einhaengen,
  hatAenderungen,
  KEINE_AENDERUNGEN,
  neueEntfernen,
  neueGruppe,
  nichtAngelegt,
  planAus,
  planBaum,
  planGruppen,
  planUnterschied,
  planUntergruppen,
  planZiele,
  type PlanKnoten,
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
/** In ChurchTools archiviert: keine (ChurchTools liefert archivierte Gruppen nur eigens – Messung O7-3). */
const KEINE_ARCHIVIERT = new Map<number, string>();
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
    expect(umbauSchritte(HEUTE, b, KEINE_ARCHIVIERT).some((x) => x.art === 'um')).toBe(false);
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
    const s = umbauSchritte(HEUTE, a, KEINE_ARCHIVIERT);
    expect(s.map((x) => x.art)).toEqual(['neu', 'neu', 'um', 'um', 'name', 'arch']);
    expect(s.map((x) => x.wartetAuf)).toEqual([null, gem, gem, gem, null, null]);
    expect(s.every((x) => !x.erledigt)).toBe(true);
  });

  it('erledigt, sobald ChurchTools so aussieht – auch wenn es jemand direkt dort gemacht hat', () => {
    const { a } = beispiel();
    const b = angelegt(a, 'n1', 500);
    // Sommerfest (50) ist archiviert – ChurchTools liefert es dann nicht mehr in der Gruppenliste
    const danach: Heute = {
      gruppen: [
        ...HEUTE.gruppen
          .filter((x) => x.id !== 50)
          .map((x) => (x.id === 37 ? { ...x, name: 'Bibelabend' } : x)),
        g(500, 'Gemeinschaft'),
      ],
      eltern: new Map([...HEUTE.eltern, [47, [500]], [37, [500]]]),
    };
    const s = umbauSchritte(danach, b, new Map([[50, 'Sommerfest']]));
    expect(s.find((x) => x.art === 'arch')).toMatchObject({ id: 50, erledigt: true });
    expect(s.filter((x) => x.art !== 'neu').every((x) => x.erledigt)).toBe(true);
    // Gemeinschaft hat der Umbau angelegt → bleibt als erledigt stehen (verschwindet nicht aus der Liste)
    expect(s[0]).toMatchObject({
      art: 'neu',
      name: 'Gemeinschaft',
      erledigt: true,
      vermerkt: true,
      gefunden: 500,
      eltern: null,
    });
    // Hauskreise wartet nicht mehr (Gemeinschaft gibt es jetzt), ist aber noch offen
    expect(s[1]).toMatchObject({
      art: 'neu',
      name: 'Hauskreise',
      wartetAuf: null,
      erledigt: false,
    });
  });

  it('Umhängen ersetzt ALLE heutigen Obergruppen: zwei Obergruppen → noch nicht erledigt', () => {
    const a = einhaengen(HEUTE, KEINE_AENDERUNGEN, 12, 10);
    const zwei: Heute = { ...HEUTE, eltern: new Map([...HEUTE.eltern, [12, [7, 10]]]) };
    expect(umbauSchritte(zwei, a, KEINE_ARCHIVIERT)[0].erledigt).toBe(false);
  });

  it('neue Gruppe schon da (gleicher Name, gleiche Obergruppe) → erledigt, mit gefundener ID', () => {
    const a = neueGruppe(KEINE_AENDERUNGEN, 'Kamera', 2, 7).aenderungen;
    const da: Heute = {
      ...HEUTE,
      gruppen: [...HEUTE.gruppen, g(88, 'kamera')],
      eltern: new Map([...HEUTE.eltern, [88, [7]]]),
    };
    expect(umbauSchritte(da, a, KEINE_ARCHIVIERT)[0]).toMatchObject({
      erledigt: true,
      gefunden: 88,
    });
    // gleicher Name, aber woanders → nicht dieselbe
    const woanders: Heute = {
      ...HEUTE,
      gruppen: [...HEUTE.gruppen, g(88, 'Kamera')],
      eltern: new Map([...HEUTE.eltern, [88, [10]]]),
    };
    expect(umbauSchritte(woanders, a, KEINE_ARCHIVIERT)[0].erledigt).toBe(false);
  });

  it('Archivieren: erledigt nur, wenn ChurchTools die Gruppe als archiviert führt; unbekannt (null) → nie', () => {
    const a = archivieren(einhaengen(HEUTE, KEINE_AENDERUNGEN, 999, 10), 50, true);
    // 999 gibt es nicht → kein Umhängen-Schritt; Sommerfest noch aktiv → offen
    expect(umbauSchritte(HEUTE, a, KEINE_ARCHIVIERT)).toEqual([
      { art: 'arch', id: 50, erledigt: false, wartetAuf: null, untergruppen: [] },
    ]);
    const weg: Heute = { ...HEUTE, gruppen: HEUTE.gruppen.filter((x) => x.id !== 50) };
    expect(umbauSchritte(weg, a, new Map([[50, 'Sommerfest']]))[0].erledigt).toBe(true);
    // archiviert-Liste unbekannt: die Gruppe ist aus der Liste verschwunden → gibt es nicht (mehr), kein Schritt
    expect(umbauSchritte(weg, a, null)).toEqual([]);
    expect(umbauSchritte(HEUTE, a, null)[0].erledigt).toBe(false);
  });

  it('umbenannt und danach archiviert: das Umbenennen bleibt als erledigt stehen (Test-Instanz 24.10.2026)', () => {
    const a = archivieren(umbenennen(HEUTE, KEINE_AENDERUNGEN, 50, 'Herbstfest'), 50, true);
    const weg: Heute = { ...HEUTE, gruppen: HEUTE.gruppen.filter((x) => x.id !== 50) };
    expect(umbauSchritte(weg, a, new Map([[50, 'Herbstfest']]))).toEqual([
      { art: 'name', id: 50, name: 'Herbstfest', erledigt: true, wartetAuf: null },
      { art: 'arch', id: 50, erledigt: true, wartetAuf: null, untergruppen: [] },
    ]);
    // archiviert, aber unter altem Namen → Umbenennen offen
    expect(umbauSchritte(weg, a, new Map([[50, 'Sommerfest']]))[0].erledigt).toBe(false);
  });

  it('Archivieren wartet, solange in ChurchTools noch Gruppen darunter hängen', () => {
    // Technik archivieren – Stream hängt darunter
    const a = archivieren(KEINE_AENDERUNGEN, 7, true);
    const s = umbauSchritte(HEUTE, a, KEINE_ARCHIVIERT);
    expect(s[0]).toMatchObject({ art: 'arch', untergruppen: [12] });
    expect(ausfuehrbar(s[0])).toBe(false);
    // Stream umgehängt (in ChurchTools schon erledigt) → frei
    const umgehaengt: Heute = { ...HEUTE, eltern: new Map([[7, [10]]]) };
    const t = umbauSchritte(umgehaengt, a, KEINE_ARCHIVIERT);
    expect(t[0]).toMatchObject({ untergruppen: [] });
    expect(ausfuehrbar(t[0])).toBe(true);
  });

  it('ein Verweis auf eine eigene ID, die es im Plan nicht (mehr) gibt, wartet – nie mit ihr nach ChurchTools', () => {
    const a: PlanAenderungen = { ...KEINE_AENDERUNGEN, eltern: { '47': 'n9' } };
    const [s] = umbauSchritte(HEUTE, a, KEINE_ARCHIVIERT);
    expect(s).toMatchObject({ art: 'um', wartetAuf: 'n9' });
    expect(ausfuehrbar(s)).toBe(false);
  });

  it('planAus übernimmt die vom Umbau angelegten Gruppen (nur ganze Zahlen)', () => {
    expect(planAus({ ...KEINE_AENDERUNGEN, angelegt: [500, 'x', 1.5] })?.angelegt).toEqual([500]);
    expect(planAus(KEINE_AENDERUNGEN)).not.toHaveProperty('angelegt');
  });

  it('ausfuehrbar: nicht erledigt und wartet auf nichts', () => {
    const { a } = beispiel();
    expect(umbauSchritte(HEUTE, a, KEINE_ARCHIVIERT).map(ausfuehrbar)).toEqual([
      true,
      false,
      false,
      false,
      true,
      true,
    ]);
  });

  it('eine neue Gruppe, die es schon gibt, hält niemanden auf – Wartende bekommen ihre ChurchTools-ID', () => {
    const { a } = beispiel();
    // Gemeinschaft hat jemand direkt in ChurchTools angelegt (als Bereich); der Plan kennt sie noch als n1
    const da: Heute = { ...HEUTE, gruppen: [...HEUTE.gruppen, g(500, 'Gemeinschaft')] };
    const s = umbauSchritte(da, a, KEINE_ARCHIVIERT);
    expect(s[0]).toMatchObject({ art: 'neu', id: 'n1', erledigt: true, gefunden: 500 });
    expect(s[1]).toMatchObject({ art: 'neu', name: 'Hauskreise', eltern: 500, wartetAuf: null });
    expect(s.filter((x) => x.art === 'um')).toEqual([
      { art: 'um', id: 37, eltern: 500, erledigt: false, wartetAuf: null },
      { art: 'um', id: 47, eltern: 500, erledigt: false, wartetAuf: null },
    ]);
    // …und eine darunter, die es auch schon gibt, wird über die gefundene Obergruppe erkannt
    const beide: Heute = {
      gruppen: [...da.gruppen, g(501, 'Hauskreise')],
      eltern: new Map([...HEUTE.eltern, [501, [500]]]),
    };
    expect(umbauSchritte(beide, a, KEINE_ARCHIVIERT)[1]).toMatchObject({
      erledigt: true,
      gefunden: 501,
    });
  });

  it('nichtAngelegt ist die genaue Umkehrung von angelegt', () => {
    const { a, gem } = beispiel();
    const n = a.neu.find((x) => x.id === gem)!;
    const zurueck = nichtAngelegt(angelegt(a, gem, 500), n, 500);
    const sortiert = (x: ReturnType<typeof planGruppen>) =>
      x.slice().sort((p, q) => String(p.ref).localeCompare(String(q.ref)));
    expect(sortiert(planGruppen(HEUTE, zurueck))).toEqual(sortiert(planGruppen(HEUTE, a)));
    expect(zurueck.eltern).toEqual(a.eltern);
    expect(zurueck.neu.slice().sort((x, y) => x.id.localeCompare(y.id))).toEqual(a.neu);
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

describe('Ansicht (O7-2)', () => {
  const namen = (k: PlanKnoten[]): unknown[] =>
    k.map((x) => (x.kinder.length ? [x.gruppe.name, namen(x.kinder)] : x.gruppe.name));

  it('planBaum: Bereiche und Untergruppen nach Namen, neue Gruppen am Platz des Plans', () => {
    const { a } = beispiel();
    expect(namen(planBaum(planGruppen(HEUTE, a)))).toEqual([
      ['Gemeinschaft', ['Bibelabend', 'Café Team', 'Hauskreise']],
      ['Gottesdienst', [['Technik', ['Stream']]]],
      'Sommerfest',
    ]);
  });

  it('planBaum: ein Kreis (Plan gegen ChurchTools) verschwindet nicht – eine Gruppe daraus wird Bereich', () => {
    // Plan: Gottesdienst unter Stream. Heute: Stream unter Technik unter Gottesdienst → Kreis aus drei Gruppen.
    const a = einhaengen(HEUTE, KEINE_AENDERUNGEN, 10, 12);
    const baum = planBaum(planGruppen(HEUTE, a));
    const alle = (k: PlanKnoten[]): string[] =>
      k.flatMap((x) => [x.gruppe.name, ...alle(x.kinder)]);
    expect(alle(baum).sort()).toEqual(
      ['Bibelarbeit', 'Café Team', 'Gottesdienst', 'Sommerfest', 'Stream', 'Technik'].sort(),
    );
    expect(alle(baum)).toHaveLength(6);
  });

  it('planUnterschied: Marken und „vorher …“; neue Gruppen nur „neu“', () => {
    const { a, gem } = beispiel();
    const name = (id: number) => HEUTE.gruppen.find((x) => x.id === id)?.name ?? '';
    expect(planUnterschied(zeile(a, 37), name)).toEqual({
      marken: ['umgehängt', 'umbenannt'],
      vorher: 'vorher eigener Bereich · vorher „Bibelarbeit“',
    });
    expect(planUnterschied(zeile(a, 50), name)).toEqual({
      marken: ['wird archiviert'],
      vorher: null,
    });
    expect(planUnterschied(zeile(a, gem), name)).toEqual({ marken: ['neu'], vorher: null });
    expect(planUnterschied(zeile(a, 7), name)).toEqual({ marken: [], vorher: null });
    const b = einhaengen(HEUTE, KEINE_AENDERUNGEN, 12, null);
    expect(planUnterschied(zeile(b, 12), name).vorher).toBe('vorher unter „Technik“');
  });

  it('planZiele: ohne sich selbst, Untergruppen, jetzige Obergruppe und Archiviertes; Weg von oben', () => {
    const { a, gem } = beispiel();
    const plan = planGruppen(HEUTE, a);
    const ziele = planZiele(plan, 7);
    expect(ziele.map((z) => z.pfad.join(' › '))).toEqual([
      'Gemeinschaft',
      'Gemeinschaft › Bibelabend',
      'Gemeinschaft › Café Team',
      'Gemeinschaft › Hauskreise',
    ]);
    // eine neue Gruppe: alles außer ihr selbst und ihrer Obergruppe
    expect(planZiele(plan, 'n2').map((z) => z.gruppe.ref)).not.toContain(gem);
    expect(planZiele(plan, 'n2').map((z) => z.gruppe.ref)).toContain(10);
  });
});
