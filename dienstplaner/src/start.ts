/**
 * **Was der Dienstplaner beim Start braucht** (Bauplan E2/E3): wer angemeldet ist, Gemeinde und Gruppen
 * (`ladeIch`, gemeinsam mit den anderen Erweiterungen), die Dienstgruppen und Dienste der Gemeinde und
 * die globalen Rechte – daraus, was man planen darf (`darfDienstPlanen`).
 *
 * Erst die Person, dann der Rest: Ist niemand angemeldet, soll genau das dastehen – nicht ein „kein
 * Recht“ von einer Abfrage, die zufällig schneller zurückkam.
 */
import { ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { ladeIch } from '@ui/ct/ich';
import { meineGruppen, type MeineGruppe } from '@shared/ct/gruppen';
import {
  darfDienstPlanen,
  dienstRechteAus,
  siehtDienstGanz,
  type DienstRechte,
} from '@shared/ct/dienstRechte';
import { dienstgruppenAus, type Dienstgruppe } from '@shared/ct/dienstgruppen';
import { diensteAus, type Dienst } from '@shared/ct/dienste';
import { kuerzelAusBasis } from '@ui/erweiterung/kuerzel';
import { darfAblaufBearbeiten, type AblaufTermin } from '@shared/ct/ablaufRecht';

/** Das Kürzel des Dienstplaners in ChurchTools – aus der Bau-Adresse (`/ccm/dienstplaner/`). */
export const MODUL_KUERZEL = kuerzelAusBasis(import.meta.env.BASE_URL) ?? 'dienstplaner';

export interface Start {
  /** Die eigene Person – daran erkennt die Termine-Liste die eigenen Dienste. */
  ichId: number;
  vorname: string;
  gemeinde: string | null;
  gruppen: MeineGruppe[];
  dienstgruppen: Dienstgruppe[];
  /** Die Dienste der Gemeinde nach ID (`/services`), mit Dienstgruppe und ChurchTools-Gruppen. */
  dienste: Map<number, Dienst>;
  rechte: DienstRechte;
}

/** **Wirft**, wenn etwas davon nicht lesbar ist – eine halbe Startseite wäre eine falsche. */
export async function ladeStart(): Promise<Start> {
  const ich = await ladeIch();
  const [rechteRoh, dienstgruppenRoh, diensteRoh] = await Promise.all([
    ctDaten<Record<string, Record<string, unknown>> | null>('/permissions/global'),
    ctDaten<unknown>('/servicegroups'),
    ctDaten<unknown>('/services'),
  ]);
  if (!Array.isArray(dienstgruppenRoh)) {
    throw new ApiError(502, 'ChurchTools hat die Dienstgruppen nicht geliefert.');
  }
  if (!Array.isArray(diensteRoh)) {
    throw new ApiError(502, 'ChurchTools hat die Dienste nicht geliefert.');
  }
  return {
    ichId: ich.id,
    vorname: ich.vorname,
    gemeinde: ich.gemeinde,
    gruppen: meineGruppen(ich.mitgliedschaften, ich.rollen),
    dienstgruppen: dienstgruppenAus(dienstgruppenRoh),
    dienste: diensteAus(diensteRoh as Parameters<typeof diensteAus>[0]),
    rechte: dienstRechteAus(rechteRoh, (status, meldung) => new ApiError(status, meldung)),
  };
}

/** Die ChurchTools-Gruppen, die man leitet – deren Dienste darf man planen. */
export function geleiteteGruppen(start: Start): Set<number> {
  return new Set(start.gruppen.filter((g) => g.leitung).map((g) => g.id));
}

/** Darf man diesen Dienst planen (global, als Leitung oder als Admin des Termins)? */
export function planbar(start: Start, dienst: Dienst, terminAdmin = false): boolean {
  return darfDienstPlanen(start.rechte, dienst, geleiteteGruppen(start), terminAdmin);
}

/**
 * Darf man den Ablauf dieses Termins bearbeiten (E6-3a)? Dieselbe Regel wie in der Musik-App (`darfAblaufBearbeiten`):
 * `edit agenda` für den Kalender des Termins oder Admin des Termins. Ein eigenes Admin-Recht wertet der Dienstplaner
 * nicht aus – auch nicht beim Planen.
 */
export function ablaufBearbeitbar(start: Start, termin: AblaufTermin): boolean {
  return darfAblaufBearbeiten(
    { isAdmin: false, ablaufKalender: start.rechte.ablaufKalender },
    termin,
    start.ichId,
  );
}

/** Liefert ChurchTools alle Plätze dieses Dienstes – oder nur die eigenen? (Matrix, „Wer wie oft?“) */
export function ganzSichtbar(start: Start, dienst: Dienst): boolean {
  const gruppe = start.dienstgruppen.find((g) => g.id === dienst.dienstgruppeId);
  return siehtDienstGanz(start.rechte, dienst, gruppe?.fuerAlle === true, geleiteteGruppen(start));
}

/**
 * Die Dienstgruppen, in denen man ohne Termin-Admin etwas planen darf, in der Reihenfolge der Gemeinde.
 * Daran hängen der Reiter „Planen“ und die Karte auf der Startseite. Wer nur als Admin einzelner Termine
 * plant, sieht das in der Matrix; einen eigenen Reiter bekommt er dafür nicht (bei der ECG nicht genutzt,
 * gemessen 13.10.2026).
 */
export function planbareDienstgruppen(start: Start): Dienstgruppe[] {
  const dienste = [...start.dienste.values()];
  return start.dienstgruppen.filter((g) =>
    dienste.some((d) => d.dienstgruppeId === g.id && planbar(start, d)),
  );
}
