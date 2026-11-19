/**
 * **Das Theme der Website** (W1b): aus den Einstellungen der Gemeinde (Farben, Schriften, eigenes CSS) wird der Inhalt
 * des `<style>` im Kopf jeder Seite. Reine Logik – wie der Renderer.
 *
 * Aufbau des Stylesheets, in dieser Reihenfolge (spätere Regeln gewinnen):
 *  1. `@font-face` für jede gewählte Schrift (Adresse vom Kontext: `schriftAdresse`),
 *  2. `:root { --farbe-… ; --schrift-… }` – die Variablen, die das gemeinsame Stylesheet (`website.css`) benutzt,
 *  3. das **eigene CSS** der Leitung.
 *
 * Schutz: Alles Eigene läuft durch eine Prüfung, auch wenn das Schema sie schon macht – Einstellungen kommen aus
 * ChurchTools-Werten, die jemand an der Oberfläche vorbei ändern kann. Farben nur als Hex, Schriftnamen nur aus
 * Buchstaben/Ziffern/Leerzeichen/Bindestrich, Gewichte nur als Zahlen, Adressen als CSS-Zeichenkette entschärft. Ein
 * ungültiger Wert fällt **still auf die neutrale Vorgabe zurück** (die Seite bleibt benutzbar, der Schaden bleibt aus).
 * Nur das eigene CSS wird nicht inhaltlich geprüft (E-W12, nur Leitung) – es kann aber nicht aus dem `<style>`
 * ausbrechen (`cssFuerStyleTag`).
 */
import { HEX_MUSTER, type Einstellungen, type Farben, type SchriftWahl } from './modell';
import { GEWICHTE_MUSTER, findeSchrift, istSichererSchriftname } from './schriften';

/**
 * Farben, wenn die Gemeinde keine angibt: **neutral, nicht die einer bestimmten Gemeinde.** (Die Farben der ECG
 * Donrath stehen nur in den Testdaten.)
 */
export const NEUTRALE_FARBEN: Readonly<Required<Omit<Farben, 'hauptTief'>>> = {
  haupt: '#24476b',
  akzent: '#d97706',
  grund: '#ffffff',
  sanft: '#e8edf2',
  text: '#1a1a1a',
};

/** Systemschrift, wenn keine gewählt ist – es wird nichts geladen. */
export const SYSTEM_SCHRIFT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
/** Ersatz hinter einer eigenen Schrift (die Art – Serife oder nicht – kennen wir nicht). */
const ERSATZ_EIGENE = 'system-ui, sans-serif';

/** Hex-Farbe aus den Daten oder die Vorgabe, falls der Wert keine ist. */
function farbe(wert: string | undefined, vorgabe: string): string {
  return typeof wert === 'string' && HEX_MUSTER.test(wert) ? wert : vorgabe;
}

/**
 * Wie hell ist eine Farbe? Relative Luminanz nach WCAG (0 = schwarz, 1 = weiß). `null` bei einem Wert, der keine
 * Hex-Farbe ist.
 */
export function luminanz(hex: string): number | null {
  if (!HEX_MUSTER.test(hex)) return null;
  const roh = hex.slice(1);
  const voll = roh.length === 3 ? [...roh].map((z) => z + z).join('') : roh;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(voll.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Soll Text auf dieser Farbe hell sein? Ab einer Luminanz unter 0,179 hat Weiß mehr Kontrast als Schwarz – genau dort
 * kreuzen sich beide Kontrastwerte. Eine ungültige Farbe zählt als hell nicht (dunkler Text, wie auf dem Grund).
 */
export function brauchtHellenText(hex: string): boolean {
  const l = luminanz(hex);
  return l !== null && l < 0.179;
}

/** Die Farben der Gemeinde, mit neutralen Werten aufgefüllt. */
export function wirksameFarben(e: Einstellungen): Required<Omit<Farben, 'hauptTief'>> & {
  hauptTief?: string;
} {
  const f = e.farben;
  const hauptTief =
    f?.hauptTief !== undefined && HEX_MUSTER.test(f.hauptTief) ? f.hauptTief : undefined;
  return {
    haupt: farbe(f?.haupt, NEUTRALE_FARBEN.haupt),
    akzent: farbe(f?.akzent, NEUTRALE_FARBEN.akzent),
    grund: farbe(f?.grund, NEUTRALE_FARBEN.grund),
    sanft: farbe(f?.sanft, NEUTRALE_FARBEN.sanft),
    text: farbe(f?.text, NEUTRALE_FARBEN.text),
    ...(hauptTief ? { hauptTief } : {}),
  };
}

// ── CSS-Bausteine ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Eine Adresse als Inhalt einer CSS-Zeichenkette in doppelten Anführungszeichen (`url("…")`). `"`, `'`, `\`, Klammern,
 * Leerraum, Steuerzeichen, `;`, `{`, `}`, `<` und `>` werden prozentkodiert – so bleibt die Adresse in der Zeichenkette
 * und im `<style>`.
 */
export function cssAdresse(adresse: string): string {
  // eslint-disable-next-line no-control-regex -- gerade die Steuerzeichen sollen kodiert werden
  return adresse.replace(/["'\\(){};<>\s\u0000-\u001f\u007f]/g, (z) => {
    const code = z.charCodeAt(0);
    return code < 256
      ? `%${code.toString(16).toUpperCase().padStart(2, '0')}`
      : encodeURIComponent(z);
  });
}

/**
 * CSS so, dass es nicht aus einem `<style>`-Element ausbrechen kann: Das einzige, was einen `<style>` beendet, ist
 * `</style` (egal in welcher Schreibweise, auch `</STYLE `). Jedes `</` wird deshalb zu `<\/`. In einer
 * CSS-Zeichenkette bedeutet `\/` dasselbe wie `/`, außerhalb davon ist es ohnehin kein gültiges CSS – nichts Sinnvolles
 * geht verloren.
 */
export function cssFuerStyleTag(css: string): string {
  return css.replace(/<\//g, '<\\/');
}

type Gesicht = { familie: string; stack: string; regel: string };

/** Schrift der Einstellungen → CSS-Name, Ersatz-Stack und `@font-face`; `null` bei einem unbrauchbaren Eintrag. */
function gesicht(
  wahl: SchriftWahl,
  k: { schriftAdresse: (datei: string) => string },
): Gesicht | null {
  if (wahl.art === 'auswahl') {
    const s = findeSchrift(wahl.name);
    if (!s) return null;
    return {
      familie: s.familie,
      stack: `'${s.familie}', ${s.ersatz}`,
      regel: `@font-face{font-family:'${s.familie}';src:url("${cssAdresse(k.schriftAdresse(s.datei))}") format('woff2');font-weight:${s.gewichte};font-display:swap}`,
    };
  }
  if (!istSichererSchriftname(wahl.name)) return null;
  const gewichte =
    wahl.gewichte !== undefined && GEWICHTE_MUSTER.test(wahl.gewichte)
      ? `font-weight:${wahl.gewichte};`
      : '';
  return {
    familie: wahl.name,
    stack: `'${wahl.name}', ${ERSATZ_EIGENE}`,
    regel: `@font-face{font-family:'${wahl.name}';src:url("${cssAdresse(k.schriftAdresse(wahl.datei))}");${gewichte}font-display:swap}`,
  };
}

/**
 * Das gesamte Theme als CSS-Text (ohne umgebendes `<style>`, aber bereits entschärft für den Einbau in eines).
 * `schriftAdresse` ist die Funktion des Render-Kontexts – der Renderer bildet nie selbst Adressen.
 */
export function themeCss(
  e: Einstellungen,
  k: { schriftAdresse: (datei: string) => string },
): string {
  const f = wirksameFarben(e);
  const text = e.schriften ? gesicht(e.schriften.text, k) : null;
  const ueberschrift = e.schriften ? gesicht(e.schriften.ueberschrift, k) : null;
  const akzent = e.schriften?.akzent ? gesicht(e.schriften.akzent, k) : null;

  // Jede Schrift nur einmal laden, auch wenn Text und Überschrift dieselbe wählen.
  const regeln = new Map<string, string>();
  for (const g of [text, ueberschrift, akzent]) if (g) regeln.set(g.familie, g.regel);

  const schriftText = text?.stack ?? SYSTEM_SCHRIFT;
  const schriftUeberschrift = ueberschrift?.stack ?? schriftText;
  const schriftAkzent = akzent?.stack ?? schriftUeberschrift;

  const variablen = [
    `--farbe-haupt:${f.haupt}`,
    // Fehlt die tiefe Variante, wird sie aus der Hauptfarbe abgeleitet.
    `--farbe-haupt-tief:${f.hauptTief ?? 'color-mix(in srgb, var(--farbe-haupt) 70%, #000)'}`,
    `--farbe-akzent:${f.akzent}`,
    `--farbe-grund:${f.grund}`,
    `--farbe-sanft:${f.sanft}`,
    `--farbe-text:${f.text}`,
    `--schrift-text:${schriftText}`,
    `--schrift-ueberschrift:${schriftUeberschrift}`,
    `--schrift-akzent:${schriftAkzent}`,
  ];

  const teile = [...regeln.values(), `:root{${variablen.join(';')}}`];
  if (e.eigenesCss !== undefined && e.eigenesCss.trim() !== '') teile.push(e.eigenesCss);
  return cssFuerStyleTag(teile.join('\n'));
}
