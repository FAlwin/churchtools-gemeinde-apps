/**
 * **Unsere globalen Stilregeln bleiben in der ChurchTools-Extension in der App** (gemeldet von Alwin,
 * 07.10.2026: in der Erweiterung sahen die ChurchTools-Menüs anders aus).
 *
 * Die App war für eine Seite gebaut, die ihr allein gehört: `main.scss` setzt `*` auf Abstand 0, gibt
 * `html`/`body` Schrift, Farbe und `overflow: hidden`, und `:root` trägt die Farb-Variablen. Als
 * Extension teilt sie sich das Dokument mit ChurchTools – gemessen in der Test-Instanz: Schrift aller
 * ChurchTools-Elemente Lato → unsere, Menü-Link-Polster 8 → 0 px, `--shadow` von ChurchTools
 * überschrieben. Dass es so durchschlägt, liegt an Tailwind 4: ChurchTools legt seine Regeln in
 * Kaskaden-Ebenen (`@layer`), und Regeln **ohne** Ebene – unsere – gewinnen dort immer, egal wie
 * allgemein sie sind.
 *
 * Deshalb schreibt der **Extension-Build** (nur er – die PWA bleibt Byte für Byte gleich) jede
 * globale Regel auf den App-Bereich um: `#root` und Elemente mit `data-musikapp` (das
 * Einführungs-Overlay hängt an `body`, außerhalb von `#root`). Modul-Klassen sind ohnehin eindeutig
 * und bleiben, wie sie sind.
 */

/** Der Bereich der App im ChurchTools-Dokument. */
export const BEREICH = ':is(#root, [data-musikapp])';

/**
 * Ein Selektor, auf den App-Bereich umgeschrieben.
 *
 * - `:root`, `html`, `body` → der Bereich selbst (Variablen, Schrift, Farbe gelten dort),
 * - `html[data-theme='dark']` → `html[data-theme='dark'] <Bereich>` (das Dunkel-Schema),
 * - enthält der Selektor eine Klasse oder ID → unverändert (CSS-Module, `#root`, `.ct-extension`),
 * - sonst (`*`, `button`, `:focus-visible` …) → `<Bereich> <Selektor>`.
 */
export function imBereich(selektor: string): string {
  const s = selektor.trim();
  if (s === ':root' || s === 'html' || s === 'body') return BEREICH;
  const schema = /^html(\[[^\]]+\])$/.exec(s);
  if (schema) return `html${schema[1]} ${BEREICH}`;
  if (/[.#]/.test(s)) return s;
  return `${BEREICH} ${s}`;
}

/** Kommt der Selektor aus `html`/`body`? Deren Höhe gibt in der Extension ChurchTools vor. */
function vonDerSeite(selektor: string): boolean {
  return /^(html|body)$/.test(selektor.trim());
}

/** Die nötigsten Teile des PostCSS-Baums – ohne PostCSS als eigene Abhängigkeit. */
interface Knoten {
  type: string;
  name?: string;
  parent?: Knoten;
}
interface Regel extends Knoten {
  selectors: string[];
  walkDecls(cb: (d: { prop: string; remove(): void }) => void): void;
}
interface Wurzel {
  walkRules(cb: (r: Regel) => void): void;
}

function inKeyframes(r: Knoten): boolean {
  for (let p = r.parent; p; p = p.parent) {
    if (p.type === 'atrule' && /keyframes$/.test(p.name ?? '')) return true;
  }
  return false;
}

/**
 * Das PostCSS-Plugin für den Extension-Build. Die Höhe aus `html`/`body` fällt dabei weg: ChurchTools
 * gibt dem Bereich seine Höhe selbst (gemessen: `#page` 1268 px, auch ohne unsere Regeln), und eine
 * Höhe der ganzen Seite auf dem Einführungs-Overlay wäre falsch.
 */
export function cssBereich() {
  return {
    postcssPlugin: 'musikapp-css-bereich',
    Once(wurzel: Wurzel) {
      wurzel.walkRules((regel) => {
        if (inKeyframes(regel)) return;
        const seite = regel.selectors.some(vonDerSeite);
        regel.selectors = [...new Set(regel.selectors.map(imBereich))];
        if (seite) {
          regel.walkDecls((d) => {
            if (d.prop === 'height') d.remove();
          });
        }
      });
    },
  };
}
