/**
 * Lieder und Arrangements **anlegen, ändern, löschen** – für beide Auslieferungen (#335, Phase 3b-2).
 *
 * Lag bis dahin im Server (`songVerwaltung.ts`, `arrangementVerwaltung.ts`, Teile von `ctWrite.ts`).
 * Die ChurchTools-Extension schreibt aus dem Browser und braucht **dieselben** Prüfungen: das Recht an
 * der Kategorie, die Sperre gegen eine doppelte CCLI-Nummer, „nachsehen statt glauben" nach dem
 * Anlegen, die Geländer beim Löschen eines Arrangements. Eine zweite Fassung im Client wäre genau die
 * Fehlerklasse, die dieses Projekt am meisten gekostet hat.
 *
 * In der Server-Variante sind die Prüfungen eine echte Schranke (der Server sitzt dazwischen). In der
 * Extension schreibt der Browser mit der Sitzung der Person – mehr als in ChurchTools selbst darf sie
 * dort ohnehin nie; die Prüfungen ersparen ihr aber Aufträge, die ChurchTools ablehnen würde, und die
 * CCLI-Sperre ist eine Regel der App, keine von ChurchTools.
 *
 * **Ein Lied anlegen sind zwei Schreibvorgänge, die einzeln scheitern können** (Lied, dann Arrangement).
 * ChurchTools kennt dafür keine Transaktion. Scheitert der zweite, liegt ein Lied ohne Arrangement da –
 * und genau das muss die App sagen. **Nichts wird automatisch wiederholt oder zurückgenommen.**
 */
import type {
  ArrangementAnsicht,
  ArrangementAuftrag,
  LiedAngelegt,
  LiedAnlegenAuftrag,
  LiedStammdaten,
  LiedStammdatenAnsicht,
  SongCategory,
  SongSource,
} from '../types/index';
import { ccliSchluessel } from '../lieder/index';
import { arrangementWritePayload, nummerOhneQuelle } from './arrangementPayload';
import {
  arrangementAendern as arrangementSchreiben,
  arrangementAus,
  type CtSchreiber,
} from './schreibKern';
import { songWritePayload, type SongOverrides } from './songPayload';
import { arrangementTempo, type CtArrangement, type CtSong, type CtSongListEntry } from './typen';

/** Was die Liedverwaltung zusätzlich zum Schreiben braucht. */
export interface CtVerwalter extends CtSchreiber {
  /** Alle Lieder (seitenweise) – für die CCLI-Sperre. */
  alleLieder(): Promise<CtSongListEntry[]>;
  /** Die Kategorien, in denen die Person Lieder anlegen/ändern darf (`bearbeitbareKategorien`). */
  bearbeitbareKategorien(): Promise<SongCategory[]>;
  /** Die Liedquellen (Liederbücher) der Gemeinde. */
  quellen(): Promise<SongSource[]>;
}

/**
 * Die ID des eben angelegten Datensatzes aus der Antwort – oder ein Fehler. Ein `201` heißt nicht,
 * dass wir wissen, WAS entstanden ist (Lehre vom 11.08.2026). Gemessen: `POST /api/songs` und
 * `POST …/arrangements` antworten beide `201` mit `{data: {id}}`.
 */
function neueId(s: CtSchreiber, antwort: unknown, was: string): number {
  const id = (antwort as { data?: { id?: unknown } } | null)?.data?.id;
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    throw s.fehler(502, `${was} wurde angelegt, aber ChurchTools nannte keine ID.`);
  }
  return id;
}

// ── Die Schreibvorgänge selbst ───────────────────────────────────────────────

/** Legt ein Lied an und liefert seine ID. Leere Felder gehen gar nicht erst hinaus. */
export async function liedErzeugen(s: CtSchreiber, daten: LiedStammdaten): Promise<number> {
  const body: Record<string, unknown> = { name: daten.name, categoryId: daten.categoryId };
  // ChurchTools soll seine Vorgaben behalten, statt sie mit "" zu überschreiben.
  if (daten.author?.trim()) body.author = daten.author.trim();
  if (daten.ccli?.trim()) body.ccli = daten.ccli.trim();
  if (daten.copyright?.trim()) body.copyright = daten.copyright.trim();
  const antwort = await s.schreibe('/songs', {
    method: 'POST',
    json: body,
    verweigert: 'Keine Berechtigung, in dieser Kategorie Lieder anzulegen.',
    fehler: 'Lied anlegen fehlgeschlagen',
  });
  return neueId(s, antwort, 'Das Lied');
}

/**
 * Ändert die Stammdaten – **lesen–ändern–schreiben**, weil ein Teil-`PUT` die übrigen Felder löscht
 * (gemessen, siehe `songPayload.ts`). Liefert das Lied, wie ChurchTools es DANACH liest.
 */
export async function liedSchreiben(
  s: CtSchreiber,
  songId: number,
  aenderung: SongOverrides,
  bereitsGelesen?: CtSong,
): Promise<CtSong> {
  const song = bereitsGelesen ?? (await s.song(songId));
  await s.schreibe(`/songs/${songId}`, {
    method: 'PUT',
    json: songWritePayload(song, aenderung),
    verweigert: 'Keine Berechtigung, dieses Lied in ChurchTools zu ändern.',
    fehler: 'Lied ändern fehlgeschlagen',
  });
  // Nachsehen statt glauben (Lehre vom 11.08.2026): Was steht danach wirklich im Datensatz?
  return s.song(songId);
}

export async function liedEntfernen(s: CtSchreiber, songId: number): Promise<void> {
  await s.schreibe(`/songs/${songId}`, {
    method: 'DELETE',
    verweigert: 'Keine Berechtigung, dieses Lied in ChurchTools zu löschen.',
    fehler: 'Lied löschen fehlgeschlagen',
    okBei404: true,
  });
}

/**
 * Legt ein Arrangement an. Der Payload wird aus einem **leeren** Arrangement gebaut – so durchläuft
 * auch das Anlegen die Quelle-Nummer-Regel und die Trimm-Regeln aus `arrangementWritePayload`.
 * Den Standard setzt ChurchTools über `isDefault` beim Anlegen; später geht er nur über
 * `arrangementStandardSetzen`.
 */
export async function arrangementErzeugen(
  s: CtSchreiber,
  songId: number,
  daten: { name: string; isDefault?: boolean } & ArrangementAuftrag,
): Promise<number> {
  const { name, isDefault, ...felder } = daten;
  const leer: CtArrangement = {
    id: 0,
    name,
    key: null,
    keyOfArrangement: null,
    bpm: null,
    beat: null,
    files: [],
  };
  const body = arrangementWritePayload(leer, felder);
  body.isDefault = isDefault ?? true;
  const antwort = await s.schreibe(`/songs/${songId}/arrangements`, {
    method: 'POST',
    json: body,
    verweigert: 'Keine Berechtigung, Arrangements in ChurchTools anzulegen.',
    fehler: 'Arrangement anlegen fehlgeschlagen',
  });
  return neueId(s, antwort, 'Das Arrangement');
}

/**
 * Macht ein Arrangement zum Standard. **Gemessen, nicht geraten** (20.09.2026): `PUT { isDefault }`
 * antwortet 200 und ändert nichts; richtig ist `PATCH …/default` ohne Rumpf – so macht es die
 * ChurchTools-Oberfläche selbst. ChurchTools nimmt dem bisherigen Standard das Flag von sich aus ab.
 */
export async function arrangementStandardSetzen(
  s: CtSchreiber,
  songId: number,
  arrangementId: number,
): Promise<void> {
  await s.schreibe(`/songs/${songId}/arrangements/${arrangementId}/default`, {
    method: 'PATCH',
    verweigert: 'Keine Berechtigung, den Standard in ChurchTools zu ändern.',
    fehler: 'Standard-Arrangement setzen fehlgeschlagen',
  });
}

/** Löscht ein Arrangement – samt Notenblättern, Dateien und Versionen. „Schon weg" ist kein Fehler. */
export async function arrangementEntfernen(
  s: CtSchreiber,
  songId: number,
  arrangementId: number,
): Promise<void> {
  await s.schreibe(`/songs/${songId}/arrangements/${arrangementId}`, {
    method: 'DELETE',
    verweigert: 'Keine Berechtigung, Arrangements in ChurchTools zu löschen.',
    fehler: 'Arrangement löschen fehlgeschlagen',
    okBei404: true,
  });
}

// ── Prüfungen ────────────────────────────────────────────────────────────────

/**
 * Darf die Person in dieser Kategorie arbeiten? Benutzt wird dieselbe Liste, die auch die Auswahl
 * füllt. **Beim Ändern zweimal:** für die Kategorie, in der das Lied liegt, und für die Ziel-Kategorie.
 */
export async function pruefeKategorie(
  s: CtVerwalter,
  categoryId: number,
  was = 'anlegen',
): Promise<void> {
  const erlaubt = await s.bearbeitbareKategorien();
  if (!erlaubt.some((k) => k.id === categoryId)) {
    throw s.fehler(403, `In dieser Kategorie darfst du keine Lieder ${was}.`);
  }
}

/**
 * Blockiert ein zweites Lied mit **derselben CCLI-Nummer** (Entscheidung Alwin, 13.08.2026).
 * Verglichen wird über `ccliSchluessel` (getrimmter Text, nie eine Zahl). **Über ALLE Lieder**, nicht
 * die Bibliothek: Die wirft Lieder ohne Arrangement weg – genau so eines entsteht, wenn beim Anlegen
 * der zweite Schritt scheitert. `eigenesLied`: Beim Ändern trägt das Lied seine Nummer schon selbst.
 */
async function pruefeDoppel(
  s: CtVerwalter,
  ccli: string | undefined,
  eigenesLied?: number,
): Promise<void> {
  const nummer = ccliSchluessel(ccli);
  if (!nummer) return;
  const treffer = (await s.alleLieder()).find(
    (l) => ccliSchluessel(l.ccli) === nummer && l.id !== eigenesLied,
  );
  if (treffer) {
    throw s.fehler(
      409,
      `Die CCLI-Nummer ${nummer} hat schon „${treffer.name}". ` +
        (eigenesLied === undefined
          ? 'Dasselbe Lied ein zweites Mal anzulegen würde das Team verwirren – ergänze lieber ein ' +
            'Arrangement am vorhandenen Lied.'
          : 'Zwei Lieder mit derselben Nummer wären nicht mehr auseinanderzuhalten.'),
    );
  }
}

// ── Lieder ───────────────────────────────────────────────────────────────────

/** Die Stammdaten-Antwort – einmal, für Lesen und Schreiben. */
export function stammdatenAnsicht(song: CtSong): LiedStammdatenAnsicht {
  return {
    songId: song.id,
    name: song.name,
    author: song.author,
    ccli: song.ccli,
    copyright: song.copyright ?? null,
    categoryId: song.category?.id ?? null,
  };
}

/**
 * Legt Lied + Arrangement an. **Am Ende wird nachgesehen, nicht geglaubt:** Das abschließende Lesen
 * belegt, dass beides wirklich existiert.
 */
export async function liedAnlegen(
  s: CtVerwalter,
  auftrag: LiedAnlegenAuftrag,
): Promise<LiedAngelegt> {
  await pruefeKategorie(s, auftrag.categoryId);
  await pruefeDoppel(s, auftrag.ccli);

  const songId = await liedErzeugen(s, {
    name: auftrag.name,
    categoryId: auftrag.categoryId,
    author: auftrag.author,
    ccli: auftrag.ccli,
    copyright: auftrag.copyright,
  });

  let arrangementId: number;
  try {
    arrangementId = await arrangementErzeugen(s, songId, {
      name: auftrag.arrangementName?.trim() || 'Standard',
      key: auftrag.key,
      isDefault: true,
    });
  } catch (err) {
    // Der Zwischenzustand wird benannt, nicht verschluckt – ein bloßes „fehlgeschlagen" brächte den
    // Nutzer dazu, es erneut zu versuchen, und dann läge das Lied zweimal da.
    const grund = err instanceof Error ? err.message : String(err);
    throw s.fehler(
      502,
      `„${auftrag.name}" wurde in ChurchTools angelegt, aber ohne Arrangement – und ohne eines ist ` +
        `ein Lied nicht benutzbar. Bitte in ChurchTools ein Arrangement ergänzen oder das Lied dort ` +
        `löschen; ein zweiter Versuch hier würde es doppelt anlegen. (${grund})`,
    );
  }

  const song = await s.song(songId);
  if (!song.arrangements.some((a) => a.id === arrangementId)) {
    throw s.fehler(
      502,
      `„${auftrag.name}" wurde angelegt, aber ChurchTools zeigt das Arrangement nicht an. Bitte dort ` +
        'nachsehen, bevor du es erneut versuchst.',
    );
  }
  return { songId, arrangementId };
}

/** Ändert die Stammdaten: Recht an alter und neuer Kategorie, CCLI-Sperre, lesen–ändern–schreiben. */
export async function liedAendern(
  s: CtVerwalter,
  songId: number,
  aenderung: SongOverrides,
): Promise<CtSong> {
  const song = await s.song(songId);
  const heute = song.category?.id;
  if (typeof heute === 'number') await pruefeKategorie(s, heute, 'ändern');
  if (aenderung.categoryId !== undefined && aenderung.categoryId !== heute) {
    await pruefeKategorie(s, aenderung.categoryId, 'ablegen');
  }
  await pruefeDoppel(s, aenderung.ccli, songId);
  // Das gelesene Lied wird weitergegeben – ein zweites Lesen wäre eine Anfrage für nichts (#300).
  return liedSchreiben(s, songId, aenderung, song);
}

/** Löscht ein Lied – mit dem Recht an SEINER Kategorie. Der Name wird vorher gelesen (für die Meldung). */
export async function liedLoeschen(s: CtVerwalter, songId: number): Promise<{ name: string }> {
  const song = await s.song(songId);
  const kategorie = song.category?.id;
  if (typeof kategorie === 'number') await pruefeKategorie(s, kategorie, 'löschen');
  await liedEntfernen(s, songId);
  return { name: song.name };
}

// ── Arrangements ─────────────────────────────────────────────────────────────

const ARRANGEMENT_FEHLT = 'Dieses Arrangement gibt es in ChurchTools nicht (mehr).';

/** Ein Arrangement so, wie die Verwaltung es zeigt (#396). */
export function arrangementAnsicht(arr: CtArrangement): ArrangementAnsicht {
  const quelle = arr.source ?? null;
  return {
    id: arr.id,
    name: arr.name,
    isDefault: arr.isDefault === true,
    key: arr.key ?? arr.keyOfArrangement ?? null,
    tempo: arrangementTempo(arr),
    beat: arr.beat ?? null,
    duration: typeof arr.duration === 'number' ? arr.duration : null,
    // `note` ist ChurchTools' alter Name für dasselbe Feld – siehe `arrangementPayload.ts`.
    description: arr.description ?? arr.note ?? null,
    source:
      quelle && typeof quelle.id === 'number'
        ? { id: quelle.id, name: quelle.name ?? '', shorty: quelle.shorty ?? '' }
        : null,
    sourceReference: arr.sourceReference ?? null,
    dateien: arr.files.length,
  };
}

/** Das Lied lesen und das Recht an seiner Kategorie prüfen – wer das Lied nicht ändern darf, darf auch seine Arrangements nicht. */
async function liedMitRecht(s: CtVerwalter, songId: number, was: string): Promise<CtSong> {
  const song = await s.song(songId);
  const kategorie = song.category?.id;
  if (typeof kategorie === 'number') await pruefeKategorie(s, kategorie, was);
  return song;
}

/**
 * Prüft die Quelle, **bevor** geschrieben wird (#396): Eine Liednummer speichert ChurchTools nur mit
 * Quelle, und eine Quelle muss es geben.
 */
async function pruefeQuelle(
  s: CtVerwalter,
  arr: CtArrangement,
  auftrag: ArrangementAuftrag,
): Promise<void> {
  if (nummerOhneQuelle(arr, auftrag)) {
    throw s.fehler(
      400,
      'Eine Liednummer speichert ChurchTools nur zusammen mit einer Quelle. Bitte erst das ' +
        'Liederbuch auswählen – oder die Nummer weglassen.',
    );
  }
  if (auftrag.sourceId === undefined || auftrag.sourceId === null) return;
  const quellen = await s.quellen();
  if (!quellen.some((q) => q.id === auftrag.sourceId)) {
    throw s.fehler(
      400,
      'Diese Quelle kennt ChurchTools nicht. Bitte die Seite neu laden – die Liste der Liederbücher ' +
        'hat sich vermutlich geändert.',
    );
  }
}

export async function arrangementsLesen(
  s: CtSchreiber,
  songId: number,
): Promise<ArrangementAnsicht[]> {
  return (await s.song(songId)).arrangements.map(arrangementAnsicht);
}

/** Ein weiteres Arrangement – **nie als Standard** (das bleibt eine bewusste eigene Handlung). */
export async function arrangementAnlegen(
  s: CtVerwalter,
  songId: number,
  auftrag: ArrangementAuftrag & { name: string },
): Promise<ArrangementAnsicht> {
  await liedMitRecht(s, songId, 'ändern');
  const leer: CtArrangement = {
    id: 0,
    name: auftrag.name,
    key: null,
    keyOfArrangement: null,
    bpm: null,
    beat: null,
    files: [],
  };
  await pruefeQuelle(s, leer, auftrag);
  const neueArrId = await arrangementErzeugen(s, songId, { ...auftrag, isDefault: false });
  const danach = await s.song(songId);
  const arr = danach.arrangements.find((a) => a.id === neueArrId);
  if (!arr) {
    throw s.fehler(
      502,
      `Das Arrangement „${auftrag.name}" wurde angelegt, aber ChurchTools zeigt es nicht am Lied an. ` +
        'Bitte dort nachsehen, bevor du es erneut versuchst.',
    );
  }
  return arrangementAnsicht(arr);
}

/** Ändert ein Arrangement (#396) – über denselben Lese-Schreib-Weg wie das Tempo. */
export async function arrangementBearbeiten(
  s: CtVerwalter,
  songId: number,
  arrangementId: number,
  auftrag: ArrangementAuftrag,
): Promise<ArrangementAnsicht> {
  const song = await liedMitRecht(s, songId, 'ändern');
  const arr = arrangementAus(song, arrangementId, s.fehler.bind(s), ARRANGEMENT_FEHLT);
  await pruefeQuelle(s, arr, auftrag);
  await arrangementSchreiben(s, songId, arrangementId, auftrag);
  const danach = await s.song(songId);
  return arrangementAnsicht(
    arrangementAus(danach, arrangementId, s.fehler.bind(s), ARRANGEMENT_FEHLT),
  );
}

/** Zum Standard machen – und nachsehen, ob ChurchTools es wirklich getan hat. Zurück kommt die ganze Liste. */
export async function arrangementZumStandard(
  s: CtVerwalter,
  songId: number,
  arrangementId: number,
): Promise<ArrangementAnsicht[]> {
  const song = await liedMitRecht(s, songId, 'ändern');
  arrangementAus(song, arrangementId, s.fehler.bind(s), ARRANGEMENT_FEHLT);
  await arrangementStandardSetzen(s, songId, arrangementId);
  const danach = await s.song(songId);
  const jetzt = arrangementAus(danach, arrangementId, s.fehler.bind(s), ARRANGEMENT_FEHLT);
  if (jetzt.isDefault !== true) {
    throw s.fehler(
      502,
      `ChurchTools hat den Standard nicht auf „${jetzt.name}" umgestellt. Bitte dort nachsehen.`,
    );
  }
  return danach.arrangements.map(arrangementAnsicht);
}

/** Löschen – mit zwei Geländern: nicht das letzte, nicht der Standard. */
export async function arrangementLoeschen(
  s: CtVerwalter,
  songId: number,
  arrangementId: number,
): Promise<{ name: string }> {
  const song = await liedMitRecht(s, songId, 'ändern');
  const arr = arrangementAus(song, arrangementId, s.fehler.bind(s), ARRANGEMENT_FEHLT);
  if (song.arrangements.length <= 1) {
    throw s.fehler(
      409,
      'Das ist das einzige Arrangement des Liedes. Ohne Arrangement wäre das Lied nicht mehr ' +
        'benutzbar – lege erst ein weiteres an.',
    );
  }
  if (arr.isDefault === true) {
    throw s.fehler(
      409,
      `„${arr.name}" ist das Standard-Arrangement. Mache zuerst ein anderes zum Standard, dann ` +
        'lässt es sich löschen.',
    );
  }
  await arrangementEntfernen(s, songId, arrangementId);
  return { name: arr.name };
}
