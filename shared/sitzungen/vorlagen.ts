/**
 * **Vorlagen für neue Sitzungen** (Sitzungen, Bauplan S1/S2) – gemeindeweit, mehrere zur Auswahl, dazu
 * „wie letztes Mal“ (entschieden 16.10.2026). Eine Vorlage ist ein kleines Dokument: Tagesordnungspunkte,
 * vorbereiteter Text je Punkt und feste Aufgaben, die bei jeder Sitzung dieser Art anfallen.
 *
 * Lesen dürfen sie nur Nutzende **eingerichteter Gruppen** (Alwin, 22.10.2026), schreiben nur Admins (S2).
 */
import { BLOCK, mitNeuenIds, textAus, type Block } from './dokument';

export interface Vorlage {
  art: 'vorlage';
  fassung: 1;
  id: string;
  name: string;
  bloecke: Block[];
}

const text = (t: string): Block['content'] => (t ? [{ type: 'text', text: t, styles: {} }] : []);
const punkt = (id: string, titel: string): Block => ({
  id,
  type: 'heading',
  props: { level: 1 },
  content: text(titel),
  children: [],
});
const absatz = (id: string, t: string): Block => ({
  id,
  type: 'paragraph',
  content: text(t),
  children: [],
});
const verweis = (id: string, art: 'offene-aufgaben' | 'letztes-protokoll'): Block => ({
  id,
  type: BLOCK.verweis,
  props: { art },
  children: [],
});
const aufgabe = (id: string, t: string): Block => ({
  id,
  type: BLOCK.aufgabe,
  props: { aufgabe: '' },
  content: text(t),
  children: [],
});

/**
 * **Die Vorlagen, mit denen eine Gemeinde startet** – aus den Entwürfen (Leitungssitzung, Teamtreffen, Klausur).
 * Die IDs sind nur Platzhalter; beim Anlegen einer Sitzung bekommt jeder Block eine neue (`startDokument`).
 */
export const STANDARD_VORLAGEN: readonly Vorlage[] = [
  {
    art: 'vorlage',
    fassung: 1,
    id: 'leitungssitzung',
    name: 'Leitungssitzung',
    bloecke: [
      punkt('l1', 'Andacht & Gebet'),
      punkt('l2', 'Protokoll der letzten Sitzung'),
      verweis('l2v', 'letztes-protokoll'),
      punkt('l3', 'Offene To-Dos'),
      verweis('l3v', 'offene-aufgaben'),
      punkt('l4', 'Termine & Gemeindeleben'),
      absatz('l4t', 'Was steht in den nächsten vier Wochen an?'),
      punkt('l5', 'Verschiedenes'),
      aufgabe('l5a', 'Raum für die nächste Sitzung prüfen'),
    ],
  },
  {
    art: 'vorlage',
    fassung: 1,
    id: 'teamtreffen',
    name: 'Teamtreffen',
    bloecke: [
      punkt('t1', 'Rückblick'),
      absatz('t1t', 'Was lief gut? Was ändern wir?'),
      punkt('t2', 'Offene To-Dos'),
      verweis('t2v', 'offene-aufgaben'),
      punkt('t3', 'Planung der nächsten Wochen'),
      punkt('t4', 'Gebet'),
    ],
  },
  {
    art: 'vorlage',
    fassung: 1,
    id: 'klausur',
    name: 'Klausur',
    bloecke: [
      punkt('k1', 'Ankommen'),
      punkt('k2', 'Rückblick aufs Jahr'),
      absatz('k2t', 'Was hat uns getragen? Was war schwer?'),
      punkt('k3', 'Schwerpunkte'),
      absatz('k3t', 'Worauf legen wir im nächsten Jahr den Fokus?'),
      punkt('k4', 'Ziele'),
      punkt('k5', 'Offene To-Dos'),
      verweis('k5v', 'offene-aufgaben'),
      punkt('k6', 'Nächste Schritte'),
      aufgabe('k6a', 'Ergebnisse an die Gemeinde weitergeben'),
    ],
  },
];

/** Das Dokument einer neuen Sitzung aus einer Vorlage – jeder Block mit neuer ID, feste Aufgaben noch ungespeichert. */
export function startDokument(vorlage: Vorlage, neueId: () => string): Block[] {
  const kopie = mitNeuenIds(vorlage.bloecke, neueId);
  const leeren = (b: Block): Block => ({
    ...b,
    ...(b.type === BLOCK.aufgabe ? { props: { ...b.props, aufgabe: '' } } : {}),
    children: (b.children ?? []).map(leeren),
  });
  return kopie.map(leeren);
}

/**
 * **„Wie letztes Mal“** – dieselben Tagesordnungspunkte und festen Verweise, aber ohne die Notizen, Beschlüsse,
 * Aufgaben und Termine der letzten Sitzung (die gehören zu ihr; offene Aufgaben erscheinen über den Verweis).
 */
export function wieLetztesMal(letztes: readonly Block[], neueId: () => string): Block[] {
  const behalten = letztes
    .filter(
      (b) =>
        (b.type === 'heading' && Number(b.props?.level ?? 1) === 1) || b.type === BLOCK.verweis,
    )
    .map((b) => ({
      id: b.id,
      type: b.type,
      ...(b.props ? { props: { ...b.props } } : {}),
      ...(b.type === 'heading' ? { content: text(textAus(b.content)) } : {}),
      children: [],
    }));
  return mitNeuenIds(behalten, neueId);
}
