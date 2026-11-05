import { describe, expect, it } from 'vitest';
import type { AblaufZeile } from '@shared/ct/ablaufZeile';
import { BLATT_VORGABE, terminBlatt, type BlattQuelle } from '@shared/ct/terminBlatt';
import { ablaufSpalten, terminBlattPdf } from './terminBlattPdf';

/** Das Termin-Blatt als PDF (E8-1): Kopf, Dienste, Ablauf mit Beginn/Ende, Seitenumbruch mit Kopf und Seitenzahl. */
let id = 0;
const z = (title: string, x: Partial<AblaufZeile> = {}): AblaufZeile => ({
  id: ++id,
  title,
  type: 'normal',
  isHeader: false,
  responsible: [],
  responsibleText: '',
  song: null,
  time: null,
  vorBeginn: false,
  durationMin: null,
  note: '',
  ...x,
});

const quelle = (eintraege: number): BlattQuelle => ({
  titel: 'Gottesdienst',
  tag: '2026-11-01',
  beginn: '10:00',
  gemeinde: 'ECG Donrath',
  app: 'Dienstplaner',
  stand: 'Stand 05.11.2026, 09:25',
  zeilen: [
    z('Soundcheck', { time: '09:30', durationMin: 30, vorBeginn: true }),
    z('Abschnitt Start', { isHeader: true, type: 'header' }),
    ...Array.from({ length: eintraege }, (_, i) =>
      z(`Eintrag ${i + 1}`, {
        time: `1${Math.floor(i / 60)}:${String(i % 60).padStart(2, '0')}`,
        durationMin: 1,
        responsible: [{ label: 'Jakob Weber', open: false, dienst: 'Moderation' }],
        song: i === 0 ? { title: 'Du großer Gott', originalKey: 'G' } : null,
        infos: [{ gruppeId: 2, text: 'Folien vom Laptop' }],
      }),
    ),
  ],
  dienste: [
    {
      id: 2,
      name: 'Technik',
      dienste: [
        { name: 'Ton', personen: [{ name: 'Tobias Hahn', angefragt: true }], frei: 0 },
        { name: 'Licht', personen: [], frei: 2 },
      ],
    },
  ],
  infoGruppen: [{ id: 2, name: 'Technik' }],
  ansichtInfos: [2],
});

const bauen = async (eintraege: number, f?: (e: typeof BLATT_VORGABE) => void) => {
  const e = structuredClone(BLATT_VORGABE);
  f?.(e);
  const doc = await terminBlattPdf(terminBlatt(quelle(eintraege), e), 'helvetica');
  return { doc, roh: doc.output() };
};

describe('Termin-Blatt als PDF', () => {
  it('eine Seite: Kopf mit Gemeinde und Stand, Dienste, Ablauf mit Beginn und Ende, Fuß mit Seite', async () => {
    const { doc, roh } = await bauen(5);
    expect(doc.getNumberOfPages()).toBe(1);
    expect(roh.split('(Eintrag)').length - 1).toBe(5);
    for (const t of [
      '(Gottesdienst)',
      'Sonntag, 1. November 2026',
      '(ECG Donrath)',
      'Stand 05.11.2026, 09:25',
      '(TECHNIK)',
      // Zellen werden Wort für Wort gesetzt (Umbruch mit gemischter Auszeichnung) – darum einzelne Wörter.
      '(Tobias)',
      '(angefragt)',
      '(frei)',
      '(Beginn)',
      '(Ende)',
      '(Laptop)',
      '(G)',
      '(ECG Donrath · Dienstplaner)',
      '(Seite 1 von 1)',
    ])
      expect(roh).toContain(t);
  });

  it('langer Ablauf: mehrere Seiten, Kopf, Tabellenkopf und Seitenzahl auf jeder', async () => {
    const { doc, roh } = await bauen(90);
    const seiten = doc.getNumberOfPages();
    expect(seiten).toBeGreaterThan(1);
    expect(roh.split('Stand 05.11.2026, 09:25').length - 1).toBe(seiten);
    expect(roh.split('(ZUST').length - 1).toBe(seiten);
    expect(roh).toContain(`(Seite ${seiten} von ${seiten})`);
  });

  it('die Uhrzeit bricht nie um – „10:01“ steht in einem Stück', async () => {
    const { roh } = await bauen(5);
    expect(roh).toContain('(10:01)');
  });

  it('„Ende“ steht nie allein oben auf einer Seite – der letzte Eintrag wandert mit', async () => {
    // Für jede Länge: Die Seite mit „Ende“ trägt auch den letzten Eintrag.
    for (let n = 40; n <= 70; n++) {
      const { doc } = await bauen(n);
      const seiten = (doc.internal as unknown as { pages: (string[] | null)[] }).pages;
      const mitEnde = seiten.find((ops) => ops?.some((o) => o.includes('(Ende) Tj')));
      expect(
        mitEnde?.some((o) => o.includes(`(${n}) Tj`)),
        `bei ${n} Einträgen`,
      ).toBe(true);
    }
  });

  it('Zeit und Dauer sind so breit wie ihr längster Wert (plus Polster) – unabhängig von der Schrift', () => {
    // Feste Messung: jedes Zeichen 2 mm – „10:01“ braucht 10 mm, „Zeit“ im Kopf nur 8.
    const b = terminBlatt(quelle(3), BLATT_VORGABE);
    const breiten = ablaufSpalten(b.ablauf!, 180, (t) => t.length * 2);
    expect(breiten[0]).toBeGreaterThanOrEqual(10 + 3);
    expect(breiten[1]).toBeGreaterThanOrEqual('5 Min'.length * 2 + 3);
    expect(breiten.reduce((s, x) => s + x, 0)).toBeCloseTo(180);
  });

  it('quer, wenn gewählt', async () => {
    const { doc } = await bauen(3, (e) => (e.quer = true));
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight());
  });

  it('mit Lato (ohne Testschrift) entsteht ein PDF ohne Fehler', async () => {
    const doc = await terminBlattPdf(terminBlatt(quelle(3), BLATT_VORGABE));
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
