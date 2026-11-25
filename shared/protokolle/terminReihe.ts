/**
 * **Die Einzeltermine einer Reihe** (W15-3, Reiter „Events“ im Fenster „In Kalender eintragen“) – so rechnet der
 * ChurchTools-Dialog „Termin erstellen“ aus Beginn, Wiederholung, „Weiteren Terminen“ und „Ausnahmen“ die Liste der
 * Termine, für die man ein Event anlegen kann. Ohne ChurchTools und ohne Oberfläche (Tests laufen mit `TZ=UTC` und
 * `TZ=Europe/Berlin`: gerechnet wird auf Kalendertagen in UTC, nie mit der Zeitzone des Geräts).
 *
 * - **Täglich / wöchentlich:** alle `frequenz` Tage bzw. Wochen ab dem Beginn bis „Bis“ (einschließlich).
 * - **Monatlich nach Datum / jährlich:** wie ChurchTools **Schritt für Schritt vom vorigen Termin** `frequenz` Monate bzw.
 *   Jahre weiter – gibt es den Tag nicht, läuft er in den Folgemonat über, und von DORT geht es weiter (gemessen 23.11.2026:
 *   31.01. → 03.03. → 03.04. → 03.05.; 29.02.2028 → 01.03.2029 → 01.03.2030 … → 01.03.2032, auch im Schaltjahr). Ein
 *   „Monat fällt aus“ gibt es bei ChurchTools nicht – sonst lehnte es die Events dieser Tage mit 422 ab.
 * - **Monatlich nach Wochentag:** der n-te Wochentag des Monats (1–5; der fünfte nur, wenn es ihn gibt), 6 = der letzte.
 *   Der Wochentag ist der des Beginns.
 * - **Manuell:** nur der Beginn und die weiteren Termine.
 * - Der Beginn selbst ist immer dabei (außer er ist eine Ausnahme); „Weitere Termine“ kommen dazu, „Ausnahmen“ fallen weg;
 *   sortiert, ohne Doppelte.
 *
 * Gemessen 23.11.2026: Bei „Monatlich nach Wochentag“ zählt ChurchTools den Beginn mit, auch wenn er nicht zur gewählten
 * Option passt (14.11.2026 = 2. Samstag, Option „1. Samstag“ → 14.11., 05.12., 02.01., 06.02.).
 */
import { utcAus } from '../ct/zeit';
import { istAutomatisch, ordinalAusDatum, WIEDERHOLUNG } from './terminWiederholung';

/** Mehr Zeilen zeigt der Reiter nicht (ChurchTools-Dialog: Schutz vor Jahrzehnten täglicher Termine). */
export const MAX_EINZELTERMINE = 200;

/** Die Grenze der Rechnerei selbst – bei „täglich“ über Jahrzehnte hört sie hier auf (dann gilt „abgeschnitten“). */
const MAX_KANDIDATEN = 20_000;

/** Was die Rechnung braucht – ein Ausschnitt von `Eintrag`. */
export interface Reihe {
  /** Beginn, `JJJJ-MM-TT`. */
  tag: string;
  art: number;
  frequenz: number;
  /** `repeatOption`: 1–5 oder 6 (letzter). */
  option: number;
  /** „Bis“, `JJJJ-MM-TT` – leer: nur der Beginn. */
  wiederBis: string;
  weitere: readonly string[];
  ausnahmen: readonly string[];
}

const TAG = /^(\d{4})-(\d{2})-(\d{2})$/;
const zwei = (n: number) => String(n).padStart(2, '0');
const tagText = (j: number, m: number, t: number) => `${j}-${zwei(m)}-${zwei(t)}`;
const tageImMonat = (j: number, m: number) => new Date(Date.UTC(j, m, 0)).getUTCDate();
const wochentag = (j: number, m: number, t: number) => new Date(Date.UTC(j, m - 1, t)).getUTCDay();

/** Der Tag im Monat, auf den „n-ter Wochentag“ fällt – `null`, wenn es den n-ten nicht gibt. 6 = der letzte. */
function wochentagImMonat(j: number, m: number, tagNr: number, n: number): number | null {
  const erster = 1 + ((tagNr - wochentag(j, m, 1) + 7) % 7);
  const dim = tageImMonat(j, m);
  if (n === 6) return erster + 7 * Math.floor((dim - erster) / 7);
  const t = erster + 7 * (n - 1);
  return t <= dim ? t : null;
}

/** Die Tage der automatischen Wiederholung ab dem Beginn bis „Bis“ – höchstens `MAX_KANDIDATEN`. */
function automatisch(r: Reihe): { tage: string[]; gekappt: boolean } {
  const m = TAG.exec(r.tag);
  const bis = TAG.test(r.wiederBis) ? r.wiederBis : r.tag;
  const f = Math.max(1, Math.floor(r.frequenz) || 1);
  if (!m) return { tage: [], gekappt: false };
  const [j0, m0, t0] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const tage: string[] = [];
  const dazu = (tag: string) => {
    if (tag >= r.tag && tag <= bis) tage.push(tag);
  };
  let gekappt = false;
  // Monatlich nach Datum / jährlich: der vorige Termin, von dem aus ChurchTools weiterzählt (mit Überlauf).
  let vorig = new Date(Date.UTC(j0, m0 - 1, t0));
  for (let i = 0; ; i++) {
    if (i >= MAX_KANDIDATEN) {
      gekappt = true;
      break;
    }
    if (r.art === WIEDERHOLUNG.taeglich || r.art === WIEDERHOLUNG.woechentlich) {
      const schritt = f * (r.art === WIEDERHOLUNG.woechentlich ? 7 : 1);
      const d = new Date(Date.UTC(j0, m0 - 1, t0 + i * schritt));
      const tag = tagText(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      if (tag > bis) break;
      dazu(tag);
    } else if (r.art === WIEDERHOLUNG.jaehrlich || r.art === WIEDERHOLUNG.monatlichDatum) {
      const d = vorig;
      const tag = tagText(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      if (tag > bis) break;
      dazu(tag);
      vorig =
        r.art === WIEDERHOLUNG.jaehrlich
          ? new Date(Date.UTC(d.getUTCFullYear() + f, d.getUTCMonth(), d.getUTCDate()))
          : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + f, d.getUTCDate()));
    } else {
      // Monatlich nach Wochentag: der i-te Schritt liegt `i * f` Monate nach dem Beginn.
      const idx = m0 - 1 + i * f;
      const j = j0 + Math.floor(idx / 12);
      const mo = (idx % 12) + 1;
      if (tagText(j, mo, 1) > bis) break;
      const n = r.option >= 1 && r.option <= 6 ? r.option : ordinalAusDatum(r.tag);
      const t = wochentagImMonat(j, mo, wochentag(j0, m0, t0), n);
      if (t !== null) dazu(tagText(j, mo, t));
    }
  }
  return { tage, gekappt };
}

/**
 * **Alle Einzeltermine der Reihe** als Tage `JJJJ-MM-TT`, sortiert, höchstens `MAX_EINZELTERMINE`; `abgeschnitten`, wenn es
 * mehr gäbe. Ohne Wiederholung genau der Beginn.
 */
export function einzeltermine(r: Reihe): { tage: string[]; abgeschnitten: boolean } {
  if (!TAG.test(r.tag)) return { tage: [], abgeschnitten: false };
  let tage: string[] = [r.tag];
  let gekappt = false;
  if (r.art !== WIEDERHOLUNG.keine) {
    if (istAutomatisch(r.art)) {
      const a = automatisch(r);
      tage = a.tage;
      gekappt = a.gekappt;
    }
    // Der Beginn gehört immer dazu; „Weitere Termine“ kommen dazu (mit derselben Uhrzeit).
    tage = [...tage, r.tag, ...r.weitere.filter((t) => TAG.test(t))];
    const weg = new Set(r.ausnahmen);
    tage = tage.filter((t) => !weg.has(t));
  }
  tage = [...new Set(tage)].sort();
  const abgeschnitten = gekappt || tage.length > MAX_EINZELTERMINE;
  return { tage: tage.slice(0, MAX_EINZELTERMINE), abgeschnitten };
}

/**
 * **Der exakte UTC-Beginn eines Einzeltermins** – so verlangt ihn ChurchTools als `startDate` eines Events (sonst 422:
 * „Datum passt nicht zur Reihe“). Ortszeit der Gemeinde → UTC mit Sommer-/Winterzeit des Tages selbst; ganztägig = 00:00
 * Ortszeit des Tages (10.02.2027 → `2027-02-09T23:00:00Z`, gemessen 23.11.2026).
 */
export function einzelterminBeginn(
  e: { ganztaegig: boolean; von: string },
  tag: string,
  zeitzone: string,
): string {
  return utcAus(`${tag}T${e.ganztaegig ? '00:00' : e.von}`, zeitzone);
}
