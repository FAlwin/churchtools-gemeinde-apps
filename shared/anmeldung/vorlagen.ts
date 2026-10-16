/**
 * **Womit eine neue Veranstaltung beginnt** (A3, #486) – die drei Vorlagen aus dem Bauplan (Kinder-Event,
 * Freizeit, einfaches Gemeinde-Event). Eine Vorlage füllt nur die Startwerte; alles lässt sich danach
 * ändern. Hier steht auch der eine Satz Startwerte, auf dem Tests und Demo aufbauen – damit ein neues
 * Feld der Einstellungen an EINER Stelle einen Wert bekommt.
 */
import { STANDARD_BEZAHLUNG } from './bezahlung';
import { mitVorgaben, vorlageVon } from './gestaltung';
import {
  standardFormular,
  type Formular,
  type Gestaltung,
  type OeffentlicheEinstellungen,
} from './formular';
import { EMPFOHLEN, einordnen } from './baukasten';

export type Vorlage = 'einfach' | 'kinder' | 'freizeit';

export const VORLAGEN: { id: Vorlage; name: string; beschreibung: string }[] = [
  {
    id: 'einfach',
    name: 'Einfaches Event',
    beschreibung: 'Gemeindeessen, Ausflug, Seminar – Familien melden sich gemeinsam an',
  },
  {
    id: 'kinder',
    name: 'Kinder-Event',
    beschreibung:
      'Eltern melden ihre Kinder an; Geburtsdatum, Telefon, Foto-Erlaubnis, Erziehungsberechtigte und Unterschrift sind Pflicht',
  },
  {
    id: 'freizeit',
    name: 'Freizeit',
    beschreibung: 'Mehrere Tage, Preise nach Alter oder Zimmer, mit Geburtsdatum',
  },
];

const GESTALTUNG: Record<Vorlage, Gestaltung['vorlage']> = {
  einfach: 'klassisch',
  kinder: 'bunt',
  freizeit: 'foto',
};

/**
 * **Kinder-Event:** dazu „Erziehungsberechtigte“ und „Unterschrift“ (Alwin, 14.10.2026: „bei Vorlage Kinder drin“) –
 * über dieselben Bausteine und dieselbe Einordnung wie im Baukasten, damit Vorlage und Kachel nicht auseinanderlaufen.
 */
function kinderFormular(): Formular {
  let f = standardFormular({ geburtsdatum: true, telefon: 'pflicht', foto: 'pflicht' });
  for (const id of ['eltern', 'sign']) {
    const b = EMPFOHLEN.find((x) => x.id === id)!;
    f = einordnen(f, b.feld.id, b.bereich, null, b.feld);
  }
  return f;
}

/** Die Gestaltung einer neuen Veranstaltung: die Werte des passenden Startpunkts (`mitVorgaben`). */
function startGestaltung(vorlage: Vorlage): Gestaltung {
  const v = vorlageVon(GESTALTUNG[vorlage]);
  return mitVorgaben({
    vorlage: v.id,
    farbe: v.werte.farbe,
    feldstil: v.werte.feldstil,
    knoepfe: v.werte.knoepfe,
    text: '',
  });
}

/** Die Startwerte einer neuen Veranstaltung: noch ohne Termin, kostenlos, ohne Konto, Löschfrist 3 Monate. */
export function neueEinstellungen(vorlage: Vorlage): OeffentlicheEinstellungen {
  return {
    termin: null,
    preis: {
      grundpreis: { art: 'fest', betragCent: 0, gilt: 'person', auswahlName: '', optionen: [] },
      alter: [],
      anpassungen: [],
      extras: [],
    },
    formular:
      vorlage === 'kinder'
        ? kinderFormular()
        : vorlage === 'freizeit'
          ? standardFormular({ geburtsdatum: true })
          : standardFormular(),
    gestaltung: startGestaltung(vorlage),
    ctFelder: {},
    wer: vorlage === 'kinder' ? 'kinder' : 'familie',
    plaetze: { zeigen: 'knapp', knappUnter: 5 },
    loeschfristMonate: 3,
    bezahlung: { ...STANDARD_BEZAHLUNG },
    kontakt: '',
  };
}
