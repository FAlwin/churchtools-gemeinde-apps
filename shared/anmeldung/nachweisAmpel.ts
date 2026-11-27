/**
 * **Die Ampel der Leitung** (N3d, Entscheidungen E24, E38 ff.; Entwurf `n-nachweise-v2`, Ansicht „Reiter ‚Anmeldungen‘ –
 * neue Spalte“) – die EINE Regel, aus der Spalte, Filter, Sortierung und der Hinweis „Braucht deine Aufmerksamkeit“ ihre Werte
 * nehmen. Rein: „heute“ und der letzte Tag der Veranstaltung kommen als `YYYY-MM-DD` herein.
 *
 * Die Leitung sieht je Person und Art nur das, was in der Ablage „Nachweis-Stand“ steht (`standFuerLeitung`, E26): ein Tag
 * „gültig bis“, `offen` oder `rot` – **nie** das Ergebnis der Einsicht. Daraus wird:
 *
 * | Wert           | Wann                                                                              | Farbe  |
 * | -------------- | --------------------------------------------------------------------------------- | ------ |
 * | `gueltig`      | Tag ≥ letzter Tag der Veranstaltung („endet genau am letzten Tag“ ist noch gültig) | grün   |
 * | `laeuftAb`     | heute ≤ Tag < letzter Tag – der Nachweis endet mitten in der Veranstaltung        | blau   |
 * | `abgelaufen`   | Tag < heute – schon jetzt kein gültiger Nachweis                                  | rot    |
 * | `fehlt`        | `offen` oder `rot` im Stand                                                       | rot    |
 * | `nochNicht`    | braucht den Nachweis, steht aber nicht im Stand (noch nicht angefordert)          | grau   |
 * | `nichtNoetig`  | braucht ihn laut Veranstaltung nicht (Bedingung trifft nicht zu, wartet)          | –      |
 * | `nichtLesbar`  | der Stand ist für diese Person nicht zu lesen (kein Recht, Lesefehler)            | grau   |
 * | `bedingung`    | die „Nur wenn …“-Frage gibt es nicht mehr – niemand weiß, wer ihn braucht (E29)   | grau   |
 *
 * **Nicht lesbar ist nicht leer** und **eine kaputte Bedingung ist nicht „nicht nötig“** – beide haben einen eigenen Wert.
 * Ohne Termin gilt „heute“ als Stichtag.
 */
import type { StandFuerLeitung } from './nachweisStand';

export type AmpelWert =
  | 'gueltig'
  | 'laeuftAb'
  | 'abgelaufen'
  | 'fehlt'
  | 'nochNicht'
  | 'nichtNoetig'
  | 'nichtLesbar'
  | 'bedingung';

/** Ein Wert, bei den Tagwerten mit dem Tag „gültig bis“ (`YYYY-MM-DD`). */
export interface AmpelFall {
  wert: AmpelWert;
  bis?: string;
}

/** Was aus der Ablage kommt: der Stand der Art (Person → Wert für die Leitung) oder „nicht lesbar“. */
export type AmpelStand =
  | { art: 'gelesen'; personen: ReadonlyMap<number, StandFuerLeitung> }
  | { art: 'nichtLesbar' };

export interface AmpelEingabe {
  /** Die „Nur wenn …“-Frage fehlt (`nachweisProblem` → `frage`, E29). */
  bedingungKaputt: boolean;
  /** Zählt die Person für diese Art (aktiv und braucht laut Veranstaltung den Nachweis, `zaehltFuerNachweis`)? */
  zaehlt: boolean;
  stand: AmpelStand;
  personId: number;
  /** Letzter Tag der Veranstaltung – `null` ohne Termin (dann gilt `heute`). */
  letzterTag: string | null;
  heute: string;
}

/** **Der Wert für eine Person und eine Art** – die Zweige in dieser Reihenfolge (siehe oben). */
export function ampelFuer(a: AmpelEingabe): AmpelFall {
  if (a.bedingungKaputt) return { wert: 'bedingung' };
  if (!a.zaehlt) return { wert: 'nichtNoetig' };
  if (a.stand.art === 'nichtLesbar') return { wert: 'nichtLesbar' };
  const v = a.stand.personen.get(a.personId);
  if (v === undefined) return { wert: 'nochNicht' };
  if (v === 'offen' || v === 'rot') return { wert: 'fehlt' };
  if (v < a.heute) return { wert: 'abgelaufen', bis: v };
  if (v < (a.letzterTag ?? a.heute)) return { wert: 'laeuftAb', bis: v };
  return { wert: 'gueltig', bis: v };
}

/** Der Name des Werts als Antwort im Filter und als Text in der Zelle (ohne Datum). */
export const AMPEL_TEXT: Record<AmpelWert, string> = {
  gueltig: 'gültig',
  laeuftAb: 'läuft vor Ende ab',
  abgelaufen: 'abgelaufen',
  fehlt: 'fehlt',
  nochNicht: 'noch nicht angefordert',
  nichtNoetig: 'nicht nötig',
  nichtLesbar: 'Stand nicht lesbar',
  bedingung: 'Bedingung prüfen',
};

/** `2029-11-20` → `11/2029`. */
export const monatJahr = (tag: string) => `${tag.slice(5, 7)}/${tag.slice(0, 4)}`;

/** Der Text in der Zelle: „gültig bis 11/2029“, sonst `AMPEL_TEXT`. */
export function ampelZelle(f: AmpelFall): string {
  return f.wert === 'gueltig' && f.bis ? `gültig bis ${monatJahr(f.bis)}` : AMPEL_TEXT[f.wert];
}

/** Die Farbe des Etiketts (R9: kein Gelb – „läuft ab“ ist blau); `null`: kein Etikett („nicht nötig“). */
export function ampelTon(w: AmpelWert): 'gruen' | 'blau' | 'rot' | 'neutral' | null {
  switch (w) {
    case 'gueltig':
      return 'gruen';
    case 'laeuftAb':
      return 'blau';
    case 'fehlt':
    case 'abgelaufen':
      return 'rot';
    case 'nochNicht':
    case 'nichtLesbar':
    case 'bedingung':
      return 'neutral';
    case 'nichtNoetig':
      return null;
  }
}

/** Reihenfolge beim Sortieren und bei „der schlechteste Wert einer Anmeldung“: was Aufmerksamkeit braucht, zuerst. */
export function ampelRang(w: AmpelWert): number {
  return (
    [
      'fehlt',
      'abgelaufen',
      'nochNicht',
      'laeuftAb',
      'bedingung',
      'nichtLesbar',
      'gueltig',
      'nichtNoetig',
    ] as const
  ).indexOf(w);
}

/** Zählt für den Hinweis „n ohne gültigen Nachweis“: rot, grau (noch nicht angefordert) und blau – nicht „unbekannt“. */
export const OHNE_GUELTIGEN: ReadonlySet<AmpelWert> = new Set<AmpelWert>([
  'fehlt',
  'abgelaufen',
  'nochNicht',
  'laeuftAb',
]);

// ── Die Lage, die Tabelle und Filter lesen ──────────────────────────────────────────────────────────────────────

/** Eine Art in der Lage einer Veranstaltung. */
export interface AmpelArt {
  /** Name aus der Ablage (E35) – `null`, solange noch keine Vertrauensperson die Erweiterung geöffnet hat. */
  name: string | null;
  /** Die Frage von „Nur wenn …“ fehlt (E29). */
  bedingungKaputt: boolean;
  /** Der Stand ist nicht lesbar. */
  nichtLesbar: boolean;
  /** Person → Wert; leer, solange der Stand noch lädt. */
  ampel: ReadonlyMap<number, AmpelFall>;
}

/**
 * **Die Lage der Ampel einer Veranstaltung** – Art → Werte je Person. Hängt nur zur Laufzeit an den Einstellungen
 * (`OeffentlicheEinstellungen.nachweisLage`, nie gespeichert), damit Spaltenkatalog, Filter und Sortierung dieselben Wege
 * gehen wie bei jeder anderen Spalte.
 */
export interface NachweisLage {
  arten: ReadonlyMap<number, AmpelArt>;
}

/** Der Schlüssel der Spalte einer Art – `nachweis:<Nummer der Nachweis-Gruppe>`. */
export const NACHWEIS_SPALTE = 'nachweis:';
export const nachweisSpaltenKey = (artGruppeId: number) => `${NACHWEIS_SPALTE}${artGruppeId}`;

/** Die Nummer der Art zu einem Spaltenschlüssel – `null`, wenn es keine Nachweis-Spalte ist. */
export function nachweisArtVon(spalte: string): number | null {
  if (!spalte.startsWith(NACHWEIS_SPALTE)) return null;
  const n = Number(spalte.slice(NACHWEIS_SPALTE.length));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Der Wert einer Person in dieser Spalte – `null`, wenn er (noch) nicht feststeht (lädt, Person unbekannt). */
export function ampelDerPerson(
  lage: NachweisLage | undefined,
  spalte: string,
  personId: number,
): AmpelFall | null {
  const art = nachweisArtVon(spalte);
  return art === null ? null : (lage?.arten.get(art)?.ampel.get(personId) ?? null);
}

/** Der schlechteste Wert der Personen einer Anmeldung (`ampelRang`) – `null`, solange keiner feststeht. */
export function ampelDerAnmeldung(
  lage: NachweisLage | undefined,
  spalte: string,
  personIds: readonly number[],
): AmpelFall | null {
  let schlecht: AmpelFall | null = null;
  for (const id of personIds) {
    const f = ampelDerPerson(lage, spalte, id);
    if (f && (!schlecht || ampelRang(f.wert) < ampelRang(schlecht.wert))) schlecht = f;
  }
  return schlecht;
}
