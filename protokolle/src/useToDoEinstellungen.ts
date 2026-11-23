/**
 * **Die Einstellungen der To-Do-Übersicht merken – je Benutzer, auf allen Geräten** (S7-3, Alwin 30.10.2026: „egal ob
 * ich am Handy oder iPad arbeite“). Gemessen: `protokolle-planung/docs/messung-s7-3-ablage-30.10.md`.
 *
 * - **Im Gerät** liegt ein Spiegel im Format der Personen-Datei (je Feld Wert + Zeitpunkt) – die Seite startet damit
 *   sofort, auch ohne Netz.
 * - **In ChurchTools** liegt dieselbe Datei am eigenen Konto (`protokolle_einstellungen.json`, Baustein
 *   `@shared/ct/personenAblage` wie die Musik-App). Beim Öffnen, kurz nach jeder Änderung, beim Weglegen der Seite und
 *   wenn das Netz zurückkommt, wird **Feld für Feld zusammengeführt** – die jüngere Änderung gewinnt (`mische`).
 * - **Vorübergehend ist nicht ungültig:** Scheitert der Abgleich (Netz, ChurchTools, fehlendes Recht), bleibt alles im
 *   Gerät und wird beim nächsten Anlass nachgeholt. Verworfen wird nie etwas.
 *
 * - **Je Person:** Der Spiegel trägt die Person im Namen. Ein Spiegel nur je Browser gab im Test (30.10.2026, Simulation
 *   im selben Browser – wie an einem geteilten iPad) Alwins Einstellungen an Spike weiter und schrieb sie in Spikes Datei.
 *
 * Übernimmt **einmal**, was S7-1 im Gerät gemerkt hat (Einteilung, Filter), und räumt es danach weg – sonst erbte die
 * nächste Person an diesem Gerät es auch.
 */
import { useCallback } from 'react';
import { leseImGeraet, merkeImGeraet } from '@ui/bedienung/geraet';
import { ablagePort } from '@ui/ct/ablagePort';
import {
  ABGLEICH_NACH_MS,
  spiegelImGeraet,
  useAblageSpiegel,
  type Abgleich,
} from '@ui/ct/useAblageSpiegel';
import { erstellePersonenAblage, type DatenDatei } from '@shared/ct/personenAblage';
import { pruefen, VORGABE, type ToDoEinstellungen } from './todoEinstellungen';

// Wie der Spiegel mit ChurchTools abgeglichen wird (Pause, Wiederholen, nie überschreiben), steht in `useAblageSpiegel` –
// seit L4-5 (Dienstplaner „Meine Anzeige“) für beide Apps derselbe Baustein.
export { ABGLEICH_NACH_MS };
export type { Abgleich };

/** Der Spiegel im Gerät – je Person. */
export const merkSchluessel = (person: number) => `protokolle.todos.einstellungen.${person}`;
const ALT_NACH = 'protokolle.todos.nach';
const ALT_AUS = 'protokolle.todos.aus';
/** Ein Test-Bau vom 30.10.2026 merkte ohne Person – nicht mehr lesen, nur wegräumen. */
const OHNE_PERSON = 'protokolle.todos.einstellungen';

function wegraeumen(schluessel: string): void {
  try {
    localStorage.removeItem(schluessel);
  } catch {
    // Kein Speicher (privater Modus) – dann gibt es auch nichts wegzuräumen.
  }
}

const ablage = erstellePersonenAblage({
  praefix: 'protokolle_',
  datenName: 'protokolle_einstellungen.json',
});

const inChurchTools: Abgleich = (lokal) => ablage.mischeEin(ablagePort, lokal);

const FELDER = Object.keys(VORGABE) as (keyof ToDoEinstellungen)[];

/** Aus dem Spiegel die geprüften Einstellungen. */
export function werteAus(s: DatenDatei): ToDoEinstellungen {
  const w = { ...VORGABE };
  for (const k of FELDER) {
    const f = s.felder[k];
    if (f) (w as Record<string, unknown>)[k] = pruefen[k](f.w);
  }
  return w;
}

function spiegelLesen(person: number): DatenDatei {
  const s = spiegelImGeraet(merkSchluessel(person));
  if (s) return s;
  // Einmal übernehmen, was S7-1 gemerkt hat – mit Zeitpunkt 0: Alles, was je anderswo gespeichert wurde, ist jünger.
  const felder: DatenDatei['felder'] = {};
  const nach = leseImGeraet<unknown>(ALT_NACH, null, (x) => x);
  const aus = leseImGeraet<unknown>(ALT_AUS, null, (x) => x);
  if (nach !== null) felder.nach = { w: nach, t: 0 };
  if (aus !== null) felder.aus = { w: aus, t: 0 };
  for (const k of [ALT_NACH, ALT_AUS, OHNE_PERSON]) wegraeumen(k);
  const neu: DatenDatei = { v: 1, felder };
  merkeImGeraet(merkSchluessel(person), neu);
  return neu;
}

export function useToDoEinstellungen(
  person: number,
  q: { jetzt?: () => number; abgleich?: Abgleich } = {},
) {
  const { spiegel, setzen: setzeFelder } = useAblageSpiegel({
    person,
    merkSchluessel,
    anfang: spiegelLesen,
    abgleich: q.abgleich ?? inChurchTools,
    jetzt: q.jetzt,
    warnung: 'Protokolle: Einstellungen bleiben vorerst im Gerät',
  });
  const setzen = useCallback(
    (teil: Partial<ToDoEinstellungen>) => setzeFelder(teil as Record<string, unknown>),
    [setzeFelder],
  );
  return [werteAus(spiegel), setzen] as const;
}
