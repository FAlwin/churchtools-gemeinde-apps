/**
 * **Team-Notizen der Server-App über ChurchTools** – der Server-Anschluss an `@shared/ct/teilen`
 * (Ablage in ChurchTools, 09.10.2026; Alwin: „die Liste der Erweiterung").
 *
 * - **Ob** jemand teilt, steht in seiner eigenen Daten-Datei in ChurchTools – für App und Erweiterung.
 * - **Wo** man nachsieht, sind ZWEI Verzeichnisse, gelesen als eines: das der Erweiterung (Kategorie
 *   `musikapp-teilen` im Modul `config.erweiterungKuerzel`) und die alte Liste auf dem Daten-Volume
 *   (`sharing.json`). Geschrieben wird in beide. So geht es sofort – auch wenn eine Gemeinde keine
 *   Erweiterung hat oder ihr Verzeichnis noch nicht eingerichtet ist –, und ein Eintrag, den die Person
 *   nicht selbst in ihrer Datei bestätigt, bewirkt in beiden nichts.
 */
import { HttpError } from '../middleware/errorHandler.js';
import { config } from '../config.js';
import * as kern from '@shared/ct/teilen';
import { modulSuchen, type ModulPort } from '@shared/ct/modulDaten';
import type { GeteilteAblage } from '@shared/ct/personenAblage';
import { merkeVersprechen } from '@shared/ct/versprechenMerker';
import { createTtlMemo } from './ttlMemo.js';
import { whoami } from './ctAuth.js';
import { ctGet } from './ctHttp.js';
import { schreiberFuer } from './ctWrite.js';
import { ablagePortFuer, ablageVon } from './ctPersonenAblage.js';
import { listSharers, setSharing } from './sharing.js';
import { altFuerLesen } from './altbestand.js';
import { songIdOfAnnoKey, songIdOfSettingsKey } from '@shared/keys/index';
import type { AnnotationText } from '@shared/types/index';

/** Der Anschluss an den Datenbereich des Moduls – mit der Sitzung der Anfrage. */
export function modulPortFuer(cookie: string): ModulPort {
  const schreiber = schreiberFuer(cookie);
  return {
    kuerzel: () => config.erweiterungKuerzel,
    daten: <T>(pfad: string) => ctGet<T>(cookie, `/api${pfad}`),
    async schreibe(pfad, auftrag) {
      await schreiber.schreibe(pfad, {
        method: auftrag.method,
        json: auftrag.json,
        verweigert: auftrag.verweigert,
        fehler: 'ChurchTools hat die Team-Notizen-Liste nicht gespeichert',
      });
    },
    fehler: (status, meldung) => new HttpError(status, meldung),
    istKeinRecht: (e) => e instanceof HttpError && (e.status === 401 || e.status === 403),
    istNichtGefunden: (e) => e instanceof HttpError && e.status === 404,
  };
}

/** Die Modul-ID ist für alle gleich – zehn Minuten gemerkt (auch „gibt es nicht" ist eine Antwort). */
const modulMemo = createTtlMemo<number | null>(10 * 60_000);

async function modulIdOderNull(cookie: string): Promise<number | null> {
  const da = modulMemo.get('modul');
  if (da !== undefined) return da;
  try {
    const id = await modulSuchen(modulPortFuer(cookie));
    modulMemo.set('modul', id);
    return id;
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) {
      modulMemo.set('modul', null);
      return null;
    }
    throw e;
  }
}

/** Fremde Ablagen eine Minute gemerkt – je Betrachter, denn was man lesen darf, hängt an ihm. */
const fremde = merkeVersprechen<GeteilteAblage | null>({ ttlMs: 60_000 });

function anschlussFuer(cookie: string, userId: number): kern.TeilenAnschluss {
  const ablage = ablagePortFuer(cookie, userId);
  return {
    modul: modulPortFuer(cookie),
    ablage,
    meineAblage: ablageVon(userId),
    async modulId() {
      const id = await modulIdOderNull(cookie);
      if (id === null)
        throw new HttpError(404, 'Die Musik App ist in ChurchTools nicht zu finden.');
      return id;
    },
    async ich() {
      const me = await whoami(cookie);
      return { id: me.id, name: `${me.firstName} ${me.lastName}`.trim() };
    },
    fremdeAblage: (personId) =>
      fremde.hole(`${userId}:${personId}`, () =>
        ablageVon(userId).geteilteAblage(ablage, personId),
      ),
    vergissFremde: () => fremde.vergiss(),
  };
}

/**
 * Eigenes Teilen umschalten. Erst über das Verzeichnis der Erweiterung (dort mit allen Prüfungen);
 * fehlt das Modul oder ist sein Verzeichnis nicht eingerichtet/nicht beschreibbar, zählt die eigene
 * Datei trotzdem, und gefunden wird man über die Liste auf dem Daten-Volume. Die wird in jedem Fall
 * mitgeführt.
 */
export async function teilenSetzen(
  cookie: string,
  userId: number,
  enabled: boolean,
): Promise<{ enabled: boolean }> {
  const t = anschlussFuer(cookie, userId);
  const me = await t.ich();
  try {
    await kern.teilenSetzen(t, enabled);
  } catch (e) {
    const ohneVerzeichnis =
      e instanceof HttpError && (e.status === 404 || e.status === 409 || e.status === 403);
    if (!ohneVerzeichnis) throw e;
    console.warn(
      `[teilen] Verzeichnis der Erweiterung nicht nutzbar (${e.status}) – Liste auf dem Daten-Volume`,
    );
    await t.meineAblage.schreibeTeilen(t.ablage, enabled, me.name);
    t.vergissFremde();
  }
  await setSharing(userId, me.name, enabled);
  return { enabled };
}

/** Wer teilt Anmerkungen zu diesen Liedern (außer mir)? Aus beiden Verzeichnissen. */
export async function teilende(
  cookie: string,
  userId: number,
  songIds: number[],
): Promise<{ id: number; name: string; songs: number[] }[]> {
  const t = anschlussFuer(cookie, userId);
  const ausModul = (await modulIdOderNull(cookie)) === null ? [] : await kern.verzeichnis(t);
  const ausNas = (await listSharers()).map((s) => s.id);
  const personen = [...new Set([...ausModul, ...ausNas])];
  if (personen.length === 0) return [];
  const out = await kern.teilende(t, personen, songIds);
  // Wer auf dem Volume geteilt hat, aber noch nicht umgezogen ist (seitdem nicht angemeldet): weiter
  // vom Volume – sonst verschwänden seine Notizen für alle, bis er sich das nächste Mal anmeldet.
  const ids = new Set(songIds);
  for (const personId of ausNas) {
    if (personId === userId || out.some((p) => p.id === personId)) continue;
    const alt = await nochNichtUmgezogenGeteilt(t, personId);
    if (!alt) continue;
    const songs = new Set<number>();
    for (const [key, seite] of Object.entries(alt.anmerkungen)) {
      const song = songIdOfAnnoKey(key);
      if (song !== null && ids.has(song) && (seite.strokes || seite.texts?.length)) songs.add(song);
    }
    if (songs.size > 0) {
      out.push({ id: personId, name: alt.teilen?.name || `Person ${personId}`, songs: [...songs] });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

type AltDaten = NonNullable<Awaited<ReturnType<typeof altFuerLesen>>>;

/**
 * Der Altbestand einer Person, die auf dem Volume teilt und deren Datei in ChurchTools noch NICHTS zum
 * Teilen sagt – sonst `null`. Hat sie das Teilen in ChurchTools (etwa in der Erweiterung) ausgeschaltet,
 * gilt das; der alte Eintrag auf dem Volume schaltet es nicht wieder ein.
 */
async function nochNichtUmgezogenGeteilt(
  t: kern.TeilenAnschluss,
  personId: number,
): Promise<AltDaten | null> {
  const alt = await altFuerLesen(personId);
  if (!alt?.teilen?.an) return null;
  try {
    if ((await t.meineAblage.teilenStandVon(t.ablage, personId)) !== null) return null;
  } catch (e) {
    console.warn(`[teilen] Datei von Person ${personId} nicht lesbar:`, e);
    return null;
  }
  return alt;
}

/** Teilt die Person laut ChurchTools nicht? Dann – nur wenn noch nicht umgezogen – vom Volume. */
async function oderVomVolume<T>(
  t: kern.TeilenAnschluss,
  personId: number,
  ausChurchTools: () => Promise<T>,
  ausVolume: (alt: AltDaten) => T,
): Promise<T> {
  try {
    return await ausChurchTools();
  } catch (e) {
    if (!(e instanceof HttpError && e.status === 403)) throw e;
    const alt = await nochNichtUmgezogenGeteilt(t, personId);
    if (!alt) throw e;
    return ausVolume(alt);
  }
}

/** Geteilte Anmerkungen einer Person (ohne Zoom). */
export function anmerkungenVon(
  cookie: string,
  userId: number,
  personId: number,
  songIds: number[],
): Promise<Record<string, { strokes: string | null; texts: AnnotationText[] }>> {
  const t = anschlussFuer(cookie, userId);
  const ids = new Set(songIds);
  return oderVomVolume(
    t,
    personId,
    () => kern.anmerkungenVon(t, personId, songIds),
    (alt) => {
      // Ohne Zoom – der ist persönlich und wird nie geteilt.
      const out: Record<string, { strokes: string | null; texts: AnnotationText[] }> = {};
      for (const [key, seite] of Object.entries(alt.anmerkungen)) {
        const song = songIdOfAnnoKey(key);
        const strokes = seite.strokes ?? null;
        const texts = seite.texts ?? [];
        if (song === null || !ids.has(song) || (!strokes && texts.length === 0)) continue;
        out[key] = { strokes, texts };
      }
      return out;
    },
  );
}

/** Ihre Lied-Einstellungen (für ihre Ansicht). */
export function einstellungenVon(
  cookie: string,
  userId: number,
  personId: number,
  songIds: number[],
): Promise<Record<string, string>> {
  const t = anschlussFuer(cookie, userId);
  const ids = new Set(songIds);
  return oderVomVolume(
    t,
    personId,
    () => kern.einstellungenVon(t, personId, songIds),
    (alt) => {
      const out: Record<string, string> = {};
      for (const [key, wert] of Object.entries(alt.einstellungen)) {
        const song = songIdOfSettingsKey(key);
        if (song !== null && ids.has(song)) out[key] = wert;
      }
      return out;
    },
  );
}

/** Nur für Tests. */
export function __resetTeilenServerForTests(): void {
  modulMemo.clear();
  fremde.vergiss();
}
