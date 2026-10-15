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
  // A6-2b (Alwin, 14./15.10.2026, Entwurf `a6-2b-entwurf-v2`): einmal je Anmeldung, gilt für alle Kinder.
  {
    id: 'eltern',
    name: 'Erziehungsberechtigte',
    bereich: 'anmeldung',
    feld: {
      ...neuesStandardFeld(
        'eltern',
        'erziehungsberechtigte',
        'Erziehungsberechtigte',
        'Für alle angemeldeten Kinder.',
      ),
      zustand: 'pflicht',
    },
  },
  {
    id: 'sign',
    name: 'Unterschrift',
    bereich: 'anmeldung',
    feld: {
      ...neuesStandardFeld('sign', 'unterschrift', 'Unterschrift', 'Mit dem Finger oder der Maus.'),
      zustand: 'pflicht',
    },
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
 * Felder, die nur in EINEN Bereich passen. Name und E-Mail gehören zur Anmeldung, der Name jeder Person und das
 * Geburtsdatum (ChurchTools-Personenfeld, Preise nach Alter) zur Person, die Bemerkungen zur Anmeldung. Wohin
 * sie auch gezogen werden – sie landen in ihrem Bereich; dort aber an jeder Stelle (Alwin, 13.10.2026: „Ich
 * möchte alles verschieben können“).
 */
export const BEREICH_FEST: Record<string, Bereich> = {
  name: 'anmeldung',
  mail: 'anmeldung',
  note: 'anmeldung',
  // Einmal je Anmeldung – für alle Kinder dieselben Erziehungsberechtigten, eine Unterschrift (A6-2b).
  eltern: 'anmeldung',
  sign: 'anmeldung',
  pname: 'person',
  birth: 'person',
};

/**
 * Preisbereich und Datenschutz stehen immer am Ende, direkt vor „Verbindlich anmelden“: Der Preis wird aus den
 * Angaben darüber gerechnet, und die Einwilligung gehört unmittelbar vor das Absenden.
 */
export function amEnde(f: Feld): boolean {
  return f.typ === 'price' || f.typ === 'privacy';
}

/** Lässt sich das Feld im Baukasten verschieben? Alles außer Preisbereich und Datenschutz. */
export function verschiebbar(f: Feld): boolean {
  return !amEnde(f);
}

/** In welchem Bereich steht das Feld? `null`, wenn es (noch) nicht im Formular ist. */
export function bereichVon(formular: Formular, feldId: string): Bereich | null {
  if (formular.anmeldung.some((f) => f.id === feldId)) return 'anmeldung';
  if (formular.person.some((f) => f.id === feldId)) return 'person';
  return null;
}

/**
 * **Ein Feld einordnen**: vor `vorId` in `bereich`, oder – bei `null` – ans Ende des Bereichs (vor Preis und
 * Datenschutz). Steht das Feld schon im Formular, wird es verschoben, auch in den anderen Bereich (sofern es
 * nicht an einen Bereich gebunden ist, `BEREICH_FEST`); sonst (`neu`) eingefügt. Eine Stelle hinter Preis oder
 * Datenschutz wird auf die letzte erlaubte geschoben; die beiden selbst bewegen sich nicht.
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
  let unten = liste.length;
  while (unten > 0 && amEnde(liste[unten - 1])) unten--;
  const vor = vorId === null ? -1 : liste.findIndex((f) => f.id === vorId);
  // „Ans Ende“ heißt vor die Bemerkungen, wenn sie gerade den Bereich abschließen – sie fragen nach „sonst noch
  // etwas?“. Wer ein Feld bewusst darunter zieht, gibt ein `vorId` an und bekommt genau diese Stelle.
  let ende = unten;
  if (liste[ende - 1]?.id === 'note' && feldId !== 'note') ende--;
  const stelle = vor < 0 ? ende : Math.min(vor, unten);
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
