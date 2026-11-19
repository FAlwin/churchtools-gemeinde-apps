import { describe, expect, it } from 'vitest';
import { textEntpacken, textPacken } from '../ct/packen';
import {
  ANTRAG_BEISPIEL,
  ANTRAG_PLATZHALTER,
  ANTRAG_VORGABE_TEXT,
  antragBilderLesen,
  antragBlatt,
  antragFehler,
  antragHtml,
  antragKoerper,
  antragVorgabe,
  antragVorschau,
  bildAdresseOk,
  nachweisMailVorgabe,
  type AntragBlatt,
  type NachweisAntrag,
} from './nachweisAntrag';
import { nachweisEinstellungenLesen, nachweisNotiz, type NachweisEinstellungen } from './nachweise';

/** Ein winziges, aber gültiges PNG als `data:`-Adresse (1 × 1) und ein JPG-Kopf – nur die Form zählt. */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////';
const LOGO_URL = 'https://ecg.church.tools/images/558/logo.png?v=1&b=2';

const BLATT: AntragBlatt = {
  briefkopf: 'Evangeliumschristen-Gemeinde e.V. · Musterstraße 1',
  ueberschrift: 'Bestätigung zur Vorlage bei der Meldebehörde',
  text: ANTRAG_VORGABE_TEXT,
  logo: PNG,
  unterschrift: JPG,
};

const klammern = (html: string) => html.match(/\{\{/g)?.length ?? 0;

describe('Platzhalter', () => {
  it('jeder der fünf wird zum ChurchTools-Platzhalter, Adresse aus drei Teilen', () => {
    const html = antragKoerper({
      ...BLATT,
      text: ANTRAG_PLATZHALTER.map((p) => `[${p}]`).join(' | '),
    });
    for (const ct of [
      '{{person.firstName}}',
      '{{person.lastName}}',
      '{{person.birthday}}',
      '{{person.street}}, {{person.zip}} {{person.city}}',
    ])
      expect(html).toContain(ct);
    // `[Heute]` und das Datum im Briefkopf: zweimal `currentDate`
    expect(html.match(/\{\{currentDate\}\}/g)).toHaveLength(2);
    expect(html).not.toContain('[Vorname]');
  });

  it('der Vorgabetext benutzt nur Platzhalter, die es gibt', () => {
    expect(antragFehler(antragVorgabe('ECG'))).toBeNull();
  });
});

describe('(a) Nutzertext wird escaped', () => {
  it('<script> in Text, Briefkopf und Überschrift kommt nie als Tag ins HTML', () => {
    const boese = '<script>alert(1)</script><img src=x onerror=alert(2)>';
    for (const html of [
      antragHtml({ ...BLATT, text: boese }),
      antragHtml({ ...BLATT, briefkopf: boese }),
      antragHtml({ ...BLATT, ueberschrift: boese }),
    ]) {
      expect(html).not.toContain('<script');
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;script&gt;');
    }
  });

  it('Anführungszeichen brechen nicht aus dem Attribut der Bild-Adresse aus', () => {
    const html = antragKoerper({ ...BLATT, logo: 'https://x.de/a"onerror="alert(1)' });
    // Keine Adresse mit Anführungszeichen: das Bild fehlt, statt zu entgleisen.
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('data-nachweis="logo"');
  });
});

describe('(b) „{{“ im Nutzertext wird nie ein Platzhalter', () => {
  it('fremde Platzhalter im Text bleiben Text; nur die eigenen sind {{…}}', () => {
    const html = antragKoerper({
      ...BLATT,
      text: '[Vorname] schreibt {{person.lastName}} und {{ evil }} und {{currentDate}}',
      briefkopf: '{{person.firstName}}',
      ueberschrift: '{{person.birthday}}',
    });
    // eigene: Datum im Briefkopf + [Vorname] = 2
    expect(klammern(html)).toBe(2);
    expect(html).toContain('&#123;&#123;person.lastName&#125;&#125;');
    expect(html).toContain('&#123;&#123; evil &#125;&#125;');
  });

  it('die Vorschau ersetzt nur die eigenen – ein eingeschleuster Platzhalter bleibt als Text sichtbar', () => {
    const html = antragVorschau(
      { ...BLATT, text: '[Vorname] {{person.lastName}}' },
      '19. November 2026',
    );
    expect(html).toContain('Lena &#123;&#123;person.lastName&#125;&#125;');
    expect(klammern(html)).toBe(0);
  });
});

describe('Absätze', () => {
  it('Leerzeilen trennen Absätze, ein einfacher Zeilenumbruch bleibt einer', () => {
    const html = antragKoerper({ ...BLATT, text: 'Eins\n\nZwei\nDrei\r\n\r\n\r\nVier' });
    expect(html.match(/<p /g)).toHaveLength(3);
    expect(html).toContain('Zwei<br>Drei');
  });

  it('ohne Text gar kein Absatz', () => {
    expect(antragKoerper({ ...BLATT, text: '   \n\n ' })).not.toContain('<p ');
  });
});

describe('Bilder', () => {
  it('Logo und Unterschrift sind markiert und lassen sich wieder herauslesen', () => {
    const html = antragHtml(BLATT);
    expect(html).toContain('data-nachweis="logo"');
    expect(html).toContain('data-nachweis="unterschrift"');
    expect(antragBilderLesen(html)).toEqual({ logo: PNG, unterschrift: JPG });
  });

  it('die https-Adresse des Gemeindelogos übersteht das Escapen (&)', () => {
    const html = antragHtml({ ...BLATT, logo: LOGO_URL, unterschrift: null });
    expect(html).toContain('&amp;b=2');
    expect(antragBilderLesen(html)).toEqual({ logo: LOGO_URL, unterschrift: null });
  });

  it('ohne Logo und ohne Unterschrift: Blatt ohne Bilder, aber lesbar (nicht „unlesbar“)', () => {
    const html = antragHtml({ ...BLATT, logo: null, unterschrift: null });
    expect(html).not.toContain('<img');
    expect(antragBilderLesen(html)).toEqual({ logo: null, unterschrift: null });
    // die Linie mit der Beschriftung steht trotzdem da
    expect(html).toContain('Unterschrift / Stempel der Gemeinde');
  });

  it('nur eingebettetes PNG/JPG oder https kommt ins HTML – nichts anderes', () => {
    for (const boese of [
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'http://unsicher.de/a.png',
      '',
    ]) {
      expect(bildAdresseOk(boese)).toBe(false);
      expect(antragKoerper({ ...BLATT, logo: boese, unterschrift: boese })).not.toContain('<img');
    }
  });

  it('ein HTML, das kein Blatt von uns ist, ist „nicht lesbar“ (null) – nicht „keine Bilder“', () => {
    expect(antragBilderLesen('<p>umgeformt</p>')).toBeNull();
    expect(antragBilderLesen('')).toBeNull();
    // auch dann, wenn dort ein Bild steht: ohne Marker weiß man nicht, was wohin gehört
    expect(antragBilderLesen(`<img data-nachweis="unterschrift" src="${JPG}">`)).toBeNull();
  });

  it('ein fremdes Bild im Blatt mit unzulässiger Adresse zählt nicht', () => {
    const html = `<div data-nachweis="blatt"><img data-nachweis="logo" src="javascript:x"></div>`;
    expect(antragBilderLesen(html)).toEqual({ logo: null, unterschrift: null });
  });
});

describe('(g) Vorschau und PDF kommen aus demselben Erzeuger', () => {
  it('das HTML für ChurchTools enthält genau das Blatt der Vorschau – nur mit {{…}} statt Beispielwerten', () => {
    const koerper = antragKoerper(BLATT);
    expect(antragHtml(BLATT)).toContain(koerper);
    const x = ANTRAG_BEISPIEL;
    const erwartet = koerper
      .replaceAll('{{person.firstName}}', x.vorname)
      .replaceAll('{{person.lastName}}', x.nachname)
      .replaceAll('{{person.birthday}}', x.geburtsdatum)
      .replaceAll('{{person.street}}', x.strasse)
      .replaceAll('{{person.zip}}', x.plz)
      .replaceAll('{{person.city}}', x.ort)
      .replaceAll('{{currentDate}}', '19. November 2026');
    expect(antragVorschau(BLATT, '19. November 2026')).toBe(erwartet);
  });

  it('die Vorschau zeigt die Beispielperson und keinen Platzhalter mehr', () => {
    const v = antragVorschau(BLATT, '19. November 2026');
    expect(v).toContain('Lena Probst');
    expect(v).toContain('14.03.2001');
    expect(v).toContain('Bachweg 7, 53797 Lohmar');
    expect(v).toContain('19. November 2026');
    expect(klammern(v)).toBe(0);
  });

  it('das Dokument ist A4 mit Seitenrand', () => {
    expect(antragHtml(BLATT)).toContain('@page { size: A4;');
  });
});

describe('Prüfung der Eingaben', () => {
  const A: NachweisAntrag = { ...antragVorgabe('ECG'), vorlageId: null };
  it('Vorgabe taugt; „aus“ prüft nichts', () => {
    expect(antragFehler(A)).toBeNull();
    expect(antragFehler({ ...A, an: false, text: '', ueberschrift: '' })).toBeNull();
  });
  it('leere Überschrift, leerer Text, zu lang, unbekannter Platzhalter', () => {
    expect(antragFehler({ ...A, ueberschrift: ' ' })).toMatch(/Überschrift/);
    expect(antragFehler({ ...A, text: ' ' })).toMatch(/Text/);
    expect(antragFehler({ ...A, text: 'x'.repeat(3001) })).toMatch(/zu lang/);
    expect(antragFehler({ ...A, text: 'Hallo [Straße]' })).toMatch(/\[Straße\]/);
  });
});

describe('Mail-Vorgabe', () => {
  it('mit Antrag nennt sie den Weg zur Bescheinigung mit dem Namen der Art', () => {
    const t = nachweisMailVorgabe('Führungszeugnis', true);
    expect(t).toContain('„Meine Gruppen“ → „Nachweis: Führungszeugnis“ → Bescheinigungen');
    expect(t).toContain('[Vorname]');
  });
  it('ohne Antrag bleibt es der bisherige Text', () => {
    const t = nachweisMailVorgabe('Führungszeugnis', false);
    expect(t).not.toContain('Bescheinigungen');
    expect(t).toContain('„Meine Gruppen“');
  });
});

describe('Datenblock: Fassung 1 (N1b) bleibt lesbar', () => {
  const E1: NachweisEinstellungen = {
    gueltigJahre: 3,
    ab: 'ausstellung',
    betreff: 'Betreff',
    text: 'Hallo [Vorname]',
  };
  const fassung = (notiz: string) =>
    (JSON.parse(textEntpacken(/#v1:([A-Za-z0-9_-]+)/.exec(notiz)![1])) as { fassung: number })
      .fassung;

  it('ohne Antrag wird weiter Fassung 1 geschrieben – und als „kein Antrag“ gelesen', () => {
    const notiz = nachweisNotiz(E1);
    expect(fassung(notiz)).toBe(1);
    const gelesen = nachweisEinstellungenLesen(notiz);
    expect(gelesen).toEqual(E1);
    expect(gelesen?.antrag).toBeUndefined();
  });

  it('mit Antrag: Fassung 2, alle Texte und die Nummer der Vorlage kommen zurück – keine Bilder', () => {
    const antrag: NachweisAntrag = { ...antragVorgabe('ECG'), logo: 'eigen', vorlageId: 17 };
    const notiz = nachweisNotiz({ ...E1, antrag });
    expect(fassung(notiz)).toBe(2);
    expect(nachweisEinstellungenLesen(notiz)).toEqual({ ...E1, antrag });
    expect(notiz).not.toContain('data:image');
  });

  it('ein Antrag mit falscher Form macht den Block unlesbar (null), statt halb zu gelten', () => {
    const block = (logo: string) =>
      `[nachweis]: #v1:${textPacken(
        JSON.stringify({
          art: 'nachweis-einstellungen',
          fassung: 2,
          ...E1,
          antrag: { ...antragVorgabe('ECG'), logo },
        }),
      )}`;
    expect(nachweisEinstellungenLesen(block('eigen'))).not.toBeNull();
    expect(nachweisEinstellungenLesen(block('gross'))).toBeNull();
  });

  it('antragBlatt übernimmt die Texte und die aufgelösten Bilder', () => {
    const b = antragBlatt(antragVorgabe('ECG'), { logo: PNG, unterschrift: null });
    expect(b).toMatchObject({ briefkopf: 'ECG', logo: PNG, unterschrift: null });
  });
});
