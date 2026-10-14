/**
 * **Die Übersicht der Veranstaltungen** (A2, #480) – was die Startseite der Erweiterung aus den
 * ChurchTools-Daten macht: Einteilung in *Anstehend · Entwürfe · Vorbei*, Stand der Anmeldung und die
 * Hinweise für „Braucht deine Aufmerksamkeit“. Ohne Oberfläche und ohne Netz – geholt wird in
 * `anmeldungen/src/veranstaltungen.ts`.
 *
 * Eine Veranstaltung ist eine **Untergruppe der Team-Gruppe** (entschieden 12.10.2026, Messung
 * `docs/messung-a2-2026-10-12.md` im Planungsordner). Erkannt wird sie an den Einstellungen in ihrer
 * Beschreibung (`traegtEinstellungen`, altes und neues Format) oder – wenn die fehlen, weil jemand die
 * Beschreibung in ChurchTools überschrieben hat – an der Gruppenart „Anmeldung“ (A5). Andere Untergruppen
 * (z. B. „Lobpreisteam“ unter „Gottesdienst“) sind keine.
 */
import {
  einstellungenLesen,
  traegtEinstellungen,
  type OeffentlicheEinstellungen,
  type TerminAngabe,
} from './formular';
import { preisKurz } from './preis';

/** Was ChurchTools über die Untergruppe liefert (`GET /groups/{id}/children`, gemessen 12.10.2026). */
export interface VeranstaltungRoh {
  id: number;
  name: string;
  /** Die Team-Gruppe, unter der sie liegt. */
  gruppeId: number;
  /** ChurchTools-Gruppenstatus: 1 aktiv, 2 Entwurf (A0 #7: für Gäste unsichtbar), sonst beendet. */
  statusId: number;
  /** Die Beschreibung (`information.note`) – darin unsere Einstellungen. */
  beschreibung: string;
  /** Gruppenart (`domainAttributes.groupTypeId`) – erkennt eine Veranstaltung ohne Einstellungen (A5). */
  typId?: number;
}

/** Was ChurchTools sonst zur Gruppe weiß (`GET /groups?ids[]=…`). */
export interface VeranstaltungDetails {
  maxPlaetze: number | null;
  /** ISO-Zeitpunkte aus `signUpOpeningDate`/`signUpClosingDate`; ohne Beginn ist die Anmeldung zu (A0). */
  anmeldungAb: string | null;
  anmeldungBis: string | null;
  warteliste: boolean;
}

/** Gezählt aus den Mitgliedern (`GET /groups/{id}/members`). */
export interface Belegung {
  aktiv: number;
  wartend: number;
  /** `null`, wenn es kein Feld „bezahlt“ gibt – dann gibt es auch nichts zu zahlen. */
  unbezahlt: number | null;
}

export type Phase = 'entwurf' | 'anstehend' | 'vorbei';
export type Anmeldestand = 'offen' | 'bald' | 'geschlossen' | 'voll';

export interface Veranstaltung {
  id: number;
  name: string;
  gruppeId: number;
  phase: Phase;
  termin: TerminAngabe | null;
  /** Beginn als `YYYY-MM-DD` – danach wird sortiert; `null` ohne Datum. */
  tag: string | null;
  einstellungen: OeffentlicheEinstellungen;
  preis: string;
  /** Nur bei anstehenden Veranstaltungen. */
  anmeldung: Anmeldestand | null;
  anmeldungBis: string | null;
  maxPlaetze: number | null;
  /** `null`, wenn die Mitglieder nicht gelesen wurden (Entwurf, vorbei, kein Recht). */
  belegung: Belegung | null;
}

/** Eine Untergruppe mit unserer Kennung, deren Einstellungen sich nicht lesen lassen. */
export interface KaputteVeranstaltung {
  id: number;
  name: string;
  gruppeId: number;
}

/**
 * **Kennung einer Logo-Gruppe** (eigenes Logo, Alwin 14.10.2026). ChurchTools kennt je Gruppe nur EIN Bild, das
 * Titelbild belegt es schon – ein eigenes Logo liegt deshalb als Bild einer archivierten Hilfsgruppe derselben
 * Art unter dem Team (gemessen: das Bild ist ohne Login abrufbar, auch archiviert; wird die Gruppe gelöscht, ist
 * es weg). Die Beschreibung beginnt mit diesem Satz – daran wird sie erkannt und aus den Veranstaltungen
 * herausgehalten.
 */
export const LOGO_KENNUNG = 'Logo für die Anmeldungen.';

export function istLogoGruppe(beschreibung: string | null | undefined): boolean {
  return !!beschreibung && beschreibung.startsWith(LOGO_KENNUNG);
}

/**
 * Ist die Untergruppe überhaupt eine Veranstaltung der Anmeldungen? An den Einstellungen in der Beschreibung –
 * oder, mit `artId`, an der Gruppenart „Anmeldung“ (dann auch, wenn die Einstellungen fehlen). Logo-Gruppen
 * haben dieselbe Art, sind aber keine Veranstaltung.
 */
export function istVeranstaltung(
  roh: Pick<VeranstaltungRoh, 'beschreibung' | 'typId'>,
  artId?: number | null,
): boolean {
  if (istLogoGruppe(roh.beschreibung)) return false;
  if (traegtEinstellungen(roh.beschreibung)) return true;
  return artId !== undefined && artId !== null && roh.typId === artId;
}

/**
 * **Phase:** Entwurf (Status 2) → Entwürfe; aktiv und der letzte Tag liegt vor heute → Vorbei; sonst
 * Anstehend – auch ohne Datum, damit eine freigegebene Veranstaltung nie verschwindet. Andere Status
 * (in ChurchTools beendet/archiviert) gelten als vorbei.
 */
export function phaseVon(statusId: number, termin: TerminAngabe | null, heute: string): Phase {
  if (statusId === 2) return 'entwurf';
  if (statusId !== 1) return 'vorbei';
  if (!termin) return 'anstehend';
  const letzterTag = (termin.ende ?? termin.beginn).slice(0, 10);
  return letzterTag < heute ? 'vorbei' : 'anstehend';
}

/**
 * **Stand der Anmeldung** einer anstehenden Veranstaltung, die Zweige einzeln:
 * voll (alle Plätze belegt) vor geschlossen (Anmeldeschluss vorbei) vor bald (Beginn fehlt oder liegt in
 * der Zukunft – ohne Beginn nimmt ChurchTools keine Anmeldung an, A0) vor offen.
 */
export function anmeldestand(
  d: VeranstaltungDetails,
  belegung: Belegung | null,
  jetzt: Date,
): Anmeldestand {
  if (d.maxPlaetze !== null && belegung !== null && belegung.aktiv >= d.maxPlaetze) return 'voll';
  if (d.anmeldungBis !== null && new Date(d.anmeldungBis) < jetzt) return 'geschlossen';
  if (d.anmeldungAb === null || new Date(d.anmeldungAb) > jetzt) return 'bald';
  return 'offen';
}

/** Mitglieder zählen. `bezahltFeldId` aus `ctFelder.bezahlt` der Einstellungen. */
export function belegungAus(
  mitglieder: { groupMemberStatus?: string; fields?: { id?: unknown; value?: unknown }[] }[],
  bezahltFeldId: number | undefined,
): Belegung {
  let aktiv = 0;
  let wartend = 0;
  let unbezahlt = 0;
  for (const m of mitglieder) {
    if (m.groupMemberStatus === 'waiting') wartend++;
    if (m.groupMemberStatus !== 'active') continue;
    aktiv++;
    if (bezahltFeldId === undefined) continue;
    const wert = (m.fields ?? []).find((f) => Number(f.id) === bezahltFeldId)?.value;
    // ChurchTools liefert ein angekreuztes Feld als '1', ein nicht angekreuztes als '0' (gemessen 12.10.2026).
    if (!(wert === '1' || wert === 1 || wert === true)) unbezahlt++;
  }
  return { aktiv, wartend, unbezahlt: bezahltFeldId === undefined ? null : unbezahlt };
}

/**
 * Eine Veranstaltung aus allem, was ChurchTools liefert. `null` = keine (oder unlesbare) Veranstaltung.
 * `gelesen`: schon gelesene Einstellungen – z. B. aus der Sicherung repariert (A5), dann steht in
 * `roh.beschreibung` noch der überschriebene Text.
 */
export function veranstaltungAus(
  roh: VeranstaltungRoh,
  details: VeranstaltungDetails,
  belegung: Belegung | null,
  heute: string,
  jetzt: Date,
  gelesen: OeffentlicheEinstellungen | null = einstellungenLesen(roh.beschreibung),
): Veranstaltung | null {
  const einstellungen = gelesen;
  if (!einstellungen) return null;
  const phase = phaseVon(roh.statusId, einstellungen.termin, heute);
  return {
    id: roh.id,
    name: roh.name,
    gruppeId: roh.gruppeId,
    phase,
    termin: einstellungen.termin,
    tag: einstellungen.termin?.beginn.slice(0, 10) ?? null,
    einstellungen,
    preis: preisKurz(einstellungen.preis),
    anmeldung: phase === 'anstehend' ? anmeldestand(details, belegung, jetzt) : null,
    anmeldungBis: details.anmeldungBis,
    maxPlaetze: details.maxPlaetze,
    belegung,
  };
}

/** Ohne Datum ans Ende – sonst nach Tag, bei gleichem Tag nach Name. */
function frueherZuerst(a: Veranstaltung, b: Veranstaltung): number {
  if (a.tag !== b.tag) {
    if (a.tag === null) return 1;
    if (b.tag === null) return -1;
    return a.tag < b.tag ? -1 : 1;
  }
  return a.name.localeCompare(b.name, 'de');
}

export interface Einteilung {
  anstehend: Veranstaltung[];
  entwuerfe: Veranstaltung[];
  /** Neueste zuerst. */
  vorbei: Veranstaltung[];
}

export function einteilen(liste: Veranstaltung[]): Einteilung {
  const sortiert = [...liste].sort(frueherZuerst);
  return {
    anstehend: sortiert.filter((v) => v.phase === 'anstehend'),
    entwuerfe: sortiert.filter((v) => v.phase === 'entwurf'),
    vorbei: sortiert.filter((v) => v.phase === 'vorbei').reverse(),
  };
}

export type Hinweis =
  | { art: 'kaputt'; id: number; name: string; gruppeId: number }
  | { art: 'freigabe'; v: Veranstaltung; darfFreigeben: boolean }
  | { art: 'nachruecken'; v: Veranstaltung; frei: number; wartend: number }
  | { art: 'zahlungen'; v: Veranstaltung; offen: number };

/**
 * **„Braucht deine Aufmerksamkeit“**, wie im Entwurf:
 * - Einstellungen nicht lesbar (zuerst – sonst sieht niemand, dass eine Veranstaltung fehlt),
 * - Entwurf wartet auf Freigabe (freigeben darf die Leitung der Gruppe),
 * - Plätze frei, aber jemand wartet → nachrücken (das macht ChurchTools bewusst nicht von selbst),
 * - offene Zahlungen – **nur für die Leitung**, für alle anderen wäre es Lärm.
 * Vorbei ist vorbei: dort gibt es keine Hinweise.
 */
export function aufmerksamkeit(
  liste: Veranstaltung[],
  kaputt: KaputteVeranstaltung[],
  leitungIn: ReadonlySet<number>,
): Hinweis[] {
  const out: Hinweis[] = kaputt.map((k) => ({ art: 'kaputt' as const, ...k }));
  for (const v of [...liste].sort(frueherZuerst)) {
    if (v.phase === 'entwurf') {
      out.push({ art: 'freigabe', v, darfFreigeben: leitungIn.has(v.gruppeId) });
      continue;
    }
    if (v.phase !== 'anstehend' || !v.belegung) continue;
    const { aktiv, wartend, unbezahlt } = v.belegung;
    if (wartend > 0 && v.maxPlaetze !== null && aktiv < v.maxPlaetze) {
      out.push({ art: 'nachruecken', v, frei: v.maxPlaetze - aktiv, wartend });
    }
    if (unbezahlt && leitungIn.has(v.gruppeId)) out.push({ art: 'zahlungen', v, offen: unbezahlt });
  }
  return out;
}

/** Wie viele Untergruppen gibt es, die man nicht sehen darf? (Hierarchie ist für alle lesbar, A2.) */
export function verborgeneUntergruppen(
  kinderLautHierarchie: number[],
  sichtbareKinder: number[],
): number {
  const sichtbar = new Set(sichtbareKinder);
  return kinderLautHierarchie.filter((id) => !sichtbar.has(id)).length;
}
