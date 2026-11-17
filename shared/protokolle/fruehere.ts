/**
 * **Frühere Treffen** (v1.0.1, Entwurf `fruehere-treffen-v1`) – Sitzungen, die schon stattgefunden haben und zu denen
 * es **noch kein Protokoll** gibt: der Block „Noch ohne Protokoll“ im Reiter „Sitzungen“ und das Fenster „Protokoll
 * nachtragen“ (Monat für Monat). „Kommend“ zeigt Termine und Treffen ohne Protokoll nur ab heute; für vergangene gab es
 * bisher keinen Weg, ein Protokoll zu beginnen (Techniker Treffen, So 15.11.2026).
 *
 * Die Regeln stehen hier einmal: **welcher Zeitraum** (`ohneProtokollZeitraum`, `monatsZeitraum`) und **was „ohne
 * Protokoll“ heißt** (`ohneProtokoll` – auf `sitzungenZusammenfuehren`, derselben Zuordnung wie „Kommend“ und
 * „Protokolle“; nichts nachgebaut). Gelesen wird in `protokolle/src/lesen.ts`.
 */
import { letzterTag, plusTage, tageBis } from '../ct/datum';
import { tagAusIso } from '../ct/zeit';
import type { ProtokollKopf } from './speicher';
import { sitzungenZusammenfuehren, type Sitzung, type Termin, type Treffen } from './sitzungen';

/** Gibt es noch kein freigegebenes Protokoll, schaut der Block so viele Tage zurück (Alwin, 17.11.2026). */
export const NOCH_OHNE_TAGE = 28;

export interface Zeitraum {
  /** Erster Tag, `JJJJ-MM-TT` (einschließlich). */
  von: string;
  /** Letzter Tag, `JJJJ-MM-TT` (einschließlich). */
  bis: string;
}

/**
 * **Welche Tage der Block „Noch ohne Protokoll“ ansieht:** seit dem **letzten freigegebenen Protokoll** der Gruppe
 * (dessen Tag zählt nicht mehr mit), gibt es keins: die letzten 28 Tage – **bis gestern**. Heute gehört schon zu
 * „Kommend“ (`sitzungenOrdnen`: ohne Protokoll ab heute), so steht keine Sitzung doppelt und keine fehlt.
 *
 * Ein freigegebenes Protokoll von heute oder aus der Zukunft (`Neues Protokoll` ohne Termin) zählt nicht als „das
 * letzte“ – sonst verschwände der Block, obwohl davor noch Treffen offen sind. `null`: nichts zu schauen. `letztes`: Tag
 * dieses Protokolls (für den Untertitel) – `null`, wenn es keins gibt.
 */
export function ohneProtokollZeitraum(q: {
  protokolle: readonly Pick<Sitzung, 'beginn' | 'kopf'>[];
  heute: string;
  zeitzone: string;
}): (Zeitraum & { letztes: string | null }) | null {
  const bis = plusTage(q.heute, -1);
  let letzter: string | null = null;
  for (const s of q.protokolle) {
    if (s.kopf?.status !== 'frei') continue;
    const tag = tagAusIso(s.beginn, q.zeitzone);
    if (tag >= q.heute) continue;
    if (letzter === null || tag > letzter) letzter = tag;
  }
  const von = letzter !== null ? plusTage(letzter, 1) : plusTage(q.heute, -NOCH_OHNE_TAGE);
  return von > bis ? null : { von, bis, letztes: letzter };
}

/**
 * **Welche Tage das Fenster für einen Monat ansieht** (`JJJJ-MM`): der ganze Monat, aber höchstens bis gestern.
 * `null`: der Monat liegt (noch) nicht vor gestern – etwa der 1. eines Monats für diesen Monat, oder die Zukunft.
 */
export function monatsZeitraum(monat: string, heute: string): Zeitraum | null {
  const von = `${monat}-01`;
  const bis = [letzterTag(monat), plusTage(heute, -1)].reduce((a, b) => (a < b ? a : b));
  return von > bis ? null : { von, bis };
}

/**
 * **Sitzungen ohne Protokoll im Zeitraum** – kein Protokoll-Kopf verweist auf den Termin oder das Treffen (egal, welchen
 * Status der Kopf hat: Entwurf, geplant, freigegeben), Ortstag in `[von, bis]`; neueste zuerst. Termin und Treffen zur
 * selben Minute sind **eine** Sitzung (die Zusammenführung der Liste).
 */
export function ohneProtokoll(q: {
  termine: readonly Termin[];
  treffen: readonly Treffen[];
  koepfe: readonly ProtokollKopf[];
  zeitraum: Zeitraum;
  zeitzone: string;
}): Sitzung[] {
  return sitzungenZusammenfuehren({
    termine: q.termine,
    treffen: q.treffen,
    koepfe: q.koepfe,
    serieImmer: true,
  })
    .filter((s) => {
      if (s.kopf) return false;
      const tag = tagAusIso(s.beginn, q.zeitzone);
      return tag >= q.zeitraum.von && tag <= q.zeitraum.bis;
    })
    .sort((a, b) => Date.parse(b.beginn) - Date.parse(a.beginn));
}

/** „vor 2 Tagen“ – in der Zeile des Blocks, ruhig und ohne Warnfarbe. `tag` und `heute`: `JJJJ-MM-TT`. */
export function vorZeit(tag: string, heute: string): string {
  const n = tageBis(tag, heute);
  if (n <= 0) return 'heute';
  if (n === 1) return 'gestern';
  if (n < 14) return `vor ${n} Tagen`;
  if (n < 60) return `vor ${Math.round(n / 7)} Wochen`;
  return `vor ${Math.round(n / 30)} Monaten`;
}
