/**
 * **Bau-Hilfen für Tests** (W1): kleine Erzeuger für Bausteine, Seiten, Einstellungen und Kontext. Die Tests bauen ihre
 * Daten damit statt aus handgeschriebenen Literalen – ein neues Pflichtfeld im Schema fällt dann hier auf (Typprüfung),
 * nicht erst in einem grünen Test mit veralteten Daten. `BEISPIELE` ist ein `Record` über alle Baustein-Typen: ein
 * 14. Typ ohne Beispiel bricht die Typprüfung.
 */
import type { Baustein, BausteinTyp, Einstellungen, Menue, Seite } from './modell';
import { standardAdresse, type RenderKontext } from './render';

const BILD = { id: 'bild-1', breite: 1600, hoehe: 900 };

export const BEISPIELE: Record<BausteinTyp, (id: string) => Baustein> = {
  ueberschrift: (id) => ({ typ: 'ueberschrift', id, text: 'Willkommen', ebene: 2 }),
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
  knopf: (id) => ({
    typ: 'knopf',
    id,
    text: 'Mehr erfahren',
    ziel: { art: 'seite', seiteId: 'seite-start' },
    art: 'haupt',
  }),
  beitraege: (id) => ({ typ: 'beitraege', id, anzahl: 3 }),
  termine: (id) => ({ typ: 'termine', id, kalender: [1], anzahl: 5 }),
  slider: (id) => ({ typ: 'slider', id, intervallSekunden: 6 }),
  livestream: (id) => ({ typ: 'livestream', id, zeigen: 'beides', archivAnzahl: 3 }),
  kontaktformular: (id) => ({ typ: 'kontaktformular', id, einleitung: 'Schreib uns!' }),
  gruppenliste: (id) => ({ typ: 'gruppenliste', id }),
  trenner: (id) => ({ typ: 'trenner', id, art: 'linie' }),
};

/** Ein Baustein dieses Typs mit Beispiel-Inhalt. */
export function baustein<T extends BausteinTyp>(
  typ: T,
  ueberschreibe: Partial<Extract<Baustein, { typ: T }>> = {},
): Extract<Baustein, { typ: T }> {
  return { ...BEISPIELE[typ](`b-${typ}`), ...ueberschreibe } as Extract<Baustein, { typ: T }>;
}

export function seite(ueberschreibe: Partial<Seite> = {}): Seite {
  return {
    id: 'seite-start',
    titel: 'Startseite',
    pfad: 'start',
    startseite: true,
    bausteine: [],
    ...ueberschreibe,
  };
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
    ...ueberschreibe,
  };
}
