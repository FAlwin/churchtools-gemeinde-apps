import { describe, expect, it } from 'vitest';
import type { ProtokollBlatt, BlattTeil, Zeichen } from '@shared/protokolle/protokollBlatt';
import { INFO_LEGENDE } from '@shared/protokolle/tabellenZeile';
import { protokollPdf } from './protokollPdf';

/** Das Protokoll als PDF (S6-3a): gezeichnet, was das Blatt festlegt – auf dem gemeinsamen Satz. */

const blatt = (teile: BlattTeil[], x: Partial<ProtokollBlatt> = {}): ProtokollBlatt => ({
  titel: 'Leitungssitzung',
  untertitel: 'Leitungsteam · Mi, 11.11.2026 · 19:00 Uhr',
  gemeinde: 'ECG Donrath',
  app: 'Protokolle',
  stand: 'Stand 12.11.2026, 10:00 Uhr',
  entwurf: false,
  banner: null,
  vermerk: [[{ text: 'Freigegeben am 12.11.2026 von Alwin Friesen', stil: 'fett' }]],
  dateiname: 'Protokoll Leitungsteam 2026-11-11',
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
          legende: false,
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

  it('Aufzählungszeichen je Ebene: • ◦ – (◦ als Kreislinie, die Schrift hat es nicht) – W11', async () => {
    const eintrag = (ebene: number | undefined): BlattTeil => ({
      art: 'text',
      einzug: 0,
      absaetze: [[{ text: 'Eintrag' }]],
      zeichen: { art: 'punkt', ...(ebene === undefined ? {} : { ebene }) },
    });
    const [e0, e1, e2, e3, ohne] = await Promise.all(
      [0, 1, 2, 3, undefined].map(async (e) =>
        (await roh(blatt([eintrag(e)]))).replace(/\/ID \[[^\]]*\]/, ''),
      ),
    );
    // ohne Angabe = oberste Ebene
    expect(ohne).toBe(e0);
    // jede Ebene sieht anders aus: Punkt, Kreis, Strich
    expect(new Set([e0, e1, e2]).size).toBe(3);
    // ab der dritten bleibt es beim Strich
    expect(e3).toBe(e2);
    // der Kreis ist eine Linie (Kurvenstücke `c` + Strich `S`), Punkt und Strich sind Text
    const kurven = (r: string) => (r.match(/ c\n/g) ?? []).length;
    expect(kurven(e1)).toBeGreaterThan(kurven(e0));
    expect(kurven(e2)).toBe(kurven(e0));
  });

  it('Beschluss, Termin und To-Do: nur ein Farbrand links, keine Fläche (Stil A, W12); To-Do mit Kreis statt Kästchen', async () => {
    const einzeln = (rand: 'beschluss' | 'termin' | 'aufgabe' | 'zitat', zeichen?: Zeichen) =>
      roh(
        blatt([
          {
            art: 'text',
            einzug: 0,
            absaetze: [[{ text: 'Baustein' }]],
            rand,
            ...(zeichen ? { zeichen } : {}),
          },
        ]),
      );
    // gefüllte Rechtecke: früher Fläche + Balken (2), jetzt nur der Balken (1) – wie beim Zitat, das nie eine Fläche hatte
    const gefuellt = (r: string) => (r.match(/ re\nf\n/g) ?? []).length;
    const zitat = gefuellt(await einzeln('zitat'));
    for (const rand of ['beschluss', 'termin', 'aufgabe'] as const)
      expect(gefuellt(await einzeln(rand)), rand).toBe(zitat);
    // Kreis: Kurvenstücke, Kästchen nicht
    const kurven = (r: string) => (r.match(/ c\n/g) ?? []).length;
    expect(kurven(await einzeln('aufgabe', { art: 'kreis', an: false }))).toBeGreaterThan(
      kurven(await einzeln('aufgabe', { art: 'kasten', an: false })),
    );
  });

  it('Entwurf: Banner auf Seite 1, blasses „ENTWURF“ auf jeder Seite', async () => {
    const lang = Array.from({ length: 60 }, (_, i) => text(`Absatz${i} ${'Wort '.repeat(40)}`));
    const doc = await protokollPdf(
      blatt(lang, { entwurf: true, banner: 'ENTWURF – NOCH NICHT FREIGEGEBEN', vermerk: [] }),
      'helvetica',
    );
    const r = doc.output();
    const seiten = doc.getNumberOfPages();
    expect(seiten).toBeGreaterThan(1);
    expect(r).toContain('NOCH NICHT FREIGEGEBEN)');
    expect(r.split('(ENTWURF)').length - 1).toBe(seiten);
    expect(r).toMatch(/\/ca 0\.08/);
  });

  it('freigegeben: weder Banner noch Wasserzeichen', async () => {
    const r = await roh(blatt([text('schlicht')]));
    expect(r).not.toContain('ENTWURF');
    expect(r).not.toMatch(/\/ca 0\.08/);
  });

  it('mit der PDF-Schrift: alle vier Schnitte eingebettet, ohne Fehler', async () => {
    const doc = await protokollPdf(
      blatt([{ art: 'text', einzug: 0, absaetze: [[{ text: 'kursiv', kursiv: true }]] }]),
    );
    const fonts = doc.getFontList() as Record<string, string[]>;
    expect(fonts.GemeindeSans?.sort()).toEqual(['bold', 'bolditalic', 'italic', 'normal']);
  });

  describe('Unterzeile und Info-Zeile in der Tabelle (W13)', () => {
    const zelle = (t: string, marke?: { unter: boolean; info: boolean }) => ({
      absaetze: [[{ text: t }]],
      kopf: false,
      spalten: 1,
      zeilen: 1,
      hintergrund: null,
      ...(marke ? { marke } : {}),
    });
    const tab = (
      marken: ({ unter: boolean; info: boolean } | undefined)[],
      legende: boolean,
    ): BlattTeil => ({
      art: 'tabelle',
      einzug: 0,
      legende,
      zeilen: marken.map((m, i) => [zelle(`Datum${i}`, m), zelle('Was')]),
    });
    const kurven = (r: string) => (r.match(/ c\n/g) ?? []).length;
    const linien = (r: string) => (r.match(/ l\n/g) ?? []).length;
    const ohne = tab([undefined, undefined], false);

    it('Info-Zeile: ⓘ-Kreis gezeichnet (Kurven), Legende darunter – das Zeichen selbst steht nicht im Text', async () => {
      const r = await roh(blatt([tab([undefined, { unter: false, info: true }], true)]));
      expect(kurven(r)).toBeGreaterThan(kurven(await roh(blatt([ohne]))));
      expect(r).toContain('(Datum1)');
      // Das PDF setzt Wort für Wort – jedes Wort der Legende (aus der EINEN Quelle) steht darin.
      for (const wort of INFO_LEGENDE.split(' ').filter((w) => /^\p{L}+$/u.test(w)))
        expect(r, wort).toContain(`(${wort})`);
      expect(r).not.toContain('ⓘ');
    });

    it('ohne Info-Zeile keine Legende', async () => {
      const r = await roh(blatt([tab([undefined, { unter: true, info: false }], false)]));
      expect(r).not.toContain('(Thema)');
    });

    it('Unterzeile: „↳“ aus Linien gezeichnet, Text eingerückt (Spalte wird breiter, kein Zeichen im Text)', async () => {
      const r = await roh(blatt([tab([undefined, { unter: true, info: false }], false)]));
      expect(linien(r)).toBeGreaterThan(linien(await roh(blatt([ohne]))));
      expect(r).not.toContain('↳');
    });

    it('der Einzug verbreitert die Spalte (naturBreite zählt `einzug`)', async () => {
      const { naturBreite } = await import('./pdfSatz');
      const z = { absaetze: [{ laeufe: [{ text: 'abc' }] }] };
      const messen = (t: string) => t.length;
      expect(naturBreite('', [{ ...z, einzug: 5 }], messen)).toBe(naturBreite('', [z], messen) + 5);
    });
  });
});
