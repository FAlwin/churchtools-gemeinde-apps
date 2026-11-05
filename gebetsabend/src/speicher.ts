/**
 * **Der Speicher des Gebetsabends im Browser** (Bauplan Gebetsabend G3): der Anschluss mit Versionsnummer
 * (`versionPortFuer`) und die Meldungen bei fehlendem Recht. Die Regeln stehen in `@shared/gebetsabend/ablage`.
 */
import { ApiError } from '@ui/ct/fehler';
import { versionPortFuer } from '@ui/ct/modulPort';
import { kuerzelAusBasis } from '@ui/erweiterung/kuerzel';
import type { SpeicherGrund } from '@shared/ct/versionierterWert';
import { KATEGORIE_EINSTELLUNGEN, KATEGORIE_ZUGANG } from '@shared/gebetsabend/einrichten';

export const port = versionPortFuer(() => kuerzelAusBasis(import.meta.env.BASE_URL));

export const NUR_TECHNIK_ZUGANG = `Starten und beenden darf nur, wer in ChurchTools die Kategorie „${KATEGORIE_ZUGANG.name}“ bearbeiten darf (die Technik).`;
export const NUR_TECHNIK_EINSTELLUNGEN = `Ändern darf nur, wer in ChurchTools die Kategorie „${KATEGORIE_EINSTELLUNGEN.name}“ bearbeiten darf (die Technik).`;

/** Ein Lesefehler als Fehler zum Werfen – für Ansichten, die Fehler wie bisher fangen (`fehlerMeldung`). */
export function leseFehler(grund: SpeicherGrund): ApiError {
  if (grund === 'abgemeldet') return new ApiError(401, 'Bei ChurchTools nicht angemeldet.');
  if (grund === 'kein-recht') return new ApiError(403, 'ChurchTools erlaubt das Lesen nicht.');
  return new ApiError(503, 'ChurchTools antwortet gerade nicht.');
}
