/**
 * **Entwürfe – noch nicht gesendete Einteilungen** (Bauplan E4-3, erste Scheibe: der Speicher-Kern ohne
 * Oberfläche). Nur Regeln, keine Netzwerk-Technik: Der Aufrufer reicht einen `EntwurfPort` herein.
 *
 * Wo sie liegen (Alwin, 14.10.2026): im Speicher der Erweiterung, **eine Kategorie („Schublade“) je
 * Dienstgruppe** – so schützt ChurchTools selbst die Gruppen voneinander. Darin **ein Wert je Platz**.
 *
 * Gemessen (E0 §6 und E4-3-1, Test-Instanz):
 * - Ein Wert hat nur `id`, `dataCategoryId`, `value` – kein Änderungsdatum, kein ETag, `If-Match` wird
 *   ignoriert. Zwei gleichzeitige `PUT` → beide 200, **einer geht still verloren**. Deshalb steht die
 *   **Version im Wert**, und vor dem Schreiben wird frisch gelesen und verglichen.
 * - Zwei gleichzeitige `POST` für denselben Platz → zwei Werte. Beim Lesen gewinnt fest einer (`gewinner`),
 *   die anderen sind „doppelt“ und werden beim Entfernen mit entfernt.
 * - Ein Platz wird über Termin + Dienst + `index` gemerkt, nie über seine ID – jedes Schreiben in ChurchTools
 *   vergibt dem Platz eine neue (E4-0).
 *
 * Hausregeln wie im Schreibkern (`einteilen.ts`): **Kein Schreibvorgang wird automatisch wiederholt.**
 * Erfolg ist erst, was nach dem Schreiben **nachgelesen** dasteht – nicht der Statuscode (Lehre vom
 * 11.08.2026). Bei einem vorübergehenden Fehler wird nachgelesen; ist es nicht da, heißt das Ergebnis
 * „vorübergehend“, und der Aufrufer behält die Eingabe.
 */
import {
  inhaltAus,
  MAX_ZEICHEN,
  wertAendern,
  wertAnlegen,
  werteLesen,
  wertLoeschen,
  type KategorieAngabe,
  type ModulPort,
  type Wert,
} from '../ct/modulDaten';
import { gleichePerson, type Belegung, type PlatzOrt } from './einteilen';

const ART = 'dienstplaner-entwurf';
const FASSUNG = 1;

/** Wer eingetragen werden soll: eine Person mit Konto oder ein Gast (nur ein Name, bekommt nie eine Anfrage). */
export type EntwurfZiel =
  | { art: 'person'; personId: number; name: string }
  | { art: 'gast'; name: string };

export interface Entwurf {
  ort: PlatzOrt;
  ziel: EntwurfZiel;
  /** Beim Senden (E4-4): Anfrage, oder ohne Rückfrage als zugesagt eintragen. Bei Gästen ohne Bedeutung. */
  modus: 'anfrage' | 'direkt';
  /** Was in ChurchTools am Platz stand, als der Entwurf entstand – daran erkennt man, ob er veraltet ist. */
  gesehen: Belegung;
  von: { personId: number; name: string };
  /** ISO-Zeitpunkt des letzten Speicherns. */
  zeit: string;
  /** Zählt bei jedem Speichern hoch – damit erkennt ein Planer, dass ein anderer inzwischen geändert hat. */
  version: number;
}

/** Was man speichert – Version und Zeit setzt der Speicher. */
export type EntwurfEingabe = Omit<Entwurf, 'version' | 'zeit'>;

interface Ablage extends Entwurf {
  art: typeof ART;
  fassung: typeof FASSUNG;
}

/** Der Anschluss an den Speicher der Erweiterung. */
export interface EntwurfPort extends ModulPort {
  /** Ist niemand mehr angemeldet? (Ein 401 allein heißt das nicht – ChurchTools sagt es auch bei fehlendem Recht.) */
  istAbgemeldet(e: unknown): boolean;
  /** Jetzt, als ISO-Zeitpunkt (für Tests austauschbar). */
  jetzt(): string;
}

export type EntwurfGrund =
  /** Niemand mehr angemeldet. Nichts ist passiert. */
  | 'abgemeldet'
  /** ChurchTools verweigert den Speicher dieser Gruppe. */
  | 'kein-recht'
  /** Ein anderer Planer hat den Platz inzwischen geändert – nichts überschrieben, `jetzt` sagt, was dasteht. */
  | 'konflikt'
  /** Netz, Zeitüberschreitung, Drosselung, 5xx – nicht bestätigt; die Eingabe bleibt beim Aufrufer. */
  | 'voruebergehend'
  /** ChurchTools hat das Schreiben angenommen, nachgelesen steht es aber nicht da. */
  | 'nicht-angekommen'
  /** Der Entwurf wäre zu lang für einen Wert (praktisch nur bei sehr langen Gast-Namen). */
  | 'zu-gross';

export type EntwurfErgebnis =
  | { ok: true; entwurf: Entwurf | null }
  | { ok: false; grund: EntwurfGrund; jetzt?: Entwurf | null };

const VERWEIGERT =
  'ChurchTools erlaubt dir nicht, die Entwürfe dieser Dienstgruppe zu ändern. Bitte die Verantwortlichen ' +
  'nach den Rechten für die Entwürfe der Gruppe fragen.';

// ── Schublade je Dienstgruppe ────────────────────────────────────────────────

/** Die Kategorie für die Entwürfe einer Dienstgruppe. Das Kürzel hängt an der ID, nicht am (änderbaren) Namen. */
export function schublade(gruppe: { id: number; name: string }): KategorieAngabe {
  return {
    kuerzel: `dienstplaner-entwuerfe-${gruppe.id}`,
    name: `Entwürfe ${gruppe.name}`.slice(0, 50),
    beschreibung:
      `Noch nicht gesendete Einteilungen der Dienstgruppe „${gruppe.name}“ – vom Dienstplaner ` +
      'angelegt, bitte nicht löschen.',
  };
}

/** Was jemand mit der Schublade einer Gruppe tun kann. */
export type SchubladenStand =
  /** Nicht zu sehen – fehlt, oder man darf sie nicht sehen (ChurchTools unterscheidet das nicht). */
  | 'fehlt'
  /** Nicht zu sehen, aber man darf Kategorien anlegen → „Einrichten“ anbieten (mit Warnung, s. Messung). */
  | 'einrichtbar'
  /** Zu sehen, aber nicht zu ändern. */
  | 'nur-lesen'
  | 'bereit';

/** Die Rechte des Moduls aus `/permissions/global` → `<kürzel>` (IDs je Recht). */
export interface ModulRechte {
  anlegen: boolean;
  sehen: number[];
  aendern: number[];
}

const ids = (x: unknown): number[] =>
  Array.isArray(x) ? x.filter((v): v is number => typeof v === 'number') : [];

/** Aus dem Rohwert von ChurchTools; fehlt er, darf man nichts. */
export function modulRechteAus(roh: unknown): ModulRechte {
  const r = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const schreiben = ['create custom data', 'edit custom data', 'delete custom data'].map((k) =>
    ids(r[k]),
  );
  return {
    anlegen: r['create custom category'] === true,
    sehen: ids(r['view custom data']),
    // Ändern heißt hier: anlegen, ändern UND löschen – ein Entwurf braucht alle drei.
    aendern: schreiben[0].filter((id) => schreiben[1].includes(id) && schreiben[2].includes(id)),
  };
}

export function schubladenStand(rechte: ModulRechte, kategorie: number | null): SchubladenStand {
  if (kategorie === null) return rechte.anlegen ? 'einrichtbar' : 'fehlt';
  if (!rechte.sehen.includes(kategorie)) return 'fehlt';
  return rechte.aendern.includes(kategorie) ? 'bereit' : 'nur-lesen';
}

// ── Lesen ────────────────────────────────────────────────────────────────────

export function ortSchluessel(ort: PlatzOrt): string {
  return `${ort.eventId}|${ort.serviceId}|${ort.index ?? '-'}`;
}

const istZahl = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const istText = (x: unknown): x is string => typeof x === 'string' && x.trim() !== '';

function zielGueltig(z: unknown): z is EntwurfZiel {
  const v = z as Partial<Record<string, unknown>> | null;
  if (!v || !istText(v.name)) return false;
  return v.art === 'gast' || (v.art === 'person' && istZahl(v.personId));
}

function belegungGueltig(b: unknown): b is Belegung {
  const v = b as Partial<Record<string, unknown>> | null;
  if (!v) return false;
  if (v.art === 'frei') return true;
  if (v.art === 'gast') return istText(v.name);
  return (v.art === 'anfrage' || v.art === 'zusage') && istZahl(v.personId);
}

/** Ein Wert → Entwurf, wenn er von uns ist und vollständig; sonst `null` (fremd, kaputt, andere Fassung). */
export function entwurfAus(w: Wert): Entwurf | null {
  const a = inhaltAus<Ablage>(w, ART, FASSUNG);
  if (!a) return null;
  const o = a.ort as Partial<PlatzOrt> | undefined;
  const ok =
    !!o &&
    istZahl(o.eventId) &&
    istZahl(o.serviceId) &&
    (o.index === null || istZahl(o.index)) &&
    zielGueltig(a.ziel) &&
    (a.modus === 'anfrage' || a.modus === 'direkt') &&
    belegungGueltig(a.gesehen) &&
    !!a.von &&
    istZahl(a.von.personId) &&
    typeof a.von.name === 'string' &&
    istText(a.zeit) &&
    istZahl(a.version);
  if (!ok) return null;
  const { art: _a, fassung: _f, ...entwurf } = a;
  return entwurf;
}

/** Gewinnt bei zwei Werten für denselben Platz: höhere Version, dann spätere Zeit, dann höhere ID. */
function gewinnt(
  a: { wert: Wert; entwurf: Entwurf },
  b: { wert: Wert; entwurf: Entwurf },
): boolean {
  if (a.entwurf.version !== b.entwurf.version) return a.entwurf.version > b.entwurf.version;
  if (a.entwurf.zeit !== b.entwurf.zeit) return a.entwurf.zeit > b.entwurf.zeit;
  return a.wert.id > b.wert.id;
}

export interface Schubladeninhalt {
  /** Je Platz (`ortSchluessel`) der gültige Entwurf und sein Wert. */
  je: Map<string, { wert: Wert; entwurf: Entwurf }>;
  /** Weitere Werte für einen schon belegten Platz (zwei gleichzeitige `POST`) – nicht gültig. */
  doppelt: Map<string, Wert[]>;
}

export function inhaltAusWerten(werte: Wert[]): Schubladeninhalt {
  const je = new Map<string, { wert: Wert; entwurf: Entwurf }>();
  const doppelt = new Map<string, Wert[]>();
  for (const wert of werte) {
    const entwurf = entwurfAus(wert);
    if (!entwurf) continue;
    const k = ortSchluessel(entwurf.ort);
    const da = je.get(k);
    const neu = { wert, entwurf };
    let verlierer: Wert | null = null;
    if (!da) je.set(k, neu);
    else if (gewinnt(neu, da)) {
      je.set(k, neu);
      verlierer = da.wert;
    } else verlierer = wert;
    if (verlierer) doppelt.set(k, [...(doppelt.get(k) ?? []), verlierer]);
  }
  return { je, doppelt };
}

type Lesen = { ok: true; inhalt: Schubladeninhalt } | { ok: false; grund: EntwurfGrund };

function grundAus(p: EntwurfPort, e: unknown): EntwurfGrund {
  if (p.istAbgemeldet(e)) return 'abgemeldet';
  if (p.istKeinRecht(e)) return 'kein-recht';
  return 'voruebergehend';
}

/** Alle Entwürfe einer Schublade – **frisch**, nie aus einem Cache. */
export async function schubladeLesen(
  p: EntwurfPort,
  modul: number,
  kategorie: number,
): Promise<Lesen> {
  try {
    return { ok: true, inhalt: inhaltAusWerten(await werteLesen(p, modul, kategorie)) };
  } catch (e) {
    return { ok: false, grund: grundAus(p, e) };
  }
}

// ── Veraltet? ────────────────────────────────────────────────────────────────

/**
 * Steht in ChurchTools am Platz inzwischen etwas anderes als beim Eintragen? Dann gilt ChurchTools, und der
 * Entwurf wird nie gesendet (Alwin, 14.10.2026). Dieselbe Regel wie beim Einteilen (`gleichePerson`): Hat die
 * gesehene Person inzwischen nur zugesagt, ist das keine Änderung.
 */
export function entwurfVeraltet(entwurf: Entwurf, inChurchTools: Belegung): boolean {
  return !gleichePerson(entwurf.gesehen, inChurchTools);
}

// ── Speichern und Entfernen ──────────────────────────────────────────────────

/** Gleicher Inhalt (wer, wie gesendet, auf welchem Stand) – egal wer und wann. */
function gleicherInhalt(a: EntwurfEingabe, b: EntwurfEingabe): boolean {
  const ziel =
    a.ziel.art === 'gast'
      ? b.ziel.art === 'gast' && a.ziel.name.trim() === b.ziel.name.trim()
      : b.ziel.art === 'person' && a.ziel.personId === b.ziel.personId;
  return ziel && a.modus === b.modus && gleichePerson(a.gesehen, b.gesehen);
}

/**
 * **Einen Entwurf speichern.** `erwartet` ist die Version, die der Planer gesehen hat (`null` = kein Entwurf):
 * Steht inzwischen eine andere da, wird **nicht** überschrieben (`konflikt`, mit `jetzt`). „Trotzdem
 * eintragen“ ruft das noch einmal mit der Version aus `jetzt` auf – eine bewusste zweite Entscheidung.
 */
export async function entwurfSpeichern(
  p: EntwurfPort,
  modul: number,
  kategorie: number,
  eingabe: EntwurfEingabe,
  erwartet: number | null,
): Promise<EntwurfErgebnis> {
  const k = ortSchluessel(eingabe.ort);
  // 1. Frisch lesen.
  const erst = await schubladeLesen(p, modul, kategorie);
  if (!erst.ok) return { ok: false, grund: erst.grund };
  const da = erst.inhalt.je.get(k) ?? null;
  // Schon so gespeichert (etwa ein früherer Versuch, der doch angekommen ist) → Erfolg ohne Schreiben.
  if (
    da &&
    gleicherInhalt(da.entwurf, eingabe) &&
    da.entwurf.von.personId === eingabe.von.personId
  ) {
    return { ok: true, entwurf: da.entwurf };
  }
  if ((da?.entwurf.version ?? null) !== erwartet) {
    return { ok: false, grund: 'konflikt', jetzt: da?.entwurf ?? null };
  }

  // 2. Schreiben – nie wiederholt.
  const neu: Entwurf = { ...eingabe, zeit: p.jetzt(), version: (da?.entwurf.version ?? 0) + 1 };
  const text = JSON.stringify({ art: ART, fassung: FASSUNG, ...neu } satisfies Ablage);
  if (text.length > MAX_ZEICHEN) return { ok: false, grund: 'zu-gross' };
  try {
    if (da) await wertAendern(p, modul, kategorie, da.wert.id, text, VERWEIGERT);
    else await wertAnlegen(p, modul, kategorie, text, VERWEIGERT);
  } catch (e) {
    const g = grundAus(p, e);
    if (g !== 'voruebergehend') return { ok: false, grund: g };
    // Gelöscht, während wir ändern wollten (gemessen: 404) – ein anderer war schneller.
    return nachlesen(
      p,
      modul,
      kategorie,
      neu,
      p.istNichtGefunden(e) ? 'konflikt' : 'voruebergehend',
    );
  }

  // 3. Nachlesen – erst was dasteht, ist der Erfolg.
  return nachlesen(p, modul, kategorie, neu, 'nicht-angekommen');
}

async function nachlesen(
  p: EntwurfPort,
  modul: number,
  kategorie: number,
  neu: Entwurf,
  sonst: EntwurfGrund,
): Promise<EntwurfErgebnis> {
  const l = await schubladeLesen(p, modul, kategorie);
  // Nicht lesbar: Ob es angekommen ist, weiß niemand – der Aufrufer behält die Eingabe.
  if (!l.ok) return { ok: false, grund: l.grund };
  const jetzt = l.inhalt.je.get(ortSchluessel(neu.ort))?.entwurf ?? null;
  if (
    jetzt &&
    jetzt.version === neu.version &&
    jetzt.zeit === neu.zeit &&
    jetzt.von.personId === neu.von.personId
  ) {
    return { ok: true, entwurf: jetzt };
  }
  // Steht dort ein anderer Entwurf auf mindestens unserem Stand, war ein anderer Planer gleichzeitig dran.
  if (jetzt && jetzt.version >= neu.version) return { ok: false, grund: 'konflikt', jetzt };
  return { ok: false, grund: sonst, jetzt };
}

/**
 * **Einen Entwurf entfernen** – nur, wenn noch die gesehene Version dasteht. Entfernt auch doppelte Werte
 * desselben Platzes. „Schon weg“ ist ein Erfolg.
 */
export async function entwurfEntfernen(
  p: EntwurfPort,
  modul: number,
  kategorie: number,
  ort: PlatzOrt,
  erwartet: number,
): Promise<EntwurfErgebnis> {
  const k = ortSchluessel(ort);
  const erst = await schubladeLesen(p, modul, kategorie);
  if (!erst.ok) return { ok: false, grund: erst.grund };
  const da = erst.inhalt.je.get(k);
  if (!da) return { ok: true, entwurf: null };
  if (da.entwurf.version !== erwartet) return { ok: false, grund: 'konflikt', jetzt: da.entwurf };

  // Erst den gültigen, dann die doppelten.
  const zuLoeschen = [da.wert, ...(erst.inhalt.doppelt.get(k) ?? [])];
  let abgebrochen: EntwurfGrund | null = null;
  try {
    for (const w of zuLoeschen) await wertLoeschen(p, modul, kategorie, w.id, VERWEIGERT);
  } catch (e) {
    const g = grundAus(p, e);
    if (g !== 'voruebergehend') return { ok: false, grund: g };
    abgebrochen = g;
  }

  const l = await schubladeLesen(p, modul, kategorie);
  if (!l.ok) return { ok: false, grund: l.grund };
  const rest = l.inhalt.je.get(k);
  if (!rest) return { ok: true, entwurf: null };
  // Ein Wert, den wir löschen wollten, steht noch da → nicht angekommen (bzw. unterbrochen). Ein anderer
  // Wert → jemand hat gleichzeitig eingetragen.
  const unserer = zuLoeschen.some((w) => w.id === rest.wert.id);
  return {
    ok: false,
    grund: unserer ? (abgebrochen ?? 'nicht-angekommen') : 'konflikt',
    jetzt: rest.entwurf,
  };
}
