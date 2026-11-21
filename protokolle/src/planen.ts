/**
 * **Die nächste Sitzung festlegen** (Bauplan S5-2) – schreibt bei ChurchTools: Kalendertermin mit Besprechungsanfrage,
 * Gruppentreffen und den Kopf der geplanten Sitzung. Die Regeln (Vorbelegung, Zeitraum, Kopf) stehen in
 * `@shared/protokolle/planen`. Gemessen: `protokolle-planung/docs/messung-s5-2-2026-10-28.md`.
 *
 * Reihenfolge und Fehler:
 * 1. **Termin** – die Einladungen gehen dabei **sofort** per Mail raus. Lehnt ChurchTools ab (4xx), ist nichts passiert
 *    → Fehler. Ist die Antwort unklar (Netz, Zeitgrenze, 5xx, 201 ohne ID), wird im Kalender nachgesehen, ob der Termin
 *    doch da ist – sonst lüde ein zweiter Versuch alle noch einmal ein. Danach wird er nachgelesen (Beginn, Anfragen).
 * 2. **Gruppentreffen**, 3. **Kopf** („geplant“) – scheitert einer davon, bleibt der Termin stehen und es gibt einen
 *    **Hinweis**, keinen Fehler: **Nie zurückrollen** – einen Termin zu löschen schickt jedem Eingeladenen die Mail
 *    „Termin gelöscht“ (gemessen 28.10.2026, auch ohne Antwort), und ein zweiter Versuch lüde doppelt ein.
 */
import { werteLesen, wertAnlegen } from '@shared/ct/modulDaten';
import { plusTage } from '@shared/ct/datum';
import { tagAusIso } from '@shared/ct/zeit';
import { geplanterKopf } from '@shared/protokolle/planen';
import { minute } from '@shared/protokolle/sitzungen';
import { sitzungAusWerten } from '@shared/protokolle/speicher';
import { NichtUebernommen, Unklar } from '@ui/ct/fehler';
import { modulPort } from '@ui/ct/modulPort';
import { ctAnfrage, KeinSpeicherRecht } from '@ui/ct/verbindung';
import { treffenLesen } from './lesen';
import { abgelehnt, terminAnlegen, UNKLAR } from './terminAnlegen';
import { anfragenLesen, terminLaden } from './termin';

const json = (body: unknown) => JSON.stringify(body);

// Der Kern „Termin anlegen“ steht seit W14 in `terminAnlegen.ts` (auch für den Reiter „Termine“).
export { abgelehnt, UNKLAR };

/** Der Termin ist da, aber nicht sauber nachgelesen – dann nicht noch einmal festlegen (doppelte Einladung). */
export const NACHSEHEN =
  'Der Termin wurde angelegt, ließ sich aber nicht nachlesen. Bitte im Kalender nachsehen, statt ihn noch einmal festzulegen – sonst bekommen alle die Einladung doppelt.';

export interface Festgelegt {
  /** ID der geplanten Sitzung (Kopf) – `null`, wenn der Kopf nicht gespeichert werden konnte (dann gibt es einen Hinweis). */
  sitzung: string | null;
  termin: { kalender: number; id: number };
  treffen: number | null;
  /** Eingeladene, die ChurchTools nicht als eingeladen zurückgibt. */
  fehlend: number[];
  /** Was nicht geklappt hat – der Termin steht trotzdem. */
  hinweise: string[];
}

/**
 * 2. Gruppentreffen anlegen und nachlesen (gleiche Minute). Wirft bei jedem Fehler – hier macht der Aufrufer einen
 * Hinweis daraus; „Neues Protokoll“ (K2a) legt damit das Treffen für die Anwesenheit an.
 */
export async function treffenAnlegen(
  gruppe: number,
  beginn: string,
  ende: string,
  zeitzone: string,
): Promise<number> {
  let id: unknown = null;
  try {
    const neu = await ctAnfrage<{ data?: { id?: unknown } }>(`/groups/${gruppe}/meetings`, {
      method: 'POST',
      body: json({ startDate: beginn, endDate: ende }),
    });
    id = neu?.data?.id;
  } catch (e) {
    if (abgelehnt(e)) throw e;
  }
  // Nachlesen – auch nach einer unklaren Antwort: vielleicht ist es doch da. Mit derselben Abfrage wie „Kommend“ (ein Tag
  // Rand zu beiden Seiten, falls ChurchTools den Tag in UTC zählt); beim ersten Prüfen in der Test-Instanz fragte diese
  // Stelle `start_date` = `end_date` und fand das angelegte Treffen nie.
  const tag = tagAusIso(beginn, zeitzone);
  const liste = (await treffenLesen(gruppe, plusTage(tag, -1), plusTage(tag, 1))) ?? [];
  const da =
    liste.find((t) => t.id === id) ?? liste.find((t) => minute(t.beginn) === minute(beginn));
  if (!da) throw new NichtUebernommen('das Gruppentreffen');
  return da.id;
}

export async function sitzungFestlegen(q: {
  modul: number;
  /** Kategorie „Protokolle“ der Gruppe. */
  kategorie: number;
  gruppe: number;
  kalender: number;
  titel: string;
  /** Beginn und Ende in UTC (`zeitraum`). */
  beginn: string;
  ende: string;
  /** Personen-IDs; wer festlegt, darf dabei sein – ChurchTools trägt ihn gleich als zugesagt ein (keine Mail). */
  eingeladen: readonly number[];
  zeitzone: string;
  neueId?: () => string;
}): Promise<Festgelegt> {
  const titel = q.titel.trim();
  const hinweise: string[] = [];

  // 1. Termin – danach nachlesen: Beginn und wer eingeladen ist.
  const id = await terminAnlegen({ ...q, titel });
  const termin = { kalender: q.kalender, id };
  let fehlend: number[];
  try {
    const start = (await terminLaden(termin)).startDate;
    if (typeof start !== 'string' || minute(start) !== minute(q.beginn)) throw new Error('anders');
    const anfragen = q.eingeladen.length ? await anfragenLesen(termin) : [];
    const da = new Set(anfragen.map((a) => a.person));
    fehlend = q.eingeladen.filter((p) => !da.has(p));
  } catch {
    throw new Unklar(NACHSEHEN);
  }

  // 2. Gruppentreffen – Anwesenheit kommt später (S5-3).
  let treffen: number | null = null;
  try {
    treffen = await treffenAnlegen(q.gruppe, q.beginn, q.ende, q.zeitzone);
  } catch (e) {
    hinweise.push(
      e instanceof KeinSpeicherRecht
        ? 'Das Gruppentreffen wurde nicht angelegt – dir fehlt in ChurchTools das Recht, in dieser Gruppe Gruppentreffen zu pflegen. Der Termin steht.'
        : 'Das Gruppentreffen wurde nicht angelegt (ChurchTools hat nicht geantwortet). Der Termin steht; das Treffen lässt sich in ChurchTools nachtragen.',
    );
  }

  // 3. Kopf der geplanten Sitzung – verknüpft Termin und Treffen; nachgelesen.
  const sitzung = (q.neueId ?? (() => crypto.randomUUID()))();
  try {
    await wertAnlegen(
      modulPort,
      q.modul,
      q.kategorie,
      JSON.stringify(geplanterKopf({ titel, beginn: q.beginn, termin, treffen }, sitzung)),
      'Du darfst in dieser Gruppe keine Protokolle anlegen.',
    );
    const kopf = sitzungAusWerten(await werteLesen(modulPort, q.modul, q.kategorie), sitzung).kopf;
    if (kopf?.inhalt.status !== 'geplant') throw new NichtUebernommen('die geplante Sitzung');
    return { sitzung, termin, treffen, fehlend, hinweise };
  } catch {
    hinweise.push(
      'Die Sitzung steht im Kalender, ist aber in den Protokollen noch nicht vermerkt. Sie erscheint trotzdem unter „Kommend“, solange jemand eingeladen ist.',
    );
    return { sitzung: null, termin, treffen, fehlend, hinweise };
  }
}
