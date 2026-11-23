/**
 * **Einen Kalendertermin anlegen – oder nach unklarer Antwort finden.** Der gemeinsame Kern für „Nächste Sitzung
 * festlegen“ (`planen.ts`, mit Besprechungsanfrage) und „In Kalender eintragen“ (W14, `terminEintragen.ts`, ohne
 * Einladung). Bis W14 stand er nur in `planen.ts`; eine Kopie für den Reiter „Termine“ hätte die Regeln zweimal
 * gepflegt (Regel-Dopplung).
 *
 * - **ChurchTools lehnt ausdrücklich ab** (`abgelehnt`: fehlendes Recht oder ein anderes 4xx) → nichts ist angelegt, der
 *   Fehler geht weiter.
 * - **Antwort unklar** (Netz, Zeitgrenze, 5xx, Proxy-403, 201 ohne ID) → im Kalender nachsehen, ob der Termin doch da
 *   ist (`terminSuchen`). Nur wenn auch das scheitert oder nichts findet, ist es `Unklar` – ein zweiter Versuch könnte
 *   sonst doppelt anlegen (beim Festlegen einer Sitzung zusätzlich: doppelt einladen).
 * - **Ganztägig** (`ganztaegig`): `beginn`/`ende` sind `JJJJ-MM-TT` ohne Uhrzeit und `allDay: true` – so liefert
 *   ChurchTools ganztägige Termine (gemessen in den Anmeldungen, `shared/anmeldung/termin.ts`). Am echten Anlegen
 *   bestätigt erst der Handtest TF-PROT-31.
 */
import { tagAusIso } from '@shared/ct/zeit';
import { terminPfad, type TerminRoh } from '@shared/ct/kalenderTermine';
import { minute } from '@shared/protokolle/sitzungen';
import { buchungRumpf } from '@shared/protokolle/terminRessourcen';
import type { TerminZusatz } from '@shared/protokolle/terminFelder';
import { ApiError, Unklar } from '@ui/ct/fehler';
import { ctAnfrage, ctDaten, KeinSpeicherRecht } from '@ui/ct/verbindung';

/**
 * ChurchTools hat ausdrücklich abgelehnt – dann ist nichts angelegt: fehlendes Recht (`KeinSpeicherRecht`) oder ein
 * anderes 4xx. Ein 403 ohne ChurchTools-Rumpf (Proxy) und eine Zeitgrenze sind dagegen unklar (`fehlerAus`). Die eine
 * Stelle dafür – auch für „Sitzung bearbeiten“ (K2b, `bearbeiten.ts`) und den Beitrag.
 */
export const abgelehnt = (e: unknown): boolean =>
  e instanceof KeinSpeicherRecht ||
  (e instanceof ApiError &&
    e.status >= 400 &&
    e.status < 500 &&
    e.status !== 403 &&
    e.status !== 408);

/** Nach einer Sitzung mit Einladungen: wer es noch einmal versucht, lädt alle doppelt ein. */
export const UNKLAR =
  'ChurchTools hat nicht geantwortet – ob der Termin angelegt wurde, ist unklar. Bitte erst im Kalender nachsehen, bevor du es noch einmal versuchst, sonst bekommen alle die Einladung doppelt.';

/** Dasselbe ohne Einladungen (W14). */
export const UNKLAR_OHNE_EINLADUNG =
  'ChurchTools hat nicht geantwortet – ob der Termin angelegt wurde, ist unklar. Bitte erst im Kalender nachsehen, bevor du es noch einmal versuchst, sonst steht er doppelt darin.';

/** Termine eines Tages im Kalender (Titel, Beginn; ganztägig nur der Tag). */
async function termineAmTag(kalender: number, tag: string): Promise<TerminRoh[]> {
  return (await ctDaten<TerminRoh[]>(terminPfad(kalender, tag, tag))) ?? [];
}

/** Ein Termin im Kalender an diesem Tag mit diesem Titel und Beginn – nach einer unklaren Antwort. */
async function terminSuchen(q: {
  kalender: number;
  titel: string;
  beginn: string;
  zeitzone: string;
  ganztaegig: boolean;
}): Promise<number | null> {
  const tag = q.ganztaegig ? q.beginn.slice(0, 10) : tagAusIso(q.beginn, q.zeitzone);
  const t = (await termineAmTag(q.kalender, tag)).find((r) => {
    if (r.base?.title !== q.titel) return false;
    const start = r.calculated?.startDate;
    if (start === undefined) return false;
    return q.ganztaegig ? start.slice(0, 10) === tag : minute(start) === minute(q.beginn);
  });
  return t?.base?.id ?? null;
}

export interface TerminAnlegenFrage extends TerminZusatz {
  kalender: number;
  titel: string;
  /** UTC (`…Z`), bei `ganztaegig` der Tag `JJJJ-MM-TT`. */
  beginn: string;
  ende: string;
  zeitzone: string;
  ganztaegig?: boolean;
  /** Mit Besprechungsanfrage (Sitzung) – fehlt es, geht keine Einladung raus (W14). */
  eingeladen?: readonly number[];
  /** Meldung bei unklarer Antwort; Standard: `UNKLAR`. */
  unklar?: string;
}

/** Der Rumpf für `POST /calendars/{id}/appointments` – eine Stelle, damit Tests gegen sie laufen, nicht gegen Literale. */
export function terminRumpf(q: TerminAnlegenFrage): Record<string, unknown> {
  return {
    calendarId: q.kalender,
    title: q.titel,
    startDate: q.beginn,
    endDate: q.ende,
    isInternal: q.intern ?? false,
    ...(q.untertitel ? { subtitle: q.untertitel } : {}),
    ...(q.beschreibung ? { description: q.beschreibung } : {}),
    ...(q.link ? { link: q.link } : {}),
    // Ganztägig: reiner Tag UND `allDay` – die Anmeldungen haben `allDay` am gelesenen Termin gemessen
    // (`shared/anmeldung/termin.ts`); ohne das Feld könnte ChurchTools 0:00 Uhr annehmen.
    ...(q.ganztaegig ? { allDay: true } : {}),
    // Die Adresse heißt in ChurchTools `name` – `meetingAt` ist veraltet (gemessen 23.11.2026, W15-0).
    ...(q.adresse && Object.keys(q.adresse).length ? { address: q.adresse } : {}),
    ...(q.wiederholung
      ? {
          repeatId: q.wiederholung.art,
          ...(q.wiederholung.frequenz !== undefined
            ? { repeatFrequency: q.wiederholung.frequenz }
            : {}),
          ...(q.wiederholung.option !== undefined ? { repeatOption: q.wiederholung.option } : {}),
          ...(q.wiederholung.bis ? { repeatUntil: q.wiederholung.bis } : {}),
        }
      : {}),
    ...(q.weitere?.length
      ? { additionals: q.weitere.map((date) => ({ date, isRepeated: false })) }
      : {}),
    ...(q.ausnahmen?.length ? { exceptions: q.ausnahmen.map((date) => ({ date })) } : {}),
    ...(q.imAuftrag != null ? { onBehalfOfPid: q.imAuftrag } : {}),
    ...(q.tags?.length ? { tags: q.tags } : {}),
    // Ressourcen (W15-2): ChurchTools legt die Buchungen mit dem Termin an – die Antwort zeigt sie NICHT; erst
    // `buchungenLesen` belegt, dass sie da sind.
    ...(q.buchungen?.length ? { bookings: q.buchungen.map(buchungRumpf) } : {}),
    ...(q.informieren !== undefined ? { informOwner: q.informieren } : {}),
    ...(q.eingeladen ? { meetingrequests: q.eingeladen.map((inviteeId) => ({ inviteeId })) } : {}),
  };
}

/** Termin anlegen – oder nach unklarer Antwort finden. Gibt die Nummer des Termins zurück. */
export async function terminAnlegen(q: TerminAnlegenFrage): Promise<number> {
  let id: number | null = null;
  try {
    const neu = await ctAnfrage<{ data?: { id?: unknown } }>(
      `/calendars/${q.kalender}/appointments`,
      {
        method: 'POST',
        body: JSON.stringify(terminRumpf(q)),
        verweigert: 'Du darfst in diesem Kalender keine Termine anlegen.',
      },
    );
    if (typeof neu?.data?.id === 'number') id = neu.data.id;
  } catch (e) {
    if (abgelehnt(e)) throw e;
  }
  if (id === null) {
    try {
      id = await terminSuchen({ ...q, ganztaegig: q.ganztaegig === true });
    } catch {
      throw new Unklar(q.unklar ?? UNKLAR);
    }
    if (id === null) throw new Unklar(q.unklar ?? UNKLAR);
  }
  return id;
}

/** Die Termine eines Tages in einem Kalender als Titel/Beginn – für „steht schon da?“ (W14). Wirft bei jedem Fehler. */
export async function kalenderTermineAmTag(
  kalender: number,
  tag: string,
): Promise<{ id: number; titel: string; beginn: string }[]> {
  return (await termineAmTag(kalender, tag)).flatMap((r) => {
    const base = r.base ?? r.appointment?.base;
    const id = base?.id;
    if (typeof id !== 'number') return [];
    return [{ id, titel: base?.title ?? '', beginn: r.calculated?.startDate ?? '' }];
  });
}
