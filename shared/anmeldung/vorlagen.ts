/**
 * **Womit eine neue Veranstaltung beginnt** (A3, #486) – die drei Vorlagen aus dem Bauplan (Kinder-Event,
 * Freizeit, einfaches Gemeinde-Event). Eine Vorlage füllt nur die Startwerte; alles lässt sich danach
 * ändern. Hier steht auch der eine Satz Startwerte, auf dem Tests und Demo aufbauen – damit ein neues
 * Feld der Einstellungen an EINER Stelle einen Wert bekommt.
 */
import { standardFormular, type Gestaltung, type OeffentlicheEinstellungen } from './formular';

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
      'Eltern melden ihre Kinder an; Geburtsdatum, Telefon und Foto-Erlaubnis sind Pflicht',
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

/** Die Startwerte einer neuen Veranstaltung: noch ohne Termin, kostenlos, Löschfrist 3 Monate. */
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
        ? standardFormular({ geburtsdatum: true, telefon: 'pflicht', foto: 'pflicht' })
        : vorlage === 'freizeit'
          ? standardFormular({ geburtsdatum: true })
          : standardFormular(),
    gestaltung: {
      vorlage: GESTALTUNG[vorlage],
      farbe: '#2563eb',
      feldstil: 'kasten',
      knoepfe: 'rund',
      text: '',
      gemeindename: true,
    },
    ctFelder: {},
    wer: vorlage === 'kinder' ? 'kinder' : 'familie',
    plaetze: { zeigen: 'knapp', knappUnter: 5 },
    loeschfristMonate: 3,
  };
}
