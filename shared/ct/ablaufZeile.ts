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
import { dienstgruppenNotizen } from './agendaPayload';
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
    /** Das Lied in ChurchTools – für die Lied-Ansicht im Dienstplaner (E6-O O4), die es dort nachschlägt. */
    songId?: number;
    arrangementId?: number;
    /** Name des Arrangements, wie der Ablauf ihn nennt („Standard“) – Lied-Ansicht (E6-O O4). */
    arrangement?: string;
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
  const iso = ablaufBeginn(item, eventId);
  return iso === null ? null : ortszeitAus(iso, zeitzone).slice(11, 16);
}

/**
 * Der Beginn eines Punkts an diesem Termin als Zeitpunkt (ISO, UTC) – dieselbe Regel wie `ablaufUhrzeit`, für alles,
 * was sekundengenau rechnet (Live-Agenda E6b-2). `null` ohne Zeit oder wenn der Punkt weggelassen ist.
 */
export function ablaufBeginn(item: CtAgendaItem, eventId: number): string | null {
  const eintrag = item.startTimes ? item.startTimes[String(eventId)] : undefined;
  const iso = eintrag === undefined ? item.start : eintrag;
  return !iso || Number.isNaN(Date.parse(iso)) ? null : iso;
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
  /** Die Infos je Dienstgruppe (E6-4): Gruppe → Text. Verglichen wird nur, was man ändert. */
  infos?: Record<number, string>;
}

export function punktStand(
  z: Pick<AblaufZeile, 'title' | 'responsibleText' | 'durationMin' | 'note' | 'song' | 'infos'>,
): PunktStand {
  return {
    title: z.title,
    responsibleText: z.responsibleText,
    durationMin: z.durationMin,
    note: z.note,
    lied: z.song ? (z.song.arrangementId ?? z.song.title) : null,
    infos: Object.fromEntries((z.infos ?? []).map((i) => [i.gruppeId, i.text])),
  };
}

/** Ein ChurchTools-Punkt als Zeile – ohne Lied-Auflösung. */
export function ablaufZeileAus(item: CtAgendaItem, eventId: number, zeitzone: string): AblaufZeile {
  const sekunden = item.duration ?? 0;
  // Infos je Dienstgruppe (E6-4) – dieselbe Auswahl wie beim Mitschreiben (`dienstgruppenNotizen`): nur mit Text.
  const infos = dienstgruppenNotizen(item).map((n) => ({
    gruppeId: n.serviceGroupId,
    text: n.note,
  }));
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
          ...(typeof item.song.songId === 'number' ? { songId: item.song.songId } : {}),
          ...(typeof item.song.arrangementId === 'number'
            ? { arrangementId: item.song.arrangementId }
            : {}),
          ...(item.song.arrangement ? { arrangement: item.song.arrangement } : {}),
          originalKey: item.song.key ?? null,
          bpm: item.song.bpm ?? null,
        }
      : null,
    time: ablaufUhrzeit(item, eventId, zeitzone),
    vorBeginn: item.isBeforeEvent ?? false,
    durationMin: sekunden > 0 ? Math.round(sekunden / 60) : null,
    note: item.note ?? '',
    weggelassen: istWeggelassen(item, eventId),
    ...(infos.length > 0 ? { infos } : {}),
  };
}

// ── Bezeichnung (#200) ───────────────────────────────────────────────────────
// ChurchTools speichert bei einem Lied-Punkt zwei Dinge: den eigenen Titel (oft schlicht „Lied“) und das Lied.
// Angezeigt wird beides: **Lied** – *Du großer Gott*. (Aus `client/src/utils/agendaItemTitle.ts` hierher.)

/** Das Minimum, das für die Bezeichnung nötig ist. */
interface TitelQuelle {
  title: string;
  /** `null` oder fehlend: kein Lied (der rohe Punkt von ChurchTools lässt das Feld weg). */
  song?: { title: string } | null;
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

/**
 * Die Zuständigen einer Zeile als eine Zeile Text („Anna Schmidt, Ton“) – Namen bzw. offene Dienste, wie die Kreise sie
 * zeigen. Nicht `responsibleText`: das ist der rohe Text aus ChurchTools („[Ton], [Bild]“). Eine Stelle für „Ablauf
 * zeigen“, Live und „Davor / Danach“ der Punkt-Seite.
 */
export function zustaendigeText(z: Pick<AblaufZeile, 'responsible'>): string {
  return z.responsible.map((r) => r.label).join(', ');
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

/**
 * **Wann der Ablauf endet** („10:44“) – Uhrzeit des letzten Punkts mit Uhrzeit plus seine Dauer. ChurchTools zeigt
 * diese Zeit selbst nicht an; gerechnet wird nur aus seinen Zeiten (Matrix, Balken „Ende“; Alwin 29.10.2026,
 * Entwurf `e6-6-trennung.html` C). Weggelassene Punkte haben keine Uhrzeit (`ablaufUhrzeit`) und zählen so von selbst
 * nicht; „entfernt“-Platzhalter der Musik-App zählen ebenfalls nicht.
 * `null`, wenn kein Punkt eine Uhrzeit hat.
 */
export function ablaufEnde(
  zeilen: readonly Pick<AblaufZeile, 'time' | 'durationMin' | 'removed'>[],
): string | null {
  for (let i = zeilen.length - 1; i >= 0; i--) {
    const z = zeilen[i];
    if (z.removed || !z.time) continue;
    return zeitPlus(z.time, z.durationMin ?? 0);
  }
  return null;
}

/** „10:00“ + 4 Min → „10:04“ (über Mitternacht weiter bei 00:…). `null`, wenn die Uhrzeit keine ist. */
export function zeitPlus(zeit: string, minuten: number): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(zeit);
  if (!m) return null;
  const gesamt = (Number(m[1]) * 60 + Number(m[2]) + minuten) % (24 * 60);
  return `${String(Math.floor(gesamt / 60)).padStart(2, '0')}:${String(gesamt % 60).padStart(2, '0')}`;
}

/** 95 → „1 Std. 35 Min“, 60 → „1 Std.“, 14 → „14 Min“. */
export function dauerText(minuten: number): string {
  const h = Math.floor(minuten / 60);
  const m = minuten % 60;
  if (h === 0) return `${m} Min`;
  return m === 0 ? `${h} Std.` : `${h} Std. ${m} Min`;
}

/** Minuten zwischen zwei Uhrzeiten („10:00“ → „11:35“ = 95), über Mitternacht weiter. `null` ohne gültige Zeiten. */
export function minutenZwischen(von: string, bis: string): number | null {
  const m = (z: string) => {
    const t = /^(\d{1,2}):(\d{2})$/.exec(z);
    return t ? Number(t[1]) * 60 + Number(t[2]) : null;
  };
  const a = m(von);
  const b = m(bis);
  if (a === null || b === null) return null;
  return (b - a + 24 * 60) % (24 * 60);
}

/** Wie lange ein Ablauf dauert, in Minuten (`ablaufDauer`). */
export interface AblaufDauer {
  /** Von „Beginn“ (Uhrzeit des Termins) bis „Ende“ – `null` ohne Beginn oder ohne Ende. */
  abBeginn: number | null;
  /** Vom ersten Punkt mit Uhrzeit bis „Ende“ – nur, wenn Vorlauf dabei ist; sonst `null`. */
  mitVorlauf: number | null;
}

/**
 * **Wie lange der Ablauf insgesamt dauert** (Alwin, 28.11.2026: „wie lange alle Elemente insgesamt dauern“) – von
 * „Beginn“ bis „Ende“ (`ablaufEnde`), und mit Vorlauf vom ersten Punkt mit Uhrzeit bis „Ende“. Die Rechnung des
 * Termin-PDFs (seit 05.11.2026), hierher gezogen, damit Balken „Ende“ und PDF nie auseinanderlaufen. ChurchTools rechnet
 * die Uhrzeiten lückenlos aus den Dauern – das ist also die Summe der Dauern; weggelassene Punkte haben keine Uhrzeit
 * und zählen so von selbst nicht, „entfernt“-Platzhalter der Musik-App ebenfalls nicht.
 * `beginn` ist die reine Uhrzeit („10:00“); ein angehängtes „Uhr“ (Musik-App: `service.time`) stört nicht.
 */
export function ablaufDauer(
  zeilen: readonly Pick<AblaufZeile, 'time' | 'durationMin' | 'removed' | 'vorBeginn'>[],
  beginn: string | null | undefined,
): AblaufDauer {
  const da = zeilen.filter((z) => !z.removed);
  const ende = ablaufEnde(da);
  if (!ende) return { abBeginn: null, mitVorlauf: null };
  const start = beginn?.replace(/\s*Uhr$/, '');
  const erste = da.find((z) => z.time)?.time;
  return {
    abBeginn: start ? minutenZwischen(start, ende) : null,
    mitVorlauf: erste && da.some((z) => z.vorBeginn) ? minutenZwischen(erste, ende) : null,
  };
}

/**
 * Die Teile des Dauer-Texts: `['Dauer 44 Min', 'mit Vorlauf 1 Std. 14 Min']` – einzeln, damit der Balken „Ende“ in einer
 * schmalen Matrix-Spalte zwischen den Teilen umbricht statt mitten in „1 Std.“. Leer, wenn nichts zu sagen ist.
 */
export function ablaufDauerTeile(
  d: AblaufDauer,
  { vorlauf = true }: { vorlauf?: boolean } = {},
): string[] {
  const teile: string[] = [];
  if (d.abBeginn !== null) teile.push(`Dauer ${dauerText(d.abBeginn)}`);
  if (vorlauf && d.mitVorlauf !== null && d.mitVorlauf !== d.abBeginn) {
    teile.push(`mit Vorlauf ${dauerText(d.mitVorlauf)}`);
  }
  return teile;
}

/**
 * „Dauer 35 Min“ – nur ab Beginn, für Kopfzeilen neben „Ende“ (Termin-Kopf, Vollbild-Anzeige; Alwin, 28.11.2026).
 * `null` ohne Beginn oder Ende.
 */
export function ablaufDauerKurz(d: AblaufDauer): string | null {
  return ablaufDauerTeile(d, { vorlauf: false })[0] ?? null;
}

/** „Dauer 44 Min · mit Vorlauf 1 Std. 14 Min“ – die Zeile „Ende“ im Termin-PDF. */
export function ablaufDauerText(d: AblaufDauer): string {
  return ablaufDauerTeile(d).join(' · ');
}

/** „[Musik], Peter“ → „Musik, Peter“ – in der Feldliste stehen Dienste ohne Klammern (wie die ChurchTools-App). */
export const zustaendigText = (text: string) => text.replace(/\[([^\]]+)\]/g, '$1').trim();

/**
 * **Wer in einer Ablaufvorlage zuständig ist** (E10-V3a): Eine Vorlage hat nie Personen, nur Dienste als Platzhalter –
 * ChurchTools schreibt `[Moderation]` in den Text. Sie stehen so da, wie sie gespeichert sind, nicht als offener Dienst
 * mit „?“ (der gehört an einen Termin, an dem noch jemand fehlt). Ohne Text, aber mit Diensten aus `persons[]`
 * (`responsibleEntries`), kommen die Dienste in eckigen Klammern; eine Person ohne Klammern bleibt, wie sie ist.
 */
export function platzhalterZeile(
  responsibleText: string,
  entries: readonly { label: string; open: boolean }[],
): string[] {
  const ausText = responsibleText
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '');
  if (ausText.length > 0) return ausText;
  return entries.map((e) => (e.open ? `[${e.label}]` : e.label));
}
