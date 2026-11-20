/**
 * **Schlankes Markdown → HTML** (W1, Entscheidung 19.11.2026). Kann nur, was die Gemeinde zum Schreiben
 * braucht: Absätze (Leerzeile), Zeilenumbruch, `**fett**`, `*kursiv*`, `[Text](Adresse)`, Listen (`- ` und `1. `)
 * und die Zwischenüberschrift `### `.
 *
 * **Kein rohes HTML, niemals:** Der Text wird zuerst geschützt (`htmlText`), erst danach kommen unsere eigenen
 * Tags dazu. Links gehen nur durch, wenn die Adresse erlaubt ist (`istErlaubteAdresse` wie beim Link-Schema, dazu
 * Adressen der eigenen Website mit `/`); alles andere erscheint als reiner Text.
 *
 * **Escape (W3c-1, 21.11.2026):** Ein Backslash macht das folgende Zeichen zum Zeichen – `\*`, `\_`, `\[`, `\]`, `\(`, `\)`,
 * `\\` und `\#` überall, am Zeilenanfang außerdem `\-` und `1\.` (sonst wären sie Liste). So erscheint getippter Text
 * **exakt** so, wie er getippt wurde (`markdownAusBloecken` ist der Rückweg: Er setzt die Escapes, wo sie nötig sind).
 * Ein Backslash vor jedem anderen Zeichen bleibt, wie er ist – vorhandene Texte rendern unverändert (`markdown.golden.json`).
 * **Das ist die EINE Stelle** für Lesen und Schreiben dieser Regel (Vorschau und spätere Website nutzen sie gemeinsam).
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
    .replace(/\*\*\*(?=\S)(.+?)(?<=\S)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?=\S)(.+?)(?<=\S)\*/g, '<em>$1</em>');
}

const LINK = /\[([^\]\n]*)\]\(([^)\s]*)\)/g;

/** Die Zeichen, die ein Backslash zum Zeichen macht (überall in der Zeile). */
const ESCAPE = /\\([\\*_[\]()#])/g;

/**
 * Ein Zeichen, das im Text nicht vorkommt, als Platzhalter für ein maskiertes Zeichen: Private-Use-Zeichen, das erste freie
 * Stück (so ändert auch ein dort getipptes Zeichen nichts). Vor dem Rest der Zeile ersetzt, danach zurückgetauscht –
 * so enden `\*` und `\]` weder Fett noch Link.
 */
function platzhalterBasis(text: string): number {
  for (let b = 0xe000; b < 0xf8f0; b += 8) {
    let frei = true;
    for (let n = 0; n < 8 && frei; n++) frei = !text.includes(String.fromCharCode(b + n));
    if (frei) return b;
  }
  return 0xe000;
}
const ESCAPE_ZEICHEN = '\\*_[]()#';

/** Eine Zeile mit Links, Fett und Kursiv. */
function inline(roh: string): string {
  const basis = platzhalterBasis(roh);
  const zeile = roh.replace(ESCAPE, (_, z: string) =>
    String.fromCharCode(basis + ESCAPE_ZEICHEN.indexOf(z)),
  );
  const zurueck = (t: string) =>
    t.replace(/[\ue000-\uf8ff]/g, (c) => {
      const n = c.charCodeAt(0) - basis;
      return n >= 0 && n < ESCAPE_ZEICHEN.length ? ESCAPE_ZEICHEN[n] : c;
    });
  let aus = '';
  let ab = 0;
  for (const treffer of zeile.matchAll(LINK)) {
    const [ganz, text, roheAdresse] = treffer;
    const adresse = zurueck(roheAdresse);
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
  aus += betonung(htmlText(zeile.slice(ab)));
  // Erst jetzt zurück: Die maskierten Zeichen waren bis hierher keine Auszeichnung. (Keines davon ist ein HTML-Zeichen.)
  return zurueck(aus);
}

/** Ist das eine Adresse, die ein Link im Text haben darf? (Die Regel von `markdownZuHtml`, auch für den Rahmen.) */
export function istLinkAdresse(adresse: string): boolean {
  return istErlaubteAdresse(adresse) || istRelativ(adresse);
}

/** Am Anfang einer Zeile (Absatz, Listenpunkt, Zwischenüberschrift): `\-` und `1\.` sind Zeichen, keine Liste. */
function zeilenanfang(zeile: string): string {
  return zeile.replace(/^\\(?=-)/, '').replace(/^(\d+)\\\./, '$1.');
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
      aus.push(`<h3>${inline(zeilenanfang(ueberschrift[1].trim()))}</h3>`);
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
      offen.zeilen.push(zeilenanfang((punkt ?? nummer)![1]));
      continue;
    }
    if (offen?.art !== 'p') {
      schliessen();
      offen = { art: 'p', zeilen: [] };
    }
    offen.zeilen.push(zeilenanfang(zeile.trim()));
  }
  schliessen();
  return aus.join('\n');
}

// ── Der Rückweg: Text aus der Bearbeitung in der Vorschau → Markdown (W3c-1) ────────────────────────────────────

/** Ein Stück Text mit gleicher Auszeichnung (`\n` darin = Zeilenumbruch). */
export interface TextLauf {
  t: string;
  fett?: boolean;
  kursiv?: boolean;
  /** Adresse des Links, der dieses Stück umgibt. */
  link?: string;
}

/** Ein Block des getippten Textes: Absatz, Zwischenüberschrift oder EIN Listenpunkt (`ul` = Punkte, `ol` = nummeriert). */
export interface TextBlock {
  art: 'p' | 'h' | 'ul' | 'ol';
  laeufe: TextLauf[];
}

/** Zeichen im Text, die sonst Auszeichnung wären (`*`, `[`, `]`) – und der Backslash selbst. */
const maskiere = (t: string): string => t.replace(/[\\*[\]]/g, '\\$&');
/** In einer Link-Adresse beenden `(` und `)` den Link nicht, wenn sie maskiert sind. */
const maskiereAdresse = (a: string): string => a.replace(/[\\()]/g, '\\$&');

/** Ein Stück mit Fett/Kursiv: Leerzeichen am Rand stehen draußen (`** a**` wäre kein Fett). */
function umhuellt(l: TextLauf): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(l.t)!;
  if (!m[2]) return l.t;
  const z = l.fett && l.kursiv ? '***' : l.fett ? '**' : l.kursiv ? '*' : '';
  return m[1] + z + maskiere(m[2]) + z + m[3];
}

/** Läufe einer Zeile als Markdown; aufeinanderfolgende Stücke mit demselben Link werden EIN Link. */
function zeileZuMarkdown(laeufe: readonly TextLauf[]): string {
  let aus = '';
  for (let n = 0; n < laeufe.length; ) {
    const link = laeufe[n].link;
    let ende = n + 1;
    while (link !== undefined && ende < laeufe.length && laeufe[ende].link === link) ende++;
    const innen = laeufe.slice(n, ende).map(umhuellt).join('');
    aus += link !== undefined && innen.trim() ? `[${innen}](${maskiereAdresse(link)})` : innen;
    n = ende;
  }
  return aus;
}

/** Die Läufe an den Zeilenumbrüchen (`\n`) teilen. */
function zeilen(laeufe: readonly TextLauf[]): TextLauf[][] {
  const aus: TextLauf[][] = [[]];
  for (const l of laeufe) {
    l.t.split('\n').forEach((teil, n) => {
      if (n > 0) aus.push([]);
      if (teil) aus[aus.length - 1].push({ ...l, t: teil });
    });
  }
  return aus;
}

/** Am Zeilenanfang würde das hier Liste oder Überschrift: der Backslash macht es wieder zum Text. */
function anfangMaskieren(z: string): string {
  if (/^-[ \t]/.test(z) || /^###[ \t]/.test(z)) return `\\${z}`;
  return z.replace(/^(\d+)\.(?=[ \t])/, '$1\\.');
}

/**
 * **Getippter Text → Markdown.** Gegenstück zu `markdownZuHtml`: Was hier entsteht, liest der Leser wieder als genau diesen
 * Text – Zeichen, die Auszeichnung wären (`*`, `[`, `]`, `\`), und Zeilenanfänge, die Liste oder Überschrift wären
 * (`- `, `1. `, `### `), bekommen den Backslash. Leere Blöcke entfallen. Verwendet nur, was `markdownZuHtml` kann; Fett und
 * Kursiv zugleich wird `***`. Ob das Ergebnis den Text wirklich erhält, prüft der Aufrufer mit `markdownSichtbarerText`.
 */
export function markdownAusBloecken(bloecke: readonly TextBlock[]): string {
  const stuecke: string[] = [];
  let liste: 'ul' | 'ol' | null = null;
  for (const b of bloecke) {
    if (b.art === 'p') {
      liste = null;
      let absatz: string[] = [];
      const fertig = () => {
        if (absatz.length) stuecke.push(absatz.join('\n'));
        absatz = [];
      };
      for (const z of zeilen(b.laeufe)) {
        const s = zeileZuMarkdown(z).trim();
        if (s) absatz.push(anfangMaskieren(s));
        else fertig(); // eine leere Zeile trennt Absätze
      }
      fertig();
      continue;
    }
    // Überschrift und Listenpunkt haben nur eine Zeile.
    const s = zeileZuMarkdown(
      zeilen(b.laeufe).flatMap((z, n) => (n > 0 ? [{ t: ' ' }, ...z] : z)),
    ).trim();
    if (!s) continue;
    if (b.art === 'h') {
      liste = null;
      stuecke.push(`### ${s}`);
    } else {
      const punkt = `${b.art === 'ul' ? '-' : '1.'} ${s}`;
      if (liste === b.art) stuecke[stuecke.length - 1] += `\n${punkt}`;
      else stuecke.push(punkt);
      liste = b.art;
    }
  }
  return stuecke.join('\n\n');
}

/**
 * Lässt sich diese Formatierung eindeutig als Markdown schreiben? **Nicht**, wenn zwei ausgezeichnete Stücke ohne Leerzeichen
 * aneinanderstoßen (`*a*` direkt vor `**b**` = `*a***b**`): Dort liest `markdownZuHtml` die Sternchen anders, als sie gemeint
 * waren, und der Text stimmte nur noch zufällig. Ein Link dazwischen (`](`…`)`) oder ein Leerzeichen trennt sauber.
 */
export function formatierungEindeutig(bloecke: readonly TextBlock[]): boolean {
  const ausgezeichnet = (l: TextLauf) => l.fett === true || l.kursiv === true;
  for (const b of bloecke) {
    for (const z of zeilen(b.laeufe)) {
      for (let n = 1; n < z.length; n++) {
        const a = z[n - 1];
        const c = z[n];
        if (a.link !== c.link || !ausgezeichnet(a) || !ausgezeichnet(c)) continue;
        if (/\s$/.test(a.t) || /^\s/.test(c.t)) continue;
        return false;
      }
    }
  }
  return true;
}

/**
 * Der Text, den ein Leser von diesem Markdown sieht (ohne Auszeichnung, Entities zurück) – für die Gegenprobe: Ergibt der
 * Rückweg nicht denselben Text wie der getippte, wird nicht gespeichert.
 */
export function markdownSichtbarerText(markdown: string): string {
  return markdownZuHtml(markdown)
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt);/g, (_, e: string) => ({ amp: '&', lt: '<', gt: '>' })[e]!);
}
