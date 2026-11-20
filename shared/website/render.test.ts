import { describe, expect, it } from 'vitest';
import { baustein, einstellungen, kontext, menue, seite, seiteMit } from './website.testdaten';
import { BAUSTEIN_TYPEN, type Baustein, type Link, type Seite } from './modell';
import { renderBaustein, renderSeite, standardAdresse, type RenderKontext } from './render';

const BOESE_TEXT = '<script>alert(1)</script>';
const BOESE_ATTR = '" onerror="alert(1)" x="';
const BOESE_LINK: Link = { art: 'extern', url: 'javascript:alert(1)' };

/** Kontext mit Daten für alle dynamischen Bausteine. */
function vollerKontext(o: Partial<RenderKontext> = {}): RenderKontext {
  const bild = { id: 'b1', breite: 1600, hoehe: 900 };
  return kontext({
    beitraege: [
      { id: '1', titel: 'Alt', text: 'Alter Text', datum: '2026-01-05T10:00:00Z', gruppenId: 7 },
      {
        id: '2',
        titel: 'Neu',
        text: 'Neuer **Text**',
        datum: '2026-03-05T10:00:00Z',
        bild,
        gruppenId: 8,
      },
    ],
    termine: [
      {
        titel: 'Später',
        beginn: '2026-07-02T08:00:00Z',
        ende: '2026-07-02T09:00:00Z',
        ganztaegig: false,
        ort: 'Saal',
        kalenderId: 1,
      },
      {
        titel: 'Früher',
        beginn: '2026-07-01T08:00:00Z',
        ende: '2026-07-01T09:30:00Z',
        ganztaegig: false,
        kalenderId: 1,
      },
      {
        titel: 'Fremder Kalender',
        beginn: '2026-07-01T08:00:00Z',
        ende: '2026-07-01T09:00:00Z',
        ganztaegig: false,
        kalenderId: 99,
      },
    ],
    sliderFolien: [
      { bild, alt: 'Eins' },
      { bild: { id: 'b2' }, alt: 'Zwei', link: { art: 'extern', url: 'https://a.de' } },
    ],
    livestream: {
      aktuell: {
        id: 'v0',
        titel: 'Live',
        datum: '2026-05-03T08:00:00Z',
        adresse: 'https://video.beispiel.de/v0',
      },
      archiv: [
        { id: 'v1', titel: 'Ältere', datum: '2026-04-01T08:00:00Z' },
        { id: 'v2', titel: 'Neuere', datum: '2026-04-26T08:00:00Z', vorschaubild: { id: 'v2' } },
      ],
    },
    gruppen: [
      { id: 1, name: 'Zebra', gruppentypId: 5 },
      { id: 2, name: 'Äpfel', beschreibung: 'Beschreibung', gruppentypId: 5, bild },
      { id: 3, name: 'Andere', gruppentypId: 6 },
    ],
    ...o,
  });
}

describe('renderBaustein', () => {
  it('jeder Typ wird gerendert (ein neuer Typ ohne Renderer fällt hier auf)', () => {
    const k = vollerKontext();
    for (const typ of BAUSTEIN_TYPEN) {
      const html = renderBaustein(baustein(typ), k);
      expect(html, typ).toContain(`<div class="w-baustein w-b-${typ}">`);
      expect(html.length, typ).toBeGreaterThan(`<div class="w-baustein w-b-${typ}"></div>`.length);
    }
  });

  it('kein Typ stürzt mit leeren Daten ab, und dynamische zeigen einen ruhigen Hinweis', () => {
    const k = kontext(); // keine Daten
    for (const typ of BAUSTEIN_TYPEN)
      expect(() => renderBaustein(baustein(typ), k), typ).not.toThrow();
    expect(renderBaustein(baustein('termine'), k)).toContain('Zurzeit keine Termine.');
    expect(renderBaustein(baustein('beitraege'), k)).toContain('Zurzeit keine Beiträge.');
    expect(renderBaustein(baustein('gruppenliste'), k)).toContain('Zurzeit keine Gruppen.');
    expect(renderBaustein(baustein('livestream'), k)).toContain('Zurzeit kein Livestream.');
    expect(renderBaustein(baustein('livestream'), k)).toContain('Zurzeit keine Aufzeichnungen.');
  });

  it('Termine: nur gewählte Kalender, nach Beginn sortiert, begrenzt', () => {
    const k = vollerKontext();
    const html = renderBaustein(baustein('termine', { kalender: [1], anzahl: 5 }), k);
    expect(html).not.toContain('Fremder Kalender');
    expect(html.indexOf('Früher')).toBeGreaterThan(-1);
    expect(html.indexOf('Früher')).toBeLessThan(html.indexOf('Später'));
    const eins = renderBaustein(baustein('termine', { kalender: [1], anzahl: 1 }), k);
    expect(eins).toContain('Früher');
    expect(eins).not.toContain('Später');
  });

  it('Zeitzone: 23:30 UTC im Sommer ist in Berlin der nächste Tag, 01:30', () => {
    const k = kontext({
      termine: [
        {
          titel: 'Nachtwache',
          beginn: '2026-07-01T23:30:00Z',
          ende: '2026-07-02T00:30:00Z',
          ganztaegig: false,
          kalenderId: 1,
        },
      ],
      beitraege: [{ id: 'x', titel: 'Spät', text: 't', datum: '2026-07-01T23:30:00Z' }],
    });
    const termin = renderBaustein(baustein('termine', { kalender: [1] }), k);
    expect(termin).toContain('Do, 02.07.2026, 01:30 – 02:30 Uhr');
    expect(renderBaustein(baustein('beitraege'), k)).toContain('02.07.2026');
    // Winter: +1 Stunde
    const winter = kontext({
      termine: [
        {
          titel: 'W',
          beginn: '2026-12-01T23:30:00Z',
          ende: '2026-12-02T00:30:00Z',
          ganztaegig: false,
          kalenderId: 1,
        },
      ],
    });
    expect(renderBaustein(baustein('termine', { kalender: [1] }), winter)).toContain(
      'Mi, 02.12.2026, 00:30 – 01:30 Uhr',
    );
  });

  it('Zeitzone kommt aus dem Kontext, nicht aus dem Code (#847, andere Gemeinden)', () => {
    const termine = [
      {
        titel: 'Abend',
        beginn: '2026-07-02T02:00:00Z',
        ende: '2026-07-02T03:00:00Z',
        ganztaegig: false,
        kalenderId: 1,
      },
    ];
    const beitraege = [{ id: 'x', titel: 'Spät', text: 't', datum: '2026-07-02T02:00:00Z' }];
    const k = kontext({ termine, beitraege, zeitzone: 'America/New_York' });
    expect(renderBaustein(baustein('termine', { kalender: [1] }), k)).toContain(
      'Mi, 01.07.2026, 22:00 – 23:00 Uhr',
    );
    expect(renderBaustein(baustein('beitraege'), k)).toContain('01.07.2026');
    const archiv = { archiv: [{ id: 'v', titel: 'V', datum: '2026-07-02T02:00:00Z' }] };
    expect(
      renderBaustein(baustein('livestream', { zeigen: 'archiv' }), { ...k, livestream: archiv }),
    ).toContain('01.07.2026');
  });

  it('ganztägige und mehrtägige Termine', () => {
    const k = kontext({
      termine: [
        { titel: 'Tag', beginn: '2026-08-01', ende: '2026-08-01', ganztaegig: true, kalenderId: 1 },
        {
          titel: 'Freizeit',
          beginn: '2026-08-03',
          ende: '2026-08-07',
          ganztaegig: true,
          kalenderId: 1,
        },
      ],
    });
    const html = renderBaustein(baustein('termine', { kalender: [1] }), k);
    expect(html).toContain('Sa, 01.08.2026, ganztägig');
    expect(html).toContain('Mo, 03.08.2026 – Fr, 07.08.2026');
  });

  it('Beiträge: neueste zuerst, Gruppenfilter, Anzahl, Markdown im Text', () => {
    const k = vollerKontext();
    const alle = renderBaustein(baustein('beitraege', { anzahl: 5 }), k);
    expect(alle.indexOf('Neu')).toBeLessThan(alle.indexOf('Alt'));
    expect(alle).toContain('<strong>Text</strong>');
    const gruppe7 = renderBaustein(baustein('beitraege', { gruppen: [7] }), k);
    expect(gruppe7).toContain('Alter Text');
    expect(gruppe7).not.toContain('Neuer');
    expect(renderBaustein(baustein('beitraege', { anzahl: 1 }), k)).not.toContain('Alter Text');
  });

  it('Gruppen: Typfilter und Sortierung nach Namen', () => {
    const k = vollerKontext();
    const html = renderBaustein(baustein('gruppenliste', { gruppentypen: [5] }), k);
    expect(html).not.toContain('Andere');
    expect(html.indexOf('Äpfel')).toBeLessThan(html.indexOf('Zebra'));
    expect(renderBaustein(baustein('gruppenliste'), k)).toContain('Andere');
  });

  it('Livestream: je nach „zeigen“, Archiv begrenzt und neueste zuerst', () => {
    const k = vollerKontext();
    const nurStream = renderBaustein(baustein('livestream', { zeigen: 'stream' }), k);
    expect(nurStream).toContain('Live');
    expect(nurStream).not.toContain('Ältere');
    const nurArchiv = renderBaustein(
      baustein('livestream', { zeigen: 'archiv', archivAnzahl: 1 }),
      k,
    );
    expect(nurArchiv).toContain('Neuere');
    expect(nurArchiv).not.toContain('Ältere');
    expect(nurArchiv).not.toContain('w-stream-aktuell');
    expect(nurStream).toContain('href="https://video.beispiel.de/v0"');
  });

  it('Bilder: srcset, Maße, lazy – nur das erste Bild der Seite lädt sofort', () => {
    const k = vollerKontext();
    const html = renderBaustein(baustein('bild'), k, true);
    expect(html).toContain(
      'srcset="/bilder/bild-1-480.jpg 480w, /bilder/bild-1-800.jpg 800w, /bilder/bild-1-1200.jpg 1200w, /bilder/bild-1-1600.jpg 1600w"',
    );
    expect(html).toContain('width="1600" height="900"');
    expect(html).not.toContain('loading="lazy"');
    expect(renderBaustein(baustein('bild'), k)).toContain('loading="lazy"');

    const s = seiteMit([
      baustein('ueberschrift'),
      baustein('bild', { id: 'a' }),
      baustein('bild', { id: 'b' }),
    ]);
    const doc = renderSeite(s, k);
    expect(doc.match(/loading="lazy"/g)).toHaveLength(1);
  });

  it('kleine Bilder bekommen keine Breiten, die sie nicht hergeben', () => {
    const k = kontext();
    const html = renderBaustein(baustein('bild', { bild: { id: 'k', breite: 600 } }), k);
    expect(html).toContain('480w');
    expect(html).not.toContain('800w');
  });

  it('Kontaktformular: Ziel aus den Einstellungen, Honigtopf, Labels, kein Skript', () => {
    const html = renderBaustein(baustein('kontaktformular'), kontext());
    expect(html).toContain(
      '<form class="w-formular" method="post" action="https://formular.beispiel.de/annahme">',
    );
    expect(html).toContain('name="website"');
    expect(html).toMatch(/class="w-honig" hidden/);
    for (const feld of ['name', 'email', 'nachricht']) {
      expect(html).toMatch(new RegExp(`<label for="b-kontaktformular-${feld}">[^<]+</label>`));
    }
    const ohne = renderBaustein(
      baustein('kontaktformular'),
      kontext({ einstellungen: einstellungen({ kontaktAdresse: undefined }) }),
    );
    expect(ohne).not.toContain('<form');
    expect(ohne).toContain('noch nicht eingerichtet');
  });

  it('Slider: Folien als Liste, Intervall als Datenattribut, ohne Folien nichts', () => {
    const html = renderBaustein(baustein('slider'), vollerKontext());
    expect(html).toContain('<div class="w-slider" data-intervall="6">');
    expect(html.match(/class="w-folie"/g)).toHaveLength(2);
    expect(html).toContain('<a class="w-folie" href="https://a.de" rel="noopener">');
    expect(renderBaustein(baustein('slider'), kontext())).toBe(
      '<div class="w-baustein w-b-slider"></div>',
    );
  });

  /** Eine Knopf-Reihe mit EINEM Knopf. */
  const einKnopf = (ziel: Link, art: 'haupt' | 'neben' = 'haupt', text = 'Los') =>
    baustein('knoepfe', { knoepfe: [{ text, ziel, art }] });

  it('Knöpfe und Seiten-Link über adresseVon des Kontexts', () => {
    const k = kontext({ seiten: [seite(), seite({ id: 'x', pfad: 'zweite', startseite: false })] });
    expect(renderBaustein(baustein('knoepfe'), k)).toContain('href="/"');
    const zweite = einKnopf({ art: 'seite', seiteId: 'x' });
    expect(renderBaustein(zweite, k)).toContain('href="/zweite/"');
    const vorschau = kontext({ seiten: k.seiten, adresseVon: (s) => `?seite=${s.id}` });
    expect(renderBaustein(zweite, vorschau)).toContain('href="?seite=x"');
    // toter Link: kein href
    const tot = einKnopf({ art: 'seite', seiteId: 'weg' });
    expect(renderBaustein(tot, k)).not.toContain('href');
    // Sprunglink
    expect(renderBaustein(einKnopf({ art: 'anker', anker: 'termine' }), k)).toContain(
      'href="#termine"',
    );
  });

  it('Knopf-Reihe: Klassen des Entwurfs, Reihenfolge, haupt/neben', () => {
    const html = renderBaustein(baustein('knoepfe'), kontext());
    expect(html).toContain('<div class="w-knopfreihe">');
    expect(html).toMatch(/<a class="w-knopf" href="\/">Mehr erfahren<\/a>/);
    expect(html).toMatch(
      /<a class="w-knopf w-knopf--neben" href="https:\/\/beispiel.de" rel="noopener">Zweiter Weg<\/a>/,
    );
    expect(html.indexOf('Mehr erfahren')).toBeLessThan(html.indexOf('Zweiter Weg'));
  });

  it('keine externen Ressourcen: nur der eine Skript-Verweis, nie ein iframe, keine fremden Hosts in src/srcset', () => {
    const s = seiteMit(BAUSTEIN_TYPEN.map((t) => baustein(t)));
    const doc = renderSeite(s, vollerKontext());
    expect(doc.match(/<script\b/gi)).toHaveLength(1);
    expect(doc).toContain('<script src="/website.js" defer></script>');
    expect(doc).not.toMatch(/<(iframe|object|embed)\b/i);
    expect(doc).not.toMatch(/\son\w+=/i);
    expect(doc).not.toMatch(/(?:src|srcset)="https?:/);
    // `style="…"` gibt es nur, wenn ein Abschnitt oder eine Spalte eigene Werte hat – hier keine
    expect(doc).not.toMatch(/\sstyle=/);
  });
});

describe('Schutz vor Einschleusen (XSS)', () => {
  /**
   * Strukturell prüfen statt nach Wörtern zu suchen: Eingeschleuste Zeichen stehen im Text oder im Attributwert
   * ohnehin als Text da – gefährlich wäre nur ein ECHTES Tag `<script>` oder ein ECHTES Attribut `on…=`. Weil alles
   * geschützt wird, kommt in Tags kein `>` aus Daten vor; die Tag-Suche ist deshalb sicher.
   */
  function pruefe(vollesDoc: string) {
    // Der EINE erlaubte Skript-Verweis (Adresse vom Kontext) gehört dazu – alles andere nicht.
    const doc = vollesDoc.replace(/<script src="[^"]*" defer><\/script>/g, '');
    const tags = doc.match(/<[a-z!/][^>]*>/gi) ?? [];
    for (const tag of tags) {
      expect(tag, 'Skript-Tag').not.toMatch(/^<\/?script/i);
      const ohneWerte = tag.replace(/="[^"]*"/g, '=""');
      expect(ohneWerte, `Ereignis-Attribut in ${tag}`).not.toMatch(/\son\w+/i);
      expect((tag.match(/"/g) ?? []).length % 2, `Anführungszeichen-Ausbruch in ${tag}`).toBe(0);
    }
    for (const m of doc.matchAll(/href="([^"]*)"/g)) {
      expect(m[1].trim(), 'href').not.toMatch(/^javascript:/i);
    }
    expect(doc).not.toContain(BOESE_TEXT);
    expect(doc).not.toMatch(/<script/i);
  }

  const bild = { id: BOESE_ATTR };

  it('alle Textfelder der Bausteine', () => {
    const bausteine: Baustein[] = [
      baustein('ueberschrift', { text: BOESE_TEXT }),
      baustein('text', {
        markdown: `${BOESE_TEXT}\n\n[x](javascript:alert(1))\n\n**${BOESE_TEXT}**`,
      }),
      baustein('bild', { alt: BOESE_ATTR, unterschrift: BOESE_TEXT, bild }),
      baustein('bildText', { alt: BOESE_ATTR, markdown: BOESE_TEXT, bild }),
      baustein('galerie', { bilder: [{ bild, alt: BOESE_ATTR, unterschrift: BOESE_TEXT }] }),
      baustein('knoepfe', {
        knoepfe: [
          { text: BOESE_TEXT, ziel: BOESE_LINK, art: 'haupt' },
          { text: BOESE_ATTR, ziel: BOESE_LINK, art: 'neben' },
        ],
      }),
      baustein('akzentzeile', { text: BOESE_TEXT }),
      baustein('kontaktformular', { einleitung: BOESE_TEXT, id: BOESE_ATTR }),
    ];
    const k = vollerKontext({
      bildAdresse: (b, breite) => `/x/${b.id}-${breite}.jpg`,
      beitraege: [{ id: BOESE_ATTR, titel: BOESE_TEXT, text: BOESE_TEXT, datum: BOESE_ATTR, bild }],
      termine: [
        {
          titel: BOESE_TEXT,
          beginn: '2026-07-01T08:00:00Z',
          ende: '2026-07-01T09:00:00Z',
          ganztaegig: false,
          ort: BOESE_TEXT,
          kalenderId: 1,
        },
      ],
      sliderFolien: [{ bild, alt: BOESE_ATTR, link: BOESE_LINK }],
      livestream: {
        aktuell: {
          id: BOESE_ATTR,
          titel: BOESE_TEXT,
          datum: BOESE_ATTR,
          adresse: 'javascript:alert(1)',
        },
        archiv: [{ id: 'a', titel: BOESE_TEXT, datum: '2026-04-01T08:00:00Z', vorschaubild: bild }],
      },
      gruppen: [{ id: 1, name: BOESE_TEXT, beschreibung: BOESE_TEXT, gruppentypId: 1, bild }],
    });
    const alle = [
      ...bausteine,
      baustein('beitraege', { id: 'b2' }),
      baustein('termine', { id: 't2', kalender: [1] }),
      baustein('slider', { id: 's2' }),
      baustein('livestream', { id: 'l2' }),
      baustein('gruppenliste', { id: 'g2' }),
    ];
    for (const b of alle) pruefe(renderBaustein(b, k));
    pruefe(renderSeite(seiteMit(alle), k));
  });

  it('Seitentitel, Beschreibung, Gemeindename, Stylesheet, Sprache, Menü und Fußzeile', () => {
    const start = seite({ titel: BOESE_TEXT, beschreibung: BOESE_ATTR });
    const k = kontext({
      seiten: [start],
      stylesheet: BOESE_ATTR,
      skriptAdresse: BOESE_ATTR,
      einstellungen: einstellungen({
        name: BOESE_TEXT,
        sprache: 'de',
        fusszeile: [
          { titel: BOESE_TEXT, ziel: BOESE_LINK },
          { titel: BOESE_ATTR, ziel: { art: 'extern', url: 'https://a.de/"onerror="x' } },
        ],
        logo: bild,
      }),
      bildAdresse: (b, breite) => `/x/${b.id}-${breite}.jpg`,
      menue: menue([
        { titel: BOESE_TEXT, ziel: BOESE_LINK, unter: [{ titel: BOESE_ATTR, ziel: BOESE_LINK }] },
      ]),
    });
    const doc = renderSeite(start, k);
    pruefe(doc);
    expect(doc).toContain('&lt;script&gt;alert(1)&lt;/script&gt; – &lt;script&gt;');
    expect(doc).not.toContain('javascript:');
  });

  it('Anführungszeichen im Attribut werden ersetzt – auch im Alt-Text und in Adressen', () => {
    const html = renderBaustein(baustein('bild', { alt: 'a"b\'c' }), kontext());
    expect(html).toContain('alt="a&quot;b&#39;c"');
    const knopf = baustein('knoepfe', {
      knoepfe: [{ text: 'x', ziel: { art: 'extern', url: 'https://a.de/?q="x"' }, art: 'haupt' }],
    });
    expect(renderBaustein(knopf, kontext())).toContain('href="https://a.de/?q=&quot;x&quot;"');
  });
});

describe('renderSeite', () => {
  const zweite: Seite = seite({ id: 'z', titel: 'Zweite', pfad: 'zweite', startseite: false });
  const m = menue([
    { titel: 'Start', ziel: { art: 'seite', seiteId: 'seite-start' } },
    {
      titel: 'Mehr',
      ziel: { art: 'seite', seiteId: 'z' },
      unter: [{ titel: 'Intern', ziel: { art: 'seite', seiteId: 'z' } }],
    },
  ]);

  it('mit `stylesheetText` steht ein `<style>` statt des `<link>`; `</style>` im Text bricht nicht aus', () => {
    const k = kontext({
      seiten: [seite()],
      stylesheetText: 'a{color:red}</style><script>x()</script><style>',
    });
    const doc = renderSeite(seite(), k);
    expect(doc).not.toContain('<link rel="stylesheet"');
    expect(doc).toContain('<style>a{color:red}<\\/style>');
    expect(doc).not.toContain('</style><script>');
  });

  it('ohne `skriptAdresse` (oder leer) steht kein Seiten-Skript im Dokument', () => {
    for (const skriptAdresse of [undefined, '']) {
      const doc = renderSeite(seite(), kontext({ seiten: [seite()], skriptAdresse }));
      expect(doc).not.toMatch(/<script\b/);
    }
  });

  it('vollständiges Dokument mit Titel, Sprache, Beschreibung, Stylesheet', () => {
    const k = kontext({ seiten: [seite(), zweite], menue: m });
    const doc = renderSeite(seite({ beschreibung: 'Kurz und gut' }), k);
    expect(doc.startsWith('<!doctype html>\n<html lang="de">')).toBe(true);
    expect(doc).toContain('<title>Startseite – Beispielgemeinde</title>');
    expect(doc).toContain('<meta name="description" content="Kurz und gut">');
    expect(doc).toContain('<link rel="stylesheet" href="/website.css">');
    expect(doc).toContain('<script src="/website.js" defer></script>');
    expect(doc).toContain('<main id="inhalt"');
    expect(doc).toContain('<footer');
    expect(renderSeite(seite(), k)).not.toContain('name="description"');
  });

  it('gleiche Eingabe, gleiche Ausgabe', () => {
    const s = seiteMit(BAUSTEIN_TYPEN.map((t) => baustein(t)));
    expect(renderSeite(s, vollerKontext())).toBe(renderSeite(s, vollerKontext()));
  });

  it('noindex nur, wenn eingestellt', () => {
    const an = kontext({ einstellungen: einstellungen({ noindex: true }) });
    expect(renderSeite(seite(), an)).toContain('<meta name="robots" content="noindex">');
    expect(renderSeite(seite(), kontext())).not.toContain('robots');
  });

  it('aria-current="page" genau auf dem aktuellen Menüpunkt', () => {
    const k = kontext({ seiten: [seite(), zweite], menue: m });
    const start = renderSeite(seite(), k);
    expect(start.match(/aria-current="page"/g)).toHaveLength(1);
    expect(start).toMatch(/<a href="\/" aria-current="page">Start<\/a>/);
    const doc = renderSeite(zweite, k);
    // „Mehr“ und der Unterpunkt „Intern“ zeigen beide auf die Seite
    expect(doc.match(/aria-current="page"/g)).toHaveLength(2);
    expect(doc).toContain('<a href="/">Start</a>'); // nicht aktuell → ohne Marke
  });

  it('ein aktiver Unterpunkt markiert den Elternpunkt mit aria-current="true"', () => {
    const ziel = { art: 'seite' as const, seiteId: 'z' };
    const k = kontext({
      seiten: [seite(), zweite],
      menue: menue([
        {
          titel: 'Eltern',
          ziel: { art: 'seite', seiteId: 'seite-start' },
          unter: [{ titel: 'Kind', ziel }],
        },
      ]),
    });
    const doc = renderSeite(zweite, k);
    expect(doc).toContain('aria-current="true">Eltern');
    expect(doc).toContain('aria-current="page">Kind');
  });

  it('Logo mit Namen als Alternativtext, Fußzeilen-Links, Standard-Adresse', () => {
    const k = kontext({
      seiten: [seite(), zweite],
      einstellungen: einstellungen({
        logo: { id: 'logo', breite: 400, hoehe: 100 },
        fusszeile: [
          { titel: 'Impressum', ziel: { art: 'seite', seiteId: 'z' } },
          { titel: 'Extern', ziel: { art: 'extern', url: 'https://a.de' } },
        ],
      }),
    });
    const doc = renderSeite(seite(), k);
    expect(doc).toContain('alt="Beispielgemeinde"');
    expect(doc).toContain('<a href="/zweite/">Impressum</a>');
    expect(doc).toContain('<a href="https://a.de" rel="noopener">Extern</a>');
    expect(standardAdresse(seite())).toBe('/');
    expect(standardAdresse(zweite)).toBe('/zweite/');
  });

  it('leere Seite ohne Menü und Fußzeile rendert ohne Absturz', () => {
    const doc = renderSeite(seite(), kontext());
    expect(doc).toContain('<main id="inhalt" class="w-seite">');
    expect(doc).not.toContain('<nav');
  });
});
