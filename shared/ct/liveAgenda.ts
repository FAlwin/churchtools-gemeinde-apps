/**
 * **Die Live-Agenda von ChurchTools** (Bauplan E6b-2, L1) – welcher Punkt gerade dran ist, seit wann, mit wie viel
 * Zusatzzeit. ChurchTools führt diesen Stand selbst (Ablaufpläne → „Live-Agenda ansehen“); der Dienstplaner liest und
 * schreibt **denselben** Stand, damit beide Ansichten immer dasselbe zeigen (Alwin, 02.11.2026: kein eigener Speicher).
 *
 * Gemessen 02.11.2026 (`dienstplaner-planung/docs/messung-e6b-2-live.md`), alles über die **alte** Schnittstelle:
 *  - Lesen `loadAgendaLivePosition` (`event_id`, `agenda_id`) → `pos_id`, `switchdate`, `addseconds`, `currentTime`,
 *    alle Werte als Zeichenketten bzw. `null`. Die Live-Agenda von ChurchTools fragt alle **2,5 s**.
 *  - Schreiben `saveAgendaLivePosition` (`event_id`, `pos_id`, `addseconds`, `start_preparation_timer`). `switchdate`
 *    setzt ChurchTools nur neu, wenn sich `pos_id` ändert; `addseconds` ist der **Gesamtwert**, kein Schritt.
 *  - `pos_id` ist eine **Stelle in einer Liste**, keine Punkt-ID: 0 = „noch nicht gestartet“, dann alle Punkte ohne
 *    Überschriften **einschließlich der weggelassenen** (Auge), zuletzt „Ende“. Zurück auf `null` geht nicht.
 *  - ChurchTools prüft beim Speichern **nichts** (auch nicht bei Personen ohne Admin, Dienst oder Recht). Wer steuern
 *    darf, entscheidet allein die Oberfläche – bei ChurchTools wie hier (`darfLiveSteuern`).
 *
 * Unsere Regeln darüber hinaus (Alwin, 02.11.2026): „Weiter“ überspringt weggelassene Punkte (ChurchTools nur Lieder
 * ohne Dauer), gezählt werden sie trotzdem; solange niemand gestartet hat, läuft „Jetzt“ nach der Uhr; ändert sich
 * der Ablauf während Live, zieht das steuernde Gerät die Stelle nach (`stelleNachziehen`).
 */
import type { AltAnfragePort } from './altSchnittstelle';
import { ablaufBeginn, istWeggelassen } from './ablaufZeile';
import { ctId } from './ctId';
import type { Dienst } from './dienste';
import type { CtAgendaItem } from './typen';

/** Der Live-Stand, wie ChurchTools ihn liefert. */
export interface LiveStand {
  /** `pos_id`: 0 = nicht gestartet, 1…n = der Punkt an dieser Stelle, n + 1 = Ende; `null` = nie gestartet. */
  stelle: number | null;
  /** `switchdate` (ms, Uhr von ChurchTools): wann zuletzt der Punkt gewechselt wurde. */
  seit: number | null;
  /** `addseconds`: Zusatzzeit des aktuellen Punkts in Sekunden (+/− in Minutenschritten, Gesamtwert). */
  zusatzSek: number;
  /** `currentTime` (ms): die Uhr von ChurchTools beim Antworten – zum Abgleich mit der Uhr des Geräts. */
  serverZeit: number;
}

/** Ein Punkt der Live-Liste – Überschriften gehören nicht dazu. */
export interface LivePunkt {
  id: number;
  title: string;
  /** Dauer in Sekunden (Rohwert von ChurchTools). */
  dauerSek: number;
  /** Lied ohne Dauer: hängt am vorigen Punkt und wird mit „Weiter“ übersprungen (wie in ChurchTools). */
  liedOhneDauer: boolean;
  /** An diesem Termin weggelassen (Auge): wird übersprungen, zählt aber mit (gleiche Stelle wie ChurchTools). */
  weggelassen: boolean;
  /** Geplanter Beginn an diesem Termin (ms); `null` ohne Zeit oder wenn weggelassen. */
  planBeginn: number | null;
}

/** Was „Live“ gerade zeigt. `dann: 'ende'` heißt: danach ist der Ablauf vorbei. */
export type LiveLage =
  | {
      /** Noch niemand hat gestartet – „Jetzt“ ist, was laut Plan gerade dran ist. */
      art: 'nach-plan';
      /** `null` vor dem ersten und nach dem letzten Punkt. */
      jetzt: LivePunkt | null;
      mit: LivePunkt[];
      dann: LivePunkt | 'ende' | null;
      /** Bis der Punkt laut Plan vorbei ist; `null` ohne „Jetzt“. */
      restSek: number | null;
      /** Laut Plan ist alles vorbei. */
      vorbei: boolean;
    }
  | {
      art: 'laeuft';
      stelle: number;
      jetzt: LivePunkt;
      /** Lieder ohne Dauer direkt danach – sie gehören zu „Jetzt“. */
      mit: LivePunkt[];
      dann: LivePunkt | 'ende';
      /** Dauer samt Zusatzzeit. */
      dauerSek: number;
      /** Was übrig ist – negativ, wenn die Zeit um ist (läuft weiter, bis jemand „Weiter“ drückt). */
      restSek: number;
      /** Wie viel später als geplant der Punkt begann (negativ = früher); `null` ohne Plan-Zeit. */
      verspaetungSek: number | null;
    }
  | {
      art: 'ende';
      /** Wann der Ablauf vorbei war (ms, Uhr von ChurchTools). */
      seit: number | null;
      /** Wie viel später als geplant er endete (negativ = früher); `null` ohne Plan-Zeit. */
      verspaetungSek: number | null;
    };

/** Wohin geschrieben wird: Stelle und Zusatzzeit (Gesamtwert). */
export interface LiveZiel {
  stelle: number;
  zusatzSek: number;
}

export type LiveGrund =
  /** Niemand mehr angemeldet (401). Nichts ist passiert. */
  | 'abgemeldet'
  /** ChurchTools verweigert (403). */
  | 'kein-recht'
  /** Gespeichert gemeldet, nachgelesen steht aber etwas anderes da (z. B. jemand anderes hat gleichzeitig geschaltet). */
  | 'nicht-angekommen'
  /** ChurchTools antwortet, aber anders als gemessen – die alte Schnittstelle hat sich vermutlich geändert. */
  | 'unlesbar'
  /** Netz, Zeitüberschreitung, 5xx – der letzte Stand bleibt stehen, es wird wieder versucht. */
  | 'voruebergehend';

// ── Lesen der Antwort ────────────────────────────────────────────────────────

const ganzzahl = (x: unknown): number | null => {
  const n = typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN;
  return Number.isInteger(n) ? n : null;
};

/**
 * Die Antwort von `loadAgendaLivePosition` lesen. `null`, wenn sie nicht so aussieht wie gemessen (dann hat sich die
 * alte Schnittstelle vermutlich geändert – nie raten). Nie gestartet: `pos_id`, `switchdate`, `addseconds` sind `null`.
 */
export function liveStandAus(roh: unknown): LiveStand | null {
  if (typeof roh !== 'object' || roh === null || Array.isArray(roh)) return null;
  const r = roh as Record<string, unknown>;
  const serverZeit = ganzzahl(r.currentTime);
  if (serverZeit === null) return null;
  const stelle = r.pos_id === null || r.pos_id === undefined ? null : ganzzahl(r.pos_id);
  if (stelle !== null && stelle < 0) return null;
  if (r.pos_id !== null && r.pos_id !== undefined && stelle === null) return null;
  const seit = typeof r.switchdate === 'string' ? Date.parse(r.switchdate) : NaN;
  return {
    stelle,
    seit: Number.isNaN(seit) ? null : seit,
    zusatzSek: ganzzahl(r.addseconds) ?? 0,
    serverZeit,
  };
}

/** Um wie viele ms die Uhr des Geräts der von ChurchTools vorausgeht – aus einer Antwort und ihrem Empfangszeitpunkt. */
export function uhrVersatz(stand: LiveStand, empfangen: number): number {
  return empfangen - stand.serverZeit;
}

// ── Die Liste ────────────────────────────────────────────────────────────────

/**
 * Die Punkte, wie ChurchTools sie für die Live-Agenda zählt: alle außer Überschriften, in der Reihenfolge des Ablaufs,
 * **auch die weggelassenen** (gemessen L0). Bewusst `type === 'header'` und nicht `isHeaderType`: Die Stelle muss genau
 * die von ChurchTools sein, und dessen Live-Agenda prüft genau so (`cs_liveview.js`).
 */
export function liveListe(items: readonly CtAgendaItem[], eventId: number): LivePunkt[] {
  return items
    .filter((i) => i.type !== 'header')
    .map((i) => {
      const dauerSek = i.duration ?? 0;
      const weggelassen = istWeggelassen(i, eventId);
      const beginn = weggelassen ? null : ablaufBeginn(i, eventId);
      return {
        id: i.id,
        title: i.title,
        dauerSek,
        liedOhneDauer: dauerSek === 0 && !!i.song,
        weggelassen,
        planBeginn: beginn === null ? null : Date.parse(beginn),
      };
    });
}

/** Die Stelle „Ende“ – nach dem letzten Punkt. */
export const endeStelle = (liste: readonly LivePunkt[]) => liste.length + 1;

/** Wird mit „Weiter“/„Zurück“ übersprungen: Lieder ohne Dauer (ChurchTools) und weggelassene Punkte (unsere Regel). */
const uebersprungen = (p: LivePunkt) => p.liedOhneDauer || p.weggelassen;

/** Wohin „Weiter“ führt: zum nächsten Punkt, der nicht übersprungen wird – sonst ans Ende. Vom Ende aus bleibt es dort. */
export function naechsteStelle(liste: readonly LivePunkt[], stelle: number | null): number {
  const ende = endeStelle(liste);
  let s = Math.min(stelle ?? 0, ende);
  if (s >= ende) return ende;
  s++;
  while (s < ende && uebersprungen(liste[s - 1])) s++;
  return s;
}

/** Wohin „Zurück“ führt: zum vorigen Punkt, der nicht übersprungen wird – vor dem ersten auf „nicht gestartet“ (0). */
export function vorigeStelle(liste: readonly LivePunkt[], stelle: number | null): number {
  let s = Math.min(stelle ?? 0, endeStelle(liste));
  if (s <= 0) return 0;
  s--;
  while (s > 0 && uebersprungen(liste[s - 1])) s--;
  return s;
}

/** Was nach dem Punkt an `index` kommt: die mitlaufenden Lieder ohne Dauer und der nächste eigene Punkt. */
function folge(
  liste: readonly LivePunkt[],
  index: number,
): { mit: LivePunkt[]; dann: LivePunkt | 'ende' } {
  const mit: LivePunkt[] = [];
  for (let i = index + 1; i < liste.length; i++) {
    const p = liste[i];
    if (!uebersprungen(p)) return { mit, dann: p };
    if (!p.weggelassen) mit.push(p);
  }
  return { mit, dann: 'ende' };
}

/** Geplantes Ende des Ablaufs (ms): Beginn plus Dauer des letzten Punkts mit Plan-Zeit. */
function planEnde(liste: readonly LivePunkt[]): number | null {
  for (let i = liste.length - 1; i >= 0; i--) {
    const p = liste[i];
    if (p.planBeginn !== null) return p.planBeginn + p.dauerSek * 1000;
  }
  return null;
}

/** „Jetzt“ nach der Uhr – solange niemand gestartet hat (Alwin, 02.11.2026). */
function nachPlan(liste: readonly LivePunkt[], jetzt: number): LiveLage {
  let index = -1;
  for (let i = 0; i < liste.length; i++) {
    const p = liste[i];
    // Weggelassene haben keine Plan-Zeit; ein Lied ohne Dauer beginnt mit dem nächsten Punkt und wird von ihm abgelöst.
    if (p.planBeginn === null) continue;
    if (p.planBeginn <= jetzt) index = i;
    else break;
  }
  if (index < 0) {
    const erster = liste.find((p) => !uebersprungen(p)) ?? null;
    return { art: 'nach-plan', jetzt: null, mit: [], dann: erster, restSek: null, vorbei: false };
  }
  const p = liste[index];
  const rest = Math.round(((p.planBeginn ?? jetzt) + p.dauerSek * 1000 - jetzt) / 1000);
  const { mit, dann } = folge(liste, index);
  if (rest <= 0 && dann === 'ende') {
    return { art: 'nach-plan', jetzt: null, mit: [], dann: null, restSek: null, vorbei: true };
  }
  return { art: 'nach-plan', jetzt: p, mit, dann, restSek: rest, vorbei: false };
}

/**
 * **Was „Live“ zeigt** – aus der Liste, dem Stand und der Zeit `jetzt` **in der Uhr von ChurchTools** (Gerät minus
 * `uhrVersatz`). Ohne Stand (nie gelesen oder nie gestartet) und bei Stelle 0 läuft es nach der Uhr.
 *
 * Abweichung: ChurchTools rechnet den Plan-Beginn selbst aus den Dauern davor – samt weggelassener Punkte. Wir nehmen
 * die Zeit, die ChurchTools für diesen Termin nennt (`startTimes`), also dieselbe wie im Ablauf; mit weggelassenen
 * Punkten kann die Zahl deshalb von der Live-Agenda abweichen.
 */
export function liveLage(
  liste: readonly LivePunkt[],
  stand: LiveStand | null,
  jetzt: number,
): LiveLage {
  const stelle = stand?.stelle ?? null;
  if (stand === null || stelle === null || stelle === 0) return nachPlan(liste, jetzt);
  if (stelle >= endeStelle(liste)) {
    const geplant = planEnde(liste);
    return {
      art: 'ende',
      seit: stand.seit,
      verspaetungSek:
        stand.seit !== null && geplant !== null ? Math.round((stand.seit - geplant) / 1000) : null,
    };
  }
  const index = stelle - 1;
  const p = liste[index];
  const dauerSek = p.dauerSek + stand.zusatzSek;
  const vergangen = stand.seit === null ? 0 : (jetzt - stand.seit) / 1000;
  const { mit, dann } = folge(liste, index);
  return {
    art: 'laeuft',
    stelle,
    jetzt: p,
    mit,
    dann,
    dauerSek,
    restSek: Math.round(dauerSek - vergangen),
    verspaetungSek:
      stand.seit !== null && p.planBeginn !== null
        ? Math.round((stand.seit - p.planBeginn) / 1000)
        : null,
  };
}

/**
 * Die Abweichung in Worten: „2 Min. später“, „1 Min. früher“, „im Plan“. Abgeschnitten wie in ChurchTools
 * (`truncate`), damit beide Ansichten dieselbe Zahl zeigen.
 */
export function abweichungText(sek: number): string {
  const min = Math.trunc(Math.abs(sek) / 60);
  if (min === 0) return 'im Plan';
  return `${min} Min. ${sek > 0 ? 'später' : 'früher'}`;
}

/** Restzeit als „2:12“ – ist die Zeit um, mit Plus davor: „+0:45“ (läuft weiter, bis jemand weiterschaltet). */
export function restText(sek: number): string {
  const a = Math.abs(Math.round(sek));
  const text = `${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
  return sek < 0 ? `+${text}` : text;
}

// ── Steuern ──────────────────────────────────────────────────────────────────

/** Ein Platz am Termin, wie `include=eventServices` ihn liefert – nur, was die Regel braucht. */
export interface LivePlatz {
  serviceId?: unknown;
  personId?: unknown;
  isValid?: unknown;
}

/**
 * **Darf diese Person die Live-Agenda dieses Termins steuern?** Genau die Regel von ChurchTools (`cs_liveview.js`,
 * Alwin 02.11.2026 „genau wie CT“): an diesem Termin auf einem gültigen Platz eingeteilt, in einem Dienst mit
 * „Live-Agenda steuern“. Admins nicht automatisch. Zugesagt muss man nicht haben – ChurchTools fragt das nicht.
 */
export function darfLiveSteuern(
  termin: { eventServices?: readonly LivePlatz[] | null },
  dienste: ReadonlyMap<number, Pick<Dienst, 'liveSteuern'>>,
  ichId: number | null,
): boolean {
  if (ichId === null) return false;
  return (termin.eventServices ?? []).some((p) => {
    if (p.isValid === false || ctId(p.personId) !== ichId) return false;
    const dienst = ctId(p.serviceId);
    return dienst !== null && dienste.get(dienst)?.liveSteuern === true;
  });
}

/** „Weiter“: nächster Punkt, Zusatzzeit zurück auf 0 (wie ChurchTools). */
export const weiterZiel = (liste: readonly LivePunkt[], stand: LiveStand | null): LiveZiel => ({
  stelle: naechsteStelle(liste, stand?.stelle ?? null),
  zusatzSek: 0,
});

/** „Zurück“: voriger Punkt, Zusatzzeit zurück auf 0. */
export const zurueckZiel = (liste: readonly LivePunkt[], stand: LiveStand | null): LiveZiel => ({
  stelle: vorigeStelle(liste, stand?.stelle ?? null),
  zusatzSek: 0,
});

/** „+1 Min“ / „−1 Min“: dieselbe Stelle, Zusatzzeit als neuer Gesamtwert (ChurchTools speichert keinen Schritt). */
export const zusatzZiel = (stand: LiveStand, minuten: number): LiveZiel => ({
  stelle: stand.stelle ?? 0,
  zusatzSek: stand.zusatzSek + minuten * 60,
});

/**
 * **Die Stelle nach einer Ablauf-Änderung nachziehen** (Alwin, 02.11.2026): ChurchTools merkt sich nur die Nummer –
 * wird davor ein Punkt gelöscht oder eingefügt, zeigt dieselbe Nummer einen anderen Punkt (gemessen L0). Das steuernde
 * Gerät kennt den Punkt und rechnet die neue Nummer aus. Ist der Punkt gelöscht, gilt der nächste noch vorhandene;
 * gibt es keinen mehr, das Ende. „Nicht gestartet“ bleibt, das Ende bleibt das Ende.
 */
export function stelleNachziehen(
  alt: readonly LivePunkt[],
  neu: readonly LivePunkt[],
  stelle: number,
): number {
  if (stelle <= 0) return stelle;
  if (stelle >= endeStelle(alt)) return endeStelle(neu);
  const stellen = new Map(neu.map((p, i) => [p.id, i + 1]));
  for (let i = stelle - 1; i < alt.length; i++) {
    const s = stellen.get(alt[i].id);
    if (s !== undefined) return s;
  }
  return endeStelle(neu);
}

// ── Lesen und Schreiben über die alte Schnittstelle ──────────────────────────

function grundAus(p: AltAnfragePort, e: unknown): LiveGrund {
  const s = p.status(e);
  if (s === 401) return 'abgemeldet';
  return s === 403 ? 'kein-recht' : 'voruebergehend';
}

/** Den Live-Stand eines Termins lesen. Ein Fehler zerstört nichts – der Aufrufer behält seinen letzten Stand. */
export async function liveLesen(
  p: AltAnfragePort,
  eventId: number,
  agendaId: number,
): Promise<{ ok: true; stand: LiveStand } | { ok: false; grund: LiveGrund }> {
  let roh: unknown;
  try {
    roh = await p.anfrage('loadAgendaLivePosition', {
      event_id: String(eventId),
      agenda_id: String(agendaId),
    });
  } catch (e) {
    return { ok: false, grund: grundAus(p, e) };
  }
  const stand = liveStandAus(roh);
  return stand ? { ok: true, stand } : { ok: false, grund: 'unlesbar' };
}

/**
 * **Weiterschalten, Zurück, Zusatzzeit** – schreiben, dann **nachlesen**: Erst wenn ChurchTools genau diese Stelle und
 * Zusatzzeit nennt, ist es ein Erfolg (ein Erfolgssignal ist kein Beleg). Geschrieben wird nie zweimal. Ein Fehler beim
 * Nachlesen ist „vorübergehend“ – ob es ankam, zeigt dann die nächste Abfrage.
 */
export async function liveSchreiben(
  p: AltAnfragePort,
  eventId: number,
  agendaId: number,
  ziel: LiveZiel,
): Promise<{ ok: true; stand: LiveStand } | { ok: false; grund: LiveGrund }> {
  try {
    await p.anfrage('saveAgendaLivePosition', {
      event_id: String(eventId),
      pos_id: String(ziel.stelle),
      addseconds: String(ziel.zusatzSek),
      // Der Vorbereitungs-Zähler von ChurchTools (Stelle 0 mit Zusatzzeit) – nutzen wir nicht.
      start_preparation_timer: '0',
    });
  } catch (e) {
    return { ok: false, grund: grundAus(p, e) };
  }
  const l = await liveLesen(p, eventId, agendaId);
  if (!l.ok) return l;
  return l.stand.stelle === ziel.stelle && l.stand.zusatzSek === ziel.zusatzSek
    ? l
    : { ok: false, grund: 'nicht-angekommen' };
}
