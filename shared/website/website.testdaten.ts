/**
 * **Bau-Hilfen für Tests** (W1, W1b): kleine Erzeuger für Bausteine, Abschnitte, Seiten, Einstellungen und Kontext. Die
 * Tests bauen ihre Daten damit statt aus handgeschriebenen Literalen – ein neues Pflichtfeld im Schema fällt dann hier
 * auf (Typprüfung), nicht erst in einem grünen Test mit veralteten Daten. `BEISPIELE` ist ein `Record` über alle
 * Baustein-Typen: ein neuer Typ ohne Beispiel bricht die Typprüfung.
 *
 * Hier stehen auch die **Beispiel-Farben und -Schriften einer Gemeinde** (ECG Donrath). Im Code der Website selbst gibt
 * es keine Gemeindefarben – dort gelten neutrale Vorgaben (`NEUTRALE_FARBEN`).
 */
import type {
  Abschnitt,
  Baustein,
  BausteinTyp,
  Einstellungen,
  Farben,
  Gestaltung,
  Menue,
  Schriften,
  Seite,
  Spalte,
} from './modell';
import { STANDARD_GESTALTUNG } from './modell';
import { standardAdresse, type RenderKontext } from './render';

/** Beispiel: die Farben der ECG Donrath (nur Testdaten!). */
export const ECG_FARBEN: Farben = {
  haupt: '#00616e',
  hauptTief: '#00434c',
  akzent: '#eb5e28',
  grund: '#fffcf2',
  sanft: '#ccd7c5',
  text: '#14110f',
};
/** Beispiel: Quicksand für Text und Überschriften, Caveat Brush für die Akzentzeile. */
export const ECG_SCHRIFTEN: Schriften = {
  text: { art: 'auswahl', name: 'Quicksand' },
  ueberschrift: { art: 'auswahl', name: 'Quicksand' },
  akzent: { art: 'auswahl', name: 'Caveat Brush' },
};

/** Eine gültige YouTube-Kennung für Tests (11 Zeichen). */
export const YT_ID = 'dQw4w9WgXcQ';

const BILD = { id: 'bild-1', breite: 1600, hoehe: 900 };

export const BEISPIELE: Record<BausteinTyp, (id: string) => Baustein> = {
  ueberschrift: (id) => ({
    typ: 'ueberschrift',
    id,
    text: 'Willkommen',
    ebene: 2,
    groesse: 'normal',
  }),
  akzentzeile: (id) => ({ typ: 'akzentzeile', id, text: 'Herzlich willkommen!' }),
  text: (id) => ({ typ: 'text', id, markdown: 'Ein **Absatz** mit [Link](https://beispiel.de).' }),
  bild: (id) => ({
    typ: 'bild',
    id,
    bild: BILD,
    alt: 'Das Gemeindehaus',
    unterschrift: 'Unser Haus',
  }),
  bildText: (id) => ({
    typ: 'bildText',
    id,
    bild: BILD,
    alt: 'Gruppe',
    markdown: 'Text neben dem Bild',
    bildSeite: 'links',
  }),
  galerie: (id) => ({
    typ: 'galerie',
    id,
    bilder: [
      { bild: BILD, alt: 'Eins', unterschrift: 'Erstes' },
      { bild: { id: 'bild-2' }, alt: 'Zwei' },
    ],
  }),
  knoepfe: (id) => ({
    typ: 'knoepfe',
    id,
    knoepfe: [
      { text: 'Mehr erfahren', ziel: { art: 'seite', seiteId: 'seite-start' }, art: 'haupt' },
      { text: 'Zweiter Weg', ziel: { art: 'extern', url: 'https://beispiel.de' }, art: 'neben' },
    ],
  }),
  beitraege: (id) => ({ typ: 'beitraege', id, anzahl: 3 }),
  termine: (id) => ({ typ: 'termine', id, kalender: [1], anzahl: 5 }),
  slider: (id) => ({ typ: 'slider', id, intervallSekunden: 6 }),
  livestream: (id) => ({ typ: 'livestream', id, zeigen: 'beides', archivAnzahl: 3 }),
  kontaktformular: (id) => ({ typ: 'kontaktformular', id, einleitung: 'Schreib uns!' }),
  gruppenliste: (id) => ({ typ: 'gruppenliste', id }),
  trenner: (id) => ({ typ: 'trenner', id, art: 'linie' }),
  html: (id) => ({ typ: 'html', id, html: '<p class="beispiel">Eigenes HTML</p>' }),
};

/** Ein Baustein dieses Typs mit Beispiel-Inhalt. */
export function baustein<T extends BausteinTyp>(
  typ: T,
  ueberschreibe: Partial<Extract<Baustein, { typ: T }>> = {},
): Extract<Baustein, { typ: T }> {
  return { ...BEISPIELE[typ](`b-${typ}`), ...ueberschreibe } as Extract<Baustein, { typ: T }>;
}

/** Die Gestaltung eines schlichten Abschnitts (`STANDARD_GESTALTUNG`), nach Bedarf überschrieben. */
export function gestaltung(ueberschreibe: Partial<Gestaltung> = {}): Gestaltung {
  return { ...STANDARD_GESTALTUNG, ...ueberschreibe };
}

export function spalte(bausteine: Baustein[] = [], ueberschreibe: Partial<Spalte> = {}): Spalte {
  return { id: 's-1', bausteine, ...ueberschreibe };
}

/** Ein Abschnitt mit EINER Spalte, in der die Bausteine stehen. */
export function abschnitt(
  bausteine: Baustein[] = [],
  ueberschreibe: Partial<Abschnitt> = {},
): Abschnitt {
  return {
    id: 'a-1',
    gestaltung: gestaltung(),
    aufteilung: '1',
    spalten: [spalte(bausteine)],
    ...ueberschreibe,
  };
}

export function seite(ueberschreibe: Partial<Seite> = {}): Seite {
  return {
    id: 'seite-start',
    titel: 'Startseite',
    pfad: 'start',
    startseite: true,
    abschnitte: [],
    ...ueberschreibe,
  };
}

/** Eine Seite mit EINEM Abschnitt (eine Spalte), in dem die Bausteine stehen. */
export function seiteMit(bausteine: Baustein[], ueberschreibe: Partial<Seite> = {}): Seite {
  return seite({ abschnitte: [abschnitt(bausteine)], ...ueberschreibe });
}

/** Zähler für die IDs der Vorlagen. */
export function idZaehler(): () => string {
  let n = 0;
  return () => `id-${++n}`;
}

export function einstellungen(ueberschreibe: Partial<Einstellungen> = {}): Einstellungen {
  return {
    name: 'Beispielgemeinde',
    fusszeile: [],
    noindex: false,
    sprache: 'de',
    kontaktAdresse: 'https://formular.beispiel.de/annahme',
    ...ueberschreibe,
  };
}

export function menue(eintraege: Menue['eintraege'] = []): Menue {
  return { eintraege };
}

export function kontext(ueberschreibe: Partial<RenderKontext> = {}): RenderKontext {
  return {
    einstellungen: einstellungen(),
    menue: menue(),
    seiten: [seite()],
    adresseVon: standardAdresse,
    bildAdresse: (bild, breite) => `/bilder/${bild.id}-${breite}.jpg`,
    stylesheet: '/website.css',
    skriptAdresse: '/website.js',
    schriftAdresse: (datei) => `/schriften/${datei}`,
    zeitzone: 'Europe/Berlin',
    ...ueberschreibe,
  };
}
