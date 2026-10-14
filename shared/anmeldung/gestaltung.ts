/**
 * **Gestaltung des Anmeldeformulars** (A5). Seit dem Entwurf v3 (13.10.2026) sind die Vorlagen nur noch
 * **Startpunkte**: Jede füllt alle Werte, danach ist jeder einzeln änderbar (Aufbau, Kopf, Logo, Hintergrund mit
 * Muster, Farben, Schriften, Abschnitte, Felder, Knöpfe). Die EINE Stelle für die Werte: neue Veranstaltungen
 * (`neueEinstellungen`), das Lesen älterer Einstellungen (`mitVorgaben`), der Baukasten und das Formular.
 */
import type { Gestaltung, GestaltungWerte, VorlageId } from './formular';

export interface VorlageGestaltung {
  id: VorlageId;
  name: string;
  hinweis: string;
  werte: GestaltungWerte;
}

/** Was alle Vorlagen gemeinsam haben – nur, was davon abweicht, steht bei der Vorlage. */
const GRUND: GestaltungWerte = {
  aufbau: 'kopfband',
  kopfHoehe: 'mittel',
  kopfAusrichtung: 'links',
  hintergrund: 'farbe',
  muster: 'punkte',
  musterfarbe: '#ffcf3f',
  farbe: '#00616e',
  seitenfarbe: '#f3f6f6',
  kartenfarbe: '#ffffff',
  schriftfarbe: '#17242a',
  kopfSchrift: 'standard',
  textSchrift: 'standard',
  gross: false,
  ecken: 'rund',
  schatten: true,
  rahmen: false,
  bunt: false,
  feldstil: 'kasten',
  knoepfe: 'leicht',
  knopfVoll: true,
};

/** Die sechs Startpunkte (aus den starren Vorlagen vom 09.10.2026 abgeleitet). */
export const VORLAGEN_GESTALTUNG: VorlageGestaltung[] = [
  {
    id: 'klassisch',
    name: 'Klassisch',
    hinweis: 'Kopfband und Karten',
    werte: { ...GRUND, kopfSchrift: 'serif' },
  },
  {
    id: 'foto',
    name: 'Foto',
    hinweis: 'Titelbild über die ganze Seite',
    werte: {
      ...GRUND,
      aufbau: 'seite',
      kopfHoehe: 'klein',
      hintergrund: 'bild',
      farbe: '#2f6b3a',
      seitenfarbe: '#1e3328',
      kopfSchrift: 'klassisch',
      feldstil: 'linie',
      knoepfe: 'rund',
    },
  },
  {
    id: 'karte',
    name: 'Einladung',
    hinweis: 'Karte in der Mitte, festlich',
    werte: {
      ...GRUND,
      aufbau: 'karte',
      kopfAusrichtung: 'mitte',
      hintergrund: 'muster',
      muster: 'sterne',
      musterfarbe: '#f6d98a',
      farbe: '#b08a2e',
      seitenfarbe: '#0e1733',
      kartenfarbe: '#fbf7ec',
      schriftfarbe: '#2a2418',
      kopfSchrift: 'serif',
      textSchrift: 'serif',
      ecken: 'eckig',
      feldstil: 'linie',
      knoepfe: 'eckig',
    },
  },
  {
    id: 'bunt',
    name: 'Bunt',
    hinweis: 'Fröhlich, für Kinder',
    werte: {
      ...GRUND,
      hintergrund: 'muster',
      muster: 'konfetti',
      farbe: '#0369a1',
      seitenfarbe: '#fff8e7',
      schriftfarbe: '#1d2b3a',
      kopfSchrift: 'rund',
      textSchrift: 'rund',
      ecken: 'sehrrund',
      schatten: false,
      bunt: true,
      feldstil: 'gefuellt',
      knoepfe: 'rund',
    },
  },
  {
    id: 'geteilt',
    name: 'Zweigeteilt',
    hinweis: 'Kopf links, Formular rechts',
    werte: {
      ...GRUND,
      aufbau: 'geteilt',
      farbe: '#a3245c',
      seitenfarbe: '#ffffff',
      schriftfarbe: '#1f2937',
      schatten: false,
      rahmen: true,
      feldstil: 'gefuellt',
    },
  },
  {
    id: 'gross',
    name: 'Groß und deutlich',
    hinweis: 'Große Schrift, für Senioren',
    werte: {
      ...GRUND,
      kopfHoehe: 'klein',
      farbe: '#2563eb',
      seitenfarbe: '#ffffff',
      schriftfarbe: '#111827',
      kopfSchrift: 'lesbar',
      textSchrift: 'lesbar',
      gross: true,
      ecken: 'eckig',
      schatten: false,
      rahmen: true,
      knoepfe: 'eckig',
    },
  },
];

/** Die Farben zur Auswahl. Eigene Farben gehen zusätzlich über den Farbwähler. */
export const FARBEN: [string, string][] = [
  ['#00616e', 'Petrol'],
  ['#0369a1', 'Himmelblau'],
  ['#2563eb', 'Blau'],
  ['#2f6b3a', 'Waldgrün'],
  ['#a3245c', 'Beere'],
  ['#6d4bc4', 'Violett'],
  ['#b08a2e', 'Gold'],
  ['#374151', 'Anthrazit'],
];

export function vorlageVon(id: VorlageId): VorlageGestaltung {
  return VORLAGEN_GESTALTUNG.find((v) => v.id === id) ?? VORLAGEN_GESTALTUNG[0];
}

/** Ohne `undefined` und `null` – was eine ältere Einstellung nicht hatte, kommt aus der Vorlage. */
type Teil = Partial<{ [K in keyof Gestaltung]: Gestaltung[K] | null }> & {
  vorlage: VorlageId;
  farbe: string;
  feldstil: Gestaltung['feldstil'];
  knoepfe: Gestaltung['knoepfe'];
  text: string;
};

/**
 * **Fehlendes aus der Vorlage ergänzen** – für Einstellungen von vor dem Entwurf v3 (nur Vorlage, Farbe,
 * Feldstil, Knöpfe, Text) und für Zwischenstände mit „wie Vorlage“ (`null`). Aufgerufen beim Lesen (zod).
 */
export function mitVorgaben(g: Teil): Gestaltung {
  const gesetzt = Object.fromEntries(
    Object.entries(g).filter(([, v]) => v !== undefined && v !== null),
  ) as Partial<Gestaltung>;
  return {
    ...vorlageVon(g.vorlage).werte,
    logo: 'ct',
    logoUrl: null,
    logoOrt: 'oben',
    breite: 'normal',
    ...gesetzt,
  } as Gestaltung;
}

/**
 * **Startpunkt wechseln:** alle Werte der neuen Vorlage – so steht es auch in der Leiste („füllt alles
 * darunter“). Was keine Gestaltung im engeren Sinn ist, bleibt: Logo, Begrüßung, Breite.
 */
export function vorlageWechseln(g: Gestaltung, neu: VorlageId): Gestaltung {
  return { ...g, ...vorlageVon(neu).werte, vorlage: neu };
}

/** Welche Werte seit dem Startpunkt geändert wurden – für den Hinweis in der Leiste. */
export function geaendertSeitVorlage(g: Gestaltung): (keyof GestaltungWerte)[] {
  const start = vorlageVon(g.vorlage).werte;
  return (Object.keys(start) as (keyof GestaltungWerte)[]).filter((k) => start[k] !== g[k]);
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
