/**
 * **Drucken und als PDF speichern** (O7b-4, Messung `messung-o7b-4-2026-10-28.md`): ChurchTools hat keine einzige
 * Druckregel – `window.print()` der Seite druckte die blaue Leiste, die Reiter und unsere Werkzeugleiste mit, und
 * Stile, die die ganze Seite treffen, lehnt die Paket-Prüfung ab. Deshalb ein **eigenes Druck-Dokument in einem
 * unsichtbaren Rahmen**: nur das Organigramm, die Stilvorlagen der Erweiterung (ohne `data-theme` → immer hell) und
 * Lato.
 *
 * Lato liefert ChurchTools nur für den Bildschirm (`@media screen` in `base-….css`), mit Dateinamen, die sich mit jeder
 * Version ändern. Die Regeln werden deshalb **zur Laufzeit** übernommen: Pfade absolut, ohne `screen`.
 */

import { BEREICH_ATTRIBUT } from '@ui/erweiterung/cssBereich';

export interface Papier {
  id: 'a4-quer' | 'a4-hoch' | 'a3-quer';
  label: string;
  /** Für `@page { size }`. */
  groesse: string;
  /** Blatt in Millimetern. */
  breite: number;
  hoehe: number;
}

export const PAPIERE: readonly Papier[] = [
  { id: 'a4-quer', label: 'A4 quer', groesse: 'A4 landscape', breite: 297, hoehe: 210 },
  { id: 'a4-hoch', label: 'A4 hoch', groesse: 'A4 portrait', breite: 210, hoehe: 297 },
  { id: 'a3-quer', label: 'A3 quer', groesse: 'A3 landscape', breite: 420, hoehe: 297 },
];

/** Seitenrand und Platz für die Kopfzeile auf dem Blatt (mm). */
export const RAND_MM = 12;
export const KOPF_MM = 14;

/** Das Nötigste einer Stilvorlage – so lassen sich die Regeln auch ohne Browser prüfen. */
export interface Regel {
  cssText: string;
  cssRules?: ArrayLike<Regel>;
}
export interface Blatt {
  href: string | null;
  cssRules: ArrayLike<Regel>;
}

const absolut = (text: string, basis: string) =>
  text.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (_, q: string, u: string) =>
    /^(data:|https?:|blob:)/.test(u) ? `url(${q}${u}${q})` : `url("${new URL(u, basis).href}")`,
  );

/**
 * Die `@font-face`-Regeln einer Schrift aus allen Stilvorlagen – auch aus `@layer` und `@media` heraus (die
 * Einschränkung fällt weg), mit absoluten Pfaden. Fremde Stilvorlagen, die man nicht lesen darf, werden übersprungen.
 */
export function schriftRegeln(
  blaetter: Iterable<Blatt>,
  seite: string,
  familie = 'Lato',
): string[] {
  const muster = new RegExp(`font-family:\\s*["']?${familie}["']?\\s*;`, 'i');
  const out: string[] = [];
  const lauf = (regeln: ArrayLike<Regel>, basis: string) => {
    for (const r of Array.from(regeln)) {
      if (r.cssText.startsWith('@font-face') && muster.test(r.cssText))
        out.push(absolut(r.cssText, basis));
      else if (r.cssRules) lauf(r.cssRules, basis);
    }
  };
  for (const b of blaetter) {
    let regeln: ArrayLike<Regel>;
    try {
      regeln = b.cssRules;
    } catch {
      continue; // fremde Herkunft – nicht lesbar
    }
    lauf(regeln, b.href ?? seite);
  }
  return out;
}

/**
 * Die Stilvorlagen DIESER Erweiterung als HTML (die Klassen der Diagramme, die Farben) – im Betrieb ein `<link>` unter
 * dem eigenen Pfad, beim Entwickeln die `<style>`-Blöcke von Vite. Die von ChurchTools bleiben draußen.
 */
export function eigeneStile(doc: Document, basis: string): string {
  const teile: string[] = [];
  for (const el of Array.from(doc.querySelectorAll('link[rel="stylesheet"], style'))) {
    if (el instanceof HTMLLinkElement && el.href.startsWith(basis))
      teile.push(`<link rel="stylesheet" href="${el.href}">`);
    else if (el instanceof HTMLStyleElement && el.hasAttribute('data-vite-dev-id'))
      teile.push(`<style>${el.textContent ?? ''}</style>`);
  }
  return teile.join('\n');
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * Das ganze Druck-Dokument. Ein Diagramm füllt die Seite unter der Kopfzeile und behält sein Seitenverhältnis (das SVG
 * passt sich ein); eine Liste läuft über mehrere Seiten. Der Inhalt steht in einem Element mit `BEREICH_ATTRIBUT`: Nur
 * dort gelten die Farben und die Schrift der Erweiterung (`cssBereich.ts` – sie sollen ChurchTools nicht treffen). Ohne
 * das waren im Demo alle Kästchen schwarz und die Namen unsichtbar (28.10.2026).
 */
export function druckHtml(o: {
  titel: string;
  inhalt: string;
  papier: Papier;
  schrift: readonly string[];
  stile: string;
}): string {
  const hoehe = o.papier.hoehe - 2 * RAND_MM - KOPF_MM;
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>${esc(o.titel)}</title>
${o.stile}
<style>
${o.schrift.join('\n')}
@page { size: ${o.papier.groesse}; margin: ${RAND_MM}mm; }
html, body { margin: 0; background: #fff; }
body { font-family: Lato, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
svg { display: block; width: 100% !important; height: ${hoehe}mm !important; }
</style></head>
<body><div ${BEREICH_ATTRIBUT}="">${o.inhalt}</div></body></html>`;
}

/**
 * Drucken: Druck-Dokument in einen unsichtbaren Rahmen schreiben, auf Lato warten (höchstens 3 s – ohne Lato wird
 * trotzdem gedruckt) und den Druckdialog des Browsers öffnen. Dort „Als PDF sichern“ wählen. Der Rahmen verschwindet
 * nach dem Drucken – oder spätestens nach einer Minute (Safari meldet das Ende nicht immer).
 */
export async function drucken(
  html: string,
  doc: Document = document,
  // Fokus in den Rahmen – sonst druckt manch ein Browser die Seite statt des Rahmens.
  oeffnen: (w: Window) => void = (w) => {
    w.focus();
    w.print();
  },
): Promise<void> {
  const rahmen = doc.createElement('iframe');
  rahmen.setAttribute('aria-hidden', 'true');
  rahmen.tabIndex = -1;
  rahmen.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  doc.body.appendChild(rahmen);
  const d = rahmen.contentDocument;
  const w = rahmen.contentWindow;
  if (!d || !w) {
    rahmen.remove();
    throw new Error('Druck-Dokument ließ sich nicht anlegen');
  }
  d.open();
  d.write(html);
  d.close();
  const schriftFertig =
    'fonts' in d ? d.fonts.load('700 14px Lato').then(() => d.fonts.ready) : null;
  await Promise.race([schriftFertig, new Promise((r) => setTimeout(r, 3000))]);
  let weg = false;
  const entfernen = () => {
    if (weg) return;
    weg = true;
    rahmen.remove();
  };
  w.addEventListener('afterprint', entfernen, { once: true });
  setTimeout(entfernen, 60_000);
  oeffnen(w);
}
