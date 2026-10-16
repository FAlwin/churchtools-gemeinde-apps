import { describe, expect, it } from 'vitest';
import {
  alteAssets,
  assetsAus,
  curlKonfig,
  fremdeDateien,
  ordnerPfad,
} from './formular-hochladen.mjs';

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
