import { describe, expect, it } from 'vitest';
import {
  alteAssets,
  assetsAus,
  curlKonfig,
  einbettenListe,
  fremdeDateien,
  htaccessAus,
  instanzenListe,
  istUnsereHtaccess,
  ordnerPfad,
} from './formular-hochladen.mjs';
import { readFileSync } from 'node:fs';

describe('Formular hochladen (15.10.2026)', () => {
  it('liest die Dateien, auf die index.html verweist – so wie Vite sie schreibt', () => {
    const html = `<script type="module" crossorigin src="./assets/index-BYIPTAQF.js"></script>
      <link rel="stylesheet" crossorigin href="./assets/index-DEt_QwO7.css">
      <a href="https://example.org/assets/fremd.js">`;
    expect(assetsAus(html)).toEqual(['index-BYIPTAQF.js', 'index-DEt_QwO7.css']);
    expect(assetsAus('<script src="/assets/a.js?v=1"></script>')).toEqual(['a.js']);
  });

  it('löscht nur, was nicht mehr gebraucht wird – nie die neuen Dateien, nie . und ..', () => {
    expect(alteAssets(['.', '..', 'alt.js', 'neu.js', ''], ['neu.js'])).toEqual(['alt.js']);
    expect(alteAssets(['neu.js'], ['neu.js'])).toEqual([]);
  });

  it('Sperre: im WordPress-Ordner (gemessen am Haupt-FTP-Zugang) wird nichts hochgeladen', () => {
    const wurzel = ['.', '..', 'wp-config.php', 'index.php', '.htaccess', 'wp-content'];
    expect(fremdeDateien(wurzel)).toEqual([
      'wp-config.php',
      'index.php',
      '.htaccess',
      'wp-content',
    ]);
    // Leerer Ordner oder nur unser Paket → frei.
    expect(fremdeDateien(['.', '..', ''])).toEqual([]);
    expect(fremdeDateien(['index.html', 'assets'])).toEqual([]);
  });

  it('die eigene Liste der Instanzen ist kein fremder Inhalt (#843) – sonst bräche das zweite Hochladen ab', () => {
    expect(
      fremdeDateien(['index.html', 'assets', 'instanzen.json', 'instanzen.beispiel.json']),
    ).toEqual([]);
  });

  it('ANMELDUNG_CT_INSTANZEN: kommagetrennt, klein, ohne Doppelte; Adressen statt Namen brechen ab (#843)', () => {
    expect(
      instanzenListe(
        ' ECG-Donrath.church.tools, test-ecg-donrath.church.tools,ecg-donrath.church.tools ',
      ),
    ).toEqual(['ecg-donrath.church.tools', 'test-ecg-donrath.church.tools']);
    expect(() => instanzenListe('https://ecg-donrath.church.tools')).toThrow(/nicht „https:/);
    expect(() => instanzenListe('ecg-donrath.church.tools/')).toThrow();
    expect(() => instanzenListe(' , ')).toThrow(/Rechnernamen/);
    expect(() => instanzenListe(undefined)).toThrow();
  });

  it('Zugangsdaten mit Anführungszeichen und Backslash bleiben eine gültige curl-Zeile', () => {
    expect(curlKonfig('ecg_1', 'a"b\\c')).toBe('user = "ecg_1:a\\"b\\\\c"\n');
  });

  it('Ordner im FTP-Zugang: Wurzel oder Unterordner, mit Schrägstrichen', () => {
    expect(ordnerPfad(undefined)).toBe('/');
    expect(ordnerPfad('')).toBe('/');
    expect(ordnerPfad('anmeldung')).toBe('/anmeldung/');
    expect(ordnerPfad('/a/b/')).toBe('/a/b/');
  });
});

describe('Sicherheits-Header des Formulars (#849)', () => {
  const csp = (text) => /Content-Security-Policy "([^"]+)"/.exec(text)[1];
  const teil = (text, name) =>
    csp(text)
      .split('; ')
      .find((t) => t.startsWith(`${name} `));

  it('Daten und Bilder nur von den Instanzen aus instanzen.json – sonst nur die eigene Seite', () => {
    const t = htaccessAus(['a.church.tools', 'test-a.church.tools']);
    expect(teil(t, 'connect-src')).toBe(
      "connect-src 'self' https://a.church.tools https://test-a.church.tools",
    );
    expect(teil(t, 'img-src')).toBe(
      "img-src 'self' data: blob: https://a.church.tools https://test-a.church.tools",
    );
    expect(teil(t, 'script-src')).toBe("script-src 'self'");
    // Schriften kommen als eigene Dateien (ui/design/schrift.ts) – kein `data:` nötig.
    expect(teil(t, 'font-src')).toBe("font-src 'self'");
    expect(teil(t, 'default-src')).toBe("default-src 'self'");
    expect(csp(t)).not.toContain('unsafe-eval');
  });

  it('einbetten: ohne Angabe nur die eigene Seite, sonst die genannten', () => {
    expect(teil(htaccessAus(['a.church.tools']), 'frame-ancestors')).toBe("frame-ancestors 'self'");
    expect(
      teil(htaccessAus(['a.church.tools'], ['https://a.de', 'https://*.a.de']), 'frame-ancestors'),
    ).toBe("frame-ancestors 'self' https://a.de https://*.a.de");
  });

  it('nur wirksam mit mod_headers – ohne bleibt die Seite erreichbar statt Fehler 500', () => {
    const t = htaccessAus(['a.church.tools']);
    expect(t).toMatch(/^<IfModule mod_headers\.c>$/m);
    expect(t).toMatch(/^<\/IfModule>$/m);
  });

  it('ANMELDUNG_EINBETTEN: nur https-Adressen ohne Pfad, Platzhalter nur vorn', () => {
    expect(einbettenListe(undefined)).toEqual([]);
    expect(einbettenListe(' https://A.de , https://*.a.de,https://a.de')).toEqual([
      'https://a.de',
      'https://*.a.de',
    ]);
    expect(() => einbettenListe('http://a.de')).toThrow(/ANMELDUNG_EINBETTEN/);
    expect(() => einbettenListe('https://a.de/pfad')).toThrow();
    expect(() => einbettenListe('a.de')).toThrow();
    expect(() => einbettenListe('https://a.*.de')).toThrow();
  });

  it('die Vorlage im Paket ist genau das, was der Erzeuger schreibt', () => {
    const vorlage = readFileSync(
      new URL('../formular/public/htaccess.beispiel', import.meta.url),
      'utf8',
    );
    expect(vorlage).toBe(
      htaccessAus(['deine-gemeinde.church.tools', 'test-deine-gemeinde.church.tools']),
    );
  });

  it('die Vorlage zählt zum Paket; eine .htaccess nur, wenn sie unsere ist', () => {
    expect(fremdeDateien(['htaccess.beispiel', 'index.html'])).toEqual([]);
    expect(fremdeDateien(['.htaccess', 'index.html'])).toEqual(['.htaccess']);
    expect(fremdeDateien(['.htaccess', 'index.html'], { htaccessUnsere: true })).toEqual([]);
  });

  it('erkennt die eigene .htaccess am Kopf – die von WordPress ist fremd', () => {
    expect(istUnsereHtaccess(htaccessAus(['a.church.tools']))).toBe(true);
    expect(istUnsereHtaccess('# BEGIN WordPress\n<IfModule mod_rewrite.c>\n')).toBe(false);
    expect(istUnsereHtaccess(null)).toBe(false);
  });
});
