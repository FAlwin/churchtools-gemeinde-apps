/**
 * **Die Termine-Liste des Dienstplaners** (Bauplan E3-2, Entwurf v17): Termine mit den eigenen Diensten,
 * für Planer die freien Plätze ihrer Dienstgruppen, gefiltert nach „Meine | Alle“ und Veranstaltung.
 * Nur Regeln, ohne Oberfläche – geladen wird in `dienstplaner/src/termine.ts`.
 *
 * Gemessen an der Live-Instanz (13.10.2026, nur lesen): `/events?from&to&include=eventServices` liefert
 * je Termin die Plätze mit `serviceId`, `personId`, `name`, `isAccepted` (das alte `agreed` ist als
 * veraltet markiert), `isValid`. Ein Platz ist **frei**, wenn `name` leer ist – bei „Namen verbergen“
 * kommen auch besetzte Plätze mit `personId: -2`, aber mit Namen (E0 §2). Die Kalender taugen nicht zum
 * Filtern (bei der ECG fast alles in einem), die **Namen** der Termine schon (Gottesdienst, Gebetsabend).
 */
import type { CtEvent } from '../ct/typen';
import type { Dienst } from '../ct/dienste';
import { ortszeitAus } from '../ct/zeit';

export interface RohPlatz {
  serviceId?: unknown;
  personId?: unknown;
  name?: unknown;
  isAccepted?: unknown;
}

export interface RohTermin extends CtEvent {
  isCanceled?: boolean;
  eventServices?: RohPlatz[] | null;
}

/** Ein eigener Dienst an einem Termin. */
export interface MeinDienst {
  dienst: string;
  zugesagt: boolean;
}

/** Ein besetzter Platz anderer – fürs Team „Mit dir“ auf der Startseite. */
export interface TeamPlatz {
  dienst: string;
  name: string;
  zugesagt: boolean;
}

export interface TerminZeile {
  id: number;
  name: string;
  /** Beginn und Ende, wie ChurchTools sie liefert (UTC) – für Abwesenheiten (`decktTermin`). */
  beginn: string;
  ende: string;
  /** `YYYY-MM-DD` in Ortszeit der Gemeinde. */
  tag: string;
  /** `HH:mm` in Ortszeit der Gemeinde. */
  uhrzeit: string;
  /** Ende `HH:mm` in Ortszeit; `null`, wenn ChurchTools kein späteres Ende nennt. */
  endeUhrzeit: string | null;
  abgesagt: boolean;
  meine: MeinDienst[];
  /** Plätze in Dienstgruppen, die man plant (0 für Nicht-Planer oder ohne solche Dienste). */
  geplant: number;
  /** Davon frei. */
  frei: number;
  /** Freie Plätze je geplanter Dienstgruppe (Schlüssel: Dienstgruppen-ID). */
  freiNachGruppe: Record<number, number>;
  /**
   * Die besetzten Plätze der anderen (ohne einen selbst). Plätze mit „Namen verbergen“ (`personId: -2`)
   * fehlen ganz: ChurchTools schickt dort den echten Namen trotzdem mit (E0 §2) – er wird nie gezeigt.
   */
  team: TeamPlatz[];
}

/** Die ID, die ChurchTools bei „Namen verbergen“ statt der Person schickt (E0 §2). */
export const VERBORGENE_PERSON = -2;

/** Ist der Platz frei? Allein der Name entscheidet (siehe oben) – nicht `personId`. */
export function istFrei(p: RohPlatz): boolean {
  return typeof p.name !== 'string' || p.name.trim() === '';
}

export function termineAus(
  roh: RohTermin[],
  o: {
    ichId: number;
    dienste: Map<number, Dienst>;
    /** Plant man diese Dienstgruppe? (`darfDienstgruppePlanen`) */
    planbar: (dienstgruppeId: number) => boolean;
    zeitzone: string;
  },
): TerminZeile[] {
  return roh
    .map((t) => {
      const lokal = ortszeitAus(t.startDate, o.zeitzone);
      const meine: MeinDienst[] = [];
      const team: TeamPlatz[] = [];
      const freiNachGruppe: Record<number, number> = {};
      let geplant = 0;
      let frei = 0;
      for (const p of t.eventServices ?? []) {
        const dienst = typeof p.serviceId === 'number' ? o.dienste.get(p.serviceId) : undefined;
        const dienstName = dienst?.name ?? 'Dienst';
        if (p.personId === o.ichId && !istFrei(p)) {
          meine.push({ dienst: dienstName, zugesagt: p.isAccepted === true });
        } else if (!istFrei(p) && p.personId !== VERBORGENE_PERSON) {
          team.push({
            dienst: dienstName,
            name: String(p.name).trim(),
            zugesagt: p.isAccepted === true,
          });
        }
        if (dienst?.dienstgruppeId != null && o.planbar(dienst.dienstgruppeId)) {
          geplant++;
          if (istFrei(p)) {
            frei++;
            freiNachGruppe[dienst.dienstgruppeId] =
              (freiNachGruppe[dienst.dienstgruppeId] ?? 0) + 1;
          }
        }
      }
      // Als Zeitpunkte vergleichen, nicht als Text (Lehre aus `decktTermin`, shared/absences).
      const ende =
        t.endDate && Date.parse(t.endDate) > Date.parse(t.startDate) ? t.endDate : t.startDate;
      return {
        id: t.id,
        name: t.name,
        beginn: t.startDate,
        ende,
        tag: lokal.slice(0, 10),
        uhrzeit: lokal.slice(11, 16),
        endeUhrzeit: ende === t.startDate ? null : ortszeitAus(ende, o.zeitzone).slice(11, 16),
        abgesagt: t.isCanceled === true,
        meine,
        geplant,
        frei,
        freiNachGruppe,
        team,
      };
    })
    .sort((a, b) => (a.tag + a.uhrzeit).localeCompare(b.tag + b.uhrzeit) || a.id - b.id);
}

/** Schlüssel für alle Termine, deren Name keine eigene Veranstaltungsart ist. */
export const WEITERE = '';

/**
 * Die Veranstaltungsarten für die Filter: jeder Name, der **mindestens zweimal** vorkommt (eine Reihe
 * wie „Gottesdienst“), häufigste zuerst. Einzelne Termine fallen unter „Weitere“ (`WEITERE`) – so
 * entstehen keine Filter für jedes einmalige Ereignis, und nichts davon ist fest eingebaut.
 */
export function veranstaltungsArten(zeilen: TerminZeile[]): string[] {
  const n = new Map<string, number>();
  for (const z of zeilen) n.set(z.name, (n.get(z.name) ?? 0) + 1);
  const arten = [...n.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
    .map(([name]) => name);
  return arten.length < n.size ? [...arten, WEITERE] : arten;
}

/** Zu welcher Art gehört der Termin? */
export function artVon(z: TerminZeile, arten: string[]): string {
  return arten.includes(z.name) && z.name !== WEITERE ? z.name : WEITERE;
}

export interface Auswahl {
  /** „Meine“ (nur Termine mit eigenem Dienst) statt „Alle“. */
  nurMeine: boolean;
  /** Ausgeblendete Arten (Name bzw. `WEITERE`). */
  ausgeblendet: string[];
}

export function filtere(zeilen: TerminZeile[], a: Auswahl): TerminZeile[] {
  const arten = veranstaltungsArten(zeilen);
  return zeilen.filter(
    (z) => (!a.nurMeine || z.meine.length > 0) && !a.ausgeblendet.includes(artVon(z, arten)),
  );
}

/** Nach Monat gruppiert, in der Reihenfolge der Liste. */
export function nachMonat(zeilen: TerminZeile[]): { monat: string; zeilen: TerminZeile[] }[] {
  const out: { monat: string; zeilen: TerminZeile[] }[] = [];
  for (const z of zeilen) {
    const monat = z.tag.slice(0, 7);
    const letzte = out[out.length - 1];
    if (letzte?.monat === monat) letzte.zeilen.push(z);
    else out.push({ monat, zeilen: [z] });
  }
  return out;
}
