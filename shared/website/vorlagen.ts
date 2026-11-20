/**
 * **Abschnitt-Vorlagen** (W1b): Der Builder (W3) bietet beim Anlegen eines Abschnitts diese Vorlagen an – wie die
 * Abschnitt-Vorlagen von Squarespace. Eine Vorlage ist nur ein **Erzeuger**: Sie liefert einen fertigen, schema-gültigen
 * `Abschnitt` mit Platzhalter-Inhalt, den die Gemeinde dann ändert. Danach hängt nichts mehr an der Vorlage
 * (`abschnitt.vorlage` merkt sich nur den Namen, als Information).
 *
 * **Platzhalter statt Inhalt:** Alle Texte sind neutral und als Platzhalter erkennbar („Überschrift“, „Hier steht dein
 * Text.“) – keine Inhalte einer Gemeinde. Das gilt auch für
 *  - **Bilder:** die Kennung `'platzhalter'` (`PLATZHALTER_BILD`). Was sie anzeigt, bestimmt der Kontext (`bildAdresse`);
 *    der Builder ersetzt sie durch ein echtes Bild.
 *  - **Links:** `https://example.org` (`PLATZHALTER_LINK`), eine reservierte Beispieladresse.
 *  - **Kalender:** `termine` verlangt mindestens einen Kalender; die Kennung `1` ist ein Platzhalter, der Builder lässt
 *    die Auswahl ersetzen.
 *
 * IDs vergibt der Aufrufer über `neueId` (die Erweiterung nimmt Zufall, Tests einen Zähler) – hier gibt es weder
 * Zufall noch Uhr, die Vorlagen sind rein.
 */
import type { Abschnitt, Baustein, BausteinTyp, BildRef, Gestaltung, Link, Spalte } from './modell';
import { STANDARD_GESTALTUNG } from './modell';

/** Kennung des Platzhalter-Bildes. */
export const PLATZHALTER_BILD: BildRef = { id: 'platzhalter' };
/** Platzhalter-Link (`example.org` ist für Beispiele reserviert). */
export const PLATZHALTER_LINK = {
  art: 'extern',
  url: 'https://example.org',
} as const satisfies Link;

export type Vorlage = {
  /** Schlüssel (steht später in `Abschnitt.vorlage`). */
  name: string;
  /** Titel im Builder, deutsch. */
  titel: string;
  beschreibung: string;
  erzeugen: (neueId: () => string) => Abschnitt;
};

type Id = () => string;

// ── kleine Bausteine, aus denen die Vorlagen bestehen ────────────────────────────────────────────────────────

const akzent = (id: Id, text = 'Akzentzeile'): Baustein => ({ typ: 'akzentzeile', id: id(), text });
const ueberschrift = (
  id: Id,
  o: Partial<Extract<Baustein, { typ: 'ueberschrift' }>> = {},
): Baustein => ({
  typ: 'ueberschrift',
  id: id(),
  text: 'Überschrift',
  ebene: 2,
  groesse: 'normal',
  ...o,
});
const text = (id: Id, markdown = 'Hier steht dein Text.'): Baustein => ({
  typ: 'text',
  id: id(),
  markdown,
});
const bild = (id: Id, fuellen = false): Baustein => ({
  typ: 'bild',
  id: id(),
  bild: PLATZHALTER_BILD,
  alt: 'Bildbeschreibung',
  ...(fuellen ? { fuellen: true } : {}),
});
const knoepfe = (id: Id, zwei = true): Baustein => ({
  typ: 'knoepfe',
  id: id(),
  knoepfe: [
    { text: 'Knopf', ziel: PLATZHALTER_LINK, art: 'haupt' },
    ...(zwei ? [{ text: 'Zweiter Knopf', ziel: PLATZHALTER_LINK, art: 'neben' as const }] : []),
  ],
});

const termine = (id: Id): Baustein => ({ typ: 'termine', id: id(), kalender: [1], anzahl: 5 });
const beitraege = (id: Id): Baustein => ({ typ: 'beitraege', id: id(), anzahl: 3 });
const slider = (id: Id): Baustein => ({ typ: 'slider', id: id() });
const livestream = (id: Id): Baustein => ({
  typ: 'livestream',
  id: id(),
  zeigen: 'beides',
  archivAnzahl: 3,
});
const kontaktformular = (id: Id): Baustein => ({ typ: 'kontaktformular', id: id() });
const gruppenliste = (id: Id): Baustein => ({ typ: 'gruppenliste', id: id() });
const trenner = (id: Id): Baustein => ({ typ: 'trenner', id: id(), art: 'linie' });
const html = (id: Id): Baustein => ({
  typ: 'html',
  id: id(),
  html: '<p>Hier steht dein HTML.</p>',
});
const bildText = (id: Id): Baustein => ({
  typ: 'bildText',
  id: id(),
  bild: PLATZHALTER_BILD,
  alt: 'Bildbeschreibung',
  markdown: 'Hier steht dein Text.',
  bildSeite: 'links',
});
const galerie = (id: Id): Baustein => ({
  typ: 'galerie',
  id: id(),
  bilder: [1, 2, 3].map(() => ({ bild: PLATZHALTER_BILD, alt: 'Bildbeschreibung' })),
});

/**
 * **Ein neuer Baustein dieses Typs mit Platzhalter-Inhalt** (W3a-2, „Baustein hinzufügen“) – dieselben Erzeuger wie in den
 * Vorlagen unten, nicht nachgebaut. Ein `Record` über alle Typen: Kommt ein Typ im Modell dazu, scheitert hier die
 * Typprüfung, nicht erst der Editor.
 */
const ERZEUGER: Record<BausteinTyp, (id: Id) => Baustein> = {
  ueberschrift: (id) => ueberschrift(id),
  akzentzeile: (id) => akzent(id),
  text: (id) => text(id),
  bild: (id) => bild(id),
  bildText,
  galerie,
  knoepfe: (id) => knoepfe(id, false),
  beitraege,
  termine,
  slider,
  livestream,
  kontaktformular,
  gruppenliste,
  trenner,
  html,
};

export function neuerBaustein(typ: BausteinTyp, neueId: () => string): Baustein {
  return ERZEUGER[typ](neueId);
}

const spalte = (id: Id, bausteine: Baustein[], o: Partial<Spalte> = {}): Spalte => ({
  id: id(),
  bausteine,
  ...o,
});
const gestaltung = (o: Partial<Gestaltung> = {}): Gestaltung => ({ ...STANDARD_GESTALTUNG, ...o });

/** Baut eine Vorlage: trägt den Namen als `vorlage` ein, damit er nie von Hand mitgeführt werden muss. */
function vorlage(
  name: string,
  titel: string,
  beschreibung: string,
  bau: (id: Id) => Omit<Abschnitt, 'id' | 'vorlage'>,
): Vorlage {
  return {
    name,
    titel,
    beschreibung,
    // Erst die Abschnitt-ID, dann der Inhalt – damit die IDs in der Reihenfolge der Seite vergeben werden.
    erzeugen: (neueId) => ({ id: neueId(), vorlage: name, ...bau(neueId) }),
  };
}

// ── die Vorlagen ─────────────────────────────────────────────────────────────────────────────────────────────

export const VORLAGEN: readonly Vorlage[] = [
  vorlage(
    'start-schriftzug',
    'Start: Schriftzug',
    'Ruhiger Start: mittig, Handschrift-Zeile, riesige Überschrift, Leitsatz und zwei Knöpfe.',
    (id) => ({
      gestaltung: gestaltung({ abstand: 'gross', ausrichtung: 'mitte' }),
      aufteilung: '1',
      spalten: [
        spalte(id, [
          akzent(id),
          ueberschrift(id, { ebene: 1, groesse: 'riesig', punkt: true }),
          text(id, 'Hier steht dein Leitsatz.'),
          knoepfe(id),
        ]),
      ],
    }),
  ),
  vorlage(
    'start-foto-flaeche',
    'Start: Foto und Farbfläche',
    'Über die ganze Breite: links eine Farbfläche mit Text, rechts ein Foto, das die Hälfte füllt.',
    (id) => ({
      gestaltung: gestaltung({
        breite: 'voll',
        abstand: 'kein',
        senkrecht: 'mitte',
        hoehe: 'halb',
      }),
      aufteilung: '1-1',
      spalten: [
        spalte(
          id,
          [
            akzent(id),
            ueberschrift(id, { ebene: 1, groesse: 'gross', punkt: true }),
            text(id),
            knoepfe(id),
          ],
          { hintergrund: { art: 'haupt' } },
        ),
        spalte(id, [bild(id, true)], { handyZuerst: true }),
      ],
    }),
  ),
  vorlage(
    'start-foto-hintergrund',
    'Start: Foto im Hintergrund',
    'Ein abgedunkeltes Foto füllt den Abschnitt, der Text steht links darauf.',
    (id) => ({
      gestaltung: gestaltung({
        hintergrund: { art: 'bild', bild: PLATZHALTER_BILD, abdunkeln: 55 },
        abstand: 'gross',
        senkrecht: 'mitte',
        hoehe: 'halb',
      }),
      aufteilung: '1',
      spalten: [
        spalte(id, [
          akzent(id),
          ueberschrift(id, { ebene: 1, groesse: 'gross' }),
          text(id),
          knoepfe(id, false),
        ]),
      ],
    }),
  ),
  vorlage('text', 'Text', 'Überschrift und Text in schmaler, gut lesbarer Spalte.', (id) => ({
    gestaltung: gestaltung({ breite: 'schmal' }),
    aufteilung: '1',
    spalten: [spalte(id, [ueberschrift(id), text(id)])],
  })),
  vorlage('text-bild', 'Text und Bild', 'Links Text, rechts ein Bild.', (id) => ({
    gestaltung: gestaltung({ senkrecht: 'mitte' }),
    aufteilung: '1-1',
    spalten: [spalte(id, [akzent(id), ueberschrift(id), text(id)]), spalte(id, [bild(id)])],
  })),
  vorlage(
    'bild-text',
    'Bild und Text',
    'Links ein Bild, rechts Text (auf dem Handy zuerst das Bild).',
    (id) => ({
      gestaltung: gestaltung({ senkrecht: 'mitte' }),
      aufteilung: '1-1',
      spalten: [spalte(id, [bild(id)]), spalte(id, [akzent(id), ueberschrift(id), text(id)])],
    }),
  ),
  vorlage(
    'drei-spalten',
    'Drei Spalten',
    'Drei gleich breite Spalten mit je Überschrift und Text.',
    (id) => ({
      gestaltung: gestaltung({ hintergrund: { art: 'sanft' } }),
      aufteilung: '1-1-1',
      spalten: [1, 2, 3].map(() => spalte(id, [ueberschrift(id, { ebene: 3 }), text(id)])),
    }),
  ),
  vorlage(
    'termine',
    'Termine',
    'Die nächsten Termine aus dem Gemeindekalender, daneben eine Einleitung.',
    (id) => ({
      gestaltung: gestaltung(),
      aufteilung: '1-2',
      spalten: [
        spalte(id, [akzent(id), ueberschrift(id, { text: 'Termine' }), text(id)]),
        spalte(id, [termine(id)]),
      ],
    }),
  ),
  vorlage('beitraege', 'Beiträge', 'Die neuesten Beiträge als Karten.', (id) => ({
    gestaltung: gestaltung({ hintergrund: { art: 'sanft' } }),
    aufteilung: '1',
    spalten: [spalte(id, [akzent(id), ueberschrift(id), beitraege(id)])],
  })),
  vorlage('slider', 'Slider', 'Aktuelles und Einladungen als verschiebbare Bilder.', (id) => ({
    gestaltung: gestaltung({ abstand: 'klein' }),
    aufteilung: '1',
    spalten: [spalte(id, [akzent(id), ueberschrift(id), slider(id)])],
  })),
  vorlage(
    'livestream',
    'Livestream',
    'Der Livestream (erst nach Zustimmung zu YouTube) mit Text daneben.',
    (id) => ({
      gestaltung: gestaltung(),
      aufteilung: '2-1',
      spalten: [spalte(id, [livestream(id)]), spalte(id, [ueberschrift(id), text(id)])],
    }),
  ),
  vorlage('kontakt', 'Kontakt', 'Kontaktformular mit Platz für Angaben daneben.', (id) => ({
    gestaltung: gestaltung(),
    aufteilung: '2-1',
    spalten: [
      spalte(id, [ueberschrift(id), kontaktformular(id)]),
      spalte(id, [ueberschrift(id, { ebene: 3 }), text(id)]),
    ],
  })),
  vorlage('gruppen', 'Gruppen', 'Überschrift und die Liste der Gruppen.', (id) => ({
    gestaltung: gestaltung(),
    aufteilung: '1',
    spalten: [spalte(id, [akzent(id), ueberschrift(id), gruppenliste(id)])],
  })),
  vorlage('galerie', 'Galerie', 'Überschrift und ein Raster aus Bildern.', (id) => ({
    gestaltung: gestaltung(),
    aufteilung: '1',
    spalten: [spalte(id, [ueberschrift(id), galerie(id)])],
  })),
  vorlage('html', 'Eigenes HTML', 'Eigener HTML-Code – nur für die Leitung.', (id) => ({
    gestaltung: gestaltung(),
    aufteilung: '1',
    spalten: [spalte(id, [html(id)])],
  })),
];

/** Die Vorlage mit diesem Namen – `undefined`, wenn es sie nicht gibt. */
export function findeVorlage(name: string): Vorlage | undefined {
  return VORLAGEN.find((v) => v.name === name);
}
