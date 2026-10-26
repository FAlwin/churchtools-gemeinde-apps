import { describe, expect, it } from 'vitest';
import { globaleRegeln, istGlobal, selektorTeile } from './globaleCss.mjs';

describe('Pack-Prüfung: globale Stilregeln (S4-1, 24.10.2026)', () => {
  it('teilt nur an Kommas der obersten Ebene', () => {
    expect(selektorTeile(':is(h1, h2) .x, body')).toEqual([':is(h1, h2) .x', 'body']);
    expect(selektorTeile('[data-a="1,2"] .y')).toEqual(['[data-a="1,2"] .y']);
  });

  it('meldet, was die ganze Seite trifft', () => {
    for (const t of ['body', 'html', ':root', '*', 'button', 'h1', ':focus-visible', '[data-x]'])
      expect(istGlobal(t), t).toBe(true);
  });

  it('lässt durch: App-Bereich, Dunkel-Schema im Bereich, Klassen und IDs (auch von Mantine)', () => {
    for (const t of [
      ':where(#root, [data-gemeinde-app]) button',
      ':where([data-gemeinde-app]) p',
      "html[data-theme='dark'] :where(#root, [data-gemeinde-app])",
      '.bn-root.bn-root',
      ':where([data-mantine-color-scheme=dark]) .m_c44ba933:hover',
      ':is(h1, h2) .m_x',
    ])
      expect(istGlobal(t), t).toBe(false);
  });

  it('prüft das ganze CSS, ohne Keyframes und @-Regeln', () => {
    const css =
      '@keyframes k{0%{opacity:0}to{opacity:1}}@media (max-width:5px){body{margin:0}}' +
      '.a,h1{color:red}:where(#root) *{margin:0}:is(h1,h2) .z{x:1}';
    expect(globaleRegeln(css)).toEqual(['body', 'h1']);
  });
});
