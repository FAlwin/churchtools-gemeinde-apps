/**
 * **Der Plan „neue Gliederung“** (Bauplan O7, Alwin 24.10.2026; Entwurf `o7-plan-v1` abgenommen). Nur die Regeln.
 *
 * Gespeichert werden nur die **Änderungen gegenüber heute** – neue Gruppen, Umhängen, Umbenennen, Archivieren. „Plan
 * anlegen“ ist damit eine Kopie von heute (keine Änderungen), und eine Gruppe, die später jemand direkt in ChurchTools
 * anlegt, erscheint von selbst im Plan. Neue Gruppen haben eine eigene ID (`n1`, `n2` …), bis sie angelegt sind.
 *
 * Die **Umbau-Schritte** ergeben sich aus dem Unterschied zu heute, in dieser Reihenfolge: neu anlegen → umhängen →
 * umbenennen → archivieren. Ein Schritt ist **erledigt**, sobald ChurchTools so aussieht wie der Plan – auch wenn ihn
 * jemand direkt in ChurchTools gemacht hat. Was in eine noch nicht angelegte Gruppe soll, **wartet** auf sie.
 *
 * Umhängen setzt im Plan EINE Obergruppe (wie die Erweiterung sie zeigt); der Schritt ersetzt alle heutigen.
 */
import type { OrgGruppe } from './gruppen';
import { untergruppenVon } from './struktur';

/** Eine Gruppe im Plan: ChurchTools-ID oder eigene ID einer neuen Gruppe (`n1` …). */
export type Ref = number | string;

export interface NeueGruppePlan {
  id: string;
  name: string;
  typId: number;
  eltern: Ref | null;
}

export interface PlanAenderungen {
  neu: NeueGruppePlan[];
  /** Neue Obergruppe je ChurchTools-Gruppe (`null` = eigener Bereich). Schlüssel als Text (JSON). */
  eltern: Record<string, Ref | null>;
  namen: Record<string, string>;
  archiv: number[];
  /**
   * Vom Umbau angelegte Gruppen (ChurchTools-IDs, O7-3) – damit „angelegt“ als erledigter Schritt stehen bleibt, statt
   * aus der Liste zu verschwinden. Fehlt in älteren Plänen.
   */
  angelegt?: number[];
}

export const KEINE_AENDERUNGEN: PlanAenderungen = { neu: [], eltern: {}, namen: {}, archiv: [] };

/** Woran der Plan im Speicher der Erweiterung erkannt wird. */
export const PLAN_ART = { art: 'organigramm-plan', fassung: 1 };

export interface PlanGruppe {
  ref: Ref;
  name: string;
  typId: number | null;
  eltern: Ref | null;
  neu: boolean;
  archiv: boolean;
  /** Wie heute in ChurchTools – `null` bei neuen Gruppen. */
  heute: { name: string; eltern: number | null } | null;
}

/** Heute in ChurchTools: Gruppen und ihre Obergruppen (wie `Start`). */
export interface Heute {
  gruppen: readonly OrgGruppe[];
  eltern: ReadonlyMap<number, readonly number[]>;
}

/** Die Obergruppe, wie die Erweiterung sie zeigt: die erste sichtbare. */
function heuteEltern(h: Heute, id: number): number | null {
  const sichtbar = new Set(h.gruppen.map((g) => g.id));
  return (h.eltern.get(id) ?? []).find((e) => sichtbar.has(e)) ?? null;
}

const schluessel = (ref: Ref) => String(ref);

/** Der Plan als Liste: heute + Änderungen. Verweise auf Gruppen, die es nicht mehr gibt, zeigen auf „eigener Bereich“. */
export function planGruppen(h: Heute, a: PlanAenderungen): PlanGruppe[] {
  const archiv = new Set(a.archiv);
  const da = new Set<Ref>([...h.gruppen.map((g) => g.id), ...a.neu.map((n) => n.id)]);
  const gueltig = (r: Ref | null) => (r !== null && da.has(r) ? r : null);
  const alt = h.gruppen.map((g): PlanGruppe => {
    const k = schluessel(g.id);
    const vorher = heuteEltern(h, g.id);
    return {
      ref: g.id,
      name: a.namen[k] ?? g.name,
      typId: g.typId,
      eltern: k in a.eltern ? gueltig(a.eltern[k]) : vorher,
      neu: false,
      archiv: archiv.has(g.id),
      heute: { name: g.name, eltern: vorher },
    };
  });
  const neu = a.neu.map(
    (n): PlanGruppe => ({
      ref: n.id,
      name: n.name,
      typId: n.typId,
      eltern: gueltig(n.eltern),
      neu: true,
      archiv: false,
      heute: null,
    }),
  );
  return [...alt, ...neu];
}

/** Alle Gruppen im Plan unter `ref` (für „kein Kreis“ beim Einhängen). */
export function planUntergruppen(plan: readonly PlanGruppe[], ref: Ref): Set<Ref> {
  const eltern = new Map<Ref, Ref[]>(
    plan.flatMap((g) => (g.eltern === null ? [] : [[g.ref, [g.eltern]] as [Ref, Ref[]]])),
  );
  return untergruppenVon<Ref>(eltern, ref);
}

// ── Änderungen (rein, liefern neue Änderungen) ───────────────────────────────

function ohne<T>(r: Record<string, T>, k: string): Record<string, T> {
  const { [k]: _weg, ...rest } = r;
  return rest;
}

export function umbenennen(h: Heute, a: PlanAenderungen, ref: Ref, name: string): PlanAenderungen {
  const n = name.trim();
  if (typeof ref === 'string') {
    return { ...a, neu: a.neu.map((x) => (x.id === ref ? { ...x, name: n } : x)) };
  }
  const heute = h.gruppen.find((g) => g.id === ref)?.name;
  const k = schluessel(ref);
  return { ...a, namen: n === heute ? ohne(a.namen, k) : { ...a.namen, [k]: n } };
}

export function einhaengen(
  h: Heute,
  a: PlanAenderungen,
  ref: Ref,
  eltern: Ref | null,
): PlanAenderungen {
  if (typeof ref === 'string') {
    return { ...a, neu: a.neu.map((x) => (x.id === ref ? { ...x, eltern } : x)) };
  }
  const k = schluessel(ref);
  return {
    ...a,
    eltern: eltern === heuteEltern(h, ref) ? ohne(a.eltern, k) : { ...a.eltern, [k]: eltern },
  };
}

export function neueGruppe(
  a: PlanAenderungen,
  name: string,
  typId: number,
  eltern: Ref | null,
): { aenderungen: PlanAenderungen; id: string } {
  const nr = Math.max(0, ...a.neu.map((x) => Number(x.id.slice(1)) || 0)) + 1;
  const id = `n${nr}`;
  return { aenderungen: { ...a, neu: [...a.neu, { id, name: name.trim(), typId, eltern }] }, id };
}

export function archivieren(a: PlanAenderungen, id: number, ja: boolean): PlanAenderungen {
  const rest = a.archiv.filter((x) => x !== id);
  return { ...a, archiv: ja ? [...rest, id] : rest };
}

/** Eine ChurchTools-Gruppe im Plan wieder wie heute: Name, Obergruppe, nicht archiviert. */
export function wieHeute(a: PlanAenderungen, id: number): PlanAenderungen {
  const k = schluessel(id);
  return {
    ...a,
    eltern: ohne(a.eltern, k),
    namen: ohne(a.namen, k),
    archiv: a.archiv.filter((x) => x !== id),
  };
}

/**
 * Eine neue Gruppe wieder aus dem Plan nehmen – samt neuer Gruppen darunter. Bestehende Gruppen, die der Plan in sie
 * hängen wollte, bleiben, wo sie heute sind.
 */
export function neueEntfernen(h: Heute, a: PlanAenderungen, id: string): PlanAenderungen {
  const unter = planUntergruppen(planGruppen(h, a), id);
  const weg = new Set<Ref>([id, ...[...unter].filter((r) => typeof r === 'string')]);
  return {
    ...a,
    neu: a.neu.filter((x) => !weg.has(x.id)),
    eltern: Object.fromEntries(
      Object.entries(a.eltern).filter(([, e]) => e === null || !weg.has(e)),
    ),
  };
}

/** Nach dem Anlegen in ChurchTools: die eigene ID überall durch die echte ersetzen – und sie als angelegt merken. */
export function angelegt(a: PlanAenderungen, id: string, ctId: number): PlanAenderungen {
  const ersetze = (r: Ref | null) => (r === id ? ctId : r);
  return {
    ...a,
    angelegt: [...(a.angelegt ?? []).filter((x) => x !== ctId), ctId],
    neu: a.neu.filter((x) => x.id !== id).map((x) => ({ ...x, eltern: ersetze(x.eltern) })),
    eltern: Object.fromEntries(Object.entries(a.eltern).map(([k, e]) => [k, ersetze(e)])),
  };
}

// ── Umbau-Schritte ───────────────────────────────────────────────────────────

export type Schritt =
  | {
      art: 'neu';
      id: string;
      name: string;
      typId: number;
      /** Obergruppe in ChurchTools-ID, sobald es sie gibt (auch eine schon gefundene neue); sonst die eigene ID. */
      eltern: Ref | null;
      erledigt: boolean;
      wartetAuf: string | null;
      gefunden: number | null;
      /** Der Plan kennt die echte ID schon (vom Umbau angelegt) – sonst ist eine gefundene „im Plan zu übernehmen“. */
      vermerkt: boolean;
    }
  | { art: 'um'; id: number; eltern: Ref | null; erledigt: boolean; wartetAuf: string | null }
  | { art: 'name'; id: number; name: string; erledigt: boolean; wartetAuf: null }
  | {
      art: 'arch';
      id: number;
      erledigt: boolean;
      wartetAuf: null;
      /** Gruppen, die in ChurchTools noch darunter hängen – solange es welche gibt, wartet das Archivieren. */
      untergruppen: number[];
    };

/**
 * Was zu tun ist, in der Reihenfolge, in der es geht. `archiviert` sind die Gruppen (ID → Name), die in ChurchTools den
 * Status „archiviert“ haben (`null` = unbekannt → Archivieren gilt nie als erledigt). Eigens geladen, weil ChurchTools
 * archivierte Gruppen weder in der Gruppenliste noch in der Hierarchie liefert (Messung O7-3, 24.10.2026).
 *
 * Archivieren **wartet**, solange in ChurchTools noch Gruppen darunter hängen – sonst stünden sie danach als eigene
 * Bereiche da (Alwin, 24.10.2026). Eine neue Gruppe, die es in ChurchTools schon gibt (`gefunden`), hält niemanden
 * mehr auf: Wer auf sie wartet, bekommt ihre ChurchTools-ID.
 */
export function umbauSchritte(
  h: Heute,
  a: PlanAenderungen,
  archiviert: ReadonlyMap<number, string> | null,
): Schritt[] {
  // Schon angelegt (z. B. direkt in ChurchTools, oder das Speichern danach ging schief)? Gleicher Name unter
  // derselben Obergruppe – über die Reihenfolge, damit auch eine neue unter einer gefundenen neuen gefunden wird.
  const gefunden = new Map<string, number>();
  const aufgeloest = (e: Ref | null): Ref | null =>
    typeof e === 'string' ? (gefunden.get(e) ?? e) : e;
  // Eine eigene ID, die (noch) keine ChurchTools-ID hat, heißt immer: warten – nie mit ihr nach ChurchTools.
  const wartet = (e: Ref | null) => {
    const r = aufgeloest(e);
    return typeof r === 'string' ? r : null;
  };
  const s: Schritt[] = [];
  // Vom Umbau angelegt: bleiben als erledigt stehen (solange es sie in ChurchTools gibt).
  for (const ctId of a.angelegt ?? []) {
    const g = h.gruppen.find((x) => x.id === ctId);
    if (!g) continue;
    s.push({
      art: 'neu',
      id: `angelegt-${ctId}`,
      name: g.name,
      typId: g.typId ?? 0,
      eltern: heuteEltern(h, ctId),
      erledigt: true,
      wartetAuf: null,
      gefunden: ctId,
      vermerkt: true,
    });
  }
  for (const n of a.neu) {
    const oben = aufgeloest(n.eltern);
    const da =
      typeof oben === 'string'
        ? null
        : (h.gruppen.find(
            (g) =>
              g.name.trim().toLowerCase() === n.name.toLowerCase() &&
              (oben === null
                ? (h.eltern.get(g.id) ?? []).length === 0
                : (h.eltern.get(g.id) ?? []).includes(oben)),
          )?.id ?? null);
    if (da !== null) gefunden.set(n.id, da);
    s.push({
      art: 'neu',
      id: n.id,
      name: n.name,
      typId: n.typId,
      eltern: oben,
      erledigt: da !== null,
      wartetAuf: da !== null ? null : wartet(n.eltern),
      gefunden: da,
      vermerkt: false,
    });
  }
  for (const [k, roh] of Object.entries(a.eltern)) {
    const id = Number(k);
    if (!h.gruppen.some((g) => g.id === id)) continue;
    const e = aufgeloest(roh);
    const jetzt = h.eltern.get(id) ?? [];
    const erledigt = e === null ? jetzt.length === 0 : jetzt.length === 1 && jetzt[0] === e;
    s.push({ art: 'um', id, eltern: e, erledigt, wartetAuf: erledigt ? null : wartet(e) });
  }
  for (const [k, name] of Object.entries(a.namen)) {
    const id = Number(k);
    // Auch nach dem Archivieren (dann nur noch in der eigenen Liste mit Namen) – sonst fiele der Schritt weg.
    const jetzt = h.gruppen.find((x) => x.id === id)?.name ?? archiviert?.get(id);
    if (jetzt !== undefined)
      s.push({ art: 'name', id, name, erledigt: jetzt === name, wartetAuf: null });
  }
  for (const id of a.archiv) {
    const schon = archiviert?.has(id) ?? false;
    // Weder in ChurchTools zu sehen noch archiviert → gibt es nicht mehr; der Schritt fällt weg.
    if (!schon && !h.gruppen.some((x) => x.id === id)) continue;
    const untergruppen = schon
      ? []
      : h.gruppen.filter((x) => (h.eltern.get(x.id) ?? []).includes(id)).map((x) => x.id);
    s.push({ art: 'arch', id, erledigt: schon, wartetAuf: null, untergruppen });
  }
  return s;
}

/** Kann der Schritt jetzt ausgeführt werden? (Nicht erledigt, wartet auf nichts, nichts hängt mehr darunter.) */
export function ausfuehrbar(x: Schritt): boolean {
  if (x.erledigt || x.wartetAuf !== null) return false;
  return x.art !== 'arch' || x.untergruppen.length === 0;
}

/**
 * „Rückgängig“ nach dem Anlegen (O7-3): die genaue Umkehrung von `angelegt` – die neue Gruppe steht wieder mit ihrer
 * eigenen ID im Plan, alle Verweise auf die ChurchTools-ID zeigen wieder auf sie.
 */
export function nichtAngelegt(
  a: PlanAenderungen,
  gruppe: NeueGruppePlan,
  ctId: number,
): PlanAenderungen {
  const zurueck = (r: Ref | null) => (r === ctId ? gruppe.id : r);
  const { angelegt: schon, ...rest } = a;
  const bleibt = (schon ?? []).filter((x) => x !== ctId);
  return {
    ...rest,
    ...(bleibt.length ? { angelegt: bleibt } : {}),
    neu: [...a.neu.map((x) => ({ ...x, eltern: zurueck(x.eltern) })), gruppe],
    eltern: Object.fromEntries(Object.entries(a.eltern).map(([k, e]) => [k, zurueck(e)])),
  };
}

/**
 * **Gespeicherten Inhalt prüfen** – was aus dem Speicher kommt, ist Text von irgendwem (ältere Fassung, Hand-Eingriff).
 * Ungültige Teile fallen weg statt die Seite zu brechen; `null`, wenn es gar kein Plan ist.
 */
export function planAus(roh: unknown): PlanAenderungen | null {
  if (!roh || typeof roh !== 'object') return null;
  const r = roh as Record<string, unknown>;
  const istRef = (x: unknown): x is Ref =>
    (typeof x === 'number' && Number.isInteger(x)) || (typeof x === 'string' && /^n\d+$/.test(x));
  const neu = Array.isArray(r.neu)
    ? r.neu.flatMap((x: unknown) => {
        const n = x as Partial<NeueGruppePlan> | null;
        return n &&
          typeof n.id === 'string' &&
          /^n\d+$/.test(n.id) &&
          typeof n.name === 'string' &&
          n.name.trim() !== '' &&
          typeof n.typId === 'number' &&
          (n.eltern === null || istRef(n.eltern))
          ? [{ id: n.id, name: n.name, typId: n.typId, eltern: n.eltern }]
          : [];
      })
    : [];
  const eintraege = (o: unknown) =>
    o && typeof o === 'object' ? Object.entries(o as Record<string, unknown>) : [];
  const eltern = Object.fromEntries(
    eintraege(r.eltern).filter(([k, e]) => /^\d+$/.test(k) && (e === null || istRef(e))),
  ) as Record<string, Ref | null>;
  const namen = Object.fromEntries(
    eintraege(r.namen).filter(
      ([k, n]) => /^\d+$/.test(k) && typeof n === 'string' && n.trim() !== '',
    ),
  ) as Record<string, string>;
  const archiv = Array.isArray(r.archiv)
    ? r.archiv.filter((x): x is number => typeof x === 'number' && Number.isInteger(x))
    : [];
  const angelegt = Array.isArray(r.angelegt)
    ? r.angelegt.filter((x): x is number => typeof x === 'number' && Number.isInteger(x))
    : [];
  return { neu, eltern, namen, archiv, ...(angelegt.length ? { angelegt } : {}) };
}

/** Hat der Plan überhaupt Änderungen? */
export const hatAenderungen = (a: PlanAenderungen) =>
  a.neu.length > 0 ||
  Object.keys(a.eltern).length > 0 ||
  Object.keys(a.namen).length > 0 ||
  a.archiv.length > 0;

// ── Für die Ansicht (O7-2) ───────────────────────────────────────────────────

export interface PlanKnoten {
  gruppe: PlanGruppe;
  kinder: PlanKnoten[];
}

const nachName = (a: PlanGruppe, b: PlanGruppe) => a.name.localeCompare(b.name, 'de');

/**
 * Der Plan als Baum – Bereiche und Untergruppen nach Namen (wie im Entwurf). Eine Gruppe, die von keinem Bereich aus
 * erreichbar ist, steckt in einem Kreis (der Plan hängt A unter B, inzwischen hängt in ChurchTools B unter A): Dann
 * wird eine Gruppe des Kreises selbst zum Bereich – verschwinden darf nichts.
 */
export function planBaum(plan: readonly PlanGruppe[]): PlanKnoten[] {
  const nach = new Map(plan.map((g) => [g.ref, g]));
  const kinder = new Map<Ref, PlanGruppe[]>();
  for (const g of plan) {
    if (g.eltern !== null) kinder.set(g.eltern, [...(kinder.get(g.eltern) ?? []), g]);
  }
  const gesehen = new Set<Ref>();
  const knoten = (g: PlanGruppe): PlanKnoten => {
    gesehen.add(g.ref);
    const unter = (kinder.get(g.ref) ?? []).filter((k) => !gesehen.has(k.ref)).sort(nachName);
    return { gruppe: g, kinder: unter.map(knoten) };
  };
  const wurzeln = plan
    .filter((g) => g.eltern === null)
    .sort(nachName)
    .map(knoten);
  for (const g of [...plan].sort(nachName)) {
    if (gesehen.has(g.ref)) continue;
    // Nach oben laufen, bis sich der Weg schließt – diese Gruppe liegt im Kreis.
    let x = g;
    const weg = new Set<Ref>();
    while (x.eltern !== null && !weg.has(x.ref)) {
      weg.add(x.ref);
      const oben = nach.get(x.eltern);
      if (!oben) break;
      x = oben;
    }
    wurzeln.push(knoten(x));
  }
  return wurzeln;
}

export type PlanMarke = 'neu' | 'umgehängt' | 'umbenannt' | 'wird archiviert';

/** Was sich an einer Gruppe gegenüber heute ändert: Marken und „vorher …“ (Entwurf o7-plan-v1). */
export function planUnterschied(
  g: PlanGruppe,
  nameVon: (id: number) => string,
): { marken: PlanMarke[]; vorher: string | null } {
  if (g.neu || !g.heute) return { marken: ['neu'], vorher: null };
  const marken: PlanMarke[] = [];
  const vorher: string[] = [];
  if (g.archiv) marken.push('wird archiviert');
  if (g.eltern !== g.heute.eltern) {
    marken.push('umgehängt');
    vorher.push(
      g.heute.eltern === null
        ? 'vorher eigener Bereich'
        : `vorher unter „${nameVon(g.heute.eltern)}“`,
    );
  }
  if (g.name !== g.heute.name) {
    marken.push('umbenannt');
    vorher.push(`vorher „${g.heute.name}“`);
  }
  return { marken, vorher: vorher.length ? vorher.join(' · ') : null };
}

/**
 * Wohin eine Gruppe im Plan gehängt werden kann – wie `moeglicheObergruppen` für heute: jede Gruppe des Plans außer
 * ihr selbst, ihren Untergruppen (Kreis), ihrer jetzigen Obergruppe und Gruppen, die archiviert werden. Sortiert nach
 * dem Weg von oben.
 */
export function planZiele(
  plan: readonly PlanGruppe[],
  ref: Ref,
): { gruppe: PlanGruppe; pfad: string[] }[] {
  const nach = new Map(plan.map((g) => [g.ref, g]));
  const raus = planUntergruppen(plan, ref);
  raus.add(ref);
  const oben = nach.get(ref)?.eltern ?? null;
  if (oben !== null) raus.add(oben);
  const pfad = (g: PlanGruppe) => {
    const p: string[] = [];
    const weg = new Set<Ref>();
    for (let x: PlanGruppe | undefined = g; x && !weg.has(x.ref); ) {
      weg.add(x.ref);
      p.unshift(x.name);
      x = x.eltern === null ? undefined : nach.get(x.eltern);
    }
    return p;
  };
  return plan
    .filter((g) => !raus.has(g.ref) && !g.archiv)
    .map((g) => ({ gruppe: g, pfad: pfad(g) }))
    .sort((a, b) => a.pfad.join(' › ').localeCompare(b.pfad.join(' › '), 'de'));
}
