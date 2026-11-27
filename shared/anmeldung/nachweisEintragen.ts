/**
 * **Eintragen beim Öffnen** (N3c, Entscheidungen E18, E21, E30, E34–E37) – öffnet eine Vertrauensperson einer Nachweis-Art
 * oder ein Admin die Erweiterung, trägt sie alle in die Nachweis-Gruppe ein, die laut einer laufenden Veranstaltung den
 * Nachweis brauchen. ChurchTools startet dann den Ablauf der Art (Aufforderung + Einladung, M10/M11).
 *
 * Der Kern hängt nur an einem Anschluss (`EintragPort`) – die Erweiterung und das Prüfskript gegen die Test-Instanz fahren
 * denselben Code.
 *
 * **Wer eingetragen wird** (eine Stelle: `eintragPlan`):
 * - nur in Veranstaltungen, die noch laufen (`phaseVon` = anstehend, also Ende ≥ heute) und die Art eingeschaltet haben,
 * - nur aktive Teilnehmer (keine Wartenden, nicht die Leitung – `mitgliederstandAus`/`anmeldungenAus` wie in der Tabelle),
 * - nur wer laut `brauchtNachweis` den Nachweis braucht (kaputte Bedingung → niemand, E29),
 * - **„Nur wenn …“ nur als Admin**: Vertrauenspersonen sehen die Antworten nicht (M11: `fields: []`),
 * - nicht, wer schon in der Nachweis-Gruppe steht (jede Rolle, jeder Status),
 * - nicht, wer für diese Veranstaltung schon auf dem Merkzettel steht (E34) – der wurde ausgetragen.
 *
 * **Robust** (vorübergehend ist nicht ungültig): Drosselung (429) beendet den Lauf sofort ohne weitere Anfrage; Netz/5xx
 * beenden ihn leise. In beiden Fällen wird nichts verbucht – der Merkzettel bekommt nur, was nach dem Eintragen nachgelesen
 * in der Gruppe steht. Höchstens `EINTRAGEN_MAX` Versuche je Öffnen, mit `EINTRAGEN_PAUSE_MS` dazwischen (jeder Versuch
 * verschickt zwei Mails – die Grenze bremst auch eine Mailflut aus einem Fehler). Der Rest kommt beim nächsten Öffnen.
 *
 * **Leere Liste ist kein „niemand“:** Ohne „Gruppen eines Gruppentyps sehen“ für „Anmeldung“ liefert ChurchTools die
 * Mitglieder einer Veranstaltung still leer (M11). Darum prüft der Lauf das Recht vorher an `/permissions/global`
 * (`siehtAnmeldungen`) und tut sonst nichts außer den Namen abzulegen (`ohneRecht`).
 */
import { kategorieSuchen, werteLesen, type ModulPort } from '../ct/modulDaten';
import { einstellungenLesen, type OeffentlicheEinstellungen } from './formular';
import {
  anmeldungenAus,
  gruppenfelderAus,
  mitgliederstandAus,
  type CtGruppenfeld,
  type ListenAnmeldung,
  type MitgliedRoh,
} from './liste';
import { nachweisBedarfVon, zaehltFuerNachweis } from './nachweisBedarf';
import {
  NACHWEIS_STAND_KATEGORIE,
  nachweisEinstellungenLesen,
  nachweisNameAus,
  type NachweisEinstellungen,
} from './nachweise';
import { artAngabenAbgleichen, artAngabenAus } from './nachweisStandAblage';
import { phaseVon } from './uebersicht';

/** Höchstens so viele Eintrag-Versuche je Öffnen (je Versuch zwei Mails); der Rest beim nächsten Öffnen. */
export const EINTRAGEN_MAX = 20;
/** Pause zwischen zwei Versuchen – schont ChurchTools (429-Lehre). */
export const EINTRAGEN_PAUSE_MS = 500;

/** Wie ein Fehler beim Eintragen zählt. */
export type EintragFehler =
  /** 403 `member.add.already-in-group` – kein Fehler, die Person steht schon drin (M11). */
  | 'schonDrin'
  /** 429 / Drosselung – sofort aufhören, keine Anfrage mehr (geteilte Ressource). */
  | 'bremse'
  /** Anderes 403 – kein Recht an dieser Art. */
  | 'keinRecht'
  /** Netz, Zeitüberschreitung, 5xx, Unbekanntes. */
  | 'voruebergehend';

export interface EintragPort {
  /** Alle Seiten einer Liste (`/groups?…`, `/groups/{g}/members`) – wirft bei jedem Fehler. */
  alleSeiten<T>(pfad: string): Promise<T[]>;
  /** Ein `GET` (ausgepackt) – wirft bei jedem Fehler. */
  holen<T>(pfad: string): Promise<T>;
  /** Neu in die Nachweis-Gruppe: `PUT …/members/{p}` mit `only_add` (Erweiterung: `mitgliedAnlegen`). */
  anlegen(gruppe: number, person: number, rolle: number): Promise<void>;
  fehlerArt(e: unknown): EintragFehler;
  warte(ms: number): Promise<void>;
  /** Der Datenspeicher der Erweiterung und seine Nummer. */
  modul: ModulPort;
  modulId(): Promise<number>;
}

export interface EintragKontext {
  /** Wer die Erweiterung geöffnet hat. */
  ich: number;
  /** „Berechtigungen verwalten“ – trägt alle Arten ein, auch „Nur wenn …“. */
  admin: boolean;
  heute: string;
  nachweisTyp: number;
  leiterRolle: number;
  teilnehmerRolle: number;
  anmeldungTyp: number;
  /** Die Gruppenart-Rollen, die Leitung sind (`leitungsRollen`). */
  leitung: ReadonlySet<number>;
  /** Meldung bei fehlendem Schreibrecht an der Ablage. */
  verweigert: string;
  max?: number;
  pause?: number;
}

export type EintragAbbruch =
  /** Die Ablage „Nachweis-Stand“ gibt es (noch) nicht – ohne Merkzettel wird nicht eingetragen. */
  | 'ohneAblage'
  /** Das Recht, die Anmeldungen zu sehen, fehlt (noch) – leere Listen wären gelogen. */
  | 'ohneRecht'
  | 'bremse'
  | 'voruebergehend'
  /** `EINTRAGEN_MAX` erreicht – der Rest beim nächsten Öffnen. */
  | 'obergrenze';

export interface EintragErgebnis {
  /** Die Arten, für die eingetragen wird (Admin: alle fertigen, sonst die eigenen). */
  arten: { id: number; name: string; einstellungen: NachweisEinstellungen }[];
  /** Nachgelesen neu eingetragen, je Art (ohne „schon drin“). */
  neu: Map<number, number[]>;
  /** Arten, an denen ChurchTools das Eintragen verweigert hat (anderes 403). */
  verweigert: number[];
  abbruch: EintragAbbruch | null;
}

interface GruppeRoh {
  id: number;
  name?: string;
  information?: { note?: string | null; groupStatusId?: number };
}

interface ArtMitglied {
  personId?: number;
  groupTypeRoleId?: number;
  groupMemberStatus?: string;
}

/**
 * **Darf man die Anmeldungen sehen?** `administer groups` oder „Gruppen eines Gruppentyps sehen“ mit der Gruppenart
 * „Anmeldung“ (oder „Alle“, -1) – aus `GET /permissions/global` → `churchdb` (gemessen 27.11.2026: `[5]` nach dem Setzen).
 */
export function siehtAnmeldungen(global: unknown, anmeldungTyp: number): boolean {
  const db = (global as { churchdb?: Record<string, unknown> } | null)?.churchdb;
  if (db?.['administer groups'] === true) return true;
  const typen = db?.['view groups of grouptype'];
  return Array.isArray(typen) && typen.some((t) => Number(t) === anmeldungTyp || Number(t) === -1);
}

/**
 * **Wen trägt der Lauf für diese Art in dieser Veranstaltung ein?** Die eine Regel (E30). `drin`: wer schon in der
 * Nachweis-Gruppe steht; `gemerkt`: der Merkzettel dieser Veranstaltung. `neu` = einzutragen, `erledigt` = braucht es und
 * steht schon drin (kommt mit auf den Merkzettel).
 */
export function eintragPlan(
  e: OeffentlicheEinstellungen,
  art: number,
  anmeldungen: readonly ListenAnmeldung[],
  admin: boolean,
  drin: ReadonlySet<number>,
  gemerkt: ReadonlySet<number>,
): { neu: number[]; erledigt: number[] } {
  const bedarf = nachweisBedarfVon(e, art);
  if (!bedarf || (bedarf.fuer === 'nurWenn' && !admin)) return { neu: [], erledigt: [] };
  const brauchen = new Set<number>();
  for (const x of anmeldungen)
    for (const p of x.personen)
      if (zaehltFuerNachweis(e, bedarf, { x, p })) brauchen.add(p.personId);
  const liste = [...brauchen].sort((a, b) => a - b);
  return {
    neu: liste.filter((p) => !drin.has(p) && !gemerkt.has(p)),
    erledigt: liste.filter((p) => drin.has(p)),
  };
}

const zuMenge = (m: readonly ArtMitglied[]) =>
  new Set(m.map((x) => x.personId).filter((x): x is number => typeof x === 'number'));

/** In ein Verzeichnis Art → Veranstaltung → Personen eintragen. */
function merke(
  ziel: Map<number, Map<number, Set<number>>>,
  art: number,
  v: number,
  personen: Iterable<number>,
) {
  const jeV = ziel.get(art) ?? new Map<number, Set<number>>();
  const s = jeV.get(v) ?? new Set<number>();
  for (const p of personen) s.add(p);
  jeV.set(v, s);
  ziel.set(art, jeV);
}

/** **Der Lauf.** Wirft bei Lesefehlern vor dem Eintragen (dann ist nichts geschehen). */
export async function nachweiseEintragen(
  port: EintragPort,
  k: EintragKontext,
): Promise<EintragErgebnis> {
  const max = k.max ?? EINTRAGEN_MAX;
  const pause = k.pause ?? EINTRAGEN_PAUSE_MS;
  const ergebnis: EintragErgebnis = { arten: [], neu: new Map(), verweigert: [], abbruch: null };
  const mitgliederDerArt = (g: number) => port.alleSeiten<ArtMitglied>(`/groups/${g}/members`);

  // 1. Meine Arten: fertig eingerichtet und (ohne Admin) von mir geleitet – samt allen, die schon drinstehen.
  const drin = new Map<number, Set<number>>();
  const gruppen = await port.alleSeiten<GruppeRoh>(
    `/groups?group_type_ids[]=${k.nachweisTyp}&group_status_ids[]=1`,
  );
  for (const g of gruppen) {
    const einstellungen = nachweisEinstellungenLesen(g.information?.note);
    if (!einstellungen) continue;
    let m: ArtMitglied[];
    try {
      m = await mitgliederDerArt(g.id);
    } catch (e) {
      // Eine Art, deren Mitglieder man nicht sehen darf, ist nicht meine – alles andere kann vorübergehend sein.
      if (port.fehlerArt(e) === 'keinRecht') continue;
      throw e;
    }
    const leite = m.some(
      (x) =>
        x.personId === k.ich &&
        x.groupTypeRoleId === k.leiterRolle &&
        x.groupMemberStatus === 'active',
    );
    if (!k.admin && !leite) continue;
    drin.set(g.id, zuMenge(m));
    ergebnis.arten.push({ id: g.id, name: nachweisNameAus(g.name ?? ''), einstellungen });
  }
  if (ergebnis.arten.length === 0) return ergebnis;

  // 2. Die Ablage: ohne sie kein Merkzettel – dann wird auch nicht eingetragen (E34).
  const modul = await port.modulId();
  const kategorie = await kategorieSuchen(port.modul, modul, NACHWEIS_STAND_KATEGORIE.kuerzel);
  if (kategorie === null) return { ...ergebnis, abbruch: 'ohneAblage' };
  const angaben = artAngabenAus(await werteLesen(port.modul, modul, kategorie));
  const namenAbgleichen = (
    dazu?: Map<number, Map<number, Set<number>>>,
    laufend?: ReadonlySet<number>,
  ) =>
    artAngabenAbgleichen(
      port.modul,
      modul,
      kategorie,
      ergebnis.arten.map((a) => ({
        gruppe: a.id,
        name: a.name,
        dazu: new Map([...(dazu?.get(a.id) ?? [])].map(([v, s]) => [v, [...s]])),
        laufend,
      })),
      k.verweigert,
    );

  // 3. Darf ich die Anmeldungen sehen? Sonst wären leere Listen gelogen (M11) – nur die Namen ablegen (E35).
  if (!siehtAnmeldungen(await port.holen<unknown>('/permissions/global'), k.anmeldungTyp)) {
    await namenAbgleichen();
    return { ...ergebnis, abbruch: 'ohneRecht' };
  }

  // 4. Die laufenden Veranstaltungen (Ende ≥ heute).
  const laufend: { id: number; e: OeffentlicheEinstellungen }[] = [];
  for (const g of await port.alleSeiten<GruppeRoh>(
    `/groups?group_type_ids[]=${k.anmeldungTyp}&group_status_ids[]=1`,
  )) {
    const e = einstellungenLesen(g.information?.note);
    if (e && phaseVon(g.information?.groupStatusId ?? 1, e.termin, k.heute) === 'anstehend')
      laufend.push({ id: g.id, e });
  }

  // 5. Plan je Veranstaltung und Art.
  const plan: { art: number; v: number; person: number }[] = [];
  const erledigt = new Map<number, Map<number, Set<number>>>();
  for (const v of laufend) {
    const relevant = ergebnis.arten.filter((a) => {
      const b = nachweisBedarfVon(v.e, a.id);
      return b && (b.fuer === 'alle' || k.admin);
    });
    if (relevant.length === 0) continue;
    const roh = await port.alleSeiten<MitgliedRoh>(`/groups/${v.id}/members`);
    const mitBedingung = relevant.some((a) => nachweisBedarfVon(v.e, a.id)?.fuer === 'nurWenn');
    const felder = mitBedingung
      ? gruppenfelderAus(
          await port.holen<{ type?: string; field?: CtGruppenfeld }[]>(
            `/groups/${v.id}/memberfields`,
          ),
        )
      : new Map<number, CtGruppenfeld>();
    const stand = mitgliederstandAus(roh, [], felder, k.leitung, new Map());
    const anmeldungen = anmeldungenAus(v.e, stand, k.heute);
    for (const a of relevant) {
      const gemerkt = new Set(angaben.get(a.id)?.eingetragen.get(v.id) ?? []);
      const p = eintragPlan(v.e, a.id, anmeldungen, k.admin, drin.get(a.id)!, gemerkt);
      merke(erledigt, a.id, v.id, p.erledigt);
      for (const person of p.neu) plan.push({ art: a.id, v: v.id, person });
    }
  }

  // 6. Eintragen – der Reihe nach, mit Pause; jede Person je Art nur einmal (auch wenn sie in zwei Veranstaltungen ist).
  const versucht = new Map<number, Set<number>>();
  const schonDrin = new Map<number, Set<number>>();
  const gesperrt = new Set<number>();
  let n = 0;
  for (const { art, person } of plan) {
    if (gesperrt.has(art) || versucht.get(art)?.has(person)) continue;
    if (n >= max) {
      ergebnis.abbruch = 'obergrenze';
      break;
    }
    if (n > 0) await port.warte(pause);
    n++;
    try {
      await port.anlegen(art, person, k.teilnehmerRolle);
    } catch (e) {
      const f = port.fehlerArt(e);
      if (f === 'bremse' || f === 'voruebergehend') return { ...ergebnis, abbruch: f };
      if (f === 'keinRecht') {
        gesperrt.add(art);
        ergebnis.verweigert.push(art);
        continue;
      }
      schonDrin.set(art, new Set([...(schonDrin.get(art) ?? []), person]));
    }
    versucht.set(art, new Set([...(versucht.get(art) ?? []), person]));
  }

  // 7. Nachlesen: nur wer jetzt wirklich in der Gruppe steht, zählt (ein 200 ist kein Beleg).
  for (const [art, personen] of versucht) {
    const jetzt = zuMenge(await mitgliederDerArt(art));
    const bestaetigt = [...personen].filter((p) => jetzt.has(p));
    const neu = bestaetigt.filter((p) => !schonDrin.get(art)?.has(p));
    if (neu.length) ergebnis.neu.set(art, neu);
    for (const { art: a, v, person } of plan)
      if (a === art && bestaetigt.includes(person)) merke(erledigt, art, v, [person]);
  }

  // 8. Merkzettel und Namen – frisch gelesen, zusammengeführt, nur bei Änderung.
  await namenAbgleichen(erledigt, new Set(laufend.map((v) => v.id)));
  return ergebnis;
}
