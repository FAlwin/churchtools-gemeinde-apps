/**
 * **Die Einstellung „Hinweis auf fällige To-Dos“ lesen und speichern** – gemeindeweit, ein Wert in der Kategorie
 * „Vorlagen“ (neben den Vorlagen; `ladeVorlagen` überliest ihn, weil er keine Vorlage ist). Lesen darf jeder mit einer
 * eingerichteten Gruppe, schreiben nur ein Admin (wie bei den Vorlagen, S2-1). Die Regeln stehen in
 * `@shared/protokolle/hinweis`.
 *
 * - `ladeVorlauf` wirft jeden Lesefehler – die Verwaltung zeigt dann „Erneut versuchen“.
 * - `ladeVorlaufOderStandard` blockiert nie: Kein Recht, keine Kategorie, Netz-Schluckauf → der Standard (3 Tage), **nicht**
 *   „Aus“ – ein vorübergehender Fehler darf den Hinweis nicht abschalten.
 * - `vorlaufSpeichern` liest nach (ein 201/200 ist kein Beleg, Lehre vom 11.08.2026).
 */
import {
  kategorieSuchen,
  MAX_ZEICHEN,
  werteLesen,
  wertAendern,
  wertAnlegen,
} from '@shared/ct/modulDaten';
import { KUERZEL_VORLAGEN } from '@shared/protokolle/speicher';
import {
  neuerHinweis,
  STANDARD_VORLAUF,
  vorlaufAus,
  type Vorlauf,
} from '@shared/protokolle/hinweis';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { modulPort } from '@ui/ct/modulPort';
import { NUR_ADMIN, vorlagenKategorie } from './vorlagen';

/** Der eingestellte Vorlauf; ohne Kategorie oder Wert der Standard. Jeder Lesefehler wird geworfen. */
export async function ladeVorlauf(modul: number): Promise<Vorlauf> {
  const kategorie = await kategorieSuchen(modulPort, modul, KUERZEL_VORLAGEN);
  if (kategorie === null) return STANDARD_VORLAUF;
  return vorlaufAus(await werteLesen(modulPort, modul, kategorie)).vorlauf;
}

/** Wie `ladeVorlauf`, wirft aber nie: bei jedem Fehler der Standard (nur der Grund im Log, keine Daten). */
export async function ladeVorlaufOderStandard(modul: number): Promise<Vorlauf> {
  try {
    return await ladeVorlauf(modul);
  } catch (e) {
    console.warn(
      `Protokolle: To-Do-Hinweis nicht gelesen (${e instanceof ApiError ? `Status ${e.status}` : 'Fehler'}) – es gilt der Standard.`,
    );
    return STANDARD_VORLAUF;
  }
}

/**
 * **Den Vorlauf speichern** (nur Admins) – ändert den vorhandenen Wert oder legt ihn an (und, falls es die Kategorie noch
 * nicht gibt, sie samt Standard-Vorlagen: `vorlagenKategorie`). Danach nachgelesen; stimmt es nicht, `NichtUebernommen`.
 */
export async function vorlaufSpeichern(modul: number, vorlauf: Vorlauf): Promise<void> {
  const text = JSON.stringify(neuerHinweis(vorlauf));
  if (text.length > MAX_ZEICHEN) throw new ApiError(413, 'Der Wert ist zu lang.');
  const kategorie = await vorlagenKategorie(modul);
  const da = vorlaufAus(await werteLesen(modulPort, modul, kategorie));
  if (da.wert !== null) await wertAendern(modulPort, modul, kategorie, da.wert, text, NUR_ADMIN);
  else await wertAnlegen(modulPort, modul, kategorie, text, NUR_ADMIN);
  if ((await ladeVorlauf(modul)) !== vorlauf) throw new NichtUebernommen('die Einstellung');
}
