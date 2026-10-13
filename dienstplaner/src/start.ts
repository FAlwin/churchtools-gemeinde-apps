/**
 * **Was der Dienstplaner beim Start braucht** (Bauplan E2): wer angemeldet ist, Gemeinde und Gruppen
 * (`ladeIch`, gemeinsam mit den anderen Erweiterungen), dazu die Dienstgruppen der Gemeinde und welche
 * davon man laut globalem Recht planen darf.
 *
 * Erst die Person, dann der Rest: Ist niemand angemeldet, soll genau das dastehen – nicht ein „kein
 * Recht“ von einer Abfrage, die zufällig schneller zurückkam.
 */
import { ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { ladeIch } from '@ui/ct/ich';
import { meineGruppen, type MeineGruppe } from '@shared/ct/gruppen';
import { dienstRechteAus, type DienstRechte } from '@shared/ct/dienstRechte';
import { dienstgruppenAus, type Dienstgruppe } from '@shared/ct/dienstgruppen';

export interface Start {
  /** Die eigene Person – daran erkennt die Termine-Liste die eigenen Dienste. */
  ichId: number;
  vorname: string;
  gemeinde: string | null;
  gruppen: MeineGruppe[];
  dienstgruppen: Dienstgruppe[];
  rechte: DienstRechte;
}

/** **Wirft**, wenn etwas davon nicht lesbar ist – eine halbe Startseite wäre eine falsche. */
export async function ladeStart(): Promise<Start> {
  const ich = await ladeIch();
  const [rechteRoh, dienstgruppenRoh] = await Promise.all([
    ctDaten<Record<string, Record<string, unknown>> | null>('/permissions/global'),
    ctDaten<unknown>('/servicegroups'),
  ]);
  if (!Array.isArray(dienstgruppenRoh)) {
    throw new ApiError(502, 'ChurchTools hat die Dienstgruppen nicht geliefert.');
  }
  return {
    ichId: ich.id,
    vorname: ich.vorname,
    gemeinde: ich.gemeinde,
    gruppen: meineGruppen(ich.mitgliedschaften, ich.rollen),
    dienstgruppen: dienstgruppenAus(dienstgruppenRoh),
    rechte: dienstRechteAus(rechteRoh, (status, meldung) => new ApiError(status, meldung)),
  };
}
