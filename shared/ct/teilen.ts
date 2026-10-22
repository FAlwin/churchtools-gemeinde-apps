/**
 * **Team-Notizen über ChurchTools** (#335, Phase 3b-4b) – für beide Auslieferungen seit der Ablage in
 * ChurchTools (09.10.2026). Vorher hatte der Server ein eigenes Verzeichnis auf dem Daten-Volume, und
 * was in der Erweiterung geteilt war, sah die App nicht (und umgekehrt).
 *
 * Zwei Orte, mit verteilten Rollen (Alwin, 07.10.2026: „Liste in den Erweiterungs-Daten"):
 *  - **Ob** jemand teilt, steht in SEINER Daten-Datei (`personenAblage`, Feld `teilen`). Die kann nur er
 *    selbst ändern – das ist die Wahrheit.
 *  - **Wo** man nachsehen muss, steht im Verzeichnis „Wer teilt" (Kategorie `musikapp-teilen` in den
 *    Daten des Moduls, je Person ein Wert). Sonst müsste man jeden Musiker einzeln abfragen – genau die
 *    Last, mit der ChurchTools schon einmal gebremst hat (#300). Ein Eintrag, den die Person nicht in
 *    ihrer eigenen Datei bestätigt, bewirkt nichts.
 *  - **Zu welchen Liedern** jemand Anmerkungen hat, steht seit #554 ebenfalls im Eintrag (`lieder`). So
 *    liest „Wer teilt zu diesen Liedern?" nur die Dateien derer, die zu diesen Liedern etwas haben – nicht
 *    die aller Teilenden (bei 200 Teilenden waren das ~400 Anfragen je Öffnen). Bestätigt wird weiter in der
 *    eigenen Datei; ein Eintrag ohne `lieder` (ältere Fassung der App) wird gelesen wie bisher.
 *
 * Schutz ist das keiner: Die Anhänge an einer Person können Mitglieder, die die Person sehen dürfen,
 * ohnehin öffnen (Plan §2b, von Alwin hingenommen). „Teilen" sagt nur, wessen Notizen die App anbietet.
 */
import type { AnnotationText } from '../types/index';
import {
  inhaltAus,
  istDauerhaftLeer,
  kategorieSicherstellen,
  kategorieSuchen,
  wertAnlegen,
  werteLesen,
  wertLoeschen,
  type KategorieAngabe,
  type ModulPort,
  type Wert,
} from './modulDaten';
import {
  geteilteEinstellungen,
  geteilteLieder,
  type AblagePort,
  type GeteilteAblage,
  type PersonenAblage,
} from './personenAblage';
import { createTtlMemo } from './ttlMemo';

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
  /** Lieder, zu denen die Person Anmerkungen hat (aufsteigend, #554). Fehlt bei älteren Einträgen. */
  lieder?: number[];
}

/** Ein Eintrag im Verzeichnis: wer – und zu welchen Liedern (`null` = unbekannt, also nachsehen). */
export interface VerzeichnisEintrag {
  personId: number;
  lieder: number[] | null;
}

const VERWEIGERT =
  'ChurchTools erlaubt dir nicht, dich in die Liste der Team-Notizen einzutragen. Bitte die ' +
  'Verantwortlichen nach den Rechten für „Team-Notizen der Musik App" fragen.';
const NICHT_EINGERICHTET =
  'Die Team-Notizen sind in ChurchTools nicht zu finden: Entweder hat die Verwaltung noch keine ' +
  'Gruppe gespeichert, oder dir fehlt das Recht, „Team-Notizen der Musik App" zu sehen.';

/** Alles, was das Teilen braucht – je Auslieferung anders angeschlossen. */
export interface TeilenAnschluss {
  modul: ModulPort;
  ablage: AblagePort;
  /** Die eigene Ablage (Erweiterung: die eine; Server: die der Person). */
  meineAblage: PersonenAblage;
  /** Die ID des Moduls (gemerkt beim Aufrufer). */
  modulId(): Promise<number>;
  /** Wer bin ich – ID und Anzeigename. */
  ich(): Promise<{ id: number; name: string }>;
  /** Die geteilte Ablage einer anderen Person – gemerkt beim Aufrufer; `null` = teilt nicht. */
  fremdeAblage(personId: number): Promise<GeteilteAblage | null>;
  /** Gemerkte fremde Ablagen vergessen (nach eigenem Umschalten). */
  vergissFremde(): void;
}

function personAus(w: Wert): number | null {
  const e = inhaltAus<Eintrag>(w, ART, FASSUNG);
  return e && Number.isInteger(e.personId) && e.personId > 0 ? e.personId : null;
}

/** Die Lieder eines Eintrags – `null`, wenn er keine (gültigen) nennt. */
function liederAus(w: Wert): number[] | null {
  const l = inhaltAus<Eintrag>(w, ART, FASSUNG)?.lieder;
  return Array.isArray(l) && l.every((x) => Number.isInteger(x) && x > 0) ? l : null;
}

/**
 * Was zuletzt für eine Person im Verzeichnis stand (Lieder als Schlüssel) – damit nicht jedes Speichern
 * einer Anmerkung das Verzeichnis liest. Je Person: Der Server spricht für viele. Mit Verfallszeit: Das
 * Verzeichnis kann sich auch anderswo ändern (ein anderes Gerät schaltet das Teilen neu ein, die Verwaltung
 * räumt auf) – nach zehn Minuten wird wieder nachgesehen.
 */
const gemeldet = createTtlMemo<string>(10 * 60_000);

/** Nur für Tests. */
export function _vergissGemeldet(): void {
  gemeldet.clear();
}

/**
 * Das Verzeichnis anlegen – beim Speichern der Gruppen durch einen Admin. Musiker dürfen in ChurchTools
 * meist keine Kategorien anlegen; deshalb nicht erst beim ersten Teilen.
 */
export async function teilenEinrichten(t: TeilenAnschluss): Promise<void> {
  await kategorieSicherstellen(
    t.modul,
    await t.modulId(),
    TEILEN_KATEGORIE,
    'ChurchTools erlaubt dir nicht, die Liste der Team-Notizen anzulegen.',
  );
}

/** Teilt mein Konto? Aus der eigenen Datei. */
export async function teiltIch(t: TeilenAnschluss): Promise<{ enabled: boolean }> {
  return { enabled: await t.meineAblage.holeTeilen(t.ablage) };
}

/**
 * Eigenes Teilen umschalten. Die Reihenfolge ist Absicht:
 *  - **Einschalten:** erst ins Verzeichnis, dann die eigene Datei. Scheitert das Verzeichnis (Recht
 *    fehlt), bleibt die eigene Datei unberührt – kein „an", das niemand findet.
 *  - **Ausschalten:** erst die eigene Datei – damit gilt es sofort, für jedes Gerät. Der Eintrag im
 *    Verzeichnis wird danach entfernt; bleibt er stehen (Netz), bewirkt er nichts mehr.
 */
export async function teilenSetzen(
  t: TeilenAnschluss,
  enabled: boolean,
): Promise<{ enabled: boolean }> {
  const me = await t.ich();
  const modul = await t.modulId();
  const kategorie = await kategorieSuchen(t.modul, modul, TEILEN_KATEGORIE.kuerzel);
  if (enabled) {
    if (kategorie === null) throw t.modul.fehler(409, NICHT_EINGERICHTET);
    const werte = await werteLesen(t.modul, modul, kategorie);
    if (!werte.some((w) => personAus(w) === me.id)) {
      const { lieder } = await t.meineAblage.meinTeilenStand(t.ablage);
      const eintrag: Eintrag = {
        art: ART,
        fassung: FASSUNG,
        personId: me.id,
        name: me.name,
        lieder,
      };
      await wertAnlegen(t.modul, modul, kategorie, JSON.stringify(eintrag), VERWEIGERT);
      // Nachsehen statt glauben (Lehre vom 11.08.2026).
      const nachher = await werteLesen(t.modul, modul, kategorie);
      if (!nachher.some((w) => personAus(w) === me.id)) {
        throw t.modul.fehler(
          502,
          'ChurchTools hat den Eintrag nicht übernommen. Bitte erneut versuchen.',
        );
      }
    }
    await t.meineAblage.schreibeTeilen(t.ablage, true, me.name);
    // Stand ich schon drin (etwa nach dem Umzug vom Volume), können die Lieder veraltet sein – nachführen.
    // Best effort: Das Teilen gilt auch so.
    await liederMelden(t).catch((e: unknown) => {
      console.warn('[teilen] Lieder im Verzeichnis nicht nachgeführt:', e);
    });
  } else {
    gemeldet.delete(String(me.id));
    await t.meineAblage.schreibeTeilen(t.ablage, false, me.name);
    if (kategorie !== null) {
      try {
        for (const w of await werteLesen(t.modul, modul, kategorie)) {
          if (personAus(w) === me.id)
            await wertLoeschen(t.modul, modul, kategorie, w.id, VERWEIGERT);
        }
      } catch (e) {
        console.warn('[teilen] Eintrag im Verzeichnis nicht entfernt – wirkungslos:', e);
      }
    }
  }
  t.vergissFremde();
  return { enabled };
}

/**
 * Die Einträge im Verzeichnis – je Person einer. Stehen kurz zwei da (beim Erneuern, `liederMelden`), gilt
 * die Vereinigung; nennt einer keine Lieder, ist es unbekannt. Kein Verzeichnis zu sehen (kein Recht, kein
 * Modul) → `[]`; alles andere Vorübergehende wirft.
 */
export async function verzeichnis(t: TeilenAnschluss): Promise<VerzeichnisEintrag[]> {
  try {
    const modul = await t.modulId();
    const kategorie = await kategorieSuchen(t.modul, modul, TEILEN_KATEGORIE.kuerzel);
    if (kategorie === null) return [];
    const je = new Map<number, number[] | null>();
    for (const w of await werteLesen(t.modul, modul, kategorie)) {
      const p = personAus(w);
      if (p === null) continue;
      const neu = liederAus(w);
      const da = je.get(p);
      je.set(
        p,
        da === undefined ? neu : da === null || neu === null ? null : [...new Set([...da, ...neu])],
      );
    }
    return [...je].map(([personId, lieder]) => ({ personId, lieder }));
  } catch (e) {
    if (istDauerhaftLeer(t.modul, e)) return [];
    throw e;
  }
}

/**
 * Wer aus `personen` teilt Anmerkungen zu diesen Liedern (außer mir)? Eine Person, deren Ablage gerade
 * nicht zu lesen ist, fehlt in dieser Liste – das ist nur eine Anzeige, sie kommt beim nächsten Öffnen
 * wieder.
 *
 * `lieder` (aus dem Verzeichnis, #554): Nennt der Eintrag einer Person keines dieser Lieder, wird ihre
 * Ablage gar nicht erst gelesen. Gelesen – und damit bestätigt – wird nur, wer passt oder unbekannt ist.
 */
export async function teilende(
  t: TeilenAnschluss,
  personen: number[],
  songIds: number[],
  lieder: ReadonlyMap<number, number[] | null> = new Map(),
): Promise<{ id: number; name: string; songs: number[] }[]> {
  const meineId = (await t.ich()).id;
  const ids = new Set(songIds);
  const out: { id: number; name: string; songs: number[] }[] = [];
  for (const personId of personen) {
    if (personId === meineId) continue;
    const bekannt = lieder.get(personId);
    if (bekannt && !bekannt.some((s) => ids.has(s))) continue;
    try {
      const a = await t.fremdeAblage(personId);
      if (!a) continue;
      const songs = geteilteLieder(a, songIds);
      if (songs.length > 0) out.push({ id: personId, name: a.name || `Person ${personId}`, songs });
    } catch (e) {
      console.warn(`[teilen] Ablage von Person ${personId} nicht lesbar:`, e);
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/**
 * **Meine Lieder im Verzeichnis nachführen** (#554) – nach dem Speichern eigener Anmerkungen. Kostet nichts,
 * solange sich die Lieder nicht ändern (gemerkt je Person); sonst wird der Eintrag erneuert: erst der neue,
 * nachsehen, ob er da ist, DANN der alte weg (Lehre vom 11.08.2026 – so gibt es keinen Moment ohne Eintrag).
 * Nur, wer teilt und schon im Verzeichnis steht: Ein- und Austragen bleibt Sache von `teilenSetzen`.
 */
export function liederMelden(t: TeilenAnschluss): Promise<void> {
  // Nacheinander: Zwei Speichervorgänge kurz hintereinander legten sonst zwei neue Einträge an.
  const lauf = meldeKette.then(() => liederMeldenJetzt(t));
  meldeKette = lauf.catch(() => {});
  return lauf;
}
let meldeKette: Promise<unknown> = Promise.resolve();

async function liederMeldenJetzt(t: TeilenAnschluss): Promise<void> {
  // Die eigene ID aus der Ablage (gemerkt) – `t.ich()` fragt ChurchTools und kostete je Speichern eine
  // Anfrage. Den Namen braucht es nur für einen neuen Eintrag.
  const meineId = await t.ablage.meineId();
  const stand = await t.meineAblage.meinTeilenStand(t.ablage);
  if (!stand.teilt) return;
  const schluessel = stand.lieder.join(',');
  if (gemeldet.get(String(meineId)) === schluessel) return;
  const modul = await t.modulId();
  const kategorie = await kategorieSuchen(t.modul, modul, TEILEN_KATEGORIE.kuerzel);
  if (kategorie === null) return;
  const passt = (w: Wert) => liederAus(w)?.join(',') === schluessel;
  const meine = (await werteLesen(t.modul, modul, kategorie)).filter(
    (w) => personAus(w) === meineId,
  );
  if (meine.length === 0) return;
  if (meine.length === 1 && passt(meine[0])) {
    gemeldet.set(String(meineId), schluessel);
    return;
  }
  const me = await t.ich();
  const eintrag: Eintrag = {
    art: ART,
    fassung: FASSUNG,
    personId: me.id,
    name: me.name,
    lieder: stand.lieder,
  };
  await wertAnlegen(t.modul, modul, kategorie, JSON.stringify(eintrag), VERWEIGERT);
  const nachher = (await werteLesen(t.modul, modul, kategorie)).filter(
    (w) => personAus(w) === meineId,
  );
  const neu = nachher.find(passt);
  // Nicht da: die alten Einträge stehen lassen – lieber veraltete Lieder als keine.
  if (!neu) throw t.modul.fehler(502, 'ChurchTools hat den Eintrag nicht übernommen.');
  for (const w of nachher) {
    if (w.id !== neu.id) await wertLoeschen(t.modul, modul, kategorie, w.id, VERWEIGERT);
  }
  gemeldet.set(String(meineId), schluessel);
}

async function geteiltOderVerboten(t: TeilenAnschluss, personId: number): Promise<GeteilteAblage> {
  const a = await t.fremdeAblage(personId);
  if (!a) throw t.modul.fehler(403, 'Diese Person teilt ihre Anmerkungen nicht.');
  return a;
}

/** Geteilte Anmerkungen einer Person (ohne Zoom). */
export async function anmerkungenVon(
  t: TeilenAnschluss,
  personId: number,
  songIds: number[],
): Promise<Record<string, { strokes: string | null; texts: AnnotationText[] }>> {
  return t.meineAblage.geteilteAnmerkungen(
    t.ablage,
    await geteiltOderVerboten(t, personId),
    songIds,
  );
}

/** Ihre Lied-Einstellungen (für ihre Ansicht). */
export async function einstellungenVon(
  t: TeilenAnschluss,
  personId: number,
  songIds: number[],
): Promise<Record<string, string>> {
  return geteilteEinstellungen(await geteiltOderVerboten(t, personId), songIds);
}
