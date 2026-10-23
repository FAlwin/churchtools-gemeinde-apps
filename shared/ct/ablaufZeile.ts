/**
 * **Eine Ablaufzeile zum Anzeigen** – die Regeln, die Musik-App und Dienstplaner (Bauplan E6-1) gleich brauchen,
 * an einer Stelle: Uhrzeit (mit „Auge“), Vorlauf, Dauer, Notiz, Zuständige, Überschrift, Bezeichnung mit Lied.
 * Vorher steckten sie in `ablaufPunkte` (Musik-App, `setlistKern.ts`) und in `client/src/utils/` – der Dienstplaner
 * hätte sie sonst nachgebaut.
 *
 * Lieder werden hier **nicht** aufgelöst (keine Akkord-Dateien): Der Dienstplaner zeigt nur den Liednamen, die
 * Musik-App ergänzt das ganze Lied in `ablaufPunkte`.
 */
import type { AgendaItem } from '../types/index';
import type { CtAgendaItem } from './typen';
import { isHeaderType, responsibleEntries } from './agendaFormat';
import { ortszeitAus } from './zeit';

/** Was eine Zeile zeigt – `AgendaItem` der Musik-App passt hinein (das Lied dort trägt mehr). */
export type AblaufZeile = Omit<AgendaItem, 'song' | 'changed' | 'neu' | 'removed'> & {
  /**
   * Das Lied – Name zum Anzeigen, Arrangement zum Vergleichen (E6-3c: ein anderes Arrangement ist ein anderes Lied).
   * Tonart, Tempo und Autor für die Lied-Karte (E6-O1) – dieselben Namen wie `SetlistSong` der Musik-App, damit deren
   * Punkte ohne Umbau passen. Den Autor liefert der Ablauf nicht (gemessen E6-O0); der Dienstplaner holt ihn nach.
   */
  song: {
    title: string;
    arrangementId?: number;
    originalKey?: string | null;
    bpm?: number | null;
    author?: string | null;
  } | null;
  removed?: boolean;
};

/**
 * Die Uhrzeit eines Punkts an diesem Termin, in der Zeitzone der Gemeinde („10:05“) – `null`, wenn ChurchTools
 * keine nennt. **Maßgeblich ist `startTimes[termin]`:** Ist der Eintrag `null`, hat jemand den Punkt an diesem
 * Termin ausgeblendet (Auge); `start` bleibt dann gefüllt und ist unbrauchbar. Fehlt `startTimes` ganz, gilt `start`.
 *
 * Vorher fest `Europe/Berlin` (`formatBerlinTime`) – obwohl der Leser die Zeitzone der Gemeinde kennt (#414).
 */
export function ablaufUhrzeit(
  item: CtAgendaItem,
  eventId: number,
  zeitzone: string,
): string | null {
  const eintrag = item.startTimes ? item.startTimes[String(eventId)] : undefined;
  const iso = eintrag === undefined ? item.start : eintrag;
  if (!iso || Number.isNaN(Date.parse(iso))) return null;
  return ortszeitAus(iso, zeitzone).slice(11, 16);
}

/**
 * Ist der Punkt **an diesem Termin weggelassen** (Auge, E6-3b)? Dasselbe Merkmal wie bei der Uhrzeit: `startTimes`
 * nennt den Termin, aber mit `null` (gemessen E6-3-0: `hide` setzt genau das, die Folgepunkte rücken vor). Fehlt
 * `startTimes` oder der Termin darin, ist nichts weggelassen – ältere Antworten kennen das Feld nicht.
 */
export function istWeggelassen(item: CtAgendaItem, eventId: number): boolean {
  return item.startTimes?.[String(eventId)] === null;
}

/**
 * **Was das Punkt-Fenster beim Öffnen gesehen hat** (E6-3c, #659) – die Felder, die man dort ändern kann, so wie die
 * Zeile sie zeigt. Der Schreibkern vergleicht damit den frischen Stand (`punktAendern`): Hat jemand genau ein Feld
 * geändert, das ich auch ändere, wird nicht still überschrieben. Beide Seiten laufen durch `ablaufZeileAus` – sonst
 * hielte schon eine gerundete Dauer einen unveränderten Punkt für geändert.
 */
export interface PunktStand {
  title: string;
  responsibleText: string;
  durationMin: number | null;
  note: string;
  /** Das Lied: sein Arrangement (ohne eins der Name), `null` ohne Lied. */
  lied: number | string | null;
}

export function punktStand(
  z: Pick<AblaufZeile, 'title' | 'responsibleText' | 'durationMin' | 'note' | 'song'>,
): PunktStand {
  return {
    title: z.title,
    responsibleText: z.responsibleText,
    durationMin: z.durationMin,
    note: z.note,
    lied: z.song ? (z.song.arrangementId ?? z.song.title) : null,
  };
}

/** Ein ChurchTools-Punkt als Zeile – ohne Lied-Auflösung. */
export function ablaufZeileAus(item: CtAgendaItem, eventId: number, zeitzone: string): AblaufZeile {
  const sekunden = item.duration ?? 0;
  return {
    id: item.id,
    title: item.title,
    type: item.type ?? null,
    isHeader: isHeaderType(item.type),
    responsible: responsibleEntries(item),
    responsibleText: item.responsible?.text ?? '',
    song: item.song
      ? {
          title: item.song.title,
          ...(typeof item.song.arrangementId === 'number'
            ? { arrangementId: item.song.arrangementId }
            : {}),
          originalKey: item.song.key ?? null,
          bpm: item.song.bpm ?? null,
        }
      : null,
    time: ablaufUhrzeit(item, eventId, zeitzone),
    vorBeginn: item.isBeforeEvent ?? false,
    durationMin: sekunden > 0 ? Math.round(sekunden / 60) : null,
    note: item.note ?? '',
    weggelassen: istWeggelassen(item, eventId),
  };
}

// ── Bezeichnung (#200) ───────────────────────────────────────────────────────
// ChurchTools speichert bei einem Lied-Punkt zwei Dinge: den eigenen Titel (oft schlicht „Lied“) und das Lied.
// Angezeigt wird beides: **Lied** – *Du großer Gott*. (Aus `client/src/utils/agendaItemTitle.ts` hierher.)

/** Das Minimum, das für die Bezeichnung nötig ist. */
interface TitelQuelle {
  title: string;
  song: { title: string } | null;
}

export interface TitelTeile {
  /** Hauptbezeichnung: der eigene Titel – bzw. der Liedname, wenn es keinen eigenen gibt. */
  title: string;
  /** Zusätzlich anzuzeigender Liedname; null, wenn er nichts hinzufügt (kein Lied / Dopplung). */
  songName: string | null;
}

/**
 * Zerlegt einen Punkt in die Anzeige-Teile. Der Liedname entfällt, wenn er nichts hinzufügt: ohne eigenen Titel
 * (dann IST der Liedname die Bezeichnung) oder wenn der Titel schon derselbe ist.
 */
export function itemTitleParts(item: TitelQuelle): TitelTeile {
  const own = item.title.trim();
  const song = item.song?.title.trim() ?? '';
  // Auch ohne Lied getrimmt zurückgeben (#215).
  if (!song) return { title: own, songName: null };
  if (!own || own.toLocaleLowerCase('de') === song.toLocaleLowerCase('de')) {
    return { title: song, songName: null };
  }
  return { title: own, songName: song };
}

/** Einzeilige Klartext-Bezeichnung für Dialoge/Meldungen (z. B. „Lied – Du großer Gott“). */
export function itemLabel(item: TitelQuelle): string {
  const { title, songName } = itemTitleParts(item);
  return songName ? `${title} – ${songName}` : title;
}

// ── Vorlauf (#423) ───────────────────────────────────────────────────────────

/** Was eine Zeile mindestens tragen muss – auch die „entfernt“-Platzhalter der Musik-App (#161). */
type MitVorlauf = { removed?: boolean; vorBeginn?: boolean };

/**
 * Vor welcher Zeile der Balken „Beginn“ steht – `-1`, wenn es keinen Vorlauf gibt (dann wäre er nur Lärm).
 * Sind ALLE Punkte Vorlauf, steht sie am Ende. „Entfernt“-Platzhalter zählen nicht.
 * (Aus `client/src/utils/vorlauf.ts` hierher.)
 */
export function beginnStelle(zeilen: readonly MitVorlauf[]): number {
  let vorlauf = false;
  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i];
    if (z.removed) continue;
    if (z.vorBeginn) vorlauf = true;
    else return vorlauf ? i : -1;
  }
  return vorlauf ? zeilen.length : -1;
}

/**
 * **Der Vorlauf nach dem Umsortieren** – so, wie ChurchTools ihn danach rechnen wird (#423; seit E6-2b-3 hier neben
 * `beginnStelle`, vorher `client/src/utils/vorlauf.ts`). Die Grenze ist in ChurchTools eine **Platznummer** (gemessen
 * 05.10.2026): Umsortieren lässt sie stehen, ein über die Grenze geschobener Punkt wechselt die Seite. Die Liste
 * übernimmt das sofort, statt die Linie mit dem verschobenen Punkt wandern zu lassen und nach dem Neuladen
 * umzuspringen. Unveränderte Punkte bleiben dieselben Objekte.
 */
export function vorlaufNachUmsortieren<T extends { vorBeginn?: boolean }>(
  vorher: readonly T[],
  nachher: T[],
): T[] {
  const anzahl = vorher.filter((i) => i.vorBeginn).length;
  return nachher.map((item, i) => {
    const vorBeginn = i < anzahl;
    return (item.vorBeginn ?? false) === vorBeginn ? item : { ...item, vorBeginn };
  });
}
