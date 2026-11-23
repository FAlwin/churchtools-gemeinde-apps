/**
 * **Der Live-Verlauf eines Termins – die Rechnung dazu** (Live-Ansicht 2, L4-3, Alwin 23.11.2026, A14/A19, T4/T8/T9).
 * ChurchTools führt nur die aktuelle Stelle und den letzten Wechsel; für Plus/Minus je Punkt, die Prognose und den
 * Rückblick hält die Erweiterung die Wechsel selbst fest (`Wechsel`, gespeichert in `shared/dienstplan/liveVerlaufSpeicher.ts`).
 * **Alles, was daraus gerechnet wird, steht in dieser Datei** (T8) – die Anzeige rechnet nichts nach:
 *  - `zusammenfuehren`: zwei Stände des Verlaufs zu einem (gleicher Zeitpunkt + Stelle = derselbe Wechsel, kein Doppel).
 *  - `laeufeAus`: aus den Wechseln die **wirksamen Läufe** – mit der **Fehlklick-Regel** (A19): Kommt man auf einen Punkt
 *    zurück und war alles dazwischen kürzer als 30 Sekunden dran, läuft der Punkt mit seiner alten Zeit weiter, die kurzen
 *    Stopps zählen nicht (sie stehen unter `uebersprungen`, für den Rückblick L4-4). Die Regel wird **abgeleitet**, nicht
 *    gespeichert: Jedes Gerät rechnet aus denselben Wechseln dasselbe.
 *  - `wirksamerStand`: der Live-Stand von ChurchTools mit dem **wirksamen** Beginn und der **wirksamen** Zusatzzeit.
 *  - `abweichungen`, `warumPunkte`, `prognose`: ± je Punkt, die drei größten Abweichungen, „Ende voraussichtlich“.
 *  - `wechselBeiKlick`, `nachzutragen`: die Wechsel, die ein Klick bzw. ein offenes Gerät festhält.
 *
 * **Fehlklick und ChurchTools:** CT setzt `switchdate` bei jedem Wechsel neu, zurückschreiben geht nicht. Damit CT-App und
 * CT-Web dieselbe Restzeit zeigen, gleicht das klickende Gerät sie über `addseconds` aus (gemessen L4-0: nimmt Sekunden;
 * `switchdate` bleibt dabei): `ausgleich = alte Zusatzzeit − schon gelaufene Sekunden`. Der Ausgleich steht im Wechsel
 * (`ausgleich`), damit auch Geräte, die nur lesen, die logische Zusatzzeit (±1 Min) richtig herausrechnen.
 */
import { planEnde, type LivePunkt, type LiveStand } from './liveAgenda';

/** Kürzer als so lange dran = Fehlklick (A19). Genau 30 Sekunden zählen schon als gelaufen. */
export const FEHLKLICK_MS = 30_000;

/** Ein Wechsel der Live-Agenda: ab `zeit` war `stelle` dran. */
export interface Wechsel {
  /** `pos_id` danach: 0 = nicht gestartet, 1…n = der Punkt an dieser Stelle, n + 1 = Ende. */
  stelle: number;
  /** ID des Punkts (`null` bei „nicht gestartet“ und „Ende“). Bleibt auch richtig, wenn sich der Ablauf später ändert. */
  punktId: number | null;
  titel: string;
  /** `switchdate` (ms, Uhr von ChurchTools). */
  zeit: number;
  /** Zusatzzeit (Sekunden), die der verlassene Punkt beim Verlassen hatte – nötig, um ihn nach einem Fehlklick fortzusetzen. */
  zusatzDavor?: number;
  /** `addseconds`, auf das das klickende Gerät nach einer Fehlklick-Rückkehr ausgeglichen hat (sonst fehlt es). */
  ausgleich?: number;
  /** „Neu starten“: der Wechsel zählt als normaler Wechsel, auch wenn die Fehlklick-Regel zuträfe. */
  neu?: true;
}

const schluessel = (w: Pick<Wechsel, 'zeit' | 'stelle'>) => `${w.zeit}:${w.stelle}`;

/** Gibt es zu diesem Zeitpunkt und dieser Stelle schon einen Wechsel? */
export const hatWechsel = (verlauf: readonly Wechsel[], zeit: number, stelle: number): boolean =>
  verlauf.some((w) => w.zeit === zeit && w.stelle === stelle);

/**
 * **Zwei Stände des Verlaufs zu einem** – nach Zeit sortiert. Derselbe Wechsel (gleiche Zeit UND Stelle) steht nur einmal da:
 * Felder, die nur eine Seite kennt, bleiben erhalten, bei beiden gewinnt `b` (der neuere Stand); „neu“ geht nie wieder
 * verloren. So verlieren sich zwei Geräte, die gleichzeitig schreiben, nichts – sie führen zusammen, nicht ersetzen.
 */
export function zusammenfuehren(a: readonly Wechsel[], b: readonly Wechsel[]): Wechsel[] {
  const karte = new Map<string, Wechsel>();
  for (const w of [...a, ...b]) {
    const da = karte.get(schluessel(w));
    if (!da) {
      karte.set(schluessel(w), { ...w });
      continue;
    }
    const neu: Wechsel = { ...da };
    if (w.titel !== '') neu.titel = w.titel;
    if (w.punktId !== null) neu.punktId = w.punktId;
    if (w.zusatzDavor !== undefined) neu.zusatzDavor = w.zusatzDavor;
    if (w.ausgleich !== undefined) neu.ausgleich = w.ausgleich;
    if (w.neu === true) neu.neu = true;
    karte.set(schluessel(w), neu);
  }
  return [...karte.values()].sort((x, y) => x.zeit - y.zeit || x.stelle - y.stelle);
}

/** Steckt alles, was in `neue` steht, in `verlauf` (gleicher Wechsel, alle gesetzten Felder gleich bzw. „neu“ gesetzt)? */
export function enthaelt(verlauf: readonly Wechsel[], neue: readonly Wechsel[]): boolean {
  return neue.every((n) => {
    const w = verlauf.find((x) => schluessel(x) === schluessel(n));
    if (!w) return false;
    if (n.zusatzDavor !== undefined && w.zusatzDavor !== n.zusatzDavor) return false;
    if (n.ausgleich !== undefined && w.ausgleich !== n.ausgleich) return false;
    return n.neu !== true || w.neu === true;
  });
}

// ── Läufe und die Fehlklick-Regel ────────────────────────────────────────────

/** Ein wirksamer Lauf: ein Punkt, der dran war – bei einem Fehlklick vom ersten Beginn an gerechnet. */
export interface Lauf {
  stelle: number;
  punktId: number | null;
  titel: string;
  /** Wirksamer Beginn (ms) – nach einer Fehlklick-Rückkehr der frühere. */
  seit: number;
  /** Wirksames Ende (ms); `null`, solange er läuft. */
  bis: number | null;
  /** Der Wechsel, der den Lauf zuletzt geöffnet hat (`switchdate`) – so erkennt man, ob der Lauf zum Stand von CT gehört. */
  oeffnung: number;
  /** Zuletzt durch eine Fehlklick-Rückkehr geöffnet. */
  fortgesetzt: boolean;
  /** Zusatzzeit beim letzten Verlassen (Sekunden). */
  zusatzSek: number;
  /** `addseconds` direkt nach der Fehlklick-Rückkehr (Ausgleich), sonst 0. */
  ausgleich: number;
  /** Alle Wechsel, die diesen Lauf geöffnet oder fortgesetzt haben. */
  wechsel: Wechsel[];
}

export interface Laeufe {
  laeufe: Lauf[];
  /** Die Wechsel der kurzen Stopps, die nach der Fehlklick-Regel nicht zählen (für den Rückblick „übersprungen“). */
  uebersprungen: Wechsel[];
}

const dauerMs = (l: Lauf) => (l.bis ?? l.seit) - l.seit;

/**
 * **Die wirksamen Läufe** – aus den Wechseln, nach Zeit sortiert. Ein Wechsel auf Stelle `t` ist eine **Fortsetzung**
 * (Fehlklick, A19), wenn davor schon ein Lauf auf `t` war und **jeder Lauf dazwischen** (auch der gerade verlassene) kürzer
 * als `FEHLKLICK_MS` dran war – es sei denn, der Wechsel trägt `neu` („Neu starten“). Dann läuft der alte Lauf weiter (sein
 * Beginn bleibt, die Zeit dazwischen gehört ihm), die Läufe dazwischen entfallen. Gilt für Weiter→Zurück, Zurück→Weiter und
 * mehrere Schritte; ab 30 Sekunden ist es ein normaler Wechsel. Nur Stellen ab 1 (Punkte und „Ende“) können fortgesetzt
 * werden, nicht „nicht gestartet“.
 */
export function laeufeAus(verlauf: readonly Wechsel[]): Laeufe {
  const laeufe: Lauf[] = [];
  const uebersprungen: Wechsel[] = [];
  const sortiert = [...verlauf].sort((x, y) => x.zeit - y.zeit || x.stelle - y.stelle);
  for (const w of sortiert) {
    const letzter = laeufe[laeufe.length - 1];
    if (letzter) {
      letzter.bis = w.zeit;
      if (w.zusatzDavor !== undefined) letzter.zusatzSek = w.zusatzDavor;
    }
    let k = -1;
    if (w.neu !== true && w.stelle >= 1) {
      for (let j = laeufe.length - 1; j >= 0; j--) {
        const l = laeufe[j];
        if (j < laeufe.length - 1 && l.stelle === w.stelle) {
          k = j;
          break;
        }
        if (dauerMs(l) >= FEHLKLICK_MS) break;
      }
    }
    if (k >= 0) {
      for (const weg of laeufe.splice(k + 1)) uebersprungen.push(...weg.wechsel);
      const l = laeufe[k];
      l.bis = null;
      l.oeffnung = w.zeit;
      l.fortgesetzt = true;
      l.ausgleich = w.ausgleich ?? 0;
      l.wechsel.push(w);
    } else {
      laeufe.push({
        stelle: w.stelle,
        punktId: w.punktId,
        titel: w.titel,
        seit: w.zeit,
        bis: null,
        oeffnung: w.zeit,
        fortgesetzt: false,
        zusatzSek: 0,
        ausgleich: 0,
        wechsel: [w],
      });
    }
  }
  return { laeufe, uebersprungen };
}

/**
 * **Der Live-Stand mit wirksamem Beginn und wirksamer Zusatzzeit.** Gehört der Stand von ChurchTools zu einem Lauf, der durch
 * einen Fehlklick fortgesetzt wurde, gilt der frühere Beginn und die Zusatzzeit von damals (plus das, was seither mit
 * „−1 / +1 Min“ dazukam – der Ausgleich in `addseconds` ist herausgerechnet). Sonst bleibt der Stand, wie er ist.
 * Mit diesem Stand rechnet die Anzeige alles (`liveLage` samt Zeitkonto) – ChurchTools bleibt die Quelle für Stelle und Uhr.
 */
export function wirksamerStand(stand: LiveStand | null, laeufe: readonly Lauf[]): LiveStand | null {
  if (!stand || stand.stelle === null || stand.seit === null) return stand;
  const l = laeufe[laeufe.length - 1];
  if (!l || l.bis !== null || !l.fortgesetzt) return stand;
  if (l.stelle !== stand.stelle || l.oeffnung !== stand.seit) return stand;
  return { ...stand, seit: l.seit, zusatzSek: l.zusatzSek + (stand.zusatzSek - l.ausgleich) };
}

// ── Plus/Minus, Prognose, „Warum“ ────────────────────────────────────────────

/** Plus/Minus eines Punkts: geplante minus gelaufene Dauer (Sekunden; + gespart, − überzogen). */
export interface Abweichung {
  sek: number;
  /** Der Punkt läuft gerade (nur im „Warum“, wenn er überzieht – in der Liste zeigt nur Erledigtes sein ±). */
  laeuft: boolean;
}

/**
 * **± je Punkt** (A14): geplante Dauer (ursprünglicher Plan, `addseconds` zählt nie mit – A13) minus gelaufene Dauer, über
 * alle wirksamen Läufe dieses Punkts. Ein Fehlklick-Lauf zählt vom ersten Beginn an, die kurzen Stopps dazwischen gar nicht.
 * Schlüssel ist die Punkt-ID. Weggelassene Punkte und Lieder ohne Dauer haben keine Plan-Zeit und kein ±. `jetzt` = Uhr
 * von ChurchTools; der laufende Punkt kommt nur vor, wenn er überzieht (dann mit `laeuft`).
 */
export function abweichungen(
  liste: readonly LivePunkt[],
  laeufe: readonly Lauf[],
  jetzt: number,
): Map<number, Abweichung> {
  const gelaufen = new Map<number, { ms: number; laeuft: boolean }>();
  for (const l of laeufe) {
    if (l.punktId === null) continue;
    const bis = l.bis ?? jetzt;
    const alt = gelaufen.get(l.punktId) ?? { ms: 0, laeuft: false };
    gelaufen.set(l.punktId, {
      ms: alt.ms + Math.max(0, bis - l.seit),
      laeuft: alt.laeuft || l.bis === null,
    });
  }
  const aus = new Map<number, Abweichung>();
  for (const p of liste) {
    const g = gelaufen.get(p.id);
    if (!g || p.weggelassen || p.liedOhneDauer) continue;
    const sek = Math.round(p.dauerSek - g.ms / 1000) + 0; // `+ 0`: kein „−0“
    // Ein laufender Punkt gehört erst dazu, wenn er überzieht – vorher gibt es nichts zu verbuchen.
    if (g.laeuft && sek >= 0) continue;
    aus.set(p.id, { sek, laeuft: g.laeuft });
  }
  return aus;
}

/** **„Warum“** (A14): die (höchstens) drei Punkte mit der größten Abweichung, Plus oder Minus; bei Gleichstand der frühere. */
export function warumPunkte(
  liste: readonly LivePunkt[],
  abweichung: ReadonlyMap<number, Abweichung>,
  anzahl = 3,
): { punkt: LivePunkt; sek: number }[] {
  return liste
    .flatMap((punkt, i) => {
      const a = abweichung.get(punkt.id);
      return a && a.sek !== 0 ? [{ punkt, sek: a.sek, i }] : [];
    })
    .sort((x, y) => Math.abs(y.sek) - Math.abs(x.sek) || x.i - y.i)
    .slice(0, anzahl)
    .map(({ punkt, sek }) => ({ punkt, sek }));
}

/**
 * **„Ende voraussichtlich“** (A14): Plan-Ende minus Zeitkonto – „wenn der Rest nach Plan läuft“. Auf die Minute gerundet
 * (wie die Uhrzeiten im Ablauf). `null` ohne Konto oder ohne Plan-Zeit.
 */
export function prognose(
  liste: readonly LivePunkt[],
  konto: number | null,
): { ende: number; plan: number; konto: number } | null {
  const plan = planEnde(liste);
  if (plan === null || konto === null) return null;
  const minute = (ms: number) => Math.round(ms / 60_000) * 60_000;
  return { ende: minute(plan - konto * 1000), plan: minute(plan), konto };
}

// ── Festhalten ───────────────────────────────────────────────────────────────

/** Der Wechsel auf `stelle` zum Zeitpunkt `zeit` – mit Punkt-ID und Titel aus der Liste. */
export function wechselAus(
  liste: readonly LivePunkt[],
  stelle: number,
  zeit: number,
  zusatzDavor?: number,
): Wechsel {
  const p = stelle >= 1 ? liste[stelle - 1] : undefined;
  return {
    stelle,
    punktId: p?.id ?? null,
    titel: p?.title ?? '',
    zeit,
    ...(zusatzDavor === undefined ? {} : { zusatzDavor }),
  };
}

/** Was ein Fehlklick-Ausgleich braucht: bis wann der Punkt schon lief und welche Zusatzzeit er hatte. */
export interface Fortsetzung {
  seit: number;
  zusatzSek: number;
  /** Auf dieses `addseconds` ist auszugleichen: alte Zusatzzeit − schon gelaufene Sekunden. */
  ausgleich: number;
}

/**
 * **Was ein Klick festhält** (T4/T9): Ist der Wechsel von `vorher` auf `neu` ein Wechsel (anderer Zeitpunkt oder Stelle),
 * kommt er in den Verlauf – und, falls der verlassene Punkt noch fehlt (das Gerät war nicht dabei), auch dieser. Dazu die
 * Fehlklick-Prüfung: Wird der Wechsel nach der Regel (`laeufeAus`) zur Fortsetzung, steht in `fortsetzung`, worauf CT per
 * `addseconds` auszugleichen ist. `vorherZusatz` = wirksame Zusatzzeit des verlassenen Punkts (`wirksamerStand`).
 */
export function wechselBeiKlick(
  verlauf: readonly Wechsel[],
  liste: readonly LivePunkt[],
  vorher: LiveStand | null,
  vorherZusatz: number,
  neu: LiveStand,
): { neue: Wechsel[]; fortsetzung: Fortsetzung | null } {
  if (neu.stelle === null || neu.seit === null) return { neue: [], fortsetzung: null };
  if (vorher && vorher.stelle === neu.stelle && vorher.seit === neu.seit) {
    return { neue: [], fortsetzung: null };
  }
  const neue: Wechsel[] = [];
  if (vorher && vorher.stelle !== null && vorher.seit !== null) {
    if (!hatWechsel(verlauf, vorher.seit, vorher.stelle)) {
      neue.push(wechselAus(liste, vorher.stelle, vorher.seit));
    }
  }
  const wechsel = wechselAus(liste, neu.stelle, neu.seit, vorher ? vorherZusatz : undefined);
  neue.push(wechsel);
  const l = laeufeAus(zusammenfuehren(verlauf, neue)).laeufe;
  const letzter = l[l.length - 1];
  if (!letzter || !letzter.fortgesetzt || letzter.oeffnung !== neu.seit) {
    return { neue, fortsetzung: null };
  }
  return {
    neue,
    fortsetzung: {
      seit: letzter.seit,
      zusatzSek: letzter.zusatzSek,
      ausgleich: Math.round(letzter.zusatzSek - (neu.seit - letzter.seit) / 1000) + 0,
    },
  };
}

/**
 * **Was ein offenes Live-Gerät nachträgt**: Steht der Stand von ChurchTools (Stelle + `switchdate`) noch nicht im Verlauf –
 * jemand hat in der CT-App oder im CT-Web geschaltet, oder das klickende Gerät hat es nicht geschafft –, ist es dieser eine
 * Wechsel. Gleicher `switchdate` und gleiche Stelle = derselbe Wechsel, also kein Doppel. `davorZusatz` = die Zusatzzeit des
 * Punkts davor, wenn das Gerät ihn gesehen hat.
 */
export function nachzutragen(
  verlauf: readonly Wechsel[],
  liste: readonly LivePunkt[],
  stand: LiveStand | null,
  davorZusatz?: number,
): Wechsel | null {
  if (!stand || stand.stelle === null || stand.seit === null) return null;
  if (hatWechsel(verlauf, stand.seit, stand.stelle)) return null;
  return wechselAus(liste, stand.stelle, stand.seit, davorZusatz);
}
