import { describe, expect, it } from 'vitest';
import type { PlanBlatt } from '@shared/dienstplan/planBlatt';
import type { Zelle } from '@shared/ct/terminBlatt';
import { planBlattPdf, planSpalten } from './planBlattPdf';

/** Das Plan-Blatt als PDF (E8-2): Kopf und Fuß je Seite, Band je Gruppe, Tabellenkopf nach jedem Umbruch. */
const zelle = (text: string): Zelle => ({ absaetze: [{ laeufe: [{ text }] }] });
const blatt = (termine: number, gruppen = ['Technik', 'Musik']): PlanBlatt => ({
  titel: 'Dienstplan',
  untertitel: '8. November – 20. Dezember 2026',
  gemeinde: 'ECG Donrath',
  app: 'Dienstplaner',
  stand: 'Stand 05.11.2026, 14:00',
  quer: false,
  leer: null,
  dateiname: 'Dienstplan',
  abschnitte: gruppen.map((g) => ({
    titel: gruppen.length > 1 ? g : null,
    kopf: ['Termin', 'Ton', 'Licht'],
    zeilen: Array.from({ length: termine }, (_, i) => [
      zelle(`Termin${i + 1}`),
      zelle('Hahn'),
      zelle('frei'),
    ]),
  })),
});

/** „Personen × Termine“ (E8-4b): Name, `termine` Terminspalten, Summe. */
const personenBlatt = (termine: number): PlanBlatt => ({
  ...blatt(1),
  quer: true,
  abschnitte: [
    {
      titel: null,
      personen: true,
      kopf: [
        'Person',
        ...Array.from({ length: termine }, (_, i) => `So, ${String(6 + i).padStart(2, '0')}.12.`),
        'Dienste',
      ],
      zeilen: [
        [
          zelle('Anna Beispiel'),
          ...Array.from({ length: termine }, (_, i) => zelle(i === 0 ? 'Ton, Licht' : '')),
          zelle('1'),
        ],
      ],
    },
  ],
});

/**
 * „Je Person“ (E8-4c): `personen` Abschnitte mit je `zeilen` Terminen, so gebaut, wie `planBlatt` sie liefert
 * (`seite`: alle außer dem ersten mit `neueSeite`; `alle`: alle mit `zusammen`).
 */
const jePersonBlatt = (personen: number, zeilen: number, seiten: 'seite' | 'alle'): PlanBlatt => ({
  ...blatt(1),
  abschnitte: Array.from({ length: personen }, (_, p): PlanBlatt['abschnitte'][number] => ({
    titel: `Person${p + 1}`,
    person: true,
    zusatz: `${zeilen} Dienste`,
    kopf: ['Datum', 'Uhrzeit', 'Termin', 'Dienst'],
    zeilen: Array.from({ length: zeilen }, (_, i) => [
      zelle(`Tag${p + 1}x${i + 1}`),
      zelle('10:00'),
      zelle('Gottesdienst'),
      zelle('Ton'),
    ]),
    ...(seiten === 'alle'
      ? { zusammen: true as const }
      : p > 0
        ? { neueSeite: true as const }
        : {}),
  })),
});
/** Der Inhalt je Seite als Text – ohne eingebettete Schrift steht er lesbar im PDF. */
const seitenText = (doc: Awaited<ReturnType<typeof planBlattPdf>>) =>
  (doc.internal.pages as unknown as string[][]).slice(1).map((s) => s.join('\n'));
const personenAuf = (text: string) =>
  [...text.matchAll(/\(Person(\d+)\)/g)].map((m) => Number(m[1]));

describe('Plan-Blatt als PDF', () => {
  it('eine Seite: Kopf, je Gruppe ein Band, Tabellenkopf, Fuß', async () => {
    const roh = (await planBlattPdf(blatt(3), 'helvetica')).output();
    for (const t of [
      '(Dienstplan)',
      '(Technik)',
      '(Musik)',
      '(TERMIN)',
      '(Termin3)',
      '(Seite 1 von 1)',
      'Stand 05.11.2026, 14:00',
    ])
      expect(roh).toContain(t);
  });

  it('langer Plan: mehrere Seiten, Kopf, Tabellenkopf und Seitenzahl auf jeder', async () => {
    const doc = await planBlattPdf(blatt(60, ['Technik']), 'helvetica');
    const seiten = doc.getNumberOfPages();
    const roh = doc.output();
    expect(seiten).toBeGreaterThan(1);
    expect(roh.split('Stand 05.11.2026, 14:00').length - 1).toBe(seiten);
    expect(roh.split('(TERMIN)').length - 1).toBe(seiten);
    expect(roh).toContain(`(Seite ${seiten} von ${seiten})`);
  });

  it('leer steht als Zeile da – statt einer leeren Tabelle', async () => {
    const roh = (
      await planBlattPdf(
        { ...blatt(0), abschnitte: [], leer: 'In diesem Zeitraum sind keine Dienste vorgesehen.' },
        'helvetica',
      )
    ).output();
    expect(roh).toContain('(In diesem Zeitraum sind keine Dienste vorgesehen.)');
  });

  it('„Termin“ nimmt sich nur, was er braucht – den Rest teilen sich die Dienste', () => {
    const a = blatt(2, ['Technik']).abschnitte[0];
    const breiten = planSpalten(a, 180, (t) => t.length * 2);
    expect(breiten[0]).toBe(40);
    expect(breiten[1]).toBeCloseTo(breiten[2]);
    expect(breiten.reduce((s, x) => s + x, 0)).toBeCloseTo(180);
  });

  it('Personen × Termine: zeichnet ohne Fehler – Kopf einzeilig, Name, Dienste, Summe', async () => {
    const roh = (await planBlattPdf(personenBlatt(3), 'helvetica')).output();
    for (const t of [
      '(PERSON)',
      '(SO, 06.12.)',
      '(DIENSTE)',
      '(Anna)',
      '(Beispiel)',
      '(Ton,)',
      '(Licht)',
    ])
      expect(roh).toContain(t);
  });

  it('Personen × Termine: Name nach Bedarf, Summe schmal, die Termine teilen sich den Rest', () => {
    const a = personenBlatt(10).abschnitte[0];
    const breiten = planSpalten(a, 269, (t) => t.length * 1.5);
    expect(breiten.reduce((s, x) => s + x, 0)).toBeCloseTo(269);
    // Die Summe bekommt nichts vom Rest – nur ihre eigene Breite.
    const summe = breiten.at(-1) as number;
    expect(summe).toBeLessThan(20);
    expect(summe).toBeCloseTo(1.5 * 'DIENSTE'.length + 3 + 0.5, 0);
    // Der Name so breit wie nötig, ohne Rest: „ANNA BEISPIEL“ (13 Zeichen, der längste Wert) + Polster.
    expect(breiten[0]).toBeCloseTo(1.5 * 'Anna Beispiel'.length + 3 + 0.5, 0);
    // Die Termin-Spalten sind breiter als in der Termine-Tabelle mit festem Rest …
    expect(breiten[1]).toBeGreaterThan(20);
    expect(breiten[1]).toBeCloseTo(breiten[10]);
  });

  it('Personen × Termine, wenn es eng wird: der Name wird nicht gestaucht, höchstens 60 mm', () => {
    // Lange Zellen in jeder Terminspalte – zusammen breiter als die Seite, also teilen sich die Termine den Platz.
    const a = personenBlatt(8).abschnitte[0];
    const lang = (name: string) => ({
      ...a,
      zeilen: [
        [
          zelle(name),
          ...a.kopf.slice(1, -1).map(() => zelle('Gesang (angefragt), Ton, Licht, Beamer')),
          zelle('8'),
        ],
      ],
    });
    const messen = (t: string) => t.length * 1.5;
    const eng = planSpalten(lang('Clara Schmidt-Langenfeld'), 269, messen);
    expect(eng[0]).toBeCloseTo(1.5 * 'Clara Schmidt-Langenfeld'.length + 3 + 0.5, 0);
    expect(eng.reduce((s, x) => s + x, 0)).toBeCloseTo(269);
    expect(eng[1]).toBeLessThan(eng[0]);
    // Ein überlanger Name bekommt höchstens 60 mm und bricht dann an Wortgrenzen um.
    const sehrLang = planSpalten(lang('A'.repeat(80)), 269, messen);
    expect(sehrLang[0]).toBe(60);
  });

  it('Termine × Dienste bleibt unverändert breit gerechnet – auch mit letzter Spalte „Dienste“ im Namen', () => {
    const a = blatt(2, ['Technik']).abschnitte[0];
    const ohne = planSpalten(a, 180, (t) => t.length * 2);
    const letzteFest = planSpalten(
      { ...a, kopf: [...a.kopf.slice(0, 2), 'Dienste'] },
      180,
      (t) => t.length * 2,
    );
    // Ohne `personen` hat auch eine Spalte „Dienste“ keine Sonderrolle.
    expect(letzteFest[2]).toBeCloseTo(ohne[2]);
  });

  it('Je Person „seite“: jede Person auf einer eigenen Seite, auch wenn mehrere auf eine passten', async () => {
    const doc = await planBlattPdf(jePersonBlatt(4, 3, 'seite'), 'helvetica');
    expect(doc.getNumberOfPages()).toBe(4);
    expect(seitenText(doc).map(personenAuf)).toEqual([[1], [2], [3], [4]]);
    // Band mit Name und grauem Zusatz.
    expect(doc.output()).toContain('(3 Dienste)');
    expect(doc.output()).toContain('(DATUM)');
  });

  it('Je Person „alle“: kurze Blöcke laufen auf einer Seite untereinander', async () => {
    const doc = await planBlattPdf(jePersonBlatt(4, 3, 'alle'), 'helvetica');
    expect(doc.getNumberOfPages()).toBe(1);
    expect(personenAuf(seitenText(doc)[0])).toEqual([1, 2, 3, 4]);
  });

  it('Je Person „alle“: passt ein Block nicht mehr auf die Seite, wandert er ganz auf die nächste', async () => {
    // Zwei Blöcke à 14 Zeilen füllen die Seite fast, der dritte würde mittendrin getrennt.
    const doc = await planBlattPdf(jePersonBlatt(3, 14, 'alle'), 'helvetica');
    const seiten = seitenText(doc);
    expect(seiten.map(personenAuf)).toEqual([[1, 2], [3]]);
    // Person 3 steht ganz auf Seite 2: alle ihre Zeilen, mit Tabellenkopf davor.
    expect(seiten[1].match(/\(Tag3x\d+\)/g)).toHaveLength(14);
    expect(seiten[1].match(/\(DATUM\)/g)).toHaveLength(1);
    expect(seiten[0].match(/\(Tag3x/g)).toBeNull();
  });

  it('Je Person „alle“: ein Block, der allein länger als eine Seite ist, wird getrennt – Tabellenkopf wiederholt', async () => {
    const doc = await planBlattPdf(jePersonBlatt(1, 60, 'alle'), 'helvetica');
    const seiten = seitenText(doc);
    expect(seiten.length).toBeGreaterThan(1);
    expect(personenAuf(seiten[0])).toEqual([1]);
    expect(personenAuf(seiten[1])).toEqual([]);
    for (const t of seiten) expect(t.match(/\(DATUM\)/g)).toHaveLength(1);
    expect(doc.output().match(/\(Tag1x\d+\)/g)).toHaveLength(60);
    // Ein Block, der allein länger als eine Seite ist, wandert nicht weg, sondern beginnt gleich hinter dem kurzen davor.
    const doc2 = await planBlattPdf(
      {
        ...jePersonBlatt(1, 3, 'alle'),
        abschnitte: [
          ...jePersonBlatt(1, 3, 'alle').abschnitte,
          { ...jePersonBlatt(2, 60, 'alle').abschnitte[1], titel: 'Person2' },
        ],
      },
      'helvetica',
    );
    expect(seitenText(doc2)[0]).toContain('(Person2)');
  });

  it('Je Person: Spaltenbreiten – Datum und Uhrzeit fest, Termin und Dienst teilen sich den Rest', () => {
    const a = jePersonBlatt(1, 2, 'seite').abschnitte[0];
    const messen = (t: string) => t.length * 1.5;
    const breiten = planSpalten(a, 182, messen);
    expect(breiten.reduce((s, x) => s + x, 0)).toBeCloseTo(182);
    // Datum: „TAG1X1“ = längster Wert (Kopf „DATUM“ kürzer) + Polster; nicht breiter als nötig.
    expect(breiten[0]).toBeCloseTo(1.5 * 'Tag1x1'.length + 3 + 0.5, 0);
    expect(breiten[1]).toBeCloseTo(1.5 * 'UHRZEIT'.length + 3 + 0.5, 0);
    // Beide bekommen den gleichen Zuschlag auf ihren Bedarf (Termin: „Gottesdienst“ = 21 mm; Dienst: mindestens 30 mm).
    const zuschlag = (182 - breiten[0] - breiten[1] - 21 - 30) / 2;
    expect(zuschlag).toBeGreaterThan(0);
    expect(breiten[2]).toBeCloseTo(21 + zuschlag);
    expect(breiten[3]).toBeCloseTo(30 + zuschlag);
  });

  it('Je Person: alle Abschnitte haben dieselben Spaltenbreiten – die Dienst-Spalte steht überall gleich', async () => {
    const b = jePersonBlatt(2, 2, 'alle');
    // Person 2 hat einen sehr langen Termin- und Dienstnamen – allein gerechnet säße ihre Dienst-Spalte weiter rechts.
    b.abschnitte[1].zeilen[0][2] = zelle('Gebetsabend mit einem ziemlich langen Namen');
    b.abschnitte[1].zeilen[0][3] = zelle('Gesang (angefragt) · Musik');
    const raw = (await planBlattPdf(b, 'helvetica')).output();
    const xs = [...raw.matchAll(/([\d.]+) [\d.]+ Td\s*\(DIENST\)/g)].map((m) => m[1]);
    expect(xs).toHaveLength(2);
    expect(xs[0]).toBe(xs[1]);
  });
});
