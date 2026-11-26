/**
 * **Erinnerungen in ChurchTools einrichten – die reinen Regeln** (Bauplan R-5a, 25.11.2026). Je Dienstgruppe legt die App in
 * ChurchTools eine **Hilfsgruppe** (Gruppentyp „Dienstplaner“) und eine **Routine** daran an; die Routine verschickt später die
 * Erinnerungen (R-5b baut ihre Schritte, hier entsteht sie ohne). Alle **Planer** der Dienstgruppe bekommen **zwei globale
 * Rechte nur für diese Hilfsgruppe** („Planer wie alle“, Alwin 25.11.2026, gemessen `messung-runden.md`): Sie dürfen so die
 * Mitglieder und die Routine der Gruppe ändern, ohne Leiter zu sein – sie sind normale Teilnehmer und werden erinnert wie
 * alle. Gespeichert wird nur Gruppen- und Routinen-Nummer (`AbfragenInhalt.einrichtung`); geschrieben wird in
 * `dienstplaner/src/einrichtenAbfragen.ts`; **die Schritte der Routine** (R-5b) baut `abfrageRoutinenSchritte` hier.
 *
 * Hier stehen nur Namen, Texte und Rechenregeln:
 * - **Die Planer-Liste** (`planerListe`) aus zwei Quellen: wer das globale Recht „Dienste einzelner Dienstkategorien
 *   bearbeiten“ für die Dienstgruppe hat, und wer eine ChurchTools-Gruppe der Dienste **leitet** – dieselbe Regel wie
 *   `darfDienstPlanen` (Termin-Admins planen nur einzelne Termine und zählen nicht).
 * - **Soll gegen Ist** (`einrichtenPlan`): was beim Einrichten zu tun ist. **Nie entzogen:** Rechte und Leiter früherer
 *   Einrichtungen bleiben stehen.
 * - **Die Rechte der Planer** (`PLANER_GRUPPENRECHTE`, `gruppenRechteAus`).
 * - **Die Routine-Schritte** (`abfrageRoutinenSchritte`): aus `erinnerungsTage` – dieselbe Regel wie Vorschau und Zeitleiste.
 */
import { ctId } from '../ct/ctId';
import type { RoutinenSchritt } from '../ct/routinen';
import {
  erinnerungsTage,
  type Abfrage,
  type Erinnerungsplan,
  type VerfuegbarkeitArt,
} from './abfragen';
import { mailFuer } from './abfrageMail';

/** Der Gruppentyp der Hilfsgruppen – legt ein Admin einmal in ChurchTools an (Anleitung `docs/betrieb/DIENSTPLANER.md`). */
export const HILFSGRUPPEN_TYP = 'Dienstplaner';

/** Passt der Name eines Gruppentyps? (Ohne Rücksicht auf Leerzeichen am Rand, sonst genau.) */
export const istHilfsgruppenTyp = (name: unknown): boolean =>
  typeof name === 'string' && name.trim() === HILFSGRUPPEN_TYP;

/** Der Name der Hilfsgruppe – er muss für sich sprechen: Mitarbeitende sehen sie in ChurchTools unter „Meine Gruppen“. */
export const hilfsgruppenName = (dienstgruppe: string): string =>
  `Dienstplaner: Antwort fehlt – ${dienstgruppe}`;

/** Der Name der Routine an der Hilfsgruppe. */
export const routinenName = (dienstgruppe: string): string =>
  `Dienstplaner: Erinnerungen ${dienstgruppe}`;

/** Ist das eine Routine dieser App? (Erkennbar am Namen – fremde Routinen fasst die App nie an.) */
export const istUnsereRoutine = (name: unknown): boolean =>
  typeof name === 'string' && name.startsWith('Dienstplaner: ');

/** Die Beschreibung der Hilfsgruppe in ChurchTools (`information.note`): was, warum, wer sie führt. */
export const hilfsgruppenBeschreibung = (dienstgruppe: string): string =>
  `Hilfsgruppe des Dienstplaners für ${dienstgruppe}: Hier steht nur, wem in einer laufenden Abfrage noch Antworten fehlen. ` +
  `Die Erweiterung Dienstplaner trägt Personen ein und wieder aus. Eine Routine an dieser Gruppe verschickt die Erinnerungen; ` +
  `wer ausgetragen wird oder die Gruppe verlässt, bekommt ab sofort keine mehr.`;

// ── Die Planer ──────────────────────────────────────────────────────────────

/** Das globale Recht, mit dem man eine Dienstgruppe plant – die Nummer wird je Instanz aus den Definitionen gelesen. */
export const PLANER_RECHT = {
  modul: 'churchservice',
  recht: 'edit servicegroup',
  name: 'Dienste einzelner Dienstkategorien bearbeiten',
} as const;

/** `GET`-Adresse: alle Personen, die das Recht für diese Dienstgruppe haben (braucht „Berechtigungen verwalten“). */
export const planerRechtPfad = (authId: number, dienstgruppeId: number): string =>
  `/permissions/global/auths/${authId}/persons?data_id=${dienstgruppeId}`;

/**
 * Personennummern aus der Antwort auf `planerRechtPfad` – **in der gemessenen Form** (Test-Instanz, 25.11.2026, nach dem
 * Auspacken von `data`): `{ authId, selections: [{ dataId, personIds: number[] }] }`. Wer das Recht für **alle**
 * Dienstgruppen (−1) hat, steht bei jeder einzelnen `data_id` mit drin (gemessen). Gelesen wird genau der Eintrag dieser
 * Dienstgruppe. **Streng:** `null`, wenn die Form nicht stimmt, der Eintrag fehlt oder eine Nummer keine ist – eine halbe
 * Liste darf nie „weniger Planer“ heißen (dann bekäme niemand die Rechte, und Soll/Ist meldete „nichts fehlt“).
 */
export function personenIdsAusRecht(roh: unknown, dienstgruppeId: number): number[] | null {
  if (roh === null || typeof roh !== 'object') return null;
  const auswahl = (roh as { selections?: unknown }).selections;
  if (!Array.isArray(auswahl)) return null;
  const eintrag = (auswahl as unknown[]).find(
    (e) =>
      e !== null &&
      typeof e === 'object' &&
      ctId((e as { dataId?: unknown }).dataId) === dienstgruppeId,
  ) as { personIds?: unknown } | undefined;
  if (!eintrag || !Array.isArray(eintrag.personIds)) return null;
  const ids: number[] = [];
  for (const e of eintrag.personIds as unknown[]) {
    const id = ctId(e);
    if (id === null || id <= 0) return null;
    ids.push(id);
  }
  return ids;
}

/** Aufsteigend, jede Nummer einmal. */
const sortiert = (ids: Iterable<number>): number[] => [...new Set(ids)].sort((a, b) => a - b);

/** **Die Planer einer Dienstgruppe**: Personen-IDs aus beiden Quellen, sortiert, ohne Doppel. */
export function planerListe(quellen: {
  /** Mit dem globalen Recht für diese Dienstgruppe. */
  recht: readonly number[];
  /** Leiter einer ChurchTools-Gruppe der Dienste dieser Dienstgruppe. */
  leitungen: readonly number[];
}): number[] {
  return sortiert([...quellen.recht, ...quellen.leitungen]);
}

/**
 * Die ChurchTools-Gruppen der Dienste einer Dienstgruppe – jede einmal (Kamera Saal/Studio/Mobil teilen sich eine). Von deren
 * Leitung kommt die zweite Quelle der Planer-Liste.
 */
export function gruppenIdsDerDienste(
  dienste: Iterable<{ dienstgruppeId: number | null; gruppenIds: readonly number[] }>,
  dienstgruppeId: number,
): number[] {
  const ids = new Set<number>();
  for (const d of dienste)
    if (d.dienstgruppeId === dienstgruppeId) for (const g of d.gruppenIds) ids.add(g);
  return sortiert(ids);
}

// ── Die Rechte der Planer ───────────────────────────────────────────────────

/** Die zwei globalen Rechte (`churchgroup`), die ein Planer **je Hilfsgruppe** bekommt – Nummern je Instanz aus den Definitionen. */
export const PLANER_GRUPPENRECHTE = [
  {
    schluessel: 'sehen',
    modul: 'churchgroup',
    recht: 'view group',
    name: 'Gruppe inkl. ihrer Gruppenmitglieder sehen',
  },
  {
    schluessel: 'bearbeiten',
    modul: 'churchgroup',
    recht: 'edit group memberships of group',
    name: 'Gruppenmitgliedschaften einer Gruppe bearbeiten',
  },
] as const;

export type GruppenRecht = (typeof PLANER_GRUPPENRECHTE)[number]['schluessel'];

/** Der Grund, der bei ChurchTools am Recht steht – derselbe Name wie die Routine. */
export const gruppenRechtGrund = (dienstgruppe: string): string => routinenName(dienstgruppe);

/** Die Nummern aus `dataId` – eine Zahl, eine Liste oder `-1` (alle); nicht Lesbares fällt weg. */
function dataIdsAus(roh: unknown): number[] {
  const liste: unknown[] = Array.isArray(roh) ? (roh as unknown[]) : [roh];
  return liste.flatMap((x) => {
    const id = ctId(x);
    return id === null ? [] : [id];
  });
}

/**
 * Welche der zwei Rechte eine Person **für diese Hilfsgruppe** hat – aus `GET /permissions/person/{id}` (Zeilen mit `authId`
 * und `dataId`). `-1` (für alle Gruppen) zählt als vorhanden. **Streng:** `null`, wenn die Antwort keine Liste ist – das darf nie
 * „hat nichts“ heißen (dann würde geschrieben, und ein ersetzendes `PUT` könnte Rechte anderer Gruppen verlieren).
 */
export function gruppenRechteAus(
  roh: unknown,
  authIds: Readonly<Record<GruppenRecht, number>>,
  gruppeId: number,
): Set<GruppenRecht> | null {
  if (!Array.isArray(roh)) return null;
  const da = new Set<GruppenRecht>();
  for (const z of roh as { authId?: unknown; dataId?: unknown }[]) {
    if (z === null || typeof z !== 'object') continue;
    const auth = ctId(z.authId);
    if (auth === null) continue;
    const ids = dataIdsAus(z.dataId);
    if (!ids.includes(gruppeId) && !ids.includes(-1)) continue;
    for (const r of PLANER_GRUPPENRECHTE) if (authIds[r.schluessel] === auth) da.add(r.schluessel);
  }
  return da;
}

/**
 * Alle Nummern, für die eine Person ein Recht hat (`dataId`-Werte) – damit ein ersetzendes `PUT` auffällt: Was vorher da war,
 * muss nachher noch da sein. `null`, wenn die Antwort keine Liste ist.
 */
export function rechtDataIdsAus(roh: unknown, authId: number): Set<number> | null {
  if (!Array.isArray(roh)) return null;
  const aus = new Set<number>();
  for (const z of roh as { authId?: unknown; dataId?: unknown }[])
    if (z !== null && typeof z === 'object' && ctId(z.authId) === authId)
      for (const id of dataIdsAus(z.dataId)) aus.add(id);
  return aus;
}

// ── Soll gegen Ist ──────────────────────────────────────────────────────────

/** Was in ChurchTools schon dasteht. */
export interface EinrichtenIst {
  /** Die Hilfsgruppe gibt es (die gespeicherte oder eine übernommene mit gleichem Namen und Typ). */
  gruppe: boolean;
  /** Die Routine der App hängt an der Gruppe (Teilnehmer, aktiv, eingeschaltet). */
  routine: boolean;
  /** Das Dokument verweist auf genau diese Gruppe und Routine. */
  eingetragen: boolean;
  /** Je Planer, welche der zwei Rechte für diese Hilfsgruppe schon da sind (ohne Eintrag: keins). */
  rechte: ReadonlyMap<number, ReadonlySet<GruppenRecht>>;
}

/** Einem Planer fehlen diese Rechte. */
export interface PlanerRechte {
  personId: number;
  fehlt: GruppenRecht[];
}

/** Was beim Einrichten zu tun ist – jeder Teil einzeln, damit Fenster und Schreiben dasselbe lesen. */
export interface EinrichtenPlan {
  gruppeAnlegen: boolean;
  /** Fehlt die Gruppe, fehlt auch die Routine. */
  routineAnlegen: boolean;
  /** Die Nummern ins Dokument schreiben (noch nicht oder anders eingetragen). */
  einrichtungSchreiben: boolean;
  /** Planer, denen eines der zwei Rechte für die Hilfsgruppe fehlt – nur sie werden geschrieben. */
  rechteNachtragen: PlanerRechte[];
  /** Es gibt nichts zu schreiben. */
  nichtsZuTun: boolean;
}

/** **Soll gegen Ist.** `planer` kommt aus `planerListe`. */
export function einrichtenPlan(planer: readonly number[], ist: EinrichtenIst): EinrichtenPlan {
  const gruppeAnlegen = !ist.gruppe;
  const routineAnlegen = gruppeAnlegen || !ist.routine;
  const einrichtungSchreiben = gruppeAnlegen || routineAnlegen || !ist.eingetragen;
  // Eine gerade angelegte Gruppe hat keine Rechte – was in `ist` steht, gilt dann nicht.
  const rechteNachtragen = sortiert(planer).flatMap((personId): PlanerRechte[] => {
    const hat = gruppeAnlegen ? new Set<GruppenRecht>() : (ist.rechte.get(personId) ?? new Set());
    const fehlt = PLANER_GRUPPENRECHTE.map((r) => r.schluessel).filter((k) => !hat.has(k));
    return fehlt.length > 0 ? [{ personId, fehlt }] : [];
  });
  return {
    gruppeAnlegen,
    routineAnlegen,
    einrichtungSchreiben,
    rechteNachtragen,
    nichtsZuTun:
      !gruppeAnlegen && !routineAnlegen && !einrichtungSchreiben && rechteNachtragen.length === 0,
  };
}

// ── Die Schritte der Routine ────────────────────────────────────────────────

/**
 * **Die Schritte der Routine für eine Abfrage** (R-5b) – aus `erinnerungsTage`, der einen Regel für die Tage:
 * - Öffnet die Abfrage **später** und ist der Öffnen-Tag kein Erinnerungstag, steht vorn „warten bis Öffnen“ (ohne Mail), damit
 *   vorher nichts läuft;
 * - je Erinnerungstag: ist es **heute** (nur als Öffnen-Tag beim Start), Mail **ohne** Warten – sonst „warten bis Tag“, dann Mail;
 * - am Ende „warten bis Beginn des Zeitraums“, dann `remove-member`.
 *
 * **Nie ein Warten auf einen Tag, der nicht nach heute liegt:** ChurchTools lässt „warten bis heute oder früher“ sofort durchlaufen
 * (gemessen) – das schickte mehrere Mails auf einmal. Ein Erinnerungstag davor fällt in `erinnerungsTage` schon weg.
 *
 * Die Mail baut `mailFuer` (dieselbe wie die Vorschau in den Einstellungen). `link` führt in „Verfügbarkeit“ **der
 * Dienstgruppe** (nicht der Hilfsgruppe – dort sucht die Seite die Abfrage). `skipIfEmailAddressMissing`: Wer keine Adresse hat,
 * bleibt im Lauf (gemessen R1).
 */
export function abfrageRoutinenSchritte(o: {
  plan: Erinnerungsplan;
  abfrage: Abfrage;
  heute: string;
  dienstgruppe: string;
  link: string;
  /** Wie die Dienstgruppe die Verfügbarkeit abfragt (V-4) – der Standardtext der Mail hängt daran (`mailFuer`). */
  art: VerfuegbarkeitArt;
  /**
   * Wer die Abfrage startet – kommt als `senderId` in den Schritt. **ChurchTools übernimmt das Feld nicht** (gemessen
   * 26.11.2026: gespeichert wird `senderId: null`); die Mails kommen vom Standard-Absender der Instanz („<Gemeinde>“
   * <noreply@churchtools.de>), nicht von der startenden Person. Das Feld bleibt, falls ChurchTools es einmal beachtet.
   */
  senderId: number;
}): RoutinenSchritt[] {
  const { abfrage: a, heute } = o;
  const tage = erinnerungsTage(o.plan, a, heute);
  const m = mailFuer(o.plan, a, o.dienstgruppe, o.link, o.art);
  const mail: RoutinenSchritt = {
    actionKey: 'send-member-email',
    isEnabled: true,
    actionData: {
      subject: m.betreff,
      body: m.html,
      addSignOutUrl: false,
      senderId: o.senderId,
      skipIfEmailAddressMissing: true,
    },
  };
  const warten = (untilDate: string): RoutinenSchritt => ({
    actionKey: 'special:wait',
    isEnabled: true,
    actionData: { untilDate },
  });
  const schritte: RoutinenSchritt[] = [];
  if (a.oeffnen > heute && !tage.includes(a.oeffnen)) schritte.push(warten(a.oeffnen));
  for (const tag of tage) {
    if (tag > heute) schritte.push(warten(tag));
    schritte.push({ ...mail });
  }
  if (a.von > heute) schritte.push(warten(a.von));
  schritte.push({ actionKey: 'remove-member', isEnabled: true, actionData: {} });
  return schritte;
}
