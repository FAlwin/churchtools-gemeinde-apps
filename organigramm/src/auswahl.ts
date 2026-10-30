/**
 * **Was jede Person im Gerät gemerkt bekommt** (localStorage): welche Ansicht des Baums und der Präsentation sie
 * zuletzt gewählt hat (O7b) und ob Diagramm und Liste Personen zeigen (O7b-6). Die bis 30.10.2026 gemerkten
 * Gruppentypen (`organigramm-ausgeblendete-typen`) liest niemand mehr – sonst blieben sie ohne Schildchen unsichtbar.
 * Ohne Speicher (privates Fenster, gesperrt) gilt die Vorgabe; Lesen und Schreiben scheitern nie nach außen.
 */
import type { PersonenWahl } from '@shared/organigramm/personen';

const ANSICHT = 'organigramm-ansicht';
const PRAES_ANSICHT = 'organigramm-praesentation-ansicht';
const PERSONEN = 'organigramm-personen';

function lesen(schluessel: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(schluessel) ?? 'null') as unknown;
  } catch {
    return null;
  }
}

function merken(schluessel: string, wert: unknown): void {
  try {
    localStorage.setItem(schluessel, JSON.stringify(wert));
  } catch {
    // Ohne Speicher bleibt die Wahl bis zum Neuladen – mehr nicht.
  }
}

/** Die Ansichten des Reiters Organigramm (O7b): Karten wie bisher, die Liste und die drei Diagramme. */
export const BAUM_ANSICHTEN = ['karten', 'liste', 'oben', 'links', 'mindmap'] as const;
export type BaumAnsicht = (typeof BAUM_ANSICHTEN)[number];

/** Die zuletzt gewählte Ansicht – `null`, wenn noch keine gewählt ist (dann entscheidet die Bildschirmbreite). */
export function leseAnsicht(): BaumAnsicht | null {
  const roh = lesen(ANSICHT);
  return BAUM_ANSICHTEN.find((a) => a === roh) ?? null;
}

export function merkeAnsicht(ansicht: BaumAnsicht): void {
  merken(ANSICHT, ansicht);
}

/** Wie die Ansichten heißen – EINE Stelle für Reiter, PDF und Präsentation (vorher je eine eigene Liste). */
export const ANSICHT_NAMEN: Record<BaumAnsicht, string> = {
  karten: 'Karten',
  liste: 'Liste',
  oben: 'Von oben',
  links: 'Von links',
  mindmap: 'Mindmap',
};

/**
 * Die Ansichten der Präsentation (O7b-5): „Kacheln“ sind die Seiten aus O4 (Übersicht als Kacheln, Bereich mit den
 * Personen in Spalten), dazu dieselben Seiten als Diagramm.
 */
export const PRAES_ANSICHTEN = ['kacheln', 'oben', 'links', 'mindmap'] as const;
export type PraesAnsicht = (typeof PRAES_ANSICHTEN)[number];

/** Die zuletzt gewählte Ansicht der Präsentation – ohne Wahl die Kacheln (wie vor O7b-5). */
export function lesePraesAnsicht(): PraesAnsicht {
  const roh = lesen(PRAES_ANSICHT);
  return PRAES_ANSICHTEN.find((a) => a === roh) ?? 'kacheln';
}

export function merkePraesAnsicht(ansicht: PraesAnsicht): void {
  merken(PRAES_ANSICHT, ansicht);
}

/** „Personen: Aus · Rollen · Alle“ (O7b-6) – in dieser Reihenfolge, mit diesen Namen. */
export const PERSONEN_WAHL: { value: PersonenWahl; label: string }[] = [
  { value: 'aus', label: 'Aus' },
  { value: 'rollen', label: 'Rollen' },
  { value: 'alle', label: 'Alle' },
];

/** Ob Diagramm und Liste Personen zeigen – ohne Wahl „Aus“ (Alwin, 29.10.2026). */
export function lesePersonen(): PersonenWahl {
  const roh = lesen(PERSONEN);
  return PERSONEN_WAHL.find((w) => w.value === roh)?.value ?? 'aus';
}

export function merkePersonen(wahl: PersonenWahl): void {
  merken(PERSONEN, wahl);
}
