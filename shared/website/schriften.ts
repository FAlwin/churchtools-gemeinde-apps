/**
 * **Die feste Schriftauswahl der Website** (Bauplan Website, E-W14).
 *
 * Gemeinden wählen im Builder aus dieser Liste freier Schriften (SIL Open Font License) oder laden eigene Dateien
 * hoch. Hier steht **nur die Liste** – die Schriftdateien selbst kommen mit W5 ins Bau-Paket (lokal, nie von einem
 * fremden Dienst: DSGVO). `datei` ist der Dateiname, unter dem sie dort liegen werden; die Adresse im fertigen
 * Stylesheet bildet der Kontext (`schriftAdresse`), der Renderer erfindet keine.
 *
 * Alle Einträge sind **variable Schriften** (eine Datei deckt den ganzen Gewichtsbereich ab, `gewichte` = Bereich für
 * `font-weight`), sonst bräuchte eine Schrift mehrere Dateien. Lato (nur in festen Schnitten erhältlich) fehlt
 * deshalb, dafür steht Raleway in der Liste.
 */

export type SchriftKategorie = 'serifenlos' | 'serif' | 'hand' | 'display';

export type Schrift = {
  /** Name im Builder – zugleich der Schlüssel, den die Einstellungen speichern. */
  name: string;
  /** CSS-Name (`font-family`). */
  familie: string;
  kategorie: SchriftKategorie;
  /** Dateiname der WOFF2-Datei im Bau-Paket. */
  datei: string;
  /** Bereich für `font-weight`: `'300 700'`, bei nur einem Schnitt `'400'`. */
  gewichte: string;
  /** Ersatz-Schriften, solange die Datei lädt (und falls sie fehlt). Enthält die generische Familie am Ende. */
  ersatz: string;
};

const SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const HAND = "'Segoe Print', 'Comic Sans MS', cursive";

export const SCHRIFTEN: readonly Schrift[] = [
  {
    name: 'Quicksand',
    familie: 'Quicksand',
    kategorie: 'serifenlos',
    datei: 'quicksand-var.woff2',
    gewichte: '300 700',
    ersatz: SANS,
  },
  {
    name: 'Noto Sans',
    familie: 'Noto Sans',
    kategorie: 'serifenlos',
    datei: 'noto-sans-var.woff2',
    gewichte: '100 900',
    ersatz: SANS,
  },
  {
    name: 'Montserrat',
    familie: 'Montserrat',
    kategorie: 'serifenlos',
    datei: 'montserrat-var.woff2',
    gewichte: '100 900',
    ersatz: SANS,
  },
  {
    name: 'Open Sans',
    familie: 'Open Sans',
    kategorie: 'serifenlos',
    datei: 'open-sans-var.woff2',
    gewichte: '300 800',
    ersatz: SANS,
  },
  {
    name: 'Source Sans 3',
    familie: 'Source Sans 3',
    kategorie: 'serifenlos',
    datei: 'source-sans-3-var.woff2',
    gewichte: '200 900',
    ersatz: SANS,
  },
  {
    name: 'Nunito',
    familie: 'Nunito',
    kategorie: 'serifenlos',
    datei: 'nunito-var.woff2',
    gewichte: '200 900',
    ersatz: SANS,
  },
  {
    name: 'Inter',
    familie: 'Inter',
    kategorie: 'serifenlos',
    datei: 'inter-var.woff2',
    gewichte: '100 900',
    ersatz: SANS,
  },
  {
    name: 'Raleway',
    familie: 'Raleway',
    kategorie: 'serifenlos',
    datei: 'raleway-var.woff2',
    gewichte: '100 900',
    ersatz: SANS,
  },
  {
    name: 'Roboto Slab',
    familie: 'Roboto Slab',
    kategorie: 'serif',
    datei: 'roboto-slab-var.woff2',
    gewichte: '100 900',
    ersatz: SERIF,
  },
  {
    name: 'Merriweather',
    familie: 'Merriweather',
    kategorie: 'serif',
    datei: 'merriweather-var.woff2',
    gewichte: '300 900',
    ersatz: SERIF,
  },
  {
    name: 'Lora',
    familie: 'Lora',
    kategorie: 'serif',
    datei: 'lora-var.woff2',
    gewichte: '400 700',
    ersatz: SERIF,
  },
  {
    name: 'Playfair Display',
    familie: 'Playfair Display',
    kategorie: 'display',
    datei: 'playfair-display-var.woff2',
    gewichte: '400 900',
    ersatz: SERIF,
  },
  {
    name: 'Caveat',
    familie: 'Caveat',
    kategorie: 'hand',
    datei: 'caveat-var.woff2',
    gewichte: '400 700',
    ersatz: HAND,
  },
  {
    name: 'Caveat Brush',
    familie: 'Caveat Brush',
    kategorie: 'hand',
    datei: 'caveat-brush.woff2',
    gewichte: '400',
    ersatz: HAND,
  },
];

/** Die Schrift mit diesem Namen aus der Auswahl – `undefined`, wenn es sie nicht gibt. */
export function findeSchrift(name: string): Schrift | undefined {
  return SCHRIFTEN.find((s) => s.name === name);
}

/**
 * Was ein Schriftname sein darf: Buchstaben, Ziffern, Leerzeichen und Bindestrich. Der Name steht in einer
 * `font-family`-Angabe im `<style>` der Seite – **jedes weitere Zeichen** (`;` `}` `'` `\` `<` …) könnte CSS
 * einschleusen und ist deshalb ausgeschlossen. Gilt für eigene Schriften (die Auswahl besteht den Test von selbst).
 */
export const SCHRIFTNAME_MUSTER = /^[\p{L}\p{N}][\p{L}\p{N} -]{0,59}$/u;

export function istSichererSchriftname(name: unknown): name is string {
  return typeof name === 'string' && SCHRIFTNAME_MUSTER.test(name);
}

/** Gewichts-Angabe für `font-weight`: ein Wert (`400`) oder ein Bereich (`300 700`). */
export const GEWICHTE_MUSTER = /^[1-9]00(?: [1-9]00)?$/;
