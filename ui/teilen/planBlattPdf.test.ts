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
});
