/**
 * **Team-Notizen in der Erweiterung** (#335, Phase 3b-4b) – das Gegenstück zu `sharing.json` und den
 * `/api/annotations/of/…`-Endpunkten des Servers.
 *
 * Zwei Orte, mit verteilten Rollen (Alwin, 07.10.2026: „Liste in den Erweiterungs-Daten"):
 *  - **Ob** jemand teilt, steht in SEINER Daten-Datei (`personenAblage.ts`, Feld `teilen`). Die kann
 *    nur er selbst ändern – das ist die Wahrheit.
 *  - **Wo** man nachsehen muss, steht im Verzeichnis „Wer teilt" (Kategorie `musikapp-teilen` in den
 *    Daten der Erweiterung, je Person ein Wert). Sonst müsste jedes Gerät jeden Musiker einzeln
 *    abfragen – genau die Last, mit der ChurchTools schon einmal gebremst hat (#300). Ein Eintrag, den
 *    die Person nicht in ihrer eigenen Datei bestätigt, bewirkt nichts.
 *
 * Schutz ist das keiner: Die Anhänge an einer Person können Mitglieder, die die Person sehen dürfen,
 * ohnehin öffnen (Plan §2b, von Alwin hingenommen). „Teilen" sagt nur, wessen Notizen die App anbietet.
 */
import { ApiError } from './api';
import {
  inhaltAus,
  istDauerhaftLeer,
  kategorieSicherstellen,
  kategorieSuchen,
  modulId,
  wertAnlegen,
  werteLesen,
  wertLoeschen,
  type KategorieAngabe,
  type Wert,
} from './ctModulDaten';
import { meinStatus } from './ctLesen';
import {
  geteilteAblage,
  geteilteAnmerkungen,
  geteilteEinstellungen,
  geteilteLieder,
  holeTeilen,
  schreibeTeilen,
  type GeteilteAblage,
} from './personenAblage';
import type { AnnotationText } from '@shared/types/index';
import { merkeVersprechen } from '@shared/ct/versprechenMerker';

export const TEILEN_KATEGORIE: KategorieAngabe = {
  kuerzel: 'musikapp-teilen',
  name: 'Team-Notizen der Musik App',
  beschreibung: 'Wer seine Anmerkungen teilt – von der Musik App angelegt, bitte nicht löschen.',
};
const ART = 'musikapp-teilen';
const FASSUNG = 1;

interface Eintrag {
  art: typeof ART;
  fassung: typeof FASSUNG;
  personId: number;
  /** Nur zum Lesen in ChurchTools – angezeigt wird der Name aus der eigenen Datei der Person. */
  name: string;
}

const VERWEIGERT =
  'ChurchTools erlaubt dir nicht, dich in die Liste der Team-Notizen einzutragen. Bitte die ' +
  'Verantwortlichen nach den Rechten für „Team-Notizen der Musik App" fragen.';
const NICHT_EINGERICHTET =
  'Die Team-Notizen sind in ChurchTools nicht zu finden: Entweder hat die Verwaltung noch keine ' +
  'Gruppe gespeichert, oder dir fehlt das Recht, „Team-Notizen der Musik App" zu sehen.';

function personAus(w: Wert): number | null {
  const e = inhaltAus<Eintrag>(w, ART, FASSUNG);
  return e && Number.isInteger(e.personId) && e.personId > 0 ? e.personId : null;
}

async function ich(): Promise<{ id: number; name: string }> {
  const status = await meinStatus();
  if (!status.authenticated || !status.user) {
    throw new ApiError(401, 'Bei ChurchTools nicht mehr angemeldet.');
  }
  const { id, firstName, lastName } = status.user;
  return { id, name: `${firstName} ${lastName}`.trim() };
}

/**
 * Das Verzeichnis anlegen – beim Speichern der Gruppen durch einen Admin. Musiker dürfen in ChurchTools
 * meist keine Kategorien anlegen; deshalb nicht erst beim ersten Teilen.
 */
export async function teilenEinrichten(): Promise<void> {
  await kategorieSicherstellen(
    await modulId(),
    TEILEN_KATEGORIE,
    'ChurchTools erlaubt dir nicht, die Liste der Team-Notizen anzulegen.',
  );
}

/** `GET /api/annotations/sharing` – teilt mein Konto? Aus der eigenen Datei. */
export async function teiltIch(): Promise<{ enabled: boolean }> {
  return { enabled: await holeTeilen() };
}

/**
 * `PUT /api/annotations/sharing` – eigenes Teilen umschalten. Die Reihenfolge ist Absicht:
 *  - **Einschalten:** erst ins Verzeichnis, dann die eigene Datei. Scheitert das Verzeichnis (Recht
 *    fehlt), bleibt die eigene Datei unberührt – kein „an", das niemand findet.
 *  - **Ausschalten:** erst die eigene Datei – damit gilt es sofort, für jedes Gerät. Der Eintrag im
 *    Verzeichnis wird danach entfernt; bleibt er stehen (Netz), bewirkt er nichts mehr.
 */
export async function teilenSetzen(enabled: boolean): Promise<{ enabled: boolean }> {
  const me = await ich();
  const modul = await modulId();
  const kategorie = await kategorieSuchen(modul, TEILEN_KATEGORIE.kuerzel);
  if (enabled) {
    if (kategorie === null) throw new ApiError(409, NICHT_EINGERICHTET);
    const werte = await werteLesen(modul, kategorie);
    if (!werte.some((w) => personAus(w) === me.id)) {
      const eintrag: Eintrag = { art: ART, fassung: FASSUNG, personId: me.id, name: me.name };
      await wertAnlegen(modul, kategorie, JSON.stringify(eintrag), VERWEIGERT);
      // Nachsehen statt glauben (Lehre vom 11.08.2026).
      const nachher = await werteLesen(modul, kategorie);
      if (!nachher.some((w) => personAus(w) === me.id)) {
        throw new ApiError(
          502,
          'ChurchTools hat den Eintrag nicht übernommen. Bitte erneut versuchen.',
        );
      }
    }
    await schreibeTeilen(true, me.name);
  } else {
    await schreibeTeilen(false, me.name);
    if (kategorie !== null) {
      try {
        for (const w of await werteLesen(modul, kategorie)) {
          if (personAus(w) === me.id) await wertLoeschen(modul, kategorie, w.id, VERWEIGERT);
        }
      } catch (e) {
        console.warn('[teilen] Eintrag im Verzeichnis nicht entfernt – wirkungslos:', e);
      }
    }
  }
  ablagen.vergiss();
  return { enabled };
}

// ── Fremde Ablagen ───────────────────────────────────────────────────────────

/**
 * Gelesene Ablagen anderer – eine Minute gemerkt. Beim Öffnen von „Notizen von …" fragt die App
 * nacheinander Liste, Anmerkungen und Einstellungen derselben Person; ohne das Merken wären das drei
 * Mal Dateiliste und Daten-Datei. Ein Fehlschlag wird nicht gemerkt.
 */
const ablagen = merkeVersprechen<GeteilteAblage | null>({ ttlMs: 60_000 });

function ablageVon(personId: number): Promise<GeteilteAblage | null> {
  return ablagen.hole(personId, () => geteilteAblage(personId));
}

/** Nur für Tests. */
export function _vergissAblagen(): void {
  ablagen.vergiss();
}

/**
 * `GET /api/annotations/sharers?songs=…` – wer teilt Anmerkungen zu diesen Liedern (außer mir)?
 *
 * Kein Verzeichnis zu sehen → niemand (wie ohne Recht). Eine Person, deren Ablage gerade nicht zu
 * lesen ist, fehlt in dieser Liste – das ist nur eine Anzeige, sie kommt beim nächsten Öffnen wieder.
 */
export async function teilende(
  songIds: number[],
): Promise<{ id: number; name: string; songs: number[] }[]> {
  let personen: number[];
  let meineId: number;
  try {
    meineId = (await ich()).id;
    const modul = await modulId();
    const kategorie = await kategorieSuchen(modul, TEILEN_KATEGORIE.kuerzel);
    if (kategorie === null) return [];
    personen = [
      ...new Set(
        (await werteLesen(modul, kategorie)).map(personAus).filter((p): p is number => p !== null),
      ),
    ];
  } catch (e) {
    if (istDauerhaftLeer(e)) return [];
    throw e;
  }
  const out: { id: number; name: string; songs: number[] }[] = [];
  for (const personId of personen) {
    if (personId === meineId) continue;
    try {
      const a = await ablageVon(personId);
      if (!a) continue;
      const songs = geteilteLieder(a, songIds);
      if (songs.length > 0) out.push({ id: personId, name: a.name || `Person ${personId}`, songs });
    } catch (e) {
      console.warn(`[teilen] Ablage von Person ${personId} nicht lesbar:`, e);
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

async function geteiltOderVerboten(personId: number): Promise<GeteilteAblage> {
  const a = await ablageVon(personId);
  if (!a) throw new ApiError(403, 'Diese Person teilt ihre Anmerkungen nicht.');
  return a;
}

/** `GET /api/annotations/of/:personId?songs=…` – geteilte Anmerkungen einer Person (ohne Zoom). */
export async function anmerkungenVon(
  personId: number,
  songIds: number[],
): Promise<Record<string, { strokes: string | null; texts: AnnotationText[] }>> {
  return geteilteAnmerkungen(await geteiltOderVerboten(personId), songIds);
}

/** `GET /api/settings/of/:personId?songs=…` – ihre Lied-Einstellungen (für ihre Ansicht). */
export async function einstellungenVon(
  personId: number,
  songIds: number[],
): Promise<Record<string, string>> {
  return geteilteEinstellungen(await geteiltOderVerboten(personId), songIds);
}
