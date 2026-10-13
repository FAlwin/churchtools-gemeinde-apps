/**
 * **Gestaltung des Anmeldeformulars** (A5) – die sechs Vorlagen aus dem Entwurf vom 09.10.2026 und die Farben.
 * Die EINE Stelle für die Vorgaben: neue Veranstaltungen (`neueEinstellungen`), der Reiter „Gestaltung“ und das
 * öffentliche Formular lesen hier.
 */
import type { OeffentlicheEinstellungen } from './formular';

/**
 * **Die sechs Vorlagen** (Entwurf vom 09.10.2026) mit ihren Vorgaben. Wer eine andere Vorlage wählt, bekommt
 * deren Farbe, Feldstil und Knöpfe – außer, das Team hatte sie schon von Hand geändert.
 */
export const VORLAGEN_GESTALTUNG: {
  id: OeffentlicheEinstellungen['gestaltung']['vorlage'];
  name: string;
  hinweis: string;
  farbe: string;
  feldstil: OeffentlicheEinstellungen['gestaltung']['feldstil'];
  knoepfe: OeffentlicheEinstellungen['gestaltung']['knoepfe'];
  bildOrt: string;
}[] = [
  {
    id: 'klassisch',
    name: 'Klassisch',
    hinweis: 'Kopfband und Karten',
    farbe: '#00616e',
    feldstil: 'kasten',
    knoepfe: 'eckig',
    bildOrt: 'Kopfband',
  },
  {
    id: 'foto',
    name: 'Foto',
    hinweis: 'Bild über die ganze Seite',
    farbe: '#2f6b3a',
    feldstil: 'linie',
    knoepfe: 'rund',
    bildOrt: 'Hintergrund der ganzen Seite',
  },
  {
    id: 'karte',
    name: 'Einladungskarte',
    hinweis: 'Edel, für Feste',
    farbe: '#c9a54a',
    feldstil: 'linie',
    knoepfe: 'eckig',
    bildOrt: 'Hintergrund hinter der Karte',
  },
  {
    id: 'bunt',
    name: 'Bunt',
    hinweis: 'Fröhlich, für Kinder',
    farbe: '#0369a1',
    feldstil: 'gefuellt',
    knoepfe: 'rund',
    bildOrt: 'Kopfbild',
  },
  {
    id: 'geteilt',
    name: 'Zweigeteilt',
    hinweis: 'Bild links, Formular rechts',
    farbe: '#a3245c',
    feldstil: 'gefuellt',
    knoepfe: 'eckig',
    bildOrt: 'linke Hälfte',
  },
  {
    id: 'gross',
    name: 'Groß und deutlich',
    hinweis: 'Große Schrift, für Senioren',
    farbe: '#2563eb',
    feldstil: 'kasten',
    knoepfe: 'eckig',
    bildOrt: 'Kopfband',
  },
];

/** Die Farben zur Auswahl (Entwurf). Eigene Farben gehen zusätzlich über den Farbwähler. */
export const FARBEN: [string, string][] = [
  ['#00616e', 'Petrol'],
  ['#0369a1', 'Himmelblau'],
  ['#2563eb', 'Blau'],
  ['#2f6b3a', 'Waldgrün'],
  ['#a3245c', 'Beere'],
  ['#6d4bc4', 'Violett'],
  ['#c9a54a', 'Gold'],
  ['#374151', 'Anthrazit'],
];

/**
 * Vorlage wechseln: Farbe, Feldstil und Knöpfe der neuen Vorlage übernehmen – jeweils nur, wenn der bisherige
 * Wert noch der Vorgabe der alten Vorlage entsprach (sonst hat das Team ihn bewusst gewählt). Eigene Farben für
 * Seite, Karten und Schrift fallen weg: Sie passten zur alten Vorlage, nicht zur neuen.
 */
export function vorlageWechseln(
  g: OeffentlicheEinstellungen['gestaltung'],
  neu: OeffentlicheEinstellungen['gestaltung']['vorlage'],
): OeffentlicheEinstellungen['gestaltung'] {
  const alt = VORLAGEN_GESTALTUNG.find((v) => v.id === g.vorlage);
  const ziel = VORLAGEN_GESTALTUNG.find((v) => v.id === neu)!;
  return {
    ...g,
    vorlage: neu,
    farbe: !alt || g.farbe.toLowerCase() === alt.farbe ? ziel.farbe : g.farbe,
    feldstil: !alt || g.feldstil === alt.feldstil ? ziel.feldstil : g.feldstil,
    knoepfe: !alt || g.knoepfe === alt.knoepfe ? ziel.knoepfe : g.knoepfe,
    // Seite, Karten und Schrift bringt jede Vorlage selbst mit – eigene Farben gehören zur alten Vorlage.
    seitenfarbe: null,
    kartenfarbe: null,
    schriftfarbe: null,
  };
}

/**
 * **Das Titelbild in voller Größe.** Die `imageUrl`, die ChurchTools für ein Gruppenbild liefert, ist ein
 * Vorschaubild mit 150×150 Pixeln (gemessen 13.10.2026) – auf dem Kopf des Formulars verzogen und unscharf
 * (Alwin). Der Bilddienst liefert jede Breite ohne Login: `?w=1600&h=0` hält das Seitenverhältnis. Das
 * Original (`fileUrl`) ist ohne Login nicht abrufbar (401).
 */
export function titelbildGross(url: string, breite = 1600): string {
  return `${url}${url.includes('?') ? '&' : '?'}w=${breite}&h=0`;
}
