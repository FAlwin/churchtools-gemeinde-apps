/**
 * **Die Grundlage für Nachweise in ChurchTools** (Etappe F, N1a; Oberfläche folgt in N1b): die Gruppenart „Nachweis“ samt
 * Recht „Follow-ups durchführen“ an ihrer Leiter-Rolle. Lesen und Sichern trennt, was ein Mensch ohne Recht noch sehen darf:
 *
 * - `nachweisGrundlageLesen` schreibt nie. Die Rechte der Rolle liest sie nur, wenn man „Berechtigungen verwalten“ hat
 *   (`churchcore: administer persons`, über `rechteAus` wie überall) – sonst `rechtFehlt: null`. **Nicht lesbar ist nicht
 *   „fehlt“** (vorübergehend ist nicht ungültig): Wer „fehlt“ liest, richtet etwas ein.
 * - `nachweisGrundlageSichern` legt die Art an (falls es sie nicht gibt), ergänzt das Recht und liest nach. Es entzieht nichts.
 *
 * Fehler: `ApiError` (auch vom Anschluss durchgereicht) und `NichtUebernommen` – der gemeinsame Baustein wirft
 * `GruppenartFehler`, hier in die Fehlerarten des Projekts übersetzt.
 */
import { ctDaten } from '@ui/ct/verbindung';
import { ctPortMit } from '@ui/ct/ctPort';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { rechteAus, STANDARD_ADMIN_RECHT } from '@shared/ct/rechte';
import {
  fehlendeRechte,
  GruppenartFehler,
  gruppenartAnlegen,
  gruppenartRollen,
  gruppenartSuchen,
  listeHolen,
  rechteErgaenzen,
  type CtPort,
  type RechtRoh,
} from '@shared/ct/gruppenart';
import { istNachweisArt, NACHWEIS_ART, NACHWEIS_LEITER_RECHTE } from '@shared/anmeldung/nachweise';

const port = (): CtPort =>
  ctPortMit('Dir fehlt in ChurchTools das Recht dafür (Berechtigungen verwalten).');

export interface NachweisGrundlage {
  /** Nummer der Gruppenart „Nachweis“ – `null`: gibt es noch nicht. */
  typId: number | null;
  /**
   * Fehlt das Recht „Follow-ups durchführen“ an der Leiter-Rolle? `null` = nicht lesbar: kein Recht dafür
   * (`darfEinrichten` false), es gibt die Art noch nicht, die Rolle fehlt oder ChurchTools antwortet nicht.
   */
  rechtFehlt: boolean | null;
  /** „Berechtigungen verwalten“ – nur damit lässt sich die Grundlage einrichten. */
  darfEinrichten: boolean;
}

/**
 * Übersetzt den Fehler des Bausteins in die Fehlerarten des Projekts; alles andere geht unverändert durch.
 *
 * - `nichtUebernommen` → `NichtUebernommen` (sagt, WAS fehlt),
 * - `unlesbar` → 502: ließ sich nicht nachlesen – vorübergehend, „Erneut versuchen“,
 * - `anders` (z. B. „Rollen fehlen“) → **422** mit dem Text des Bausteins: Das ist keine Störung von ChurchTools, sondern
 *   etwas, das jemand in ChurchTools ansehen muss. Mit 502 las `fehlerMeldung` es als „antwortet gerade nicht“ (N1b).
 */
function uebersetzt(e: unknown): unknown {
  if (!(e instanceof GruppenartFehler)) return e;
  if (e.art === 'nichtUebernommen') return new NichtUebernommen(e.was);
  return new ApiError(e.art === 'anders' ? 422 : 502, e.message);
}

/** Wie steht es um die Grundlage? Liest nur. */
export async function nachweisGrundlageLesen(): Promise<NachweisGrundlage> {
  try {
    const p = port();
    const global = await ctDaten<Record<string, Record<string, unknown>>>('/permissions/global');
    const darfEinrichten = rechteAus(
      global,
      STANDARD_ADMIN_RECHT,
      (status, meldung) => new ApiError(status, meldung),
    ).isAdmin;
    const { id: typId } = await gruppenartSuchen(p, istNachweisArt);
    if (typId === null || !darfEinrichten) return { typId, rechtFehlt: null, darfEinrichten };
    let rechtFehlt: boolean | null = null;
    try {
      const { leiter } = await gruppenartRollen(p, typId);
      if (leiter !== null) {
        const rows = await listeHolen<RechtRoh>(
          p,
          `/permissions/group_type_role/${leiter}`,
          'Die Rechte der Rolle „Leiter“',
        );
        rechtFehlt = fehlendeRechte(rows, NACHWEIS_LEITER_RECHTE).length > 0;
      }
    } catch {
      rechtFehlt = null;
    }
    return { typId, rechtFehlt, darfEinrichten };
  } catch (e) {
    throw uebersetzt(e);
  }
}

/** Legt die Gruppenart an (falls nötig) und ergänzt das Recht an der Leiter-Rolle; liest nach. Wirft bei jedem Fehler. */
export async function nachweisGrundlageSichern(): Promise<{
  typId: number;
  leiterRolle: number;
  teilnehmerRolle: number;
}> {
  try {
    const p = port();
    const { typId, leiter, teilnehmer } = await gruppenartAnlegen(p, NACHWEIS_ART, istNachweisArt);
    await rechteErgaenzen(p, leiter, NACHWEIS_LEITER_RECHTE);
    return { typId, leiterRolle: leiter, teilnehmerRolle: teilnehmer };
  } catch (e) {
    throw uebersetzt(e);
  }
}
