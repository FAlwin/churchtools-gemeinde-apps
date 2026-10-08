/**
 * **Die Lied-Statistik aus ChurchTools selbst** – wie oft und wann ein Lied gespielt wurde. Für beide
 * Auslieferungen (Alwin, 08.10.2026: „Beides bitte mit der ChurchTools-Statistik bauen. Unsere weg.").
 *
 * Bis dahin las der Server für jeden Termin der letzten vier Jahre den Ablauf (~250 Anfragen je Lauf,
 * der Auslöser von #300); in der Erweiterung gab es die Statistik deshalb gar nicht. ChurchTools führt
 * dieselbe Statistik selbst – die eigene Oberfläche lädt sie mit EINEM Aufruf der alten Schnittstelle:
 * `func=getSongStatistic`, ohne Parameter (gefunden in `cs_loadandmap.js`, gemessen 08.10.2026).
 *
 * Antwort: je **Arrangement-ID** die Termine, an denen es gespielt wurde –
 * `{ "1": [{ "date": "2026-08-09 11:00:00", "category_id": "2" }] }`, die Zeit in der Ortszeit der
 * Gemeinde. Zum Lied kommt man über die Liederliste, die die Arrangements ohnehin mitbringt.
 *
 * **Abgeglichen mit echten Daten (ECG, 08.10.2026):** 62 von 64 Liedern identisch mit der alten
 * Zählung. Die zwei Abweichungen lagen an einem Tag mit zwei Gottesdiensten (28.06.2026) – dort zählt
 * ChurchTools je einen Einsatz weniger. Von Alwin so hingenommen.
 *
 * **Recht:** `view song statistics` (Bereich Events) – je Person, denn gefragt wird mit ihrer Sitzung.
 */
import type { AjaxMeldungen, AltPort } from './altSchnittstelle';
import { tagAusIso } from './zeit';

/** Die Spieltage eines Lieds (`YYYY-MM-DD`), absteigend – der neueste zuerst. */
export interface LiedNutzung {
  dates: string[];
}

export const STATISTIK_MELDUNGEN: AjaxMeldungen = {
  verweigert:
    'Keine Berechtigung für die Lied-Statistik in ChurchTools (Recht „Song-Statistik sehen").',
  abgelehnt: 'ChurchTools hat die Lied-Statistik abgelehnt',
  unlesbar: 'ChurchTools lieferte keine lesbare Lied-Statistik.',
  fehlgeschlagen: 'Die Lied-Statistik konnte nicht geladen werden.',
};

/** Was die Liederliste je Lied mitbringt – nur die Arrangement-IDs werden gebraucht. */
interface LiedMitArrangements {
  id: number;
  arrangements?: { id: number }[] | null;
}

/**
 * Aus der Rohantwort die Spieltage je Lied – **nur bis heute** (geplante Termine sind nicht „gespielt",
 * wie bisher). Einen Rückblick-Zeitraum gibt es nicht mehr: ChurchTools liefert die ganze Geschichte
 * in einem Aufruf, die vier Jahre waren nur eine Bremse für den alten Lauf.
 *
 * Arrangements, die zu keinem Lied der Liste gehören (gelöscht, oder ein Lied, das die Person nicht
 * sehen darf), fallen weg.
 */
export function nutzungAus(
  roh: unknown,
  lieder: LiedMitArrangements[],
  heute: string,
  zeitzone: string,
): Record<number, LiedNutzung> {
  const arrZuLied = new Map<string, number>();
  for (const l of lieder) for (const a of l.arrangements ?? []) arrZuLied.set(String(a.id), l.id);
  const out: Record<number, LiedNutzung> = {};
  if (!roh || typeof roh !== 'object') return out;
  for (const [arr, eintraege] of Object.entries(roh as Record<string, unknown>)) {
    const lied = arrZuLied.get(arr);
    if (lied === undefined || !Array.isArray(eintraege)) continue;
    for (const e of eintraege as { date?: unknown }[]) {
      if (typeof e?.date !== 'string' || e.date === '') continue;
      const tag = tagAusIso(e.date, zeitzone);
      if (tag > heute) continue;
      (out[lied] ??= { dates: [] }).dates.push(tag);
    }
  }
  for (const n of Object.values(out)) n.dates.sort((a, b) => b.localeCompare(a));
  return out;
}

/** Die Statistik holen – EIN Aufruf – und auswerten. */
export async function liedStatistik(
  p: AltPort,
  lieder: LiedMitArrangements[],
  zeitzone: string,
  jetzt: Date = new Date(),
): Promise<Record<number, LiedNutzung>> {
  const roh = await p.anfrage('getSongStatistic', {}, STATISTIK_MELDUNGEN);
  return nutzungAus(roh, lieder, tagAusIso(jetzt.toISOString(), zeitzone), zeitzone);
}
