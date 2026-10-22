/**
 * **Die Liste der Anmeldungen** (A7-1, Entwurf `a7-anmeldungen-v2`) – aus den Mitgliedern der Gruppe und ihrem
 * Verlauf, ohne Oberfläche. Gemessen 19.10.2026 (`messung-a7-2026-10-19.md`):
 *
 * - `GET /groups/{id}/members`: Gruppenfelder je Nummer; Auswahl-Felder als **Options-ID** (`'96'`), Ankreuzen `'1'`/`'0'`.
 * - `GET /groups/{id}/members/history`: jede Änderung `previous → current`, Felder **mit Namen** und lesbar. Absagen
 *   (`active|waiting → null`) behalten alle Antworten; der **Anmeldetag** steht im Eintrag, mit dem jemand dazukam –
 *   `memberStartDate` wird beim Nachrücken auf den Tag des Nachrückens gesetzt.
 *
 * Zusammengehalten wird eine Anmeldung über die Anmelde-Nr. (A6-5a); ohne Nr. (vor dem 17.10.2026) steht jede Person
 * für sich. Was es einmal je Anmeldung gibt (Kontakt, Unterschrift, Betrag …), steht bei der ersten Person (Variante A,
 * `senden.ts`) – hat sie abgesagt, kommt es aus dem Verlauf.
 */
import {
  alterAm,
  ctAblage,
  ctZusatzSpalten,
  nurText,
  SYSTEMFELDER,
  type Feld,
  type OeffentlicheEinstellungen,
} from './formular';
import { centAusEuroText, kannEtwasKosten } from './preis';
import { eigeneZahlungArt, istEigeneZahlung } from './zahlung';

/** Im Verlauf stehen die Felder mit ihrem Namen – so heißt die Anmelde-Nr. dort. */
const NR_NAME = SYSTEMFELDER.find((f) => f.id === 'nr')!.name;

/** Ein Gruppenfeld der Veranstaltung, wie ChurchTools es beschreibt (`GET /groups/{id}/memberfields`). */
export interface CtGruppenfeld {
  id: number;
  name: string;
  fieldTypeCode?: string;
  options?: { id: string | number; name: string }[];
}

/** Ein Mitglied, wie `GET /groups/{id}/members` es liefert (nur, was die Liste braucht). */
export interface MitgliedRoh {
  personId?: number;
  person?: { title?: string; domainAttributes?: { firstName?: string; lastName?: string } };
  groupTypeRoleId?: number;
  groupMemberStatus?: string;
  memberStartDate?: string | null;
  waitinglistPosition?: number | null;
  fields?: { id?: unknown; value?: unknown }[];
}

/** Ein Eintrag aus `GET /groups/{id}/members/history`. */
export interface VerlaufRoh {
  /** Steigt mit jedem Eintrag – ordnet Einträge derselben Sekunde (gemessen 19.10.2026: Entfernen + Wieder-Aufnehmen). */
  id?: number;
  memberId?: number;
  /** `sign-up` = über das Formular, `default` = vom Team. */
  origin?: string;
  current?: { membershipStatus?: string | null; fields?: Record<string, unknown> | null } | null;
  previous?: { membershipStatus?: string | null; fields?: Record<string, unknown> | null } | null;
  meta?: { createdDate?: string; createdPerson?: { id?: number } | null };
}

/**
 * Was es über die Person selbst gibt (`GET /persons?ids[]=…`) – je nach Rechten auch nichts. Der Name wird für
 * Abgesagte gebraucht: Im Verlauf steht er nicht.
 */
export interface PersonDaten {
  name: string;
  email: string | null;
  geburtstag: string | null;
}

/** Werte der Gruppenfelder je Feldnummer – lesbar (Auswahl als Text), leere weggelassen. */
export type Werte = Record<number, string>;

/** Ein Mitglied, wie Liste und Nachprüfung es brauchen. */
export interface ListenMitglied {
  personId: number;
  vor: string;
  nach: string;
  status: 'aktiv' | 'wartet' | 'sonst';
  warteplatz: number | null;
  /** Tag der Anmeldung (`YYYY-MM-DD`) aus dem Verlauf, sonst das Eintrittsdatum. */
  angemeldetAm: string | null;
  /** Vom Team eingetragen, nicht über das Formular (Verlauf: `origin: default`, A7-4). */
  vonHand: boolean;
  email: string | null;
  geburtstag: string | null;
  werte: Werte;
}

/** Eine abgesagte Person (aus dem Verlauf). */
export interface Absage {
  personId: number;
  name: string;
  /** Tag der Absage (`YYYY-MM-DD`). */
  am: string;
  /** Selbst abgesagt (Link in der Mail) – sonst vom Team entfernt. */
  selbst: boolean;
  warVorher: 'aktiv' | 'wartet';
  werte: Werte;
}

export interface Mitgliederstand {
  mitglieder: ListenMitglied[];
  absagen: Absage[];
}

const tag = (iso: string | null | undefined) =>
  typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : null;

/** Ein Wert lesbar: Auswahl als Name der Antwort, Ankreuzen nur, wenn angekreuzt, leere weg. */
function lesbar(feld: CtGruppenfeld | undefined, wert: unknown): string | null {
  if (wert === null || wert === undefined) return null;
  const text =
    typeof wert === 'string' ? wert.trim() : typeof wert === 'number' ? String(wert) : '';
  if (!text) return null;
  if (feld?.fieldTypeCode === 'checkbox') return text === '1' || text === 'true' ? '1' : null;
  if (feld?.options?.length) {
    const o = feld.options.find((x) => String(x.id) === text);
    if (o) return o.name;
  }
  return text;
}

/** Wer laut Verlauf nicht mehr dabei ist – für sie werden die Personendaten (Name) mitgeladen. */
export function abgesagteIds(verlauf: VerlaufRoh[], roh: MitgliedRoh[]): number[] {
  const da = new Set(roh.map((m) => m.personId));
  const ids = new Set<number>();
  for (const v of verlauf)
    if (typeof v.memberId === 'number' && !da.has(v.memberId) && v.previous?.membershipStatus)
      ids.add(v.memberId);
  return [...ids];
}

/**
 * **Mitglieder und Absagen** aus dem, was ChurchTools liefert. `leitung`: Rollen der Leitung – sie belegt keinen Platz
 * und hat keine Anmeldung (#623).
 */
export function mitgliederstandAus(
  roh: MitgliedRoh[],
  verlauf: VerlaufRoh[],
  felder: ReadonlyMap<number, CtGruppenfeld>,
  leitung: ReadonlySet<number>,
  personen: ReadonlyMap<number, PersonDaten>,
): Mitgliederstand {
  const nachName = new Map([...felder.values()].map((f) => [f.name, f]));
  // Verlauf der Reihe nach (ChurchTools liefert die neuesten zuerst); in derselben Sekunde nach der Nummer.
  const reihe = [...verlauf]
    .filter((v) => typeof v.memberId === 'number' && v.meta?.createdDate)
    .sort(
      (a, b) =>
        a.meta!.createdDate!.localeCompare(b.meta!.createdDate!) || (a.id ?? 0) - (b.id ?? 0),
    );
  // Anmeldetag: der erste Eintrag, mit dem jemand dazukam. Wer vom Team wieder aufgenommen wird („Rückgängig“ nach
  // einer Absage, A7-3), behält ihn; wer sich nach einer Absage neu anmeldet – über das Formular oder von Hand mit
  // einer neuen Anmelde-Nr. (A7-4, echt geprüft 22.10.2026) –, bekommt einen neuen.
  const dazu = new Map<number, string>();
  const vonHand = new Set<number>();
  const warWeg = new Set<number>();
  const weg = new Map<number, VerlaufRoh>();
  const nrBeimGehen = new Map<number, unknown>();
  const nrIn = (f: Record<string, unknown> | null | undefined) => f?.[NR_NAME] ?? null;
  for (const v of reihe) {
    const vorher = v.previous?.membershipStatus ?? null;
    const jetzt = v.current?.membershipStatus ?? null;
    const id = v.memberId!;
    if (!vorher && jetzt) {
      const neu =
        warWeg.has(id) &&
        (v.origin === 'sign-up' ||
          (nrIn(v.current?.fields) !== null && nrIn(v.current?.fields) !== nrBeimGehen.get(id)));
      if (!dazu.has(id) || neu) {
        dazu.set(id, v.meta!.createdDate!);
        if (v.origin === 'default') vonHand.add(id);
        else vonHand.delete(id);
      }
      warWeg.delete(id);
    }
    if (vorher && !jetzt) {
      weg.set(id, v);
      warWeg.add(id);
      nrBeimGehen.set(id, nrIn(v.previous?.fields));
    }
  }

  const mitglieder: ListenMitglied[] = [];
  const da = new Set<number>();
  for (const m of roh) {
    if (typeof m.personId !== 'number' || leitung.has(m.groupTypeRoleId ?? -1)) continue;
    da.add(m.personId);
    const werte: Werte = {};
    for (const f of m.fields ?? []) {
      const id = Number(f.id);
      const w = lesbar(felder.get(id), f.value);
      if (w !== null) werte[id] = w;
    }
    const attr = m.person?.domainAttributes;
    const p = personen.get(m.personId);
    mitglieder.push({
      personId: m.personId,
      vor: attr?.firstName ?? m.person?.title ?? '',
      nach: attr?.lastName ?? '',
      status:
        m.groupMemberStatus === 'active'
          ? 'aktiv'
          : m.groupMemberStatus === 'waiting'
            ? 'wartet'
            : 'sonst',
      warteplatz: m.groupMemberStatus === 'waiting' ? (m.waitinglistPosition ?? null) : null,
      angemeldetAm: tag(dazu.get(m.personId)) ?? tag(m.memberStartDate),
      vonHand: vonHand.has(m.personId),
      email: p?.email ?? null,
      geburtstag: p?.geburtstag ?? null,
      werte,
    });
  }

  const absagen: Absage[] = [];
  for (const [personId, v] of weg) {
    // Wieder dabei (später neu angemeldet) → keine Absage.
    if (da.has(personId)) continue;
    const vorher = v.previous!;
    const werte: Werte = {};
    for (const [name, wert] of Object.entries(vorher.fields ?? {})) {
      const f = nachName.get(name);
      // Im Verlauf steht die Auswahl schon als Text – nur leere und nicht angekreuzte weglassen.
      const w = f ? lesbar(f.options?.length ? undefined : f, wert) : null;
      if (f && w !== null) werte[f.id] = w;
    }
    absagen.push({
      personId,
      name: personen.get(personId)?.name || `Person ${personId}`,
      am: tag(v.meta!.createdDate) ?? '',
      selbst: v.meta?.createdPerson?.id === personId,
      warVorher: vorher.membershipStatus === 'waiting' ? 'wartet' : 'aktiv',
      werte,
    });
  }
  return { mitglieder, absagen };
}

// ── Anmeldungen (über die Anmelde-Nr.) ──────────────────────────────────────────────────────────

export interface ListenPerson {
  personId: number;
  vor: string;
  nach: string;
  /** Alter am ersten Tag der Veranstaltung (wie bei den Preisen). */
  alter: number | null;
  geburtstag: string | null;
  status: 'aktiv' | 'wartet';
  warteplatz: number | null;
  werte: Werte;
}

/**
 * **Eine Zahlung** (A7-2/A7-3) – die der Anmeldung (bei der ersten Person) und je Nachgerückter bzw. später dazu
 * angemeldeter Person (A7-4b) eine eigene (Alwin, 19.10.2026: „als ob ein Kind neu angemeldet wurde“). Steht in den Feldern „Betrag“, „Aufschlüsselung“, „Bezahlt“ …
 * der Person, bei der sie liegt.
 */
export interface Zahlung {
  /** Bei wem sie steht – `null`, wenn die Person abgesagt hat (dann aus dem Verlauf, nur zum Ansehen). */
  personId: number | null;
  wofuer: 'anmeldung' | 'nachgerueckt' | 'dazu';
  /** Vorname der Person, bei der sie steht. */
  name: string;
  betragCent: number | null;
  aufschluesselung: string | null;
  bezahlt: boolean;
  bezahltAm: string | null;
  zahlart: string | null;
  /** Kostet etwas, wer sie trägt, hat einen Platz, und „Bezahlt“ ist nicht angekreuzt. */
  offen: boolean;
}

export interface ListenAnmeldung {
  /** Anmelde-Nr., ohne Nr. `p<Person>`. */
  schluessel: string;
  nr: string | null;
  /** „Angemeldet von“, sonst die erste Person. */
  wer: string;
  email: string | null;
  angemeldetAm: string | null;
  /** Die erste Person wurde vom Team eingetragen (A7-4). */
  vonHand: boolean;
  /** Die erste Person (mit Betrag, Kontakt …) zuerst. */
  personen: ListenPerson[];
  abgesagt: Absage[];
  /** Was es einmal je Anmeldung gibt – bei der ersten Person, nach ihrer Absage aus dem Verlauf. */
  einmal: Werte;
  einmalAusVerlauf: boolean;
  /** Die Zahlung der Anmeldung zuerst, dann die eigenen der Nachgerückten. Leer, wenn nichts kostet und nichts steht. */
  zahlungen: Zahlung[];
  /** Alle Zahlungen zusammen; `null`, wenn keine einen Betrag hat. */
  betragCent: number | null;
  /** Aufschlüsselung, Tag und Zahlart der Zahlung der Anmeldung (für Liste und Mail). */
  aufschluesselung: string | null;
  /** Alle Zahlungen mit Betrag sind bezahlt. */
  bezahlt: boolean;
  bezahltAm: string | null;
  zahlart: string | null;
  /** Bei wem die Zahlung der Anmeldung steht – `null`, wenn die Person abgesagt hat (dann aus dem Verlauf). */
  zahlungBei: number | null;
  /** Mindestens eine Zahlung ist offen. */
  zahlungOffen: boolean;
}

/**
 * Feldnummern dessen, was es einmal je Anmeldung gibt (Systemfelder und Felder der Anmeldung) – auch für die Übergabe,
 * wenn die erste Person absagt (A7-3).
 */
export function einmalFelder(e: OeffentlicheEinstellungen): number[] {
  const ids = (['kontakt', 'betrag', 'aufschluesselung', 'auswahl', 'extras'] as const).map(
    (k) => e.ctFelder[k],
  );
  for (const f of e.formular.anmeldung) {
    ids.push(e.ctFelder[f.id]);
    for (const z of ctZusatzSpalten(f)) ids.push(e.ctFelder[z.schluessel]);
  }
  return ids.filter((x): x is number => typeof x === 'number');
}

const euro = (w: string | undefined) => (w === undefined ? null : centAusEuroText(w));

/**
 * **Die Anmeldungen einer Veranstaltung** – eine je Anmelde-Nr., ohne Nr. eine je Person. `stichtag`: erster Tag der
 * Veranstaltung (für das Alter), sonst heute.
 */
export function anmeldungenAus(
  e: OeffentlicheEinstellungen,
  stand: Mitgliederstand,
  stichtag: string,
): ListenAnmeldung[] {
  const nrFeld = e.ctFelder.nr;
  const nrVon = (w: Werte) => (nrFeld === undefined ? undefined : w[nrFeld]) || null;
  const einmal = einmalFelder(e);
  const traegt = (w: Werte) => einmal.some((id) => w[id] !== undefined);

  const gruppen = new Map<string, ListenMitglied[]>();
  for (const m of stand.mitglieder) {
    if (m.status === 'sonst') continue;
    const k = nrVon(m.werte) ?? `p${m.personId}`;
    gruppen.set(k, [...(gruppen.get(k) ?? []), m]);
  }

  const kostet = kannEtwasKosten(e.preis);
  const liste: ListenAnmeldung[] = [];
  for (const [schluessel, ms] of gruppen) {
    const nr = nrVon(ms[0].werte);
    const abgesagt = nr ? stand.absagen.filter((a) => nrVon(a.werte) === nr) : [];
    const aufVon = (w: Werte) =>
      e.ctFelder.aufschluesselung === undefined ? undefined : w[e.ctFelder.aufschluesselung];
    // Eine eigene Zahlung (nachgerückt A7-3, dazu angemeldet A7-4b) macht die Person nicht zur ersten.
    const erste = ms.find((m) => traegt(m.werte) && !istEigeneZahlung(aufVon(m.werte)));
    // Hat die erste Person abgesagt, steht das Einmalige nur noch im Verlauf (die neueste Absage, die es trägt).
    const ausVerlauf = erste
      ? undefined
      : [...abgesagt].sort((a, b) => b.am.localeCompare(a.am)).find((a) => traegt(a.werte));
    const w = erste?.werte ?? ausVerlauf?.werte ?? {};
    const reihe = erste ? [erste, ...ms.filter((m) => m !== erste)] : ms;
    const personen: ListenPerson[] = reihe.map((m) => ({
      personId: m.personId,
      vor: m.vor,
      nach: m.nach,
      alter: m.geburtstag ? alterAm(m.geburtstag.slice(0, 10), stichtag) : null,
      geburtstag: m.geburtstag,
      status: m.status === 'wartet' ? 'wartet' : 'aktiv',
      warteplatz: m.warteplatz,
      werte: m.werte,
    }));
    const kontakt = e.ctFelder.kontakt === undefined ? undefined : w[e.ctFelder.kontakt];
    const hatPlatz = (id: number | null) =>
      id === null
        ? personen.some((p) => p.status === 'aktiv')
        : personen.some((p) => p.personId === id && p.status === 'aktiv');
    const zahlungAus = (
      werte: Werte,
      personId: number | null,
      wofuer: Zahlung['wofuer'],
      name: string,
      platz: boolean,
    ): Zahlung => {
      const f = e.ctFelder;
      const betragCent = f.betrag === undefined ? null : euro(werte[f.betrag]);
      const bezahlt = f.bezahlt !== undefined && werte[f.bezahlt] === '1';
      return {
        personId,
        wofuer,
        name,
        betragCent,
        aufschluesselung: aufVon(werte) ?? null,
        bezahlt,
        bezahltAm:
          (f.bezahltAm === undefined ? undefined : werte[f.bezahltAm]?.slice(0, 10)) ?? null,
        zahlart: (f.zahlart === undefined ? undefined : werte[f.zahlart]) ?? null,
        offen: kostet && betragCent !== null && betragCent > 0 && !bezahlt && platz,
      };
    };
    // Ohne Einmaliges (z. B. ältere Anmeldung ohne Betrag) die erste Person der Zeile.
    const zahlungBei = ausVerlauf ? null : (erste ?? reihe[0]).personId;
    const haupt = zahlungAus(
      w,
      zahlungBei,
      'anmeldung',
      ausVerlauf ? ausVerlauf.name.split(' ')[0] : reihe[0].vor,
      hatPlatz(null),
    );
    const eigene = reihe
      .filter(
        (m) =>
          m.personId !== zahlungBei &&
          e.ctFelder.betrag !== undefined &&
          m.werte[e.ctFelder.betrag] !== undefined,
      )
      .map((m) =>
        zahlungAus(
          m.werte,
          m.personId,
          eigeneZahlungArt(aufVon(m.werte)) ?? 'anmeldung',
          m.vor,
          hatPlatz(m.personId),
        ),
      );
    const zahlungen =
      kostet || haupt.betragCent !== null || eigene.length ? [haupt, ...eigene] : [];
    const mitBetrag = zahlungen.filter((z) => z.betragCent !== null && z.betragCent > 0);
    const angemeldet = ms
      .map((m) => m.angemeldetAm)
      .filter((x): x is string => !!x)
      .sort()[0];
    liste.push({
      schluessel,
      nr,
      wer: kontakt || `${reihe[0].vor} ${reihe[0].nach}`.trim(),
      email: reihe.find((m) => m.email)?.email ?? null,
      angemeldetAm: angemeldet ?? null,
      vonHand: reihe[0]?.vonHand ?? false,
      personen,
      abgesagt,
      einmal: w,
      einmalAusVerlauf: !!ausVerlauf,
      zahlungen,
      betragCent: zahlungen.some((z) => z.betragCent !== null)
        ? zahlungen.reduce((summe, z) => summe + (z.betragCent ?? 0), 0)
        : null,
      aufschluesselung: haupt.aufschluesselung,
      bezahlt: mitBetrag.length > 0 && mitBetrag.every((z) => z.bezahlt),
      bezahltAm: haupt.bezahltAm,
      zahlart: haupt.zahlart,
      zahlungBei,
      zahlungOffen: zahlungen.some((z) => z.offen),
    });
  }
  return liste.sort(
    (a, b) =>
      (a.angemeldetAm ?? '9').localeCompare(b.angemeldetAm ?? '9') ||
      a.wer.localeCompare(b.wer, 'de'),
  );
}

/** Die Zahlen oben im Reiter. */
export interface ListenZahlen {
  belegt: number;
  wartend: number;
  /** Anmeldungen mit mindestens einer Person mit Platz. */
  anmeldungen: number;
  kostet: boolean;
  offenCent: number;
  offen: number;
  eingegangenCent: number;
}

export function listenZahlen(e: OeffentlicheEinstellungen, liste: ListenAnmeldung[]): ListenZahlen {
  const z: ListenZahlen = {
    belegt: 0,
    wartend: 0,
    anmeldungen: 0,
    kostet: kannEtwasKosten(e.preis),
    offenCent: 0,
    offen: 0,
    eingegangenCent: 0,
  };
  for (const a of liste) {
    const aktiv = a.personen.filter((p) => p.status === 'aktiv').length;
    z.belegt += aktiv;
    z.wartend += a.personen.length - aktiv;
    if (aktiv) z.anmeldungen++;
    if (a.zahlungOffen) z.offen++;
    for (const zahlung of a.zahlungen) {
      if (zahlung.offen) z.offenCent += zahlung.betragCent ?? 0;
      if (zahlung.bezahlt) z.eingegangenCent += zahlung.betragCent ?? 0;
    }
  }
  return z;
}

// ── Antworten zum Ansehen ─────────────────────────────────────────────────────────────────────

/** Eine Antwort, wie das Fenster sie zeigt. `striche`: Daten der Unterschrift (`unterschrift.ts`). */
export interface AntwortZeile {
  frage: string;
  text: string;
  striche?: string;
}

/**
 * **Die Antworten zu den Feldern eines Bereichs** – nur Fragen mit eigener Spalte in ChurchTools (Name, E-Mail und
 * Geburtsdatum zeigt das Fenster aus der Person). Unbeantwortete fallen weg, ausgeblendete Felder mit Antwort
 * bleiben (die Antwort steht ja da).
 */
export function antwortZeilen(
  felder: Feld[],
  werte: Werte,
  ctFelder: OeffentlicheEinstellungen['ctFelder'],
): AntwortZeile[] {
  const zeilen: AntwortZeile[] = [];
  for (const f of felder) {
    if (nurText(f.typ) || ctAblage(f).ort !== 'gruppenfeld') continue;
    const id = ctFelder[f.id];
    const w = id === undefined ? undefined : werte[id];
    if (f.typ === 'unterschrift') {
      const daten = ctZusatzSpalten(f)[0];
      const did = ctFelder[daten.schluessel];
      const striche = did === undefined ? undefined : werte[did];
      if (w || striche) zeilen.push({ frage: f.frage, text: w ?? '', striche });
      continue;
    }
    if (w === undefined) continue;
    zeilen.push({ frage: f.frage, text: f.typ === 'check' ? 'ja' : w });
  }
  return zeilen;
}
