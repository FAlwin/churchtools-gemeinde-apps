/**
 * **„Vertretung suchen“** (Bauplan E5c-6, Entwurf `e5c-6-vertretung.html` v1, freigegeben Alwin 21.11.2026): Wer seinen
 * zugesagten Dienst nicht machen kann, sagt ab und fragt mit einem Klick Teamkollegen; **wer zuerst „Übernehmen“ drückt, hat
 * den Dienst** – ohne dass ein Planer etwas tun muss. Nur Regeln und Texte – geladen und geschrieben wird in
 * `dienstplaner/src` (`vertretungAblauf.ts`, `ladeVertretung.ts`).
 *
 * **Was ChurchTools erlaubt** (gemessen 20./21.11.2026, `docs/messung-e5c.md` § E5c-6):
 * - Ein Mitarbeiter darf **andere nicht eintragen** (403), aber **seinen Dienst absagen** (auch nach der Zusage → neuer
 *   leerer Platz, der Kommentar hängt daran, für Mitarbeitende ohne `+see reason` unlesbar), einer Person **eine Mail zum
 *   Termin schicken** (`/events/send`) und – mit dem Gruppenrecht `+entry free` – einen **freien** Platz **selbst**
 *   übernehmen (`PUT /persons/{ich}/servicerequests/{platz} {isAccepted:true}`; je Platz `permissions.enterSelfIfFree`, nur in
 *   der Einzel-Abfrage). Einen besetzten Platz übernehmen geht nicht.
 * - Darum der Ablauf: **Markierung speichern → absagen → Mails** (`vertretungAblauf.ts`), dann übernimmt jemand den freien Platz.
 *
 * **Eine Regel für „gilt noch“** (`gesuchtGilt`): „Vertretung gesucht“ steht nur, solange der Termin nicht vergangen oder
 * abgesagt ist **und ein Platz dieses Dienstes frei ist** – die Markierung allein reicht nie (sie bleibt im Wert der Person
 * stehen, bis der Termin vorbei ist; ein besetzter Platz heißt „übernommen“). Start und Planen fragen dieselbe Funktion.
 */
import { decktTermin } from '../absences/index';
import { tagKurz, tagLang } from '../ct/datum';
import type { Person } from '../organigramm/mitglieder';
import {
  gleicherStand,
  lesegrund,
  platzAendern,
  type Belegung,
  type DienstPort,
  type Grund,
} from './einteilen';
import { htmlText, mailKnopf, vorname } from './erinnern';
import {
  antwortFuer,
  antwortenSichtbar,
  antwortStufe,
  type PersonenAntworten,
} from './personenAntworten';
import type { PersonenDaten } from './personenDaten';
import {
  istFrei,
  VERBORGENE_PERSON,
  type RohPlatz,
  type RohTermin,
  type TerminZeile,
} from './termine';
import type { Zusage } from './verfuegbarkeit';
import { vertretungsSchluessel, type Vertretung, type Vertretungen } from './verfuegbarkeit';

// ── Wen man fragen kann ──────────────────────────────────────────────────────

/** Eine Person aus dem Team, die man fragen kann – mit ihrer Antwort aus „Verfügbarkeit“ zu **diesem** Termin. */
export interface Vorschlag {
  personId: number;
  name: string;
  /** Ja / Vielleicht; `null` ohne (für diesen Dienst geltende) Antwort. */
  a: Zusage | null;
  /** Der Kommentar zur Antwort, sonst `null`. */
  notiz: string | null;
}

/**
 * Was das Fenster zeigt: die Abschnitte „Hat Ja gesagt“, „Vielleicht“, „Ohne Antwort“ – oder, wenn die Antworten der
 * Dienstgruppe nicht lesbar sind, **nur das Team** ohne Einordnung (`ohneAntworten`): „keine Antwort“ wäre dann geraten.
 */
export type Vorschlaege =
  | { art: 'liste'; ja: Vorschlag[]; vielleicht: Vorschlag[]; ohne: Vorschlag[] }
  | { art: 'ohneAntworten'; team: Vorschlag[] };

const nachName = (a: Vorschlag, b: Vorschlag) =>
  a.name.localeCompare(b.name, 'de') || a.personId - b.personId;

/**
 * **Wer als Vertretung in Frage kommt** (Entwurf Abschnitt 2): Mitglieder der Teams am Dienst (`mitglieder`), **ohne** die
 * Person selbst, **ohne** wer am Tag schon eingeteilt ist (`eingeteilt`), **ohne** wer Nein gesagt hat – das heißt in
 * ChurchTools abwesend (`abwesend`, soweit lesbar) – und ohne wer „nur bestimmte Dienste“ ohne diesen Dienst gesagt hat
 * (`antwortStufe` = `kannNicht`, dieselbe Einordnung wie in „Wer kann?“ und im Zauberstab, nichts nachgebaut). Es zählen nur
 * Antworten **zu diesem Termin** (`antwortFuer`).
 */
export function vorschlaege(o: {
  mitglieder: readonly Pick<Person, 'id' | 'name'>[];
  antworten: PersonenAntworten | null | undefined;
  /** Die Dienstgruppe des Dienstes – ihre Antworten müssen lesbar sein. */
  gruppeId: number | null;
  terminId: number;
  dienstId: number;
  dienstName: (id: number) => string | undefined;
  ichId: number;
  eingeteilt: ReadonlySet<number>;
  abwesend: ReadonlySet<number>;
}): Vorschlaege {
  const sichtbar = antwortenSichtbar(o.antworten, o.gruppeId);
  const ja: Vorschlag[] = [];
  const vielleicht: Vorschlag[] = [];
  const ohne: Vorschlag[] = [];
  for (const m of new Map(o.mitglieder.map((x) => [x.id, x])).values()) {
    if (m.id === o.ichId || o.eingeteilt.has(m.id)) continue;
    const abwesend = o.abwesend.has(m.id);
    const antwort = antwortFuer(o.antworten, {
      gruppeId: o.gruppeId,
      personId: m.id,
      terminId: o.terminId,
      dienstId: o.dienstId,
      dienstName: o.dienstName,
    });
    // Ohne lesbare Antworten gibt es keine Stufe – nur die Abwesenheit (soweit bekannt) schließt aus.
    const stufe = sichtbar ? antwortStufe(abwesend, antwort) : abwesend ? 'kannNicht' : 'keine';
    if (stufe === 'kannNicht') continue;
    const v: Vorschlag = {
      personId: m.id,
      name: m.name,
      a: stufe === 'ja' || stufe === 'vielleicht' ? stufe : null,
      notiz: antwort?.gilt ? antwort.notiz : null,
    };
    (stufe === 'ja' ? ja : stufe === 'vielleicht' ? vielleicht : ohne).push(v);
  }
  if (!sichtbar) return { art: 'ohneAntworten', team: ohne.sort(nachName) };
  return {
    art: 'liste',
    ja: ja.sort(nachName),
    vielleicht: vielleicht.sort(nachName),
    ohne: ohne.sort(nachName),
  };
}

/** Die Personen, die an diesem Termin abwesend sind (`decktTermin`, dieselbe Regel wie im Raster) – und ob man es überhaupt weiß. */
export function abwesendAm(
  daten: PersonenDaten,
  gruppenIds: readonly number[],
  termin: { beginn: string; ende: string; tag: string },
): { personen: Set<number>; bekannt: boolean } {
  const personen = new Set<number>();
  let bekannt = true;
  for (const id of new Set(gruppenIds)) {
    const stand = daten.get(id);
    if (stand?.art !== 'da' || stand.abwesenheiten === 'nichtSichtbar') {
      bekannt = false;
      continue;
    }
    for (const a of stand.abwesenheiten)
      if (decktTermin(a, { startDate: termin.beginn, endDate: termin.ende, date: termin.tag }))
        personen.add(a.personId);
  }
  return { personen, bekannt };
}

/**
 * Wer an den übergebenen Terminen (die eines Tages) **schon eingeteilt** ist – zugesagt oder angefragt, in irgendeinem
 * Dienst. „Namen verbergen“ (`personId: -2`) und Gäste sind keine Personen und fehlen (nicht zu erkennen).
 */
export function eingeteiltAus(termine: readonly RohTermin[]): Set<number> {
  const ids = new Set<number>();
  for (const t of termine)
    for (const p of t.eventServices ?? [])
      if (
        !istFrei(p) &&
        typeof p.personId === 'number' &&
        p.personId > 0 &&
        p.personId !== VERBORGENE_PERSON
      )
        ids.add(p.personId);
  return ids;
}

/**
 * **Die Leitung der Teams am Dienst** (Kopie der Mail), ohne die Person selbst und ohne die, die ohnehin gefragt werden.
 * `leitung` je Gruppe aus dem Stand (`GruppenStand.leitung`); Namen aus den Mitgliedern derselben Gruppen.
 */
export function leitungAus(
  daten: PersonenDaten,
  gruppenIds: readonly number[],
  ausser: ReadonlySet<number>,
): Person[] {
  const namen = new Map<number, Person>();
  const leitung = new Set<number>();
  for (const id of new Set(gruppenIds)) {
    const stand = daten.get(id);
    if (stand?.art !== 'da' || stand.mitglieder === 'verborgen') continue;
    for (const p of stand.mitglieder) namen.set(p.id, p);
    for (const l of stand.leitung ?? []) leitung.add(l);
  }
  return [...leitung]
    .filter((id) => !ausser.has(id) && namen.has(id))
    .map((id) => namen.get(id)!)
    .sort((a, b) => a.name.localeCompare(b.name, 'de') || a.id - b.id);
}

// ── Texte ────────────────────────────────────────────────────────────────────

/** Der Kommentar der Absage – am freien Platz sieht ihn der Planer (für Mitarbeitende ohne `+see reason` unlesbar). */
export function absageKommentar(namen: readonly string[]): string {
  return (
    namen.length > 0 ? `Vertretung gesucht – gefragt: ${namen.join(', ')}` : 'Vertretung gesucht'
  ).slice(0, 250);
}

/** „Vertretung gesucht: Gesang am So, 13.12.“ */
export const vertretungBetreff = (dienst: string, tag: string): string =>
  `Vertretung gesucht: ${dienst} am ${tagKurz(tag)}`;

/** Der Termin, wie die Mails ihn nennen. */
export interface MailTermin {
  name: string;
  /** `YYYY-MM-DD` */
  tag: string;
  /** `HH:MM` */
  uhrzeit: string;
}

const terminSatz = (t: MailTermin) => `${tagLang(t.tag)} (${t.name}, ${t.uhrzeit} Uhr)`;
const nachrichtAbsatz = (n: string) => {
  const t = n.trim();
  return t ? `<p>„${t.split(/\r?\n/).map(htmlText).join('<br>')}“</p>` : '';
};
const namenText = (namen: readonly string[]) => namen.map(htmlText).join(', ');

/**
 * **Die Mail an eine gefragte Person** (Entwurf Abschnitt 3; HTML für `body` von `/events/send`, Teile maskiert): „Hallo Ben,
 * Anna kann am Sonntag, 13. Dezember (Gottesdienst, 10:00 Uhr) nicht bei Gesang dabei sein und sucht eine Vertretung. Du hast für
 * den Tag „Ja“ gesagt.“ – die Nachricht – der Knopf – „Wer zuerst übernimmt, hat den Dienst. Gefragt wurden auch: Finn.“
 * Dieselbe Funktion für Vorschau und Versand.
 */
export function vertretungMail(o: {
  empfaenger: string;
  von: string;
  dienst: string;
  termin: MailTermin;
  /** Was die Person zu diesem Termin geantwortet hat – `null`: nichts (der Satz entfällt). */
  antwort: Zusage | null;
  nachricht: string;
  /** Die anderen Gefragten (ohne den Empfänger). */
  andere: readonly string[];
  link: string;
}): string {
  return [
    `<p>Hallo ${htmlText(vorname(o.empfaenger))},</p>`,
    `<p>${htmlText(o.von)} kann am <b>${htmlText(terminSatz(o.termin))}</b> nicht bei <b>${htmlText(o.dienst)}</b> dabei sein und sucht eine Vertretung.` +
      (o.antwort
        ? ` Du hast für den Tag „${o.antwort === 'ja' ? 'Ja' : 'Vielleicht'}“ gesagt.`
        : '') +
      '</p>',
    nachrichtAbsatz(o.nachricht),
    `<p>${mailKnopf(o.link, 'Im Dienstplaner übernehmen')}</p>`,
    `<p>Wer zuerst übernimmt, hat den Dienst.${o.andere.length > 0 ? ` Gefragt wurden auch: ${namenText(o.andere)}.` : ''}</p>`,
  ].join('');
}

/**
 * **Die Kopie an die Leitung**: Wer sucht, welcher Dienst, wer gefragt wurde – und dass der Platz in „Planen“ frei ist, falls
 * niemand übernimmt.
 */
export function leitungMail(o: {
  empfaenger: string;
  von: string;
  dienst: string;
  termin: MailTermin;
  gefragt: readonly string[];
  nachricht: string;
  link: string;
}): string {
  return [
    `<p>Hallo ${htmlText(vorname(o.empfaenger))},</p>`,
    `<p>${htmlText(o.von)} hat den Dienst <b>${htmlText(o.dienst)}</b> am <b>${htmlText(terminSatz(o.termin))}</b> abgesagt und sucht eine Vertretung. ` +
      (o.gefragt.length > 0
        ? `Gefragt wurden: ${namenText(o.gefragt)}.`
        : 'Es wurde niemand direkt gefragt.') +
      '</p>',
    nachrichtAbsatz(o.nachricht),
    `<p>Wer zuerst übernimmt, hat den Dienst. Übernimmt niemand, bleibt der Platz in „Planen“ frei (mit dem Schild „Vertretung gesucht“). Das ist eine Kopie für dich.</p>`,
    `<p>${mailKnopf(o.link, 'Im Dienstplaner ansehen')}</p>`,
  ].join('');
}

// ── Gesuchte Vertretungen: wann sie noch gelten ──────────────────────────────

/**
 * **Ist der Platz frei, für den die Vertretung gesucht wird?** `freie` sind die `index` der freien Plätze **dieses Dienstes** am Termin.
 * Die Markierung kennt den `index` des abgesagten Platzes (er bleibt über alle Ersetzungen gleich, gemessen) – gilt dann **genau
 * dieser** Platz; ein anderer freier Platz des Dienstes (schon vorher frei) ist Sache der Planer. Ohne `index` (alte Markierung)
 * gilt die alte Regel „irgendein Platz des Dienstes ist frei“.
 */
export function suchPlatzFrei(
  v: Pick<Vertretung, 'index'>,
  freie: readonly (number | null)[],
): boolean {
  return v.index === undefined ? freie.length > 0 : freie.includes(v.index);
}

/**
 * **Gilt „Vertretung gesucht“ noch?** Eine Regel für Start und Planen: der Termin ist nicht vergangen (`tag >= heute`), nicht
 * abgesagt, und **der gesuchte Platz ist frei** (`frei`, aus `suchPlatzFrei`). Ist er besetzt, hat jemand übernommen oder der
 * Planer hat anders besetzt – die Markierung allein beweist nichts.
 */
export function gesuchtGilt(o: {
  tag: string;
  heute: string;
  abgesagt: boolean;
  frei: boolean;
}): boolean {
  return o.tag >= o.heute && !o.abgesagt && o.frei;
}

/** Eine gesuchte Vertretung, wie Start und Planen sie zeigen. */
export interface Gesuchte {
  /** Wer sucht. */
  personId: number;
  name: string;
  terminId: number;
  dienstId: number;
  dienst: string;
  gefragt: number[];
  gefragtNamen: string[];
  seit: string;
  /** Der Platz, für den eine Vertretung gesucht wird (`Vertretung.index`); `undefined` bei alten Markierungen. */
  index: number | null | undefined;
}

/** Termin und Dienst aus dem Schlüssel (`vertretungsSchluessel`) – `null` bei einem fremden Schlüssel. */
export function schluesselAus(k: string): { terminId: number; dienstId: number } | null {
  const m = /^(\d+):(\d+)$/.exec(k);
  return m ? { terminId: Number(m[1]), dienstId: Number(m[2]) } : null;
}

/**
 * **„Für dich offen“ auf der Startseite** (Entwurf Abschnitt 4): je gesuchter Vertretung, die noch gilt (`gesuchtGilt` am
 * geladenen Termin: `TerminZeile.freiePlaetze`), für **jeden aus dem Team des Dienstes** (`eigeneDienste`) – nicht nur die
 * Gefragten, **nicht** für die suchende Person selbst. Nach Tag und Uhrzeit sortiert.
 */
export function offeneVertretungen(o: {
  vertretungen: ReadonlyMap<number, Vertretungen> | undefined;
  zeilen: readonly TerminZeile[];
  /** Die Dienste (IDs), in deren Team ich bin. */
  eigeneDienste: ReadonlySet<number>;
  ichId: number;
  dienstName: (id: number) => string | undefined;
  heute: string;
}): (Gesuchte & { termin: TerminZeile })[] {
  const out: (Gesuchte & { termin: TerminZeile })[] = [];
  for (const [personId, je] of o.vertretungen ?? []) {
    if (personId === o.ichId) continue;
    for (const [k, v] of Object.entries(je)) {
      const s = schluesselAus(k);
      if (!s || s.dienstId !== v.dienst || !o.eigeneDienste.has(v.dienst)) continue;
      const termin = o.zeilen.find((z) => z.id === s.terminId);
      if (!termin) continue;
      // Wer an diesem Termin in diesem Dienst schon eingeteilt ist (angefragt oder zugesagt), bekommt „Übernehmen“ nie gezeigt.
      if (termin.meine.some((m) => m.ort?.serviceId === v.dienst)) continue;
      const freie = termin.freiePlaetze.filter((p) => p.serviceId === v.dienst).map((p) => p.index);
      if (
        !gesuchtGilt({
          tag: termin.tag,
          heute: o.heute,
          abgesagt: termin.abgesagt,
          frei: suchPlatzFrei(v, freie),
        })
      )
        continue;
      out.push({
        personId,
        name: v.name,
        terminId: s.terminId,
        dienstId: v.dienst,
        dienst: o.dienstName(v.dienst) ?? 'Dienst',
        gefragt: v.gefragt,
        gefragtNamen: v.gefragtNamen,
        seit: v.seit,
        index: v.index,
        termin,
      });
    }
  }
  return out.sort(
    (a, b) =>
      (a.termin.tag + a.termin.uhrzeit).localeCompare(b.termin.tag + b.termin.uhrzeit) ||
      a.seit.localeCompare(b.seit) ||
      a.personId - b.personId,
  );
}

/** Das Schild in „Planen“ an einem freien Platz. */
export interface Schild {
  /** „⚑ Vertretung gesucht“ ist fest; hier der Hinweistext („Anna hat abgesagt · gefragt: Ben, Finn“). */
  hinweis: string;
  /** Der Platz, an dem das Schild steht (`index`); `undefined` bei alten Markierungen (dann am ersten freien Platz). */
  index: number | null | undefined;
}

/**
 * **Die Schilder in einer Zelle von „Planen“** (Entwurf Abschnitt 5): je gesuchter Vertretung zu diesem Termin und Dienst, die
 * noch gilt (`gesuchtGilt` mit `suchPlatzFrei` – dieselbe Regel wie auf der Startseite), ein Schild **an dem Platz mit dem
 * gemerkten `index`**. `freieIndizes` sind die `index` der freien Plätze dieses Dienstes in der Zelle. Alte Markierungen ohne `index`
 * bekommen höchstens so viele Schilder, wie freie Plätze übrig sind. Nach Zeitpunkt der Suche.
 */
export function schilder(o: {
  vertretungen: ReadonlyMap<number, Vertretungen> | undefined;
  terminId: number;
  dienstId: number;
  tag: string;
  heute: string;
  abgesagt: boolean;
  freieIndizes: readonly (number | null)[];
}): Schild[] {
  const treffer: Vertretung[] = [];
  for (const je of o.vertretungen?.values() ?? []) {
    const v = je[vertretungsSchluessel(o.terminId, o.dienstId)];
    if (v && v.dienst === o.dienstId) treffer.push(v);
  }
  const gilt = treffer
    .sort((a, b) => a.seit.localeCompare(b.seit))
    .filter((v) =>
      gesuchtGilt({
        tag: o.tag,
        heute: o.heute,
        abgesagt: o.abgesagt,
        frei: suchPlatzFrei(v, o.freieIndizes),
      }),
    );
  const gezielt = gilt.filter((v) => v.index !== undefined);
  const alt = gilt
    .filter((v) => v.index === undefined)
    .slice(0, Math.max(0, o.freieIndizes.length - gezielt.length));
  return [...gezielt, ...alt].map((v) => ({
    hinweis: `${v.name} hat abgesagt${v.gefragtNamen.length > 0 ? ` · gefragt: ${v.gefragtNamen.join(', ')}` : ''}`,
    index: v.index,
  }));
}

// ── Übernehmen ───────────────────────────────────────────────────────────────

/**
 * Warum „Übernehmen“ nicht geklappt hat – die Zweige einzeln:
 * - `besetzt`: am Termin ist kein Platz dieses Dienstes mehr frei („Schon übernommen – danke!“),
 * - `kein-recht`: ChurchTools erlaubt das Selbst-Eintragen nicht (`enterSelfIfFree` false oder 403) – „frag die Leitung“,
 * - `abgemeldet` (401), `weg` (Termin gelöscht), `voruebergehend` (Netz, Zeitüberschreitung, 5xx – nicht bestätigt, nichts
 *   wird wiederholt), `nicht-angekommen` (ChurchTools sagte ja, nachgelesen stehe ich dort nicht).
 */
export type UebernehmenGrund =
  | 'besetzt'
  | 'kein-recht'
  | 'abgemeldet'
  | 'weg'
  | 'voruebergehend'
  | 'nicht-angekommen';

export type UebernehmenErgebnis = { ok: true } | { ok: false; grund: UebernehmenGrund };

const ichZugesagt = (ich: number): Belegung => ({ art: 'zusage', personId: ich });

/** Ist es mein zugesagter Platz? */
const meinPlatz = (p: RohPlatz, ich: number) =>
  !istFrei(p) && p.personId === ich && p.isAccepted === true;

/**
 * **Einen freien Platz des Dienstes selbst übernehmen** (Entwurf Abschnitt 4). Der Termin wird **frisch gelesen** (Einzel-
 * Abfrage, nur sie nennt `permissions.enterSelfIfFree`); dann:
 * 1. Stehe ich schon zugesagt an einem Platz des Dienstes → fertig, nichts wird geschrieben.
 * 2. Kein Platz des Dienstes frei → `besetzt` („schon übernommen“).
 * 3. Alle freien Plätze nennen `enterSelfIfFree: false` → `kein-recht`, **ohne zu schreiben**. Fehlt die Angabe, entscheidet
 *    ChurchTools beim Schreiben (403 → `kein-recht`).
 * 4. `PUT /persons/{ich}/servicerequests/{platz} {isAccepted:true}` über `platzAendern` (frisch lesen, nie wiederholt,
 *    nachlesen): Erfolg ist erst, wenn **ich nachgelesen zugesagt am Platz stehe**. Hat mir jemand den Platz in der Zwischenzeit
 *    weggeschnappt (`konflikt`), heißt das `besetzt`.
 */
export async function uebernehmen(
  port: DienstPort,
  o: {
    eventId: number;
    serviceId: number;
    ichId: number;
    /** Der Platz der Suche (`Vertretung.index`): **genau dieser** wird genommen, nie ein anderer freier. `undefined` = alte Markierung. */
    index?: number | null;
  },
): Promise<UebernehmenErgebnis> {
  let termin: RohTermin;
  try {
    termin = await port.termin(o.eventId);
  } catch (e) {
    const g: Grund = lesegrund(port, e);
    return {
      ok: false,
      grund: g === 'konflikt' || g === 'nicht-angekommen' ? 'voruebergehend' : g,
    };
  }
  const imDienst = (termin.eventServices ?? []).filter(
    (p) => p.serviceId === o.serviceId && p.isValid !== false,
  );
  const indexVon = (p: RohPlatz) => (typeof p.index === 'number' ? p.index : null);
  // Mit gemerktem Platz zählt nur dieser – ein anderer freier Platz des Dienstes ist Sache der Planer. Gibt es ihn nicht mehr
  // (Platzzahl geändert) oder ist er besetzt, heißt das „besetzt“.
  const plaetze =
    o.index === undefined ? imDienst : imDienst.filter((p) => indexVon(p) === o.index);
  if (plaetze.some((p) => meinPlatz(p, o.ichId))) return { ok: true };
  // Ich stehe schon an einem ANDEREN Platz dieses Dienstes: nicht doppelt einteilen.
  if (o.index !== undefined && imDienst.some((p) => !istFrei(p) && p.personId === o.ichId))
    return { ok: false, grund: 'besetzt' };
  const frei = plaetze
    .filter((p) => istFrei(p) && typeof p.id === 'number')
    .sort((a, b) => ((a.index as number | null) ?? 0) - ((b.index as number | null) ?? 0));
  if (frei.length === 0) return { ok: false, grund: 'besetzt' };
  const erlaubt = frei.filter((p) => p.permissions?.enterSelfIfFree !== false);
  if (erlaubt.length === 0) return { ok: false, grund: 'kein-recht' };

  const platz = erlaubt[0];
  const ort = {
    eventId: o.eventId,
    serviceId: o.serviceId,
    index: typeof platz.index === 'number' ? platz.index : null,
  };
  const r = await platzAendern(port, ort, {
    vorher: (ist) => ist.art === 'frei',
    fertig: (ist) => gleicherStand(ist, ichZugesagt(o.ichId)),
    auftrag: (id) => ({
      pfad: `/persons/${o.ichId}/servicerequests/${id}`,
      method: 'PUT',
      json: { isAccepted: true },
    }),
  });
  if (r.ok) return { ok: true };
  // Jemand war schneller: zwischen Lesen und Schreiben besetzt (`konflikt`) – oder erst nach dem Schreiben nachgelesen: Die
  // Zusage steht nicht da, aber der Platz gehört jetzt jemand anderem. Beides heißt „schon übernommen“, nicht „nicht
  // angekommen“ (das wäre eine Fehlermeldung, wo nichts schiefging).
  const jemandAnderes =
    r.grund === 'nicht-angekommen' && r.jetzt !== undefined && r.jetzt.art !== 'frei';
  return { ok: false, grund: r.grund === 'konflikt' || jemandAnderes ? 'besetzt' : r.grund };
}
