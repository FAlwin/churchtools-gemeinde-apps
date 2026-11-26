/**
 * **Erinnerungen in ChurchTools einrichten – lesen und schreiben** (Bauplan R-5a, 25.11.2026). Je Dienstgruppe: Hilfsgruppe
 * (Gruppentyp „Dienstplaner“) + Routine daran + je Planer zwei globale Rechte nur für diese Gruppe („Planer wie alle“, Alwin 25.11.2026: kein Leiter, sondern
 * normaler Teilnehmer), danach die Nummern im Abfragen-Dokument. Die Regeln
 * (Namen, Planer-Liste, Soll/Ist) stehen in `shared/dienstplan/abfrageAutomatik.ts`.
 *
 * **Zwei Teile:**
 * - `lageLesen` liest nur (Admin-Fenster zeigt damit **vor dem Klick**, was angelegt wird und welchen Planern welche Rechte gegeben werden).
 * - `einrichten` liest zuerst frisch (dieselbe Lage) und schreibt dann, Schritt für Schritt, jeden Schritt **mit Nachlesen**:
 *   ein 200/201 ist kein Beleg (Lehre vom 11.08.2026). Erfolg heißt: Gruppe, Routine und die Rechte aller Planer stehen nachgelesen da.
 *
 * **Reihenfolge:** Gruppe → (Beschreibung, „Anfragen automatisch annehmen“, Status) → Routine → **Dokument speichern** →
 * Rechte. Das Dokument kommt erst nach nachgelesener Gruppe und Routine, die Rechte danach: Scheitert etwas dazwischen,
 * steht „eingerichtet“ nicht fälschlich da.
 *
 * **Wiederholbar, nie doppelt:** Steht die Einrichtung noch nicht im Dokument (Abbruch zwischen „angelegt“ und „gespeichert“),
 * wird eine Gruppe mit gleichem Namen und Typ **übernommen** statt einer zweiten; mehrere gleiche = Stopp. Nur **404** heißt
 * „die Gruppe ist verschwunden“ (dann neu anlegen und melden) – jeder andere Lesefehler stoppt, sonst gäbe es bei einem
 * Aussetzer eine zweite Gruppe. Eine fremde Routine an der Teilnehmer-Rolle bleibt unangetastet (Stopp).
 *
 * **Vorübergehend ist nicht ungültig:** Nichts wird zurückgerollt oder gelöscht, nichts automatisch wiederholt; die Meldung
 * sagt, was schon angelegt ist. **Nie entzogen:** Rechte von Personen, die keine Planer mehr sind, und Leiter früherer Probe-Einrichtungen
 * bleiben unangetastet.
 *
 * **Die Rechte** (`PUT /permissions/person/{id}`, `type: grant`, `dataId: [Gruppe]`): gelesen wird vorher und nachher
 * (`GET /permissions/person/{id}`); fehlt danach etwas, oder ist eine `dataId` von vorher weg (ein ersetzendes PUT hätte das
 * Recht für eine andere Hilfsgruppe gekostet), bricht das Einrichten ab und sagt es. Eine nicht lesbare Antwort heißt nie „hat
 * nichts“, sondern Stopp.
 */
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { ctPortMit } from '@ui/ct/ctPort';
import {
  mitgliedAnlegen,
  mitgliedEntfernen,
  mitgliedOderNichts,
  type MitgliedAngaben,
} from '@ui/ct/mitglieder';
import { personenRoh } from '@ui/ct/personen';
import { ctAlleSeiten } from '@ui/ct/verbindung';
import { ctId } from '@shared/ct/ctId';
import {
  GruppenartFehler,
  gruppenartRollen,
  gruppenartSuchen,
  listeHolen,
  modulRechtHolen,
  type CtPort,
} from '@shared/ct/gruppenart';
import type { Einrichtung } from '@shared/dienstplan/abfragen';
import type { AbfragenStand } from '@shared/dienstplan/abfragenSpeicher';
import type { SchubladenStand } from '@shared/dienstplan/entwuerfe';
import { antwortenSchublade } from '@shared/dienstplan/verfuegbarkeit';
import {
  einrichtenPlan,
  gruppenIdsDerDienste,
  gruppenRechteAus,
  gruppenRechtGrund,
  PLANER_GRUPPENRECHTE,
  rechtDataIdsAus,
  type GruppenRecht,
  hilfsgruppenBeschreibung,
  hilfsgruppenName,
  HILFSGRUPPEN_TYP,
  istHilfsgruppenTyp,
  istUnsereRoutine,
  personenIdsAusRecht,
  planerListe,
  PLANER_RECHT,
  planerRechtPfad,
  routinenName,
  type EinrichtenPlan,
} from '@shared/dienstplan/abfrageAutomatik';
import {
  istLeitung,
  mitgliederAus,
  rollenAus,
  type RohMitglied,
} from '@shared/organigramm/mitglieder';
import type { RoutineNeu } from '@shared/organigramm/gruppenwechsel';
import type { RoutineRoh } from '@shared/organigramm/einrichtungStand';
import type { AbfrageAnschluss } from './AbfrageFenster';
import type { AutomatikAnschluss } from './abfrageAutomatikLauf';
import { abfragenFehlerText } from './abfragenTexte';

export { gruppenIdsDerDienste };

/** Der Anschluss an ChurchTools: Lesen/Schreiben wie bei den anderen Einrichtungen, dazu Listen über alle Seiten. */
export interface EinrichtenPort extends CtPort {
  liste<T>(pfad: string): Promise<T[]>;
}

/**
 * Die Ablage „Antworten <Gruppe>“ (V-4): Dort steht bei „Nur abwesend“ das „Fertig“, bei Zusagen Ja/Vielleicht. Gelesen und angelegt wird mit
 * den vorhandenen Bausteinen (`antwortenAblageStand`, `richteAntwortenEin` in `ladeVerfuegbarkeit.ts`) – wer sie anlegt, bekommt in
 * ChurchTools sofort alle Rechte darauf, wie beim bisherigen Einrichten.
 */
export interface EinrichtenAblage {
  /** Der Stand frisch gelesen; wirft bei Lesefehlern. */
  stand: (dienstgruppe: { id: number; name: string }) => Promise<SchubladenStand>;
  /** Legt sie an (und sieht danach nach); wirft, wenn es nicht geht. */
  anlegen: (dienstgruppe: { id: number; name: string }) => Promise<void>;
}

export interface EinrichtenAnschluss {
  port: EinrichtenPort;
  /** Die Ablage der Antworten mit einrichten. Ohne: nicht Teil des Einrichtens (Tests, ältere Aufrufer). */
  ablage?: EinrichtenAblage;
  /** Der EINE Weg, eine Mitgliedschaft anzulegen (`ui/ct/mitglieder.ts`, Wächter `eineMitgliedschaft`). */
  mitgliedAnlegen: (gruppe: number, person: number, angaben: MitgliedAngaben) => Promise<void>;
  /** Aus der Gruppe austragen – ebenfalls der EINE Weg (`ui/ct/mitglieder.ts`). */
  mitgliedEntfernen: (gruppe: number, person: number) => Promise<void>;
  /** Die Mitgliedschaft lesen – `null`: nicht in der Gruppe (404, gemessen); alles andere wirft. */
  mitgliedOderNichts: (gruppe: number, person: number) => Promise<unknown>;
  /** Namen zu Personennummern – nur zur Anzeige; fehlt eine, steht „Person <Nr.>“ da. */
  namen: (ids: number[]) => Promise<ReadonlyMap<number, string>>;
  /** Die Abfragen der Dienstgruppe lesen/speichern (dasselbe Dokument wie Start und Einstellungen). */
  abfragen: Pick<AbfrageAnschluss, 'lesen' | 'speichern' | 'ich'>;
}

const VERWEIGERT = 'Dir fehlt in ChurchTools das Recht dafür (Berechtigungen verwalten).';

/** Der echte Anschluss zu den Mitgliedern der Hilfsgruppe (Browser, angemeldet in ChurchTools) – ohne das Abfragen-Dokument. */
export function ctAutomatikAnschluss(): AutomatikAnschluss {
  return {
    port: { ...ctPortMit(VERWEIGERT), liste: (pfad) => ctAlleSeiten(pfad) },
    mitgliedAnlegen: (g, p, an) => mitgliedAnlegen(g, p, an, { verweigert: VERWEIGERT }),
    mitgliedEntfernen: (g, p) => mitgliedEntfernen(g, p, { verweigert: VERWEIGERT }),
    mitgliedOderNichts: (g, p) => mitgliedOderNichts(g, p),
  };
}

/** Der echte Anschluss (Browser, angemeldet in ChurchTools). */
export function ctEinrichtenAnschluss(
  abfragen: EinrichtenAnschluss['abfragen'],
  ablage?: EinrichtenAblage,
): EinrichtenAnschluss {
  return {
    ...ctAutomatikAnschluss(),
    ablage,
    namen: async (ids) => {
      try {
        const personen = await personenRoh(ids);
        return new Map(
          personen.map((p) => [p.id, [p.firstName, p.lastName].filter(Boolean).join(' ')]),
        );
      } catch {
        return new Map(); // nur Anzeige: „Person <Nr.>“ genügt
      }
    },
    abfragen,
  };
}

// ── Fehler ──────────────────────────────────────────────────────────────────

/** Ein Grund, nicht (weiter) zu schreiben – mit Satz für Menschen. */
class Stopp extends Error {
  constructor(
    message: string,
    readonly nochmal: boolean,
  ) {
    super(message);
    this.name = 'Stopp';
  }
}

const fehlerAus = (e: unknown): { text: string; nochmal: boolean } => {
  if (e instanceof Stopp) return { text: e.message, nochmal: e.nochmal };
  if (e instanceof GruppenartFehler) return { text: e.message, nochmal: e.art !== 'anders' };
  return fehlerMeldung(e);
};

// ── Lesen ───────────────────────────────────────────────────────────────────

interface GruppeRoh {
  name?: unknown;
  information?: { groupTypeId?: unknown; groupStatusId?: unknown; note?: unknown } | null;
  settings?: { autoAccept?: unknown } | null;
}
type RoutineZeile = RoutineRoh & { id?: unknown };
interface Person {
  id: number;
  name: string;
}

/** Was die Fenster vor dem Klick brauchen – und was `einrichten` danach braucht. */
export interface Lage {
  art: 'bereit';
  stand: AbfragenStand;
  typId: number;
  rollen: { teilnehmer: number };
  /** Die Nummern der zwei Rechte in dieser Instanz (aus den Definitionen, nie feste Zahlen). */
  gruppenRechtIds: Record<GruppenRecht, number>;
  gruppeName: string;
  routineName: string;
  /** Die Hilfsgruppe, falls es sie gibt (gespeicherte oder übernommene). */
  gruppeId: number | null;
  /** Die gespeicherte Gruppe gibt es in ChurchTools nicht mehr (404) – es wird eine neue angelegt. */
  verschwunden: boolean;
  /** Eine Gruppe mit gleichem Namen stand schon da und wird übernommen. */
  uebernommen: boolean;
  routineId: number | null;
  /** Die Routine steht da, ist aber ausgeschaltet – sie wird eingeschaltet. */
  routineAus: boolean;
  planer: Person[];
  /** Planer, denen eines der zwei Rechte für die Hilfsgruppe fehlt – mit den fehlenden (Namen wie im Fenster). */
  rechteNachtragen: { person: Person; fehlt: { schluessel: GruppenRecht; name: string }[] }[];
  plan: EinrichtenPlan;
  /**
   * Die Ablage „Antworten <Gruppe>“ (V-4); `null` ohne Anschluss dazu. `anlegen`: Sie fehlt und darf angelegt werden (`einrichtbar`).
   * Steht sie da, ist aber nicht zu sehen oder nicht zu ändern, kann das Einrichten daran nichts ändern: Das ist ein Hinweis
   * (`stand`), kein Hindernis.
   */
  ablage: { name: string; stand: SchubladenStand; anlegen: boolean } | null;
  /** Alles ist eingerichtet, es fehlt nichts. */
  fertig: boolean;
}
export type LageErgebnis = Lage | { art: 'gestoppt'; text: string; nochmal: boolean };

const ist404 = (e: unknown) => e instanceof ApiError && e.status === 404;
const gruppenPfad = (id: number) => `/groups/${id}`;
/** Die Wege der Hilfsgruppe – der EINE Ort (`abfrageAutomatikLauf.ts` nimmt sie von hier). */
export const mitgliederPfad = (id: number) => `/groups/${id}/members`;
export const routinenPfad = (id: number) => `/groups/${id}/members/routines`;
const personenRechtePfad = (id: number) => `/permissions/person/${id}`;
const rechtName = (k: GruppenRecht) => PLANER_GRUPPENRECHTE.find((r) => r.schluessel === k)!.name;

/** Die zwei Rechte-Nummern dieser Instanz – aus den globalen Definitionen, je Schlüssel. */
async function rechtIdsHolen(p: EinrichtenPort): Promise<Record<GruppenRecht, number>> {
  const aus = {} as Record<GruppenRecht, number>;
  for (const r of PLANER_GRUPPENRECHTE)
    aus[r.schluessel] = (
      await modulRechtHolen(p, r.modul, r.recht, r.name, '/permissions/definitions?scope=global')
    ).authId;
  return aus;
}

/** Die Rechte einer Person lesen – **streng:** eine Antwort in unbekannter Gestalt ist ein Stopp, nie „hat nichts“. */
async function personenRechteLesen(
  p: EinrichtenPort,
  personId: number,
  name: string,
): Promise<unknown> {
  const roh = await p.holen<unknown>(personenRechtePfad(personId));
  if (!Array.isArray(roh))
    throw new Stopp(
      `ChurchTools hat die Rechte von ${name} nicht in der erwarteten Form geliefert. Es wurde nichts geschrieben.`,
      true,
    );
  return roh;
}

/**
 * **Nur lesen.** Stoppt (ohne zu schreiben), wenn etwas nicht eindeutig ist: Abfragen-Dokument nicht lesbar, Gruppentyp
 * fehlt, Planer nicht vollständig lesbar, Gruppe nicht lesbar, mehrere gleiche Gruppen, fremde Routine.
 */
export async function lageLesen(
  dienstgruppe: { id: number; name: string },
  gruppenIds: readonly number[],
  a: EinrichtenAnschluss,
): Promise<LageErgebnis> {
  try {
    return await lageLesenOhneFangen(dienstgruppe, gruppenIds, a);
  } catch (e) {
    const f = fehlerAus(e);
    return { art: 'gestoppt', text: f.text, nochmal: f.nochmal };
  }
}

async function lageLesenOhneFangen(
  dienstgruppe: { id: number; name: string },
  gruppenIds: readonly number[],
  a: EinrichtenAnschluss,
): Promise<Lage> {
  const p = a.port;
  // 1. Das Dokument – ohne Lesen darf nichts geschrieben werden (nie auf „kein Wert“ hin).
  const stand = await a.abfragen.lesen(dienstgruppe.id);
  if (stand.fehler)
    throw new Stopp(abfragenFehlerText(stand.fehler, true), stand.fehler === 'voruebergehend');
  if (stand.unlesbar)
    throw new Stopp(
      'Die Abfragen dieser Dienstgruppe wurden mit einer neueren Version des Dienstplaners gespeichert – bitte neu laden.',
      false,
    );
  // 2. Gruppentyp und seine Rollen.
  const typ = await gruppenartSuchen(p, istHilfsgruppenTyp);
  if (typ.id === null)
    throw new Stopp(
      `Der Gruppentyp „${HILFSGRUPPEN_TYP}“ fehlt in ChurchTools – siehe Anleitung. Es wurde nichts angelegt.`,
      false,
    );
  const typId = typ.id;
  const r = await gruppenartRollen(p, typId);
  if (r.teilnehmer === null)
    throw new Stopp(
      `Der Gruppentyp „${HILFSGRUPPEN_TYP}“ hat keine Rolle „Teilnehmer“ – bitte in ChurchTools ansehen.`,
      false,
    );
  const rollen = { teilnehmer: r.teilnehmer };
  const gruppenRechtIds = await rechtIdsHolen(p);
  // 3. Die Planer – beide Quellen müssen vollständig lesbar sein.
  const namen = new Map<number, string>();
  const recht = await modulRechtHolen(p, PLANER_RECHT.modul, PLANER_RECHT.recht, PLANER_RECHT.name);
  const rechtIds = personenIdsAusRecht(
    await p.holen<unknown>(planerRechtPfad(recht.authId, dienstgruppe.id)),
    dienstgruppe.id,
  );
  if (rechtIds === null)
    throw new Stopp(
      'ChurchTools hat die Planer dieser Dienstgruppe nicht in der erwarteten Form geliefert. Es wurde nichts angelegt.',
      true,
    );
  const alleRollen = rollenAus(await listeHolen(p, '/group/roles', 'Die Rollen der Gruppentypen'));
  const leitungen: number[] = [];
  for (const g of gruppenIds) {
    const m = mitgliederAus(await p.liste<RohMitglied>(mitgliederPfad(g)));
    for (const x of m.personen) namen.set(x.id, x.name);
    for (const mi of m.mitglieder)
      if (istLeitung(alleRollen, mi.rolleId)) leitungen.push(mi.personId);
  }
  const planerIds = planerListe({ recht: rechtIds, leitungen });
  // 4. Die Hilfsgruppe: die gespeicherte (nur 404 heißt „weg“) oder eine mit gleichem Namen und Typ.
  const gName = hilfsgruppenName(dienstgruppe.name);
  const einr = stand.inhalt.einrichtung;
  let gruppeId: number | null = null;
  let verschwunden = false;
  let uebernommen = false;
  if (einr) {
    try {
      const g = await p.holen<GruppeRoh | null>(gruppenPfad(einr.gruppeId));
      if (ctId(g?.information?.groupTypeId) !== typId)
        throw new Stopp(
          `Die Gruppe ${einr.gruppeId} ist in ChurchTools nicht mehr vom Typ „${HILFSGRUPPEN_TYP}“. Es wurde nichts verändert – bitte in ChurchTools ansehen.`,
          false,
        );
      gruppeId = einr.gruppeId;
    } catch (e) {
      if (!ist404(e)) throw e;
      verschwunden = true;
    }
  }
  if (gruppeId === null) {
    const waisen = (
      await p.liste<{ id?: unknown; name?: unknown }>(`/groups?group_type_ids[]=${typId}`)
    )
      .filter((g) => g.name === gName)
      .map((g) => ctId(g.id))
      .filter((x): x is number => x !== null);
    if (waisen.length > 1)
      throw new Stopp(
        `Im Gruppentyp „${HILFSGRUPPEN_TYP}“ gibt es ${waisen.length} Gruppen „${gName}“ (${waisen.join(', ')}). Welche gemeint ist, lässt sich nicht erraten – bitte in ChurchTools die überzähligen entfernen.`,
        false,
      );
    if (waisen.length === 1) {
      gruppeId = waisen[0];
      uebernommen = true;
    }
  }
  // 5. Die Routine an der Teilnehmer-Rolle.
  const rName = routinenName(dienstgruppe.name);
  let routineId: number | null = null;
  let routineAus = false;
  if (gruppeId !== null) {
    const zeilen = (
      await listeHolen<RoutineZeile>(p, routinenPfad(gruppeId), 'Die Routinen')
    ).filter(
      (z) => ctId(z.groupTypeRoleId) === rollen.teilnehmer && z.groupMemberStatus === 'active',
    );
    const fremd = zeilen.find((z) => !istUnsereRoutine(z.routine?.name));
    if (fremd)
      throw new Stopp(
        `In „${gName}“ gibt es schon eine andere Routine („${typeof fremd.routine?.name === 'string' ? fremd.routine.name : 'ohne Namen'}“). Der Dienstplaner lässt sie stehen – bitte in ChurchTools ansehen.`,
        false,
      );
    const unsere =
      zeilen.find((z) => einr && ctId(z.id) === einr.routineId) ??
      zeilen.find((z) => z.routine?.name === rName) ??
      zeilen[0];
    if (unsere) {
      routineId = ctId(unsere.id);
      if (routineId === null)
        throw new Stopp('Die vorhandene Routine hat in ChurchTools keine Nummer.', false);
      routineAus = unsere.routine?.isEnabled === false;
    }
  }
  // 6. Welche Rechte haben die Planer schon für diese Hilfsgruppe? (Ohne Gruppe: keine – nichts zu lesen.)
  const rechte = new Map<number, Set<GruppenRecht>>();
  if (gruppeId !== null)
    for (const id of planerIds) {
      const da = gruppenRechteAus(
        await personenRechteLesen(p, id, namen.get(id) ?? `Person ${id}`),
        gruppenRechtIds,
        gruppeId,
      );
      if (da === null) throw new Stopp('Die Rechte eines Planers sind nicht lesbar.', true);
      rechte.set(id, da);
    }
  // 7. Die Ablage der Antworten (frisch gelesen): fehlt sie und darf sie angelegt werden, kommt sie dazu.
  const ablageStand = a.ablage ? await a.ablage.stand(dienstgruppe) : null;
  const ablage =
    ablageStand === null
      ? null
      : {
          name: antwortenSchublade(dienstgruppe).name,
          stand: ablageStand,
          anlegen: ablageStand === 'einrichtbar',
        };
  const plan = einrichtenPlan(planerIds, {
    gruppe: gruppeId !== null,
    routine: routineId !== null,
    eingetragen: !!einr && einr.gruppeId === gruppeId && einr.routineId === routineId,
    rechte,
  });
  // Namen für alle, die angezeigt werden (Planer).
  const fehlen = planerIds.filter((id) => !namen.has(id));
  if (fehlen.length > 0) for (const [id, n] of await a.namen(fehlen)) if (n) namen.set(id, n);
  const mit = (ids: readonly number[]): Person[] =>
    ids.map((id) => ({ id, name: namen.get(id) ?? `Person ${id}` }));
  return {
    art: 'bereit',
    stand,
    typId,
    rollen,
    gruppenRechtIds,
    gruppeName: gName,
    routineName: rName,
    gruppeId,
    verschwunden,
    uebernommen,
    routineId,
    routineAus,
    planer: mit(planerIds),
    rechteNachtragen: plan.rechteNachtragen.map((r) => ({
      person: mit([r.personId])[0],
      fehlt: r.fehlt.map((k) => ({ schluessel: k, name: rechtName(k) })),
    })),
    plan,
    ablage,
    fertig: plan.nichtsZuTun && !routineAus && !ablage?.anlegen,
  };
}

// ── Schreiben ───────────────────────────────────────────────────────────────

export type Lauf =
  /** Nichts geschrieben: eine Voraussetzung stimmt nicht. */
  | { art: 'gestoppt'; text: string; nochmal: boolean }
  | {
      art: 'gelaufen';
      /** Alles steht nachgelesen da. */
      ok: boolean;
      /** Was angelegt bzw. ergänzt wurde (bei einem Fehler: was bis dahin schon dasteht). */
      angelegt: string[];
      /** Hinweise, die nichts blockieren (Teilnehmer, die Planer sind; Leiter, die keine Planer mehr sind). */
      hinweise: string[];
      fehler: { text: string; nochmal: boolean } | null;
    };

const nummerAus = (antwort: unknown): number | null =>
  ctId((antwort as { id?: unknown } | null)?.id);

/** Die Hilfsgruppe nachlesen und prüfen: Typ, Name, Status; `note` und „Anfragen automatisch annehmen“ ergänzen. */
async function gruppePflegen(
  p: EinrichtenPort,
  id: number,
  l: Lage,
  beschreibung: string,
  angelegt: string[],
): Promise<void> {
  const lesen = () => p.holen<GruppeRoh | null>(gruppenPfad(id));
  let g = await lesen();
  if (!g || g.name !== l.gruppeName || ctId(g.information?.groupTypeId) !== l.typId)
    throw new NichtUebernommen(`die Gruppe „${l.gruppeName}“ mit dem Typ „${HILFSGRUPPEN_TYP}“`);
  const status = ctId(g.information?.groupStatusId);
  if (status !== null && status !== 1)
    throw new Stopp(
      `„${l.gruppeName}“ ist in ChurchTools nicht aktiv. Gruppen im Entwurf führen keine Routinen aus – bitte dort auf „aktiv“ stellen.`,
      false,
    );
  const ohneNote =
    g.information?.note === null || g.information?.note === undefined || g.information.note === '';
  const ohneAuto = g.settings?.autoAccept !== true;
  if (ohneNote) await p.schicken(gruppenPfad(id), 'PATCH', { note: beschreibung });
  // Ohne „automatisch annehmen“ setzt ChurchTools beim Austreten nur „zu löschen“ (gemessen R-0) – die Person bliebe in der Gruppe.
  if (ohneAuto) await p.schicken(gruppenPfad(id), 'PATCH', { autoAccept: true });
  if (!ohneNote && !ohneAuto) return;
  g = await lesen();
  if (ohneNote && g?.information?.note !== beschreibung)
    throw new NichtUebernommen('die Beschreibung der Gruppe');
  if (ohneAuto && g?.settings?.autoAccept !== true)
    throw new NichtUebernommen('„Anfragen automatisch annehmen“ der Gruppe');
  angelegt.push(
    [ohneNote && 'Beschreibung gesetzt', ohneAuto && '„automatisch annehmen“ eingestellt']
      .filter(Boolean)
      .join(', '),
  );
}

/**
 * **Einrichten.** Liest frisch (`lageLesen`) und schreibt, was fehlt; jeder Schritt wird nachgelesen. Beim ersten Fehler wird
 * aufgehört – was schon steht, bleibt stehen und steht in der Antwort.
 */
export async function einrichten(
  dienstgruppe: { id: number; name: string },
  gruppenIds: readonly number[],
  a: EinrichtenAnschluss,
): Promise<Lauf> {
  const l = await lageLesen(dienstgruppe, gruppenIds, a);
  if (l.art === 'gestoppt') return l;
  const p = a.port;
  const angelegt: string[] = [];
  const hinweise: string[] = [];
  if (l.fertig) return { art: 'gelaufen', ok: true, angelegt, hinweise, fehler: null };
  try {
    let gruppeId = l.gruppeId;
    if (l.verschwunden)
      hinweise.push(
        'Die bisherige Gruppe gibt es in ChurchTools nicht mehr – es wurde eine neue angelegt.',
      );
    if (l.plan.gruppeAnlegen) {
      const antwort = await p.schicken('/groups', 'POST', {
        name: l.gruppeName,
        groupTypeId: l.typId,
        groupStatusId: 1,
      });
      gruppeId = nummerAus(antwort);
      if (gruppeId === null)
        throw new Stopp(
          `ChurchTools hat „${l.gruppeName}“ angenommen, aber keine Nummer geliefert. Ein neuer Versuch findet die Gruppe wieder und legt keine zweite an.`,
          true,
        );
      angelegt.push(`Gruppe „${l.gruppeName}“ angelegt (Nr. ${gruppeId})`);
    } else if (l.uebernommen) {
      angelegt.push(`Schon vorhandene Gruppe „${l.gruppeName}“ übernommen`);
    }
    if (gruppeId === null) throw new Stopp('Die Hilfsgruppe fehlt.', true);
    await gruppePflegen(p, gruppeId, l, hilfsgruppenBeschreibung(dienstgruppe.name), angelegt);

    let routineId = l.routineId;
    const routinen = async () =>
      (await listeHolen<RoutineZeile>(p, routinenPfad(gruppeId), 'Die Routinen')).filter(
        (z) => ctId(z.groupTypeRoleId) === l.rollen.teilnehmer && z.groupMemberStatus === 'active',
      );
    if (l.plan.routineAnlegen) {
      const neu: RoutineNeu = {
        name: l.routineName,
        domainType: 'group_membership',
        domainContext: {
          groupId: gruppeId,
          groupTypeRoleId: l.rollen.teilnehmer,
          groupMemberStatus: 'active',
        },
        isEnabled: true,
      };
      routineId = nummerAus(await p.schicken('/routines', 'POST', neu));
      if (routineId === null)
        throw new Stopp(
          'ChurchTools hat die Routine angenommen, aber keine Nummer geliefert. Ein neuer Versuch findet sie wieder.',
          true,
        );
      angelegt.push(`Routine „${l.routineName}“ angelegt`);
    } else if (l.routineAus && routineId !== null) {
      await p.schicken(`/routines/${routineId}`, 'PATCH', { isEnabled: true });
      angelegt.push(`Routine „${l.routineName}“ eingeschaltet`);
    }
    if (routineId === null) throw new Stopp('Die Routine fehlt.', true);
    if (l.plan.routineAnlegen || l.routineAus) {
      const da = (await routinen()).find((z) => ctId(z.id) === routineId);
      if (!da || da.routine?.name !== l.routineName || da.routine?.isEnabled === false)
        throw new NichtUebernommen(`die Routine „${l.routineName}“`);
    }

    // Erst jetzt – Gruppe und Routine sind nachgelesen – kommen die Nummern ins Dokument.
    if (l.plan.einrichtungSchreiben) {
      const neu: Einrichtung = { gruppeId, routineId };
      const r = await a.abfragen.speichern(
        dienstgruppe.id,
        { ...l.stand.inhalt, einrichtung: neu },
        a.abfragen.ich,
        l.stand.gespeichert?.version ?? null,
      );
      if (!r.ok)
        throw new Stopp(
          r.grund === 'konflikt'
            ? 'Jemand anderes hat die Abfragen inzwischen geändert – es wurde nichts überschrieben. Gruppe und Routine stehen; ein erneutes Einrichten übernimmt sie.'
            : abfragenFehlerText(r.grund, false),
          r.grund !== 'abgemeldet' && r.grund !== 'kein-recht',
        );
      angelegt.push('Einrichtung im Dienstplaner gespeichert');
    }

    // Die Planer: zwei Rechte nur für diese Hilfsgruppe – vorher und nachher gelesen.
    for (const r of l.rechteNachtragen) {
      const name = r.person.name;
      const vorher = await personenRechteLesen(p, r.person.id, name);
      for (const k of r.fehlt)
        await p.schicken(personenRechtePfad(r.person.id), 'PUT', {
          authId: l.gruppenRechtIds[k.schluessel],
          dataId: [gruppeId],
          type: 'grant',
          reason: gruppenRechtGrund(dienstgruppe.name),
        });
      const nachher = await personenRechteLesen(p, r.person.id, name);
      const da = gruppenRechteAus(nachher, l.gruppenRechtIds, gruppeId);
      const fehlt = r.fehlt.filter((k) => !da?.has(k.schluessel));
      if (fehlt.length > 0)
        throw new NichtUebernommen(
          `die Rechte von ${name} („${fehlt.map((k) => k.name).join('“, „')}“)`,
        );
      // Ein ersetzendes PUT würde ein Recht für eine andere Hilfsgruppe kosten – nachweisen, dass nichts verschwunden ist.
      for (const k of PLANER_GRUPPENRECHTE) {
        const frueher = rechtDataIdsAus(vorher, l.gruppenRechtIds[k.schluessel]);
        const jetzt = rechtDataIdsAus(nachher, l.gruppenRechtIds[k.schluessel]);
        if (frueher && jetzt && [...frueher].some((id) => !jetzt.has(id)))
          throw new Stopp(
            `ChurchTools hat beim Setzen von „${k.name}“ für ${name} ein früheres Recht (für eine andere Gruppe) ersetzt. Bitte in ChurchTools unter „Berechtigungen“ ansehen und nicht weiter einrichten.`,
            false,
          );
      }
      angelegt.push(
        `Rechte für ${name}: ${r.fehlt.map((k) => k.name).join(', ')} (nur für „${l.gruppeName}“)`,
      );
    }
    // Die Ablage „Antworten <Gruppe>“: nur anlegen, was fehlt – und danach nachsehen (ein Erfolg ist erst, was dasteht).
    if (l.ablage?.anlegen && a.ablage) {
      await a.ablage.anlegen(dienstgruppe);
      if ((await a.ablage.stand(dienstgruppe)) !== 'bereit')
        throw new NichtUebernommen(`die Ablage „${l.ablage.name}“`);
      angelegt.push(`Ablage „${l.ablage.name}“ angelegt`);
    }
    return { art: 'gelaufen', ok: true, angelegt, hinweise, fehler: null };
  } catch (e) {
    return { art: 'gelaufen', ok: false, angelegt, hinweise, fehler: fehlerAus(e) };
  }
}
