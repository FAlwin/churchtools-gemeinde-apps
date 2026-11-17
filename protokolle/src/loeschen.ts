/**
 * **Ein Protokoll löschen** (Bauplan W6, entschieden 17.11.2026) – Entwurf oder freigegeben, nur die Leitung, nicht
 * rückgängig. Die Regeln (welche To-Dos, Texte) stehen in `@shared/protokolle/loeschen`; hier wird bei ChurchTools
 * gelesen und geschrieben.
 *
 * **Reihenfolge – das Wichtigste zuerst, das Unwiderrufliche zuletzt:**
 * 1. **Sperre prüfen** (wie beim Speichern, `sperreLage`): Schreibt jemand anderes – oder ich selbst in einem anderen
 *    Fenster –, wird nichts gelöscht, sondern gemeldet. Dieses Fenster (im Editor) darf; sein Schreiben stoppt der
 *    Aufrufer.
 * 2. **To-Dos** (falls „Mitlöschen“): als gelöscht vermerkt (`toDoLoeschen`, nie hart – wer in „Mitarbeit“ schreibt, dürfte
 *    sonst jeden Wert löschen), nachgelesen. Schon vermerkte fallen bei jedem Versuch heraus (`aufgabenAusProtokoll`).
 * 3. **Termin** (Mail „Termin gelöscht“!) und **Gruppentreffen**, falls gewählt – über dieselben Bausteine wie „Sitzung
 *    absagen“ (`terminAbsagen`, `treffenLoeschen`), je nachgelesen. „Schon weg“ (404) ist erledigt.
 * 4. **Das Protokoll selbst:** erst alle **Teile**, **zuletzt der Kopf**, dann nachlesen. Begründung: Der Kopf ist der
 *    Wegweiser – ohne ihn fände ein zweiter Versuch die Sitzung nicht mehr, übrig gebliebene Teile mit dem Text blieben für
 *    immer als unsichtbarer Müll liegen (und der „gelöschte“ Text bliebe in ChurchTools). Bricht es nach den Teilen ab,
 *    steht der Kopf noch da – ohne lesbaren Text: Die Ansicht sagt dann „nicht vollständig lesbar“ (kein halbes Protokoll
 *    sieht „gültig“ aus: `dokumentAusTeilen` nimmt nie einen unvollständigen Stand), und „Löschen“ führt es zu Ende. Das
 *    ist dieselbe Denkweise wie beim Speichern (`schreiben.ts`: der Kopf zeigt immer auf einen vollständigen Stand) –
 *    nur rückwärts: Dort wird der Kopf nach den neuen Teilen umgestellt, hier nach den Teilen entfernt.
 *    Die Sperre wird davor noch einmal geprüft – Schritte 2 und 3 können dauern.
 *
 * **Ein Erfolgssignal ist kein Beleg:** Nach jedem Schritt wird nachgelesen; fehlt der Beleg, wird geworfen. Scheitert ein
 * Schritt, bleibt das Fenster offen (`LoeschUnterbrochen`: was schon erledigt ist, was nicht); ein zweiter Versuch macht
 * nichts doppelt – ein vermerktes To-Do, ein gelöschter Termin oder ein gelöschtes Treffen (404) zählt als erledigt.
 * Vorübergehende Fehler (502, Zeitüberschreitung) löschen oder verbuchen nichts „endgültig“: Sie brechen ab, das Protokoll
 * steht noch.
 */
import { werteLesen, wertLoeschen } from '@shared/ct/modulDaten';
import {
  aufgabenAusProtokoll,
  unterbrochenText,
  type LoeschSchritt,
} from '@shared/protokolle/loeschen';
import type { SerienAbsage } from '@shared/protokolle/bearbeiten';
import {
  sitzungAusWerten,
  sperreLage,
  type Schreiber,
  type Sperre,
} from '@shared/protokolle/speicher';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { modulPort } from '@ui/ct/modulPort';
import { ctDaten } from '@ui/ct/verbindung';
import { aufgabenWerte, type MitarbeitOrt } from './aufgabenSchreiben';
import { terminAbsagen, treffenLoeschen } from './bearbeiten';
import type { ProtokollOrt } from './schreiben';
import type { TerminRef } from './termin';
import { toDoLoeschen } from './todoSchreiben';

const VERWEIGERT = 'Du darfst in dieser Gruppe keine Protokolle löschen.';

export interface LoeschPlan {
  /** Wo das Protokoll liegt (Kategorie „Protokolle“, Sitzungs-ID aus dem Kopf). */
  ort: ProtokollOrt;
  ich: Schreiber;
  gruppe: number;
  /** Kategorie „Mitarbeit“ – ohne sie gibt es keine To-Dos zu vermerken. */
  mitarbeit: MitarbeitOrt | null;
  /** „Mitlöschen“ der To-Dos aus diesem Protokoll. */
  todos: boolean;
  /** Den Termin mitlöschen (bei einer Serie mit `art: 'diese'`). */
  termin: { termin: TerminRef; beginn: string; zeitzone: string; art?: SerienAbsage } | null;
  /** Das Gruppentreffen mitlöschen. */
  treffen: number | null;
  jetzt?: Date;
}

export type LoeschErgebnis =
  | { art: 'ok' }
  /** Jemand schreibt (oder ich in einem anderen Fenster) – nichts mehr gelöscht; `erledigt` = was vorher schon ging. */
  | { art: 'gesperrt'; sperre: Sperre; erledigt: LoeschSchritt[] };

/**
 * **Ein Schritt scheiterte** – die Meldung nennt, was schon erledigt ist und was nicht (`unterbrochenText`). Ein
 * `ApiError` 409: `fehlerMeldung` zeigt dann den Text statt „ChurchTools antwortet gerade nicht“. `nochmal` = lohnt der
 * zweite Versuch (nicht bei Abmeldung).
 */
export class LoeschUnterbrochen extends ApiError {
  constructor(
    readonly erledigt: LoeschSchritt[],
    readonly offen: LoeschSchritt[],
    ursache: unknown,
  ) {
    super(409, unterbrochenText({ erledigt, offen, grund: fehlerMeldung(ursache).text }));
    this.name = 'LoeschUnterbrochen';
    this.cause = ursache;
    this.nochmal = fehlerMeldung(ursache).nochmal;
  }
  readonly nochmal: boolean;
}

async function frisch(ort: ProtokollOrt) {
  return sitzungAusWerten(await werteLesen(modulPort, ort.modul, ort.kategorie), ort.sitzung);
}

/** Schreibt jemand anderes? (Kein Kopf = nichts zu sperren: Das Protokoll ist schon weg, ein zweiter Versuch läuft weiter.) */
function fremdeSperre(f: Awaited<ReturnType<typeof frisch>>, ich: Schreiber, jetzt: Date) {
  const sperre = f.kopf?.inhalt.sperre ?? null;
  return sperre && sperreLage(sperre, ich, jetzt) === 'fremd' ? sperre : null;
}

/** Gruppentreffen weg? 404 = ja (weg ist weg); alles andere – auch eine Antwort mit Inhalt – ist kein Beleg. */
async function treffenNachlesen(gruppe: number, id: number): Promise<void> {
  try {
    await ctDaten(`/groups/${gruppe}/meetings/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return;
    throw e;
  }
  throw new NichtUebernommen('das Löschen des Gruppentreffens');
}

/** Schritt 4: alle Teile, dann der Kopf, dann nachlesen. */
async function protokollWeg(ort: ProtokollOrt): Promise<void> {
  const f = await frisch(ort);
  for (const t of f.teile)
    await wertLoeschen(modulPort, ort.modul, ort.kategorie, t.id, VERWEIGERT);
  if (f.kopf) await wertLoeschen(modulPort, ort.modul, ort.kategorie, f.kopf.id, VERWEIGERT);
  const danach = await frisch(ort);
  if (danach.kopf || danach.teile.length) throw new NichtUebernommen('das Löschen des Protokolls');
}

/**
 * **Das Protokoll löschen** – siehe oben. Liefert `gesperrt`, wenn jemand schreibt; wirft `LoeschUnterbrochen`, wenn ein
 * Schritt scheitert, und den Fehler selbst, wenn schon die Sperrprüfung scheitert (dann wurde nichts gelöscht).
 */
export async function protokollLoeschen(q: LoeschPlan): Promise<LoeschErgebnis> {
  const jetzt = () => q.jetzt ?? new Date();
  const erledigt: LoeschSchritt[] = [];
  const offen: LoeschSchritt[] = [
    ...(q.todos && q.mitarbeit ? (['todos'] as const) : []),
    ...(q.termin ? (['termin'] as const) : []),
    ...(q.treffen !== null ? (['treffen'] as const) : []),
    'protokoll',
  ];
  const schritt = async (s: LoeschSchritt, tun: () => Promise<void>) => {
    try {
      await tun();
    } catch (e) {
      throw new LoeschUnterbrochen([...erledigt], [...offen], e);
    }
    erledigt.push(s);
    offen.splice(offen.indexOf(s), 1);
  };

  // 1. Sperre – noch nichts angefasst, ein Fehler hier ist ein ganz normaler Fehler.
  const vorab = fremdeSperre(await frisch(q.ort), q.ich, jetzt());
  if (vorab) return { art: 'gesperrt', sperre: vorab, erledigt: [] };

  // 2. To-Dos.
  const { mitarbeit } = q;
  if (q.todos && mitarbeit)
    await schritt('todos', async () => {
      const ids = aufgabenAusProtokoll(
        (await aufgabenWerte(mitarbeit)).map((x) => x.aufgabe),
        q.ort.sitzung,
      ).map((a) => a.id);
      for (const id of ids) await toDoLoeschen(mitarbeit, id, q.ich);
    });

  // 3. Termin, dann Gruppentreffen.
  if (q.termin) await schritt('termin', () => terminAbsagen(q.termin!));
  if (q.treffen !== null) {
    const id = q.treffen;
    await schritt('treffen', async () => {
      await treffenLoeschen(q.gruppe, id);
      await treffenNachlesen(q.gruppe, id);
    });
  }

  // 4. Das Protokoll – zuletzt; die Sperre noch einmal, falls inzwischen jemand angefangen hat.
  let spaeter: Sperre | null;
  try {
    spaeter = fremdeSperre(await frisch(q.ort), q.ich, jetzt());
  } catch (e) {
    throw new LoeschUnterbrochen([...erledigt], [...offen], e);
  }
  if (spaeter) return { art: 'gesperrt', sperre: spaeter, erledigt };
  await schritt('protokoll', () => protokollWeg(q.ort));
  return { art: 'ok' };
}
