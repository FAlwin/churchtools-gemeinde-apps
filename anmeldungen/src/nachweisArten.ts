/**
 * **Nachweis-Arten in ChurchTools** (Etappe F, N1b) – lesen, anlegen, ändern. Eine Nachweis-Art ist eine Gruppe „Nachweis: …“
 * der Gruppenart „Nachweis“ (Grundlage: `nachweise.ts`, N1a) mit
 *
 * 1. ihren **Einstellungen** (Gültigkeit, Aufforderung) unsichtbar in der Beschreibung (`nachweisNotiz`),
 * 2. drei **Gruppenfeldern** auf Stufe 4 (`NACHWEIS_FELDER`),
 * 3. den **Vertrauenspersonen** als Leiter,
 * 4. einem **Ablauf** für die Rolle Teilnehmer (`nachweisSchritte`).
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
import { absenderAus } from './ablaeufe';
import { personName, type MitgliedRoh } from './einrichten';
import { optionenVon, spalteSpeichern, type CtFeld } from './formularFelder';
import { nachweisGrundlageLesen, nachweisGrundlageSichern } from './nachweise';

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

/** Alle Nachweis-Arten, die man sehen darf – mit Gültigkeit und Vertrauenspersonen. Wirft bei jedem Lesefehler. */
export async function nachweisArtenLesen(typId: number): Promise<NachweisArt[]> {
  const { leiter } = await gruppenartRollen(portLesen(), typId);
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
  return arten.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export interface NachweiseSeite {
  /** `typId` null: die Gruppenart gibt es noch nicht. */
  grundlage: Awaited<ReturnType<typeof nachweisGrundlageLesen>>;
  arten: NachweisArt[];
}

/** Alles für die Seite „Nachweise“. */
export async function nachweiseSeiteLaden(): Promise<NachweiseSeite> {
  const grundlage = await nachweisGrundlageLesen();
  return {
    grundlage,
    arten: grundlage.typId === null ? [] : await nachweisArtenLesen(grundlage.typId),
  };
}

/**
 * **Der Einstieg auf der Startseite**: sichtbar für „Berechtigungen verwalten“ **oder** Leitung mindestens einer
 * Nachweis-Gruppe. `null`, wenn sich das nicht lesen lässt – dann fehlt die Karte, bis neu geladen wird, aber die Startseite
 * bleibt (vorübergehend ist nicht „du darfst nicht“).
 */
export async function nachweisEinstieg(
  meineLeitung: ReadonlySet<number>,
): Promise<{ darfEinrichten: boolean } | null> {
  try {
    const g = await nachweisGrundlageLesen();
    if (g.darfEinrichten) return { darfEinrichten: true };
    if (g.typId === null || meineLeitung.size === 0) return null;
    const leitet = (await gruppenDerArt(g.typId)).some((x) => meineLeitung.has(x.id));
    return leitet ? { darfEinrichten: false } : null;
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
] as const;
export type NachweisSchrittName = (typeof NACHWEIS_SCHRITTE)[number];

export const NACHWEIS_SCHRITT_TEXT: Record<NachweisSchrittName, string> = {
  grundlage: 'Gruppenart „Nachweis“ mit den Rechten der Leiter',
  gruppe: 'Gruppe „Nachweis: …“',
  einstellungen: 'Einstellungen der Nachweis-Art',
  felder: 'Angaben je Person (Eingesehen am, Ausgestellt am, Ergebnis)',
  leitung: 'Vertrauenspersonen',
  ablauf: 'Ablauf (Aufforderung, Einladung, Folgeaufgaben)',
};

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
}

/** Was nachgelesen in ChurchTools steht. */
export interface NachweisBefund {
  gruppeId: number;
  gruppenName: string;
  felder: string[];
  vertrauen: Vertrauensperson[];
  ablauf: { an: boolean; schritte: number } | null;
}

export interface NachweisErgebnis {
  /** Nummer der Gruppe, sobald es sie gibt – damit „Nochmal“ sie wiederfindet. */
  gruppeId: number | null;
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

/** Das Gesamtbild nachlesen: Gruppe, Felder, Vertrauenspersonen, Ablauf. */
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
  return {
    gruppeId: id,
    gruppenName: g.name,
    felder: NACHWEIS_FELDER.filter((f) => feldDa(felder, f.name)).map((f) => f.name),
    vertrauen: vertrauen ?? [],
    ablauf: routine
      ? { an: routine.isEnabled === true, schritte: routine.steps?.length ?? 0 }
      : null,
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

  const erg: NachweisErgebnis = { gruppeId: e.gruppeId, erledigt: [], fehler: null, befund: null };
  try {
    const grundlage = await nachweisGrundlageSichern();
    erg.erledigt.push('grundlage');
    const { id, note } = await gruppeSichern(e, grundlage.typId, (nr) => (erg.gruppeId = nr));
    erg.erledigt.push('gruppe');
    await einstellungenSichern(id, note, e.einstellungen);
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
    erg.befund = await nachweisArtBefund(id, grundlage.leiterRolle, grundlage.teilnehmerRolle);
  } catch (x) {
    erg.fehler = x;
  }
  return erg;
}

/** Wer gerade speichert – vorbelegt als erste Vertrauensperson und Absender der Aufforderung. */
export async function ichLaden(): Promise<Vertrauensperson> {
  const w = await ctDaten<{ firstName?: unknown; lastName?: unknown } | null>('/whoami');
  const name = [w?.firstName, w?.lastName]
    .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    .join(' ');
  return { personId: angemeldeteId(w), name: name || 'Ich' };
}
