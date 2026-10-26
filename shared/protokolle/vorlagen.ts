/**
 * **Vorlagen für neue Sitzungen** (Bauplan Protokolle S1/S2) – gemeindeweit, mehrere zur Auswahl, dazu
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

/**
 * Ein fester Punkt ohne das, was eine frühere Sitzung bei ihrer Freigabe festhielt (`props.fest`, S4-3a) – in einer
 * neuen Sitzung zeigt er wieder live.
 */
function ohneFest(props: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(props).filter(([k]) => k !== 'fest'));
}

/** Das Dokument einer neuen Sitzung aus einer Vorlage – jeder Block mit neuer ID, feste Aufgaben noch ungespeichert. */
export function startDokument(vorlage: Vorlage, neueId: () => string): Block[] {
  const kopie = mitNeuenIds(vorlage.bloecke, neueId);
  const leeren = (b: Block): Block => ({
    ...b,
    ...(b.type === BLOCK.aufgabe ? { props: { ...b.props, aufgabe: '' } } : {}),
    ...(b.type === BLOCK.verweis && b.props ? { props: ohneFest(b.props) } : {}),
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
      ...(b.props ? { props: ohneFest(b.props) } : {}),
      ...(b.type === 'heading' ? { content: text(textAus(b.content)) } : {}),
      children: [],
    }));
  return mitNeuenIds(behalten, neueId);
}

/**
 * **Eine Vorlage zum Bearbeiten** (Bauplan S2-3, Entwurf 7): Name, Tagesordnungspunkte mit vorbereitetem Text und
 * festen Punkten („Offene To-Dos“, „Letztes Protokoll“) sowie feste Aufgaben. Gespeichert wird weiterhin das
 * Dokument (`bloecke`) – die Verwaltung bearbeitet nur diese einfachere Sicht darauf.
 */
export interface VorlagenFormular {
  name: string;
  punkte: { titel: string; text: string; verweis: VerweisArt | null }[];
  aufgaben: string[];
}

export type VerweisArt = 'offene-aufgaben' | 'letztes-protokoll';

/**
 * Vorlage → Formular. Jede Überschrift (Ebene 1) beginnt einen Punkt, Absätze darunter werden sein Text (eine Zeile
 * je Absatz), ein Verweis macht ihn zum festen Punkt. Feste Aufgaben werden gesammelt, egal unter welchem Punkt sie
 * stehen. Andere Blöcke kommen in Vorlagen nicht vor (sie entstehen nur über dieses Formular).
 */
export function alsFormular(v: Vorlage): VorlagenFormular {
  const f: VorlagenFormular = { name: v.name, punkte: [], aufgaben: [] };
  const aktuell = (): VorlagenFormular['punkte'][number] => {
    if (!f.punkte.length) f.punkte.push({ titel: '', text: '', verweis: null });
    return f.punkte[f.punkte.length - 1];
  };
  for (const b of v.bloecke) {
    if (b.type === 'heading' && Number(b.props?.level ?? 1) === 1)
      f.punkte.push({ titel: textAus(b.content), text: '', verweis: null });
    else if (b.type === 'paragraph') {
      const p = aktuell();
      const t = textAus(b.content);
      if (t) p.text = p.text ? `${p.text}\n${t}` : t;
    } else if (b.type === BLOCK.verweis) {
      const art = b.props?.art;
      if (art === 'offene-aufgaben' || art === 'letztes-protokoll') aktuell().verweis = art;
    } else if (b.type === BLOCK.aufgabe) {
      const t = textAus(b.content);
      if (t) f.aufgaben.push(t);
    }
  }
  return f;
}

/** Was am Formular fehlt – leer heißt: speicherbar. */
export function formularPruefen(f: VorlagenFormular): string[] {
  const fehler: string[] = [];
  if (!f.name.trim()) fehler.push('Die Vorlage braucht einen Namen.');
  if (!f.punkte.some((p) => p.titel.trim()))
    fehler.push('Die Vorlage braucht mindestens einen Tagesordnungspunkt.');
  return fehler;
}

/**
 * Formular → Vorlage. Punkte ohne Titel fallen weg, ebenso leere Zeilen und leere Aufgaben; die festen Aufgaben
 * stehen unter dem letzten Punkt. `id` bleibt bei einer bestehenden Vorlage gleich.
 */
export function ausFormular(f: VorlagenFormular, id: string, neueId: () => string): Vorlage {
  const bloecke: Block[] = [];
  for (const p of f.punkte) {
    const titel = p.titel.trim();
    if (!titel) continue;
    bloecke.push(punkt(neueId(), titel));
    if (p.verweis) bloecke.push(verweis(neueId(), p.verweis));
    for (const zeile of p.text.split('\n').map((z) => z.trim()))
      if (zeile) bloecke.push(absatz(neueId(), zeile));
  }
  for (const a of f.aufgaben.map((x) => x.trim())) if (a) bloecke.push(aufgabe(neueId(), a));
  return { art: 'vorlage', fassung: 1, id, name: f.name.trim(), bloecke };
}

export function istVorlage(x: unknown): x is Vorlage {
  const v = x as Partial<Vorlage> | null;
  return (
    !!v &&
    v.art === 'vorlage' &&
    v.fassung === 1 &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    Array.isArray(v.bloecke)
  );
}

/** Die Zeile in der Liste: „5 Punkte · 1 feste Aufgabe“. */
export function vorlageKurz(v: Vorlage): string {
  const f = alsFormular(v);
  const n = f.punkte.length;
  const a = f.aufgaben.length;
  return [
    `${n} ${n === 1 ? 'Punkt' : 'Punkte'}`,
    ...(a ? [`${a} ${a === 1 ? 'feste Aufgabe' : 'feste Aufgaben'}`] : []),
  ].join(' · ');
}
