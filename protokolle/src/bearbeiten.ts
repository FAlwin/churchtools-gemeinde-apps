/**
 * **Eine Sitzung bearbeiten und absagen** (Bauplan K2b-1) – schreibt bei ChurchTools: Kalendertermin, Einladungen,
 * Gruppentreffen und den Kopf des Protokolls. Die Regeln stehen in `@shared/protokolle/bearbeiten`. Gemessen:
 * `protokolle-planung/docs/messung-k2b-2026-10-29.md`. Serien kommen mit K2b-2 – hier wird ein Serientermin abgewiesen,
 * bevor etwas geschrieben ist (ein `DELETE` träfe sonst die ganze Serie).
 *
 * Reihenfolge wie beim Festlegen (S5-2): erst der **Termin** (dort entstehen die Mails), dann Einladungen, Treffen, Kopf.
 * Lehnt ChurchTools den Termin ab, ist nichts passiert → Fehler. Ist die Antwort unklar, wird nachgelesen; ein zweiter
 * Versuch ist dabei harmlos (gleicher Stand = keine Mail, gemessen M6f; ein gelöschter Termin → 404). Was **danach**
 * scheitert, wird ein **Hinweis** – der Termin steht schon, die Mails sind raus. Nie zurückrollen.
 */
import { werteLesen, wertAendern, wertLoeschen } from '@shared/ct/modulDaten';
import {
  aenderungVon,
  kopfNachAbsage,
  terminRumpf,
  terminSperre,
  type TerminRoh,
} from '@shared/protokolle/bearbeiten';
import { minute, type Sitzung } from '@shared/protokolle/sitzungen';
import { sitzungAusWerten } from '@shared/protokolle/speicher';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { modulPort } from '@ui/ct/modulPort';
import { ctAnfrage, ctDaten, KeinSpeicherRecht } from '@ui/ct/verbindung';
import { abgelehnt } from './planen';

const json = (body: unknown) => JSON.stringify(body);
const VERWEIGERT_TERMIN = 'Du darfst in diesem Kalender keine Termine ändern.';
const VERWEIGERT_PROTOKOLL = 'Du darfst in dieser Gruppe keine Protokolle ändern.';

export const SERIE =
  'Diese Sitzung gehört zu einer Terminserie. Serien lassen sich hier noch nicht ändern – bitte in ChurchTools.';
export const ANMELDUNG =
  'An diesem Termin hängt eine Anmeldung. Er lässt sich hier nicht ändern – bitte in ChurchTools.';

/** Der Termin, wie ChurchTools ihn hat – für den Rumpf des `PUT` und um Serien zu erkennen. */
export async function terminLaden(termin: { kalender: number; id: number }): Promise<TerminRoh> {
  const d = await ctDaten<{ appointment?: TerminRoh }>(
    `/calendars/${termin.kalender}/appointments/${termin.id}`,
  );
  if (!d?.appointment) throw new NichtUebernommen('den Termin');
  return d.appointment;
}

/** Serie oder Anmeldung → eine Meldung, die sagt, warum nicht (`ApiError` 409: kein „Erneut versuchen“-Fall). */
function pruefeSperre(t: TerminRoh): void {
  const sperre = terminSperre(t);
  if (sperre) throw new ApiError(409, sperre === 'serie' ? SERIE : ANMELDUNG);
}

interface AnfrageRoh {
  id?: number;
  person?: { domainIdentifier?: string };
  inviteeId?: number;
}

const anfragenLesen = async (t: { kalender: number; id: number }) =>
  (
    (await ctDaten<AnfrageRoh[]>(
      `/calendars/${t.kalender}/appointments/${t.id}/meetingrequests`,
    )) ?? []
  ).map((a) => ({ id: a.id, person: Number(a.person?.domainIdentifier ?? a.inviteeId) }));

/** Den Kopf frisch lesen, ändern, nachlesen. `null` = es gibt ihn nicht (mehr). */
async function kopfSchreiben(
  q: { modul: number; kategorie: number; sitzung: string },
  aendern: (k: NonNullable<Sitzung['kopf']>) => NonNullable<Sitzung['kopf']> | 'loeschen' | null,
): Promise<void> {
  const lesen = async () =>
    sitzungAusWerten(await werteLesen(modulPort, q.modul, q.kategorie), q.sitzung).kopf;
  const kopf = await lesen();
  if (!kopf) return;
  const neu = aendern(kopf.inhalt);
  if (neu === null) return;
  if (neu === 'loeschen') {
    await wertLoeschen(modulPort, q.modul, q.kategorie, kopf.id, VERWEIGERT_PROTOKOLL);
    if (await lesen()) throw new NichtUebernommen('das Entfernen der geplanten Sitzung');
    return;
  }
  await wertAendern(modulPort, q.modul, q.kategorie, kopf.id, json(neu), VERWEIGERT_PROTOKOLL);
  const nach = (await lesen())?.inhalt;
  if (
    !nach ||
    nach.titel !== neu.titel ||
    nach.beginn !== neu.beginn ||
    nach.termin?.id !== neu.termin?.id ||
    nach.treffen !== neu.treffen
  )
    throw new NichtUebernommen('die Änderung am Protokoll');
}

export interface Bearbeitet {
  /** Was nicht geklappt hat – der Termin ist trotzdem geändert. */
  hinweise: string[];
}

/**
 * **Sitzung ändern:** Titel, Zeit, Eingeladene. `nachher` = alle, die danach eingeladen sein sollen (auch solche, die das
 * Fenster nicht als Mitglied kennt). `neuEinladen` gilt nur, wenn sich die Zeit ändert: Dann geht der Termin **mit**
 * Einladungsliste an ChurchTools – Zusagen zurück, eine Mail „Termin geändert“ je Person. Sonst ohne Liste (still), und
 * Ein-/Ausladen einzeln (Mail nur an die Betroffenen).
 */
export async function sitzungAendern(q: {
  modul: number;
  /** Kategorie „Protokolle“ der Gruppe. */
  kategorie: number;
  gruppe: number;
  sitzung: Sitzung;
  neu: { titel: string; beginn: string; ende: string };
  nachher: readonly number[];
  neuEinladen: boolean;
}): Promise<Bearbeitet> {
  const s = q.sitzung;
  const neu = { ...q.neu, titel: q.neu.titel.trim() };
  const a = aenderungVon({
    alt: { titel: s.titel, beginn: s.beginn, ...(s.ende ? { ende: s.ende } : {}) },
    neu,
    vorher: s.anfragen.map((x) => x.person),
    nachher: q.nachher,
  });
  const hinweise: string[] = [];
  const mitListe = !!s.termin && a.zeit && q.neuEinladen;

  // 1. Termin – vorher lesen (Rumpf, Serie?), dann `PUT`, dann nachlesen.
  if (s.termin && (a.titel || a.zeit)) {
    const t = await terminLaden(s.termin);
    pruefeSperre(t);
    try {
      await ctAnfrage(`/calendars/${s.termin.kalender}/appointments/${s.termin.id}`, {
        method: 'PUT',
        body: json(terminRumpf(t, neu, mitListe ? q.nachher : undefined)),
        verweigert: VERWEIGERT_TERMIN,
      });
    } catch (e) {
      if (abgelehnt(e)) throw e;
    }
    const nach = await terminLaden(s.termin);
    if (
      nach.title !== neu.titel ||
      typeof nach.startDate !== 'string' ||
      minute(nach.startDate) !== minute(neu.beginn) ||
      typeof nach.endDate !== 'string' ||
      minute(nach.endDate) !== minute(neu.ende)
    )
      throw new NichtUebernommen('die Änderung am Termin');
  }

  // 2. Einladungen einzeln – nur ohne Liste (mit Liste hat ChurchTools sie schon). Danach einmal nachlesen.
  if (s.termin && (a.dazu.length || a.weg.length)) {
    const termin = s.termin;
    const pfad = `/calendars/${termin.kalender}/appointments/${termin.id}/meetingrequests`;
    if (!mitListe) {
      const da = a.weg.length ? await anfragenLesen(termin).catch(() => []) : [];
      for (const p of a.weg) {
        const id = da.find((x) => x.person === p)?.id;
        if (id !== undefined)
          await ctAnfrage(`${pfad}/${id}`, {
            method: 'DELETE',
            verweigert: VERWEIGERT_TERMIN,
          }).catch(() => undefined);
      }
      for (const p of a.dazu)
        await ctAnfrage(pfad, {
          method: 'POST',
          body: json({ inviteeId: p }),
          verweigert: VERWEIGERT_TERMIN,
        }).catch(() => undefined);
    }
    try {
      const jetzt = new Set((await anfragenLesen(termin)).map((x) => x.person));
      const fehlt = a.dazu.filter((p) => !jetzt.has(p)).length;
      const bleibt = a.weg.filter((p) => jetzt.has(p)).length;
      if (fehlt)
        hinweise.push(
          `${fehlt === 1 ? 'Eine Person wurde' : `${fehlt} Personen wurden`} nicht eingeladen – das lässt sich am Termin in ChurchTools nachholen.`,
        );
      if (bleibt)
        hinweise.push(
          `${bleibt === 1 ? 'Eine Person ist' : `${bleibt} Personen sind`} noch eingeladen – bitte am Termin in ChurchTools entfernen.`,
        );
    } catch {
      hinweise.push(
        'Ob die Einladungen stimmen, ließ sich nicht nachlesen – bitte am Termin in ChurchTools ansehen.',
      );
    }
  }

  // 3. Gruppentreffen mitziehen – ChurchTools leert, was im `PUT` fehlt (Kommentar, Gäste, Rückmeldung).
  if (s.treffen !== null && a.zeit) {
    try {
      const pfad = `/groups/${q.gruppe}/meetings/${s.treffen}`;
      const d = await ctDaten<Record<string, unknown>>(pfad);
      await ctAnfrage(pfad, {
        method: 'PUT',
        body: json({
          startDate: neu.beginn,
          isCompleted: d?.isCompleted ?? false,
          isCanceled: d?.isCanceled ?? false,
          comment: d?.comment ?? null,
          numGuests: d?.numGuests ?? null,
          pollResult: d?.pollResult ?? null,
        }),
      });
      const nach = await ctDaten<{ startDate?: string }>(pfad);
      if (!nach?.startDate || minute(nach.startDate) !== minute(neu.beginn))
        throw new NichtUebernommen('das Gruppentreffen');
    } catch (e) {
      hinweise.push(
        e instanceof KeinSpeicherRecht
          ? 'Das Gruppentreffen steht noch auf der alten Zeit – dir fehlt in ChurchTools das Recht, Gruppentreffen zu pflegen.'
          : 'Das Gruppentreffen steht noch auf der alten Zeit (ChurchTools hat nicht geantwortet) – bitte in ChurchTools verschieben.',
      );
    }
  }

  // 4. Kopf – Titel und Beginn; der Rest (Sperre, Stand) bleibt, wie er frisch gelesen wird.
  if (s.kopf && (a.titel || a.zeit)) {
    try {
      await kopfSchreiben(
        { modul: q.modul, kategorie: q.kategorie, sitzung: s.kopf.sitzung },
        (k) => ({
          ...k,
          titel: neu.titel,
          beginn: neu.beginn,
        }),
      );
    } catch {
      hinweise.push(
        'Im Protokoll stehen noch der alte Titel und die alte Zeit – bitte noch einmal speichern.',
      );
    }
  }
  return { hinweise };
}

/**
 * **Sitzung absagen:** Termin löschen (Mail „Termin gelöscht“ an jeden Eingeladenen), Treffen löschen, und das Protokoll:
 * ein geplantes verschwindet, ein begonnenes bleibt als Entwurf ohne Termin (`kopfNachAbsage`).
 */
export async function sitzungAbsagen(q: {
  modul: number;
  kategorie: number;
  gruppe: number;
  sitzung: Sitzung;
}): Promise<Bearbeitet> {
  const s = q.sitzung;
  const hinweise: string[] = [];

  // Ein schon gelöschter Termin (404 – etwa beim zweiten Versuch, nachdem nur der Kopf scheiterte) ist abgesagt.
  const weg = (e: unknown) => e instanceof ApiError && e.status === 404;
  let t: TerminRoh | null = null;
  if (s.termin)
    try {
      t = await terminLaden(s.termin);
    } catch (e) {
      if (!weg(e)) throw e;
    }
  if (s.termin && t) {
    const termin = s.termin;
    pruefeSperre(t);
    const pfad = `/calendars/${termin.kalender}/appointments/${termin.id}`;
    try {
      await ctAnfrage(pfad, { method: 'DELETE', verweigert: VERWEIGERT_TERMIN });
    } catch (e) {
      if (abgelehnt(e)) throw e;
    }
    // Nachlesen: weg ist weg (404). Steht er noch, war nichts – ein zweiter Versuch mailt nicht doppelt.
    let noch = true;
    try {
      await ctDaten(pfad);
    } catch (e) {
      if (weg(e)) noch = false;
      else throw e;
    }
    if (noch) throw new NichtUebernommen('die Absage');
  }

  if (s.treffen !== null) {
    try {
      await ctAnfrage(`/groups/${q.gruppe}/meetings/${s.treffen}`, { method: 'DELETE' });
    } catch (e) {
      if (!weg(e))
        hinweise.push(
          e instanceof KeinSpeicherRecht
            ? 'Das Gruppentreffen steht noch – dir fehlt in ChurchTools das Recht, Gruppentreffen zu pflegen.'
            : 'Das Gruppentreffen steht noch (ChurchTools hat nicht geantwortet) – bitte in ChurchTools löschen.',
        );
    }
  }

  if (s.kopf) {
    try {
      await kopfSchreiben(
        { modul: q.modul, kategorie: q.kategorie, sitzung: s.kopf.sitzung },
        kopfNachAbsage,
      );
    } catch {
      hinweise.push(
        s.kopf.status === 'geplant'
          ? 'Die geplante Sitzung steht noch in den Protokollen – sie verschwindet beim nächsten Absagen-Versuch.'
          : 'Das Protokoll ist noch mit dem gelöschten Termin verknüpft.',
      );
    }
  }
  return { hinweise };
}
