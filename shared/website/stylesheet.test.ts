import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AUFTEILUNGEN,
  BAUSTEIN_TYPEN,
  spaltenAnzahl,
  type Abschnitt,
  type Gestaltung,
  type Hintergrund,
} from './modell';
import { renderSeite } from './render';
import { VORLAGEN } from './vorlagen';
import {
  abschnitt,
  baustein,
  gestaltung,
  idZaehler,
  kontext,
  seite,
  spalte,
} from './website.testdaten';

/**
 * **Jede Klasse, die der Renderer ausgibt, hat im Stylesheet eine Regel** (W3a-1) – sonst steht das Element ungestylt da,
 * und weder Build noch Lint merken es (dieselbe Lehre wie `client/src/cssKlassen.test.ts` für CSS-Module).
 *
 * Geprüft wird an der **Ausgabe des Renderers** (nicht an einer Liste von Hand): jeder Bausteintyp, jede Abschnitt-Vorlage
 * und jede Gestaltungs-Kombination (Hintergrund × Abstand × Breite × Höhe × Ausrichtung × Aufteilung), mit Daten für die
 * dynamischen Bausteine. Das Stylesheet liegt unter `shared/website/website.css` – es ist Gemeinde-Design und gehört nicht
 * zu den Quelltext-Wächtern der ChurchTools-Oberfläche (`ui/design/*`).
 */
const CSS = readFileSync(new URL('./website.css', import.meta.url), 'utf8');

/** Alle Klassennamen, die das Stylesheet erwähnt. */
const IM_STYLESHEET = new Set(
  [...CSS.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map((m) => m[1]),
);

/**
 * Klassen, die der Renderer bewusst **ohne eigene Regel** ausgibt – Haken für Skript, Gestaltung des Eigenen HTML oder
 * Zustandsmarken. Jede hier mit Begründung; eine neue Klasse ohne Regel gehört nicht stillschweigend hierher.
 */
const OHNE_REGEL: Record<string, string> = {
  // Haken für Selektoren und Skript – gestaltet wird über die Eltern (`.w-beitrag h3`, `.w-gruppe img` …)
  'w-b-beitraege': 'Hülle je Bausteintyp (`w-b-<typ>`); nur die mit Regeln stehen im Blatt',
  'w-b-bildText': 'Hülle je Bausteintyp',
  'w-b-galerie': 'Hülle je Bausteintyp',
  'w-b-gruppenliste': 'Hülle je Bausteintyp',
  'w-b-html': 'Hülle je Bausteintyp – das Eigene HTML bringt seine Klassen selbst mit',
  'w-b-knoepfe': 'Hülle je Bausteintyp',
  'w-b-kontaktformular': 'Hülle je Bausteintyp',
  'w-b-livestream': 'Hülle je Bausteintyp',
  'w-b-slider': 'Hülle je Bausteintyp',
  'w-b-termine': 'Hülle je Bausteintyp',
  'w-b-trenner': 'Hülle je Bausteintyp',
  'w-b-ueberschrift': 'Hülle je Bausteintyp',
  'w-beitrag-bild': 'Bild im Beitrag – gestaltet über `.w-beitrag img`',
  'w-beitrag-text': 'Text im Beitrag – erbt',
  'w-beitrag-titel': 'Titel im Beitrag – gestaltet über `.w-beitrag h3`',
  'w-bildtext-links': 'Gegenstück zu `w-bildtext-rechts`: links ist die Vorgabe der Reihenfolge',
  'w-datum': 'Datumszeile – gestaltet über `.w-beitrag time` und `.w-videokarte time`',
  'w-fuss-nav': 'Navigation der Fußzeile – gestaltet über `.w-fuss ul`/`a`',
  'w-gruppe-name': 'Name der Gruppe – gestaltet über `.w-gruppe h3`',
  'w-gruppe-text': 'Beschreibung der Gruppe – erbt `w-text-weich`',
  'w-kontakt-text': 'Einleitung des Kontaktformulars – erbt',
  'w-logo-name': 'Name statt Logo – erbt vom Kopf',
  'w-nav-unter': 'Unterpunkte im Menü – gestaltet über `.w-nav ul`',
  'w-seite': 'das `<main>` – steht ohne eigene Gestaltung',
  'w-spalten--1': 'Aufteilung „1“: eine Spalte ist die Vorgabe des Rasters',
  'w-stream-aktuell': 'Block „Livestream“ – gestaltet über die Karte darin',
  'w-stream-archiv': 'Block „Aufzeichnungen“ – gestaltet über `.w-videos`',
};

function klassenAus(html: string): Set<string> {
  const k = new Set<string>();
  for (const m of html.matchAll(/\sclass="([^"]*)"/g))
    for (const c of m[1].split(/\s+/)) if (c.startsWith('w-')) k.add(c);
  return k;
}

const BILD = { id: 'b1', breite: 1600, hoehe: 900 };
const DYNAMISCH = kontext({
  beitraege: [
    { id: '1', titel: 'Beitrag', text: 'Text', datum: '2026-03-05T10:00:00Z', bild: BILD },
    { id: '2', titel: 'Ohne Bild', text: 'Text', datum: '2026-03-04T10:00:00Z' },
  ],
  termine: [
    {
      titel: 'Termin',
      beginn: '2026-07-02T08:00:00Z',
      ende: '2026-07-02T09:00:00Z',
      ganztaegig: false,
      ort: 'Saal',
      kalenderId: 1,
    },
    {
      titel: 'Ganztägig',
      beginn: '2026-07-03T00:00:00Z',
      ende: '2026-07-03T23:59:00Z',
      ganztaegig: true,
      kalenderId: 1,
    },
  ],
  sliderFolien: [
    { bild: BILD, alt: 'Eins' },
    { bild: { id: 'b2' }, alt: 'Zwei', link: { art: 'extern', url: 'https://a.de' } },
  ],
  livestream: {
    aktuell: { id: 'v0', titel: 'Live', datum: '2026-05-03T08:00:00Z', youtubeId: 'dQw4w9WgXcQ' },
    archiv: [
      { id: 'v1', titel: 'Archiv', datum: '2026-05-01T08:00:00Z', adresse: 'https://v.de/1' },
      { id: 'v2', titel: 'Mit Bild', datum: '2026-04-01T08:00:00Z', vorschaubild: BILD },
    ],
  },
  gruppen: [
    { id: 1, name: 'Jugend', beschreibung: 'Für alle', gruppentypId: 3, bild: BILD },
    { id: 2, name: 'Ohne Bild', gruppentypId: 3 },
  ],
  einstellungen: {
    name: 'Beispielgemeinde',
    fusszeile: [{ titel: 'Impressum', ziel: { art: 'extern', url: 'https://beispiel.de/i' } }],
    noindex: false,
    sprache: 'de',
    datenschutz: { art: 'extern', url: 'https://beispiel.de/d' },
  },
  menue: {
    eintraege: [
      {
        titel: 'Start',
        ziel: { art: 'seite', seiteId: 'seite-start' },
        unter: [{ titel: 'Unter', ziel: { art: 'extern', url: 'https://beispiel.de/u' } }],
      },
    ],
  },
});

const HINTERGRUENDE: Hintergrund[] = [
  { art: 'grund' },
  { art: 'sanft' },
  { art: 'haupt' },
  { art: 'akzent' },
  { art: 'farbe', farbe: '#336699' },
  { art: 'bild', bild: BILD, abdunkeln: 40 },
];

/** Alle Seiten, deren Ausgabe geprüft wird. */
function alleSeiten() {
  const seiten = [];
  // Jeder Bausteintyp einzeln.
  for (const typ of BAUSTEIN_TYPEN)
    seiten.push(seite({ abschnitte: [abschnitt([baustein(typ)])] }));
  // Alle Vorlagen.
  const neueId = idZaehler();
  seiten.push(seite({ abschnitte: VORLAGEN.map((v) => v.erzeugen(neueId)) }));
  // Gestaltungs-Kombinationen – jeder Wert jeder Eigenschaft mindestens einmal, dazu alle Hintergründe je Abschnitt
  // und je Spalte.
  const abschnitte: Abschnitt[] = [];
  const gestaltungen: Partial<Gestaltung>[] = [];
  for (const abstand of ['kein', 'klein', 'normal', 'gross'] as const)
    for (const breite of ['schmal', 'normal', 'breit', 'voll'] as const)
      gestaltungen.push({ abstand, breite });
  for (const hoehe of ['auto', 'halb', 'voll'] as const)
    for (const ausrichtung of ['links', 'mitte'] as const)
      for (const senkrecht of ['oben', 'mitte'] as const)
        for (const text of ['auto', 'hell', 'dunkel'] as const)
          gestaltungen.push({ hoehe, ausrichtung, senkrecht, text, anker: 'a' });
  for (const hintergrund of HINTERGRUENDE)
    for (const text of ['auto', 'hell', 'dunkel'] as const)
      gestaltungen.push({ hintergrund, text });
  let n = 0;
  for (const g of gestaltungen)
    abschnitte.push(abschnitt([baustein('text')], { id: `g-${n++}`, gestaltung: gestaltung(g) }));
  for (const aufteilung of AUFTEILUNGEN)
    for (const hintergrund of HINTERGRUENDE)
      abschnitte.push(
        abschnitt([], {
          id: `s-${n++}`,
          aufteilung,
          spalten: Array.from({ length: spaltenAnzahl(aufteilung) }, (_, i) =>
            spalte([baustein('text')], {
              id: `sp-${n}-${i}`,
              hintergrund,
              handyZuerst: i === 1,
            }),
          ),
        }),
      );
  seiten.push(seite({ abschnitte }));
  return seiten;
}

describe('Stylesheet und Renderer', () => {
  it('jede ausgegebene Klasse hat eine Regel – oder steht mit Begründung in der Ausnahmeliste', () => {
    const ausgegeben = new Set<string>();
    for (const s of alleSeiten())
      for (const c of klassenAus(renderSeite(s, DYNAMISCH))) ausgegeben.add(c);
    // Die Messung selbst: ohne Klassen mäße der Test nichts.
    expect(ausgegeben.size).toBeGreaterThan(60);
    const ohne = [...ausgegeben].filter((c) => !IM_STYLESHEET.has(c) && !(c in OHNE_REGEL)).sort();
    expect(ohne).toEqual([]);
  });

  it('die Ausnahmeliste ist ehrlich: jede Klasse darin wird auch ausgegeben und hat wirklich keine Regel', () => {
    const ausgegeben = new Set<string>();
    for (const s of alleSeiten())
      for (const c of klassenAus(renderSeite(s, DYNAMISCH))) ausgegeben.add(c);
    for (const c of Object.keys(OHNE_REGEL)) {
      expect(IM_STYLESHEET.has(c), `${c} hat inzwischen eine Regel – aus der Liste nehmen`).toBe(
        false,
      );
      expect(ausgegeben.has(c), `${c} wird nicht mehr ausgegeben – aus der Liste nehmen`).toBe(
        true,
      );
    }
  });

  it('das Blatt enthält nichts aus dem Entwurf: keine Leiste, keine festen Schriftdateien, keine Gemeinde', () => {
    expect(CSS).not.toMatch(/e-leiste|e-mit-leiste/);
    expect(CSS).not.toMatch(/@font-face/);
    expect(CSS).not.toMatch(/Quicksand|Caveat|#00616e|#eb5e28/i);
  });
});
