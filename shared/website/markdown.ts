/**
 * **Schlankes Markdown → HTML** (W1, Entscheidung 19.11.2026). Kann nur, was die Gemeinde zum Schreiben
 * braucht: Absätze (Leerzeile), Zeilenumbruch, `**fett**`, `*kursiv*`, `[Text](Adresse)`, Listen (`- ` und `1. `)
 * und die Zwischenüberschrift `### `.
 *
 * **Kein rohes HTML, niemals:** Der Text wird zuerst geschützt (`htmlText`), erst danach kommen unsere eigenen
 * Tags dazu. Links gehen nur durch, wenn die Adresse erlaubt ist (`istErlaubteAdresse` wie beim Link-Schema, dazu
 * Adressen der eigenen Website mit `/`); alles andere erscheint als reiner Text.
 */
import { htmlAttr, htmlText } from './html';
import { hatLeerOderSteuerzeichen, istErlaubteAdresse } from './modell';

/** Eine Adresse der eigenen Website: `/` + Pfad, kein `//host` (das wäre fremd) und kein Backslash-Trick. */
function istRelativ(adresse: string): boolean {
  return /^\/(?![/\\])[^\\]*$/.test(adresse) && !hatLeerOderSteuerzeichen(adresse);
}

/** Fett und kursiv in einem schon geschützten Text. */
function betonung(geschuetzt: string): string {
  return geschuetzt
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?=\S)(.+?)(?<=\S)\*/g, '<em>$1</em>');
}

const LINK = /\[([^\]\n]*)\]\(([^)\s]*)\)/g;

/** Eine Zeile mit Links, Fett und Kursiv. */
function inline(zeile: string): string {
  let aus = '';
  let ab = 0;
  for (const treffer of zeile.matchAll(LINK)) {
    const [ganz, text, adresse] = treffer;
    const start = treffer.index;
    aus += betonung(htmlText(zeile.slice(ab, start)));
    ab = start + ganz.length;
    if (istErlaubteAdresse(adresse)) {
      aus += `<a href="${htmlAttr(adresse)}" rel="noopener">${betonung(htmlText(text))}</a>`;
    } else if (istRelativ(adresse)) {
      aus += `<a href="${htmlAttr(adresse)}">${betonung(htmlText(text))}</a>`;
    } else {
      aus += htmlText(ganz); // ungültiger Link: nur Text, nie ein href
    }
  }
  return aus + betonung(htmlText(zeile.slice(ab)));
}

type Block = { art: 'p' | 'ul' | 'ol'; zeilen: string[] };

/** Markdown-Text als HTML (nur die oben genannten Möglichkeiten, alles andere ist Text). */
export function markdownZuHtml(text: string): string {
  const aus: string[] = [];
  let offen = null as Block | null;

  const schliessen = () => {
    if (!offen) return;
    if (offen.art === 'p') {
      aus.push(`<p>${offen.zeilen.map(inline).join('<br>')}</p>`);
    } else {
      aus.push(
        `<${offen.art}>${offen.zeilen.map((z) => `<li>${inline(z)}</li>`).join('')}</${offen.art}>`,
      );
    }
    offen = null;
  };

  for (const zeile of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (zeile.trim() === '') {
      schliessen();
      continue;
    }
    const ueberschrift = /^###[ \t]+(.+)$/.exec(zeile);
    if (ueberschrift) {
      schliessen();
      aus.push(`<h3>${inline(ueberschrift[1].trim())}</h3>`);
      continue;
    }
    const punkt = /^-[ \t]+(.*)$/.exec(zeile);
    const nummer = /^\d+\.[ \t]+(.*)$/.exec(zeile);
    const liste = punkt ? 'ul' : nummer ? 'ol' : null;
    if (liste) {
      if (offen?.art !== liste) {
        schliessen();
        offen = { art: liste, zeilen: [] };
      }
      offen.zeilen.push((punkt ?? nummer)![1]);
      continue;
    }
    if (offen?.art !== 'p') {
      schliessen();
      offen = { art: 'p', zeilen: [] };
    }
    offen.zeilen.push(zeile.trim());
  }
  schliessen();
  return aus.join('\n');
}
