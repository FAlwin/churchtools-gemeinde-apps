/**
 * **Die Einstellungen der To-Do-Übersicht merken** (S7-3). Im Gerät liegt ein Spiegel im Format der Personen-Datei
 * (je Feld Wert + Zeitpunkt, `{ v: 1, felder }`) – so führt das Holen aus ChurchTools Feld für Feld zusammen: Die jüngere
 * Änderung gewinnt, auch wenn zwei Geräte geschrieben haben.
 *
 * Übernimmt einmal, was S7-1 im Gerät gemerkt hat (Einteilung, Filter).
 */
import { useCallback, useState } from 'react';
import { leseImGeraet, merkeImGeraet } from '@ui/bedienung/geraet';
import { pruefen, VORGABE, type ToDoEinstellungen } from './todoEinstellungen';

export const MERK = 'protokolle.todos.einstellungen';
const ALT_NACH = 'protokolle.todos.nach';
const ALT_AUS = 'protokolle.todos.aus';

type Feld = { w: unknown; t: number };
export interface Spiegel {
  v: 1;
  felder: Record<string, Feld>;
}

const FELDER = Object.keys(VORGABE) as (keyof ToDoEinstellungen)[];

/** Aus dem Spiegel die geprüften Einstellungen. */
export function werteAus(s: Spiegel): ToDoEinstellungen {
  const w = { ...VORGABE };
  for (const k of FELDER) {
    const f = s.felder[k];
    if (f) (w as Record<string, unknown>)[k] = pruefen[k](f.w);
  }
  return w;
}

function spiegelLesen(): Spiegel {
  const s = leseImGeraet<Spiegel | null>(MERK, null, (x) => {
    const o = x as Partial<Spiegel> | null;
    return o?.v === 1 && o.felder && typeof o.felder === 'object' ? (o as Spiegel) : null;
  });
  if (s) return s;
  // Einmal übernehmen, was S7-1 gemerkt hat – mit Zeitpunkt 0: Alles, was je anderswo gespeichert wurde, ist jünger.
  const felder: Record<string, Feld> = {};
  const nach = leseImGeraet<unknown>(ALT_NACH, null, (x) => x);
  const aus = leseImGeraet<unknown>(ALT_AUS, null, (x) => x);
  if (nach !== null) felder.nach = { w: nach, t: 0 };
  if (aus !== null) felder.aus = { w: aus, t: 0 };
  return { v: 1, felder };
}

export function useToDoEinstellungen(jetzt: () => number = Date.now) {
  const [spiegel, setSpiegel] = useState<Spiegel>(spiegelLesen);
  const setzen = useCallback(
    (teil: Partial<ToDoEinstellungen>) =>
      setSpiegel((alt) => {
        const t = jetzt();
        const felder = { ...alt.felder };
        for (const [k, w] of Object.entries(teil)) felder[k] = { w, t };
        const neu: Spiegel = { v: 1, felder };
        merkeImGeraet(MERK, neu);
        return neu;
      }),
    [jetzt],
  );
  return [werteAus(spiegel), setzen] as const;
}
