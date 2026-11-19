// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { describe, it, expect } from 'vitest';
import { renderSeite } from './render';
import { VORLAGEN } from './vorlagen';
import { seite, kontext, einstellungen, idZaehler, YT_ID } from './website.testdaten';
import { seiteSchema } from './modell';

describe('Angriffe über Theme, eigenes CSS und Vorlagen (unabhängige Gegenprüfung)', () => {
  const neueId = idZaehler();
  const abschnitte = VORLAGEN.map((v) => v.erzeugen(neueId));
  const s = seite({ abschnitte });
  it('alle Vorlagen zusammen ergeben eine gültige Seite', () => {
    expect(seiteSchema.safeParse(s).success).toBe(true);
  });
  for (const css of [
    '</style><script>alert(1)</script>',
    '</STYLE ><img src=x onerror=1>',
    '</style\n><script>1</script>',
    'a{}</sTyLe/><script>1</script>',
  ]) {
    it('eigenes CSS bricht nicht aus: ' + JSON.stringify(css), () => {
      const html = renderSeite(
        s,
        kontext({
          seiten: [s],
          einstellungen: einstellungen({ eigenesCss: css }),
          livestream: {
            archiv: [{ id: 'v', titel: 'V', datum: '2026-07-01T10:00:00Z', youtubeId: YT_ID }],
          },
        }),
      );
      const d = new DOMParser().parseFromString(html, 'text/html');
      expect(d.querySelectorAll('img[onerror]').length).toBe(0);
      // Nur Skripte mit src (unser eigenes) – keins mit Inhalt aus Daten
      for (const sc of d.querySelectorAll('script')) expect(sc.getAttribute('src')).toBeTruthy();
      expect(d.querySelectorAll('style').length).toBe(1);
      expect(d.querySelectorAll('iframe').length).toBe(0);
    });
  }
  it('Schriftname und Farben aus Daten an Schema vorbei bleiben harmlos', () => {
    const e = einstellungen({
      farben: {
        haupt: 'red;}body{display:none',
        akzent: '#fff',
        grund: '#fff',
        sanft: '#fff',
        text: '#000',
      },
      schriften: {
        text: { art: 'eigene', name: "x';}</style><script>1</script>", datei: 'a' },
        ueberschrift: { art: 'auswahl', name: 'Gibtsnicht' },
      } as never,
    });
    const html = renderSeite(s, kontext({ seiten: [s], einstellungen: e }));
    const d = new DOMParser().parseFromString(html, 'text/html');
    const css = d.querySelector('style')!.textContent;
    expect(css).not.toContain('display:none');
    expect(css).not.toContain("x';}");
    expect(d.querySelectorAll('style').length).toBe(1);
  });
});
