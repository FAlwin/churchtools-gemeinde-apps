import { describe, expect, it } from 'vitest';
import {
  alleAuf,
  alleZu,
  anfangsOffen,
  anordnen,
  GEMEINDE,
  HOEHE,
  kantenPfad,
  knotenAmPfad,
  pfadVon,
  SCHALTER,
  schalterStummel,
  sichtbarerBaum,
  spitzenWahl,
  type Anordnung,
  type AnordnungsArt,
  type Hoehe,
  type SichtKnoten,
} from './ansichten';
import type { Knoten } from './gruppen';

const g = (id: number, name: string, kinder: Knoten[] = []): Knoten => ({
  gruppe: { id, name, typId: 2, statusId: 1, farbe: null },
  kinder,
});
/** Wie im Entwurf: drei Bereiche, Untergruppen bis zur dritten Ebene; die Jugendband hat zwei Obergruppen. */
const band = () => g(30, 'Jugendband');
const BAUM: Knoten[] = [
  g(1, 'Gottesdienst', [
    g(2, 'Musik', [g(3, 'Band'), g(4, 'Chor'), band()]),
    g(5, 'Technik', [g(6, 'Ton'), g(7, 'Stream')]),
    g(8, 'Predigt'),
  ]),
  g(10, 'Gemeinschaft', [g(11, 'Hauskreise', [g(12, 'Hauskreis Nord')]), g(13, 'Café')]),
  g(40, 'Jugend', [band(), g(41, 'Teenkreis')]),
];
const breite = (k: SichtKnoten) => 60 + k.name.length * 7;
const namen = (k: SichtKnoten): unknown =>
  k.kinder.length ? [k.name, k.kinder.map(namen)] : k.name;
const alle = (k: SichtKnoten): SichtKnoten[] => [k, ...k.kinder.flatMap(alle)];

describe('Pfade', () => {
  it('knotenAmPfad folgt den IDs von oben; ein Pfad, den es nicht gibt → null', () => {
    expect(knotenAmPfad(BAUM, '1/2/4')?.gruppe.name).toBe('Chor');
    expect(knotenAmPfad(BAUM, '1/4')).toBeNull();
    expect(knotenAmPfad(BAUM, '99')).toBeNull();
  });

  it('pfadVon findet die erste Stelle – bei zwei Obergruppen die erste im Baum', () => {
    expect(pfadVon(BAUM, 30)).toBe('1/2/30');
    expect(pfadVon(BAUM, 12)).toBe('10/11/12');
    expect(pfadVon(BAUM, 99)).toBeNull();
  });
});

describe('sichtbarerBaum', () => {
  it('trägt Farbe und Typ jeder Gruppe – für die Kachel (O7b-8); die Gemeinde hat keine', () => {
    const baum = [
      { gruppe: { id: 3, name: 'Chor', typId: 5, statusId: 1, farbe: 'pink' }, kinder: [] },
    ];
    const s = sichtbarerBaum(baum, 'G', null, anfangsOffen(baum));
    expect([s.farbe, s.typId]).toEqual([null, null]);
    expect(s.kinder[0]).toMatchObject({ id: 3, farbe: 'pink', typId: 5 });
  });

  it('anfangs: die Gemeinde oben, die Bereiche offen, darunter zu – mit Zahl der versteckten Untergruppen', () => {
    const s = sichtbarerBaum(BAUM, 'Beispielgemeinde', null, anfangsOffen(BAUM));
    expect(s).toMatchObject({
      schluessel: GEMEINDE,
      id: null,
      name: 'Beispielgemeinde',
      ebene: 0,
      kinderZahl: 3,
    });
    expect(namen(s)).toEqual([
      'Beispielgemeinde',
      [
        ['Gottesdienst', ['Musik', 'Technik', 'Predigt']],
        ['Gemeinschaft', ['Hauskreise', 'Café']],
        ['Jugend', ['Jugendband', 'Teenkreis']],
      ],
    ]);
    const musik = alle(s).find((k) => k.name === 'Musik');
    expect(musik).toMatchObject({
      schluessel: '1/2',
      ebene: 2,
      kinderZahl: 3,
      offen: false,
      kinder: [],
    });
  });

  it('eine Gruppe mit zwei Obergruppen steht unter beiden – jede Stelle klappt für sich', () => {
    const offen = new Set([...anfangsOffen(BAUM), '1/2']);
    const bands = alle(sichtbarerBaum(BAUM, 'G', null, offen)).filter((k) => k.id === 30);
    expect(bands.map((k) => k.schluessel)).toEqual(['1/2/30', '40/30']);
    const zu = new Set([...offen].filter((p) => p !== '40'));
    expect(
      alle(sichtbarerBaum(BAUM, 'G', null, zu))
        .filter((k) => k.id === 30)
        .map((k) => k.schluessel),
    ).toEqual(['1/2/30']);
  });

  it('Spitze = eine Gruppe: sie ist Ebene 0, ihre Untergruppen Ebene 1, Schlüssel bleiben die ganzen Pfade', () => {
    const s = sichtbarerBaum(BAUM, 'G', '1', new Set(['1', '1/5']));
    expect(s).toMatchObject({ schluessel: '1', name: 'Gottesdienst', ebene: 0 });
    expect(s.kinder.map((k) => [k.schluessel, k.ebene])).toEqual([
      ['1/2', 1],
      ['1/5', 1],
      ['1/8', 1],
    ]);
    expect(s.kinder[1].kinder.map((k) => k.schluessel)).toEqual(['1/5/6', '1/5/7']);
  });

  it('eine Spitze, die es nicht mehr gibt (Typ ausgeblendet, in ChurchTools gelöscht), fällt auf die Gemeinde zurück', () => {
    expect(sichtbarerBaum(BAUM, 'G', '1/99', anfangsOffen(BAUM)).schluessel).toBe(GEMEINDE);
  });

  it('alles = true zeigt alles, egal was zugeklappt ist (Drucken)', () => {
    const s = sichtbarerBaum(BAUM, 'G', null, new Set(), true);
    expect(alle(s)).toHaveLength(1 + 16);
    expect(alle(s).every((k) => k.offen)).toBe(true);
  });

  it('die zugeklappte Gemeinde zeigt nur sich – mit der Zahl der Bereiche', () => {
    const s = sichtbarerBaum(BAUM, 'G', null, new Set());
    expect(s).toMatchObject({ offen: false, kinder: [], kinderZahl: 3 });
  });
});

describe('spitzenWahl', () => {
  it('ganze Gemeinde, jeder Bereich – eine tiefere Spitze zusätzlich, eine verschwundene nicht', () => {
    expect(spitzenWahl(BAUM, null).map((w) => w.name)).toEqual([
      'Ganze Gemeinde',
      'Gottesdienst',
      'Gemeinschaft',
      'Jugend',
    ]);
    expect(spitzenWahl(BAUM, '10').map((w) => w.wert)).toEqual(['', '1', '10', '40']);
    expect(spitzenWahl(BAUM, '1/2').at(-1)).toEqual({ wert: '1/2', name: 'Musik' });
    expect(spitzenWahl(BAUM, '1/99')).toHaveLength(4);
  });
});

describe('alleAuf / alleZu', () => {
  it('alleAuf öffnet alles unter der Spitze, nicht daneben', () => {
    const neu = alleAuf(BAUM, '10', new Set(['1']));
    expect([...neu].sort()).toEqual(['1', '10', '10/11']);
  });

  it('alleZu schließt unter der Spitze, die Spitze selbst bleibt offen, daneben bleibt alles', () => {
    const neu = alleZu(BAUM, '1', new Set(['1', '1/2', '1/5', '10', '10/11']));
    expect([...neu].sort()).toEqual(['1', '10', '10/11']);
    expect([...alleZu(BAUM, null, new Set(['1', '1/2', '40']))]).toEqual([GEMEINDE]);
  });

  it('auf der ganzen Gemeinde gehört die Gemeinde dazu', () => {
    const neu = alleAuf(BAUM, null, new Set());
    expect(neu.has(GEMEINDE)).toBe(true);
    expect(neu.has('40')).toBe(true);
    expect(neu.has('1/8')).toBe(false); // Predigt hat keine Untergruppen
  });
});

// ── Anordnung ──

const ueberlappen = (a: { x: number; y: number; breite: number; hoehe: number }, b: typeof a) =>
  a.x < b.x + b.breite && b.x < a.x + a.breite && a.y < b.y + b.hoehe && b.y < a.y + a.hoehe;

/** Kästchen mit Personen darunter (O7b-6): unterschiedlich hoch, bis gut dreimal so hoch wie nur mit dem Namen. */
const hoch: Hoehe = (k) => (k.id === null ? HOEHE : HOEHE + ((k.id * 37) % 5) * 22);

/** Jede Kante endet an einem eigenen Kästchen (links, rechts oder oben in der Mitte) – und jedes außer der Spitze hat eine. */
function andocken(a: Anordnung) {
  const punkte = new Map<string, string>();
  for (const k of a.knoten) {
    const m = k.y + HOEHE / 2;
    punkte.set(`${k.x},${m}`, k.knoten.schluessel);
    punkte.set(`${k.x + k.breite},${m}`, k.knoten.schluessel);
    punkte.set(`${k.x + k.breite / 2},${k.y}`, k.knoten.schluessel);
  }
  return a.kanten.map((e) => {
    const p = e.punkte[e.punkte.length - 1];
    return punkte.get(`${p.x},${p.y}`) ?? `frei ${p.x},${p.y}`;
  });
}

const offenTief = new Set([...anfangsOffen(BAUM), '1/2', '1/5', '10/11']);
const ARTEN: AnordnungsArt[] = ['oben', 'links', 'mindmap'];

describe('anordnen – für alle Arten', () => {
  const varianten: [string, Hoehe | undefined][] = [
    ['nur Namen', undefined],
    ['mit Personen (O7b-6)', hoch],
  ];
  for (const art of ARTEN) {
    for (const [wie, hoehe] of varianten)
      describe(`${art}, ${wie}`, () => {
        const s = sichtbarerBaum(BAUM, 'Beispielgemeinde', null, offenTief);
        const a = anordnen(art, s, breite, hoehe);

        it('jedes sichtbare Kästchen genau einmal, in der gemessenen Breite und Höhe', () => {
          expect(a.knoten.map((k) => k.knoten.schluessel).sort()).toEqual(
            alle(s)
              .map((k) => k.schluessel)
              .sort(),
          );
          for (const k of a.knoten) expect(k.breite).toBe(breite(k.knoten));
          for (const k of a.knoten) expect(k.hoehe).toBe((hoehe ?? (() => HOEHE))(k.knoten));
          if (hoehe) expect(new Set(a.knoten.map((k) => k.hoehe)).size).toBeGreaterThan(2);
        });

        it('keine zwei Kästchen liegen übereinander', () => {
          for (let i = 0; i < a.knoten.length; i++)
            for (let j = i + 1; j < a.knoten.length; j++)
              expect(
                ueberlappen(a.knoten[i], a.knoten[j]),
                `${a.knoten[i].knoten.name} / ${a.knoten[j].knoten.name}`,
              ).toBe(false);
        });

        it('jede Untergruppe hängt an genau einer Kante, die an ihrem Kästchen endet', () => {
          const enden = andocken(a);
          expect(enden.sort()).toEqual(
            alle(s)
              .slice(1)
              .map((k) => k.schluessel)
              .sort(),
          );
        });

        it('Schalter (+/−) genau an Gruppen mit Untergruppen; der Rahmen umfasst Kästchen und Schalter', () => {
          for (const k of a.knoten) {
            const soll = k.knoten.kinderZahl > 0 && !(art === 'mindmap' && k.knoten.ebene === 0);
            expect(k.schalter !== null, k.knoten.name).toBe(soll);
          }
          const r = a.rahmen;
          for (const k of a.knoten) {
            expect(k.x).toBeGreaterThanOrEqual(r.x);
            expect(k.x + k.breite).toBeLessThanOrEqual(r.x + r.breite);
            expect(k.y).toBeGreaterThanOrEqual(r.y);
            expect(k.y + k.hoehe).toBeLessThanOrEqual(r.y + r.hoehe);
            if (k.schalter) expect(k.schalter.y + SCHALTER).toBeLessThanOrEqual(r.y + r.hoehe);
          }
        });

        it('auf Papier (ohne +/−) keine Lücke: jede Kante beginnt am Kästchen oder am Ende eines Stummels (O7b-4)', () => {
          const amRand = (p: { x: number; y: number }) =>
            a.knoten.some(
              (k) =>
                ((p.x === k.x || p.x === k.x + k.breite) && p.y >= k.y && p.y <= k.y + k.hoehe) ||
                ((p.y === k.y || p.y === k.y + k.hoehe) && p.x >= k.x && p.x <= k.x + k.breite),
            );
          const stummel = a.knoten.map(schalterStummel).filter((x) => x !== null);
          expect(stummel.length).toBeGreaterThan(0);
          for (const st of stummel) {
            // Er beginnt auf dem Rand seines Kästchens und ist so lang wie der Halbmesser des Schalters.
            expect(amRand(st.punkte[0])).toBe(true);
            const [p, q] = st.punkte;
            expect(Math.hypot(q.x - p.x, q.y - p.y)).toBe(SCHALTER);
          }
          const enden = stummel.map((st) => `${st.punkte[1].x}|${st.punkte[1].y}`);
          for (const k of a.kanten) {
            const p = k.punkte[0];
            expect(enden.includes(`${p.x}|${p.y}`) || amRand(p), JSON.stringify(p)).toBe(true);
          }
        });
      });
  }
});

describe('anordnen – je Art', () => {
  const s = sichtbarerBaum(BAUM, 'Beispielgemeinde', null, offenTief);
  const lage = (a: Anordnung, name: string) => a.knoten.find((k) => k.knoten.name === name)!;

  it('von oben: Spitze oben in der Mitte, Bereiche in einer Reihe darunter, Tieferes gestapelt und eingerückt', () => {
    const a = anordnen('oben', s, breite);
    const bereiche = ['Gottesdienst', 'Gemeinschaft', 'Jugend'].map((n) => lage(a, n));
    expect(new Set(bereiche.map((b) => b.y)).size).toBe(1);
    expect(bereiche[0].x).toBeLessThan(bereiche[1].x);
    expect(bereiche[1].x).toBeLessThan(bereiche[2].x);
    const spitze = lage(a, 'Beispielgemeinde');
    expect(spitze.y).toBeLessThan(bereiche[0].y);
    expect(spitze.x + spitze.breite / 2).toBe(a.rahmen.x + a.rahmen.breite / 2);
    const musik = lage(a, 'Musik');
    const band = lage(a, 'Band');
    const technik = lage(a, 'Technik');
    expect(musik.x).toBeGreaterThan(lage(a, 'Gottesdienst').x);
    expect(band.x).toBeGreaterThan(musik.x);
    expect(band.y).toBeGreaterThan(musik.y);
    // Technik kommt erst unter der aufgeklappten Musik samt ihrer drei Untergruppen.
    expect(technik.y).toBeGreaterThan(lage(a, 'Jugendband').y);
    expect(technik.x).toBe(musik.x);
    expect(a.anker).toEqual({ x: spitze.x + spitze.breite / 2, y: 0, fx: 0.5, fy: 0 });
  });

  it('von links: jede Ebene weiter rechts, die Obergruppe mittig vor ihren Untergruppen', () => {
    const a = anordnen('links', s, breite);
    const spitze = lage(a, 'Beispielgemeinde');
    const gd = lage(a, 'Gottesdienst');
    const musik = lage(a, 'Musik');
    expect(spitze.x).toBe(0);
    expect(gd.x).toBeGreaterThan(spitze.x + spitze.breite);
    expect(musik.x).toBeGreaterThan(gd.x + gd.breite);
    const mitte = (n: string) => lage(a, n).y + HOEHE / 2;
    expect(mitte('Musik')).toBe((mitte('Band') + mitte('Jugendband')) / 2);
    expect(mitte('Beispielgemeinde')).toBe((mitte('Gottesdienst') + mitte('Jugend')) / 2);
    // Der Blick fängt an der Spitze an – auch wenn die nicht auf 0 liegt.
    expect(a.anker).toEqual({ x: 0, y: mitte('Beispielgemeinde'), fx: 0, fy: 0.5 });
  });

  it('Mindmap: Spitze mittig, Bereiche nach Zeilen auf rechts und links verteilt (rechts zuerst)', () => {
    const a = anordnen('mindmap', s, breite);
    const spitze = lage(a, 'Beispielgemeinde');
    expect(spitze.x + spitze.breite / 2).toBe(0);
    expect(spitze.y + HOEHE / 2).toBe(0);
    // Zeilen: Gottesdienst 6 (Band, Chor, Jugendband, Ton, Stream, Predigt), Gemeinschaft 2, Jugend 2 → rechts nur Gottesdienst.
    expect(lage(a, 'Gottesdienst').x).toBeGreaterThan(spitze.x + spitze.breite);
    expect(lage(a, 'Gemeinschaft').x + lage(a, 'Gemeinschaft').breite).toBeLessThan(spitze.x);
    expect(lage(a, 'Jugend').x + lage(a, 'Jugend').breite).toBeLessThan(spitze.x);
    expect(lage(a, 'Hauskreis Nord').x).toBeLessThan(lage(a, 'Hauskreise').x);
    expect(a.kanten.every((k) => k.rund)).toBe(true);
  });

  it('Mindmap mit nur einem Bereich: alles rechts', () => {
    const a = anordnen(
      'mindmap',
      sichtbarerBaum([BAUM[2]], 'G', null, new Set([GEMEINDE, '40'])),
      breite,
    );
    const spitze = lage(a, 'G');
    for (const k of a.knoten)
      if (k !== spitze) expect(k.x).toBeGreaterThan(spitze.x + spitze.breite);
  });

  it('Mindmap: eine zugeklappte Mitte behält ihren Schalter, sonst ginge sie nie wieder auf', () => {
    const a = anordnen('mindmap', sichtbarerBaum(BAUM, 'G', null, new Set()), breite);
    expect(a.knoten).toHaveLength(1);
    expect(a.knoten[0].schalter).not.toBeNull();
  });

  it('nur die Spitze (zugeklappt): ein Kästchen mit Schalter unten in der Mitte, von oben und von links', () => {
    const s0 = sichtbarerBaum(BAUM, 'G', null, new Set());
    const oben = anordnen('oben', s0, breite);
    expect(oben.knoten[0].schalter).toEqual({ x: breite(s0) / 2, y: HOEHE });
    expect(anordnen('links', s0, breite).knoten[0].schalter).toEqual({ x: breite(s0), y: 0 });
    // Der Schalter ragt unten heraus – der Rahmen muss ihn mitnehmen, sonst schneidet „Ganz zeigen“ ihn ab.
    expect(oben.rahmen).toEqual({ x: 0, y: 0, breite: breite(s0), hoehe: HOEHE + SCHALTER });
  });
});

describe('anordnen – hohe Kästchen (O7b-6)', () => {
  const s = sichtbarerBaum(BAUM, 'Beispielgemeinde', null, offenTief);
  const lage = (a: Anordnung, name: string) => a.knoten.find((k) => k.knoten.name === name)!;
  const nur =
    (namen: Record<string, number>): Hoehe =>
    (k) =>
      namen[k.name] ?? HOEHE;

  it('von oben: Untergruppen erst unter dem hohen Kästchen, der Schalter auf seinem unteren Rand', () => {
    const a = anordnen('oben', s, breite, nur({ Musik: 200 }));
    const musik = lage(a, 'Musik');
    expect(musik.hoehe).toBe(200);
    expect(lage(a, 'Band').y).toBeGreaterThan(musik.y + 200);
    expect(musik.schalter).toEqual({ x: musik.x + 14, y: musik.y + 200 });
    // Die Linie zur Untergruppe trifft deren Zeile mit dem Namen.
    const band = lage(a, 'Band');
    expect(
      a.kanten.some((k) => {
        const p = k.punkte[k.punkte.length - 1];
        return p.x === band.x && p.y === band.y + HOEHE / 2;
      }),
    ).toBe(true);
  });

  it('von oben: eine hohe Spitze schiebt die Reihe der Bereiche nach unten', () => {
    const tief = sichtbarerBaum(BAUM, 'G', '1', new Set(['1']));
    const a = anordnen('oben', tief, breite, nur({ Gottesdienst: 150 }));
    expect(lage(a, 'Musik').y).toBe(150 + 56);
    expect(lage(a, 'Gottesdienst').schalter?.y).toBe(150);
  });

  it('von links: ein hohes Kästchen schiebt die nächste Zeile weiter, die Obergruppe bleibt mittig vor den Namen', () => {
    const a = anordnen('links', s, breite, nur({ Band: 200 }));
    const band = lage(a, 'Band');
    expect(lage(a, 'Chor').y).toBe(band.y + 200 + 10);
    const mitte = (n: string) => lage(a, n).y + HOEHE / 2;
    expect(mitte('Musik')).toBe((mitte('Band') + mitte('Jugendband')) / 2);
  });

  it('von links: eine hohe Obergruppe ragt nicht in die nächste Gruppe ihrer Spalte', () => {
    const a = anordnen('links', s, breite, nur({ Predigt: 40, Technik: 300 }));
    const technik = lage(a, 'Technik');
    expect(lage(a, 'Predigt').y).toBeGreaterThanOrEqual(technik.y + 300);
  });
});

describe('schalterStummel', () => {
  it('zugeklappt oder ohne Untergruppen kein Stummel – dort geht keine Linie ab', () => {
    const s = sichtbarerBaum(BAUM, 'G', null, new Set([GEMEINDE]));
    const a = anordnen('oben', s, breite);
    const gottesdienst = a.knoten.find((k) => k.knoten.name === 'Gottesdienst')!;
    expect(gottesdienst.schalter).not.toBeNull();
    expect(schalterStummel(gottesdienst)).toBeNull();
    expect(schalterStummel(a.knoten.find((k) => k.knoten.ebene === 0)!)).not.toBeNull();
  });
});

describe('kantenPfad', () => {
  it('gerade Stücke als Linienzug, runde als eine Kurve vom ersten zum letzten Punkt', () => {
    expect(
      kantenPfad({
        punkte: [
          { x: 0, y: 0 },
          { x: 0, y: 10 },
          { x: 5, y: 10 },
        ],
        rund: false,
      }),
    ).toBe('M0 0L0 10L5 10');
    expect(
      kantenPfad({
        punkte: [
          { x: 0, y: 0 },
          { x: 20, y: 10 },
        ],
        rund: true,
      }),
    ).toBe('M0 0C10 0 10 10 20 10');
  });
});
