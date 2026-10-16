/**
 * Hat die Seite die Font-Awesome-Schrift von ChurchTools? Jede `@font-face` steht in `document.fonts`; `.fas` nutzt
 * „Font Awesome Pro“ (gemessen 16.10.: daneben gibt es auch „Font Awesome 7 Brands“ – die allein reicht nicht).
 */
export function hatChurchToolsSymbole(): boolean {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts || typeof fonts.forEach !== 'function') return false;
  let da = false;
  fonts.forEach((f) => {
    if (f.family.replace(/["']/g, '') === 'Font Awesome Pro') da = true;
  });
  return da;
}
