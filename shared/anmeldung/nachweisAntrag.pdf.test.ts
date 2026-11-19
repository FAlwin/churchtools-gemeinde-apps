import { describe, expect, it } from 'vitest';
import {
  PDF_FELD_ARTEN,
  PDF_FELD_NAME,
  antragBilderLesen,
  antragFehler,
  antragOrt,
  antragPdfHtml,
  antragPdfKoerper,
  antragPdfVorschau,
  antragVorgabe,
  gleicherAntrag,
  pdfBlatt,
  pdfFeldBeispiel,
  pdfFeldChurchTools,
  pdfFeldStil,
  pdfHintergrundStil,
  pdfNeueId,
  pdfNeuesFeld,
  pdfSeitenStil,
  pdfVorgabeFelder,
  ptZuMm,
  stilText,
  type NachweisAntrag,
  type PdfBlatt,
  type PdfFeld,
} from './nachweisAntrag';
import {
  nachweisEinstellungenFehler,
  nachweisEinstellungenLesen,
  nachweisEinstellungenPacken,
  type NachweisEinstellungen,
} from './nachweise';

/**
 * Die eigene PDF als Antrag (N1d). Soll-Werte kommen aus den Erzeugern (`pdfFeldStil` & Co.) – nie aus handgeschriebenen
 * Literalen, die beim Fehler grün blieben. Was ChurchTools daraus macht, ist in M5 gemessen (Chromium, Prozent und mm exakt).
 */
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////';
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const FELDER: PdfFeld[] = [
  { id: 'f1', art: 'NachnameVorname', x: 36, y: 17.6, pt: 11 },
  { id: 'f2', art: 'Heute', x: 36, y: 40.2, pt: 9, vorsatz: 'Lohmar, ' },
  { id: 'f3', art: 'Unterschrift', x: 12.5, y: 50, pt: 11, breiteMm: 40 },
];
const BLATT: PdfBlatt = {
  breiteMm: 210,
  hoeheMm: 297,
  felder: FELDER,
  hintergrund: JPG,
  unterschrift: PNG,
};

describe('Seitenformat: aus der PDF, nicht fest A4', () => {
  it('pt wird zu mm (A4 = 210 × 297 auf 0,1 mm)', () => {
    expect(ptZuMm(595.276)).toBe(210);
    expect(ptZuMm(841.89)).toBe(297);
    expect(ptZuMm(612)).toBe(215.9); // US Letter
  });

  it('@page und Seite tragen das Format der PDF (Querformat A5)', () => {
    const b: PdfBlatt = { ...BLATT, breiteMm: 210, hoeheMm: 148.5 };
    const html = antragPdfHtml(b);
    expect(html).toContain('@page { size: 210mm 148.5mm; margin: 0 }');
    expect(html).toContain(stilText(pdfSeitenStil(b)));
    expect(html).toContain('width:210mm;height:148.5mm;overflow:hidden');
    expect(html).toContain(stilText(pdfHintergrundStil(b)));
  });
});

describe('Das HTML für ChurchTools (eine Seite, absolut positioniert)', () => {
  it('Dokument ohne Seitenrand, Blatt mit Marker, Hintergrund ganzseitig', () => {
    const html = antragPdfHtml(BLATT);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('body style="margin:0"');
    expect(html).toContain('data-nachweis="blatt" data-art="pdf"');
    expect(html).toContain(`<img data-nachweis="hintergrund" src="${JPG}"`);
    expect(html).toContain('position:absolute;left:0;top:0;width:210mm;height:297mm');
  });

  it('Anker links oben: left/top in Prozent, kein transform – für Text und Unterschrift', () => {
    for (const f of FELDER) {
      const stil = pdfFeldStil(f);
      expect(stil.left).toBe(`${f.x}%`);
      expect(stil.top).toBe(`${f.y}%`);
      expect(stil.position).toBe('absolute');
      expect(Object.keys(stil)).not.toContain('transform');
      expect(Object.keys(stil)).not.toContain('right');
      expect(Object.keys(stil)).not.toContain('bottom');
    }
    const html = antragPdfKoerper(BLATT);
    expect(html).toContain('left:36%;top:17.6%');
    expect(html).toContain('left:12.5%;top:50%');
    expect(html).not.toContain('transform');
  });

  it('Editor und HTML rechnen mit derselben Funktion: das HTML enthält exakt den Stil des Editors', () => {
    const html = antragPdfKoerper(BLATT);
    for (const f of FELDER) expect(html).toContain(`style="${stilText(pdfFeldStil(f))}"`);
  });

  it('Schriftgröße je Platzhalter in pt, Unterschrift mit Breite in mm', () => {
    const html = antragPdfKoerper(BLATT);
    expect(pdfFeldStil(FELDER[0]).fontSize).toBe('11pt');
    expect(pdfFeldStil(FELDER[1]).fontSize).toBe('9pt');
    expect(html).toContain('font-size:11pt');
    expect(html).toContain('font-size:9pt');
    const stilUnterschrift = stilText(pdfFeldStil(FELDER[2]));
    expect(stilUnterschrift).toContain('width:40mm');
    expect(html).toContain(
      `<img data-nachweis="unterschrift" src="${PNG}" alt="" style="${stilUnterschrift}">`,
    );
    // ohne Breite gilt die Vorgabe 50 mm
    expect(pdfFeldStil({ ...FELDER[2], breiteMm: undefined }).width).toBe('50mm');
  });

  it('Platzhalter werden zu ChurchTools-Feldern (Adresse: Straße, PLZ Ort; E-Mail; Datum davor)', () => {
    const text = (art: PdfFeld['art']) => pdfFeldChurchTools({ id: 'x', art, x: 0, y: 0, pt: 11 });
    expect(text('NachnameVorname')).toBe('{{person.lastName}}, {{person.firstName}}');
    expect(text('Vorname')).toBe('{{person.firstName}}');
    expect(text('Nachname')).toBe('{{person.lastName}}');
    expect(text('Geburtsdatum')).toBe('{{person.birthday}}');
    expect(text('Adresse')).toBe('{{person.street}}, {{person.zip}} {{person.city}}');
    expect(text('Heute')).toBe('{{currentDate}}');
    expect(text('Email')).toBe('{{person.email}}');
    expect(text('Unterschrift')).toBe('');
    expect(antragPdfKoerper(BLATT)).toContain('Lohmar, {{currentDate}}');
  });

  it('jede Feldart hat einen Namen und ein Beispiel', () => {
    for (const art of PDF_FELD_ARTEN) {
      expect(PDF_FELD_NAME[art]).toBeTruthy();
      const f: PdfFeld = { id: 'x', art, x: 0, y: 0, pt: 11 };
      if (art !== 'Unterschrift')
        expect(pdfFeldBeispiel(f, '19. November 2026')).not.toMatch(/[{}]/);
    }
  });

  it('Beispielperson in der Vorschau – dieselbe Ersetzung wie beim Baukasten', () => {
    const v = antragPdfVorschau(BLATT, '19. November 2026');
    expect(v).not.toContain('{{');
    expect(v).toContain('Probst, Lena');
    expect(v).toContain('Lohmar, 19. November 2026');
    expect(pdfFeldBeispiel(FELDER[0], 'x')).toBe('Probst, Lena');
    expect(pdfFeldBeispiel({ id: 'a', art: 'Adresse', x: 0, y: 0, pt: 11 }, 'x')).toBe(
      'Bachweg 7, 53797 Lohmar',
    );
    expect(pdfFeldBeispiel({ id: 'a', art: 'Email', x: 0, y: 0, pt: 11 }, 'x')).toContain('@');
  });

  it('Escaping wie im Baukasten: Vorsatz wird escaped, fremde {{…}} werden entschärft', () => {
    const boese: PdfFeld = {
      id: 'f9',
      art: 'Heute',
      x: 1,
      y: 2,
      pt: 11,
      vorsatz: '<b>"{{person.lastName}}"</b> & ',
    };
    const html = antragPdfKoerper({ ...BLATT, felder: [boese] });
    expect(html).not.toContain('<b>');
    expect(html).toContain(
      '&lt;b&gt;&quot;&#123;&#123;person.lastName&#125;&#125;&quot;&lt;/b&gt; &amp; ',
    );
    // nur unser eigener Platzhalter bleibt als {{…}}
    expect(html.match(/\{\{[^}]*\}\}/g)).toEqual(['{{currentDate}}']);
    // Im Editor/der Vorschau steht der Text wörtlich (React escaped selbst), nicht doppelt verschlüsselt
    expect(pdfFeldBeispiel(boese, '19. November 2026')).toBe(
      '<b>"{{person.lastName}}"</b> & 19. November 2026',
    );
  });

  it('nur eingebettete Bilder: eine fremde Adresse als Hintergrund oder Unterschrift kommt nicht ins HTML', () => {
    for (const boese of [
      'https://boese.example/x.jpg',
      'javascript:alert(1)',
      'data:text/html;base64,AAAA',
      '" onerror="x',
    ]) {
      const html = antragPdfKoerper({ ...BLATT, hintergrund: boese, unterschrift: boese });
      expect(html).not.toContain('<img');
    }
  });

  it('ohne Bild: Blatt ohne <img>, aber lesbar; ohne Unterschrift-Bild bleibt das Feld weg', () => {
    const html = antragPdfKoerper({ ...BLATT, hintergrund: null, unterschrift: null });
    expect(html).not.toContain('<img');
    expect(antragBilderLesen(html)).toEqual({ logo: null, unterschrift: null, hintergrund: null });
  });
});

describe('Bilder zurücklesen inkl. Hintergrund', () => {
  it('Hintergrund und Unterschrift lassen sich aus dem HTML herauslesen, das Logo gibt es nicht', () => {
    expect(antragBilderLesen(antragPdfHtml(BLATT))).toEqual({
      logo: null,
      unterschrift: PNG,
      hintergrund: JPG,
    });
  });

  it('der Hintergrund zählt nur als data:-Bild; kein Blatt von uns → null (nie „keine Bilder“)', () => {
    const fremd = `<div data-nachweis="blatt"><img data-nachweis="hintergrund" src="https://x.example/a.jpg"></div>`;
    expect(antragBilderLesen(fremd)?.hintergrund).toBeNull();
    expect(antragBilderLesen(`<img data-nachweis="hintergrund" src="${JPG}">`)).toBeNull();
  });
});

describe('Datenblock: Fassung 3 (PDF), Fassung 1 und 2 bleiben lesbar', () => {
  const baukasten: NachweisAntrag = { ...antragVorgabe('ECG'), vorlageId: 17 };
  const pdf: NachweisAntrag = {
    ...baukasten,
    art: 'pdf',
    pdf: { breiteMm: 210, hoeheMm: 297, felder: FELDER },
  };
  const E = (antrag?: NachweisAntrag): NachweisEinstellungen => ({
    gueltigJahre: 3,
    ab: 'ausstellung',
    betreff: 'Bitte',
    text: 'Hallo [Vorname]',
    ...(antrag ? { antrag } : {}),
  });

  it('Seitenformat und Platzhalter stehen im Block – ohne Bild', () => {
    const code = nachweisEinstellungenPacken(E(pdf));
    const zurueck = nachweisEinstellungenLesen(`x\n\n[nachweis]: #v1:${code}\n`);
    expect(zurueck?.antrag).toEqual(pdf);
    expect(code).not.toContain('data:image');
    expect(JSON.stringify(zurueck)).not.toContain('base64');
  });

  it('Block ohne Antrag, mit Baukasten (Fassung 2) und älterer Block ohne art/pdf sind weiter lesbar', () => {
    expect(
      nachweisEinstellungenLesen(`[nachweis]: #v1:${nachweisEinstellungenPacken(E())}`)?.antrag,
    ).toBeUndefined();
    const alt = nachweisEinstellungenLesen(
      `[nachweis]: #v1:${nachweisEinstellungenPacken(E(baukasten))}`,
    );
    expect(alt?.antrag).toEqual(baukasten);
    expect(alt?.antrag?.art).toBeUndefined();
    expect(alt?.antrag?.pdf).toBeUndefined();
  });

  it('die Fassung steht richtig: 1 ohne, 2 mit Baukasten, 3 mit PDF', async () => {
    const { textEntpacken } = await import('../ct/packen');
    const fassung = (e: NachweisEinstellungen) =>
      (JSON.parse(textEntpacken(nachweisEinstellungenPacken(e))) as { fassung: number }).fassung;
    expect(fassung(E())).toBe(1);
    expect(fassung(E(baukasten))).toBe(2);
    expect(fassung(E({ ...baukasten, art: 'baukasten' }))).toBe(2);
    expect(fassung(E(pdf))).toBe(3);
  });

  it('gleicherAntrag unterscheidet Art und Platzhalter, „art fehlt“ = Baukasten', () => {
    expect(gleicherAntrag(baukasten, { ...baukasten, art: 'baukasten' })).toBe(true);
    expect(gleicherAntrag(baukasten, pdf)).toBe(false);
    expect(
      gleicherAntrag(pdf, { ...pdf, pdf: { ...pdf.pdf!, felder: [{ ...FELDER[0], x: 37 }] } }),
    ).toBe(false);
    expect(gleicherAntrag(pdf, JSON.parse(JSON.stringify(pdf)))).toBe(true);
  });

  it('Prüfung: PDF braucht Seite und mindestens einen Platzhalter; Baukasten-Texte zählen dort nicht', () => {
    expect(antragFehler({ ...pdf, text: '', ueberschrift: '' })).toBeNull();
    expect(antragFehler({ ...pdf, pdf: undefined })).toMatch(/PDF/);
    expect(antragFehler({ ...pdf, pdf: { ...pdf.pdf!, felder: [] } })).toMatch(/Platzhalter/);
    const zweimal = pdf.pdf!.felder.concat({ ...FELDER[2], id: 'f4' });
    expect(antragFehler({ ...pdf, pdf: { ...pdf.pdf!, felder: zweimal } })).toMatch(/nur einmal/);
    expect(antragFehler({ ...pdf, pdf: { ...pdf.pdf!, breiteMm: 9999 } })).toBeTruthy();
    expect(
      antragFehler({ ...pdf, pdf: { ...pdf.pdf!, felder: [{ ...FELDER[0], x: 120 }] } }),
    ).toBeTruthy();
    // „Mit Antrag“ aus: nichts wird geprüft
    expect(antragFehler({ ...pdf, an: false, pdf: undefined })).toBeNull();
    expect(nachweisEinstellungenFehler(E({ ...pdf, pdf: undefined }))).toMatch(/PDF/);
    expect(nachweisEinstellungenFehler(E(pdf))).toBeNull();
  });
});

describe('Hilfen', () => {
  it('Ort aus dem Briefkopf: die Stadt hinter der Postleitzahl, sonst nichts', () => {
    expect(antragOrt('Evangeliumschristen-Gemeinde e.V. · Musterstraße 1 · 53797 Lohmar')).toBe(
      'Lohmar',
    );
    expect(antragOrt('ECG Donrath, Hauptstr. 1, 53797 Lohmar-Donrath, Deutschland')).toBe(
      'Lohmar-Donrath',
    );
    expect(antragOrt('Bad Honnef 53604 Bad Honnef')).toBe('Bad Honnef');
    expect(antragOrt('ECG Donrath')).toBeNull();
    expect(antragOrt('')).toBeNull();
  });

  it('Vorgabe beim ersten Hochladen: Name, Geburtsdatum, Adresse, „Ort, [Heute]“, Unterschrift untereinander', () => {
    const f = pdfVorgabeFelder('Lohmar');
    expect(f.map((x) => x.art)).toEqual([
      'NachnameVorname',
      'Geburtsdatum',
      'Adresse',
      'Heute',
      'Unterschrift',
    ]);
    expect(f[3].vorsatz).toBe('Lohmar, ');
    expect(new Set(f.map((x) => x.id)).size).toBe(f.length);
    const ys = f.map((x) => x.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    expect(pdfVorgabeFelder(null)[3].vorsatz).toBeUndefined();
  });

  it('neue Kennungen sind nie doppelt, Vorgaben je Art (11 pt, Unterschrift 50 mm)', () => {
    expect(pdfNeueId([])).toBe('f1');
    expect(pdfNeueId(FELDER.map((f, i) => ({ ...f, id: `f${i + 5}` })))).toBe('f8');
    expect(pdfNeuesFeld([], 'Adresse', 1, 2)).toMatchObject({ id: 'f1', pt: 11, x: 1, y: 2 });
    expect(pdfNeuesFeld([], 'Unterschrift', 1, 2).breiteMm).toBe(50);
    expect(pdfNeuesFeld([], 'Adresse', 1, 2).breiteMm).toBeUndefined();
  });

  it('pdfBlatt fügt Format, Felder und Bilder zusammen', () => {
    expect(
      pdfBlatt({ breiteMm: 1, hoeheMm: 2, felder: [] }, { hintergrund: JPG, unterschrift: null }),
    ).toEqual({
      breiteMm: 1,
      hoeheMm: 2,
      felder: [],
      hintergrund: JPG,
      unterschrift: null,
    });
  });
});
