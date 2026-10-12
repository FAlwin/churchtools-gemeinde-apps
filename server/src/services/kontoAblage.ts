/**
 * **Die Ablage eines Kontos, wie die Controller sie sehen** – ChurchTools, ergänzt um den Altbestand
 * auf dem Daten-Volume, solange dessen Umzug läuft (Ablage in ChurchTools, 09.10.2026).
 *
 * Lesen: erst ChurchTools, dann füllt der Altbestand Lücken (ChurchTools gewinnt) – und der Umzug wird
 * angestoßen. Schreiben: immer nach ChurchTools. Liegt eine Seite bisher nur auf dem Volume, nimmt der
 * erste Schreibzugriff ihren Inhalt mit (die neue Änderung gewinnt je Feld): Sonst speicherte etwa ein
 * Zoom nur den Zoom, und Striche und Texte der Seite blieben auf dem Volume zurück.
 */
import { songIdOfAnnoKey, songIdOfSettingsKey } from '@shared/keys/index';
import type { GesehenerStand, PageAnnotation } from '@shared/types/index';
import { ablagePortFuer, ablageVon } from './ctPersonenAblage.js';
import { altFuerLesen, merkeUeberschrieben, umzugAnstossen } from './ablageUmzug.js';

export async function anmerkungenHolen(
  cookie: string,
  userId: number,
  songIds: number[],
): Promise<Record<string, PageAnnotation>> {
  const ct = await ablageVon(userId).holeAnmerkungen(ablagePortFuer(cookie, userId), songIds);
  const alt = await altFuerLesen(userId);
  umzugAnstossen(cookie, userId);
  if (!alt) return ct;
  const ids = new Set(songIds);
  const out = { ...ct };
  for (const [key, seite] of Object.entries(alt.anmerkungen)) {
    const song = songIdOfAnnoKey(key);
    if (key in out || song === null || !ids.has(song)) continue;
    out[key] = seite;
  }
  return out;
}

export async function anmerkungSchreiben(
  cookie: string,
  userId: number,
  key: string,
  teil: PageAnnotation,
): Promise<void> {
  const port = ablagePortFuer(cookie, userId);
  const ablage = ablageVon(userId);
  const alt = await altFuerLesen(userId);
  const altSeite = alt?.anmerkungen[key];
  let auftrag = teil;
  if (altSeite) {
    const song = songIdOfAnnoKey(key);
    const ct = song === null ? {} : await ablage.holeAnmerkungen(port, [song]);
    if (!(key in ct)) auftrag = { ...altSeite, ...teil };
  }
  await ablage.schreibeAnmerkung(port, key, auftrag);
  if (altSeite) await merkeUeberschrieben(userId, key);
}

export async function einstellungenHolen(
  cookie: string,
  userId: number,
  songIds: number[],
): Promise<Record<string, string>> {
  const ct = await ablageVon(userId).holeEinstellungen(ablagePortFuer(cookie, userId), songIds);
  const alt = await altFuerLesen(userId);
  umzugAnstossen(cookie, userId);
  if (!alt) return ct;
  const ids = new Set(songIds);
  const out = { ...ct };
  // Die Lied-Zuordnung der Schlüssel prüft `holeEinstellungen` für ChurchTools; für das Volume hier.
  for (const [key, wert] of Object.entries(alt.einstellungen)) {
    const song = songIdOfSettingsKey(key);
    if (key in out || song === null || !ids.has(song)) continue;
    out[key] = wert;
  }
  return out;
}

export function einstellungenSchreiben(
  cookie: string,
  userId: number,
  eintraege: Record<string, string | null>,
): Promise<void> {
  return ablageVon(userId).schreibeEinstellungen(ablagePortFuer(cookie, userId), eintraege);
}

/** „Gesehen" (#143) – ein Komfort-Hinweis: Scheitert das Lesen, gibt es eben keine Punkte. */
export async function gesehenHolen(
  cookie: string,
  userId: number,
): Promise<Record<string, GesehenerStand>> {
  let ct: Record<number, GesehenerStand> = {};
  try {
    ct = await ablageVon(userId).holeGesehen(ablagePortFuer(cookie, userId));
  } catch (e) {
    console.warn('[ablage] „gesehen" nicht lesbar:', e instanceof Error ? e.message : e);
  }
  const alt = await altFuerLesen(userId).catch(() => null);
  const out: Record<string, GesehenerStand> = {};
  for (const [id, s] of Object.entries(alt?.gesehen ?? {})) out[id] = s;
  for (const [id, s] of Object.entries(ct)) out[id] = s; // ChurchTools gewinnt
  return out;
}

/** Einen Stand als gesehen merken – best effort wie bisher: ein Fehler bricht nichts ab. */
export async function gesehenMerken(
  cookie: string,
  userId: number,
  eventId: number,
  hash: string,
  items?: GesehenerStand['items'],
): Promise<void> {
  try {
    await ablageVon(userId).merkeGesehen(ablagePortFuer(cookie, userId), eventId, { hash, items });
  } catch (e) {
    console.warn('[ablage] „gesehen" nicht gespeichert:', e instanceof Error ? e.message : e);
  }
}

/** Teilt mein Konto? ChurchTools; sagt die eigene Datei noch nichts, der Altbestand. */
export async function teiltIch(cookie: string, userId: number): Promise<boolean> {
  const ct = await ablageVon(userId).holeTeilenStand(ablagePortFuer(cookie, userId));
  if (ct !== null) return ct;
  return (await altFuerLesen(userId))?.teilen?.an === true;
}
