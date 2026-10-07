import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import { APP, AUSSERHALB, BEREICH, cssBereich, imBereich } from './cssBereich';

/**
 * Die globalen Stilregeln der Extension bleiben im App-Bereich (Alwin, 07.10.2026: die
 * ChurchTools-Menüs sahen in der Erweiterung anders aus). Geprüft wird der echte PostCSS-Lauf, nicht
 * nur die Hilfsfunktion – es zählt, was im gebauten CSS steht.
 */
async function lauf(css: string): Promise<string> {
  return (await postcss([cssBereich()]).process(css, { from: undefined })).css;
}

describe('imBereich', () => {
  it(':root wird der Bereich selbst, html und body nur die App', () => {
    expect(imBereich(':root')).toBe(BEREICH);
    expect(imBereich('html')).toBe(APP);
    expect(imBereich('body')).toBe(APP);
  });

  it('das Dunkel-Schema bleibt am html, die Variablen kommen in den Bereich', () => {
    expect(imBereich("html[data-theme='dark']")).toBe(`html[data-theme='dark'] ${BEREICH}`);
  });

  it('Element-, Universal- und Pseudo-Selektoren wandern in den Bereich', () => {
    expect(imBereich('*')).toBe(`${BEREICH} *`);
    expect(imBereich('*::before')).toBe(`${BEREICH} *::before`);
    expect(imBereich('button')).toBe(`${BEREICH} button`);
    expect(imBereich(':focus-visible')).toBe(`${BEREICH} :focus-visible`);
  });

  it('was schon im Bereich steht, bleibt – kein zweites Umschreiben', () => {
    expect(imBereich(AUSSERHALB)).toBe(AUSSERHALB);
    expect(imBereich(`${BEREICH} b`)).toBe(`${BEREICH} b`);
  });

  it('Klassen und IDs bleiben – CSS-Module, #root und die Einbettungs-Klasse', () => {
    expect(imBereich('._kopf_x1y2')).toBe('._kopf_x1y2');
    expect(imBereich('#root')).toBe('#root');
    expect(imBereich('.ct-extension #root')).toBe('.ct-extension #root');
  });
});

describe('Gewicht der umgeschriebenen Regeln', () => {
  it('der Bereich hat Gewicht 0 (`:where`) – der Reset darf keine Klasse der App schlagen', () => {
    // Mit `:is(#root, …)` erbte `* { padding: 0 }` das Gewicht einer ID und überschrieb jedes Polster
    // der App (Durchklick in der Test-Instanz, 07.10.2026).
    expect(BEREICH.startsWith(':where(')).toBe(true);
    expect(imBereich('*').startsWith(':where(')).toBe(true);
  });
});

describe('cssBereich – der PostCSS-Lauf', () => {
  it('nichts Globales bleibt übrig, das ChurchTools treffen könnte', async () => {
    const aus = await lauf(
      ':root{--shadow:x} html,body{height:100%;font-family:a;overflow:hidden} *,*::before{margin:0} button{outline:none}',
    );
    expect(aus).not.toMatch(
      /(^|[}\s,]):root\b|(^|[}\s,])(html|body)\s*[,{]|(^|})\s*\*|(^|})\s*button/,
    );
    expect(aus).toContain(`${BEREICH}{--shadow:x}`);
  });

  it('die Höhe der ganzen Seite fällt weg – sie gibt in der Extension ChurchTools vor', async () => {
    const aus = await lauf('html,body{height:100%;color:red} html{height:calc(1px + 2px)}');
    expect(aus).not.toContain('height');
    expect(aus).toContain('color:red');
  });

  /**
   * Durchklick 08.10.2026: Das Einführungs-Overlay (`data-musikapp`, außerhalb von `#root`) bekam den
   * deckenden Seitenhintergrund und verdeckte das Liedblatt. Außerhalb gilt nur die Schrift.
   */
  it('außerhalb von #root nur die Schrift der Seite – keine Fläche', async () => {
    const aus = await lauf(
      'html,body{background:#fff;color:red;font-family:a;overflow:hidden;overscroll-behavior:none;-webkit-font-smoothing:antialiased}',
    );
    // Ganze Regeln vergleichen, nicht Teilstrings: `toContain` fand die Regel für außerhalb auch
    // mitten in `<Bereich> :where([data-musikapp]){…}` – genau dem Fehler, den dieser Test bewachen
    // soll (im gebauten CSS gefunden, 08.10.2026).
    const regeln = aus
      .split('}')
      .map((r) => r.trim())
      .filter(Boolean);
    expect(regeln).toEqual([
      `${APP}{background:#fff;color:red;font-family:a;overflow:hidden;overscroll-behavior:none;-webkit-font-smoothing:antialiased`,
      `${AUSSERHALB}{color:red;font-family:a;-webkit-font-smoothing:antialiased`,
    ]);
  });

  it('ohne Schrift-Angaben entsteht für außerhalb keine leere Regel', async () => {
    const aus = await lauf('body{background:#fff}');
    expect(aus).not.toContain(AUSSERHALB);
  });

  it('auch in @media (Bewegung reduzieren, iOS-App)', async () => {
    const aus = await lauf('@media (prefers-reduced-motion: reduce){*,*::after{animation:none}}');
    expect(aus).toContain(`${BEREICH} *,${BEREICH} *::after`);
  });

  it('Keyframes bleiben unangetastet', async () => {
    const aus = await lauf('@keyframes spin{to{transform:rotate(1turn)}}');
    expect(aus).toBe('@keyframes spin{to{transform:rotate(1turn)}}');
  });
});
