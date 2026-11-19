// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { describe, expect, it } from 'vitest';
import {
  BANNER_STANDARDTEXT,
  renderBaustein,
  renderSeite,
  type RenderKontext,
  type Video,
} from './render';
import {
  abschnitt,
  baustein,
  einstellungen,
  kontext,
  menue,
  seite,
  seiteMit,
  YT_ID,
} from './website.testdaten';
import { BAUSTEIN_TYPEN } from './modell';

const DS = { art: 'extern', url: 'https://gemeinde.beispiel.de/datenschutz' } as const;

function video(o: Partial<Video> = {}): Video {
  return { id: 'v1', titel: 'Gottesdienst', datum: '2026-05-03T08:00:00Z', youtubeId: YT_ID, ...o };
}
function mitVideos(
  aktuell?: Video,
  archiv: Video[] = [],
  o: Partial<RenderKontext> = {},
): RenderKontext {
  return kontext({
    einstellungen: einstellungen({ datenschutz: DS }),
    livestream: { aktuell, archiv },
    ...o,
  });
}
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const livestreamSeite = (zeigen: 'stream' | 'archiv' | 'beides' = 'beides') =>
  seiteMit([baustein('livestream', { zeigen, archivAnzahl: 3 })]);

describe('YouTube-Sperre im Livestream-Baustein', () => {
  it('Sperre mit data-youtube, Vorschaubild, Abspiel-Knopf, Datenschutz-Link und „Auf YouTube ansehen“', () => {
    const k = mitVideos(video({ vorschaubild: { id: 'v' } }));
    const d = parse(renderBaustein(baustein('livestream', { zeigen: 'stream' }), k));
    const v = d.querySelector('.w-video') as HTMLElement;
    expect(v.getAttribute('data-youtube')).toBe(YT_ID);
    expect(v.querySelector('img.w-video-bild')).not.toBeNull();
    const sperre = v.querySelector('.w-video-sperre') as HTMLElement;
    expect(sperre.querySelector('button.w-play[data-video-start]')).not.toBeNull();
    expect(sperre.querySelector('.w-video-titel')?.textContent).toBe('Gottesdienst');
    const links = [...sperre.querySelectorAll('small a')].map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Datenschutz', 'https://gemeinde.beispiel.de/datenschutz'],
      ['Auf YouTube ansehen', `https://www.youtube.com/watch?v=${YT_ID}`],
    ]);
    // ohne Skript benutzbar: der Link geht direkt zu YouTube
    expect(sperre.textContent).toContain('Daten an Google');
  });

  it('der Renderer gibt NIE ein iframe aus – auch nicht mit gültiger Kennung, in keinem Baustein, auf keiner Seite', () => {
    const k = mitVideos(video(), [
      video({ id: 'v2', youtubeId: 'abcdefghijk' }),
      video({ id: 'v3', youtubeId: 'ABCDEFG_-12' }),
    ]);
    for (const typ of BAUSTEIN_TYPEN) {
      expect(renderBaustein(baustein(typ), k), typ).not.toMatch(/<iframe/i);
    }
    const alle = renderSeite(seiteMit(BAUSTEIN_TYPEN.map((t) => baustein(t))), k);
    expect(alle).not.toMatch(/<iframe/i);
    expect(alle).not.toContain('youtube-nocookie');
    expect(alle).not.toContain('/embed/');
    expect(renderSeite(livestreamSeite(), k)).not.toMatch(/<iframe/i);
  });

  it('YouTube-Kennung ungültig → keine Sperre, kein data-youtube', () => {
    for (const boese of [
      '',
      'zu-kurz',
      'viel-zu-lang-12345',
      'dQw4w9WgXc!',
      'dQw4w9WgXc ',
      'dQw4w9WgXcQ"',
      'dQw4w9"onclick',
      '<script>alert(1)</script>',
      '../../etc/pw',
      'dQw4w9WgXc\n',
      'dQw4w9WgXcQ?',
    ]) {
      const k = mitVideos(video({ youtubeId: boese, adresse: 'https://video.beispiel.de/v' }));
      const html = renderBaustein(baustein('livestream', { zeigen: 'stream' }), k);
      expect(html, JSON.stringify(boese)).not.toContain('data-youtube');
      expect(html, JSON.stringify(boese)).not.toContain('w-video-sperre');
      expect(html, JSON.stringify(boese)).not.toContain('youtube');
      // stattdessen die gewöhnliche Karte mit Link
      expect(html, JSON.stringify(boese)).toContain('href="https://video.beispiel.de/v"');
      // …und die Seite zeigt weder Banner noch Einwilligungs-Knopf
      const seitenHtml = renderSeite(livestreamSeite('stream'), k);
      expect(seitenHtml, JSON.stringify(boese)).not.toContain('w-banner');
      expect(seitenHtml, JSON.stringify(boese)).not.toContain('data-einwilligung-aendern');
    }
  });

  it('gültige Kennungen: alle erlaubten Zeichen, genau 11', () => {
    for (const id of ['dQw4w9WgXcQ', 'AAAAAAAAAAA', '-_-_-_-_-_-', '01234567890', 'a_b-C_d-E_f']) {
      const html = renderBaustein(
        baustein('livestream', { zeigen: 'stream' }),
        mitVideos(video({ youtubeId: id })),
      );
      expect(html, id).toContain(`data-youtube="${id}"`);
    }
  });

  it('Archiv: jedes Video mit Kennung ist eine Sperre, ohne Kennung eine Link-Karte; Anzahl und Reihenfolge gelten', () => {
    const k = mitVideos(undefined, [
      video({ id: 'a', titel: 'Alt', datum: '2026-04-01T08:00:00Z', youtubeId: 'AAAAAAAAAAA' }),
      video({ id: 'b', titel: 'Neu', datum: '2026-04-20T08:00:00Z', youtubeId: 'BBBBBBBBBBB' }),
      video({
        id: 'c',
        titel: 'Ohne',
        datum: '2026-04-10T08:00:00Z',
        youtubeId: undefined,
        adresse: 'https://v.beispiel.de/c',
      }),
    ]);
    const html = renderBaustein(baustein('livestream', { zeigen: 'archiv', archivAnzahl: 5 }), k);
    expect(html.match(/data-youtube="/g)).toHaveLength(2);
    expect(html.indexOf('Neu')).toBeLessThan(html.indexOf('Ohne'));
    expect(html.indexOf('Ohne')).toBeLessThan(html.indexOf('Alt'));
    expect(html).toContain('<div class="w-videos">');
    const nur1 = renderBaustein(baustein('livestream', { zeigen: 'archiv', archivAnzahl: 1 }), k);
    expect(nur1).toContain('BBBBBBBBBBB');
    expect(nur1).not.toContain('AAAAAAAAAAA');
  });

  it('ohne Datenschutz-Link in den Einstellungen: Sperre ohne Link, nichts bricht', () => {
    const k = kontext({ livestream: { aktuell: video(), archiv: [] } });
    const html = renderBaustein(baustein('livestream', { zeigen: 'stream' }), k);
    expect(html).not.toContain('>Datenschutz<');
    expect(html).toContain('Auf YouTube ansehen');
    // ein toter Seiten-Link als Datenschutz → ebenfalls kein Link
    const tot = kontext({
      einstellungen: einstellungen({ datenschutz: { art: 'seite', seiteId: 'weg' } }),
      livestream: { aktuell: video(), archiv: [] },
    });
    expect(renderBaustein(baustein('livestream', { zeigen: 'stream' }), tot)).not.toContain(
      '>Datenschutz<',
    );
  });
});

describe('Banner nur mit YouTube', () => {
  it('Seite mit YouTube-Sperre: Banner, Fußzeilen-Knopf und Skript', () => {
    const doc = parse(renderSeite(livestreamSeite(), mitVideos(video())));
    const banner = doc.querySelector('.w-banner') as HTMLElement;
    expect(banner.hasAttribute('hidden')).toBe(true);
    expect(banner.getAttribute('role')).toBe('dialog');
    expect(banner.querySelector('#w-banner-titel')?.textContent).toBe('YouTube-Videos anzeigen?');
    expect(banner.querySelector('p')?.textContent).toContain(BANNER_STANDARDTEXT);
    expect(banner.querySelector('p a')?.getAttribute('href')).toBe(
      'https://gemeinde.beispiel.de/datenschutz',
    );
    expect(banner.querySelector('[data-einwilligung="ja"]')?.textContent).toBe('YouTube erlauben');
    expect(banner.querySelector('[data-einwilligung="nein"]')?.textContent).toBe('Nur notwendige');
    expect(doc.querySelector('.w-fuss [data-einwilligung-aendern]')?.textContent).toBe(
      'Einwilligung für YouTube ändern',
    );
    expect(doc.querySelectorAll('script[src="/website.js"][defer]')).toHaveLength(1);
  });

  it('Seite ohne YouTube: kein Banner, kein Knopf – aber das Skript (Handy-Menü) ist da', () => {
    const seiten = [
      seite(),
      seiteMit([baustein('text'), baustein('livestream')]), // Livestream-Baustein, aber keine Videodaten
    ];
    for (const s of seiten) {
      const html = renderSeite(s, kontext({ einstellungen: einstellungen({ datenschutz: DS }) }));
      expect(html).not.toContain('w-banner');
      expect(html).not.toContain('data-einwilligung');
      expect(html).toContain('<script src="/website.js" defer></script>');
    }
  });

  it('Videos vorhanden, aber nicht auf DIESER Seite angezeigt: kein Banner', () => {
    // Baustein zeigt nur das Archiv mit 0 Einträgen; der aktuelle Stream wird nicht gezeigt
    const s = seiteMit([baustein('livestream', { zeigen: 'archiv', archivAnzahl: 0 })]);
    expect(renderSeite(s, mitVideos(video()))).not.toContain('w-banner');
    // nur „stream“, aber die Kennung hängt am Archivvideo
    const s2 = seiteMit([baustein('livestream', { zeigen: 'stream' })]);
    expect(renderSeite(s2, mitVideos(undefined, [video()]))).not.toContain('w-banner');
    // Archiv gewählt, Kennung am aktuellen Stream
    const s3 = seiteMit([baustein('livestream', { zeigen: 'archiv', archivAnzahl: 3 })]);
    expect(renderSeite(s3, mitVideos(video(), []))).not.toContain('w-banner');
    // gezeigtes Archivvideo mit Kennung → Banner
    expect(renderSeite(s3, mitVideos(undefined, [video()]))).toContain('w-banner');
  });

  it('die anderen Seiten der Gemeinde bekommen keinen Banner, nur die mit Video', () => {
    const k = mitVideos(video());
    expect(renderSeite(livestreamSeite(), k)).toContain('w-banner');
    expect(renderSeite(seite({ abschnitte: [abschnitt([baustein('text')])] }), k)).not.toContain(
      'w-banner',
    );
  });

  it('eigener Bannertext aus den Einstellungen (geschützt ausgegeben), sonst der Standardtext', () => {
    const k = mitVideos(video(), [], {
      einstellungen: einstellungen({
        datenschutz: DS,
        einwilligung: { youtubeText: 'Unser <b>Text</b> & "mehr"' },
      }),
    });
    const html = renderSeite(livestreamSeite(), k);
    expect(html).toContain('Unser &lt;b&gt;Text&lt;/b&gt; &amp; "mehr"');
    expect(html).not.toContain('<b>Text</b>');
    expect(html).not.toContain(BANNER_STANDARDTEXT);
  });

  it('Banner ohne Datenschutz-Link in den Einstellungen: ohne Link', () => {
    const k = kontext({ livestream: { aktuell: video(), archiv: [] } });
    const html = renderSeite(livestreamSeite('stream'), k);
    expect(html).toContain('w-banner');
    expect(html).not.toContain('Mehr dazu im Datenschutz');
  });
});

describe('Skript und Menü', () => {
  it('das Skript steht auf JEDER Seite, genau einmal, mit der Adresse des Kontexts', () => {
    const k = kontext({ skriptAdresse: '/js/seite.js' });
    for (const s of [seite(), livestreamSeite()]) {
      const html = renderSeite(s, k);
      expect(html.match(/<script\b/g)).toHaveLength(1);
      expect(html).toContain('<script src="/js/seite.js" defer></script>');
    }
  });

  it('Handy-Menü: Knopf mit aria-expanded/aria-controls, Navigation mit id="w-nav" – nur mit Menüpunkten', () => {
    const k = kontext({
      menue: menue([{ titel: 'Start', ziel: { art: 'seite', seiteId: 'seite-start' } }]),
    });
    const d = parse(renderSeite(seite(), k));
    const knopf = d.querySelector('header .w-kopf-innen > button.w-menue-knopf') as HTMLElement;
    expect(knopf.getAttribute('aria-expanded')).toBe('false');
    expect(knopf.getAttribute('aria-controls')).toBe('w-nav');
    expect(knopf.getAttribute('type')).toBe('button');
    expect(d.querySelector('nav#w-nav.w-nav')?.getAttribute('aria-label')).toBe('Hauptmenü');
    // das Menü ist ohne Skript sichtbar: nichts ist `hidden`
    expect(d.querySelector('nav#w-nav')?.hasAttribute('hidden')).toBe(false);
    const ohne = parse(renderSeite(seite(), kontext()));
    expect(ohne.querySelector('.w-menue-knopf')).toBeNull();
    expect(ohne.querySelector('#w-nav')).toBeNull();
  });
});
