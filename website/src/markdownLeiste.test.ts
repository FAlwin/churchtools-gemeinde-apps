import { describe, expect, it } from 'vitest';
import { markdownZuHtml } from '@shared/website/markdown';
import { markdownAnwenden } from './markdownLeiste';

const a = (text: string, von: number, bis = von) => ({ text, von, bis });

describe('Knöpfe über dem Textfeld', () => {
  it('Fett und Kursiv: umschließen die Auswahl; ohne Auswahl steht „Text“ da, markiert zum Überschreiben', () => {
    expect(markdownAnwenden(a('Ein Wort', 4, 8), 'fett')).toEqual({
      text: 'Ein **Wort**',
      von: 6,
      bis: 10,
    });
    expect(markdownAnwenden(a('Ein Wort', 4, 8), 'kursiv')).toEqual({
      text: 'Ein *Wort*',
      von: 5,
      bis: 9,
    });
    expect(markdownAnwenden(a('', 0), 'fett')).toEqual({ text: '**Text**', von: 2, bis: 6 });
  });

  it('Link: Text in Klammern, die Adresse ist markiert', () => {
    const r = markdownAnwenden(a('Siehe hier', 6, 10), 'link');
    expect(r.text).toBe('Siehe [hier](https://)');
    expect(r.text.slice(r.von, r.bis)).toBe('https://');
  });

  it('Liste: jede Zeile der Auswahl bekommt „- “ – bereits Gelistetes nicht doppelt', () => {
    expect(markdownAnwenden(a('eins\nzwei\ndrei', 5, 6), 'liste').text).toBe('eins\n- zwei\ndrei');
    expect(markdownAnwenden(a('eins\nzwei\ndrei', 0, 13), 'liste').text).toBe(
      '- eins\n- zwei\n- drei',
    );
    expect(markdownAnwenden(a('- eins', 2), 'liste').text).toBe('- eins');
  });

  it('Zwischenüberschrift: „### “ vor der Zeile – nur einmal', () => {
    expect(markdownAnwenden(a('Titel\nText', 2), 'zwischen').text).toBe('### Titel\nText');
    expect(markdownAnwenden(a('### Titel', 4), 'zwischen').text).toBe('### Titel');
  });

  it('eine Auswahl außerhalb des Textes wird auf den Text begrenzt', () => {
    expect(markdownAnwenden(a('ab', 50, 99), 'fett').text).toBe('ab**Text**');
  });

  it('was die Knöpfe erzeugen, versteht das Markdown der Website (Gegenprobe gegen den Leser, nicht gegen Literale)', () => {
    const html = (t: string) => markdownZuHtml(t);
    expect(html(markdownAnwenden(a('Wort', 0, 4), 'fett').text)).toContain('<strong>Wort</strong>');
    expect(html(markdownAnwenden(a('Wort', 0, 4), 'kursiv').text)).toContain('<em>Wort</em>');
    expect(html(markdownAnwenden(a('Wort', 0, 4), 'liste').text)).toContain('<li>');
    expect(html(markdownAnwenden(a('Wort', 0, 4), 'zwischen').text)).toMatch(/<h3/);
    const link = markdownAnwenden(a('Wort', 0, 4), 'link').text.replace(
      'https://',
      'https://beispiel.de',
    );
    expect(html(link)).toContain('href="https://beispiel.de"');
  });
});
