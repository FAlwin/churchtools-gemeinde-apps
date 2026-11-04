/**
 * **Einen Platz einteilen – der Schreibkern des Dienstplaners** (Bauplan E4-1). Nur Regeln, keine
 * Netzwerk-Technik: Der Aufrufer reicht einen `DienstPort` herein (Browser: Sitzung der Erweiterung).
 *
 * Gemessen an der Test-Instanz (E0 und E4-0, 14.10.2026):
 * - **Jedes Schreiben vergibt dem Platz eine neue ID.** Wer auf eine veraltete ID schreibt, bekommt trotzdem
 *   200 – aber die Einteilung landet still im Nichts. Deshalb wird ein Platz **nicht über seine ID**
 *   gemerkt, sondern über Termin + Dienst + `index`, und vor dem Schreiben frisch gelesen.
 * - **Erfolg ist erst, wer nach dem Schreiben am Platz steht** – nicht der Statuscode (Lehre aus dem Befund
 *   „200 + unsichtbarer Eintrag“).
 * - Einteilen: `PUT /events/{e}/servicerequests/{platz}` mit genau einem von `personId`/`name`.
 *   **Leeren geht so nicht (400)** – frei wird ein Platz nur über `POST …/{platz}/decline`.
 *
 * Hausregel aus `shared/ct/schreibKern.ts`: **Kein Schreibvorgang wird automatisch wiederholt.** Bei einem
 * vorübergehenden Fehler wird stattdessen **nachgelesen**: Steht das Ziel schon da, war es ein Erfolg;
 * sonst heißt das Ergebnis „vorübergehend“, und der Aufrufer behält die Einteilung (nie verwerfen).
 */
import { istFrei, type RohPlatz, type RohTermin } from './termine';

/** Welcher Platz – ohne die flüchtige ID. */
export interface PlatzOrt {
  eventId: number;
  serviceId: number;
  /** `index` von ChurchTools; `null` bei Diensten mit nur einem Platz. */
  index: number | null;
}

/** Wer an einem Platz steht – oder stehen soll. */
export type Belegung =
  | { art: 'frei' }
  | { art: 'anfrage'; personId: number }
  | { art: 'zusage'; personId: number }
  | { art: 'gast'; name: string };

export type Grund =
  /** 401 – die Sitzung ist abgelaufen. Nichts ist passiert. */
  | 'abgemeldet'
  /** 403 – ChurchTools verweigert das Einteilen. */
  | 'kein-recht'
  /** Termin oder Platz gibt es nicht mehr (gelöscht, Anzahl verkleinert). */
  | 'weg'
  /** Am Platz steht inzwischen jemand anderes als beim Planen gesehen – nichts überschrieben. */
  | 'konflikt'
  /** Netz, Zeitüberschreitung, Drosselung, 5xx – nicht bestätigt; später erneut senden. */
  | 'voruebergehend'
  /** ChurchTools hat das Schreiben angenommen, am Platz steht aber nicht das Ziel. */
  | 'nicht-angekommen';

/** Rückgängig geht nicht mehr (400: nur die letzte Antwort, nur innerhalb von zehn Minuten – E7, gemessen). */
export type ZuSpaet = 'zu-spaet';

export type Ergebnis<G extends string = Grund> =
  | {
      ok: true;
      platzId: number;
      /** Die ID, auf die geschrieben wurde – fehlt, wenn das Ziel schon dastand und nichts geschrieben wurde. */
      geschriebenAuf?: number;
    }
  | { ok: false; grund: G; jetzt?: Belegung };

/** Der Anschluss an ChurchTools. */
export interface DienstPort {
  /** Der Termin mit seinen Plätzen (`include=eventServices`) – **frisch**, nie aus einem Cache. */
  termin(eventId: number): Promise<RohTermin>;
  /** Schreibt; wirft bei jedem Fehlschlag. */
  schreibe(pfad: string, auftrag: { method: 'PUT' | 'POST'; json: unknown }): Promise<void>;
  /** Der HTTP-Status eines geworfenen Fehlers; `null` = keine Antwort (Netz, Zeitüberschreitung). */
  status(e: unknown): number | null;
}

/** Wie der Platz gerade belegt ist. Ein Name ohne Person ist ein Gast. */
export function belegungAus(p: RohPlatz): Belegung {
  if (istFrei(p)) return { art: 'frei' };
  if (typeof p.personId === 'number') {
    return p.isAccepted === true
      ? { art: 'zusage', personId: p.personId }
      : { art: 'anfrage', personId: p.personId };
  }
  return { art: 'gast', name: String(p.name).trim() };
}

/**
 * Dieselbe Person (bzw. derselbe Gast, beide frei)? Eine Anfrage und eine Zusage derselben Person zählen gleich –
 * nur für „Steht das Ziel schon da?“ (`erfuellt`), nicht für „Steht noch da, was der Planer gesehen hat?“.
 */
export function gleichePerson(a: Belegung, b: Belegung): boolean {
  if (a.art === 'frei' || b.art === 'frei') return a.art === b.art;
  if (a.art === 'gast' || b.art === 'gast') {
    return a.art === 'gast' && b.art === 'gast' && a.name.trim() === b.name.trim();
  }
  return a.personId === b.personId;
}

/**
 * **Steht am Platz noch genau, was der Planer gesehen hat?** Strenger als `gleichePerson`: Hat eine angefragte
 * Person inzwischen zugesagt, ist das eine Änderung – wer gerade zugesagt hat, wird nicht still ausgetragen oder
 * ersetzt (Alwin, 15.10.2026). Eine Regel für beide Stellen: das Senden hier (Konflikt statt Schreiben) und das
 * Schild „veraltet“ im Entwurfs-Speicher (`entwurfVeraltet`). An freien Plätzen ändert sich nichts.
 */
export function gleicherStand(a: Belegung, b: Belegung): boolean {
  if (a.art !== b.art) return false;
  if (a.art === 'frei') return true;
  if (a.art === 'gast') return b.art === 'gast' && a.name.trim() === b.name.trim();
  return b.art !== 'frei' && b.art !== 'gast' && a.personId === b.personId;
}

/** Steht das Ziel am Platz? Eine Anfrage ist auch erfüllt, wenn die Person schon zugesagt hat. */
function erfuellt(ist: Belegung, ziel: Belegung): boolean {
  if (ziel.art === 'zusage') return ist.art === 'zusage' && ist.personId === ziel.personId;
  return gleichePerson(ist, ziel);
}

function platzFinden(t: RohTermin, ort: PlatzOrt): RohPlatz | null {
  const treffer = (t.eventServices ?? []).filter(
    (p) => p.serviceId === ort.serviceId && (p.index ?? null) === ort.index,
  );
  // Zwei Plätze mit demselben Ort wären nicht eindeutig – dann lieber gar nicht schreiben.
  return treffer.length === 1 && typeof treffer[0].id === 'number' ? treffer[0] : null;
}

function rumpf(ziel: Exclude<Belegung, { art: 'frei' }>): unknown {
  if (ziel.art === 'gast') return { personId: null, name: ziel.name.trim(), isAccepted: true };
  return { personId: ziel.personId, name: null, isAccepted: ziel.art === 'zusage' };
}

/** Warum das Lesen eines Termins scheiterte – eine Zuordnung für alle, die Termine frisch lesen (auch `plaetze.ts`). */
export function lesegrund(port: DienstPort, e: unknown): Grund {
  const s = port.status(e);
  if (s === 401) return 'abgemeldet';
  if (s === 403) return 'kein-recht';
  if (s === 404) return 'weg';
  return 'voruebergehend';
}

/**
 * Lesen; `Grund`, wenn es nicht geht. `unsichtbar`: Der Termin ist lesbar, der Platz steht aber nicht darin – gelöscht,
 * oder man sieht ihn ohne Recht auf den Dienst nicht (`PlatzAenderung.unsichtbarFertig`).
 */
async function lesen(
  port: DienstPort,
  ort: PlatzOrt,
): Promise<{ platz: RohPlatz } | { grund: Grund; unsichtbar?: true }> {
  let t: RohTermin;
  try {
    t = await port.termin(ort.eventId);
  } catch (e) {
    return { grund: lesegrund(port, e) };
  }
  const platz = platzFinden(t, ort);
  return platz ? { platz } : { grund: 'weg', unsichtbar: true };
}

/**
 * **Eine Änderung an einem Platz** – was vorher dastehen muss, woran man den Erfolg erkennt und was geschrieben wird.
 * Eine Regel für alle, die Plätze ändern: das Einteilen der Planer (`platzEinteilen`) und die eigenen Antworten
 * (E7, `antworten.ts`).
 */
export interface PlatzAenderung<G extends string = never> {
  /** Steht noch da, was man gesehen hat? Sonst `konflikt` – nichts wird überschrieben. */
  vorher: (ist: Belegung) => boolean;
  /** Steht das Ziel da? Dann ist es ein Erfolg – auch ohne Schreiben. */
  fertig: (ist: Belegung) => boolean;
  /** Was geschrieben wird – mit der frisch gelesenen Platz-ID. */
  auftrag: (platzId: number) => { pfad: string; method: 'PUT' | 'POST'; json: unknown };
  /** Was ein 400 heißt, wenn er etwas Bestimmtes bedeutet (Rückgängig zu spät) – sonst wird nachgelesen. */
  bei400?: G;
  /**
   * **Ohne Recht auf den Dienst sieht man nur Plätze, an denen man selbst steht** (gemessen 03.11.2026 als Spike: nach
   * der Absage fehlt der freie Gesang-Platz in seiner Antwort ganz). Für die eigenen Antworten heißt das:
   * - `unsichtbarFertig`: Ist der Platz nach dem Schreiben nicht mehr zu sehen, steht man nicht mehr dort – fertig
   *   (Absagen).
   * - `unsichtbarSchreiben`: Ist der Platz vorher nicht zu sehen, wird dieser Auftrag trotzdem geschrieben – geprüft wird
   *   danach (Rückgängig nach einer Absage: Danach steht man wieder dort und sieht ihn).
   */
  unsichtbarFertig?: boolean;
  unsichtbarSchreiben?: () => { pfad: string; method: 'PUT' | 'POST'; json: unknown };
}

/**
 * **Einen Platz ändern:** frisch lesen → steht das Ziel schon da, fertig; steht etwas anderes als gesehen da,
 * `konflikt` → schreiben (nie wiederholt) → nachlesen. Erst was danach am Platz steht, zählt.
 */
export async function platzAendern<G extends string = never>(
  port: DienstPort,
  ort: PlatzOrt,
  a: PlatzAenderung<G>,
): Promise<Ergebnis<Grund | G>> {
  // 1. Frisch lesen – nur die aktuelle Platz-ID taugt zum Schreiben.
  const erst = await lesen(port, ort);
  let geschriebenAuf: number | undefined;
  let auftrag: { pfad: string; method: 'PUT' | 'POST'; json: unknown };
  if ('grund' in erst) {
    if (!erst.unsichtbar || !a.unsichtbarSchreiben) return { ok: false, grund: erst.grund };
    auftrag = a.unsichtbarSchreiben();
  } else {
    const ist = belegungAus(erst.platz);
    if (a.fertig(ist)) return { ok: true, platzId: erst.platz.id as number };
    if (!a.vorher(ist)) return { ok: false, grund: 'konflikt', jetzt: ist };
    geschriebenAuf = erst.platz.id as number;
    auftrag = a.auftrag(geschriebenAuf);
  }

  // 2. Schreiben – nie wiederholt.
  try {
    await port.schreibe(auftrag.pfad, { method: auftrag.method, json: auftrag.json });
  } catch (e) {
    const s = port.status(e);
    if (s === 401) return { ok: false, grund: 'abgemeldet' };
    if (s === 403) return { ok: false, grund: 'kein-recht' };
    if (s === 400 && a.bei400) return { ok: false, grund: a.bei400 };
    // Alles andere: Vielleicht ist es doch angekommen – nachlesen statt raten (und statt nochmal schreiben).
    return nachlesen(
      port,
      ort,
      a,
      s === 404 || s === 409 ? 'konflikt' : 'voruebergehend',
      geschriebenAuf,
    );
  }

  // 3. Nachlesen – erst was dann am Platz steht, ist der Erfolg.
  return nachlesen(port, ort, a, 'nicht-angekommen', geschriebenAuf);
}

/**
 * **Einen Platz von `vorher` auf `ziel` bringen.** `vorher` ist, was der Planer beim Einteilen gesehen hat:
 * Steht inzwischen jemand anderes da, wird **nicht** überschrieben (`konflikt`). Steht das Ziel schon da –
 * etwa weil ein früheres Senden doch angekommen ist –, ist es ein Erfolg ohne erneutes Schreiben.
 */
export function platzEinteilen(
  port: DienstPort,
  ort: PlatzOrt,
  vorher: Belegung,
  ziel: Belegung,
): Promise<Ergebnis> {
  const pfad = (platzId: number) => `/events/${ort.eventId}/servicerequests/${platzId}`;
  return platzAendern(port, ort, {
    vorher: (ist) => gleicherStand(ist, vorher),
    fertig: (ist) => erfuellt(ist, ziel),
    auftrag: (platzId) =>
      ziel.art === 'frei'
        ? { pfad: `${pfad(platzId)}/decline`, method: 'POST', json: { comment: null } }
        : { pfad: pfad(platzId), method: 'PUT', json: rumpf(ziel) },
  });
}

async function nachlesen<G extends string>(
  port: DienstPort,
  ort: PlatzOrt,
  a: PlatzAenderung<G>,
  sonst: Grund,
  geschriebenAuf: number | undefined,
): Promise<Ergebnis<Grund | G>> {
  const neu = await lesen(port, ort);
  // Nicht mehr zu sehen, wo das genau „ich stehe nicht mehr da“ heißt (eigene Absage ohne Recht auf den Dienst).
  if ('grund' in neu && neu.unsichtbar && a.unsichtbarFertig && geschriebenAuf !== undefined) {
    return { ok: true, platzId: geschriebenAuf, geschriebenAuf };
  }
  // Nicht lesbar: Ob es angekommen ist, weiß niemand – nicht bestätigt, der Aufrufer behält die
  // Einteilung. Beim nächsten Senden erkennt Schritt 1, ob sie doch schon dasteht.
  if ('grund' in neu) return { ok: false, grund: neu.grund };
  const ist = belegungAus(neu.platz);
  if (a.fertig(ist)) return { ok: true, platzId: neu.platz.id as number, geschriebenAuf };
  return { ok: false, grund: sonst, jetzt: ist };
}
