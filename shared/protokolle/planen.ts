/**
 * **Die nächste Sitzung festlegen** (Bauplan S5-2, Entwurf 7) – die Regeln ohne ChurchTools: womit das Fenster
 * vorbelegt ist, welcher Zeitraum daraus wird, wie der Kopf der geplanten Sitzung aussieht und welche Sitzung „die
 * nächste“ ist. Geschrieben wird in `protokolle/src/planen.ts`.
 *
 * Entschieden 28.10.2026 (Alwin): Kalendertermin mit Besprechungsanfrage + Gruppentreffen; eingeladen sind alle aktiven
 * Mitglieder (abwählbar); vorbelegt **wie die letzte Sitzung** (Datum, Uhrzeit, Dauer, Titel). Die außerordentliche
 * Sitzung („Neue Sitzung“) ist dasselbe Fenster.
 */
import { plusTage, tageBis } from '../ct/datum';
import { ortszeitAus, tagAusIso, utcAus } from '../ct/zeit';
import { neuerKopf, type BeginnSitzung } from './beginnen';
import { minute, type Sitzung } from './sitzungen';
import type { ProtokollKopf } from './speicher';

/** Was im Fenster steht: Titel, Tag (`JJJJ-MM-TT`), Uhrzeit (`HH:MM`) in Ortszeit der Gemeinde, Dauer in Minuten. */
export interface Planung {
  titel: string;
  tag: string;
  uhrzeit: string;
  dauer: number;
}

/** Ohne frühere Sitzung – oder wenn sie nichts dazu sagt. */
export const OHNE_VORBILD: Omit<Planung, 'tag'> = {
  titel: 'Sitzung',
  uhrzeit: '19:30',
  dauer: 120,
};
/** Abstand, wenn die letzten beiden Sitzungen keinen sinnvollen hergeben (vier Wochen wie im Entwurf 7). */
export const STANDARD_ABSTAND = 28;
/** Ein Abstand zwischen den letzten beiden Sitzungen gilt nur in diesem Rahmen (Tage) – sonst war eine außerordentlich. */
const ABSTAND_RAHMEN = { min: 7, max: 91 };

/** Sitzungen nach Beginn, früheste zuerst. */
const nachBeginn = <T extends Pick<Sitzung, 'beginn'>>(liste: readonly T[]): T[] =>
  [...liste].sort((a, b) => Date.parse(a.beginn) - Date.parse(b.beginn));

/**
 * **Die Vorbelegung** – wie die letzte Sitzung: deren Titel, Uhrzeit und Dauer (aus dem Termin, sonst zwei Stunden).
 * Der Tag liegt im selben Abstand wie zwischen den letzten beiden Sitzungen (7 bis 91 Tage, sonst vier Wochen), aber
 * frühestens morgen – so lange wird der Abstand weitergezählt.
 *
 * `bis` = die Sitzung, von der aus festgelegt wird (aus dem Protokoll): Nur sie und frühere zählen. Ohne `bis`
 * („Neue Sitzung“) zählen alle.
 */
export function vorbelegung(q: {
  sitzungen: readonly Pick<Sitzung, 'titel' | 'beginn' | 'ende'>[];
  bis?: Pick<Sitzung, 'beginn'> | null;
  heute: string;
  zeitzone: string;
}): Planung {
  const grenze = q.bis ? Date.parse(q.bis.beginn) : Infinity;
  const frueher = nachBeginn(q.sitzungen.filter((s) => Date.parse(s.beginn) <= grenze));
  const letzte = frueher.at(-1);
  if (!letzte) return { ...OHNE_VORBILD, tag: plusTage(q.heute, 7) };

  const tagVon = (s: Pick<Sitzung, 'beginn'>) => tagAusIso(s.beginn, q.zeitzone);
  const davor = frueher.at(-2);
  const abstand = davor ? tageBis(tagVon(davor), tagVon(letzte)) : STANDARD_ABSTAND;
  const schritt =
    abstand >= ABSTAND_RAHMEN.min && abstand <= ABSTAND_RAHMEN.max ? abstand : STANDARD_ABSTAND;
  let tag = plusTage(tagVon(letzte), schritt);
  while (tag <= q.heute) tag = plusTage(tag, schritt);

  const minuten = letzte.ende ? (Date.parse(letzte.ende) - Date.parse(letzte.beginn)) / 60_000 : 0;
  return {
    titel: letzte.titel.trim() || OHNE_VORBILD.titel,
    tag,
    uhrzeit: ortszeitAus(letzte.beginn, q.zeitzone).slice(11, 16),
    dauer: minuten > 0 ? Math.round(minuten) : OHNE_VORBILD.dauer,
  };
}

/** **Beginn und Ende für ChurchTools** (UTC) aus der Planung in Ortszeit der Gemeinde. */
export function zeitraum(p: Planung, zeitzone: string): { beginn: string; ende: string } {
  const beginn = utcAus(`${p.tag}T${p.uhrzeit}`, zeitzone);
  const ende = new Date(Date.parse(beginn) + p.dauer * 60_000).toISOString().replace('.000Z', 'Z');
  return { beginn, ende };
}

/** **Was am Fenster noch fehlt** – `null`, wenn festgelegt werden kann. */
export function planungFehler(p: Planung, zeitzone: string, jetzt: Date): string | null {
  if (!p.titel.trim()) return 'Bitte einen Titel angeben.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.tag) || !/^\d{2}:\d{2}$/.test(p.uhrzeit))
    return 'Bitte Datum und Uhrzeit angeben.';
  if (!(p.dauer > 0)) return 'Bitte eine Dauer wählen.';
  if (Date.parse(zeitraum(p, zeitzone).beginn) <= jetzt.getTime())
    return 'Die Sitzung muss in der Zukunft liegen.';
  return null;
}

/** **Gibt es zu diesem Beginn schon eine Sitzung?** – dann nicht noch einmal einladen (gleiche Minute wie `gehoertZu`). */
export function schonBelegt(
  sitzungen: readonly Pick<Sitzung, 'beginn'>[],
  beginn: string,
): boolean {
  return sitzungen.some((s) => minute(s.beginn) === minute(beginn));
}

/**
 * **Der Kopf einer geplanten Sitzung** – er verknüpft Termin und Gruppentreffen (in ChurchTools gibt es keine
 * Verknüpfung, gemessen 16.10.) und gibt der Sitzung eine eigene ID, bevor das Protokoll begonnen wird. Noch ohne
 * Dokument (`stand` leer); „Protokoll beginnen“ (S5-1) stellt ihn auf Entwurf um. Derselbe Aufbau wie `neuerKopf`.
 */
export function geplanterKopf(s: BeginnSitzung, sitzung: string): ProtokollKopf {
  return { ...neuerKopf(s, sitzung, ''), status: 'geplant' };
}

/** **Die nächste Sitzung nach dieser** – die früheste mit späterem Beginn (`null`: noch keine festgelegt). */
export function naechsteNach<T extends Pick<Sitzung, 'beginn'>>(
  s: Pick<Sitzung, 'beginn'>,
  alle: readonly T[],
): T | null {
  const ab = Date.parse(s.beginn);
  return nachBeginn(alle.filter((x) => Date.parse(x.beginn) > ab))[0] ?? null;
}
