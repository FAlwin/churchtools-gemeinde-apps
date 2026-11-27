/**
 * **Die Ablage „Nachweis-Stand“** (N3a, Entscheidungen E22, E23, E26) – damit die Leitung einer Veranstaltung sieht, ob ihre
 * Mitarbeiter einen gültigen Nachweis haben, ohne Rechte an den Nachweis-Gruppen zu bekommen (die Gruppenfelder stehen auf
 * Stufe 4, das Ergebnis darf sie nie sehen). Der Weg ist der Datenspeicher der Erweiterung (gemessen M8, 20.11.2026):
 *
 * - **Kategorie** `NACHWEIS_STAND_KATEGORIE` – legt ein Admin beim Einrichten an (`standAblageSichern`).
 * - **Rechte** (nur ergänzen, nachgelesen): Wer „Anmeldungen sehen“ hat (`assignment-summary`), bekommt „Kategorie sehen“ +
 *   „Daten sehen“ (2021 + 2025 auf der Test-Instanz – beide nötig: ohne 2021 ist die Kategorie in der Liste unsichtbar, und
 *   `kategorieSuchen` findet sie nur dort). Die Leiter-Rolle der Gruppenart „Nachweis“ (die Vertrauenspersonen) dazu
 *   „Daten anlegen“ + „Daten ändern“. Löschen braucht niemand: Ausgetretene fallen beim Neuschreiben weg.
 * - **Werte (E26):** je Nachweis-Art EIN Wert `{art, fassung, gruppe, personen: {personId: stand}}`, `stand` aus
 *   `standFuerLeitung` (Tag „gültig bis“, `offen` oder `rot`). Keine Namen, kein Ergebnis, kein Ausstellungsdatum. Je Person
 *   etwa 21 Zeichen (`"123456":"2028-11-20",`) → bei `MAX_ZEICHEN` (10.000) passen gut 450 Personen in eine Art; mehr wirft
 *   `StandZuLang` – nie still gekürzt.
 *
 * **Vorübergehend ist nicht leer:** Lesefehler (Netz, 5xx) werfen; „nicht lesbar“ (kein Recht, Kategorie nicht sichtbar) ist
 * ein eigener Ausgang. Geschrieben wird nur, was sich geändert hat, und danach nachgelesen.
 */
import {
  GruppenartFehler,
  rechteErgaenzenAn,
  rechtTraegerLesen,
  zielSchluessel,
  type CtPort,
  type RechtZiel,
  type SollRecht,
} from '../ct/gruppenart';
import {
  MAX_ZEICHEN,
  inhaltAus,
  kategorieSicherstellen,
  kategorieSuchen,
  modulSuchen,
  wertAendern,
  wertAnlegen,
  werteLesen,
  type ModulPort,
  type Wert,
} from '../ct/modulDaten';
import { datenRechteNummernAus } from '../ct/rollenRechte';
import { NACHWEIS_MODULRECHT, NACHWEIS_STAND_KATEGORIE } from './nachweise';
import type { StandFuerLeitung } from './nachweisStand';

const ART = 'nachweis-stand';
const FASSUNG = 1;
const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;

/** Der Stand je Person einer Art: Personen-Nummer → Wert für die Leitung. */
export type StandEintraege = ReadonlyMap<number, StandFuerLeitung>;

interface Ablage {
  art: typeof ART;
  fassung: typeof FASSUNG;
  gruppe: number;
  personen: Record<string, string>;
}

/** Der Stand einer Art passt nicht in einen Wert (`MAX_ZEICHEN`). */
export class StandZuLang extends Error {
  constructor(
    readonly gruppe: number,
    readonly zeichen: number,
  ) {
    super(
      `Der Nachweis-Stand der Art ${gruppe} wäre ${zeichen} Zeichen lang, ChurchTools nimmt höchstens ${MAX_ZEICHEN}.`,
    );
    this.name = 'StandZuLang';
  }
}

const gueltigerEintrag = (v: unknown): v is StandFuerLeitung =>
  v === 'offen' || v === 'rot' || (typeof v === 'string' && ISO_TAG.test(v));

/** **Der Wert für eine Art** – Personen nach Nummer sortiert, damit gleicher Stand gleicher Text ist. Wirft `StandZuLang`. */
export function standWert(gruppe: number, eintraege: StandEintraege): string {
  const personen: Record<string, string> = {};
  for (const id of [...eintraege.keys()].sort((a, b) => a - b)) personen[id] = eintraege.get(id)!;
  const text = JSON.stringify({ art: ART, fassung: FASSUNG, gruppe, personen } satisfies Ablage);
  if (text.length > MAX_ZEICHEN) throw new StandZuLang(gruppe, text.length);
  return text;
}

/** Ein Wert als Stand – `null`, wenn er nicht von uns ist oder etwas darin nicht passt (dann zählt er nicht). */
export function standAusWert(
  w: Wert,
): { gruppe: number; personen: Map<number, StandFuerLeitung> } | null {
  const a = inhaltAus<Ablage>(w, ART, FASSUNG);
  if (!a || !Number.isInteger(a.gruppe) || !a.personen || typeof a.personen !== 'object')
    return null;
  const personen = new Map<number, StandFuerLeitung>();
  for (const [k, v] of Object.entries(a.personen)) {
    const id = Number(k);
    if (!Number.isInteger(id) || id <= 0 || !gueltigerEintrag(v)) return null;
    personen.set(id, v);
  }
  return { gruppe: a.gruppe, personen };
}

/** Unser Wert für diese Art – bei mehreren (zwei gleichzeitige erste Schreibvorgänge) der älteste. */
function wertDerArt(werte: readonly Wert[], gruppe: number): Wert | null {
  return (
    [...werte].sort((a, b) => a.id - b.id).find((w) => standAusWert(w)?.gruppe === gruppe) ?? null
  );
}

// ── Schreiben ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * **Den Stand der Arten schreiben** – nur, was sich geändert hat (gleicher Text → kein Aufruf), danach nachgelesen. Jede Art
 * wird ganz neu geschrieben: Wer nicht mehr in `eintraege` steht (ausgetreten), fällt weg. Darum darf hier **nur eine Art
 * hinein, deren Personen wirklich gelesen wurden** – eine nicht gelesene als leer geschrieben, löschte den Stand aller.
 *
 * Lesefehler werfen, bevor irgendetwas geschrieben wird (vorübergehend ist nicht leer – sonst entstünde ein zweiter Wert).
 * Fehlt danach etwas, wirft sie `fehler(502)`. Liefert die Nummern der Arten, die geschrieben wurden.
 */
export async function nachweisStandSchreiben(
  p: ModulPort,
  modul: number,
  kategorie: number,
  arten: readonly { gruppe: number; eintraege: StandEintraege }[],
  verweigert: string,
): Promise<number[]> {
  const soll = arten.map((a) => ({ gruppe: a.gruppe, text: standWert(a.gruppe, a.eintraege) }));
  const werte = await werteLesen(p, modul, kategorie);
  const geschrieben: number[] = [];
  for (const s of soll) {
    const da = wertDerArt(werte, s.gruppe);
    if (da?.value === s.text) continue;
    if (da) await wertAendern(p, modul, kategorie, da.id, s.text, verweigert);
    else await wertAnlegen(p, modul, kategorie, s.text, verweigert);
    geschrieben.push(s.gruppe);
  }
  if (geschrieben.length === 0) return geschrieben;
  const nachher = await werteLesen(p, modul, kategorie);
  const fehlt = soll.filter(
    (s) => geschrieben.includes(s.gruppe) && wertDerArt(nachher, s.gruppe)?.value !== s.text,
  );
  if (fehlt.length > 0) throw p.fehler(502, 'ChurchTools hat den Nachweis-Stand nicht übernommen.');
  return geschrieben;
}

// ── Lesen (Baustein für die Ampel, N3d) ─────────────────────────────────────────────────────────────────────────

/**
 * - `gelesen`: der Stand der Art (leer, wenn noch niemand geschrieben hat oder niemand in der Art ist),
 * - `nichtLesbar`: kein Recht an den Werten, oder die Kategorie ist nicht zu sehen. Ohne „Kategorie sehen“ ist eine
 *   fehlende Kategorie von einer unsichtbaren nicht zu unterscheiden (ChurchTools liefert dann eine leere Liste, M8).
 *
 * Alles andere (Netz, Drosselung, 5xx) wirft.
 */
export type StandGelesen =
  | { art: 'gelesen'; personen: Map<number, StandFuerLeitung> }
  | { art: 'nichtLesbar' };

/** **Der Stand aller Personen einer Art** (`gruppe` = Nummer der Nachweis-Gruppe). Schreibt nie. */
export async function nachweisStandLesen(
  p: ModulPort,
  modul: number,
  gruppe: number,
): Promise<StandGelesen> {
  try {
    const kategorie = await kategorieSuchen(p, modul, NACHWEIS_STAND_KATEGORIE.kuerzel);
    if (kategorie === null) return { art: 'nichtLesbar' };
    const w = wertDerArt(await werteLesen(p, modul, kategorie), gruppe);
    return {
      art: 'gelesen',
      personen: w ? standAusWert(w)!.personen : new Map<number, StandFuerLeitung>(),
    };
  } catch (e) {
    if (p.istKeinRecht(e)) return { art: 'nichtLesbar' };
    throw e;
  }
}

// ── Einrichten (Admin) ──────────────────────────────────────────────────────────────────────────────────────────

const zielName = (z: RechtZiel): string => {
  switch (z.art) {
    case 'status':
      return `des Status ${z.id}`;
    case 'group_type_role':
      return `der Gruppenart-Rolle ${z.id}`;
    case 'group_role':
      return `der Gruppenrolle ${z.id}`;
    case 'person':
      return `der Person ${z.id}`;
  }
};

/**
 * **Kategorie anlegen und Rechte ergänzen** (E22) – nur mit „Berechtigungen verwalten“ (Admin). Wiederholbar: legt nur an,
 * was fehlt, entzieht nie etwas, liest jedes Ziel nach. Läuft beim Speichern einer Nachweis-Art und beim Öffnen der Seite
 * durch einen Admin – so bekommen neue Träger von „Anmeldungen sehen“ das Leserecht von selbst.
 *
 * `leiterRolle`: die Leiter-Rolle der Gruppenart „Nachweis“. Steht sie selbst unter den Trägern (sie hat „Anmeldungen
 * sehen“ aus `leiterSoll`), bekommt sie einmal das volle Soll.
 */
export async function standAblageSichern(
  ct: CtPort,
  modul: ModulPort,
  leiterRolle: number,
  verweigert: string,
): Promise<{ kategorie: number; ziele: RechtZiel[] }> {
  const modulId = await modulSuchen(modul, 'Die Erweiterung „Anmeldungen“');
  const kategorie = await kategorieSicherstellen(
    modul,
    modulId,
    NACHWEIS_STAND_KATEGORIE,
    verweigert,
  );
  const n = datenRechteNummernAus(
    await ct.holen<unknown>('/permissions/definitions'),
    NACHWEIS_MODULRECHT.modul,
  );
  if (!n)
    throw new GruppenartFehler(
      'anders',
      `ChurchTools kennt die Rechte des Datenspeichers der Erweiterung nicht (Modul „${NACHWEIS_MODULRECHT.modul}“). Ist die Erweiterung richtig installiert?`,
      '',
    );
  const lesen: SollRecht[] = [
    { authId: n.kategorieSehen, name: 'Kategorie „Nachweis-Stand“ sehen', dataId: kategorie },
    { authId: n.datenSehen, name: 'Daten „Nachweis-Stand“ sehen', dataId: kategorie },
  ];
  const schreiben: SollRecht[] = [
    ...lesen,
    { authId: n.datenAnlegen, name: 'Daten „Nachweis-Stand“ anlegen', dataId: kategorie },
    { authId: n.datenAendern, name: 'Daten „Nachweis-Stand“ ändern', dataId: kategorie },
  ];
  const leiter: RechtZiel = { art: 'group_type_role', id: leiterRolle };
  const traeger = await rechtTraegerLesen(ct, n.modulSehen);
  const ziele = [leiter, ...traeger.filter((z) => zielSchluessel(z) !== zielSchluessel(leiter))];
  for (const z of ziele)
    await rechteErgaenzenAn(ct, z, z === leiter ? schreiben : lesen, zielName(z));
  return { kategorie, ziele };
}
