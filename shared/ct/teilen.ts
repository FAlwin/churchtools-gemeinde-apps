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
      const eintrag: Eintrag = { art: ART, fassung: FASSUNG, personId: me.id, name: me.name };
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
  } else {
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
 * Die Personen im Verzeichnis. Kein Verzeichnis zu sehen (kein Recht, kein Modul) → `[]`; alles andere
 * Vorübergehende wirft.
 */
export async function verzeichnis(t: TeilenAnschluss): Promise<number[]> {
  try {
    const modul = await t.modulId();
    const kategorie = await kategorieSuchen(t.modul, modul, TEILEN_KATEGORIE.kuerzel);
    if (kategorie === null) return [];
    return [
      ...new Set(
        (await werteLesen(t.modul, modul, kategorie))
          .map(personAus)
          .filter((p): p is number => p !== null),
      ),
    ];
  } catch (e) {
    if (istDauerhaftLeer(t.modul, e)) return [];
    throw e;
  }
}

/**
 * Wer aus `personen` teilt Anmerkungen zu diesen Liedern (außer mir)? Eine Person, deren Ablage gerade
 * nicht zu lesen ist, fehlt in dieser Liste – das ist nur eine Anzeige, sie kommt beim nächsten Öffnen
 * wieder.
 */
export async function teilende(
  t: TeilenAnschluss,
  personen: number[],
  songIds: number[],
): Promise<{ id: number; name: string; songs: number[] }[]> {
  const meineId = (await t.ich()).id;
  const out: { id: number; name: string; songs: number[] }[] = [];
  for (const personId of personen) {
    if (personId === meineId) continue;
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
