/**
 * **Nachweis-Arten in ChurchTools** (Etappe F, N1b) – lesen, anlegen, ändern. Eine Nachweis-Art ist eine Gruppe „Nachweis: …“
 * der Gruppenart „Nachweis“ (Grundlage: `nachweise.ts`, N1a) mit
 *
 * 1. ihren **Einstellungen** (Gültigkeit, Aufforderung) unsichtbar in der Beschreibung (`nachweisNotiz`),
 * 2. drei **Gruppenfeldern** auf Stufe 4 (`NACHWEIS_FELDER`),
 * 3. den **Vertrauenspersonen** als Leiter,
 * 4. einem **Ablauf** für die Rolle Teilnehmer (`nachweisSchritte`),
 * 5. (N1c, optional) dem **Antrag als Bescheinigung**: eine globale HTML-Vorlage (`antragSichern`), an die **Gruppenrolle**
 *    Teilnehmer gehängt – Logo und Unterschrift stecken NUR im HTML der Vorlage (`nachweisAntrag.ts`).
 *
 * **Jeder Schritt liest nach.** Ein `200`/`201` ist kein Beleg (Lehre vom 11.08.2026): Erst was beim Nachlesen dasteht,
 * zählt. **Jeder Schritt ist wiederholbar** und legt nur an, was fehlt – „Nochmal“ nach einem Teilerfolg macht nichts
 * doppelt (die Gruppe wird über ihre Nummer wiedergefunden, eine ohne Einstellungen angelegte über ihren Namen übernommen).
 * `nachweisArtSichern` wirft nach dem Anlegen der Gruppe nie, sondern sagt, was steht und was fehlt.
 *
 * **Nichts wird gelöscht:** keine Schritte des Ablaufs (ein Warte-Schritt mit wartenden Läufen ließe sich ohnehin nicht
 * entfernen, M3), keine Felder, keine Gruppe. Eine Vertrauensperson wird nur auf ausdrücklichen Wunsch entfernt.
 */
import { ctAlleSeiten, ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { ctPortMit } from '@ui/ct/ctPort';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { angemeldeteId } from '@ui/ct/ich';
import { mitgliedAendern, mitgliedAnlegen, mitgliedEntfernen } from '@ui/ct/mitglieder';
import { ctId } from '@shared/ct/ctId';
import { heuteImKalender } from '@shared/ct/zeit';
import { gruppenartRollen, gruppenartSuchen, type CtPort } from '@shared/ct/gruppenart';
import {
  NACHWEIS_ABLAUF_NAME,
  NACHWEIS_FELDER,
  gleicheNachweisEinstellungen,
  gleicherGruppenName,
  istNachweisArt,
  nachweisAblaufErkannt,
  nachweisAblaufStimmt,
  nachweisEinstellungenFehler,
  nachweisEinstellungenLesen,
  nachweisFeldAnlage,
  nachweisGruppenName,
  nachweisNameAus,
  nachweisNameFehler,
  nachweisNotiz,
  nachweisSchritte,
  nachweisSichtbarerText,
  type NachweisEinstellungen,
  type NachweisSchrittRoh,
} from '@shared/anmeldung/nachweise';
import { STUFE_NACHWEIS } from '@shared/anmeldung/felder';
import {
  antragBilderLesen,
  antragBlatt,
  antragHtml,
  antragPdfHtml,
  pdfBlatt,
  type AntragBilderGelesen,
  type NachweisAntrag,
} from '@shared/anmeldung/nachweisAntrag';
import { absenderAus } from './ablaeufe';
import { gemeindeLogo, personName, type MitgliedRoh } from './einrichten';
import { optionenVon, spalteSpeichern, type CtFeld } from './formularFelder';
import { nachweisGrundlageLesen, nachweisGrundlageSichern } from './nachweise';
import { nachweisStandAktualisieren, nachweisStandEinrichten } from './nachweisStandAblage';
import { einsichtNachziehen } from './nachweisEinsicht';
import { nachweisPersonenLesen, type NachweisArtMitPersonen } from './nachweisPersonen';

/** Sichtbarkeit der Nachweis-Gruppen: „eingeschränkt“ wie beim Gruppenwechsel – nicht öffentlich, nicht versteckt. */
export const NACHWEIS_SICHTBARKEIT = 'restricted';

const json = (body: unknown) => JSON.stringify(body);

interface GruppeRoh {
  id: number;
  name: string;
  information?: { note?: string | null; groupTypeId?: number; groupStatusId?: number };
  settings?: { visibility?: string };
}

interface MitgliedMitFeldern extends MitgliedRoh {
  fields?: { value?: unknown }[];
}

interface ZuordnungRoh {
  id: number;
  groupTypeRoleId: number;
  groupMemberStatus: string;
  routine?: { name?: string; steps?: NachweisSchrittRoh[] } | null;
}

interface RoutineRoh {
  id?: number;
  name?: string;
  isEnabled?: boolean;
  steps?: NachweisSchrittRoh[];
}

export interface Vertrauensperson {
  personId: number;
  name: string;
}

/** Eine Nachweis-Art, wie die Seite sie zeigt. */
export interface NachweisArt {
  /** Nummer der Gruppe in ChurchTools. */
  id: number;
  /** „Nachweis: Führungszeugnis“. */
  gruppenName: string;
  /** „Führungszeugnis“. */
  name: string;
  /** `null`: in der Beschreibung stehen keine (gültigen) Einstellungen – die Art ist nicht fertig eingerichtet. */
  einstellungen: NachweisEinstellungen | null;
  /** `null`: die Mitglieder dürfen nicht gelesen werden (403) – nicht „niemand“. */
  vertrauen: Vertrauensperson[] | null;
}

const gruppe = (id: number) => ctDaten<GruppeRoh>(`/groups/${id}`);

/** Die aktiven Nachweis-Gruppen, die man sehen darf. */
function gruppenDerArt(typId: number): Promise<GruppeRoh[]> {
  return ctAlleSeiten<GruppeRoh>(`/groups?group_type_ids[]=${typId}&group_status_ids[]=1`);
}

const istLeitung = (m: MitgliedRoh, leiterRolle: number | null) =>
  leiterRolle !== null && m.groupTypeRoleId === leiterRolle && m.groupMemberStatus === 'active';

/** Die Vertrauenspersonen (aktive Leiter) einer Gruppe; `null` bei 403 – alles andere wirft. */
async function vertrauenspersonen(
  id: number,
  leiterRolle: number | null,
): Promise<Vertrauensperson[] | null> {
  try {
    const m = await ctAlleSeiten<MitgliedRoh>(`/groups/${id}/members`);
    return m
      .filter((x) => istLeitung(x, leiterRolle) && typeof x.personId === 'number')
      .map((x) => ({ personId: x.personId!, name: personName(x) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) return null;
    throw e;
  }
}

const portLesen = (): CtPort => ctPortMit('Dir fehlt in ChurchTools das Recht dafür.');

// ── Lesen ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Die Arten (mit Gültigkeit und Vertrauenspersonen) und die Teilnehmer-Rolle der Gruppenart – eine Anfrage nach den Rollen. */
async function artenUndRollen(
  typId: number,
): Promise<{ arten: NachweisArt[]; teilnehmer: number | null }> {
  const { leiter, teilnehmer } = await gruppenartRollen(portLesen(), typId);
  const gruppen = await gruppenDerArt(typId);
  const arten: NachweisArt[] = [];
  for (const g of gruppen)
    arten.push({
      id: g.id,
      gruppenName: g.name,
      name: nachweisNameAus(g.name),
      einstellungen: nachweisEinstellungenLesen(g.information?.note),
      vertrauen: await vertrauenspersonen(g.id, leiter),
    });
  return { arten: arten.sort((a, b) => a.name.localeCompare(b.name, 'de')), teilnehmer };
}

/** Alle Nachweis-Arten, die man sehen darf – mit Gültigkeit und Vertrauenspersonen. Wirft bei jedem Lesefehler. */
export async function nachweisArtenLesen(typId: number): Promise<NachweisArt[]> {
  return (await artenUndRollen(typId)).arten;
}

/** Eine Nachweis-Art in der Kurzform – für die Karte „Nachweise“ einer Veranstaltung (N3b). */
export interface NachweisArtKurz {
  /** Nummer der Gruppe in ChurchTools – die Kennung in `nachweise` der Einstellungen. */
  id: number;
  name: string;
  /** `false`: in der Beschreibung stehen keine (gültigen) Einstellungen – die Art ist nicht fertig eingerichtet. */
  fertig: boolean;
}

/**
 * **Die Nachweis-Arten, die man sehen darf – nur Name und Nummer** (N3b). Anders als `nachweisArtenLesen` ohne die
 * Mitglieder je Gruppe (eine Anfrage je Art wäre hier nur Last). `[]`: es gibt keine Art (oder keine ist sichtbar – die
 * Gruppen sind „eingeschränkt“, `NACHWEIS_SICHTBARKEIT`); wirft bei jedem Lesefehler, damit „nicht lesbar“ nie wie „keine“
 * aussieht.
 */
export async function nachweisArtenKurz(): Promise<NachweisArtKurz[]> {
  const { id: typId } = await gruppenartSuchen(portLesen(), istNachweisArt);
  if (typId === null) return [];
  return (await gruppenDerArt(typId))
    .map((g) => ({
      id: g.id,
      name: nachweisNameAus(g.name),
      fertig: nachweisEinstellungenLesen(g.information?.note) !== null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/**
 * Die Arten samt ihren Personen (N2a). `sichtbar` entscheidet je Art, ob die Personen gelesen werden dürfen – die eine
 * Regel dafür: Admin („Berechtigungen verwalten“) alle, sonst nur Arten, deren Vertrauensperson man ist. Eine Art, die
 * nicht sichtbar ist (oder deren Mitglieder ChurchTools nicht herausgibt, 403), hat `personen: null`. Wirft bei jedem
 * anderen Lesefehler.
 */
async function artenMitPersonen(
  typId: number,
  sichtbar: (a: NachweisArt) => boolean,
): Promise<NachweisArtMitPersonen[]> {
  const { arten, teilnehmer } = await artenUndRollen(typId);
  return await Promise.all(
    arten.map(async (a) => ({
      ...a,
      personen: sichtbar(a) ? await nachweisPersonenLesen(a, teilnehmer) : null,
    })),
  );
}

export interface NachweiseSeite {
  /** `typId` null: die Gruppenart gibt es noch nicht. */
  grundlage: Awaited<ReturnType<typeof nachweisGrundlageLesen>>;
  arten: NachweisArtMitPersonen[];
}

/**
 * **Beim Öffnen durch einen Admin nachziehen** (N3a, E19/E22): fehlende Rechte der Leiter-Rolle (z. B. 10107 bei Arten von
 * vor N3a), die Ablage „Nachweis-Stand“ und das Leserecht für neue Träger von „Anmeldungen sehen“ – nur ergänzen. Ein Fehler
 * stört die Seite nicht (er kommt beim nächsten Öffnen wieder dran); `true`, wenn alles steht.
 */
async function adminNachziehen(): Promise<boolean> {
  try {
    const g = await nachweisGrundlageSichern();
    await nachweisStandEinrichten(g.leiterRolle);
    return true;
  } catch (e) {
    console.warn('Nachweise: Rechte oder Ablage „Nachweis-Stand“ nicht nachgezogen', e);
    return false;
  }
}

/** Alles für die Seite „Nachweise“. */
export async function nachweiseSeiteLaden(): Promise<NachweiseSeite> {
  let grundlage = await nachweisGrundlageLesen();
  const typId = grundlage.typId;
  if (typId === null) return { grundlage, arten: [] };
  if (grundlage.darfEinrichten && (await adminNachziehen()))
    grundlage = { ...grundlage, rechtFehlt: false };
  // Wer nicht alles einrichten darf, sieht nur die Arten, die er leitet – samt Personen (Entwurf N2, abgenommen 20.11.2026).
  const ich = grundlage.darfEinrichten ? null : (await ichLaden()).personId;
  const meine = (a: NachweisArt) =>
    grundlage.darfEinrichten || a.vertrauen?.some((p) => p.personId === ich) === true;
  let arten = (await artenMitPersonen(typId, meine)).filter(meine);
  // Nachziehen (N2b): „Erneut einsehen“ auf „Gültig bis“ legen, wo es abweicht – nur verschieben, Fehler stören nicht.
  // Höchstens einmal neu lesen, und nur, wenn etwas verschoben wurde.
  const heute = heuteImKalender();
  let geaendert = 0;
  for (const a of arten)
    if (a.personen) geaendert += await einsichtNachziehen(a, a.personen, heute);
  if (geaendert > 0) arten = (await artenMitPersonen(typId, meine)).filter(meine);
  // N3a: den Stand für die Leitungen schreiben (nur Änderungen) – auch nach „Einsicht festhalten“, denn danach lädt die Seite
  // neu. Ein Fehler stört die Seite nicht; nichts wird dabei gelöscht.
  try {
    await nachweisStandAktualisieren(arten, heute);
  } catch (e) {
    console.warn('Nachweise: Stand für die Leitungen nicht geschrieben', e);
  }
  return { grundlage, arten };
}

/** Was die Startseite von den Nachweisen braucht (N2a). */
export interface NachweisEinstiegDaten {
  darfEinrichten: boolean;
  /** Die Arten mit ihren Personen; leer, wenn sie sich nicht lesen ließen (dann zeigt die Karte keine Zahlen). */
  arten: NachweisArtMitPersonen[];
}

/**
 * **Der Einstieg auf der Startseite**: sichtbar für „Berechtigungen verwalten“ **oder** Leitung mindestens einer
 * Nachweis-Gruppe. `null`, wenn sich das nicht lesen lässt – dann fehlt die Karte, bis neu geladen wird, aber die Startseite
 * bleibt (vorübergehend ist nicht „du darfst nicht“). Die Personen sind eine Zugabe: Scheitert ihr Lesen, bleibt die Karte
 * wie bisher, nur ohne Zahlen – die Startseite scheitert daran nie.
 */
export async function nachweisEinstieg(
  meineLeitung: ReadonlySet<number>,
): Promise<NachweisEinstiegDaten | null> {
  try {
    const g = await nachweisGrundlageLesen();
    if (!g.darfEinrichten) {
      if (g.typId === null || meineLeitung.size === 0) return null;
      const leitet = (await gruppenDerArt(g.typId)).some((x) => meineLeitung.has(x.id));
      if (!leitet) return null;
    }
    let arten: NachweisArtMitPersonen[] = [];
    if (g.typId !== null) {
      try {
        arten = await artenMitPersonen(g.typId, (a) => g.darfEinrichten || meineLeitung.has(a.id));
      } catch {
        arten = [];
      }
    }
    return { darfEinrichten: g.darfEinrichten, arten };
  } catch {
    return null;
  }
}

// ── Anlegen und Ändern ──────────────────────────────────────────────────────────────────────────────────────────

/** Die Schritte, in dieser Reihenfolge – `erledigt` nennt, was nachgelesen dasteht. */
export const NACHWEIS_SCHRITTE = [
  'grundlage',
  'gruppe',
  'einstellungen',
  'felder',
  'leitung',
  'ablauf',
  'antrag',
  'stand',
] as const;
export type NachweisSchrittName = (typeof NACHWEIS_SCHRITTE)[number];

export const NACHWEIS_SCHRITT_TEXT: Record<NachweisSchrittName, string> = {
  grundlage: 'Gruppenart „Nachweis“ mit den Rechten der Leiter',
  gruppe: 'Gruppe „Nachweis: …“',
  einstellungen: 'Einstellungen der Nachweis-Art',
  felder: 'Angaben je Person (Eingesehen am, Ausgestellt am, Ergebnis)',
  leitung: 'Vertrauenspersonen',
  ablauf: 'Ablauf (Aufforderung, Einladung, Folgeaufgaben)',
  antrag: 'Antrag als Bescheinigung (Vorlage, Inhalt, Rolle Teilnehmer)',
  stand: 'Ablage „Nachweis-Stand“ für die Leitungen der Veranstaltungen (mit Leserechten)',
};

/** Was ein Bild im Antrag beim Speichern ist: neu gewählt, so lassen wie in ChurchTools, oder keins. */
export type BildWahl = { art: 'neu'; src: string } | { art: 'unveraendert' } | { art: 'keins' };

/**
 * Eigenes Logo, Unterschrift und (eigene PDF, N1d) Hintergrund – ohne Angabe bleiben sie, wie sie in ChurchTools stehen.
 * Ohne `hintergrund` gilt „unverändert“.
 */
export interface AntragBilder {
  logo: BildWahl;
  unterschrift: BildWahl;
  hintergrund?: BildWahl;
}

export interface NachweisEingabe {
  /** `null`: neue Art. Sonst die Gruppe – auch nach einem Teilerfolg („Nochmal“ legt dann nichts doppelt an). */
  gruppeId: number | null;
  /** Name der Art ohne „Nachweis: “. */
  name: string;
  einstellungen: NachweisEinstellungen;
  /** Diese Personen sollen Vertrauenspersonen sein (neue werden eingetragen, vorhandene bleiben). */
  vertrauen: number[];
  /** Nur Bearbeiten, nur auf ausdrücklichen Klick: Diese Leitungen verlassen die Gruppe. */
  entfernen?: number[];
  /** Bilder des Antrags (N1c); ohne Angabe bleiben sie, wie sie sind. Der Rest des Antrags steht in `einstellungen.antrag`. */
  antragBilder?: AntragBilder;
}

/** Was nachgelesen in ChurchTools steht. */
export interface NachweisBefund {
  gruppeId: number;
  gruppenName: string;
  felder: string[];
  vertrauen: Vertrauensperson[];
  ablauf: { an: boolean; schritte: number } | null;
  /** Der Antrag (nur mit „Mit Antrag“): Nummer der Vorlage und ob sie an der Rolle Teilnehmer hängt. */
  antrag: { vorlageId: number; haengt: boolean } | null;
}

export interface NachweisErgebnis {
  /** Nummer der Gruppe, sobald es sie gibt – damit „Nochmal“ sie wiederfindet. */
  gruppeId: number | null;
  /** Nummer der Vorlage des Antrags, sobald es sie gibt – damit „Nochmal“ keine zweite anlegt. */
  vorlageId: number | null;
  erledigt: NachweisSchrittName[];
  /** Woran es gescheitert ist (`null`: alles geschrieben und nachgelesen). */
  fehler: unknown;
  /** Das Gesamtbild nach dem Nachlesen – nur, wenn alles gelungen ist. */
  befund: NachweisBefund | null;
}

const felderLesen = async (id: number): Promise<CtFeld[]> =>
  (await ctDaten<{ type?: string; field?: CtFeld }[]>(`/groups/${id}/memberfields`)).flatMap((f) =>
    f.type === 'group' && f.field ? [f.field] : [],
  );

const feldDa = (felder: CtFeld[], name: string) =>
  felder.find((f) => gleicherGruppenName(f.name, name));

/** Schritt 2: Gruppe anlegen (oder die vom letzten Versuch wiederfinden), umbenennen, nachlesen. Gibt Nummer und alte Notiz. */
async function gruppeSichern(
  e: NachweisEingabe,
  typId: number,
  merke: (id: number) => void,
): Promise<{ id: number; note: string | null }> {
  const soll = nachweisGruppenName(e.name);
  let id = e.gruppeId;
  if (id === null) {
    // Eine Gruppe dieses Namens, die der letzte Versuch angelegt, aber nicht mehr eingerichtet hat, wird übernommen
    // (ohne gültigen Einstellungsblock ist sie keine fertige Art, `vorhandeneArtPruefen` hat die anderen schon abgewiesen).
    const gleiche = (await gruppenDerArt(typId)).filter((g) => gleicherGruppenName(g.name, soll));
    if (gleiche.length > 1)
      throw new ApiError(
        409,
        `In ChurchTools gibt es ${gleiche.length} Gruppen „${soll}“ (${gleiche.map((g) => g.id).join(', ')}). Welche gemeint ist, lässt sich nicht erraten – bitte die überzähligen dort entfernen.`,
      );
    if (gleiche.length === 1) id = gleiche[0].id;
    else {
      const neu = await ctAnfrage<{ data?: { id?: number } } | null>('/groups', {
        method: 'POST',
        body: json({
          name: soll,
          groupTypeId: typId,
          groupStatusId: 1,
          visibility: NACHWEIS_SICHTBARKEIT,
        }),
      });
      const neueId = ctId(neu?.data?.id);
      if (neueId === null)
        throw new NichtUebernommen(
          `die Gruppe „${soll}“ (Nummer nicht geliefert; „Nochmal“ findet sie wieder und legt keine zweite an)`,
        );
      id = neueId;
    }
  }
  let g = await gruppe(id);
  // Erst jetzt gemerkt: Die Gruppe ist nachgelesen da (ein „Erfolg“ ohne Gruppe wäre sonst eine Nummer ins Leere).
  merke(id);
  const aenderung: Record<string, unknown> = {};
  if (g.name !== soll) aenderung.name = soll;
  if (g.settings?.visibility !== NACHWEIS_SICHTBARKEIT)
    aenderung.visibility = NACHWEIS_SICHTBARKEIT;
  if (g.information?.groupStatusId !== 1) aenderung.groupStatusId = 1;
  if (Object.keys(aenderung).length) {
    await ctAnfrage(`/groups/${id}`, { method: 'PATCH', body: json(aenderung) });
    g = await gruppe(id);
  }
  if (g.name !== soll) throw new NichtUebernommen('den Namen der Gruppe');
  if (Number(g.information?.groupTypeId) !== typId)
    throw new ApiError(
      409,
      `Die Gruppe „${soll}“ gehört in ChurchTools nicht zur Gruppenart „Nachweis“.`,
    );
  if (g.settings?.visibility !== NACHWEIS_SICHTBARKEIT)
    throw new NichtUebernommen('die Sichtbarkeit „eingeschränkt“ der Gruppe');
  if (g.information?.groupStatusId !== 1)
    throw new NichtUebernommen('den Status „aktiv“ der Gruppe');
  return { id, note: g.information?.note ?? null };
}

/** Schritt 3: Einstellungen in die Beschreibung – der sichtbare Text bleibt, wie er ist. */
async function einstellungenSichern(
  id: number,
  alteNotiz: string | null,
  e: NachweisEinstellungen,
): Promise<void> {
  const bisher = nachweisEinstellungenLesen(alteNotiz);
  if (bisher && gleicheNachweisEinstellungen(bisher, e)) return;
  let notiz: string;
  try {
    notiz = nachweisNotiz(e, nachweisSichtbarerText(alteNotiz));
  } catch (x) {
    throw new ApiError(422, x instanceof Error ? x.message : 'Die Einstellungen sind zu lang.');
  }
  await ctAnfrage(`/groups/${id}`, { method: 'PATCH', body: json({ note: notiz }) });
  const nachher = (await gruppe(id)).information?.note;
  const gelesen = nachweisEinstellungenLesen(nachher);
  if (!gelesen || !gleicheNachweisEinstellungen(gelesen, e))
    throw new NichtUebernommen('die Einstellungen der Nachweis-Art');
}

/**
 * Schritt 4: die drei Gruppenfelder – fehlende anlegen (Stufe 4, nicht im Anmeldeformular), vorhandene mit zu niedriger
 * Stufe heraufsetzen. Danach muss jedes da sein; meldet ChurchTools die Stufe, muss sie stimmen.
 */
async function felderSichern(id: number): Promise<void> {
  const vorhanden = await felderLesen(id);
  for (const f of NACHWEIS_FELDER) {
    const anlage = nachweisFeldAnlage(f);
    const da = feldDa(vorhanden, f.name);
    if (!da) {
      await spalteSpeichern(id, undefined, anlage, f.name);
      continue;
    }
    const alt = optionenVon(da);
    const fehlt = (anlage.options ?? []).some((o) => !alt.some((a) => a.name === o.name));
    const zuNiedrig = typeof da.securityLevel === 'number' && da.securityLevel < STUFE_NACHWEIS;
    if (!fehlt && !zuNiedrig && da.useInRegistrationForm !== true) continue;
    // Mit den vorhandenen Antworten samt Nummern (ohne Nummer legt ChurchTools neue an; Weglassen löschte Wahlen).
    const options = anlage.options
      ? [...alt, ...anlage.options.filter((o) => !alt.some((a) => a.name === o.name))]
      : undefined;
    await spalteSpeichern(id, da, { ...anlage, ...(options ? { options } : {}) }, f.name);
  }
  const nachher = await felderLesen(id);
  for (const f of NACHWEIS_FELDER) {
    const da = feldDa(nachher, f.name);
    if (!da) throw new NichtUebernommen(`das Feld „${f.name}“`);
    if (typeof da.securityLevel === 'number' && da.securityLevel < STUFE_NACHWEIS)
      throw new NichtUebernommen(`die Sicherheitsstufe des Felds „${f.name}“`);
    if (da.useInRegistrationForm === true)
      throw new NichtUebernommen(`das Herausnehmen des Felds „${f.name}“ aus dem Anmeldeformular`);
  }
}

/**
 * Schritt 5: Vertrauenspersonen als Leiter. Neue per PUT mit `only_add`, Vorhandene per PATCH (`mitglieder.ts`) – nur, wenn
 * sie es noch nicht sind. Entfernt wird nur, wer ausdrücklich genannt ist und **keine eigenen Angaben** hat (eine Person
 * mit Eintrag „Eingesehen am“ zu löschen nähme ihre Angaben mit). Danach muss die Liste so stehen.
 */
async function leitungSichern(
  id: number,
  leiterRolle: number,
  e: NachweisEingabe,
): Promise<Vertrauensperson[]> {
  const entfernen = new Set(e.entfernen ?? []);
  const wollen = e.vertrauen.filter((p) => !entfernen.has(p));
  const vorher = await ctAlleSeiten<MitgliedMitFeldern>(`/groups/${id}/members`);
  const bleiben = new Set([
    ...wollen,
    ...vorher
      .filter((m) => istLeitung(m, leiterRolle) && !entfernen.has(m.personId!))
      .map((m) => m.personId!),
  ]);
  if (bleiben.size === 0)
    throw new ApiError(422, 'Bitte mindestens eine Person als Vertrauensperson eintragen.');
  for (const personId of entfernen) {
    const m = vorher.find((x) => x.personId === personId && istLeitung(x, leiterRolle));
    if (m?.fields?.some((f) => f.value !== null && f.value !== undefined && f.value !== ''))
      throw new ApiError(
        409,
        `${personName(m)} hat selbst Angaben zu einem Nachweis in dieser Gruppe – Entfernen würde sie löschen. Bitte in ChurchTools die Rolle ändern.`,
      );
  }
  for (const personId of wollen) {
    const m = vorher.find((x) => x.personId === personId);
    if (m && istLeitung(m, leiterRolle)) continue;
    await (m ? mitgliedAendern : mitgliedAnlegen)(id, personId, {
      groupTypeRoleId: leiterRolle,
      groupMemberStatus: 'active',
    });
  }
  for (const personId of entfernen)
    if (vorher.some((x) => x.personId === personId && istLeitung(x, leiterRolle)))
      await mitgliedEntfernen(id, personId);
  const nachher = await vertrauenspersonen(id, leiterRolle);
  if (nachher === null) throw new NichtUebernommen('die Vertrauenspersonen (nicht lesbar)');
  const ids = new Set(nachher.map((p) => p.personId));
  if (!wollen.every((p) => ids.has(p)) || [...entfernen].some((p) => ids.has(p)))
    throw new NichtUebernommen('die Vertrauenspersonen');
  return nachher;
}

/**
 * Schritt 6: der Ablauf für die Rolle Teilnehmer. Neu: `POST /routines` (hängt sich selbst an die Gruppe), dann `PATCH` mit
 * der ganzen Schrittliste. Vorhanden: dieselben Schritte mit ihren Nummern – nie neue Schritte neben alten, nie welche
 * weglassen. Hat jemand den Ablauf in ChurchTools umgebaut (oder ist es ein fremder), bleibt er unberührt.
 */
async function ablaufSichern(
  id: number,
  teilnehmerRolle: number,
  art: { name: string } & NachweisEinstellungen,
  leiter: ReadonlySet<number>,
  ich: number | null,
): Promise<{ an: boolean; schritte: number }> {
  const zuordnungen = await ctDaten<ZuordnungRoh[]>(`/groups/${id}/members/routines`);
  const meine = zuordnungen.find(
    (z) => z.groupTypeRoleId === teilnehmerRolle && z.groupMemberStatus === 'active',
  );
  let routineId = meine?.id;
  let vorher: NachweisSchrittRoh[] = [];
  if (meine) {
    if (meine.routine?.name !== NACHWEIS_ABLAUF_NAME)
      throw new ApiError(
        409,
        `In ChurchTools gibt es für diese Gruppe schon einen eigenen Ablauf („${meine.routine?.name ?? 'ohne Namen'}“). Die Erweiterung lässt ihn stehen – bitte dort entfernen oder pflegen.`,
      );
    vorher = (await ctDaten<RoutineRoh>(`/routines/${meine.id}`)).steps ?? [];
    // Leer: der letzte Versuch hat die Routine angelegt, aber keine Schritte mehr geschrieben.
    if (vorher.length > 0 && !nachweisAblaufErkannt(vorher))
      throw new ApiError(
        409,
        'Der Ablauf dieser Gruppe wurde in ChurchTools umgebaut. Die Erweiterung lässt ihn stehen, damit nichts verloren geht – bitte dort ansehen.',
      );
  } else {
    const neu = await ctAnfrage<{ data?: { id?: number } } | null>('/routines', {
      method: 'POST',
      body: json({
        domainType: 'group_membership',
        name: NACHWEIS_ABLAUF_NAME,
        isEnabled: false,
        domainContext: {
          groupId: id,
          groupTypeRoleId: teilnehmerRolle,
          groupMemberStatus: 'active',
        },
      }),
    });
    routineId = ctId(neu?.data?.id) ?? undefined;
    if (routineId === undefined) throw new NichtUebernommen('den Ablauf');
  }
  // Absender: bleibt, wer es war, solange er Vertrauensperson ist – sonst wer gerade speichert, sonst die erste.
  const alt = ctId(vorher[0]?.actionData?.senderId);
  const absender = alt !== null && leiter.has(alt) ? alt : absenderAus(leiter, ich);
  await ctAnfrage(`/routines/${routineId}`, {
    method: 'PATCH',
    body: json({ isEnabled: true, steps: nachweisSchritte(art, absender, vorher) }),
  });
  const nachher = await ctDaten<RoutineRoh>(`/routines/${routineId}`);
  if (nachher.isEnabled !== true || !nachweisAblaufStimmt(nachher.steps ?? [], art, absender))
    throw new NichtUebernommen('den Ablauf');
  return { an: true, schritte: nachher.steps?.length ?? 0 };
}

// ── Der Antrag als Bescheinigung (N1c) ───────────────────────────────────────────────────────────────────────────

const VORLAGE_TYP = 'groupmember-document';
const RECHT_VORLAGEN = 'Gemeinde-HTML-Vorlagen verwalten';

/** So sagt es die Meldung, wenn dieses Recht fehlt – sie nennt auch den Ausweg. */
export const VORLAGEN_RECHT_MELDUNG = `Dir fehlt in ChurchTools das Recht „${RECHT_VORLAGEN}“. Ohne dieses Recht lässt sich der Antrag nicht als Bescheinigung anlegen oder ändern. Bitte eine Person mit diesem Recht, die Nachweis-Art zu speichern – oder „Mit Antrag“ ausschalten. Es wurde nichts geändert.`;

interface VorlageRoh {
  id: number;
  name?: string;
  domainType?: string;
  htmlFileId?: number | null;
}

interface GruppenRolleRoh {
  /** Nummer der Rolle IN DER GRUPPE – nicht die der Gruppenart (`groupTypeRoleId`). */
  id: number;
  groupTypeRoleId: number;
  htmlTemplateIds?: unknown;
}

/** Der Name der Vorlage – eindeutig je Art. */
export const antragVorlagenName = (artName: string): string =>
  `Antrag: ${nachweisGruppenName(artName)}`;

/**
 * Hat die angemeldete Person das Recht „Gemeinde-HTML-Vorlagen verwalten“ (gemessen 19.11.2026, M6: churchcore 16,
 * Schlüssel `administer church html templates`)? Fehlt der Schlüssel in der Antwort, gilt das Recht als nicht vorhanden (wie
 * bei allen Rechten). `null` nur, wenn die Antwort gar keinen Block `churchcore` hat – dann sagt ChurchTools es selbst (403).
 */
export function htmlVorlagenRecht(global: unknown): boolean | null {
  const modul = (global as { churchcore?: unknown } | null | undefined)?.churchcore;
  if (!modul || typeof modul !== 'object') return null;
  return !!(modul as Record<string, unknown>)['administer church html templates'];
}

const idsAus = (v: unknown): number[] =>
  Array.isArray(v) ? v.map(ctId).filter((n): n is number => n !== null) : [];

async function vorlageLesen(id: number): Promise<VorlageRoh | null> {
  try {
    return await ctDaten<VorlageRoh>(`/htmltemplates/${id}`);
  } catch (x) {
    if (x instanceof ApiError && x.status === 404) return null;
    throw x;
  }
}

/** Das HTML einer Vorlage. Wirft, wenn ChurchTools es nicht als Text liefert (leer, JSON ohne `data`, Fehler). */
async function antragHtmlLesen(id: number): Promise<string> {
  const r = await ctAnfrage<unknown>(`/htmltemplates/${id}/html`);
  const text = typeof r === 'string' ? r : (r as { data?: unknown } | null | undefined)?.data;
  if (typeof text !== 'string' || text.trim() === '')
    throw new ApiError(502, 'ChurchTools hat den Inhalt des Antrags nicht geliefert.');
  return text;
}

/**
 * Die Bilder des gespeicherten Antrags fürs Fenster. `null` = nicht lesbar (Fehler, leer, kein Blatt von uns) – nie „keine
 * Bilder“: Das Fenster sagt dann, dass sie unverändert bleiben, und `antragSichern` schreibt nichts, was sie verlieren könnte.
 */
export async function antragLaden(vorlageId: number): Promise<AntragBilderGelesen | null> {
  try {
    return antragBilderLesen(await antragHtmlLesen(vorlageId));
  } catch {
    return null;
  }
}

/** Die Vorlage dieses Namens, falls der letzte Versuch sie angelegt hat, ohne dass ihre Nummer gespeichert wurde. */
async function vorlageFinden(name: string): Promise<VorlageRoh | null> {
  let liste: VorlageRoh[];
  try {
    // `domain_type` ist Pflicht – ohne antwortet ChurchTools mit 400 (gemessen 19.11.2026, echter Lauf N1c).
    liste = await ctAlleSeiten<VorlageRoh>(`/htmltemplates?domain_type=${VORLAGE_TYP}`);
  } catch (x) {
    // Gibt es die Liste nicht, bleibt es beim Merken der Nummer; jeder andere Fehler bricht ab (nichts blind anlegen).
    if (x instanceof ApiError && (x.status === 404 || x.status === 405)) return null;
    throw x;
  }
  const gleiche = liste.filter(
    (v) =>
      (v.domainType === undefined || v.domainType === VORLAGE_TYP) &&
      typeof v.name === 'string' &&
      gleicherGruppenName(v.name, name),
  );
  if (gleiche.length > 1)
    throw new ApiError(
      409,
      `In ChurchTools gibt es ${gleiche.length} Vorlagen „${name}“ (${gleiche.map((v) => v.id).join(', ')}). Welche gemeint ist, lässt sich nicht erraten – bitte die überzähligen dort entfernen.`,
    );
  return gleiche[0] ? await vorlageLesen(gleiche[0].id) : null;
}

async function vorlageAnlegen(name: string): Promise<VorlageRoh> {
  const neu = await ctAnfrage<{ data?: { id?: number } } | null>('/htmltemplates', {
    method: 'POST',
    body: json({ domainType: VORLAGE_TYP, name, isGlobal: true }),
    verweigert: VORLAGEN_RECHT_MELDUNG,
  });
  const id = ctId(neu?.data?.id);
  if (id === null)
    throw new NichtUebernommen(
      `die Vorlage „${name}“ (Nummer nicht geliefert; „Nochmal“ findet sie wieder und legt keine zweite an)`,
    );
  const da = await vorlageLesen(id);
  if (!da || !gleicherGruppenName(da.name ?? '', name))
    throw new NichtUebernommen(`die Vorlage „${name}“`);
  return da;
}

/**
 * Logo und Unterschrift fürs HTML. Neu gewählt: wie gewählt. **Unverändert: aus dem HTML, das jetzt in ChurchTools steht** –
 * ist es nicht lesbar, wird abgebrochen (nichts geschrieben): Lieber nicht speichern als ein Bild verlieren. Gibt es noch
 * keinen Inhalt (`bisher === null` und keine Lesestörung), gab es auch keine Bilder.
 */
function bilderAufloesen(
  e: { logo: NachweisAntrag['logo']; bilder: AntragBilder },
  gemeindeUrl: string | null,
  bisher: { html: string | null; gelesen: boolean; fehler: unknown },
): AntragBilderGelesen {
  const vorhanden = (): AntragBilderGelesen => {
    if (!bisher.gelesen) return { logo: null, unterschrift: null, hintergrund: null };
    const b = bisher.html === null ? null : antragBilderLesen(bisher.html);
    if (b === null)
      throw bisher.fehler instanceof ApiError && bisher.fehler.status !== 502
        ? bisher.fehler
        : new ApiError(
            502,
            'Der bisherige Antrag lässt sich in ChurchTools gerade nicht lesen. Damit Logo und Unterschrift nicht verloren gehen, wurde nichts geändert – bitte gleich noch einmal versuchen.',
          );
    return b;
  };
  const wahl = (w: BildWahl, art: keyof AntragBilderGelesen): string | null =>
    w.art === 'neu' ? w.src : w.art === 'keins' ? null : vorhanden()[art];
  return {
    logo:
      e.logo === 'ohne' ? null : e.logo === 'gemeinde' ? gemeindeUrl : wahl(e.bilder.logo, 'logo'),
    unterschrift: wahl(e.bilder.unterschrift, 'unterschrift'),
    hintergrund: wahl(e.bilder.hintergrund ?? { art: 'unveraendert' }, 'hintergrund'),
  };
}

/**
 * Die Vorlage an die **Gruppenrolle** Teilnehmer hängen (`haengen`) oder abhängen – nie die Rolle der Gruppenart (deren
 * Nummer ist eine andere, `GET /groups/{g}/roles` liefert beide). **Fremde Vorlagen bleiben**: es wird nur die eigene
 * ergänzt oder entfernt. Nachgelesen. Beim Abhängen: gibt es die Rolle nicht, hängt auch nichts daran.
 */
async function vorlageAnRolle(
  gruppeId: number,
  teilnehmerRolle: number,
  vorlageId: number,
  haengen: boolean,
): Promise<void> {
  const lesen = async () => {
    const rollen = await ctDaten<GruppenRolleRoh[]>(`/groups/${gruppeId}/roles`);
    return rollen.find((r) => r.groupTypeRoleId === teilnehmerRolle) ?? null;
  };
  const rolle = await lesen();
  if (!rolle) {
    if (!haengen) return;
    throw new ApiError(
      422,
      'In ChurchTools hat die Gruppe keine Rolle „Teilnehmer“, an die sich der Antrag hängen ließe. Bitte die Rollen der Gruppe dort ansehen.',
    );
  }
  const vorher = idsAus(rolle.htmlTemplateIds);
  const soll = haengen
    ? vorher.includes(vorlageId)
      ? vorher
      : [...vorher, vorlageId]
    : vorher.filter((x) => x !== vorlageId);
  if (soll.length !== vorher.length) {
    await ctAnfrage(`/groups/${gruppeId}/roles/${rolle.id}`, {
      method: 'PATCH',
      body: json({ htmlTemplateIds: soll }),
    });
  }
  const nachher = idsAus((await lesen())?.htmlTemplateIds);
  const fremdeDa = vorher.filter((x) => x !== vorlageId).every((x) => nachher.includes(x));
  if (nachher.includes(vorlageId) !== haengen || !fremdeDa)
    throw new NichtUebernommen(
      haengen
        ? 'das Anhängen des Antrags an die Rolle „Teilnehmer“'
        : 'das Abhängen des Antrags von der Rolle „Teilnehmer“',
    );
}

/**
 * Der Inhalt: HTML hochladen (`POST /files/html_template/{id}`), `htmlFileId` setzen, nachlesen. Ist das HTML schon
 * dasselbe, wird nichts hochgeladen. Nachgelesen wird mit dem, was ChurchTools zurückgibt: Nummer der Datei, Blatt-Marker
 * und beide Bilder – ein Erfolgssignal allein beweist nichts.
 */
async function antragInhaltSetzen(
  vorlage: VorlageRoh,
  html: string,
  bisher: string | null,
  bilder: AntragBilderGelesen,
): Promise<void> {
  if (bisher === html && vorlage.htmlFileId != null) return;
  const form = new FormData();
  form.append('files[]', new Blob([html], { type: 'text/html' }), 'antrag.html');
  const r = await ctAnfrage<{ data?: unknown } | null>(`/files/html_template/${vorlage.id}`, {
    method: 'POST',
    body: form,
    verweigert: VORLAGEN_RECHT_MELDUNG,
  });
  const d = r?.data;
  const dateiId = ctId(
    (Array.isArray(d) ? d[0] : d) && ((Array.isArray(d) ? d[0] : d) as { id?: unknown }).id,
  );
  if (dateiId === null) throw new NichtUebernommen('die Datei mit dem Antrag');
  await ctAnfrage(`/htmltemplates/${vorlage.id}`, {
    method: 'PATCH',
    body: json({ htmlFileId: dateiId }),
    verweigert: VORLAGEN_RECHT_MELDUNG,
  });
  if ((await vorlageLesen(vorlage.id))?.htmlFileId !== dateiId)
    throw new NichtUebernommen('den Inhalt des Antrags');
  const zurueck = antragBilderLesen(await antragHtmlLesen(vorlage.id));
  if (zurueck === null)
    throw new NichtUebernommen(
      'den Inhalt des Antrags (ChurchTools liefert ihn nicht wie hochgeladen zurück)',
    );
  if (
    zurueck.logo !== bilder.logo ||
    zurueck.unterschrift !== bilder.unterschrift ||
    zurueck.hintergrund !== bilder.hintergrund
  )
    throw new NichtUebernommen('die Bilder im Antrag (Logo, Unterschrift, Hintergrund)');
}

/**
 * **Schritt 7: der Antrag.** Mit Antrag: Vorlage (aus der Nummer im Block, sonst über den Namen, sonst neu) → Nummer sofort im
 * Block festhalten (`vorlageId`) → HTML hochladen und nachlesen → an die Gruppenrolle Teilnehmer hängen und nachlesen.
 * Ohne Antrag: eine vorhandene Vorlage wird von der Rolle abgehängt – **nie gelöscht**.
 */
async function antragSichern(a: {
  gruppeId: number;
  teilnehmerRolle: number;
  name: string;
  einstellungen: NachweisEinstellungen;
  bilder: AntragBilder;
  merke: (vorlageId: number) => void;
}): Promise<void> {
  const antrag = a.einstellungen.antrag;
  if (!antrag) return;
  if (!antrag.an) {
    if (antrag.vorlageId !== null)
      await vorlageAnRolle(a.gruppeId, a.teilnehmerRolle, antrag.vorlageId, false);
    return;
  }
  const vorlagenName = antragVorlagenName(a.name);
  let vorlage = antrag.vorlageId !== null ? await vorlageLesen(antrag.vorlageId) : null;
  vorlage ??= (await vorlageFinden(vorlagenName)) ?? (await vorlageAnlegen(vorlagenName));
  a.merke(vorlage.id);

  // Die Nummer sofort festhalten: scheitert etwas danach, findet „Nochmal“ die Vorlage wieder.
  if (vorlage.id !== antrag.vorlageId) {
    const note = (await gruppe(a.gruppeId)).information?.note ?? null;
    await einstellungenSichern(a.gruppeId, note, {
      ...a.einstellungen,
      antrag: { ...antrag, vorlageId: vorlage.id },
    });
  }

  // Was in ChurchTools schon als Inhalt steht (für „unverändert“ und um Gleiches nicht noch einmal hochzuladen).
  const bisher: { html: string | null; gelesen: boolean; fehler: unknown } = {
    html: null,
    gelesen: vorlage.htmlFileId != null,
    fehler: null,
  };
  if (bisher.gelesen)
    try {
      bisher.html = await antragHtmlLesen(vorlage.id);
    } catch (x) {
      bisher.fehler = x;
    }
  // Die eigene PDF (N1d) braucht kein Logo; der Baukasten keinen Hintergrund. Bilder der anderen Art werden nicht gelesen.
  const pdf = antrag.art === 'pdf';
  const gemeindeUrl = !pdf && antrag.logo === 'gemeinde' ? await gemeindeLogo() : null;
  const bilder = bilderAufloesen(
    {
      logo: pdf ? 'ohne' : antrag.logo,
      bilder: pdf ? a.bilder : { ...a.bilder, hintergrund: { art: 'keins' } },
    },
    gemeindeUrl,
    bisher,
  );
  if (pdf && (bilder.hintergrund === null || !antrag.pdf))
    throw new ApiError(
      422,
      'Für die eigene PDF fehlt das Bild der Seite. Bitte die PDF noch einmal wählen. Es wurde nichts am Antrag geändert.',
    );
  const html =
    pdf && antrag.pdf
      ? antragPdfHtml(pdfBlatt(antrag.pdf, bilder))
      : antragHtml(antragBlatt(antrag, bilder));
  await antragInhaltSetzen(vorlage, html, bisher.html, bilder);
  await vorlageAnRolle(a.gruppeId, a.teilnehmerRolle, vorlage.id, true);
}

/** Vor dem ersten Schreiben: Darf die Person Vorlagen anlegen? Nur ein ausdrückliches „nein“ weist ab (`htmlVorlagenRecht`). */
async function vorlagenRechtPruefen(): Promise<void> {
  const global = await ctDaten<unknown>('/permissions/global');
  if (htmlVorlagenRecht(global) === false) throw new ApiError(422, VORLAGEN_RECHT_MELDUNG);
}

/** Das Gesamtbild nachlesen: Gruppe, Felder, Vertrauenspersonen, Ablauf, Antrag. */
export async function nachweisArtBefund(
  id: number,
  leiterRolle: number,
  teilnehmerRolle: number,
): Promise<NachweisBefund> {
  const [g, felder, vertrauen, zuordnungen] = await Promise.all([
    gruppe(id),
    felderLesen(id),
    vertrauenspersonen(id, leiterRolle),
    ctDaten<ZuordnungRoh[]>(`/groups/${id}/members/routines`),
  ]);
  const meine = zuordnungen.find(
    (z) =>
      z.groupTypeRoleId === teilnehmerRolle &&
      z.groupMemberStatus === 'active' &&
      z.routine?.name === NACHWEIS_ABLAUF_NAME,
  );
  const routine = meine ? await ctDaten<RoutineRoh>(`/routines/${meine.id}`) : null;
  const antrag = nachweisEinstellungenLesen(g.information?.note)?.antrag;
  let antragBefund: NachweisBefund['antrag'] = null;
  if (antrag?.an && antrag.vorlageId !== null) {
    const rollen = await ctDaten<GruppenRolleRoh[]>(`/groups/${id}/roles`);
    const rolle = rollen.find((r) => r.groupTypeRoleId === teilnehmerRolle);
    antragBefund = {
      vorlageId: antrag.vorlageId,
      haengt: !!rolle && idsAus(rolle.htmlTemplateIds).includes(antrag.vorlageId),
    };
  }
  return {
    gruppeId: id,
    gruppenName: g.name,
    felder: NACHWEIS_FELDER.filter((f) => feldDa(felder, f.name)).map((f) => f.name),
    vertrauen: vertrauen ?? [],
    ablauf: routine
      ? { an: routine.isEnabled === true, schritte: routine.steps?.length ?? 0 }
      : null,
    antrag: antragBefund,
  };
}

/** Gibt es schon eine fertige Nachweis-Art dieses Namens? Dann wird nichts angelegt (die Art bearbeitet man). */
async function vorhandeneArtPruefen(name: string): Promise<void> {
  const { id: typId } = await gruppenartSuchen(portLesen(), istNachweisArt);
  if (typId === null) return;
  const soll = nachweisGruppenName(name);
  const da = (await gruppenDerArt(typId)).find(
    (g) => gleicherGruppenName(g.name, soll) && nachweisEinstellungenLesen(g.information?.note),
  );
  if (da)
    throw new ApiError(
      409,
      `Die Nachweis-Art „${name.trim()}“ gibt es schon. Bitte sie in der Liste mit „Bearbeiten“ ändern.`,
    );
}

/**
 * **Eine Nachweis-Art anlegen oder ändern.** Eingabefehler (Name, Einstellungen, keine Vertrauensperson, „gibt es schon“)
 * werfen, bevor etwas geschrieben wird. Danach wirft nichts mehr: Scheitert ein Schritt, steht im Ergebnis, was schon
 * nachgelesen dasteht (`erledigt`), woran es lag (`fehler`) und die Nummer der Gruppe für „Nochmal“.
 *
 * `ich`: wer speichert (Absender der Aufforderung, wenn er Vertrauensperson ist).
 */
export async function nachweisArtSichern(
  e: NachweisEingabe,
  ich: number | null,
): Promise<NachweisErgebnis> {
  const fehler = nachweisNameFehler(e.name) ?? nachweisEinstellungenFehler(e.einstellungen);
  if (fehler) throw new ApiError(422, fehler);
  if (
    e.vertrauen.filter((p) => !(e.entfernen ?? []).includes(p)).length === 0 &&
    e.gruppeId === null
  )
    throw new ApiError(422, 'Bitte mindestens eine Person als Vertrauensperson eintragen.');
  if (e.gruppeId === null) await vorhandeneArtPruefen(e.name);
  // Eigene PDF ohne Seitenbild: vor dem ersten Schreiben abweisen, nicht erst nach der halben Einrichtung.
  if (
    e.einstellungen.antrag?.an &&
    e.einstellungen.antrag.art === 'pdf' &&
    e.antragBilder?.hintergrund?.art === 'keins'
  )
    throw new ApiError(422, 'Bitte eine PDF mit dem Antragsformular wählen.');
  // Vor dem ersten Schreiben: ein fehlendes Recht für die Vorlage meldet sich hier, nicht erst nach der halben Einrichtung.
  if (e.einstellungen.antrag?.an) await vorlagenRechtPruefen();

  const erg: NachweisErgebnis = {
    gruppeId: e.gruppeId,
    vorlageId: e.einstellungen.antrag?.vorlageId ?? null,
    erledigt: [],
    fehler: null,
    befund: null,
  };
  try {
    const grundlage = await nachweisGrundlageSichern();
    erg.erledigt.push('grundlage');
    const { id, note } = await gruppeSichern(e, grundlage.typId, (nr) => (erg.gruppeId = nr));
    erg.erledigt.push('gruppe');
    // Die Nummer der Vorlage zählt, wie sie in ChurchTools steht (ein früherer Versuch kann sie festgehalten haben).
    const bisher = nachweisEinstellungenLesen(note)?.antrag;
    const antragEin = e.einstellungen.antrag ?? bisher;
    const einstellungen: NachweisEinstellungen = {
      ...e.einstellungen,
      ...(antragEin
        ? { antrag: { ...antragEin, vorlageId: bisher?.vorlageId ?? antragEin.vorlageId } }
        : {}),
    };
    erg.vorlageId = einstellungen.antrag?.vorlageId ?? null;
    await einstellungenSichern(id, note, einstellungen);
    erg.erledigt.push('einstellungen');
    await felderSichern(id);
    erg.erledigt.push('felder');
    const vertrauen = await leitungSichern(id, grundlage.leiterRolle, e);
    erg.erledigt.push('leitung');
    await ablaufSichern(
      id,
      grundlage.teilnehmerRolle,
      { name: e.name, ...e.einstellungen },
      new Set(vertrauen.map((p) => p.personId)),
      ich,
    );
    erg.erledigt.push('ablauf');
    await antragSichern({
      gruppeId: id,
      teilnehmerRolle: grundlage.teilnehmerRolle,
      name: e.name,
      einstellungen,
      bilder: e.antragBilder ?? {
        logo: { art: 'unveraendert' },
        unterschrift: { art: 'unveraendert' },
      },
      merke: (nr) => (erg.vorlageId = nr),
    });
    erg.erledigt.push('antrag');
    // N3a: die Ablage für die Leitungen – ein eigener Schritt, damit ein Fehler dort klar benannt ist (die Art steht dann schon).
    await nachweisStandEinrichten(grundlage.leiterRolle);
    erg.erledigt.push('stand');
    erg.befund = await nachweisArtBefund(id, grundlage.leiterRolle, grundlage.teilnehmerRolle);
  } catch (x) {
    erg.fehler = x;
  }
  return erg;
}

/** Das Logo der Gemeinde für die Vorschau im Fenster (`null`: keins eingestellt) – eine Stelle, die das Fenster ersetzen lässt. */
export const gemeindeLogoLaden = (): Promise<string | null> => gemeindeLogo();

/** Wer gerade speichert – vorbelegt als erste Vertrauensperson und Absender der Aufforderung. */
export async function ichLaden(): Promise<Vertrauensperson> {
  const w = await ctDaten<{ firstName?: unknown; lastName?: unknown } | null>('/whoami');
  const name = [w?.firstName, w?.lastName]
    .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    .join(' ');
  return { personId: angemeldeteId(w), name: name || 'Ich' };
}
