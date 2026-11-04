/**
 * **Abwesenheiten direkt aus der Erweiterung** (Dienstplaner E7-2b) – was die gemeinsame Seite liest und schreibt, über
 * den Kern (`@shared/absences/abwesenheiten`) und den Anschluss der Seite (`@ui/ct/abwesenheitPort`). Für die
 * Musik-App in ChurchTools und den Dienstplaner; auf dem NAS spricht die Musik-App weiter mit ihrem Server.
 *
 * Was der Kern als Ergebnis meldet, wird hier zu einer Meldung, die man zeigen kann (wie der Server sie gab) – die Seite
 * zeigt `ApiError.message` an.
 */
import type { Absence, AbsenceEvent, AbsenceReason, NeueAbsence } from '@shared/types/index';
import type { CtEvent } from '@shared/ct/typen';
import {
  abwesenheitAendern,
  abwesenheitAnlegen,
  abwesenheitLoeschen,
  gruendeAus,
  meineAbwesenheiten,
  termineAus,
  type AbwesenheitErgebnis,
  type AbwesenheitPort,
} from '@shared/absences/abwesenheiten';
import { abwesenheitPort } from '../ct/abwesenheitPort';
import { ApiError, NichtUebernommen, Unklar } from '../ct/fehler';
import { ctDaten } from '../ct/verbindung';

export interface AbwesenheitenDienst {
  meine: (von: string, bis: string) => Promise<Absence[]>;
  termine: (von: string, bis: string) => Promise<AbsenceEvent[]>;
  gruende: () => Promise<AbsenceReason[]>;
  anlegen: (neu: NeueAbsence) => Promise<Absence>;
  aendern: (id: number, neu: NeueAbsence) => Promise<Absence>;
  loeschen: (id: number) => Promise<void>;
}

/** Was nicht geklappt hat, als Fehler mit Satz – sonst der Eintrag. */
function eintragAus(r: AbwesenheitErgebnis): Absence {
  if (r.ok) return r.absence;
  switch (r.grund) {
    case 'ungueltig':
      throw new ApiError(400, r.text ?? 'Die Angaben passen nicht.');
    case 'doppel':
      throw new ApiError(409, 'Für diesen Zeitraum gibt es schon einen Eintrag.');
    case 'weg':
      throw new ApiError(404, 'Diese Abwesenheit gibt es nicht (mehr).');
    case 'unklar':
      // Nicht einfach noch einmal: Vielleicht steht er schon da (siehe `abwesenheitAnlegen`).
      throw new Unklar(
        'Unklar, ob ChurchTools die Abwesenheit gespeichert hat – bitte die Liste neu laden.',
      );
    case 'nicht-geloescht':
      throw new NichtUebernommen('das Löschen');
  }
}

/**
 * Der Dienst für die angemeldete Person. `ich` liefert ihre ID (die App kennt sie schon), `zeitzone` die der Gemeinde.
 */
export function abwesenheitenDienst({
  ich,
  zeitzone,
  port = abwesenheitPort,
}: {
  ich: () => Promise<number>;
  zeitzone: string;
  port?: AbwesenheitPort;
}): AbwesenheitenDienst {
  const gruende = async () => gruendeAus(await port.stammdaten());
  return {
    meine: async (von, bis) => meineAbwesenheiten(port, await ich(), von, bis),
    async termine(von, bis) {
      const liste = await ctDaten<CtEvent[] | null>(`/events?from=${von}&to=${bis}`);
      if (!Array.isArray(liste)) throw new ApiError(502, 'Die Termine kamen nicht als Liste.');
      return termineAus(liste, zeitzone);
    },
    gruende,
    async anlegen(neu) {
      // Ohne gewählten Grund der vorgewählte der Gemeinde („Abwesend“) – ChurchTools verlangt einen.
      const reasonId = neu.reasonId ?? (await gruende()).find((g) => g.standard)?.id;
      if (reasonId === undefined) throw new ApiError(400, 'Bitte einen Grund wählen.');
      return eintragAus(
        await abwesenheitAnlegen(port, await ich(), { ...neu, reasonId }, zeitzone),
      );
    },
    aendern: async (id, neu) =>
      eintragAus(await abwesenheitAendern(port, await ich(), id, neu, zeitzone)),
    async loeschen(id) {
      const r = await abwesenheitLoeschen(port, await ich(), id);
      if (!r.ok) throw new NichtUebernommen('das Löschen');
    },
  };
}
