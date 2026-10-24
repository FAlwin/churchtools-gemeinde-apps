/**
 * **Gruppen umhängen und anlegen** (Bauplan O5, Alwin 23.10.2026). Nur die Regeln; wie geschrieben wird, reicht der
 * Aufrufer herein (`StrukturZugriff`) – im Browser die Sitzung der Seite, im Test ein Nachbau.
 *
 * Gemessen an der Test-Instanz (O0 §1/§2, 22.10.2026):
 * - Obergruppe setzen `PUT /groups/{id}/parents/{p}` (schon gesetzt → 400, das zählt als erledigt), lösen
 *   `DELETE …` (immer 204, auch wenn schon weg). Eine Gruppe kann mehrere Obergruppen haben.
 * - **Umhängen = erst die neue setzen, dann die alte lösen** – dazwischen hängt die Gruppe kurz unter beiden, nie unter
 *   keiner. Ein Kreis (Gruppe unter ihre eigene Untergruppe) wird abgelehnt; wir bieten ihn gar nicht erst an.
 * - Anlegen `POST /groups` mit `parentGroupId` setzt die Obergruppe gleich mit.
 *
 * **Nach jedem Schreiben wird nachgelesen** (Lehre 11.08.2026: ein Erfolgssignal ist kein Beleg). Was dann nicht
 * stimmt, ist ein Fehler mit genau dieser Aussage. Kein Schreibvorgang wird automatisch wiederholt.
 */
import type { OrgGruppe } from './gruppen';

export interface StrukturZugriff {
  /** Die Obergruppen einer Gruppe – frisch aus ChurchTools. */
  obergruppen(gruppeId: number): Promise<number[]>;
  /** Obergruppe setzen; „schon gesetzt“ ist kein Fehler. */
  setzen(gruppeId: number, elternId: number): Promise<void>;
  /** Obergruppe lösen; „schon weg“ ist kein Fehler. */
  loesen(gruppeId: number, elternId: number): Promise<void>;
  /** Gruppe anlegen – liefert die neue ID. */
  anlegen(d: NeueGruppe): Promise<number>;
  /** Gibt es die Gruppe (noch)? */
  gibtEs(gruppeId: number): Promise<boolean>;
  loeschen(gruppeId: number): Promise<void>;
  /** Fehler „ChurchTools hat … nicht übernommen“ in der Fehlerklasse des Aufrufers. */
  nichtUebernommen(was: string): Error;
}

export interface NeueGruppe {
  name: string;
  typId: number;
  statusId: number;
  /** `null` = ein neuer Bereich ohne Obergruppe (Umbau O7-3). */
  elternId: number | null;
}

/** Obergruppe ersetzen: erst `neu` setzen, dann `alt` lösen, nachlesen. Liefert die Obergruppen danach. */
export async function obergruppeAendern(
  z: StrukturZugriff,
  gruppeId: number,
  alt: number,
  neu: number,
): Promise<number[]> {
  await z.setzen(gruppeId, neu);
  let loesFehler: unknown = null;
  try {
    await z.loesen(gruppeId, alt);
  } catch (e) {
    loesFehler = e;
  }
  const ist = await z.obergruppen(gruppeId);
  if (!ist.includes(neu)) throw z.nichtUebernommen('die neue Obergruppe');
  if (ist.includes(alt)) {
    // Die Gruppe hängt jetzt unter beiden – das sagt der Fehler; der Baum zeigt es nach dem Neuladen.
    if (loesFehler instanceof Error) throw loesFehler;
    throw z.nichtUebernommen('das Lösen von der bisherigen Obergruppe');
  }
  return ist;
}

/** Eine weitere Obergruppe dazu. */
export async function obergruppeDazu(
  z: StrukturZugriff,
  gruppeId: number,
  neu: number,
): Promise<number[]> {
  await z.setzen(gruppeId, neu);
  const ist = await z.obergruppen(gruppeId);
  if (!ist.includes(neu)) throw z.nichtUebernommen('die weitere Obergruppe');
  return ist;
}

/** Von einer Obergruppe lösen – war es die letzte, ist die Gruppe danach ein eigener Bereich. */
export async function obergruppeLoesen(
  z: StrukturZugriff,
  gruppeId: number,
  alt: number,
): Promise<number[]> {
  await z.loesen(gruppeId, alt);
  const ist = await z.obergruppen(gruppeId);
  if (ist.includes(alt)) throw z.nichtUebernommen('das Lösen von der Obergruppe');
  return ist;
}

/**
 * Untergruppe (oder ohne Obergruppe: einen Bereich) anlegen und nachlesen: Gibt es sie, und hängt sie, wo sie soll?
 * Liefert die neue ID.
 */
export async function untergruppeAnlegen(z: StrukturZugriff, d: NeueGruppe): Promise<number> {
  const id = await z.anlegen(d);
  if (!(await z.gibtEs(id))) throw z.nichtUebernommen('die neue Gruppe');
  const oben = await z.obergruppen(id);
  if (d.elternId === null ? oben.length > 0 : !oben.includes(d.elternId)) {
    throw z.nichtUebernommen('die Obergruppe der neuen Gruppe');
  }
  return id;
}

/**
 * **Obergruppen genau so setzen** (Umbau O7-3: „Umhängen ersetzt alle heutigen Obergruppen“; auch für Rückgängig):
 * erst die fehlenden setzen, dann die überzähligen lösen – wie beim Umhängen hängt die Gruppe dazwischen nie unter
 * keiner. Nachgelesen muss es genau `ziel` sein. Liefert die Obergruppen von vorher.
 */
export async function obergruppenGenau(
  z: StrukturZugriff,
  gruppeId: number,
  ziel: readonly number[],
): Promise<number[]> {
  const vorher = await z.obergruppen(gruppeId);
  for (const e of ziel) if (!vorher.includes(e)) await z.setzen(gruppeId, e);
  for (const e of vorher) if (!ziel.includes(e)) await z.loesen(gruppeId, e);
  const ist = await z.obergruppen(gruppeId);
  if (ist.length !== new Set(ziel).size || ziel.some((e) => !ist.includes(e))) {
    throw z.nichtUebernommen(ziel.length ? 'die neue Obergruppe' : 'das Lösen von der Obergruppe');
  }
  return vorher;
}

/** „Rückgängig“ nach dem Anlegen: die neue (leere) Gruppe wieder löschen und nachlesen. */
export async function gruppeWiederLoeschen(z: StrukturZugriff, gruppeId: number): Promise<void> {
  await z.loeschen(gruppeId);
  if (await z.gibtEs(gruppeId)) throw z.nichtUebernommen('das Löschen der Gruppe');
}

/** Alle Gruppen unter `id` über die ganze Hierarchie (nicht nur die sichtbaren Zweige), jede einmal. */
export function untergruppenVon<K = number>(eltern: ReadonlyMap<K, readonly K[]>, id: K): Set<K> {
  // Allgemein über den Schlüssel: der Plan (O7) hat neben ChurchTools-IDs auch eigene für neue Gruppen.
  const kinder = new Map<K, K[]>();
  for (const [kind, liste] of eltern)
    for (const e of liste) kinder.set(e, [...(kinder.get(e) ?? []), kind]);
  const s = new Set<K>();
  const lauf = (x: K) => {
    for (const k of kinder.get(x) ?? []) {
      if (s.has(k) || k === id) continue;
      s.add(k);
      lauf(k);
    }
  };
  lauf(id);
  return s;
}

/**
 * **Sieht man die Gruppe nach der Änderung weiter über `alt`?** Ja, wenn eine der Obergruppen, die ihr bleiben, `alt`
 * selbst ist oder unter `alt` liegt – Rechte wirken nach unten (O0 §5). Dann stimmt „wer sie nur über … sah, sieht
 * sie nicht mehr“ nicht (gefunden bei der Abnahme 23.10.2026: B von A nach C umgehängt, C liegt unter A). EINE Regel
 * für Ändern und Lösen.
 */
export function weiterSichtbarUeber(
  eltern: ReadonlyMap<number, readonly number[]>,
  alt: number,
  bleibende: readonly number[],
): boolean {
  const darunter = untergruppenVon(eltern, alt);
  return bleibende.some((b) => b === alt || darunter.has(b));
}

/** Der Weg von oben bis zur Gruppe („Gottesdienst › Technik“) – über die jeweils erste Obergruppe, kreisfest. */
export function pfadVon(
  gruppen: readonly OrgGruppe[],
  eltern: ReadonlyMap<number, readonly number[]>,
  id: number,
): string[] {
  const name = new Map(gruppen.map((g) => [g.id, g.name]));
  const pfad: string[] = [];
  const gesehen = new Set<number>();
  for (let x: number | undefined = id; x !== undefined && !gesehen.has(x); ) {
    gesehen.add(x);
    const n = name.get(x);
    if (n === undefined) break;
    pfad.unshift(n);
    x = (eltern.get(x) ?? []).find((e) => name.has(e));
  }
  return pfad;
}

/**
 * Wohin eine Gruppe gehängt werden kann: jede sichtbare Gruppe außer ihr selbst, ihren Untergruppen (das wäre ein
 * Kreis) und den Obergruppen, die sie schon hat. Sortiert nach dem Weg von oben.
 */
export function moeglicheObergruppen(
  gruppen: readonly OrgGruppe[],
  eltern: ReadonlyMap<number, readonly number[]>,
  id: number,
): { gruppe: OrgGruppe; pfad: string[] }[] {
  const raus = untergruppenVon(eltern, id);
  raus.add(id);
  for (const e of eltern.get(id) ?? []) raus.add(e);
  return gruppen
    .filter((g) => !raus.has(g.id))
    .map((g) => ({ gruppe: g, pfad: pfadVon(gruppen, eltern, g.id) }))
    .sort((a, b) => a.pfad.join(' › ').localeCompare(b.pfad.join(' › '), 'de'));
}

/** Was am Namen einer neuen Gruppe nicht stimmt – `null`, wenn er passt (ChurchTools: 1–255 Zeichen). */
export function nameFehler(name: string): string | null {
  const n = name.trim();
  if (!n) return 'Bitte einen Namen eingeben.';
  if (n.length > 255) return 'Der Name ist zu lang (höchstens 255 Zeichen).';
  return null;
}

/** Der Status „archiviert“ (`archived`, gemessen O7-3: 3) – über den internen Namen; `null`, wenn es ihn nicht gibt. */
export function archivStatus(
  statusse: readonly { id?: unknown; name?: unknown }[] | null | undefined,
): number | null {
  const s = (statusse ?? []).find((x) => x.name === 'archived');
  return typeof s?.id === 'number' ? s.id : null;
}

/**
 * Der Status „aktiv“ für neue Gruppen – über den internen Namen `active` aus den Stammdaten
 * (`/person/masterdata` → `groupStatuses`, gemessen 23.10.2026: 1 active, 2 pending, 3 archived, 4 finished), nicht
 * über eine feste Zahl. Fehlt er, der Status der Obergruppe; sonst `null`.
 */
export function aktivStatus(
  statusse: readonly { id?: unknown; name?: unknown }[] | null | undefined,
  obergruppe: number | null,
): number | null {
  const aktiv = (statusse ?? []).find((s) => s.name === 'active');
  return typeof aktiv?.id === 'number' ? aktiv.id : obergruppe;
}
