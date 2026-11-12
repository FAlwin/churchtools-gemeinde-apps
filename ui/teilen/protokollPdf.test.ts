import { describe, expect, it } from 'vitest';
import type { ProtokollBlatt, BlattTeil } from '@shared/protokolle/protokollBlatt';
import { protokollPdf } from './protokollPdf';

/** Das Protokoll als PDF (S6-3a): gezeichnet, was das Blatt festlegt – auf dem gemeinsamen Satz. */

const blatt = (teile: BlattTeil[], x: Partial<ProtokollBlatt> = {}): ProtokollBlatt => ({
  titel: 'Leitungssitzung',
  untertitel: 'Leitungsteam · Mi, 11.11.2026 · 19:00 Uhr',
  gemeinde: 'ECG Donrath',
  app: 'Protokolle',
  stand: 'Stand 12.11.2026, 10:00 Uhr',
  entwurf: false,
  vermerk: [[{ text: 'Freigegeben am 12.11.2026 von Alwin Friesen', stil: 'fett' }]],
  teile,
  uebersicht: {
    beschluesse: [{ absatz: [{ text: 'Essen um 12:30' }], punkt: 'Punkt 1' }],
    aufgaben: [],
    termine: [],
    naechste: null,
  },
  ...x,
});

const text = (t: string, einzug = 0): BlattTeil => ({
  art: 'text',
  absaetze: [[{ text: t }]],
  einzug,
});
const roh = async (b: ProtokollBlatt) => (await protokollPdf(b, 'helvetica')).output();

describe('Protokoll als PDF', () => {
  it('Kopf, Vermerk, Punkte mit Nummer, Text, Übersicht mit Anzahl und Punkt, Fuß', async () => {
    const r = await roh(
      blatt([
        { art: 'punkt', ebene: 0, nummer: '1.', absaetze: [[{ text: 'Andacht' }]], einzug: 0 },
        text('Psalmwort'),
      ]),
    );
    for (const t of [
      '(Leitungssitzung)',
      'Mi, 11.11.2026',
      '(Freigegeben)',
      '(1.)',
      '(Andacht)',
      '(Psalmwort)',
      'bersicht)',
      '(Beschl',
      '(Punkt)',
      '(Noch)',
      '(Seite 1 von 1)',
      'Stand 12.11.2026, 10:00 Uhr',
      '(ECG Donrath ',
      'Protokolle)',
    ])
      expect(r).toContain(t);
  });

  it('leeres Protokoll: ein Satz statt nichts', async () => {
    const r = await roh(blatt([]));
    expect(r).toContain('(leer.)');
  });

  /** Welche Schnitte im Text benutzt werden – jsPDF führt alle Standardschriften auf, benutzt wird `/F… Tf`. */
  const benutzt = async (b: ProtokollBlatt) => {
    const doc = await protokollPdf(b, 'helvetica');
    const r = doc.output();
    const id = (stil: string) =>
      (doc.internal as unknown as { getFont: (f: string, s: string) => { id: string } }).getFont(
        'helvetica',
        stil,
      ).id;
    const tf = (stil: string) => new RegExp(`/${id(stil)} [\\d.]+ Tf`).test(r);
    return { r, kursiv: tf('italic'), fettKursiv: tf('bolditalic') };
  };

  it('Kursiv und fett-kursiv in eigenen Schnitten, Link anklickbar', async () => {
    const { r, kursiv, fettKursiv } = await benutzt(
      blatt([
        {
          art: 'text',
          einzug: 0,
          absaetze: [
            [
              { text: 'schief', kursiv: true },
              { text: 'beides', kursiv: true, stil: 'fett' },
              { text: 'Seite', link: 'https://ecg-donrath.de' },
            ],
          ],
        },
      ]),
    );
    expect(kursiv).toBe(true);
    expect(fettKursiv).toBe(true);
    expect(r).toContain('/URI (https://ecg-donrath.de)');
  });

  it('ohne Kursiv kein kursiver Schnitt, ohne Link keine Verknüpfung', async () => {
    const { r, kursiv, fettKursiv } = await benutzt(blatt([text('schlicht')]));
    expect(kursiv).toBe(false);
    expect(fettKursiv).toBe(false);
    expect(r).not.toContain('/URI');
  });

  it('langes Protokoll: läuft über mehrere Seiten, Kopf und Seitenzahl auf jeder', async () => {
    const lang = Array.from({ length: 60 }, (_, i) => text(`Absatz${i} ${'Wort '.repeat(40)}`));
    const doc = await protokollPdf(blatt(lang), 'helvetica');
    const seiten = doc.getNumberOfPages();
    const r = doc.output();
    expect(seiten).toBeGreaterThan(2);
    expect(r.split('Stand 12.11.2026, 10:00 Uhr').length - 1).toBe(seiten);
    expect(r).toContain(`(Seite ${seiten} von ${seiten})`);
    expect(r).toContain('(Absatz59)');
  });

  it('ein Absatz länger als eine Seite wird Zeile für Zeile umbrochen, nicht abgeschnitten', async () => {
    const riesig: BlattTeil = {
      art: 'text',
      einzug: 0,
      absaetze: [[{ text: `${'lang '.repeat(1500)}ENDE` }]],
    };
    const doc = await protokollPdf(blatt([riesig]), 'helvetica');
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(doc.output()).toContain('(ENDE)');
  });

  it('Tabelle mit verbundenen Zellen, Liste, Kästchen, Beschluss, fester Punkt, Linie – alles gezeichnet', async () => {
    const r = await roh(
      blatt([
        {
          art: 'tabelle',
          einzug: 0,
          zeilen: [
            [
              {
                absaetze: [[{ text: 'Wer' }]],
                kopf: true,
                spalten: 1,
                zeilen: 1,
                hintergrund: null,
              },
              {
                absaetze: [[{ text: 'Was' }]],
                kopf: true,
                spalten: 1,
                zeilen: 1,
                hintergrund: null,
              },
            ],
            [
              {
                absaetze: [[{ text: 'Breit' }]],
                kopf: false,
                spalten: 2,
                zeilen: 1,
                hintergrund: [253, 232, 150],
              },
            ],
            [
              {
                absaetze: [[{ text: 'Hoch' }]],
                kopf: false,
                spalten: 1,
                zeilen: 2,
                hintergrund: null,
              },
              {
                absaetze: [[{ text: 'Eins' }]],
                kopf: false,
                spalten: 1,
                zeilen: 1,
                hintergrund: null,
              },
            ],
            [
              {
                absaetze: [[{ text: 'Zwei' }]],
                kopf: false,
                spalten: 1,
                zeilen: 1,
                hintergrund: null,
              },
            ],
          ],
        },
        {
          art: 'text',
          einzug: 1,
          absaetze: [[{ text: 'Punkt' }]],
          zeichen: { art: 'nummer', nr: 3 },
        },
        {
          art: 'text',
          einzug: 0,
          absaetze: [[{ text: 'Haken' }]],
          zeichen: { art: 'kasten', an: true },
        },
        { art: 'text', einzug: 0, absaetze: [[{ text: 'Beschlossen' }]], rand: 'beschluss' },
        {
          art: 'kasten',
          einzug: 0,
          zeilen: [
            { absaetze: [[{ text: 'Anwesend' }]] },
            { absaetze: [[{ text: 'Flyer' }]], zeichen: { art: 'punkt' } },
          ],
        },
        { art: 'linie', einzug: 0 },
      ]),
    );
    for (const t of [
      '(Wer)',
      '(Breit)',
      '(Hoch)',
      '(Zwei)',
      '(3.)',
      '(Haken)',
      '(Beschlossen)',
      '(Anwesend)',
      '(Flyer)',
    ])
      expect(r).toContain(t);
  });

  it('mit Lato: alle vier Schnitte eingebettet, ohne Fehler', async () => {
    const doc = await protokollPdf(
      blatt([{ art: 'text', einzug: 0, absaetze: [[{ text: 'kursiv', kursiv: true }]] }]),
    );
    const fonts = doc.getFontList() as Record<string, string[]>;
    expect(fonts.LatoPdf?.sort()).toEqual(['bold', 'bolditalic', 'italic', 'normal']);
  });
});
