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

/** Erkennt einen Wert einer Sorte (Stand oder Art-Angaben) und nennt seine Art – `null`: nicht von uns / andere Sorte. */
type Leser = (w: Wert) => { gruppe: number } | null;

/** Unser Wert dieser Sorte für diese Art – bei mehreren (zwei gleichzeitige erste Schreibvorgänge) der älteste. */
function wertJeArt(werte: readonly Wert[], gruppe: number, lies: Leser): Wert | null {
  return [...werte].sort((a, b) => a.id - b.id).find((w) => lies(w)?.gruppe === gruppe) ?? null;
}

const wertDerArt = (werte: readonly Wert[], gruppe: number) =>
  wertJeArt(werte, gruppe, standAusWert);

/**
 * **Je Art einen Wert schreiben** – die eine Stelle für „nur Änderungen, danach nachlesen“ (Stand E26 und Art-Angaben E34/E35).
 * `werte`: frisch gelesen. Gleicher Text → kein Aufruf. Fehlt nachgelesen etwas, wirft sie `fehler(502)`. Liefert die
 * Nummern der Arten, die geschrieben wurden.
 */
async function jeArtSchreiben(
  p: ModulPort,
  modul: number,
  kategorie: number,
  werte: readonly Wert[],
  soll: readonly { gruppe: number; text: string }[],
  lies: Leser,
  verweigert: string,
): Promise<number[]> {
  const geschrieben: number[] = [];
  for (const s of soll) {
    const da = wertJeArt(werte, s.gruppe, lies);
    if (da?.value === s.text) continue;
    if (da) await wertAendern(p, modul, kategorie, da.id, s.text, verweigert);
    else await wertAnlegen(p, modul, kategorie, s.text, verweigert);
    geschrieben.push(s.gruppe);
  }
  if (geschrieben.length === 0) return geschrieben;
  const nachher = await werteLesen(p, modul, kategorie);
  const fehlt = soll.filter(
    (s) => geschrieben.includes(s.gruppe) && wertJeArt(nachher, s.gruppe, lies)?.value !== s.text,
  );
  if (fehlt.length > 0) throw p.fehler(502, 'ChurchTools hat den Nachweis-Stand nicht übernommen.');
  return geschrieben;
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
  return await jeArtSchreiben(p, modul, kategorie, werte, soll, standAusWert, verweigert);
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
  const r = await nachweisAblageLesen(p, modul, [gruppe]);
  return r.art === 'gelesen'
    ? { art: 'gelesen', personen: r.staende.get(gruppe)! }
    : { art: 'nichtLesbar' };
}

/**
 * **Alles, was die Leitung aus der Ablage braucht, in EINER Lesung** (N3d): der Stand der Arten `gruppen` (je Art Person →
 * Wert; eine Art ohne Wert ist leer, nicht „nicht lesbar“) und die Namen aller Arten (E35). Die Kategorie wird einmal gesucht
 * und einmal gelesen – nicht je Art (429-Lehre). `nichtLesbar`: kein Recht oder Kategorie nicht zu sehen; alles andere
 * (Netz, Drosselung, 5xx) wirft.
 */
export type NachweisAblage =
  | {
      art: 'gelesen';
      staende: Map<number, Map<number, StandFuerLeitung>>;
      namen: Map<number, string>;
    }
  | { art: 'nichtLesbar' };

export async function nachweisAblageLesen(
  p: ModulPort,
  modul: number,
  gruppen: readonly number[],
): Promise<NachweisAblage> {
  try {
    const kategorie = await kategorieSuchen(p, modul, NACHWEIS_STAND_KATEGORIE.kuerzel);
    if (kategorie === null) return { art: 'nichtLesbar' };
    const werte = await werteLesen(p, modul, kategorie);
    const staende = new Map<number, Map<number, StandFuerLeitung>>();
    for (const g of gruppen) {
      const w = wertDerArt(werte, g);
      staende.set(g, w ? standAusWert(w)!.personen : new Map<number, StandFuerLeitung>());
    }
    const namen = new Map<number, string>();
    for (const [g, a] of artAngabenAus(werte)) if (a.name.trim()) namen.set(g, a.name);
    return { art: 'gelesen', staende, namen };
  } catch (e) {
    if (p.istKeinRecht(e)) return { art: 'nichtLesbar' };
    throw e;
  }
}

// ── Angaben je Art: Name (E35) und Merkzettel „schon eingetragen“ (E34) ─────────────────────────────────────────

const ART_ANGABEN = 'nachweis-art';
const ART_FASSUNG = 1;

/**
 * **Was die Erweiterung je Nachweis-Art neben dem Stand ablegt** (N3c) – ein eigener Wert je Art in derselben Kategorie
 * (`{art: 'nachweis-art', fassung, gruppe, name, eingetragen}`; der Stand E26 bleibt unverändert, `inhaltAus` trennt die
 * beiden an `art`):
 *
 * - `name` (E35): Leitungen sehen die eingeschränkten Nachweis-Gruppen nicht (M11 Punkt 1) – hier lesen sie den Namen.
 * - `eingetragen` (E34): **je Veranstaltung**, wer dort den Nachweis brauchte und nachgelesen in der Nachweis-Gruppe stand
 *   (von der Erweiterung eingetragen oder schon drin). Wer darauf steht und nicht mehr in der Gruppe ist, wurde von einer
 *   Vertrauensperson ausgetragen und wird **für diese Veranstaltung** nicht wieder eingetragen. Für eine neue Veranstaltung
 *   gilt der Zettel nicht (Kinderschutz: keine stille Dauer-Lücke). Einträge zu vorbeigegangenen Veranstaltungen fallen beim
 *   nächsten Schreiben weg (§ 72a: keine Nummern auf Vorrat).
 */
export interface ArtAngaben {
  gruppe: number;
  name: string;
  /** Veranstaltung → Personen (aufsteigend). */
  eingetragen: Map<number, number[]>;
}

interface ArtAblage {
  art: typeof ART_ANGABEN;
  fassung: typeof ART_FASSUNG;
  gruppe: number;
  name: string;
  eingetragen: Record<string, number[]>;
}

const ganzeZahl = (x: unknown): x is number => Number.isInteger(x) && (x as number) > 0;

/** Der Wert für eine Art – Veranstaltungen und Personen sortiert (gleiche Angaben, gleicher Text). Wirft `StandZuLang`. */
export function artAngabenWert(a: ArtAngaben): string {
  const eingetragen: Record<string, number[]> = {};
  for (const v of [...a.eingetragen.keys()].sort((x, y) => x - y)) {
    const personen = [...new Set(a.eingetragen.get(v))].sort((x, y) => x - y);
    if (personen.length) eingetragen[v] = personen;
  }
  const text = JSON.stringify({
    art: ART_ANGABEN,
    fassung: ART_FASSUNG,
    gruppe: a.gruppe,
    name: a.name,
    eingetragen,
  } satisfies ArtAblage);
  if (text.length > MAX_ZEICHEN) throw new StandZuLang(a.gruppe, text.length);
  return text;
}

/** Ein Wert als Angaben einer Art – `null`, wenn er nicht von uns ist oder etwas darin nicht passt. */
export function artAngabenAusWert(w: Wert): ArtAngaben | null {
  const a = inhaltAus<ArtAblage>(w, ART_ANGABEN, ART_FASSUNG);
  if (!a || !ganzeZahl(a.gruppe) || typeof a.name !== 'string') return null;
  if (!a.eingetragen || typeof a.eingetragen !== 'object') return null;
  const eingetragen = new Map<number, number[]>();
  for (const [k, v] of Object.entries(a.eingetragen)) {
    const id = Number(k);
    if (!ganzeZahl(id) || !Array.isArray(v) || !v.every(ganzeZahl)) return null;
    eingetragen.set(id, v);
  }
  return { gruppe: a.gruppe, name: a.name, eingetragen };
}

/** Die Angaben aller Arten aus frisch gelesenen Werten (je Art der älteste Wert). */
export function artAngabenAus(werte: readonly Wert[]): Map<number, ArtAngaben> {
  const m = new Map<number, ArtAngaben>();
  for (const w of [...werte].sort((a, b) => a.id - b.id)) {
    const a = artAngabenAusWert(w);
    if (a && !m.has(a.gruppe)) m.set(a.gruppe, a);
  }
  return m;
}

/** Eine Änderung an den Angaben einer Art. */
export interface ArtAngabenAenderung {
  gruppe: number;
  name: string;
  /** Neu auf den Merkzettel: Veranstaltung → Personen (nur nachgelesen bestätigte). */
  dazu?: ReadonlyMap<number, readonly number[]>;
  /**
   * Die Veranstaltungen, die noch laufen – alle anderen fallen vom Merkzettel. Fehlt es (die Veranstaltungen wurden nicht
   * gelesen), bleibt der Merkzettel, wie er ist.
   */
  laufend?: ReadonlySet<number>;
}

/**
 * **Name und Merkzettel schreiben** – direkt davor frisch gelesen und mit dem Vorhandenen zusammengeführt (zwei Tabs oder zwei
 * Vertrauenspersonen derselben Art löschen sich so kaum Einträge weg), nur bei Änderung, danach nachgelesen
 * (`jeArtSchreiben`). Lesefehler werfen, bevor etwas geschrieben wird.
 */
export async function artAngabenAbgleichen(
  p: ModulPort,
  modul: number,
  kategorie: number,
  aenderungen: readonly ArtAngabenAenderung[],
  verweigert: string,
): Promise<number[]> {
  const werte = await werteLesen(p, modul, kategorie);
  const alt = artAngabenAus(werte);
  const soll = aenderungen.map((x) => {
    const eingetragen = new Map<number, number[]>();
    for (const [v, l] of alt.get(x.gruppe)?.eingetragen ?? [])
      if (!x.laufend || x.laufend.has(v)) eingetragen.set(v, [...l]);
    for (const [v, l] of x.dazu ?? []) eingetragen.set(v, [...(eingetragen.get(v) ?? []), ...l]);
    return {
      gruppe: x.gruppe,
      text: artAngabenWert({ gruppe: x.gruppe, name: x.name, eingetragen }),
    };
  });
  return await jeArtSchreiben(p, modul, kategorie, werte, soll, artAngabenAusWert, verweigert);
}

/**
 * **Die Namen der Arten für die Leitungen** (E35, Karte „Nachweise“): `gelesen` (auch leer – dann hat noch keine
 * Vertrauensperson die Erweiterung geöffnet), `nichtLesbar` (kein Recht, Kategorie nicht zu sehen). Alles andere wirft.
 */
export async function artNamenLesen(
  p: ModulPort,
  modul: number,
): Promise<{ art: 'gelesen'; namen: Map<number, string> } | { art: 'nichtLesbar' }> {
  const r = await nachweisAblageLesen(p, modul, []);
  return r.art === 'gelesen' ? { art: 'gelesen', namen: r.namen } : { art: 'nichtLesbar' };
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
 * `leiterRolle`: die Leiter-Rolle der Gruppenart „Nachweis“ – sie bekommt das volle Soll. Steht sie auch unter den Trägern
 * (sie hat „Anmeldungen sehen“ aus `leiterSoll`), fehlt beim zweiten Abgleich nichts mehr.
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
  // Steht die Leiter-Rolle selbst unter den Trägern, schreibt ihr zweiter Durchgang nichts mehr (Lesen ⊂ Schreiben).
  const ziele = [leiter, ...traeger];
  for (const z of ziele)
    await rechteErgaenzenAn(ct, z, z === leiter ? schreiben : lesen, zielName(z));
  return { kategorie, ziele };
}
