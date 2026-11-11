/**
 * **Gruppenwechsel der Kinder** (Bauplan O9-1, Rechtekonzept 4.23–4.27, E7) – der Kern ohne Oberfläche: wer wann wohin
 * wechselt und die ChurchTools-Regeln und -Routine, die das von selbst erledigen.
 *
 * Ablauf je Übergang (z. B. Fische → Jungschar), gemessen in M10–M13 und O9-0:
 * - **Wechsel-Gruppe** (Typ „Gruppenwechsel“): Kinder der alten Gruppe, die am Stichtag alt genug sind, kommen **ab der
 *   Ankündigung** als Teilnehmer hinein; die Leitungen alter und neuer Gruppe als Leiter. Keine Regel entfernt jemanden.
 * - **Neue Gruppe:** nimmt in einem kurzen Fenster ab dem Wechseltag auf, wer **aktiv** als Teilnehmer in der
 *   Wechsel-Gruppe ist. Wer dort „zu löschen“ steht (die Ausnahme), bleibt außen vor.
 * - **Alte Gruppe:** trägt aus, wer aktiv in der neuen Gruppe ist.
 * - **Routine** der Wechsel-Gruppe (Teilnehmer, aktiv): nach einer Frist austragen.
 *
 * Kein Jahresschritt (4.27): Die Regeln tragen Fenster für alle Jahre, deren Sommerferien im Ferienkalender stehen.
 * Alle Tage sind `YYYY-MM-DD` in Ortszeit der Gemeinde; gerechnet wird mit `shared/ct/datum.ts`.
 */
import { alterAm, plusTage, vorJahren } from '../ct/datum';
import type { RoutinenSchritt } from '../ct/routinen';

// ── Einstellung ────────────────────────────────────────────────────────────────────────────────────────────────

/** Eine Altersstufe (Kindergruppe) in der Reihenfolge des Aufwachsens. */
export interface Stufe {
  gruppeId: number;
  name: string;
  /** Ab diesem Alter am Stichtag gehört ein Kind hierher (die erste Stufe: ab dem jüngsten Alter). */
  abAlter: number;
}

/**
 * **Was eine Gemeinde einstellt** (O9-F3: einstellbar, damit das Organigramm geteilt werden kann). Die Gruppen-IDs der
 * Wechsel-Gruppen gehören nicht hierher – die legt „Einrichten“ an und merkt sie sich.
 */
export interface GruppenwechselEinstellung {
  /** Die Kindergruppen, jüngste zuerst. */
  stufen: Stufe[];
  /** Stichtag des Alters als `MM-TT` (bei uns `09-30`): Wer bis dahin alt genug ist, wechselt in diesem Jahr. */
  stichtag: string;
  /** So viele Tage vor dem Wechseltag erfahren die Leitungen davon (bei uns 8 Wochen). */
  ankuendigungTage: number;
  /** So viele Tage ab dem Wechseltag nimmt die neue Gruppe auf. Kurz, damit eine im Winter aufgehobene Ausnahme erst am nächsten Wechseltag wirkt. */
  aufnahmeTage: number;
  /** So viele Tage nach dem Eintritt trägt die Routine ein Kind aus der Wechsel-Gruppe aus. */
  aufraeumenTage: number;
  /** Name des ChurchTools-Kalenders mit den Schulferien (Abo), gesucht nach Name, nicht nach ID. */
  ferienkalender: string;
  /** Woran die Sommerferien in diesem Kalender zu erkennen sind („Sommerferien Nordrhein-Westfalen 2027“). */
  ferienStichwort: string;
}

/** Unsere Werte (4.23, 4.27); die Stufen kommen aus ChurchTools, weil die Gruppen-IDs je Gemeinde anders sind. */
export const GRUNDWERTE: Omit<GruppenwechselEinstellung, 'stufen'> = {
  stichtag: '09-30',
  ankuendigungTage: 56,
  aufnahmeTage: 14,
  aufraeumenTage: 90,
  ferienkalender: 'Schulferien NRW',
  ferienStichwort: 'Sommerferien',
};

const MM_TT = /^(\d{2})-(\d{2})$/;
const ganz = (n: number, ab: number) => Number.isInteger(n) && n >= ab;

/** `MM-TT`, den es in jedem Jahr gibt – geprüft an einem Jahr ohne Schalttag, so fällt der 29.02. heraus. */
function gibtEsJedesJahr(mmtt: string): boolean {
  const m = MM_TT.exec(mmtt);
  if (!m) return false;
  const monat = Number(m[1]);
  const tag = Number(m[2]);
  const d = new Date(Date.UTC(2027, monat - 1, tag));
  return d.getUTCMonth() === monat - 1 && d.getUTCDate() === tag;
}

/**
 * **Was an einer Einstellung nicht stimmt** – leer, wenn sie taugt. Die Regeln wären sonst stillschweigend falsch:
 * eine Stufe ohne höheres Alter verschiebt niemanden, ein 29.02. als Stichtag fehlt in drei von vier Jahren, und räumt
 * die Routine vor dem Ende der Aufnahme auf, kommt ein Kind nie in die neue Gruppe.
 */
export function einstellungFehler(e: GruppenwechselEinstellung): string[] {
  const f: string[] = [];
  if (e.stufen.length < 2)
    f.push('Es braucht mindestens zwei Gruppen, sonst gibt es keinen Wechsel.');
  const ids = new Set<number>();
  e.stufen.forEach((s, i) => {
    if (!s.name.trim()) f.push(`Gruppe ${i + 1} hat keinen Namen.`);
    if (ids.has(s.gruppeId)) f.push(`„${s.name}“ steht zweimal in der Reihenfolge.`);
    ids.add(s.gruppeId);
    if (!ganz(s.abAlter, 0)) f.push(`„${s.name}“: Das Alter muss eine ganze Zahl ab 0 sein.`);
    const davor = e.stufen[i - 1];
    if (davor && s.abAlter <= davor.abAlter)
      f.push(`„${s.name}“ muss ein höheres Alter haben als „${davor.name}“.`);
  });
  if (!gibtEsJedesJahr(e.stichtag))
    f.push('Der Stichtag muss ein Tag sein, den es in jedem Jahr gibt (z. B. 30.09.).');
  if (!ganz(e.ankuendigungTage, 1)) f.push('Die Ankündigung braucht mindestens einen Tag Vorlauf.');
  if (!ganz(e.aufnahmeTage, 1)) f.push('Die neue Gruppe muss mindestens einen Tag lang aufnehmen.');
  if (!ganz(e.aufraeumenTage, 1) || e.aufraeumenTage <= e.ankuendigungTage + e.aufnahmeTage)
    f.push(
      `Das Aufräumen muss später kommen als Ankündigung und Aufnahme zusammen (mehr als ${
        e.ankuendigungTage + e.aufnahmeTage
      } Tage), sonst ist ein Kind vor dem Wechsel schon wieder draußen.`,
    );
  if (!e.ferienkalender.trim()) f.push('Der Name des Ferienkalenders fehlt.');
  if (!e.ferienStichwort.trim()) f.push('Das Stichwort für die Sommerferien fehlt.');
  return f;
}

/** Ein Übergang von einer Stufe zur nächsten. */
export interface Uebergang {
  von: Stufe;
  nach: Stufe;
}

/** Alle Übergänge in der Reihenfolge der Stufen: Schäfchen → Fische, Fische → Jungschar, … */
export function uebergaenge(e: Pick<GruppenwechselEinstellung, 'stufen'>): Uebergang[] {
  return e.stufen.slice(1).map((nach, i) => ({ von: e.stufen[i], nach }));
}

/** Name der Wechsel-Gruppe eines Übergangs, so wie „Einrichten“ sie anlegt. */
export const wechselGruppenName = (u: Uebergang): string => `${u.von.name} → ${u.nach.name}`;

// ── Ferien und Wechseltage ─────────────────────────────────────────────────────────────────────────────────────

/** Ein Kalender, wie `GET /calendars` ihn liefert (nur was hier zählt). */
export interface KalenderKurz {
  id: number;
  name: string;
}

/** **Den Ferienkalender finden** – nach Name (Groß-/Kleinschreibung und Leerraum egal), weil die ID je Instanz anders ist (live 20, Test 6). */
export function ferienkalenderFinden<K extends KalenderKurz>(
  kalender: readonly K[],
  name: string,
): K | null {
  const soll = name.trim().toLocaleLowerCase('de');
  return kalender.find((k) => k.name.trim().toLocaleLowerCase('de') === soll) ?? null;
}

/** Ein ganztägiger Termin des Ferienkalenders. ChurchTools liefert das **Ende einschließlich** (Sommerferien 2027: 19.07.–31.08.). */
export interface Ferientermin {
  titel: string;
  beginn: string;
  ende: string;
}

/** Sommerferien eines Jahres. */
export interface Sommerferien {
  jahr: number;
  beginn: string;
  ende: string;
}

/**
 * **Die Sommerferien aus dem Ferienkalender** – je Jahr einmal (nach dem Jahr des Beginns), aufsteigend. Erkannt am
 * Stichwort im Titel; steht ein Jahr doppelt da (Abo zweimal importiert), zählt der erste Termin.
 */
export function sommerferienAus(
  termine: readonly Ferientermin[],
  stichwort: string,
): Sommerferien[] {
  const wort = stichwort.trim().toLocaleLowerCase('de');
  const jeJahr = new Map<number, Sommerferien>();
  for (const t of termine) {
    if (!wort || !t.titel.toLocaleLowerCase('de').includes(wort)) continue;
    const beginn = t.beginn.slice(0, 10);
    const ende = t.ende.slice(0, 10);
    const jahr = Number(beginn.slice(0, 4));
    if (!jeJahr.has(jahr)) jeJahr.set(jahr, { jahr, beginn, ende });
  }
  return [...jeJahr.values()].sort((a, b) => a.jahr - b.jahr);
}

/** **Wechseltag** = erster Montag nach dem letzten Ferientag (4.23). Endet die Ferien an einem Sonntag, ist es der Tag danach. */
export function wechseltagNach(letzterFerientag: string): string {
  const wochentag = new Date(`${letzterFerientag}T00:00:00Z`).getUTCDay(); // 0 = Sonntag, 1 = Montag
  return plusTage(letzterFerientag, (8 - wochentag) % 7 || 7);
}

/** Was in einem Jahr passiert. Fenster sind **halboffen**: `ab` zählt mit (gemessen M12 F5), `bis` nicht mehr. */
export interface Wechseljahr {
  jahr: number;
  /** Stichtag des Alters in diesem Jahr. */
  stichtag: string;
  wechseltag: string;
  /** Ab hier stehen die Kinder in der Wechsel-Gruppe, die Leitungen sehen sie. */
  ankuendigung: string;
  /** Erster Tag, an dem die neue Gruppe nicht mehr aufnimmt (= Ende des Fensters der Wechsel-Gruppe). */
  aufnahmeBis: string;
}

/** **Die Wechseljahre** aus den Sommerferien – so viele, wie der Ferienkalender kennt. */
export function wechseljahre(
  ferien: readonly Sommerferien[],
  e: Pick<GruppenwechselEinstellung, 'stichtag' | 'ankuendigungTage' | 'aufnahmeTage'>,
): Wechseljahr[] {
  return ferien.map((f) => {
    const wechseltag = wechseltagNach(f.ende);
    return {
      jahr: f.jahr,
      stichtag: `${f.jahr}-${e.stichtag}`,
      wechseltag,
      ankuendigung: plusTage(wechseltag, -e.ankuendigungTage),
      aufnahmeBis: plusTage(wechseltag, e.aufnahmeTage),
    };
  });
}

// ── Wer wechselt (Vorschau) ────────────────────────────────────────────────────────────────────────────────────

/** **Geboren bis** – wer an diesem Tag oder früher geboren ist, hat am Stichtag `alter` erreicht. Steht so in der Regel. */
export function geborenBis(jahr: Wechseljahr, alter: number): string {
  return vorJahren(jahr.stichtag, alter);
}

/** Ein Kind in einer Stufe (Teilnehmer der Kindergruppe). */
export interface KindInGruppe {
  personId: number;
  gruppeId: number;
  /** `YYYY-MM-DD` oder `null`, wenn in ChurchTools kein Geburtstag steht. */
  geburtstag: string | null;
}

export type Wechsel =
  | { art: 'wechselt'; personId: number; von: Stufe; nach: Stufe; alter: number }
  | { art: 'bleibt'; personId: number; in: Stufe; alter: number }
  | { art: 'ohneGeburtstag'; personId: number; in: Stufe };

/**
 * **Wer in diesem Jahr wohin wechselt** – dieselbe Frage, die die Regel der Wechsel-Gruppe ChurchTools stellt, für die
 * Vorschau vor dem Schreiben. Ein Kind wechselt **eine** Stufe weiter, auch wenn es für zwei alt genug wäre (die Regel
 * kennt nur die nächste Gruppe). Kinder außerhalb der Stufen fehlen in der Antwort; die letzte Stufe wechselt nicht.
 */
export function werWechselt(
  kinder: readonly KindInGruppe[],
  e: Pick<GruppenwechselEinstellung, 'stufen'>,
  jahr: Wechseljahr,
): Wechsel[] {
  const stufeNach = new Map(e.stufen.map((s, i) => [s.gruppeId, i]));
  const aus: Wechsel[] = [];
  for (const k of kinder) {
    const i = stufeNach.get(k.gruppeId);
    if (i === undefined) continue;
    const hier = e.stufen[i];
    const alter = k.geburtstag ? alterAm(k.geburtstag.slice(0, 10), jahr.stichtag) : null;
    if (alter === null) {
      aus.push({ art: 'ohneGeburtstag', personId: k.personId, in: hier });
      continue;
    }
    const naechste = e.stufen[i + 1];
    if (naechste && alter >= naechste.abAlter)
      aus.push({ art: 'wechselt', personId: k.personId, von: hier, nach: naechste, alter });
    else aus.push({ art: 'bleibt', personId: k.personId, in: hier, alter });
  }
  return aus;
}

// ── Regeln für ChurchTools ─────────────────────────────────────────────────────────────────────────────────────

/** Die Mitgliedsstatus, die ChurchTools in Regeln kennt. */
const STATUS = ['active', 'requested', 'waiting', 'to_delete'] as const;
type Status = (typeof STATUS)[number];

type Behandlung = {
  handleMembership: { groupTypeRoleId?: number; groupMemberStatus: Status | 'none' };
};
type JeStatus = Partial<Record<Status | 'none', Record<string, never> | Behandlung>>;

/** Eine Regel, wie `PUT /dynamicgroups/{id}/ruleset` sie in `dynamicGroupRuleSet` nimmt. */
export interface Regel {
  shorty: string;
  description: string;
  importance: number;
  personIdFieldName: 'person.id';
  query: {
    method: 'ChurchQuery';
    params: { primaryEntityAlias: 'person'; responseFields: ['person.id']; filter: unknown };
  };
  process: {
    queryResultOnly: { none: Record<string, never> | Behandlung };
    groupAndQueryResult: JeStatus;
    groupOnly: JeStatus;
  };
}

/**
 * **Niemanden anfassen**: jeder Status ausdrücklich „keine Aktion“. Fehlt ein Status, ist nicht gemessen, was ChurchTools
 * tut – und in den Wechsel-Gruppen steht die Ausnahme als `to_delete`, in den Kindergruppen gibt es auch angefragte und
 * wartende Mitglieder. Die OpenAPI nennt `{}` „no action“. (T3: Eine Regel, die entfernt, wirft die Leute der anderen hinaus.)
 */
const inRuhe = (): JeStatus => Object.fromEntries(STATUS.map((s) => [s, {}]));

const aufnehmen = (rolleId: number): { none: Behandlung } => ({
  none: { handleMembership: { groupTypeRoleId: rolleId, groupMemberStatus: 'active' } },
});

const feld = (name: string) => ({ var: name });
const gleich = (name: string, wert: string | number) => ({ '==': [feld(name), wert] });
/** Heute im Fenster `[ab, bis)` – Vergleich mit `ct_date now` wie in M12 gemessen. */
const imFenster = (ab: string, bis: string) => ({
  and: [{ '<=': [ab, { ct_date: ['now'] }] }, { '<': [{ ct_date: ['now'] }, bis] }],
});
/** ChurchTools kennt kein `in` (O9-0) – „eine dieser Gruppen“ als `or` aus `==`. */
const eineDerGruppen = (ids: readonly number[]) => ({
  or: ids.map((id) => gleich('groupmember.groupId', id)),
});

function regel(
  shorty: string,
  description: string,
  importance: number,
  filter: unknown,
  process: Regel['process'],
): Regel {
  return {
    shorty,
    description,
    importance,
    personIdFieldName: 'person.id',
    query: {
      method: 'ChurchQuery',
      params: { primaryEntityAlias: 'person', responseFields: ['person.id'], filter },
    },
    process,
  };
}

/** Rollen des Gruppentyps „Gruppenwechsel“ (entstehen beim Anlegen des Typs von selbst, O9-0). */
export interface WechselRollen {
  teilnehmer: number;
  leiter: number;
}

/**
 * **Regeln der Wechsel-Gruppe**: (1) Kinder der alten Gruppe, je Jahr ein Fenster `[Ankündigung, Aufnahme-Ende)` mit
 * „geboren bis …“ → aktiv als Teilnehmer; (2) Leitungen alter und neuer Gruppe → Leiter. Beide entfernen niemanden.
 *
 * Das Fenster endet mit der Aufnahme der neuen Gruppe: Wer danach noch alt genug in der alten Gruppe auftaucht, wechselt
 * erst im nächsten Jahr – so räumt die Routine niemanden aus der Wechsel-Gruppe, bevor er gewechselt ist.
 */
export function wechselGruppenRegeln(
  u: Uebergang,
  jahre: readonly Wechseljahr[],
  rollen: WechselRollen,
): Regel[] {
  const fenster = jahre.map((j) => ({
    and: [
      ...imFenster(j.ankuendigung, j.aufnahmeBis).and,
      { '<=': [feld('person.birthday'), geborenBis(j, u.nach.abAlter)] },
    ],
  }));
  const kinder = regel(
    'gwkinder',
    `Gruppenwechsel: Kinder aus „${u.von.name}“, die nach „${u.nach.name}“ wechseln`,
    10,
    {
      and: [
        gleich('groupmember.groupId', u.von.gruppeId),
        gleich('role.type', 'participant'),
        { or: fenster },
      ],
    },
    {
      queryResultOnly: aufnehmen(rollen.teilnehmer),
      groupAndQueryResult: inRuhe(),
      groupOnly: inRuhe(),
    },
  );
  const leitung = regel(
    'gwleitung',
    `Gruppenwechsel: Leitungen von „${u.von.name}“ und „${u.nach.name}“`,
    20,
    { and: [eineDerGruppen([u.von.gruppeId, u.nach.gruppeId]), gleich('role.type', 'leader')] },
    {
      queryResultOnly: aufnehmen(rollen.leiter),
      groupAndQueryResult: inRuhe(),
      groupOnly: inRuhe(),
    },
  );
  return [kinder, leitung];
}

/**
 * **Aufnahme-Regel der neuen Gruppe**: wer **aktiv** als Teilnehmer in der Wechsel-Gruppe steht und heute in einem
 * Fenster ab einem Wechseltag liegt → Teilnehmer. Die Ausnahme („zu löschen“) passt nicht (gemessen M13 Z2).
 */
export function aufnahmeRegel(
  u: Uebergang,
  wechselGruppeId: number,
  jahre: readonly Wechseljahr[],
  teilnehmerRolleNeu: number,
): Regel {
  return regel(
    'gwaufnahme',
    `Gruppenwechsel: Kinder aus „${u.von.name}“ am Wechseltag aufnehmen`,
    10,
    {
      and: [
        gleich('groupmember.groupId', wechselGruppeId),
        gleich('role.type', 'participant'),
        gleich('groupmember.groupMemberStatus', 'active'),
        { or: jahre.map((j) => imFenster(j.wechseltag, j.aufnahmeBis)) },
      ],
    },
    {
      queryResultOnly: aufnehmen(teilnehmerRolleNeu),
      groupAndQueryResult: inRuhe(),
      groupOnly: inRuhe(),
    },
  );
}

/**
 * **Austrag-Regel der alten Gruppe**: wer aktiv als Teilnehmer in der neuen Gruppe ist → aus der alten Gruppe austragen
 * (R4b). Nur Teilnehmer: Eine Leitung, die in beiden Gruppen mitarbeitet, bleibt.
 */
export function austragRegel(u: Uebergang): Regel {
  return regel(
    'gwaustragen',
    `Gruppenwechsel: wer in „${u.nach.name}“ angekommen ist, verlässt „${u.von.name}“`,
    30,
    {
      and: [
        gleich('groupmember.groupId', u.nach.gruppeId),
        gleich('role.type', 'participant'),
        gleich('groupmember.groupMemberStatus', 'active'),
      ],
    },
    {
      queryResultOnly: { none: {} },
      groupAndQueryResult: {
        ...inRuhe(),
        active: { handleMembership: { groupMemberStatus: 'none' } },
      },
      groupOnly: inRuhe(),
    },
  );
}

/** Wechsel-Gruppe je Übergang, so wie „Einrichten“ sie angelegt hat (Schlüssel: Gruppe, aus der gewechselt wird). */
export type WechselGruppen = ReadonlyMap<number, number>;

/**
 * **Alle Regeln aller beteiligten Gruppen** – je Gruppe die ganze Liste, weil `PUT …/ruleset` alle Regeln ersetzt. Eine
 * mittlere Stufe (Jungschar) bekommt zwei: Aufnahme aus „Fische → Jungschar“ und Austragen nach „Teeny“. Die erste Stufe
 * nimmt niemanden von selbst auf, die letzte trägt niemanden aus. Fehlt die Wechsel-Gruppe eines Übergangs, fehlen
 * dessen Regeln ganz (Wechsel-Gruppe und Aufnahme gehören zusammen).
 */
export function alleRegeln(
  e: Pick<GruppenwechselEinstellung, 'stufen'>,
  jahre: readonly Wechseljahr[],
  wechselGruppen: WechselGruppen,
  rollen: WechselRollen,
  teilnehmerRolle: ReadonlyMap<number, number>,
): Map<number, Regel[]> {
  const aus = new Map<number, Regel[]>();
  const dazu = (gruppeId: number, ...r: Regel[]) =>
    aus.set(gruppeId, [...(aus.get(gruppeId) ?? []), ...r]);
  for (const u of uebergaenge(e)) {
    const w = wechselGruppen.get(u.von.gruppeId);
    const rolleNeu = teilnehmerRolle.get(u.nach.gruppeId);
    if (w === undefined || rolleNeu === undefined) continue;
    dazu(w, ...wechselGruppenRegeln(u, jahre, rollen));
    dazu(u.nach.gruppeId, aufnahmeRegel(u, w, jahre, rolleNeu));
    dazu(u.von.gruppeId, austragRegel(u));
  }
  return aus;
}

// ── Routine der Wechsel-Gruppe ─────────────────────────────────────────────────────────────────────────────────

/** Was `POST /routines` zum Anlegen nimmt; die Schritte kommen danach per `PATCH /routines/{id}`. */
export interface RoutineNeu {
  name: string;
  domainType: 'group_membership';
  domainContext: { groupId: number; groupTypeRoleId: number; groupMemberStatus: 'active' };
  isEnabled: true;
}

/**
 * **Aufräum-Routine** der Wechsel-Gruppe: Teilnehmer mit Status „aktiv“ nach `aufraeumenTage` austragen (M13, läuft von
 * selbst weiter). Die Ausnahme („zu löschen“) startet keinen Lauf und bleibt stehen.
 */
export function aufraeumRoutine(
  u: Uebergang,
  wechselGruppeId: number,
  rollen: WechselRollen,
  e: Pick<GruppenwechselEinstellung, 'aufraeumenTage'>,
): { neu: RoutineNeu; schritte: RoutinenSchritt[] } {
  return {
    neu: {
      name: `Gruppenwechsel ${wechselGruppenName(u)}: aufräumen`,
      domainType: 'group_membership',
      domainContext: {
        groupId: wechselGruppeId,
        groupTypeRoleId: rollen.teilnehmer,
        groupMemberStatus: 'active',
      },
      isEnabled: true,
    },
    schritte: [
      {
        actionKey: 'special:wait',
        isEnabled: true,
        actionData: { duration: { numDays: e.aufraeumenTage } },
      },
      { actionKey: 'remove-member', isEnabled: true, actionData: {} },
    ],
  };
}

// ── Rechte am Typ (E7) ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * **Die gruppeninternen Rechte der Leiter-Rolle** am Typ „Gruppenwechsel“ (gemessen O9-0): ohne „Gruppeninfos sehen“ ist
 * die Gruppe unsichtbar. `dataId` = Stufe. Teilnehmer bekommen keine. Damit: sehen + Ausnahme setzen, sonst nichts.
 */
export const LEITER_RECHTE: readonly { authId: number; name: string; dataId: number | null }[] = [
  { authId: 10101, name: 'Gruppenmitglieder sehen', dataId: 1 },
  { authId: 10102, name: 'Gruppeninfos sehen', dataId: 1 },
  { authId: 10108, name: 'Gruppenmitgliedschaften bearbeiten', dataId: null },
];
