/**
 * **Veranstaltungen in ChurchTools anlegen und einrichten** (A3, #486) – der erste Teil der Anmeldungen,
 * der schreibt. Alles an der Test-Instanz gemessen (`docs/messung-a3-2026-10-12.md` im Planungsordner).
 *
 * **Jeder Schreibschritt wird nachgelesen.** ChurchTools quittiert unbekannte oder verschachtelte Felder
 * mit 200 und speichert nichts (`information.note`, `appointmentStartDate` – gemessen); ein Erfolgssignal
 * ist kein Beleg. Weicht das Nachgelesene ab, wirft es `NichtUebernommen` – die Oberfläche sagt dann, was
 * fehlt, statt „gespeichert“ zu melden.
 */
import { ctAlleSeiten, ctAnfrage, ctBasis, ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import {
  SYSTEMFELDER,
  einstellungenAlsText,
  einstellungenLesen,
  type OeffentlicheEinstellungen,
} from '@shared/anmeldung/formular';
import { felderNeuZuordnen, systemfeldAnlage } from '@shared/anmeldung/felder';
import { neueEinstellungen, type Vorlage } from '@shared/anmeldung/vorlagen';
import { anmeldeLink, utcAus, type CtTermin } from '@shared/anmeldung/termin';
import { darfAnlegen, darfEinrichten } from '@shared/anmeldung/rechte';

/** ChurchTools hat geantwortet, aber nicht übernommen, was geschickt wurde. */
export class NichtUebernommen extends ApiError {
  constructor(was: string) {
    super(502, `ChurchTools hat ${was} nicht übernommen. Bitte noch einmal versuchen.`);
    this.name = 'NichtUebernommen';
  }
}

const json = (body: unknown) => JSON.stringify(body);

interface GruppeRoh {
  id: number;
  name: string;
  information?: { note?: string | null; groupStatusId?: number; groupTypeId?: number };
  settings?: {
    maxMembers?: number | null;
    allowWaitinglist?: boolean;
    signUpOpeningDate?: string | null;
    signUpClosingDate?: string | null;
    emailVerificationMode?: string;
  };
}

function gruppe(id: number): Promise<GruppeRoh> {
  return ctDaten<GruppeRoh>(`/groups/${id}`);
}

// ── Rechte ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Die Nummer der Gruppenart „Anmeldung“ – je Gemeinde verschieden, deshalb über den Namen gesucht. Fehlt
 * sie, sagt die Erweiterung, was einzurichten ist (Anleitung `docs/betrieb/ANMELDUNGEN.md`).
 */
export async function anmeldungsArt(): Promise<number | null> {
  const arten = await ctDaten<{ id: number; name: string }[]>('/group/grouptypes');
  return arten.find((a) => a.name.trim().toLowerCase() === 'anmeldung')?.id ?? null;
}

function globaleRechte(): Promise<{
  churchdb?: Record<string, unknown>;
  churchcal?: Record<string, unknown>;
}> {
  return ctDaten('/permissions/global');
}

function gruppenRechte(id: number): Promise<Record<string, unknown>> {
  return ctDaten<{ churchdb?: Record<string, unknown> }>(`/permissions/internal/groups/${id}`).then(
    (r) => r.churchdb ?? {},
  );
}

/** Unter welchen eigenen Teams darf man eine Anmeldung anlegen? */
export async function teamsZumAnlegen(teamIds: number[], artId: number): Promise<number[]> {
  const global = (await globaleRechte()).churchdb;
  const erlaubt: number[] = [];
  for (const id of teamIds) {
    if (darfAnlegen(await gruppenRechte(id), global, artId)) erlaubt.push(id);
  }
  return erlaubt;
}

/**
 * Kann die Person überhaupt anlegen – und unter welchen Teams? `artId: null`: Die Gruppenart „Anmeldung“
 * fehlt in dieser Gemeinde (dann sagt die Startseite, was einzurichten ist).
 */
export async function anlegenMoeglich(
  teamIds: number[],
): Promise<{ artId: number | null; teamIds: number[] }> {
  const artId = await anmeldungsArt();
  if (artId === null || teamIds.length === 0) return { artId, teamIds: [] };
  return { artId, teamIds: await teamsZumAnlegen(teamIds, artId) };
}

/** Darf man diese Veranstaltung einrichten und freigeben? */
export async function darfVeranstaltungEinrichten(id: number): Promise<boolean> {
  const [rechte, global] = await Promise.all([gruppenRechte(id), globaleRechte()]);
  return darfEinrichten(rechte, global.churchdb);
}

// ── Anlegen ─────────────────────────────────────────────────────────────────────────────────────

async function einstellungenSchreiben(id: number, e: OeffentlicheEinstellungen): Promise<void> {
  const text = einstellungenAlsText(e);
  await ctAnfrage(`/groups/${id}`, { method: 'PATCH', body: json({ note: text }) });
  if ((await gruppe(id)).information?.note !== text)
    throw new NichtUebernommen('die Einstellungen');
}

/** Name und Status (1 aktiv, 2 Entwurf) einer Veranstaltung. */
export async function kopfVon(id: number): Promise<{ name: string; statusId: number }> {
  const g = await gruppe(id);
  return { name: g.name, statusId: Number(g.information?.groupStatusId) };
}

/** Liest die Einstellungen einer Veranstaltung frisch aus ChurchTools. */
export async function einstellungenVon(id: number): Promise<OeffentlicheEinstellungen> {
  const e = einstellungenLesen((await gruppe(id)).information?.note);
  if (!e)
    throw new ApiError(422, 'Die Einstellungen dieser Veranstaltung lassen sich nicht lesen.');
  return e;
}

async function systemfelderAnlegen(id: number): Promise<Record<string, number>> {
  const ctFelder: Record<string, number> = {};
  for (const f of SYSTEMFELDER) {
    const neu = await ctAnfrage<{ data?: { id?: number } }>(`/groups/${id}/memberfields/group`, {
      method: 'POST',
      body: json(systemfeldAnlage(f)),
    });
    const feldId = neu?.data?.id;
    if (typeof feldId !== 'number') throw new NichtUebernommen(`das Feld „${f.name}“`);
    ctFelder[f.id] = feldId;
  }
  return ctFelder;
}

/**
 * **Neue Veranstaltung** – als Entwurf (Status 2, für Gäste unsichtbar, A0 #7) vom Typ „Anmeldung“ unter dem
 * Team. Reihenfolge mit Absicht: Zuerst stehen die Einstellungen in der Beschreibung – dann ist die
 * Veranstaltung schon in der Liste zu sehen, auch wenn ein späterer Schritt scheitert, statt als
 * unsichtbare Gruppe ohne Kennung zurückzubleiben. Danach Systemfelder, dann deren Nummern.
 */
export async function legeVeranstaltungAn(a: {
  name: string;
  teamId: number;
  artId: number;
  vorlage: Vorlage;
}): Promise<number> {
  const neu = await ctAnfrage<{ data?: { id?: number } }>('/groups', {
    method: 'POST',
    body: json({ name: a.name, groupTypeId: a.artId, groupStatusId: 2, parentGroupId: a.teamId }),
  });
  const id = neu?.data?.id;
  if (typeof id !== 'number') throw new NichtUebernommen('die neue Veranstaltung');
  const e = neueEinstellungen(a.vorlage);
  await einstellungenSchreiben(id, e);
  // Unbekannte melden sich ohne Bestätigungsmail an, bekannte Adressen bestätigen einmal (A0, Modus existing).
  await ctAnfrage(`/groups/${id}`, {
    method: 'PATCH',
    body: json({ emailVerificationMode: 'existing' }),
  });
  await einstellungenSchreiben(id, { ...e, ctFelder: await systemfelderAnlegen(id) });
  return id;
}

interface FeldRoh {
  type?: string;
  field?: { id?: number; name?: string };
}

async function gruppenfelder(id: number): Promise<{ id: number; name: string }[]> {
  const felder = await ctDaten<FeldRoh[]>(`/groups/${id}/memberfields`);
  return felder
    .filter((f) => f.type === 'group' && typeof f.field?.id === 'number' && f.field.name)
    .map((f) => ({ id: f.field!.id!, name: f.field!.name! }));
}

/**
 * **„Wie eine frühere Veranstaltung“** – ChurchTools kopiert Einstellungen, Beschreibung und Felder (mit
 * NEUEN Nummern), keine Anmeldungen; die Kopie ist ein Entwurf unter demselben Team (gemessen). Danach:
 * Feldnummern neu zuordnen und das Datum leeren – die Kopie findet sonst als „gestern“ statt.
 */
export async function kopiereVeranstaltung(quelleId: number, name: string): Promise<number> {
  const quelle = await einstellungenVon(quelleId);
  const kopie = await ctAnfrage<{ data?: { id?: number } }>(`/groups/${quelleId}/duplicate`, {
    method: 'POST',
    body: json({ newName: name }),
  });
  const id = kopie?.data?.id;
  if (typeof id !== 'number') throw new NichtUebernommen('die Kopie');
  const [alt, neu] = await Promise.all([gruppenfelder(quelleId), gruppenfelder(id)]);
  await einstellungenSchreiben(id, {
    ...quelle,
    termin: null,
    ctFelder: felderNeuZuordnen(quelle.ctFelder, alt, neu),
  });
  return id;
}

// ── Einrichten ──────────────────────────────────────────────────────────────────────────────────

/** Die Einstellungen ändern (Termin, wer meldet sich an, freie Plätze, Löschfrist …) – nachgelesen. */
export async function aendereEinstellungen(
  id: number,
  aendern: (e: OeffentlicheEinstellungen) => OeffentlicheEinstellungen,
): Promise<OeffentlicheEinstellungen> {
  const neu = aendern(await einstellungenVon(id));
  await einstellungenSchreiben(id, neu);
  return neu;
}

export interface AnmeldeEinstellungen {
  maxPlaetze: number | null;
  warteliste: boolean;
  /** ISO-Zeitpunkte; ohne Beginn nimmt ChurchTools keine Anmeldung an (A0). */
  ab: string | null;
  bis: string | null;
}

/** Zeitraum, Plätze, Warteliste – Felder der ChurchTools-Gruppe, flach geschickt (gemessen), nachgelesen. */
export async function speichereAnmeldung(id: number, a: AnmeldeEinstellungen): Promise<void> {
  await ctAnfrage(`/groups/${id}`, {
    method: 'PATCH',
    body: json({
      maxMembers: a.maxPlaetze,
      allowWaitinglist: a.warteliste,
      signUpOpeningDate: a.ab,
      signUpClosingDate: a.bis,
    }),
  });
  const s = (await gruppe(id)).settings ?? {};
  const gleich = (x: string | null | undefined, y: string | null) =>
    (x ? Date.parse(x) : null) === (y ? Date.parse(y) : null);
  if (
    (s.maxMembers ?? null) !== a.maxPlaetze ||
    (s.allowWaitinglist ?? false) !== a.warteliste ||
    !gleich(s.signUpOpeningDate, a.ab) ||
    !gleich(s.signUpClosingDate, a.bis)
  ) {
    throw new NichtUebernommen('Zeitraum, Plätze oder Warteliste');
  }
}

/** Liest Zeitraum, Plätze, Warteliste. */
export async function anmeldungVon(id: number): Promise<AnmeldeEinstellungen> {
  const s = (await gruppe(id)).settings ?? {};
  return {
    maxPlaetze: s.maxMembers ?? null,
    warteliste: s.allowWaitinglist ?? false,
    ab: s.signUpOpeningDate ?? null,
    bis: s.signUpClosingDate ?? null,
  };
}

/** Entwurf → aktiv. Ab jetzt sehen Gäste die Anmeldung (sobald der Zeitraum begonnen hat). */
export async function freigeben(id: number): Promise<void> {
  await ctAnfrage(`/groups/${id}`, { method: 'PATCH', body: json({ groupStatusId: 1 }) });
  if ((await gruppe(id)).information?.groupStatusId !== 1)
    throw new NichtUebernommen('die Freigabe');
}

// ── Kalender ────────────────────────────────────────────────────────────────────────────────────

export interface Kalender {
  id: number;
  name: string;
  /** Darf man hier Termine anlegen? (`churchcal["edit category"]`) */
  schreiben: boolean;
}

export async function kalenderListe(): Promise<Kalender[]> {
  const [liste, global] = await Promise.all([
    ctDaten<{ id: number; name: string }[]>('/calendars'),
    globaleRechte(),
  ]);
  const schreibbar = global.churchcal?.['edit category'];
  const ids = new Set(Array.isArray(schreibbar) ? schreibbar.map(Number) : []);
  return liste
    .map((k) => ({ id: k.id, name: k.name, schreiben: ids.has(k.id) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Termine eines Kalenders im Zeitraum (`von`/`bis` als `YYYY-MM-DD`); Serien liefern ihr berechnetes Datum. */
export async function termineIn(kalenderId: number, von: string, bis: string): Promise<CtTermin[]> {
  const roh = await ctDaten<
    { base?: CtTermin; calculated?: { startDate?: string; endDate?: string } }[]
  >(`/calendars/appointments?calendar_ids[]=${kalenderId}&from=${von}&to=${bis}`);
  return roh
    .filter((t) => t.base)
    .map((t) => ({
      ...t.base!,
      startDate: t.calculated?.startDate ?? t.base!.startDate,
      endDate: t.calculated?.endDate ?? t.base!.endDate,
    }));
}

/**
 * **Neuen Termin anlegen** – mit dem Link zur Anmeldung. Nur bei eigenen Terminen: `PUT` ersetzt einen
 * Termin ganz (gemessen) und würde an fremden Terminen Räume, Dienste oder Bild verlieren.
 */
export async function legeTerminAn(t: {
  kalenderId: number;
  titel: string;
  beginn: string;
  ende: string;
  ort: string;
  gruppeId: number;
  zeitzone: string;
}): Promise<CtTermin> {
  const neu = await ctAnfrage<{ data?: CtTermin }>(`/calendars/${t.kalenderId}/appointments`, {
    method: 'POST',
    body: json({
      calendarId: t.kalenderId,
      title: t.titel,
      startDate: utcAus(t.beginn, t.zeitzone),
      endDate: utcAus(t.ende, t.zeitzone),
      isInternal: false,
      link: anmeldeLink(ctBasis(), t.gruppeId),
      address: t.ort ? { meetingAt: t.ort } : null,
    }),
  });
  const id = neu?.data?.id;
  if (typeof id !== 'number') throw new NichtUebernommen('den Termin');
  const gelesen = await ctDaten<{ appointment?: { base?: CtTermin } & CtTermin }>(
    `/calendars/${t.kalenderId}/appointments/${id}`,
  );
  const base = gelesen.appointment?.base ?? gelesen.appointment;
  if (!base || Date.parse(base.startDate) !== Date.parse(utcAus(t.beginn, t.zeitzone))) {
    throw new NichtUebernommen('den Termin');
  }
  return base;
}

/** Alle Veranstaltungen eines Teams (auch vergangene) – Auswahl für „wie eine frühere“. */
export async function veranstaltungenVon(teamId: number): Promise<{ id: number; name: string }[]> {
  const kinder = await ctAlleSeiten<{
    title?: string;
    domainIdentifier?: string;
    domainAttributes?: { note?: string | null };
  }>(`/groups/${teamId}/children`);
  return kinder
    .filter((k) => einstellungenLesen(k.domainAttributes?.note) !== null)
    .map((k) => ({ id: Number(k.domainIdentifier), name: (k.title ?? '').trim() }));
}
