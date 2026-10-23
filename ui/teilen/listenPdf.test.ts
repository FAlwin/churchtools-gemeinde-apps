import { describe, expect, it } from 'vitest';
import { listenPdf, spaltenBreiten } from './listenPdf';

/** Eine Liste als PDF (A8-1): Kopf, Fuß mit Stand und „Seite x von y“ auf jeder Seite, Umbruch ohne zerteilte Zeile. */
const text = async (zeilen: number, spalten = 3) => {
  const doc = await listenPdf({
    titel: 'ECG Donrath · Kinderfreizeit',
    liste: 'Teilnehmer',
    stand: 'Stand 23.10.2026, 10:15',
    kopf: ['Name', ...Array.from({ length: spalten - 1 }, (_, i) => `Spalte ${i + 1}`)],
    zeilen: [
      ...Array.from({ length: zeilen }, (_, i) => ({
        zellen: [`Person ${i + 1}`, ...Array.from({ length: spalten - 1 }, () => 'x')],
      })),
      { abschnitt: 'Warteliste' },
      { zellen: ['1. Wartende Person'] },
    ],
    summe: `${zeilen} mit Platz`,
  });
  return { doc, roh: doc.output() };
};

describe('Listen-PDF', () => {
  it('eine Seite: Kopf, Tabelle, Summe, Stand und Seite', async () => {
    const { doc, roh } = await text(5);
    expect(doc.getNumberOfPages()).toBe(1);
    for (const t of [
      'ECG Donrath',
      'Teilnehmer',
      'Person 5',
      'Warteliste',
      '5 mit Platz',
      'Stand 23.10.2026, 10:15',
      'Seite 1 von 1',
    ])
      expect(roh).toContain(t);
  });

  it('lange Liste: mehrere Seiten, Stand und Seitenzahl auf jeder, Tabellenkopf wiederholt', async () => {
    const { doc, roh } = await text(120);
    const seiten = doc.getNumberOfPages();
    expect(seiten).toBeGreaterThan(2);
    expect(roh.split('Stand 23.10.2026, 10:15').length - 1).toBe(seiten);
    expect(roh).toContain(`Seite ${seiten} von ${seiten}`);
    expect(roh.split('(Spalte 1)').length - 1).toBe(seiten);
  });

  it('viele Spalten → quer', async () => {
    const { doc } = await text(3, 7);
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight());
  });
});

describe('Spaltenbreiten', () => {
  it('passt alles: Rest gleichmäßig verteilt', () => {
    expect(spaltenBreiten([20, 30], 100)).toEqual([45, 55]);
  });
  it('zu breit: schmale behalten ihr Maß, breite teilen sich den Rest', () => {
    expect(spaltenBreiten([10, 200, 100], 110)).toEqual([10, 50, 50]);
  });
});
