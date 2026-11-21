import { vi } from 'vitest';
import type { Vorschlag } from '@shared/dienstplan/vertretung';
import type { VertretungAnschluss, VertretungLage } from './ladeVertretung';
import type { OffeneVertretung, VertretungZugriff } from './useVertretung';
import {
  mailZiele,
  type AblaufErgebnis,
  type MailBericht,
  type VertretungsAuftrag,
} from './vertretungAblauf';

/** Eine Person aus dem Team, wie das Fenster sie zeigt. */
export const vorschlag = (
  personId: number,
  name: string,
  a: Vorschlag['a'] = null,
  notiz: string | null = null,
): Vorschlag => ({ personId, name, a, notiz });

/** Die Lage aus dem Entwurf: Ben und Finn Ja, Clara Vielleicht, David und Ella ohne Antwort; die Leitung ist Alwin. */
export const ENTWURFS_LAGE: Extract<VertretungLage, { art: 'da' }> = {
  art: 'da',
  vorschlaege: {
    art: 'liste',
    ja: [vorschlag(47, 'Ben Test', 'ja'), vorschlag(48, 'Finn Test', 'ja', 'nur bis 12 Uhr')],
    vielleicht: [vorschlag(49, 'Clara Test', 'vielleicht', 'falls niemand sonst kann')],
    ohne: [vorschlag(50, 'David Test'), vorschlag(51, 'Ella Test')],
  },
  leitung: [{ id: 1, name: 'Alwin Friesen', bild: null, initialen: 'AF' }],
  teamName: 'Lobpreisteam',
  abwesenheitenUnbekannt: false,
};

/** Ein Bericht, in dem alle Mails raus sind. */
export const alleMailsRaus = (ids: number[]): MailBericht => ({
  ziele: ids.map((personId) => ({
    personId,
    name: `Person ${personId}`,
    rolle: 'gefragt',
    antwort: null,
  })),
  ergebnisse: new Map(ids.map((id) => [id, { art: 'verschickt' as const }])),
  angehalten: null,
});

/** Der Anschluss mit Attrappen – `suchen` meldet standardmäßig „abgesagt, alle Mails raus“. */
export function anschlussAttrappe(extra: Partial<VertretungAnschluss> = {}): VertretungAnschluss {
  return {
    lage: vi.fn(() => Promise.resolve(ENTWURFS_LAGE)),
    // Wie der echte Ablauf: erst die Gefragten, dann die Leitung (`mailZiele`) – alle Mails raus.
    suchen: vi.fn((a: VertretungsAuftrag): Promise<AblaufErgebnis> => {
      const ziele = mailZiele(a);
      return Promise.resolve({
        art: 'abgesagt',
        mails: {
          ziele,
          ergebnisse: new Map(ziele.map((z) => [z.personId, { art: 'verschickt' as const }])),
          angehalten: null,
        },
      });
    }),
    erneut: vi.fn((_a, bisher) => Promise.resolve(bisher)),
    ...extra,
  };
}

/** Der Zustand für Startseite, „Dienste“ und Termin-Ansicht – nichts läuft, keine offenen Vertretungen. */
export function vertretungAttrappe(extra: Partial<VertretungZugriff> = {}): VertretungZugriff {
  return {
    anschluss: anschlussAttrappe(),
    ich: { id: 46, name: 'Anna Test' },
    geaendert: vi.fn(),
    offen: [],
    laeuft: () => false,
    fehler: () => null,
    uebernehmen: vi.fn(() => Promise.resolve()),
    meldung: null,
    ...extra,
  };
}

/** Eine gesuchte Vertretung auf der Startseite (mit ihrem Termin). */
export function offeneVertretung(
  termin: OffeneVertretung['termin'],
  extra: Partial<OffeneVertretung> = {},
): OffeneVertretung {
  return {
    personId: 46,
    name: 'Anna Test',
    terminId: termin.id,
    dienstId: 9,
    dienst: 'Gesang',
    gefragt: [47],
    gefragtNamen: ['Ben Test'],
    seit: '2026-11-21T10:00:00.000Z',
    index: 1,
    termin,
    ...extra,
  };
}
