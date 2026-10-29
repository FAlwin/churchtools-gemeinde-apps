/**
 * **Eine Sitzung bearbeiten und absagen** (Bauplan K2b) – schreibt bei ChurchTools: Kalendertermin, Einladungen,
 * Gruppentreffen und den Kopf des Protokolls. Die Regeln stehen in `@shared/protokolle/bearbeiten`. Gemessen:
 * `protokolle-planung/docs/messung-k2b-2026-10-29.md` (Einzeltermine) und `messung-k2b2-2026-10-29.md` (Serien).
 *
 * Reihenfolge wie beim Festlegen (S5-2): erst der **Termin** (dort entstehen die Mails), dann Einladungen, Treffen, Kopf.
 * Lehnt ChurchTools den Termin ab, ist nichts passiert → Fehler. Ist die Antwort unklar, wird nachgelesen; ein zweiter
 * Versuch ist dabei harmlos (gleicher Stand = keine Mail, gemessen M6f; ein gelöschter Termin → 404; ein schon
 * herausgelöster Tag gehört nicht mehr zur Serie → `SCHON_GETEILT`). Was **danach** scheitert, wird ein **Hinweis** – der
 * Termin steht schon, die Mails sind raus. Nie zurückrollen.
 *
 * **Serien (K2b-2):** Einladungen gelten für die ganze Serie. Titel oder Zeit „nur diese“ / „ab dieser“ **teilt** den
 * Termin – ohne Einladungsliste (mit Liste mailt ChurchTools irreführend über die alte Serie), danach wird jeder einzeln
 * eingeladen. „Ab dieser“ am ersten Termin ist eine Änderung der ganzen Serie. Absagen: nur diese (Ausnahme), ab hier
 * beenden (`repeatUntil`), ganze Serie löschen.
 */
import { werteLesen, wertAendern, wertLoeschen } from '@shared/ct/modulDaten';
import {
  aenderungVon,
  ausnahmeRumpf,
  endeRumpf,
  ersterDerSerie,
  kopfNachAbsage,
  nochInSerie,
  serienTag,
  serienWeg,
  teilRumpf,
  terminRumpf,
  terminSperre,
  verschoben,
  type SerienAbsage,
  type SerienWeg,
  type TerminRoh,
  type Umfang,
} from '@shared/protokolle/bearbeiten';
import { minute, type Sitzung } from '@shared/protokolle/sitzungen';
import {
  istKopf,
  sitzungAusWerten,
  wertInhalt,
  type ProtokollKopf,
} from '@shared/protokolle/speicher';
import { ApiError, NichtUebernommen, Unklar } from '@ui/ct/fehler';
import { modulPort } from '@ui/ct/modulPort';
import { ctAnfrage, ctDaten, KeinSpeicherRecht } from '@ui/ct/verbindung';
import { abgelehnt } from './planen';
import { anfragenLesen, terminDaten, terminLaden, terminPfad, type TerminRef } from './termin';

const json = (body: unknown) => JSON.stringify(body);
const VERWEIGERT_TERMIN = 'Du darfst in diesem Kalender keine Termine ändern.';
const VERWEIGERT_PROTOKOLL = 'Du darfst in dieser Gruppe keine Protokolle ändern.';

export const ANMELDUNG =
  'An diesem Termin hängt eine Anmeldung. Er lässt sich hier nicht ändern – bitte in ChurchTools.';
export const SCHON_GETEILT =
  'Diese Sitzung gehört nicht mehr zur Terminserie – die Liste ist nicht mehr aktuell. Bitte das Fenster schließen und neu öffnen.';
const SERIE_WAEHLEN =
  'Bei einer Terminserie bitte wählen: nur diese Sitzung, die Serie ab hier oder die ganze Serie.';
const SERIE_GEAENDERT =
  'Die Terminserie hat sich inzwischen geändert – bitte das Fenster schließen und neu öffnen.';
const ERSTER_AB =
  'Das ist der erste Termin der Serie – „ab hier beenden“ hieße die ganze Serie löschen. Bitte das wählen.';

type Ort = { modul: number; kategorie: number };

/**
 * **Der Termin, wie er jetzt ist** – mit den Eingeladenen und (bei einer Serie) allen Terminen. Die Liste der Sitzungen
 * taugt dafür nicht: Sie liest Termine nur 180 Tage voraus (`KOMMEND_TAGE`) und ist so alt wie das letzte Laden (beim
 * Prüfen in der Test-Instanz 29.10.2026 gefunden: eine Sitzung im Mai 2027 kam ohne Eingeladene ins Fenster).
 */
export async function terminStand(
  termin: TerminRef,
): Promise<{ roh: TerminRoh; eingeladen: number[]; termine: string[] }> {
  const [{ roh, termine }, anfragen] = await Promise.all([
    terminDaten(termin),
    anfragenLesen(termin),
  ]);
  return { roh, eingeladen: anfragen.map((a) => a.person), termine };
}

/** Eine Anmeldung am Termin → eine Meldung, die sagt, warum nicht (`ApiError` 409: kein „Erneut versuchen“-Fall). */
function pruefeSperre(t: TerminRoh): void {
  if (terminSperre(t) === 'anmeldung') throw new ApiError(409, ANMELDUNG);
}

const gleicherTermin = (a: TerminRef | null, b: TerminRef) =>
  !!a && a.kalender === b.kalender && a.id === b.id;

/** Den Kopf frisch lesen, ändern, nachlesen. Gibt es ihn nicht (mehr), passiert nichts. */
async function kopfSchreiben(
  q: Ort & { sitzung: string },
  aendern: (k: ProtokollKopf) => ProtokollKopf | 'loeschen' | null,
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

/**
 * **Die Köpfe einer Serie** ab einem Zeitpunkt (`ab` = `null`: alle) – frisch gelesen, je Sitzung der Kopf, den auch
 * `sitzungAusWerten` nimmt. Die Liste der Sitzungen reicht nicht: Sie kennt nur 180 Tage.
 */
async function koepfeDerSerie(q: Ort, termin: TerminRef, ab: string | null) {
  const werte = await werteLesen(modulPort, q.modul, q.kategorie);
  const sitzungen = new Set<string>();
  for (const w of werte) {
    const x = wertInhalt(w);
    if (istKopf(x)) sitzungen.add(x.sitzung);
  }
  return [...sitzungen]
    .map((s) => sitzungAusWerten(werte, s).kopf?.inhalt)
    .filter(
      (k): k is ProtokollKopf =>
        !!k &&
        gleicherTermin(k.termin, termin) &&
        (ab === null || Date.parse(k.beginn) >= Date.parse(ab)),
    );
}

/** Die Gruppentreffen einer Serie ab einem Zeitpunkt: aus den Köpfen und aus der Liste (dort auch ohne Kopf). */
function treffenDerSerie(
  koepfe: readonly ProtokollKopf[],
  sitzungen: readonly Sitzung[],
  termin: TerminRef,
  ab: string | null,
): Map<number, string> {
  const je = new Map<number, string>();
  const ok = (beginn: string) => ab === null || Date.parse(beginn) >= Date.parse(ab);
  for (const k of koepfe) if (k.treffen !== null && ok(k.beginn)) je.set(k.treffen, k.beginn);
  for (const s of sitzungen)
    if (s.treffen !== null && gleicherTermin(s.termin, termin) && ok(s.beginn))
      je.set(s.treffen, s.beginn);
  return je;
}

/** Ein Gruppentreffen verschieben – ChurchTools leert, was im `PUT` fehlt (Kommentar, Gäste, Rückmeldung). */
async function treffenVerschieben(gruppe: number, id: number, beginn: string): Promise<void> {
  const pfad = `/groups/${gruppe}/meetings/${id}`;
  const d = await ctDaten<Record<string, unknown>>(pfad);
  await ctAnfrage(pfad, {
    method: 'PUT',
    body: json({
      startDate: beginn,
      isCompleted: d?.isCompleted ?? false,
      isCanceled: d?.isCanceled ?? false,
      comment: d?.comment ?? null,
      numGuests: d?.numGuests ?? null,
      pollResult: d?.pollResult ?? null,
    }),
  });
  const nach = await ctDaten<{ startDate?: string }>(pfad);
  if (!nach?.startDate || minute(nach.startDate) !== minute(beginn))
    throw new NichtUebernommen('das Gruppentreffen');
}

const weg404 = (e: unknown) => e instanceof ApiError && e.status === 404;

/** Hinweis, wenn Treffen nicht mitgingen – `erster` ist der erste Fehler (fehlendes Recht oder keine Antwort). */
function treffenHinweis(anzahl: number, erster: unknown, was: 'verschieben' | 'loeschen'): string {
  const wer = anzahl === 1 ? 'Das Gruppentreffen steht' : `${anzahl} Gruppentreffen stehen`;
  const stand = was === 'verschieben' ? `${wer} noch auf der alten Zeit` : `${wer} noch`;
  return erster instanceof KeinSpeicherRecht
    ? `${stand} – dir fehlt in ChurchTools das Recht, Gruppentreffen zu pflegen.`
    : `${stand} (ChurchTools hat nicht geantwortet) – bitte in ChurchTools ${was === 'verschieben' ? 'verschieben' : 'löschen'}.`;
}

/**
 * **Ein- und ausladen**, jeden einzeln (Mail nur an die Betroffenen), danach einmal nachlesen. `schreiben: false` = nur
 * nachlesen (ChurchTools hat die Liste schon mit dem Termin bekommen). Liefert die Hinweise.
 */
async function einladungen(
  termin: TerminRef,
  dazu: readonly number[],
  weg: readonly number[],
  schreiben: boolean,
): Promise<string[]> {
  const pfad = `${terminPfad(termin)}/meetingrequests`;
  if (schreiben) {
    const da = weg.length ? await anfragenLesen(termin).catch(() => []) : [];
    for (const p of weg) {
      const id = da.find((x) => x.person === p)?.id;
      if (id !== undefined)
        await ctAnfrage(`${pfad}/${id}`, {
          method: 'DELETE',
          verweigert: VERWEIGERT_TERMIN,
        }).catch(() => undefined);
    }
    for (const p of dazu)
      await ctAnfrage(pfad, {
        method: 'POST',
        body: json({ inviteeId: p }),
        verweigert: VERWEIGERT_TERMIN,
      }).catch(() => undefined);
  }
  const hinweise: string[] = [];
  try {
    const jetzt = new Set((await anfragenLesen(termin)).map((x) => x.person));
    const fehlt = dazu.filter((p) => !jetzt.has(p)).length;
    const bleibt = weg.filter((p) => jetzt.has(p)).length;
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
  return hinweise;
}

/** Stimmt der Termin mit Titel und Zeit überein? */
const traegt = (t: TerminRoh, neu: { titel: string; beginn: string; ende: string }) =>
  t.title === neu.titel &&
  typeof t.startDate === 'string' &&
  minute(t.startDate) === minute(neu.beginn) &&
  typeof t.endDate === 'string' &&
  minute(t.endDate) === minute(neu.ende);

/**
 * **Einen Tag aus der Serie lösen** („nur diese“) oder **die Serie ab hier teilen** („ab dieser“) – liefert den neuen
 * Termin. Vorher geprüft, dass der Tag noch zur Serie gehört; ohne ID in der Antwort wird der neue Termin im Kalender
 * gesucht (gleicher Titel, gleiche Zeit) – ein Erfolgssignal ist kein Beleg.
 */
async function teilen(
  termin: TerminRef,
  t: TerminRoh,
  neu: { titel: string; beginn: string; ende: string },
  umfang: Umfang,
  tag: string,
  zeitzone: string,
): Promise<TerminRef> {
  if (!nochInSerie(t, tag, zeitzone)) throw new ApiError(409, SCHON_GETEILT);
  let id: number | null = null;
  try {
    const r = await ctAnfrage<{ data?: { id?: unknown } }>(terminPfad(termin), {
      method: 'POST',
      body: json(teilRumpf(t, neu, umfang, tag)),
      verweigert: VERWEIGERT_TERMIN,
    });
    if (typeof r?.data?.id === 'number') id = r.data.id;
  } catch (e) {
    if (abgelehnt(e)) throw e;
  }
  if (id === null) {
    const liste = await ctDaten<
      { base?: { id?: number; title?: string }; calculated?: { startDate?: string } }[]
    >(
      `/calendars/appointments?calendar_ids[]=${termin.kalender}&from=${serienTag(neu.beginn, 'UTC')}&to=${serienTag(new Date(Date.parse(neu.beginn) + 86_400_000).toISOString(), 'UTC')}`,
    ).catch(() => []);
    const treffer = (liste ?? []).find(
      (x) =>
        x.base?.id !== termin.id &&
        x.base?.title === neu.titel &&
        typeof x.calculated?.startDate === 'string' &&
        minute(x.calculated.startDate) === minute(neu.beginn),
    );
    if (typeof treffer?.base?.id !== 'number')
      throw new Unklar(
        'Ob die Sitzung aus der Serie gelöst wurde, ist unklar – bitte im Kalender in ChurchTools nachsehen, bevor du es noch einmal versuchst.',
      );
    id = treffer.base.id;
  }
  const neuerTermin = { kalender: termin.kalender, id };
  if (!traegt(await terminLaden(neuerTermin), neu))
    throw new NichtUebernommen('das Herauslösen aus der Serie');
  return neuerTermin;
}

export interface Bearbeitet {
  /** Was nicht geklappt hat – der Termin ist trotzdem geändert. */
  hinweise: string[];
}

/**
 * **Sitzung ändern:** Titel, Zeit, Eingeladene. `nachher` = alle, die danach eingeladen sein sollen (auch solche, die das
 * Fenster nicht als Mitglied kennt). `neuEinladen` gilt nur, wenn sich die Zeit ändert und nicht geteilt wird: Dann geht
 * der Termin **mit** Einladungsliste an ChurchTools – Zusagen zurück, eine Mail „Termin geändert“ je Person. Sonst ohne
 * Liste (still), und Ein-/Ausladen einzeln (Mail nur an die Betroffenen). Bei einer Serie sagt `umfang`, ob Titel und
 * Zeit nur für diese Sitzung oder ab dieser gelten.
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
  zeitzone: string;
  /** Nur bei einer Serie: „nur diese“ (Standard) oder „ab dieser“. */
  umfang?: Umfang;
  /** Die Sitzungen der Gruppe – „ab dieser“ zieht auch die Treffen späterer Termine mit (ohne Kopf). */
  sitzungen?: readonly Sitzung[];
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
  let weg: SerienWeg | null = null;
  let ziel: TerminRef | null = s.termin;

  // 1. Termin – vorher lesen (Rumpf, Serie?), dann schreiben, dann nachlesen.
  if (s.termin && (a.titel || a.zeit)) {
    const termin = s.termin;
    const t = await terminLaden(termin);
    pruefeSperre(t);
    if (terminSperre(t) === 'serie')
      weg = serienWeg(a, q.umfang ?? 'diese', ersterDerSerie(t, s.beginn, q.zeitzone));
    if (weg === 'teilen-diese' || weg === 'teilen-ab') {
      const tag = serienTag(s.beginn, q.zeitzone);
      ziel = await teilen(termin, t, neu, weg === 'teilen-diese' ? 'diese' : 'ab', tag, q.zeitzone);
      // Hat die Serie den Tag abgegeben? Sonst stünde die Sitzung doppelt im Kalender.
      try {
        if (nochInSerie(await terminLaden(termin), tag, q.zeitzone))
          hinweise.push(
            'Die Serie hat den Termin an diesem Tag noch – bitte in ChurchTools aus der Serie entfernen.',
          );
      } catch {
        hinweise.push(
          'Ob die Serie den Termin an diesem Tag abgegeben hat, ließ sich nicht nachlesen – bitte im Kalender ansehen.',
        );
      }
    } else {
      const mitListe = a.zeit && q.neuEinladen;
      try {
        await ctAnfrage(terminPfad(termin), {
          method: 'PUT',
          body: json(terminRumpf(t, neu, mitListe ? q.nachher : undefined)),
          verweigert: VERWEIGERT_TERMIN,
        });
      } catch (e) {
        if (abgelehnt(e)) throw e;
      }
      if (!traegt(await terminLaden(termin), neu))
        throw new NichtUebernommen('die Änderung am Termin');
    }
  }
  const geteilt = weg === 'teilen-diese' || weg === 'teilen-ab';
  const mitListe = !geteilt && !!s.termin && a.zeit && q.neuEinladen;

  // 2. Ein-/Ausladen – an der Serie bzw. dem Termin. Nicht bei „ab dieser“ geteilt: Die Termine davor bleiben, wie sie
  //    sind; der neue Teil bekommt unten alle aus `nachher`.
  if (s.termin && weg !== 'teilen-ab' && (a.dazu.length || a.weg.length))
    hinweise.push(...(await einladungen(s.termin, a.dazu, a.weg, !mitListe)));

  // 3. Geteilt: Der neue Termin hat keine Einladungen – jeden einzeln einladen (ich werde dabei gleich zugesagt).
  if (geteilt && ziel) hinweise.push(...(await einladungen(ziel, q.nachher, [], true)));

  // 4. Gruppentreffen und Köpfe. „Ab dieser“ (geteilt oder ab dem ersten Termin) betrifft alle späteren Termine der
  //    Serie: gleich viele Tage weiter, neue Uhrzeit und Dauer.
  const ab = s.termin !== null && (weg === 'teilen-ab' || weg === 'serie');
  const lage = (beginn: string) =>
    a.zeit ? verschoben(beginn, { alt: s.beginn, neu }, q.zeitzone).beginn : beginn;
  let koepfe: ProtokollKopf[] = s.kopf ? [s.kopf] : [];
  let treffen = new Map<number, string>(s.treffen !== null ? [[s.treffen, s.beginn]] : []);
  if (ab && s.termin) {
    try {
      koepfe = await koepfeDerSerie(q, s.termin, s.beginn);
    } catch {
      hinweise.push(
        'Die Protokolle der späteren Termine ließen sich nicht lesen – sie stehen noch auf der alten Zeit.',
      );
    }
    treffen = new Map([
      ...treffen,
      ...treffenDerSerie(koepfe, q.sitzungen ?? [], s.termin, s.beginn),
    ]);
  }

  if (a.zeit) {
    let fehler = 0;
    let erster: unknown = null;
    for (const [id, beginn] of treffen)
      try {
        await treffenVerschieben(q.gruppe, id, ab ? lage(beginn) : neu.beginn);
      } catch (e) {
        fehler++;
        erster ??= e;
      }
    if (fehler) hinweise.push(treffenHinweis(fehler, erster, 'verschieben'));
  }

  if (a.titel || a.zeit) {
    let fehler = 0;
    for (const k of koepfe)
      try {
        await kopfSchreiben({ ...q, sitzung: k.sitzung }, (x) => ({
          ...x,
          titel: a.titel || x.sitzung === s.kopf?.sitzung ? neu.titel : x.titel,
          beginn: ab ? lage(x.beginn) : neu.beginn,
          // Nur geteilt hängt die Sitzung an einem neuen Termin; sonst bleibt der Verweis, wie er ist.
          termin: geteilt ? ziel : x.termin,
        }));
      } catch {
        fehler++;
      }
    if (fehler)
      hinweise.push(
        fehler === 1 && koepfe.length === 1
          ? 'Im Protokoll stehen noch der alte Titel und die alte Zeit – bitte noch einmal speichern.'
          : `${fehler} Protokolle der Serie stehen noch auf dem alten Stand – bitte in der Liste ansehen.`,
      );
  }
  return { hinweise };
}

/**
 * **Sitzung absagen.** Ein Einzeltermin – und bei einer Serie „ganze Serie“ – wird gelöscht (Mail „Termin gelöscht“ bzw.
 * „Terminserie gelöscht“ an jeden Eingeladenen). Bei einer Serie sonst still: „nur diese“ als Ausnahme, „ab hier“ endet
 * die Serie am Vortag. Treffen werden gelöscht (bei „ganze Serie“ nur kommende – vergangene tragen die Anwesenheit),
 * und die Protokolle: ein geplantes verschwindet, ein begonnenes bleibt als Entwurf ohne Termin (`kopfNachAbsage`).
 */
export async function sitzungAbsagen(q: {
  modul: number;
  kategorie: number;
  gruppe: number;
  sitzung: Sitzung;
  zeitzone: string;
  /** Nur bei einer Serie – Pflicht, sonst wird nichts gelöscht. */
  art?: SerienAbsage;
  sitzungen?: readonly Sitzung[];
  jetzt?: Date;
}): Promise<Bearbeitet> {
  const s = q.sitzung;
  const hinweise: string[] = [];
  const tag = serienTag(s.beginn, q.zeitzone);

  // Ein schon gelöschter Termin (404 – etwa beim zweiten Versuch, nachdem nur der Kopf scheiterte) ist abgesagt.
  let t: TerminRoh | null = null;
  if (s.termin)
    try {
      t = await terminLaden(s.termin);
    } catch (e) {
      if (!weg404(e)) throw e;
    }
  const serie = !!t && terminSperre(t) === 'serie';
  if (s.termin && t) {
    const termin = s.termin;
    pruefeSperre(t);
    if (serie && !q.art) throw new ApiError(409, SERIE_WAEHLEN);
    const pfad = terminPfad(termin);
    // „Nur diese“ / „ab hier“ löscht nie: Ist aus der Serie inzwischen ein Einzeltermin geworden (nur einer blieb übrig),
    // ist ein anderer Tag schon erledigt – und derselbe Tag ein Fall fürs neue Öffnen (dort mit Mail angesagt).
    const stillAbsagen = q.art === 'diese' || q.art === 'ab';
    if (stillAbsagen && !serie) {
      if (nochInSerie(t, tag, q.zeitzone)) throw new ApiError(409, SERIE_GEAENDERT);
    } else if (!stillAbsagen) {
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
        if (weg404(e)) noch = false;
        else throw e;
      }
      if (noch) throw new NichtUebernommen('die Absage');
    } else if (nochInSerie(t, tag, q.zeitzone)) {
      if (q.art === 'ab' && ersterDerSerie(t, s.beginn, q.zeitzone))
        throw new ApiError(409, ERSTER_AB);
      try {
        await ctAnfrage(pfad, {
          method: 'PUT',
          body: json(q.art === 'diese' ? ausnahmeRumpf(t, tag) : endeRumpf(t, tag)),
          verweigert: VERWEIGERT_TERMIN,
        });
      } catch (e) {
        if (abgelehnt(e)) throw e;
      }
      if (nochInSerie(await terminLaden(termin), tag, q.zeitzone))
        throw new NichtUebernommen('die Absage');
    }
  }

  // Was mitgeht: bei „ab hier“ alle späteren Termine der Serie, bei „ganze Serie“ alle (Treffen nur kommende).
  const mehrere = s.termin !== null && (q.art === 'ab' || q.art === 'serie');
  let koepfe: ProtokollKopf[] = s.kopf ? [s.kopf] : [];
  let treffen = new Map<number, string>(s.treffen !== null ? [[s.treffen, s.beginn]] : []);
  if (mehrere && s.termin) {
    const ab = q.art === 'ab' ? s.beginn : null;
    try {
      koepfe = await koepfeDerSerie(q, s.termin, ab);
    } catch {
      hinweise.push(
        'Die Protokolle der späteren Termine ließen sich nicht lesen – sie hängen noch an der Serie.',
      );
    }
    const kommend = (q.jetzt ?? new Date()).toISOString();
    treffen = new Map(
      [...treffen, ...treffenDerSerie(koepfe, q.sitzungen ?? [], s.termin, ab)].filter(
        ([, beginn]) => q.art === 'ab' || Date.parse(beginn) >= Date.parse(kommend),
      ),
    );
  }

  let fehler = 0;
  let erster: unknown = null;
  for (const id of treffen.keys())
    try {
      await ctAnfrage(`/groups/${q.gruppe}/meetings/${id}`, { method: 'DELETE' });
    } catch (e) {
      if (!weg404(e)) {
        fehler++;
        erster ??= e;
      }
    }
  if (fehler) hinweise.push(treffenHinweis(fehler, erster, 'loeschen'));

  let kopfFehler = 0;
  for (const k of koepfe)
    try {
      await kopfSchreiben({ ...q, sitzung: k.sitzung }, kopfNachAbsage);
    } catch {
      kopfFehler++;
    }
  if (kopfFehler)
    hinweise.push(
      koepfe.length === 1
        ? koepfe[0].status === 'geplant'
          ? 'Die geplante Sitzung steht noch in den Protokollen – sie verschwindet beim nächsten Absagen-Versuch.'
          : 'Das Protokoll ist noch mit dem gelöschten Termin verknüpft.'
        : `${kopfFehler} Protokolle der Serie hängen noch am alten Termin – bitte in der Liste ansehen.`,
    );
  return { hinweise };
}
