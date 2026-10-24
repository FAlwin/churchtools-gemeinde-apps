/**
 * **Trifft eine Stilregel ganz ChurchTools?** – die Prüfung, mit der `paket-erweiterung.mjs` das Packen abbricht
 * (07.10.2026). Herausgelöst mit S4-1 der Protokolle (24.10.2026), damit sie getestet werden kann: Mit BlockNote/Mantine
 * meldete sie ~260 Regeln wie `:where([data-mantine-color-scheme=dark]) .m_c44ba933:hover` als „global“ (S0-Durchstich),
 * und `:is(h1, h2)` zerfiel am Komma in zwei Hälften.
 *
 * Die Regel ist dieselbe wie in `ui/erweiterung/cssBereich.ts` (`imBereich`): **Ein Selektor mit Klasse oder ID trifft nur
 * Elemente mit dieser Klasse** und bleibt dort unverändert – also ist er auch hier in Ordnung. Ändert sich die Regel
 * dort, muss sie hier mit (TypeScript lässt sich aus diesem Skript nicht direkt laden).
 */

/** Einen Selektor an den Kommas der obersten Ebene teilen – nicht innerhalb von `:is(…)`, `:where(…)` oder `[…]`. */
export function selektorTeile(selektor) {
  const teile = [];
  let tiefe = 0;
  let anfang = 0;
  for (let i = 0; i < selektor.length; i++) {
    const c = selektor[i];
    if (c === '(' || c === '[') tiefe++;
    else if (c === ')' || c === ']') tiefe--;
    else if (c === ',' && tiefe === 0) {
      teile.push(selektor.slice(anfang, i).trim());
      anfang = i + 1;
    }
  }
  teile.push(selektor.slice(anfang).trim());
  return teile.filter(Boolean);
}

/** Ist dieser eine Selektor (ohne Komma) einer, der die ganze Seite trifft? */
export function istGlobal(t) {
  if (t.startsWith('html[data-theme') && t.includes(':where(#root')) return false;
  // Der App-Bereich (`:where(#root…`) und unsere Elemente außerhalb davon (`:where([data-gemeinde-app])`, die Schrift
  // des Einführungs-Overlays) treffen ChurchTools nicht. `BEREICH_ATTRIBUT` aus cssBereich.ts – ändert es sich dort,
  // bricht das Packen hier laut ab.
  if (t.startsWith(':where(#root') || t.startsWith(':where([data-gemeinde-app])')) return false;
  // Wie `imBereich`: mit Klasse oder ID → nur Elemente mit dieser Klasse.
  if (/[.#]/.test(t)) return false;
  return /^(:root|html|body|\*|:[a-z-]+|\[|[a-z][a-z0-9]*)(\b|$)/.test(t) || t.startsWith('[');
}

/** Alle Selektoren im gebauten CSS, die die ganze Seite treffen würden. */
export function globaleRegeln(css) {
  const ohneKeyframes = css.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
  const funde = [];
  for (const regel of ohneKeyframes.match(/[^{}]+\{/g) ?? []) {
    const selektor = regel.slice(0, -1).trim();
    if (selektor.startsWith('@')) continue;
    for (const t of selektorTeile(selektor)) if (istGlobal(t)) funde.push(t);
  }
  return funde;
}
