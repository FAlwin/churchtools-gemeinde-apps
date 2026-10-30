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
import { useCallback, useEffect, useRef, useState } from 'react';
import { leseImGeraet, merkeImGeraet } from '@ui/bedienung/geraet';
import { ablagePort } from '@ui/ct/ablagePort';
import { erstellePersonenAblage, mische, type DatenDatei } from '@shared/ct/personenAblage';
import { pruefen, VORGABE, type ToDoEinstellungen } from './todoEinstellungen';

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
/** Wie lange nach der letzten Änderung gewartet wird, bevor sie nach ChurchTools geht (Ziehen erzeugt viele). */
export const ABGLEICH_NACH_MS = 1500;

const ablage = erstellePersonenAblage({
  praefix: 'protokolle_',
  datenName: 'protokolle_einstellungen.json',
});

/** Der Weg nach ChurchTools – austauschbar für Tests. */
export type Abgleich = (lokal: DatenDatei) => Promise<DatenDatei>;
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
  const s = leseImGeraet<DatenDatei | null>(merkSchluessel(person), null, (x) => {
    const o = x as Partial<DatenDatei> | null;
    return o?.v === 1 && o.felder && typeof o.felder === 'object' ? (o as DatenDatei) : null;
  });
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

const gleich = (a: DatenDatei, b: DatenDatei) => JSON.stringify(a) === JSON.stringify(b);

export function useToDoEinstellungen(
  person: number,
  q: { jetzt?: () => number; abgleich?: Abgleich } = {},
) {
  const jetzt = q.jetzt ?? Date.now;
  const abgleich = q.abgleich ?? inChurchTools;
  const [spiegel, setSpiegel] = useState<DatenDatei>(() => spiegelLesen(person));
  const aktuell = useRef(spiegel);
  const laeuft = useRef(false);
  const nochmal = useRef(false);
  const uhr = useRef<ReturnType<typeof setTimeout> | null>(null);

  const uebernehmen = useCallback(
    (neu: DatenDatei) => {
      aktuell.current = neu;
      merkeImGeraet(merkSchluessel(person), neu);
      setSpiegel(neu);
    },
    [person],
  );

  /** Einen Abgleich anstoßen – läuft schon einer, danach noch einmal (was inzwischen geändert wurde, fehlt ihm). */
  const abgleichen = useCallback(() => {
    if (uhr.current) clearTimeout(uhr.current);
    uhr.current = null;
    if (laeuft.current) {
      nochmal.current = true;
      return;
    }
    laeuft.current = true;
    const gesendet = aktuell.current;
    abgleich(gesendet)
      .then(
        (dort) => {
          // Was während des Abgleichs im Gerät geändert wurde, ist jünger – es bleibt und geht beim nächsten Mal mit.
          const neu = mische(dort, aktuell.current);
          if (!gleich(aktuell.current, gesendet)) nochmal.current = true;
          if (!gleich(neu, aktuell.current)) uebernehmen(neu);
        },
        (e: unknown) => console.warn('Protokolle: Einstellungen bleiben vorerst im Gerät', e),
      )
      .finally(() => {
        laeuft.current = false;
        if (nochmal.current) {
          nochmal.current = false;
          abgleichen();
        }
      });
  }, [abgleich, uebernehmen]);

  // Beim Öffnen holen; beim Weglegen der Seite und wenn das Netz zurückkommt, sofort abgleichen.
  useEffect(() => {
    abgleichen();
    const weg = () => {
      if (document.visibilityState === 'hidden' && uhr.current) abgleichen();
    };
    document.addEventListener('visibilitychange', weg);
    window.addEventListener('online', abgleichen);
    return () => {
      document.removeEventListener('visibilitychange', weg);
      window.removeEventListener('online', abgleichen);
      if (uhr.current) clearTimeout(uhr.current);
    };
  }, [abgleichen]);

  const setzen = useCallback(
    (teil: Partial<ToDoEinstellungen>) => {
      const t = jetzt();
      const felder = { ...aktuell.current.felder };
      for (const [k, w] of Object.entries(teil)) felder[k] = { w, t };
      uebernehmen({ v: 1, felder });
      if (uhr.current) clearTimeout(uhr.current);
      uhr.current = setTimeout(abgleichen, ABGLEICH_NACH_MS);
    },
    [jetzt, uebernehmen, abgleichen],
  );

  return [werteAus(spiegel), setzen] as const;
}
