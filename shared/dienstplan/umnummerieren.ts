/**
 * **Entwürfe mitnehmen, wenn sich die Platzzahl ändert** (Alwin, 19.11.2026: „Alles bleibt in der Planung anpassbar“).
 *
 * Ein Entwurf merkt sich seinen Platz über Termin + Dienst + `index` (`ortSchluessel`), nie über die Platz-ID – jedes
 * Schreiben in ChurchTools vergibt dem Platz eine neue. Ändert sich die Platzzahl, nummeriert ChurchTools die Plätze
 * des Dienstes neu. Gemessen (Test-Instanz, 19.11.2026):
 * - Vergrößern hängt hinten an; bestehende Plätze behalten **ID und Nummer**. Einzige Ausnahme: 1 → 2 macht aus
 *   `index: null` die `1`.
 * - Verkleinern nimmt **freie Plätze von hinten** weg und rückt die übrigen **lückenlos auf**; die **ID bleibt**
 *   (`[1053:1, 864:2 frei, 1172:3]` → count 2 → `[1053:1, 1172:2]`). 2 → 1: der übrige Platz bekommt `index: null`.
 *   Belegte fallen nie weg.
 *
 * Die Platz-ID ist zwischen dem Lesen vorher und dem Lesen nachher (beides in `anzahlAendern`, nur unser `PUT` liegt
 * dazwischen) stabil – darüber findet jeder Entwurf seinen neuen Platz. Diese Datei hat zwei Teile: die **reine Regel**
 * (`umzuegeRechnen`) und den **Ablauf** (`entwuerfeMitnehmen`: Schublade frisch lesen, Umzüge nacheinander über
 * `entwurfUmziehen`, jeder mit Versions-Schutz). Die Platzzahl IST dann schon geändert – scheitert ein Umzug, wird
 * nichts zurückgedreht, sondern gemeldet (`offen`).
 */
import {
  ortSchluessel,
  entwurfUmziehen,
  schubladeLesen,
  type Entwurf,
  type EntwurfPort,
} from './entwuerfe';
import type { PlatzOrt } from './einteilen';
import { istFrei, type RohPlatz } from './termine';

/** Ein Platz des Dienstes, wie ihn ChurchTools gerade nennt – mit der ID, an der man ihn nach dem Umnummerieren erkennt. */
export interface PlatzStand {
  id: number;
  /** `null`, wenn der Dienst nur einen Platz hat. */
  index: number | null;
  frei: boolean;
}

/** Die Plätze eines Dienstes aus den Rohdaten des Termins (Plätze ohne numerische ID bleiben draußen: Sie sind nicht zu verfolgen). */
export function platzStaende(plaetze: readonly RohPlatz[], serviceId: number): PlatzStand[] {
  return plaetze.flatMap((p) =>
    p.serviceId === serviceId && typeof p.id === 'number'
      ? [{ id: p.id, index: typeof p.index === 'number' ? p.index : null, frei: istFrei(p) }]
      : [],
  );
}

export interface Umzug {
  entwurf: Entwurf;
  nach: PlatzOrt;
}

export interface UmzugsPlan {
  /** In der Reihenfolge, in der sie auszuführen sind (nie ist ein Ziel noch besetzt). */
  umzuege: Umzug[];
  /** Entwürfe, die nicht mitgehen können: Sie bleiben, wo sie sind – das Schild „ohne Platz“ der Matrix zeigt sie. */
  ohnePlatz: Entwurf[];
}

const nummer = (index: number | null): number => index ?? 0;

/**
 * **Wohin ziehen die Entwürfe dieses Termins und Dienstes um?** Rein, ohne Netz.
 *
 * - Der Entwurf liegt am alten Platz (über den alten `index`); dessen ID steht nachher am neuen `index` → Umzug dorthin.
 * - Ist der Platz weggefallen (nur freie fallen weg), geht der Entwurf auf einen übrig gebliebenen **freien Platz ohne
 *   Entwurf** – kleinste Nummer zuerst; freie Plätze eines Dienstes sind gleichwertig, `gesehen` bleibt „frei“.
 * - Hatte der Entwurf vorher keinen Platz, ist die Zuordnung nicht eindeutig oder findet sich kein Ziel → nicht anfassen
 *   (`ohnePlatz`).
 * - Aufsteigend nach neuer Nummer; zusätzlich wird das Besetzen simuliert (kein Umzug auf einen besetzten Ort).
 */
export function umzuegeRechnen(o: {
  eventId: number;
  serviceId: number;
  vorher: readonly PlatzStand[];
  nachher: readonly PlatzStand[];
  /** Alle bekannten Entwürfe – gefiltert wird hier auf Termin und Dienst. */
  entwuerfe: Iterable<Entwurf>;
}): UmzugsPlan {
  const meine = [...o.entwuerfe]
    .filter((e) => e.ort.eventId === o.eventId && e.ort.serviceId === o.serviceId)
    .sort((a, b) => nummer(a.ort.index) - nummer(b.ort.index));
  const ort = (index: number | null): PlatzOrt => ({
    eventId: o.eventId,
    serviceId: o.serviceId,
    index,
  });
  const schl = (index: number | null) => ortSchluessel(ort(index));

  const plan: UmzugsPlan = { umzuege: [], ohnePlatz: [] };
  const nachherJeId = new Map(o.nachher.map((p) => [p.id, p]));
  const vorherJeIndex = new Map<string, PlatzStand | null>();
  // Zwei Plätze mit derselben Nummer wären nicht eindeutig – dann bleibt der Entwurf, wo er ist.
  for (const p of o.vorher)
    vorherJeIndex.set(schl(p.index), vorherJeIndex.has(schl(p.index)) ? null : p);

  // Wo bleibt oder landet wer? `ziel`: der Umzug; `bleibt`: Entwürfe, die an ihrem Ort liegen bleiben.
  const ziel = new Map<Entwurf, PlatzOrt>();
  const bleibt: Entwurf[] = [];
  const weggefallen: Entwurf[] = [];
  for (const e of meine) {
    const alt = vorherJeIndex.get(schl(e.ort.index));
    if (!alt) {
      plan.ohnePlatz.push(e);
      continue;
    }
    const neu = nachherJeId.get(alt.id);
    if (!neu) weggefallen.push(e);
    else if (schl(neu.index) === schl(e.ort.index)) bleibt.push(e);
    else ziel.set(e, ort(neu.index));
  }

  // Belegte Orte nach dem Umzug: wer bleibt, wer (ohne Platz) liegen bleibt, wer sein Ziel hat.
  const vergeben = new Set<string>([
    ...bleibt.map((e) => ortSchluessel(e.ort)),
    ...plan.ohnePlatz.map((e) => ortSchluessel(e.ort)),
    ...[...ziel.values()].map(ortSchluessel),
  ]);
  // Weggefallene auf freie Plätze ohne Entwurf – der Reihe nach, kleinste Nummer zuerst.
  const freie = o.nachher
    .filter((p) => p.frei && !vergeben.has(schl(p.index)))
    .sort((a, b) => nummer(a.index) - nummer(b.index));
  for (const e of weggefallen) {
    const p = freie.shift();
    if (p) {
      ziel.set(e, ort(p.index));
      vergeben.add(schl(p.index));
    } else plan.ohnePlatz.push(e);
  }

  // Ausführen: aufsteigend nach neuer Nummer, und das Besetzen simulieren – ein besetztes Ziel wird nie angefasst.
  const besetzt = new Set(meine.map((e) => ortSchluessel(e.ort)));
  const reihe = [...ziel].sort(([, a], [, b]) => nummer(a.index) - nummer(b.index));
  for (const [e, nach] of reihe) {
    if (besetzt.has(ortSchluessel(nach))) {
      plan.ohnePlatz.push(e);
      continue;
    }
    besetzt.delete(ortSchluessel(e.ort));
    besetzt.add(ortSchluessel(nach));
    plan.umzuege.push({ entwurf: e, nach });
  }
  return plan;
}

/** Was nach dem Ändern der Platzzahl mit den Entwürfen geschah. */
export interface MitnehmenErgebnis {
  /** Die neuen Orte (`ortSchluessel`) der Entwürfe, die mitgegangen sind. */
  umgetragen: string[];
  /** Wie viele Entwürfe NICHT mitgehen konnten (ohne Platz, Konflikt, Fehler) – sie liegen unverändert da. */
  offen: number;
  /** Die Schublade war nicht lesbar: Ob Entwürfe mitgehen müssten, ist unbekannt. */
  unklar: boolean;
}

/**
 * **Die Entwürfe dieses Termins und Dienstes auf die neuen Nummern umtragen** – nach einer geglückten Änderung der
 * Platzzahl. Liest die Schublade frisch, rechnet (`umzuegeRechnen`) und führt die Umzüge nacheinander aus
 * (`entwurfUmziehen`, jeder mit Versions-Schutz). Beim ersten Fehlschlag wird aufgehört – die übrigen Entwürfe bleiben
 * unberührt (`offen`); vorübergehende Fehler verwerfen nichts, die Entwürfe liegen weiter an ihrem Ort.
 */
export async function entwuerfeMitnehmen(
  p: EntwurfPort,
  modul: number,
  kategorie: number,
  o: {
    eventId: number;
    serviceId: number;
    vorher: readonly PlatzStand[];
    nachher: readonly PlatzStand[];
  },
): Promise<MitnehmenErgebnis> {
  const l = await schubladeLesen(p, modul, kategorie);
  if (!l.ok) return { umgetragen: [], offen: 0, unklar: true };
  const plan = umzuegeRechnen({
    ...o,
    entwuerfe: [...l.inhalt.je.values()].map((x) => x.entwurf),
  });
  const umgetragen: string[] = [];
  let offen = plan.ohnePlatz.length;
  for (const [i, u] of plan.umzuege.entries()) {
    const r = await entwurfUmziehen(p, modul, kategorie, u.entwurf.ort, u.nach, u.entwurf.version);
    if (!r.ok) {
      offen += plan.umzuege.length - i;
      break;
    }
    umgetragen.push(ortSchluessel(u.nach));
  }
  return { umgetragen, offen, unklar: false };
}
