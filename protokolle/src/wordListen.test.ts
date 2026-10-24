// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { istWordHtml, wordListenUmbauen } from './wordListen';

/**
 * So legt Word (Office 365, Windows) ein Stück Protokoll in die Zwischenablage – gekürzt, aber typisch (aus dem
 * S0-Durchstich, `messung.ts`). Die Klammern `<![if !supportLists]>` liest der Browser als Kommentare.
 */
const kopf = `<html xmlns:o="urn:schemas-microsoft-com:office:office"><body lang=DE><!--StartFragment-->`;
const fuss = `<!--EndFragment--></body></html>`;
const punkt = (ebene: number, zeichen: string, text: string, liste = 'l0') =>
  `<p class=MsoListParagraphCxSpMiddle style='text-indent:-18.0pt;mso-list:${liste} level${ebene} lfo1'><![if !supportLists]><span style='font-family:Symbol'>${zeichen}<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp; </span></span><![endif]>${text}<o:p></o:p></p>\n`;

/** Die Listen als Gerüst lesen: `ul[Haus anfragen ul[Preis]] …` – ohne Leerraum. */
function geruest(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const lies = (el: Element): string =>
    [...el.children]
      .map((k) => {
        if (k.tagName === 'UL' || k.tagName === 'OL')
          return `${k.tagName.toLowerCase()}[${lies(k)}]`;
        if (k.tagName === 'LI') {
          const text = [...k.childNodes]
            .filter((n) => n.nodeType === 3 || !['UL', 'OL'].includes((n as Element).tagName))
            .map((n) => n.textContent)
            .join('')
            .trim();
          return [text, lies(k)].filter(Boolean).join(' ');
        }
        if (k.tagName === 'P') return `p(${k.textContent?.trim()})`;
        return lies(k);
      })
      .filter(Boolean)
      .join(' | ');
  return lies(doc.body);
}

describe('wordListenUmbauen', () => {
  it('macht aus Word-Aufzählungen verschachtelte Listen ohne das Zeichen davor', () => {
    const html =
      kopf +
      `<p class=MsoNormal><b>Beschluss:</b> Freizeit im Juni.<o:p></o:p></p>\n` +
      punkt(1, '·', 'Haus anfragen (Alwin)') +
      punkt(2, 'o', 'Preis je Person klären') +
      punkt(1, '·', 'Programm vorbereiten') +
      `<p class=MsoNormal>Danach weiter.</p>` +
      fuss;
    expect(geruest(wordListenUmbauen(html))).toBe(
      'p(Beschluss: Freizeit im Juni.) | ul[Haus anfragen (Alwin) ul[Preis je Person klären] | Programm vorbereiten] | p(Danach weiter.)',
    );
    expect(wordListenUmbauen(html)).not.toMatch(/·|supportLists|o:p/);
  });

  it('erkennt Nummerierungen (1. a) iv.) und geht beliebig tief', () => {
    const html =
      kopf +
      punkt(1, '1.', 'Erstens') +
      punkt(2, 'a)', 'Unterpunkt') +
      punkt(3, 'iv.', 'Ganz tief') +
      punkt(4, '§', 'Noch tiefer') +
      punkt(1, '2.', 'Zweitens') +
      fuss;
    expect(geruest(wordListenUmbauen(html))).toBe(
      'ol[Erstens ol[Unterpunkt ol[Ganz tief ul[Noch tiefer]]] | Zweitens]',
    );
  });

  it('zwei Listen mit Text dazwischen bleiben zwei Listen', () => {
    const html =
      kopf + punkt(1, '·', 'A') + `<p class=MsoNormal>Zwischentext</p>` + punkt(1, '·', 'B') + fuss;
    expect(geruest(wordListenUmbauen(html))).toBe('ul[A] | p(Zwischentext) | ul[B]');
  });

  it('auch mit der älteren Markierung `mso-list:Ignore` statt der Klammern', () => {
    const html =
      kopf +
      `<p style='mso-list:l1 level1 lfo2'><span style='mso-list:Ignore'>-&nbsp;&nbsp;</span>Eins</p>` +
      `<p style='mso-list:l1 level2 lfo2'><span style='mso-list:Ignore'>o&nbsp;</span>Zwei</p>` +
      fuss;
    expect(geruest(wordListenUmbauen(html))).toBe('ul[Eins ul[Zwei]]');
  });

  it('Formatierung im Listenpunkt bleibt erhalten', () => {
    const html = kopf + punkt(1, '·', '<b>fett</b> und <i>kursiv</i>') + fuss;
    expect(wordListenUmbauen(html)).toMatch(/<li><b>fett<\/b> und <i>kursiv<\/i><\/li>/);
  });

  it('erkennt Word-HTML – anderes geht am Umbau vorbei (Einfügen wie BlockNote es kennt)', () => {
    expect(istWordHtml('<ul><li>schon eine Liste</li></ul><p>mso ist hier nur Text</p>')).toBe(
      false,
    );
    expect(istWordHtml(kopf + fuss)).toBe(true);
    expect(istWordHtml("<p style='mso-list:l0 level1 lfo1'>x</p>")).toBe(true);
  });
});
