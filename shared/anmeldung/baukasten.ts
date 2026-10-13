/**
 * **Regeln des Formular-Baukastens** (A5, Umbau nach Alwins Wunsch vom 13.10.2026: „ein bisschen näher an Jotform“,
 * Baukasten wie Campflow). Reine Funktionen – die Erweiterung (Ziehen, Ablegen, Antippen) und das Speichern
 * (`formularFelder.ts`) nutzen dieselben, damit Bildschirm und gespeicherte Reihenfolge nie auseinanderlaufen.
 */
import { standardFormular, type Feld, type Feldtyp, type Formular } from './formular';

export type Bereich = keyof Formular;

/**
 * **Empfohlene Bausteine** – Felder mit fester Bedeutung (Übersicht, Check-in, Preise nach Alter). Jedes gibt es
 * höchstens einmal im Formular; daher feste Kennungen. Die fünf aus dem Grundformular (`standardFormular`)
 * werden von dort übernommen, damit Frage und Hilfetext an EINER Stelle stehen; Anschrift, Gesundheit und
 * Notfallkontakt sind mit dem Baukasten dazugekommen.
 */
export interface Empfohlen {
  id: string;
  /** Name der Kachel. */
  name: string;
  /** Wo das Feld hinkommt, wenn es angetippt statt gezogen wird. */
  bereich: Bereich;
  feld: Feld;
}

const GRUND = standardFormular();
const ausGrund = (id: string): Feld => {
  const f = [...GRUND.anmeldung, ...GRUND.person].find((x) => x.id === id)!;
  // Beim Einfügen eingeschaltet; das Geburtsdatum ist nur als Pflicht sinnvoll (Preise nach Alter).
  return { ...f, zustand: id === 'birth' ? 'pflicht' : 'freiwillig' };
};
const neuesStandardFeld = (id: string, typ: Feldtyp, frage: string, hilfe: string): Feld => ({
  id,
  art: 'standard',
  typ,
  frage,
  hilfe,
  zustand: 'freiwillig',
  antworten: [],
});

export const EMPFOHLEN: Empfohlen[] = [
  { id: 'birth', name: 'Geburtsdatum', bereich: 'person', feld: ausGrund('birth') },
  { id: 'tel', name: 'Telefon', bereich: 'anmeldung', feld: ausGrund('tel') },
  {
    id: 'addr',
    name: 'Anschrift',
    bereich: 'anmeldung',
    feld: neuesStandardFeld('addr', 'textarea', 'Anschrift', 'Straße, PLZ und Ort'),
  },
  {
    id: 'notfall',
    name: 'Notfallkontakt',
    bereich: 'anmeldung',
    feld: neuesStandardFeld(
      'notfall',
      'text',
      'Notfallkontakt während der Veranstaltung',
      'Name und Telefonnummer',
    ),
  },
  { id: 'allergy', name: 'Allergien & Essen', bereich: 'person', feld: ausGrund('allergy') },
  {
    id: 'health',
    name: 'Gesundheit',
    bereich: 'person',
    feld: neuesStandardFeld(
      'health',
      'textarea',
      'Gesundheitliche Hinweise',
      'z. B. Medikamente, Asthma',
    ),
  },
  { id: 'foto', name: 'Foto-Erlaubnis', bereich: 'person', feld: ausGrund('foto') },
  { id: 'note', name: 'Bemerkungen', bereich: 'anmeldung', feld: ausGrund('note') },
];

/**
 * Felder, die nur in EINEN Bereich passen: Das Geburtsdatum gehört zur Person (ChurchTools-Personenfeld, Preise
 * nach Alter), die Bemerkungen einmal ans Ende der Anmeldung. Wohin sie auch gezogen werden – sie landen dort.
 */
export const BEREICH_FEST: Record<string, Bereich> = { birth: 'person', note: 'anmeldung' };

/** Name, E-Mail (bzw. der Name jeder Person) stehen immer oben. */
function festOben(f: Feld): boolean {
  return f.art === 'fest' && (f.typ === 'name' || f.typ === 'email');
}

/** Bemerkungen, Preisbereich und Datenschutz stehen immer am Ende – so zeigt sie auch das Formular. */
function festUnten(f: Feld): boolean {
  return f.id === 'note' || f.typ === 'price' || f.typ === 'privacy';
}

/** Lässt sich das Feld im Baukasten verschieben? */
export function verschiebbar(f: Feld): boolean {
  return !festOben(f) && !festUnten(f) && f.art !== 'fest';
}

/** In welchem Bereich steht das Feld? `null`, wenn es (noch) nicht im Formular ist. */
export function bereichVon(formular: Formular, feldId: string): Bereich | null {
  if (formular.anmeldung.some((f) => f.id === feldId)) return 'anmeldung';
  if (formular.person.some((f) => f.id === feldId)) return 'person';
  return null;
}

/**
 * **Ein Feld einordnen**: vor `vorId` in `bereich`, oder – bei `null` – ans Ende des Bereichs (vor Bemerkungen,
 * Preis und Datenschutz). Steht das Feld schon im Formular, wird es verschoben, auch in den anderen Bereich;
 * sonst (`neu`) eingefügt. Oben und unten feste Felder bleiben, wo sie sind – eine Stelle davor oder dahinter wird
 * auf die nächste erlaubte geschoben. Feste Felder selbst bewegen sich nicht.
 */
export function einordnen(
  formular: Formular,
  feldId: string,
  wohin: Bereich,
  vorId: string | null,
  neu?: Feld,
): Formular {
  const bereich = BEREICH_FEST[feldId] ?? wohin;
  const da = bereichVon(formular, feldId);
  const feld = da ? formular[da].find((f) => f.id === feldId)! : neu;
  if (!feld) return formular;
  if (da && !verschiebbar(feld)) return formular;
  const ohne: Formular = {
    anmeldung: formular.anmeldung.filter((f) => f.id !== feldId),
    person: formular.person.filter((f) => f.id !== feldId),
  };
  const liste = ohne[bereich];
  let oben = 0;
  while (oben < liste.length && festOben(liste[oben])) oben++;
  let unten = liste.length;
  while (unten > oben && festUnten(liste[unten - 1])) unten--;
  const vor = vorId === null ? -1 : liste.findIndex((f) => f.id === vorId);
  // Neu eingefügte Bemerkungen gehören immer direkt vor Preis und Datenschutz, egal wohin gezogen.
  const preisStelle = liste.findIndex((f) => f.typ === 'price' || f.typ === 'privacy');
  const stelle = festUnten(feld)
    ? preisStelle < 0
      ? liste.length
      : preisStelle
    : vor < 0
      ? unten
      : Math.min(Math.max(vor, oben), unten);
  return { ...ohne, [bereich]: [...liste.slice(0, stelle), feld, ...liste.slice(stelle)] };
}

/**
 * Die Kennung des Felds, das nach `feldId` im Bereich steht (für „Kopie gleich darunter“); `null` = am Ende.
 */
export function naechsteId(formular: Formular, feldId: string): string | null {
  const b = bereichVon(formular, feldId);
  if (!b) return null;
  const liste = formular[b];
  const i = liste.findIndex((f) => f.id === feldId);
  return liste[i + 1]?.id ?? null;
}

/** **Was ein neuer Baustein mitbringt** – Frage, Antworten, freiwillig. */
export function bausteinFeld(typ: Feldtyp, id: string): Feld {
  const frage: Partial<Record<Feldtyp, string>> = {
    janein: 'Neue Ja/Nein-Frage',
    check: 'Ich bin einverstanden, dass …',
    radio: 'Neue Auswahl',
    select: 'Neue Auswahl',
    multi: 'Neue Mehrfachauswahl',
    date: 'Datum',
    number: 'Anzahl',
    ueberschrift: 'Zwischenüberschrift',
    info: 'Hinweis',
    trenner: '',
  };
  return {
    id,
    art: 'eigen',
    typ,
    frage: frage[typ] ?? 'Neue Frage',
    hilfe: typ === 'info' ? 'Hier steht ein Hinweis für die Gäste.' : '',
    zustand: 'freiwillig',
    antworten:
      typ === 'radio' || typ === 'select' || typ === 'multi' ? ['Antwort 1', 'Antwort 2'] : [],
  };
}

/** Eine Kennung, die es im Formular noch nicht gibt (`f1`, `f2` …). */
export function neueFeldKennung(formular: Formular): string {
  const vergeben = new Set([...formular.anmeldung, ...formular.person].map((f) => f.id));
  for (let i = 1; ; i++) if (!vergeben.has(`f${i}`)) return `f${i}`;
}
