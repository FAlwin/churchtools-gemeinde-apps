import { vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import type { Einrichtung } from '@shared/dienstplan/abfragen';
import type { AutomatikAnschluss } from './abfrageAutomatikLauf';

/**
 * **Eine nachgebaute Hilfsgruppe** für die Tests der Automatik (R-5b): Mitglieder mit Rollen, eine Routine mit Schritten,
 * ein Protokoll aller schreibenden Aufrufe und Störungen, die man einzeln auslösen kann. Das Protokoll (`log`) enthält nur
 * Schreibendes – `PATCH /routines/60`, `PUT /groups/50/members/5`, `DELETE /groups/50/members/5`.
 */
export const GRUPPE = 50;
export const ROUTINE = 60;
export const R_TEILNEHMER = 52;
export const R_LEITER = 55;
export const EINR: Einrichtung = { gruppeId: GRUPPE, routineId: ROUTINE };

export interface WeltMitglied {
  person: number;
  rolle: number;
  name?: string;
}

export interface Stoerung {
  /** Dieser Aufruf (`METHODE pfad`) wirft – immer, bis es entfernt wird. */
  wirft?: Record<string, Error>;
  /** ChurchTools sagt 200 und übernimmt die Schritte nicht. */
  schluckeSchritte?: boolean;
  /** `PUT …/members/{p}` meldet Erfolg, trägt aber nicht ein. Personen-IDs. */
  tragNichtEin?: Set<number>;
  /** `DELETE …/members/{p}` meldet Erfolg, trägt aber nicht aus. Personen-IDs. */
  tragNichtAus?: Set<number>;
  /**
   * Wie ChurchTools für Mitarbeitende (gemessen 25.11.2026): Wer nicht Mitglied ist, sieht die Hilfsgruppe nicht – das Lesen
   * der eigenen Mitgliedschaft antwortet mit 403 statt 404.
   */
  nichtMitglied403?: boolean;
}

export function hilfsgruppe(
  o: { mitglieder?: WeltMitglied[]; routineVorhanden?: boolean; schritte?: unknown[] } = {},
) {
  const w = {
    mitglieder: [...(o.mitglieder ?? [])],
    schritte: (o.schritte ?? []) as { actionKey: string; actionData: unknown }[],
    routineVorhanden: o.routineVorhanden ?? true,
    log: [] as string[],
    /** Die Rümpfe der `PATCH /routines/…` – zum Nachsehen, was geschickt wurde. */
    patches: [] as unknown[],
    stoerung: {} as Stoerung,
  };
  const pruefe = (methode: string, pfad: string) => {
    if (methode !== 'GET') w.log.push(`${methode} ${pfad}`);
    const f = w.stoerung.wirft?.[`${methode} ${pfad}`];
    if (f !== undefined) throw f;
  };
  const roh = (m: WeltMitglied) => ({
    personId: m.person,
    person: { title: m.name ?? `Person ${m.person}` },
    groupTypeRoleId: m.rolle,
    groupMemberStatus: 'active',
  });
  const port: AutomatikAnschluss['port'] = {
    holen<T>(pfad: string): Promise<T> {
      pruefe('GET', pfad);
      if (pfad === `/groups/${GRUPPE}/members/routines`)
        return Promise.resolve(
          (w.routineVorhanden
            ? [
                {
                  id: ROUTINE,
                  groupId: GRUPPE,
                  groupTypeRoleId: R_TEILNEHMER,
                  groupMemberStatus: 'active',
                  routine: {
                    name: 'Dienstplaner: Erinnerungen Musik',
                    isEnabled: true,
                    steps: w.schritte.map((s, i) => ({ id: 900 + i, ...s })),
                  },
                },
              ]
            : []) as T,
        );
      if (pfad === '/group/roles')
        return Promise.resolve([
          { id: R_TEILNEHMER, groupTypeId: 13, isLeader: false, isDefault: true },
          { id: R_LEITER, groupTypeId: 13, isLeader: true },
        ] as T);
      return Promise.reject(new Error(`unerwartet: GET ${pfad}`));
    },
    liste<T>(pfad: string): Promise<T[]> {
      pruefe('GET', pfad);
      if (pfad === `/groups/${GRUPPE}/members`)
        return Promise.resolve(w.mitglieder.map(roh) as T[]);
      return Promise.reject(new Error(`unerwartet: LISTE ${pfad}`));
    },
    schicken(pfad, methode, json): Promise<unknown> {
      pruefe(methode, pfad);
      if (methode === 'PATCH' && pfad === `/routines/${ROUTINE}`) {
        w.patches.push(json);
        if (!w.stoerung.schluckeSchritte)
          w.schritte = (json as { steps: typeof w.schritte }).steps.map((s) => ({
            actionKey: s.actionKey,
            actionData: s.actionData,
          }));
        return Promise.resolve({});
      }
      return Promise.reject(new Error(`unerwartet: ${methode} ${pfad}`));
    },
  };
  const a: AutomatikAnschluss = {
    port,
    mitgliedAnlegen: vi.fn(
      (
        gruppe: number,
        person: number,
        angaben: Parameters<AutomatikAnschluss['mitgliedAnlegen']>[2],
      ) => {
        pruefe('PUT', `/groups/${gruppe}/members/${person}`);
        if (w.mitglieder.some((m) => m.person === person))
          return Promise.reject(new ApiError(403, 'member.add.already-in-group'));
        if (!w.stoerung.tragNichtEin?.has(person))
          w.mitglieder.push({ person, rolle: Number(angaben.groupTypeRoleId) });
        return Promise.resolve();
      },
    ),
    mitgliedEntfernen: vi.fn((gruppe: number, person: number) => {
      pruefe('DELETE', `/groups/${gruppe}/members/${person}`);
      if (!w.stoerung.tragNichtAus?.has(person))
        w.mitglieder = w.mitglieder.filter((m) => m.person !== person);
      return Promise.resolve();
    }),
    mitgliedOderNichts: vi.fn((_gruppe: number, person: number) => {
      pruefe('GET', `/groups/${_gruppe}/members/${person}`);
      const m = w.mitglieder.find((x) => x.person === person);
      if (!m && w.stoerung.nichtMitglied403) return Promise.reject(new ApiError(403, 'verboten'));
      return Promise.resolve(m ? roh(m) : null);
    }),
  };
  return { w, a };
}
