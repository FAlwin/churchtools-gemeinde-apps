/**
 * **Rückblick und Schnitt des Live-Verlaufs** (Live-Ansicht 2, L4-4, Alwin 23.11.2026, A6/A8/A9/A18, T5): was nach dem Live
 * aus dem Verlauf eines Termins (`liveVerlauf.ts`) und aus den Verläufen aller bisherigen Termine zu zeigen ist. Auch hier
 * rechnet **nur diese Datei** (T8); die Anzeige zeigt nur.
 *
 *  - `terminBeendet`: Live ist zu Ende, wenn zuletzt der „Ende“-Wechsel stand (nicht, wenn danach wieder zurückgegangen wurde).
 *    Ohne Ende kennt man die Dauer des letzten Punkts nicht – dann gibt es keinen Rückblick und der Termin zählt auch
 *    nicht für den Schnitt (sonst verfälschte ein vergessenes „Ende“ ihn).
 *  - `rueckblickAus`: Beginn und Ende gegen den Plan, am meisten eingeholt/überzogen, je Punkt Plan / Gelaufen / ±. Die
 *    gelaufene Dauer ist dieselbe Rechnung wie beim ± in der Live-Ansicht (`gelaufenJePunkt` / `abweichungen`).
 *  - `schnittAus`: **Ø bisher** (T5) – beim Anzeigen aus allen Verläufen gerechnet, kein zweiter Speicher. Schlüssel ist
 *    der Punkt-Titel, **alle Lieder zählen zusammen als „Lied“**. Es zählen nur Termine mit Ende, ohne die aus dem Schnitt
 *    genommenen (ganzer Termin oder einzelner Punkt, A9) und nur Punkte, deren Titel im Verlauf steht (bei Überlänge
 *    entfallen die Titel, `liveVerlaufSpeicher.ts`).
 */
import { endeStelle, planEnde, type LivePunkt } from './liveAgenda';
import {
  abweichungen,
  ausgenommen,
  gelaufenJePunkt,
  laeufeAus,
  type Ausnahme,
  type Lauf,
  type Wechsel,
} from './liveVerlauf';

/** Der Verlauf eines Termins samt Markierungen, wie der Speicher ihn liefert. */
export interface VerlaufTermin {
  wechsel: readonly Wechsel[];
  ausnahmen: readonly Ausnahme[];
}

/** Ist Live zu Ende? Zuletzt steht der Lauf „Ende“ (Stelle ≥ 1 ohne Punkt) und ist noch offen. */
export function terminBeendet(laeufe: readonly Lauf[]): boolean {
  const l = laeufe[laeufe.length - 1];
  return !!l && l.stelle >= 1 && l.punktId === null && l.bis === null;
}

/**
 * Der Schlüssel, unter dem ein Punkt im Schnitt zählt: alle Lieder gemeinsam (`lied`), sonst der Titel (ohne Groß-/Klein-
 * schreibung und Randleerzeichen). `null` ohne Titel – so ein Punkt zählt nicht.
 */
export function schnittSchluessel(titel: string, lied: boolean): string | null {
  if (lied) return 'lied';
  const t = titel.trim().toLocaleLowerCase('de');
  return t === '' ? null : `titel:${t}`;
}

export interface SchnittWert {
  /** Durchschnitt in Sekunden (gerundet). */
  sek: number;
  /** Aus wie vielen Terminen. */
  n: number;
}
export type Schnitt = ReadonlyMap<string, SchnittWert>;

/** **Ø bisher** aus allen Verläufen (T5) – siehe Dateikopf. */
export function schnittAus(verlaeufe: Iterable<VerlaufTermin>): Schnitt {
  const summe = new Map<string, { ms: number; n: number }>();
  for (const v of verlaeufe) {
    const aus = ausgenommen(v.ausnahmen);
    if (aus.termin) continue;
    const { laeufe } = laeufeAus(v.wechsel);
    if (!terminBeendet(laeufe)) continue;
    const gelaufen = gelaufenJePunkt(laeufe, 0);
    const erster = new Map<number, Lauf>();
    for (const l of laeufe) {
      if (l.punktId !== null && !erster.has(l.punktId)) erster.set(l.punktId, l);
    }
    for (const [id, g] of gelaufen) {
      const l = erster.get(id);
      if (!l || aus.punkte.has(id) || l.titel === '') continue;
      const schluessel = schnittSchluessel(l.titel, l.lied);
      if (schluessel === null) continue;
      const alt = summe.get(schluessel) ?? { ms: 0, n: 0 };
      summe.set(schluessel, { ms: alt.ms + g.ms, n: alt.n + 1 });
    }
  }
  return new Map(
    [...summe].map(([k, v]) => [k, { sek: Math.round(v.ms / v.n / 1000), n: v.n }] as const),
  );
}

export interface RueckblickZeile {
  punkt: LivePunkt;
  /** Geplante Dauer (Sekunden); `null` bei einem Lied ohne Dauer. */
  planSek: number | null;
  gelaufenSek: number;
  /** ±: geplant minus gelaufen (+ gespart, − überzogen); `null` ohne Plan-Zeit. */
  abweichungSek: number | null;
  /** Aus dem Schnitt genommen (A9) – die Zeile bleibt stehen, zählt aber nicht für Ø und die größten Abweichungen. */
  ausgenommen: boolean;
}

export interface Rueckblick {
  /** Beginn des Live (erster Punkt nach dem Vorlauf), ± = Plan-Beginn minus tatsächlicher Beginn (+ früher, − später). */
  beginn: { zeit: number; abweichungSek: number | null } | null;
  /** Das „Ende“ von Live, ± wie beim Beginn gegen das Plan-Ende. */
  ende: { zeit: number; abweichungSek: number | null };
  /** Am meisten eingeholt (größtes Plus) bzw. überzogen (größtes Minus) – nur Punkte, die im Schnitt zählen. */
  eingeholt: { punkt: LivePunkt; sek: number } | null;
  ueberzogen: { punkt: LivePunkt; sek: number } | null;
  /** Alle Punkte, die gelaufen sind, in der Reihenfolge des Ablaufs. */
  zeilen: RueckblickZeile[];
  /** Der ganze Termin ist aus dem Schnitt genommen. */
  terminAusgenommen: boolean;
}

const sekunden = (ms: number) => Math.round(ms / 1000) + 0; // `+ 0`: kein „−0“

/** **Der Rückblick** eines Termins – `null`, solange Live nicht zu Ende ist. */
export function rueckblickAus(
  liste: readonly LivePunkt[],
  verlauf: VerlaufTermin,
): Rueckblick | null {
  const { laeufe } = laeufeAus(verlauf.wechsel);
  if (!terminBeendet(laeufe)) return null;
  const endeLauf = laeufe[laeufe.length - 1];
  const aus = ausgenommen(verlauf.ausnahmen);
  const gelaufen = gelaufenJePunkt(laeufe, endeLauf.seit);
  const plusminus = abweichungen(liste, laeufe, endeLauf.seit, endeStelle(liste));
  const zeilen: RueckblickZeile[] = liste.flatMap((punkt) => {
    const g = gelaufen.get(punkt.id);
    if (!g) return [];
    return [
      {
        punkt,
        planSek: punkt.liedOhneDauer ? null : punkt.dauerSek,
        gelaufenSek: Math.round(g.ms / 1000),
        abweichungSek: plusminus.get(punkt.id)?.sek ?? null,
        ausgenommen: aus.punkte.has(punkt.id),
      },
    ];
  });
  const zaehlt = zeilen.filter((z) => !z.ausgenommen && z.abweichungSek !== null);
  const groesste = (vorzeichen: 1 | -1) =>
    zaehlt
      .filter((z) => z.abweichungSek! * vorzeichen > 0)
      .reduce<RueckblickZeile | null>(
        (best, z) =>
          !best || Math.abs(z.abweichungSek!) > Math.abs(best.abweichungSek!) ? z : best,
        null,
      );
  const mit = (z: RueckblickZeile | null) => (z ? { punkt: z.punkt, sek: z.abweichungSek! } : null);
  // Beginn: der erste gelaufene Punkt nach dem Vorlauf (Soundcheck, Countdown …), sonst der erste überhaupt.
  const punktLaeufe = laeufe.filter((l) => l.punktId !== null);
  const vonListe = (l: Lauf) => liste.find((p) => p.id === l.punktId);
  const ersterLauf = punktLaeufe.find((l) => vonListe(l)?.vorBeginn === false) ?? punktLaeufe[0];
  const ersterPlan = ersterLauf ? (vonListe(ersterLauf)?.planBeginn ?? null) : null;
  const plan = planEnde(liste);
  return {
    beginn: ersterLauf
      ? {
          zeit: ersterLauf.seit,
          abweichungSek: ersterPlan === null ? null : sekunden(ersterPlan - ersterLauf.seit),
        }
      : null,
    ende: {
      zeit: endeLauf.seit,
      abweichungSek: plan === null ? null : sekunden(plan - endeLauf.seit),
    },
    eingeholt: mit(groesste(1)),
    ueberzogen: mit(groesste(-1)),
    zeilen,
    terminAusgenommen: aus.termin,
  };
}
