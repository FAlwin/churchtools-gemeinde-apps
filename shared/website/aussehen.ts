/**
 * **Die Regeln des Reiters „Aussehen“** (Bauplan Website W3a-3) – rein, ohne Oberfläche, damit die Bauteile nur anzeigen und
 * die Tests sie ohne sie prüfen. Alles hier schreibt **nur über die Schemas der Einstellungen** (`modell.ts`): Was hier
 * herauskommt, besteht `einstellungenSchema`.
 */
import { HEX_MUSTER, type Einstellungen, type Farben, type SchriftWahl } from './modell';
import { KONTRAST_MINDEST, kontrast, wirksameFarben } from './theme';

export type FarbSchluessel = keyof Farben;

/** Die sechs Farbfelder, in der Reihenfolge der Oberfläche. `hinweis` sagt, wofür die Farbe gebraucht wird. */
export const FARBFELDER: readonly { schluessel: FarbSchluessel; label: string; hinweis: string }[] =
  [
    { schluessel: 'haupt', label: 'Hauptfarbe', hinweis: 'Flächen, Knöpfe, Schriftzug' },
    { schluessel: 'hauptTief', label: 'Hauptfarbe dunkel', hinweis: 'Fußzeile, Fotos abdunkeln' },
    { schluessel: 'akzent', label: 'Akzent', hinweis: 'Punkt, Handschrift, Knöpfe auf Farbe' },
    { schluessel: 'grund', label: 'Hintergrund', hinweis: 'Seite' },
    { schluessel: 'sanft', label: 'Sanft', hinweis: 'ruhige Abschnitte' },
    { schluessel: 'text', label: 'Text', hinweis: 'Fließtext' },
  ];

/**
 * Eine eingetippte Farbe als Hex-Wert in Kleinbuchstaben – `null`, wenn es keine ist. Das `#` darf fehlen („1f4e79“).
 * Nur was das Schema akzeptiert (`#rgb`, `#rrggbb`) kommt durch.
 */
export function hexAusEingabe(text: string): string | null {
  const t = text.trim();
  const mit = t.startsWith('#') ? t : `#${t}`;
  return HEX_MUSTER.test(mit) ? mit.toLowerCase() : null;
}

/** Die dunkle Variante, wenn keine gesetzt ist – dasselbe wie `color-mix(in srgb, haupt 70%, #000)` im Theme. */
export function hauptTiefAbgeleitet(haupt: string): string {
  const roh = haupt.slice(1);
  const voll = roh.length === 3 ? [...roh].map((z) => z + z).join('') : roh;
  return (
    '#' +
    [0, 2, 4]
      .map((i) =>
        Math.round(parseInt(voll.slice(i, i + 2), 16) * 0.7)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** Die Farbe, die gerade gilt (auch wenn sie nicht gesetzt ist: neutrale Vorgabe bzw. aus der Hauptfarbe abgeleitet). */
export function farbeGilt(e: Einstellungen, schluessel: FarbSchluessel): string {
  const f = wirksameFarben(e);
  return schluessel === 'hauptTief' ? (f.hauptTief ?? hauptTiefAbgeleitet(f.haupt)) : f[schluessel];
}

/** Ist die Farbe selbst gesetzt (nicht die Vorgabe)? Für die Hex-Eingabe: leer, solange nichts gesetzt ist. */
export function farbeGesetzt(e: Einstellungen, schluessel: FarbSchluessel): string | undefined {
  return e.farben?.[schluessel];
}

/**
 * Eine Farbe setzen. Beim ersten Mal werden alle Pflichtfarben mit den geltenden Werten aufgefüllt (das Schema verlangt sie
 * zusammen) – an der Seite ändert das nichts. `null` setzt nur die dunkle Hauptfarbe zurück (sie wird dann abgeleitet), alle
 * anderen Farben haben immer einen Wert.
 */
export function farbeSetzen(
  e: Einstellungen,
  schluessel: FarbSchluessel,
  hex: string | null,
): Einstellungen {
  const f = wirksameFarben(e);
  const farben: Farben = {
    haupt: f.haupt,
    akzent: f.akzent,
    grund: f.grund,
    sanft: f.sanft,
    text: f.text,
    ...(f.hauptTief ? { hauptTief: f.hauptTief } : {}),
  };
  if (hex === null) {
    if (schluessel !== 'hauptTief') return e;
    delete farben.hauptTief;
  } else {
    farben[schluessel] = hex;
  }
  return { ...e, farben };
}

export type SchriftRolle = 'text' | 'ueberschrift' | 'akzent';

/**
 * Eine Schrift wählen. `null` nimmt die Handschrift-Zeile zurück (dann gilt dort die Überschrift-Schrift). Sind noch gar keine
 * Schriften gewählt (Systemschrift), gilt die erste Wahl für **Text und Überschriften** – das Schema verlangt beide zusammen.
 */
export function schriftSetzen(
  e: Einstellungen,
  rolle: SchriftRolle,
  wahl: SchriftWahl | null,
): Einstellungen {
  if (wahl === null) {
    if (rolle !== 'akzent' || !e.schriften?.akzent) return e;
    const { text, ueberschrift } = e.schriften;
    return { ...e, schriften: { text, ueberschrift } };
  }
  const alt = e.schriften ?? { text: wahl, ueberschrift: wahl };
  return { ...e, schriften: { ...alt, [rolle]: wahl } };
}

export interface KontrastHinweis {
  /** Text auf welchem Grund? */
  auf: 'grund' | 'sanft';
  verhaeltnis: number;
}

/**
 * Wo ist Text auf seinem Grund schwer zu lesen? Geprüft werden **Text auf Hintergrund** und **Text auf Sanft** (E-W18).
 * Unter 4,5 : 1 (WCAG AA) kommt ein Eintrag; die Oberfläche zeigt ihn ruhig an – **gespeichert wird trotzdem**.
 */
export function kontrastHinweise(e: Einstellungen): KontrastHinweis[] {
  const text = farbeGilt(e, 'text');
  const hinweise: KontrastHinweis[] = [];
  for (const auf of ['grund', 'sanft'] as const) {
    const v = kontrast(text, farbeGilt(e, auf));
    if (v !== null && v < KONTRAST_MINDEST) hinweise.push({ auf, verhaeltnis: v });
  }
  return hinweise;
}

/** „3,1 : 1“ – das Verhältnis für die Anzeige, auf eine Stelle abgerundet (aufgerundet könnte 4,46 als „4,5“ erscheinen). */
export function verhaeltnisText(v: number): string {
  return `${(Math.floor(v * 10) / 10).toFixed(1).replace('.', ',')} : 1`;
}
