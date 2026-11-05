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
  oben: null,
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

  it('oben und leer stehen als Zeile da – statt einer leeren Tabelle', async () => {
    const roh = (
      await planBlattPdf(
        { ...blatt(0), abschnitte: [], oben: 'Offene Dienste in Technik', leer: 'Alles besetzt' },
        'helvetica',
      )
    ).output();
    expect(roh).toContain('(Offene Dienste in Technik)');
    expect(roh).toContain('(Alles besetzt)');
  });

  it('„Termin“ nimmt sich nur, was er braucht – den Rest teilen sich die Dienste', () => {
    const a = blatt(2, ['Technik']).abschnitte[0];
    const breiten = planSpalten(a, 180, (t) => t.length * 2);
    expect(breiten[0]).toBe(40);
    expect(breiten[1]).toBeCloseTo(breiten[2]);
    expect(breiten.reduce((s, x) => s + x, 0)).toBeCloseTo(180);
  });
});
