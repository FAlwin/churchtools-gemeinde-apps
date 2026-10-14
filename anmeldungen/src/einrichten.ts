/**
 * **Veranstaltungen in ChurchTools anlegen und einrichten** (A3, #486) – der erste Teil der Anmeldungen,
 * der schreibt. Alles an der Test-Instanz gemessen (`docs/messung-a3-2026-10-12.md` im Planungsordner).
 *
 * **Jeder Schreibschritt wird nachgelesen.** ChurchTools quittiert unbekannte oder verschachtelte Felder
 * mit 200 und speichert nichts (`information.note`, `appointmentStartDate` – gemessen); ein Erfolgssignal
 * ist kein Beleg. Weicht das Nachgelesene ab, wirft es `NichtUebernommen` – die Oberfläche sagt dann, was
 * fehlt, statt „gespeichert“ zu melden.
 */
import { ZodError } from 'zod';
import { ctAlleSeiten, ctAnfrage, ctBasis, ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { angemeldeteId } from '@ui/ct/ich';
import {
  SYSTEMFELDER,
  einstellungenAlsText,
  einstellungenLesen,
  einstellungenPacken,
  istAltesFormat,
  sichtbarerText,
  sicherungLesen,
  sicherungTeile,
  type OeffentlicheEinstellungen,
} from '@shared/anmeldung/formular';
import { pruefeRegeln, type PreisRegeln } from '@shared/anmeldung/preis';
import {
  NACHNAME,
  ZWECK_MAX,
  ibanNormal,
  pruefeBezahlung,
  zweckMitNeuemNamen,
  type Bezahlung,
} from '@shared/anmeldung/bezahlung';
import { LOGO_KENNUNG, belegungAus, istLogoGruppe } from '@shared/anmeldung/uebersicht';
import { felderNeuZuordnen, systemfeldAnlage } from '@shared/anmeldung/felder';
import { neueEinstellungen, type Vorlage } from '@shared/anmeldung/vorlagen';
import { utcAus, type CtTermin } from '@shared/anmeldung/termin';
import { darfAnlegen, darfEinrichten, darfVerschiebenUndLoeschen } from '@shared/anmeldung/rechte';
import {
  fehlendeBedingungen,
  type NeuePersonVorgaben,
  type Stammdaten,
  type Stammdatum,
} from '@shared/anmeldung/vorbereiten';

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
  information?: {
    note?: string | null;
    groupStatusId?: number;
    groupTypeId?: number;
    imageUrl?: string | null;
  };
  settings?: {
    maxMembers?: number | null;
    allowWaitinglist?: boolean;
    signUpOpeningDate?: string | null;
    signUpClosingDate?: string | null;
    emailVerificationMode?: string;
    visibility?: string;
    newMember?: {
      statusId?: number | null;
      campusId?: number | null;
      departmentId?: number | null;
    };
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

/**
 * Die Einstellungen als Text – oder eine Meldung, die sagt, was nicht passt. Ohne das stünde bei zu langen
 * Einstellungen (über 5.000 Zeichen) „ChurchTools antwortet gerade nicht“ da: Ein einfacher `Error` gilt in
 * `fehlerMeldung` als „keine Antwort“ (A4, beim Bauen der Preise gefunden).
 */
function alsText(e: OeffentlicheEinstellungen, sichtbar?: string): string {
  try {
    return einstellungenAlsText(e, sichtbar);
  } catch (err) {
    if (err instanceof ZodError)
      throw new ApiError(422, 'Eine Angabe ist zu lang oder ungültig und wurde nicht gespeichert.');
    throw new ApiError(413, err instanceof Error ? err.message : 'Die Einstellungen sind zu lang.');
  }
}

/**
 * **Einstellungen schreiben** (A5): unsichtbar und gepackt unter dem sichtbaren Text der Beschreibung – hat
 * jemand dort in ChurchTools eigenen Text geschrieben, bleibt er stehen. Danach die Sicherung. Beides
 * nachgelesen.
 */
async function einstellungenSchreiben(id: number, e: OeffentlicheEinstellungen): Promise<void> {
  const vorher = (await gruppe(id)).information?.note;
  const text = alsText(e, sichtbarerText(vorher));
  await ctAnfrage(`/groups/${id}`, { method: 'PATCH', body: json({ note: text }) });
  if ((await gruppe(id)).information?.note !== text)
    throw new NichtUebernommen('die Einstellungen');
  await sicherungSchreiben(id, text, e.ctFelder);
}

/** Die Beschreibungen (`note`) der Gruppenfelder einer Veranstaltung, je Feldnummer. */
async function feldNotizen(id: number): Promise<Map<number, string>> {
  const felder = await ctDaten<{ type?: string; field?: { id?: number; note?: string | null } }[]>(
    `/groups/${id}/memberfields`,
  );
  const m = new Map<number, string>();
  for (const f of felder)
    if (f.type === 'group' && typeof f.field?.id === 'number')
      m.set(f.field.id, f.field.note ?? '');
  return m;
}

/**
 * **Die Sicherung schreiben** (A5, Alwin: „versteckt + Sicherung“) – derselbe Code in den Beschreibungen der
 * Systemfelder, in Teilen zu je höchstens 1.024 Zeichen (`sicherungTeile`). Nur, was sich geändert hat, wird
 * geschrieben; danach nachgelesen. Veranstaltungen aus der Zeit vor A3 haben nicht alle Systemfelder – reicht
 * der Platz nicht, bleiben sie ohne Sicherung.
 */
async function sicherungSchreiben(
  id: number,
  beschreibung: string,
  ctFelder: Record<string, number>,
): Promise<void> {
  const teile = sicherungTeile(beschreibung);
  const ids = SYSTEMFELDER.map((f) => ctFelder[f.id]).filter(
    (x): x is number => typeof x === 'number',
  );
  if (!teile || ids.length < teile.length) return;
  const jetzt = await feldNotizen(id);
  for (const [i, feldId] of ids.entries()) {
    const soll = teile[i] ?? '';
    if ((jetzt.get(feldId) ?? '') === soll) continue;
    await ctAnfrage(`/groups/${id}/memberfields/group/${feldId}`, {
      method: 'PATCH',
      body: json({ note: soll }),
    });
  }
  // Nachlesen gegen das, was geschrieben werden sollte – eine noch lesbare, aber VERALTETE Sicherung zählt
  // nicht (beim Schreiben des Tests gefunden).
  const nachher = await feldNotizen(id);
  if (ids.some((f, i) => (nachher.get(f) ?? '') !== (teile[i] ?? '')))
    throw new NichtUebernommen('die Sicherung der Einstellungen');
}

/**
 * **Reparieren** (A5): Fehlen die Einstellungen in der Beschreibung (jemand hat sie in ChurchTools bearbeitet;
 * der Editor wirft die unsichtbare Zeile weg – gemessen), stellt die Erweiterung sie aus der Sicherung wieder
 * her und behält den neuen Text. `null`, wenn es keine Sicherung gibt. Darf man nicht schreiben (403), gibt es
 * die Einstellungen trotzdem zum Ansehen.
 */
export async function reparieren(id: number): Promise<OeffentlicheEinstellungen | null> {
  const e = sicherungLesen([...(await feldNotizen(id)).values()]);
  if (!e) return null;
  try {
    await einstellungenSchreiben(id, e);
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 403)) throw err;
  }
  return e;
}

/** Name, Status (1 aktiv, 2 Entwurf) und Titelbild einer Veranstaltung. */
export async function kopfVon(
  id: number,
): Promise<{ name: string; statusId: number; bildUrl: string | null }> {
  const g = await gruppe(id);
  return {
    name: g.name,
    statusId: Number(g.information?.groupStatusId),
    bildUrl: g.information?.imageUrl || null,
  };
}

/** Größtes Titelbild, das die Erweiterung hochlädt – größere Fotos vorher verkleinern. */
export const BILD_MAX_BYTES = 8 * 1024 * 1024;

/**
 * **Titelbild hochladen** (A5) – das Gruppenbild in ChurchTools, ohne Login abrufbar (A0). Gemessen 13.10.2026:
 * `POST /files/groupimage/{id}` mit dem Feld `files[]`. Nachgelesen; gibt die neue Bild-Adresse zurück.
 */
function bildPruefen(datei: File): void {
  if (!datei.type.startsWith('image/'))
    throw new ApiError(422, 'Bitte ein Bild wählen (JPG oder PNG).');
  if (datei.size > BILD_MAX_BYTES)
    throw new ApiError(413, 'Das Bild ist größer als 8 MB. Bitte vorher verkleinern.');
}

export async function bildHochladen(id: number, datei: File): Promise<string> {
  bildPruefen(datei);
  const form = new FormData();
  form.append('files[]', datei, datei.name);
  await ctAnfrage(`/files/groupimage/${id}`, { method: 'POST', body: form });
  const url = (await gruppe(id)).information?.imageUrl;
  if (!url) throw new NichtUebernommen('das Titelbild');
  return url;
}

/**
 * **Das Gemeindelogo aus ChurchTools** (gemessen 13.10.2026): Angemeldet steht es in `/config` als `site_logo`
 * (z. B. `images/558/…`, relativ zur Instanz); ohne Login fehlt die Angabe. Die Bildadresse selbst ist ohne
 * Login abrufbar – deshalb wird sie in die Gestaltung übernommen, damit das öffentliche Formular sie zeigt.
 * `null`, wenn keins hinterlegt ist.
 */
export async function gemeindeLogo(): Promise<string | null> {
  const c = await ctAnfrage<{ site_logo?: string | null } | null>('/config');
  const pfad = c?.site_logo?.trim();
  if (!pfad) return null;
  return /^https:\/\//.test(pfad) ? pfad : `${ctBasis()}/${pfad.replace(/^\/+/, '')}`;
}

export interface EigenesLogo {
  /** Die Hilfsgruppe, deren Bild das Logo ist. */
  id: number;
  name: string;
  url: string;
}

const LOGO_TEXT = `${LOGO_KENNUNG} Bitte nicht löschen – sonst fehlt das Logo in den Formularen, die es zeigen.`;

/**
 * **Eigene Logos, die man sehen darf** – die archivierten Logo-Gruppen derselben Art wie die Veranstaltung
 * (Archivierte stehen nur in `/groups` mit Status-Filter, gemessen). Ohne Bild bleibt eine weg.
 */
export async function logoListe(veranstaltungId: number): Promise<EigenesLogo[]> {
  const art = (await gruppe(veranstaltungId)).information?.groupTypeId;
  if (typeof art !== 'number') return [];
  const roh = await ctAlleSeiten<GruppeRoh>(
    `/groups?group_status_ids[]=${STATUS.archiviert}&group_type_ids[]=${art}`,
    200,
  );
  return roh
    .filter((g) => istLogoGruppe(g.information?.note) && g.information?.imageUrl)
    .map((g) => ({
      id: g.id,
      name: g.name.replace(/^Logo:\s*/, ''),
      url: g.information!.imageUrl!,
    }))
    .sort((a, b) => b.id - a.id);
}

/**
 * **Eigenes Logo hochladen** (Alwin, 14.10.2026) – als Bild einer Hilfsgruppe (`LOGO_KENNUNG`): gleich
 * archiviert angelegt (so taucht sie nie als Entwurf auf), Art und Team wie die Veranstaltung – damit gelten
 * dieselben Rechte wie beim Anlegen. Gemessen 14.10.2026. Klappt ein Schritt nicht, wird die halbe Gruppe
 * wieder entfernt (wenn das auch nicht geht, bleibt sie unsichtbar im Archiv – ohne Kennung zeigt sie niemand).
 */
export async function logoHochladen(veranstaltungId: number, datei: File): Promise<EigenesLogo> {
  bildPruefen(datei);
  const [v, team] = await Promise.all([gruppe(veranstaltungId), teamVon(veranstaltungId)]);
  const name = `Logo: ${datei.name.replace(/\.[a-z0-9]+$/i, '')}`.slice(0, 100);
  const neu = await ctAnfrage<{ data?: { id?: number } }>('/groups', {
    method: 'POST',
    body: json({
      name,
      groupTypeId: v.information?.groupTypeId,
      groupStatusId: STATUS.archiviert,
      ...(team ? { parentGroupId: team.id } : {}),
    }),
  });
  const id = neu?.data?.id;
  if (typeof id !== 'number') throw new NichtUebernommen('das Logo');
  try {
    await ctAnfrage(`/groups/${id}`, { method: 'PATCH', body: json({ note: LOGO_TEXT }) });
    const url = await bildHochladen(id, datei);
    if (!istLogoGruppe((await gruppe(id)).information?.note))
      throw new NichtUebernommen('das Logo');
    return { id, name: name.replace(/^Logo:\s*/, ''), url };
  } catch (fehler) {
    await ctAnfrage(`/groups/${id}`, { method: 'DELETE' }).catch(() => undefined);
    throw fehler;
  }
}

/**
 * **Ein eigenes Logo entfernen** – löscht die Hilfsgruppe; Formulare, die das Logo zeigen, haben danach keins
 * mehr (gemessen: das Bild liefert dann 404). Nur Logo-Gruppen, nachgeprüft.
 */
export async function logoEntfernen(id: number): Promise<void> {
  if (!istLogoGruppe((await gruppe(id)).information?.note))
    throw new ApiError(409, 'Das ist keine Logo-Gruppe.');
  await ctAnfrage(`/groups/${id}`, { method: 'DELETE' });
  const noch = await gruppe(id).then(
    () => true,
    (e: unknown) => !(e instanceof ApiError && e.status === 404),
  );
  if (noch) throw new NichtUebernommen('das Entfernen des Logos');
}

/** **Titelbild entfernen** – dann gilt das Bild der Vorlage (gemessen: `DELETE /files/groupimage/{id}` → 204). */
export async function bildEntfernen(id: number): Promise<void> {
  await ctAnfrage(`/files/groupimage/${id}`, { method: 'DELETE' });
  if ((await gruppe(id)).information?.imageUrl)
    throw new NichtUebernommen('das Entfernen des Titelbilds');
}

/**
 * Liest die Einstellungen einer Veranstaltung frisch aus ChurchTools. Steht die Beschreibung noch im alten,
 * sichtbaren Format, schreibt sie sie gleich neu (A5: der Datenblock verschwindet aus „Infos“); geht das nicht
 * (kein Recht, ChurchTools antwortet nicht), bleibt sie, wie sie ist – gelesen ist sie trotzdem. Fehlen die
 * Einstellungen, wird aus der Sicherung repariert.
 */
export async function einstellungenVon(id: number): Promise<OeffentlicheEinstellungen> {
  const note = (await gruppe(id)).information?.note;
  const e = einstellungenLesen(note);
  if (e) {
    if (istAltesFormat(note)) await einstellungenSchreiben(id, e).catch(() => undefined);
    return e;
  }
  const repariert = await reparieren(id);
  if (repariert) return repariert;
  throw new ApiError(422, 'Die Einstellungen dieser Veranstaltung lassen sich nicht lesen.');
}

/**
 * Legt die Systemfelder an, die noch fehlen – beim Anlegen alle, beim Freigeben die neuen (A6-2: „Angemeldet von“
 * gab es vorher nicht). Gibt alle Nummern zurück, vorhandene eingeschlossen.
 */
async function systemfelderAnlegen(
  id: number,
  vorhanden: Record<string, number> = {},
): Promise<Record<string, number>> {
  const ctFelder: Record<string, number> = { ...vorhanden };
  for (const f of SYSTEMFELDER.filter((x) => vorhanden[x.id] === undefined)) {
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
  const vorlage = neueEinstellungen(a.vorlage);
  // Verwendungszweck gleich mit dem Namen der Veranstaltung („Gemeindeessen [Nachname]“, A4).
  const zweck = `${a.name.slice(0, ZWECK_MAX - NACHNAME.length - 1)} ${NACHNAME}`;
  const e = { ...vorlage, bezahlung: { ...vorlage.bezahlung, zweck } };
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
  const [quelle, quellName] = await Promise.all([
    einstellungenVon(quelleId),
    gruppe(quelleId).then((g) => g.name),
  ]);
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
    bezahlung: {
      ...quelle.bezahlung,
      zweck: zweckMitNeuemNamen(quelle.bezahlung.zweck, quellName, name),
    },
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

/**
 * **Preise ändern** (A4). `aendern` bekommt die frisch gelesenen Preise – so überschreibt ein Fenster nie,
 * was ein anderer Baustein inzwischen gespeichert hat. Ungültige Regeln werden nicht gespeichert
 * (`pruefeRegeln`, dieselbe Prüfung wie im Fenster). Wie oft eine Option schon gebucht ist (`belegt`), kommt
 * aus den Anmeldungen und bleibt beim Bearbeiten stehen – zugeordnet über den Namen der Option.
 */
export async function aenderePreise(
  id: number,
  aendern: (p: PreisRegeln) => PreisRegeln,
): Promise<OeffentlicheEinstellungen> {
  return aendereEinstellungen(id, (e) => {
    const neu = aendern(e.preis);
    const fehler = pruefeRegeln(neu);
    if (fehler.length) throw new ApiError(422, fehler.join(' '));
    const belegt = new Map(e.preis.grundpreis.optionen.map((o) => [o.name, o.belegt]));
    const optionen = neu.grundpreis.optionen.map((o) => ({
      ...o,
      belegt: belegt.get(o.name) ?? 0,
    }));
    return { ...e, preis: { ...neu, grundpreis: { ...neu.grundpreis, optionen } } };
  });
}

/** **Bezahlung speichern** (A4) – IBAN und BIC ohne Leerzeichen, geprüft wie im Fenster. */
export async function speichereBezahlung(id: number, b: Bezahlung): Promise<void> {
  const sauber: Bezahlung = {
    kontoinhaber: b.kontoinhaber.trim(),
    iban: ibanNormal(b.iban),
    bic: ibanNormal(b.bic),
    fristTage: b.fristTage,
    zweck: b.zweck.trim(),
  };
  const fehler = pruefeBezahlung(sauber);
  if (fehler.length) throw new ApiError(422, fehler.join(' '));
  await aendereEinstellungen(id, (e) => ({ ...e, bezahlung: sauber }));
}

/**
 * **Wie viele haben sich schon angemeldet?** (A4: Hinweis beim Ändern der Preise) – angemeldet und auf der
 * Warteliste, gezählt wie auf der Startseite (`belegungAus`). `null`, wenn man die Mitglieder nicht sehen darf
 * (403, dauerhaft); alles andere kann vorübergehend sein und wird geworfen.
 */
export async function anmeldungenZahl(id: number): Promise<number | null> {
  try {
    const mitglieder = await ctAlleSeiten<Parameters<typeof belegungAus>[0][number]>(
      `/groups/${id}/members`,
      200,
    );
    const b = belegungAus(mitglieder, undefined);
    return b.aktiv + b.wartend;
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) return null;
    throw e;
  }
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
  await setzeStatus(id, STATUS.freigegeben);
}

// ── Anmelden vorbereiten (A6-2, #548) ──────────────────────────────────────────────────────────

/** Status, Standorte, Bereiche der Gemeinde – zur Wahl der Vorgaben für neue Personen. */
export async function stammdaten(): Promise<Stammdaten> {
  const [status, standorte, bereiche] = await Promise.all([
    ctDaten<Stammdatum[]>('/statuses'),
    ctDaten<Stammdatum[]>('/campuses'),
    ctDaten<Stammdatum[]>('/departments'),
  ]);
  return { status: status ?? [], standorte: standorte ?? [], bereiche: bereiche ?? [] };
}

/** Die angemeldete Person (`/whoami`, mit der Unterscheidung abgemeldet/vorübergehend aus `angemeldeteId`). */
export async function meineId(): Promise<number> {
  return angemeldeteId(await ctDaten<unknown>('/whoami'));
}

export interface LeitungsKandidat {
  personId: number;
  name: string;
  /** Ist schon Leitung dieser Anmeldung. */
  leitung: boolean;
}

interface MitgliedRoh {
  personId?: number;
  groupTypeRoleId?: number;
  groupMemberStatus?: string;
  person?: { title?: string; domainAttributes?: { firstName?: string; lastName?: string } };
}

const personName = (m: MitgliedRoh) => {
  const d = m.person?.domainAttributes;
  return (`${d?.firstName ?? ''} ${d?.lastName ?? ''}`.trim() || m.person?.title) ?? '';
};

/** Die Leiter-Rolle der Gruppenart (`type: 'leader'`, gemessen: „Anmeldung“ → 35). */
async function leiterRolle(gruppenart: number): Promise<number> {
  const rollen =
    await ctDaten<{ id: number; groupTypeId: number; type?: string; isLeader?: boolean }[]>(
      '/group/roles',
    );
  const r = rollen.find((x) => x.groupTypeId === gruppenart && (x.type === 'leader' || x.isLeader));
  if (!r) throw new ApiError(422, 'Die Gruppenart dieser Veranstaltung hat keine Leiter-Rolle.');
  return r.id;
}

/**
 * **Wer Leitung werden kann** (Alwin, 14.10.2026: „beim Freigeben auswählen“) – die Mitglieder des Teams, dazu wer
 * schon Leitung dieser Anmeldung ist. Wie viele man im Team sieht, entscheiden die Rechte in ChurchTools (gemessen
 * A0: Teilnehmende sehen nur sich selbst).
 */
export async function leitungsKandidaten(id: number): Promise<LeitungsKandidat[]> {
  const g = await gruppe(id);
  const rolle = await leiterRolle(Number(g.information?.groupTypeId));
  const team = await teamVon(id);
  const [hier, imTeam] = await Promise.all([
    ctAlleSeiten<MitgliedRoh>(`/groups/${id}/members`),
    team ? ctAlleSeiten<MitgliedRoh>(`/groups/${team.id}/members`) : Promise.resolve([]),
  ]);
  const liste = new Map<number, LeitungsKandidat>();
  for (const m of [...imTeam, ...hier]) {
    if (typeof m.personId !== 'number') continue;
    const leitung = hier.some((x) => x.personId === m.personId && x.groupTypeRoleId === rolle);
    liste.set(m.personId, { personId: m.personId, name: personName(m), leitung });
  }
  return [...liste.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/**
 * **Anmelden vorbereiten** – was ChurchTools vor der ersten Anmeldung braucht (gemessen 14.10.2026):
 * 1. fehlende Systemfelder (z. B. „Angemeldet von“ bei älteren Veranstaltungen),
 * 2. die gewählte Leitung (Rolle `leader`),
 * 3. die Vorgaben für neue Personen – **flach** als `newPersonStatusId/CampusId/DepartmentId`
 *    (`newMember: {…}` meldet 200 und speichert nichts).
 * Jeder Schritt wird nachgelesen.
 */
export async function anmeldenVorbereiten(
  id: number,
  leitung: number[],
  v: NeuePersonVorgaben,
): Promise<void> {
  if (leitung.length === 0)
    throw new ApiError(422, 'Bitte mindestens eine Person als Leitung wählen.');
  const e = await einstellungenVon(id);
  if (SYSTEMFELDER.some((f) => e.ctFelder[f.id] === undefined))
    await einstellungenSchreiben(id, { ...e, ctFelder: await systemfelderAnlegen(id, e.ctFelder) });

  const g = await gruppe(id);
  const rolle = await leiterRolle(Number(g.information?.groupTypeId));
  for (const personId of leitung)
    await ctAnfrage(`/groups/${id}/members/${personId}`, {
      method: 'PUT',
      body: json({ groupTypeRoleId: rolle, groupMemberStatus: 'active' }),
    });
  const mitglieder = await ctAlleSeiten<MitgliedRoh>(`/groups/${id}/members`);
  if (
    !leitung.every((p) => mitglieder.some((m) => m.personId === p && m.groupTypeRoleId === rolle))
  )
    throw new NichtUebernommen('die Leitung');

  await ctAnfrage(`/groups/${id}`, {
    method: 'PATCH',
    body: json({
      newPersonStatusId: v.statusId,
      newPersonCampusId: v.campusId,
      newPersonDepartmentId: v.departmentId,
    }),
  });
  const n = (await gruppe(id)).settings?.newMember;
  if (
    n?.statusId !== v.statusId ||
    n?.campusId !== v.campusId ||
    n?.departmentId !== v.departmentId
  )
    throw new NichtUebernommen('die Vorgaben für neue Personen');
}

/**
 * **Nimmt ChurchTools jetzt Anmeldungen an?** So, wie Gäste es sehen: `/publicgroups/{id}` ohne Login. Leer = ja.
 * Antwortet ChurchTools nicht, kommt der Fehler hoch – „vorübergehend“ ist kein „alles fehlt“.
 */
export async function anmeldeBedingungen(id: number): Promise<string[]> {
  const r = await fetch(`${ctBasis()}/api/publicgroups/${id}`, { credentials: 'omit' });
  if (r.status === 401 || r.status === 403)
    return [
      'Die Veranstaltung ist für Gäste nicht lesbar (nicht freigegeben oder nicht öffentlich).',
    ];
  if (!r.ok) throw new ApiError(r.status, 'ChurchTools antwortet gerade nicht.');
  const j = (await r.json()) as { data?: { signUpConditions?: Record<string, unknown> } };
  return fehlendeBedingungen(j.data?.signUpConditions);
}

// ── Verwalten: umbenennen, Status, verschieben, Archiv, löschen (A4-Nachtrag) ───────────────────

/** Status einer ChurchTools-Gruppe: 1 aktiv (= freigegeben), 2 Entwurf, 3 archiviert. */
export const STATUS = { freigegeben: 1, entwurf: 2, archiviert: 3 } as const;

const STATUS_WAS: Record<number, string> = {
  1: 'die Freigabe',
  2: 'den Entwurf-Status',
  3: 'das Archivieren',
};

/**
 * **Status setzen** – freigeben, Freigabe zurücknehmen, archivieren, wiederherstellen. Darf, wer einrichten
 * darf (gemessen 13.10.2026: Organisator 200 für 1 ↔ 2 ↔ 3). Nachgelesen.
 *
 * **Freigeben macht die Gruppe auch für Gäste lesbar** (`visibility: 'public'`, A6-1 #542): Ohne das liefert
 * `/publicgroups/{id}` ohne Login 403, auch bei Status 1 – das öffentliche Formular bliebe leer (gemessen
 * 14.10.2026; `isPublic` allein ignoriert ChurchTools still, A5). Eine Liste aller öffentlichen Gruppen gibt es
 * nicht, gefunden wird die Anmeldung nur über ihren Link. Hier und nicht nur in `freigeben`, weil auch
 * „Verwalten“ und „Rückgängig“ über diese Funktion freigeben.
 */
export async function setzeStatus(id: number, statusId: number): Promise<void> {
  const fuerGaeste = statusId === STATUS.freigegeben;
  await ctAnfrage(`/groups/${id}`, {
    method: 'PATCH',
    body: json(
      fuerGaeste ? { groupStatusId: statusId, visibility: 'public' } : { groupStatusId: statusId },
    ),
  });
  const g = await gruppe(id);
  if (g.information?.groupStatusId !== statusId)
    throw new NichtUebernommen(STATUS_WAS[statusId] ?? 'den Status');
  if (fuerGaeste && g.settings?.visibility !== 'public')
    throw new NichtUebernommen('die Freigabe für Gäste (öffentlich lesbar)');
}

/**
 * **Umbenennen** (flach im PATCH, gemessen: Organisator 200). Nachgelesen. Steht der alte Name im
 * Verwendungszweck, zieht er mit (`zweckMitNeuemNamen`) – auch beim Zurückbenennen über „Rückgängig“.
 */
export async function umbenennen(id: number, name: string): Promise<void> {
  const neu = name.trim();
  if (!neu) throw new ApiError(422, 'Der Name darf nicht leer sein.');
  const vorher = await gruppe(id);
  await ctAnfrage(`/groups/${id}`, { method: 'PATCH', body: json({ name: neu }) });
  if ((await gruppe(id)).name !== neu) throw new NichtUebernommen('den neuen Namen');
  const e = einstellungenLesen(vorher.information?.note);
  if (!e) return;
  const zweck = zweckMitNeuemNamen(e.bezahlung.zweck, vorher.name, neu);
  if (zweck !== e.bezahlung.zweck)
    await einstellungenSchreiben(id, { ...e, bezahlung: { ...e.bezahlung, zweck } });
}

/** Die Obergruppe (das Team) einer Veranstaltung – auch einer archivierten (gemessen). */
export async function teamVon(id: number): Promise<{ id: number; name: string } | null> {
  const eltern = await ctDaten<{ title?: string; domainIdentifier?: string }[]>(
    `/groups/${id}/parents`,
  );
  const e = eltern[0];
  return e ? { id: Number(e.domainIdentifier), name: (e.title ?? '').trim() } : null;
}

/**
 * **In ein anderes Team verschieben** – erst die neue Obergruppe dazu, dann die alte weg (so hängt die
 * Veranstaltung nie ohne Team). Nur Gruppen-Admins (`darfVerschiebenUndLoeschen`). Nachgelesen.
 */
export async function verschieben(id: number, vonTeam: number, nachTeam: number): Promise<void> {
  if (vonTeam === nachTeam) return;
  await ctAnfrage(`/groups/${id}/parents/${nachTeam}`, { method: 'PUT' });
  await ctAnfrage(`/groups/${id}/parents/${vonTeam}`, { method: 'DELETE' });
  if ((await teamVon(id))?.id !== nachTeam) throw new NichtUebernommen('das neue Team');
}

/** Darf die angemeldete Person verschieben und endgültig löschen? (nur Gruppen-Admins) */
export async function istGruppenAdmin(): Promise<boolean> {
  return darfVerschiebenUndLoeschen((await globaleRechte()).churchdb);
}

export interface Archiviert {
  id: number;
  name: string;
  team: string | null;
  /** Erster Tag (Ortszeit), falls ein Termin gewählt war. */
  tag: string | null;
}

/**
 * **Das Archiv** – archivierte Veranstaltungen, die man sehen darf. Archivierte Gruppen stehen weder in
 * `children` noch in `hierarchies` (gemessen), wohl aber in `/groups` mit Status-Filter.
 */
export async function archivListe(artId: number): Promise<Archiviert[]> {
  const roh = await ctAlleSeiten<GruppeRoh>(
    `/groups?group_status_ids[]=${STATUS.archiviert}&group_type_ids[]=${artId}`,
    200,
  );
  const liste: Archiviert[] = [];
  for (const g of roh) {
    const e = einstellungenLesen(g.information?.note);
    if (!e) continue;
    const team = await teamVon(g.id).catch(() => null);
    liste.push({
      id: g.id,
      name: g.name,
      team: team?.name ?? null,
      tag: e.termin?.beginn.slice(0, 10) ?? null,
    });
  }
  return liste.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/**
 * **Endgültig löschen** – nur aus dem Archiv und nur für Gruppen-Admins. Löscht die Gruppe samt allen
 * Anmeldungen; ChurchTools kann das nicht zurückholen. Nachgeprüft: Danach muss die Gruppe 404 liefern.
 */
export async function loeschenEndgueltig(id: number): Promise<void> {
  if ((await gruppe(id)).information?.groupStatusId !== STATUS.archiviert)
    throw new ApiError(409, 'Endgültig löschen geht nur aus dem Archiv.');
  await ctAnfrage(`/groups/${id}`, { method: 'DELETE' });
  const noch = await gruppe(id).then(
    () => true,
    (e: unknown) => !(e instanceof ApiError && e.status === 404),
  );
  if (noch) throw new NichtUebernommen('das Löschen');
}

// ── Rückgängig ──────────────────────────────────────────────────────────────────────────────────

/**
 * **Der Stand einer Veranstaltung, wie sie die Seite zeigt** – für „Rückgängig“ (Alwin, 13.10.2026: „immer
 * mit Warnungen und Rückgängig-Knöpfen“). Eine Stelle für alle Fenster: Wer speichert, merkt sich vorher
 * diesen Stand; „Rückgängig“ schreibt ihn mit `wiederherstellen` zurück.
 */
export interface Stand {
  name: string;
  statusId: number;
  einstellungen: OeffentlicheEinstellungen;
  anmeldung: AnmeldeEinstellungen;
}

/**
 * **Einen früheren Stand zurückschreiben** – Name, Status, Einstellungen, Zeitraum/Plätze/Warteliste; jeder
 * Teil über die Funktion, die ihn auch sonst schreibt (und nachliest). Nur was sich unterscheidet, wird
 * geschrieben. Ein im Kalender neu angelegter Termin bleibt bestehen – zurück geht nur die Auswahl.
 */
export async function wiederherstellen(id: number, alt: Stand): Promise<void> {
  const jetzt = await gruppe(id);
  if (jetzt.name !== alt.name) await umbenennen(id, alt.name);
  const e = einstellungenLesen(jetzt.information?.note);
  if (!e || einstellungenPacken(e) !== einstellungenPacken(alt.einstellungen))
    await einstellungenSchreiben(id, alt.einstellungen);
  const a = await anmeldungVon(id);
  if (JSON.stringify(a) !== JSON.stringify(alt.anmeldung))
    await speichereAnmeldung(id, alt.anmeldung);
  if (jetzt.information?.groupStatusId !== alt.statusId) await setzeStatus(id, alt.statusId);
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
  /** Der Link zur Anmeldung (`anmeldeLink`) – `null`, solange die Gemeinde keine Formular-Seite hat. */
  link: string | null;
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
      ...(t.link ? { link: t.link } : {}),
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
