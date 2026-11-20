/**
 * **Die Bearbeiten-Ebene für die Vorschau** (Bauplan Website W3a-2): Stil (`ebene.css`) und Skript (`ebene.skript.txt` – reiner
 * Browser-Text für das iframe, darum keine `.js`-Datei: Die Prüfung des Repos (`eslint .`) liest TypeScript, kein Fremdskript),
 * die in das `srcdoc` der Vorschau gehängt werden – **nur dort, nie in den Bau** (`renderSeite` weiß nichts davon).
 *
 * Die Ebene läuft im abgeschotteten iframe (`allow-scripts` ohne `allow-same-origin`, `vorschauHtml.ts`) und meldet nur per
 * `postMessage` (Form: `nachricht.ts`). Die Symbole kommen aus dem gemeinsamen Satz (`ui/icons`) als fertiges SVG – das
 * iframe lädt nichts nach.
 */
import type { ReactElement, ReactNode } from 'react';
import { Icon, type IconName } from '@ui/icons/icons';
import css from './ebene.css?raw';
import skript from './ebene.skript.txt?raw';

const SYMBOLE: Record<string, IconName> = {
  plus: 'plus',
  stift: 'pencil',
  hoch: 'chev-up',
  runter: 'chev-down',
  kopie: 'kopieren',
  muell: 'trash',
};

const maskiere = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** `strokeWidth` → `stroke-width`; `viewBox` bleibt, wie es ist. */
const attributName = (k: string): string =>
  k === 'viewBox' ? k : k.replace(/[A-Z]/g, (z) => `-${z.toLowerCase()}`);

/**
 * Ein Bauteil-Baum aus reinen SVG-Elementen als Text. Genug für die Symbole aus `ui/icons` (`<svg>` mit `<path>`, `<rect>` …) –
 * ohne `react-dom/server`, das für ein halbes Dutzend Symbole die Erweiterung um über hundert Kilobyte größer machte.
 * `style` und `className` fallen weg (das iframe hat seinen eigenen Stil).
 */
export function svgZuText(knoten: ReactNode): string {
  if (knoten === null || knoten === undefined || typeof knoten === 'boolean') return '';
  if (typeof knoten === 'string' || typeof knoten === 'number') return maskiere(String(knoten));
  if (Array.isArray(knoten)) return knoten.map(svgZuText).join('');
  const el = knoten as ReactElement<Record<string, unknown>>;
  if (typeof el.type !== 'string')
    throw new Error('Nur einfache SVG-Elemente lassen sich als Text ausgeben.');
  const { children, style: _s, className: _c, ...rest } = el.props;
  void _s;
  void _c;
  const attribute = Object.entries(rest)
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
    .map(([k, v]) => ` ${attributName(k)}="${maskiere(String(v))}"`)
    .join('');
  return `<${el.type}${attribute}>${svgZuText(children as ReactNode)}</${el.type}>`;
}

/** Die Symbole als SVG-Text (15 px, Linienstärke wie überall). */
export function ebeneSymbole(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(SYMBOLE).map(([name, icon]) => [
      name,
      svgZuText(Icon({ name: icon, size: 15 })),
    ]),
  );
}

/** JSON für einen `<script>`-Block: `<` wird entschärft, damit nichts den Block beenden kann. */
const jsonFuerSkript = (x: unknown): string => JSON.stringify(x).replace(/</g, '\\u003c');

/** So sieht eine Nonce aus (Base64/Base64url); alles andere wird nicht übernommen. */
const NONCE_MUSTER = /^[A-Za-z0-9+/=_-]{8,200}$/;

/** Die Nonce, wenn sie wie eine aussieht – sonst `null`. Sie landet in einem Attribut; das Muster lässt nichts Gefährliches zu. */
export function nonceGueltig(wert: unknown): string | null {
  return typeof wert === 'string' && NONCE_MUSTER.test(wert) ? wert : null;
}

/**
 * Die Nonce der ChurchTools-Seite, soweit es eine gibt. ChurchTools erlaubt Skripte nur mit ihr (`script-src … 'nonce-…'`), und
 * das `iframe` mit `srcdoc` erbt diese Regel – ohne Nonce liefe die Ebene dort nicht (gemessen 20.11.2026). Gelesen wird die
 * **Eigenschaft** `.nonce` (das Attribut ist im DOM leer); sie wechselt bei jedem Laden der Seite. In der Demo (kein CSP) gibt
 * es keine – dann bleibt das Skript ohne Attribut.
 */
export function seitenNonce(doc: Document = document): string | null {
  return nonceGueltig(doc.querySelector<HTMLScriptElement>('script[nonce]')?.nonce);
}

/** Stil und Skript als Text zum Einhängen vor `</body>`. `scroll`: wohin das Neuzeichnen die Seite wieder scrollt. */
export function ebeneHtml(scroll: number, nonce?: string | null): string {
  const config = {
    scroll: Number.isFinite(scroll) ? Math.max(0, Math.round(scroll)) : 0,
    symbole: ebeneSymbole(),
  };
  const n = nonceGueltig(nonce);
  const attr = n ? ` nonce="${maskiere(n)}"` : '';
  return `<style${attr}>${css}</style><script${attr}>(${skript}\n)(${jsonFuerSkript(config)});</script>`;
}

/** Die Seite mit der Ebene – vor dem letzten `</body>`. Ohne `</body>` bleibt die Seite, wie sie ist. */
export function mitEbene(html: string, scroll: number, nonce?: string | null): string {
  const stelle = html.lastIndexOf('</body>');
  if (stelle < 0) return html;
  return html.slice(0, stelle) + ebeneHtml(scroll, nonce) + html.slice(stelle);
}
