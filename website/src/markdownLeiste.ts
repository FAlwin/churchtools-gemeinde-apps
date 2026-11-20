/**
 * **Die Knöpfe über dem Textfeld** (Fett, Kursiv, Link, Liste, Zwischenüberschrift) – rein: Was passiert mit Text und
 * Auswahl, wenn ein Knopf gedrückt wird. Das Markdown selbst kann `@shared/website/markdown` (`**fett**`, `*kursiv*`,
 * `[Text](Adresse)`, `- ` Listen, `### ` Zwischenüberschrift); hier entstehen nur diese Zeichen für Menschen, die sie nicht
 * auswendig kennen.
 */
export type MarkdownArt = 'fett' | 'kursiv' | 'link' | 'liste' | 'zwischen';

export interface Auswahl {
  text: string;
  von: number;
  bis: number;
}

/** Der Text mit den Zeichen des Knopfs; `von`/`bis` ist danach die Auswahl (das, was man als Nächstes tippt). */
export function markdownAnwenden(a: Auswahl, art: MarkdownArt): Auswahl {
  const { text } = a;
  const von = Math.max(0, Math.min(a.von, text.length));
  const bis = Math.max(von, Math.min(a.bis, text.length));
  const innen = text.slice(von, bis);

  if (art === 'fett' || art === 'kursiv') {
    const z = art === 'fett' ? '**' : '*';
    const wort = innen || 'Text';
    return {
      text: text.slice(0, von) + z + wort + z + text.slice(bis),
      von: von + z.length,
      bis: von + z.length + wort.length,
    };
  }
  if (art === 'link') {
    const wort = innen || 'Text';
    const adresse = 'https://';
    const start = von + 1 + wort.length + 2;
    return {
      text: `${text.slice(0, von)}[${wort}](${adresse})${text.slice(bis)}`,
      von: start,
      bis: start + adresse.length,
    };
  }

  // Liste und Zwischenüberschrift gelten für ganze Zeilen.
  const zeilenAnfang = text.lastIndexOf('\n', von - 1) + 1;
  const ende = text.indexOf('\n', bis);
  const zeilenEnde = ende < 0 ? text.length : ende;
  const zeilen = (text.slice(zeilenAnfang, zeilenEnde) || 'Text').split('\n');
  const neu =
    art === 'liste'
      ? zeilen.map((z) => (z.startsWith('- ') ? z : `- ${z}`)).join('\n')
      : zeilen.map((z, i) => (i === 0 && !z.startsWith('### ') ? `### ${z}` : z)).join('\n');
  return {
    text: text.slice(0, zeilenAnfang) + neu + text.slice(zeilenEnde),
    von: zeilenAnfang,
    bis: zeilenAnfang + neu.length,
  };
}
