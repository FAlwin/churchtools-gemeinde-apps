/**
 * **Die Automatik einer Abfrage in ChurchTools – der Ablauf** (Bauplan R-5b, 25.11.2026): Start, Abgleich, Austritt, Leeren,
 * Beenden. Die Regeln (welche Schritte, wann) stehen in `shared/dienstplan/abfrageAutomatik.ts`; hier wird geredet: gelesen,
 * geschrieben, **nachgelesen** (ein 200 ist kein Beleg, Lehre vom 11.08.2026).
 *
 * **Der Ablauf einer Abfrage** (je Mitgliedschaft ein Lauf der Routine, gemessen R-0): Beim **Start** werden alle, die dann
 * offen sind, als **Teilnehmer** in die Hilfsgruppe eingetragen – das startet ihren Lauf (Mail sofort oder „warten bis“).
 * **Austragen beendet den Lauf sofort.** Wer antwortet, trägt sich selbst aus; der Planer gleicht beim Öffnen des Stands ab
 * (nur **aus**, nie ein); beim Beenden werden alle ausgetragen. Zum Beginn des Zeitraums trägt die Routine selbst aus.
 *
 * **Nur die Rolle „Teilnehmer“ zählt** – die Routine hängt an ihr. Leiter aus früheren Probe-Einrichtungen bleiben in der Gruppe
 * stehen: Sie blockieren keinen Start, und nichts trägt sie aus.
 *
 * **Die Zweige einzeln** (vorübergehend ist nicht ungültig): ein fehlendes Recht (403) ist etwas anderes als ein Aussetzer. Beim
 * Start heißt 403 „ohne Automatik starten, mit ehrlichem Hinweis“; ein Aussetzer stoppt, **ohne etwas zu verändern** – sonst
 * liefe die Abfrage dauerhaft ohne Automatik (nachgetragen wird nur am Starttag). Nichts wird automatisch wiederholt; kein Name
 * und keine Nummer in `console.*`.
 */
import { ApiError } from '@ui/ct/fehler';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { ctId } from '@shared/ct/ctId';
import { listeHolen } from '@shared/ct/gruppenart';
import type { RoutinenSchritt } from '@shared/ct/routinen';
import type { Einrichtung } from '@shared/dienstplan/abfragen';
import {
  istLeitung,
  mitgliederAus,
  rollenAus,
  type RohMitglied,
} from '@shared/organigramm/mitglieder';
import type { EinrichtenAnschluss } from './einrichtenAbfragen';

/** Was die Automatik von ChurchTools braucht – dieselben Wege wie das Einrichten (`ui/ct/mitglieder.ts` ist der EINE Weg). */
export type AutomatikAnschluss = Pick<
  EinrichtenAnschluss,
  'port' | 'mitgliedAnlegen' | 'mitgliedEntfernen' | 'mitgliedOderNichts'
>;

export interface PersonNr {
  id: number;
  name: string;
}

const routinenPfad = (g: number) => `/groups/${g}/members/routines`;
const mitgliederPfad = (g: number) => `/groups/${g}/members`;

const ist403 = (e: unknown) => e instanceof ApiError && e.status === 403;
const ist404 = (e: unknown) => e instanceof ApiError && e.status === 404;

const NEU_EINRICHTEN =
  'Bitte in den Einstellungen unter „In ChurchTools“ neu einrichten (Planer prüfen …).';

interface RoutineZeile {
  id?: unknown;
  groupTypeRoleId?: unknown;
  groupMemberStatus?: unknown;
  routine?: { name?: unknown; isEnabled?: unknown; steps?: unknown } | null;
}

/** Die Routine der Einrichtung samt ihrer Rolle – `null`, wenn es sie in der Gruppe nicht (mehr) gibt. */
async function routineLesen(
  a: AutomatikAnschluss,
  e: Einrichtung,
): Promise<{ rolle: number; zeile: RoutineZeile } | null> {
  const zeilen = await listeHolen<RoutineZeile>(a.port, routinenPfad(e.gruppeId), 'Die Routinen');
  const z = zeilen.find((x) => ctId(x.id) === e.routineId && x.groupMemberStatus === 'active');
  const rolle = z ? ctId(z.groupTypeRoleId) : null;
  return z && rolle !== null ? { rolle, zeile: z } : null;
}

/** Die Teilnehmer (nur diese Rolle, aktiv) der Hilfsgruppe. */
async function teilnehmerLesen(
  a: AutomatikAnschluss,
  gruppeId: number,
  rolle: number,
): Promise<PersonNr[]> {
  const m = mitgliederAus(await a.port.liste<RohMitglied>(mitgliederPfad(gruppeId)));
  const namen = new Map(m.personen.map((p) => [p.id, p.name]));
  return m.mitglieder
    .filter((x) => x.rolleId === rolle)
    .map((x) => ({ id: x.personId, name: namen.get(x.personId) ?? `Person ${x.personId}` }));
}

/** Die Teilnehmer der Hilfsgruppe, wie sie dort stehen – `null`, wenn die Routine fehlt (Rolle unbekannt). */
async function hilfsgruppeLesen(
  a: AutomatikAnschluss,
  e: Einrichtung,
): Promise<{ rolle: number; teilnehmer: PersonNr[] } | null> {
  const r = await routineLesen(a, e);
  if (!r) return null;
  return { rolle: r.rolle, teilnehmer: await teilnehmerLesen(a, e.gruppeId, r.rolle) };
}

const namenText = (l: readonly PersonNr[]) => l.map((p) => p.name).join(', ');

/** Schritte, wie sie ChurchTools nachgelesen meldet: nur Art und Datum – der Mailtext kann normalisiert werden. */
const kurz = (s: { actionKey?: unknown; actionData?: unknown }): string => {
  const d = s.actionData as { untilDate?: unknown } | null | undefined;
  return typeof d?.untilDate === 'string'
    ? `${String(s.actionKey)}@${d.untilDate}`
    : String(s.actionKey);
};
const kurzSoll = (s: RoutinenSchritt): string =>
  'untilDate' in s.actionData ? `${s.actionKey}@${s.actionData.untilDate}` : s.actionKey;

// ── Start: (a) Gruppe leer? (b) Schritte ersetzen ───────────────────────────

export type Vorbereitung =
  /** Alles bereit: die Gruppe ist leer, die Schritte stehen nachgelesen da. */
  | { art: 'bereit'; rolle: number }
  /** Nichts verändert – mit Grund. `leeren`: Die Gruppe ist nicht leer (Reste einer früheren Abfrage). */
  | { art: 'gestoppt'; text: string; nochmal: boolean; leeren: boolean }
  /**
   * Ohne Automatik starten (wie vor R-5b), mit ehrlichem Hinweis: kein Recht an der Hilfsgruppe (403) – oder es gibt die Gruppe
   * beziehungsweise die Routine in ChurchTools nicht mehr (404). Ohne Routine kann nichts verschickt werden, also gibt es
   * nichts zu schützen; „Abfragen und Erinnern per Hand gehen trotzdem“ gilt.
   */
  | { art: 'ohneAutomatik'; text: string };

/**
 * **Stufen (a) und (b)** des Starts: Die Hilfsgruppe lesen – **ist jemand drin, Stopp** (nie Schritte ersetzen, solange jemand
 * drin ist: das beendete oder verwirrte seinen Lauf) – dann die Schritte der Routine ersetzen (`PATCH /routines/{id}`) und
 * nachlesen (Arten und Daten). Geschrieben wird erst nach (a); scheitert (b), steht das Dokument noch unverändert.
 */
export async function startVorbereiten(
  a: AutomatikAnschluss,
  e: Einrichtung,
  schritte: readonly RoutinenSchritt[],
): Promise<Vorbereitung> {
  let rolle: number;
  try {
    const h = await hilfsgruppeLesen(a, e);
    if (!h)
      return {
        art: 'ohneAutomatik',
        text: `Die Routine der Erinnerungen gibt es in ChurchTools nicht mehr. ${NEU_EINRICHTEN}`,
      };
    if (h.teilnehmer.length > 0)
      return {
        art: 'gestoppt',
        text: `In der Hilfsgruppe stehen noch ${h.teilnehmer.length === 1 ? '1 Person' : `${h.teilnehmer.length} Personen`} (${namenText(h.teilnehmer)}) – Reste einer früheren Abfrage. Solange jemand drinsteht, werden die Schritte der Routine nicht ersetzt. Es wurde nichts verändert.`,
        nochmal: false,
        leeren: true,
      };
    rolle = h.rolle;
  } catch (err) {
    if (ist403(err))
      return {
        art: 'ohneAutomatik',
        text: 'Dir fehlen in ChurchTools die Rechte an der Hilfsgruppe.',
      };
    if (ist404(err))
      return {
        art: 'ohneAutomatik',
        text: `Die Hilfsgruppe gibt es in ChurchTools nicht mehr. ${NEU_EINRICHTEN}`,
      };
    const f = fehlerMeldung(err);
    return { art: 'gestoppt', text: f.text, nochmal: f.nochmal, leeren: false };
  }
  try {
    await a.port.schicken(`/routines/${e.routineId}`, 'PATCH', {
      isEnabled: true,
      steps: schritte,
    });
    const nachher = await routineLesen(a, e);
    const steps = nachher?.zeile.routine?.steps;
    const da = Array.isArray(steps)
      ? (steps as { actionKey?: unknown; actionData?: unknown }[]).map(kurz)
      : null;
    const soll = schritte.map(kurzSoll);
    if (!da || da.length !== soll.length || da.some((x, i) => x !== soll[i]))
      return {
        art: 'gestoppt',
        text: 'ChurchTools hat die Schritte der Routine nicht übernommen (nachgelesen steht etwas anderes da). Die Abfrage wurde nicht gestartet – bitte noch einmal versuchen.',
        nochmal: true,
        leeren: false,
      };
    return { art: 'bereit', rolle };
  } catch (err) {
    if (ist403(err))
      return {
        art: 'ohneAutomatik',
        text: 'Dir fehlen in ChurchTools die Rechte, die Routine der Hilfsgruppe zu ändern.',
      };
    if (ist404(err))
      return {
        art: 'ohneAutomatik',
        text: `Die Routine der Erinnerungen gibt es in ChurchTools nicht mehr. ${NEU_EINRICHTEN}`,
      };
    const f = fehlerMeldung(err);
    return {
      art: 'gestoppt',
      text: `${f.text} Die Abfrage wurde nicht gestartet.`,
      nochmal: f.nochmal,
      leeren: false,
    };
  }
}

// ── Start: (d) Mitglieder eintragen ─────────────────────────────────────────

export interface EintragenErgebnis {
  /** Nachgelesen: stehen als Teilnehmer in der Gruppe. */
  eingetragen: PersonNr[];
  /** Nachgelesen: stehen **nicht** als Teilnehmer da (Fehler beim Eintragen, oder die Mitgliederliste ist nicht lesbar). */
  fehlen: PersonNr[];
  /** Ein Planer-Leiter früherer Probe-Einrichtungen steht nicht als Teilnehmer da: ChurchTools lehnt ein zweites Mal ab. */
  alsLeiter: PersonNr[];
  /** Die Mitgliederliste ließ sich nicht nachlesen – dann ist offen, wer drinsteht. */
  unklar: boolean;
}

/**
 * **Stufe (d):** Die Personen als **Teilnehmer** eintragen (ein Lauf je Mitgliedschaft startet sofort) und die Mitgliederliste
 * **nachlesen**. Ein Fehler bei einer Person stoppt nicht die anderen. Wer nachgelesen nicht drinsteht, steht in `fehlen`.
 * Wer schon als anderes Mitglied (Leiter) drinsteht, wird nie umgestellt.
 */
export async function eintragen(
  a: AutomatikAnschluss,
  e: Einrichtung,
  rolle: number,
  personen: readonly PersonNr[],
): Promise<EintragenErgebnis> {
  for (const p of personen) {
    try {
      await a.mitgliedAnlegen(e.gruppeId, p.id, {
        groupTypeRoleId: rolle,
        groupMemberStatus: 'active',
      });
    } catch {
      // Einzeln beurteilt wird nachgelesen – ein Fehler hier heißt nicht, dass es nicht ankam (und umgekehrt).
    }
  }
  try {
    const m = mitgliederAus(await a.port.liste<RohMitglied>(mitgliederPfad(e.gruppeId)));
    const alsTeilnehmer = new Set(
      m.mitglieder.filter((x) => x.rolleId === rolle).map((x) => x.personId),
    );
    const anders = new Set(m.mitglieder.filter((x) => x.rolleId !== rolle).map((x) => x.personId));
    return {
      eingetragen: personen.filter((p) => alsTeilnehmer.has(p.id)),
      fehlen: personen.filter((p) => !alsTeilnehmer.has(p.id)),
      alsLeiter: personen.filter((p) => !alsTeilnehmer.has(p.id) && anders.has(p.id)),
      unklar: false,
    };
  } catch {
    return { eingetragen: [], fehlen: [...personen], alsLeiter: [], unklar: true };
  }
}

/** Der Satz zum Ergebnis von (d) – ehrlich: wer drinsteht, wer fehlt. */
export function eintragenText(r: EintragenErgebnis, gesamt: number): string | null {
  if (r.unklar)
    return 'Es ließ sich nicht nachlesen, wer in der Hilfsgruppe steht. Die Abfrage läuft; „Fehlende nachtragen“ trägt ein, wer noch fehlt.';
  if (r.fehlen.length === 0)
    return gesamt === 0
      ? null
      : `${r.eingetragen.length === 1 ? '1 Person' : `${r.eingetragen.length} Personen`} bekommen Erinnerungen.`;
  const zusatz =
    r.alsLeiter.length > 0
      ? ` (${namenText(r.alsLeiter)} ${r.alsLeiter.length === 1 ? 'steht' : 'stehen'} als Leiter in der Gruppe und ${r.alsLeiter.length === 1 ? 'wird' : 'werden'} nicht umgestellt)`
      : '';
  return `Die Abfrage läuft. Eingetragen sind ${r.eingetragen.length} von ${gesamt}; es fehlen: ${namenText(r.fehlen)}${zusatz}.`;
}

/**
 * **„Fehlende nachtragen“:** trägt genau die ein, die beim Start nachgelesen nicht ankamen (nie neu gerechnet – wer sich selbst
 * ausgetragen hat, hat sich gegen Erinnerungen entschieden). Der Aufrufer erlaubt es nur am Starttag: ChurchTools holte an einem
 * späteren Tag die vergangenen Warte-Tage nach (mehrere Mails auf einmal).
 */
export async function fehlendeNachtragen(
  a: AutomatikAnschluss,
  e: Einrichtung,
  personen: readonly PersonNr[],
): Promise<EintragenErgebnis | { art: 'fehler'; text: string }> {
  let rolle: number;
  try {
    const r = await routineLesen(a, e);
    if (!r)
      return {
        art: 'fehler',
        text: 'Die Routine der Erinnerungen ist in ChurchTools nicht mehr zu finden – es wurde niemand eingetragen.',
      };
    rolle = r.rolle;
  } catch (err) {
    return { art: 'fehler', text: fehlerMeldung(err).text };
  }
  return eintragen(a, e, rolle, personen);
}

// ── Austragen: Leeren, Beenden, Abgleich, Austritt ──────────────────────────

/** Alle Teilnehmer austragen und nachlesen. `rest`: wer nachgelesen noch drinsteht. */
async function austragen(
  a: AutomatikAnschluss,
  e: Einrichtung,
  rolle: number,
  wer: readonly PersonNr[],
): Promise<{ weg: number; rest: PersonNr[] }> {
  for (const p of wer) {
    try {
      await a.mitgliedEntfernen(e.gruppeId, p.id);
    } catch {
      // nachgelesen wird gleich – ein einzelner Fehler stoppt die anderen nicht
    }
  }
  const jetzt = new Set((await teilnehmerLesen(a, e.gruppeId, rolle)).map((p) => p.id));
  const rest = wer.filter((p) => jetzt.has(p.id));
  return { weg: wer.length - rest.length, rest: [...rest] };
}

export type LeerenErgebnis =
  | { art: 'leer'; ausgetragen: number }
  | { art: 'rest'; text: string }
  | { art: 'fehler'; text: string };

/**
 * **Die Hilfsgruppe leeren** (Knopf „Gruppe leeren“, auch Teil von „Abfrage beenden“): alle Teilnehmer austragen, nachlesen.
 * Ohne Lesen nichts austragen; steht danach noch jemand da, ist es **kein** Erfolg.
 */
export async function gruppeLeeren(a: AutomatikAnschluss, e: Einrichtung): Promise<LeerenErgebnis> {
  try {
    const h = await hilfsgruppeLesen(a, e);
    // Ohne Routine kommt keine Mail mehr – es gibt nichts auszutragen, und das Beenden darf nicht daran hängen.
    if (!h) return { art: 'leer', ausgetragen: 0 };
    const r = await austragen(a, e, h.rolle, h.teilnehmer);
    return r.rest.length === 0
      ? { art: 'leer', ausgetragen: r.weg }
      : {
          art: 'rest',
          text: `Aus der Hilfsgruppe konnten nicht ausgetragen werden: ${namenText(r.rest)}.`,
        };
  } catch (err) {
    // Die Hilfsgruppe gibt es nicht mehr (404): nichts auszutragen. Jeder andere Fehler – auch ein Aussetzer – hält das Beenden auf.
    if (ist404(err)) return { art: 'leer', ausgetragen: 0 };
    return { art: 'fehler', text: fehlerMeldung(err).text };
  }
}

export type AbgleichErgebnis = { art: 'ok'; ausgetragen: number; drin: number } | { art: 'fehler' };

/**
 * **Der Abgleich beim Planer** (Stand-Fenster, beim Öffnen): Wer in der Hilfsgruppe steht, aber laut `fehlendeInGruppe` nicht
 * mehr offen ist (beantwortet, eingeteilt, pausiert), wird **ausgetragen**; **nie eingetragen** (Nachzügler-Entscheidung).
 * `offen` kommt aus einem **vollständig gelesenen** Ergebnis – der Aufrufer ruft nur dann auf. Lesefehler: nichts austragen.
 */
export async function abgleichen(
  a: AutomatikAnschluss,
  e: Einrichtung,
  offen: ReadonlySet<number>,
): Promise<AbgleichErgebnis> {
  try {
    const h = await hilfsgruppeLesen(a, e);
    if (!h) return { art: 'fehler' };
    const zuviel = h.teilnehmer.filter((p) => !offen.has(p.id));
    if (zuviel.length === 0) return { art: 'ok', ausgetragen: 0, drin: h.teilnehmer.length };
    const r = await austragen(a, e, h.rolle, zuviel);
    return { art: 'ok', ausgetragen: r.weg, drin: h.teilnehmer.length - r.weg };
  } catch {
    return { art: 'fehler' };
  }
}

export type AustrittErgebnis = 'ausgetragen' | 'nichts' | 'fehler';

/**
 * **Austritt beim Antworten** (Mitarbeitende): Ist man Mitglied der Hilfsgruppe (und nicht Leiter), trägt man sich selbst aus
 * (`DELETE`, nachgelesen). Der Aufrufer ruft nur auf, wenn der Stand **sicher** „nichts mehr offen“ ist. Fehler **leise** –
 * es gibt keinen Wiederhol-Takt, das nächste Speichern oder Laden versucht es wieder; nichts wird zerstört.
 */
export async function austretenWennFertig(
  a: AutomatikAnschluss,
  e: Einrichtung,
  ichId: number,
): Promise<AustrittErgebnis> {
  // Gemessen (Test-Instanz, 25.11.2026): Wer NICHT (mehr) Mitglied der Hilfsgruppe ist, sieht sie nicht – das Lesen der eigenen
  // Mitgliedschaft antwortet dann mit **403**, nicht 404. Für die eigene Mitgliedschaft heißt 403 hier also „nicht drin“.
  const eigene = async (): Promise<RohMitglied | null> => {
    try {
      return (await a.mitgliedOderNichts(e.gruppeId, ichId)) as RohMitglied | null;
    } catch (err) {
      if (ist403(err)) return null;
      throw err;
    }
  };
  try {
    const m = await eigene();
    if (m === null || m.groupMemberStatus !== 'active' || m.memberEndDate) return 'nichts';
    // Leiter früherer Probe-Einrichtungen trägt niemand aus (die Routine hängt am Teilnehmer).
    // Mitarbeitende dürfen die Rollen lesen (gemessen 25.11.2026) – die Prüfung darf den Austritt trotzdem nie verhindern.
    const rolleId = ctId(m.groupTypeRoleId);
    try {
      const rollen = rollenAus(await listeHolen(a.port, '/group/roles', 'Die Rollen'));
      if (rolleId !== null && istLeitung(rollen, rolleId)) return 'nichts';
    } catch {
      // weiter: Leiter gibt es nur aus Probe-Einrichtungen der Test-Instanz
    }
    await a.mitgliedEntfernen(e.gruppeId, ichId);
    return (await eigene()) === null ? 'ausgetragen' : 'fehler';
  } catch {
    return 'fehler';
  }
}
