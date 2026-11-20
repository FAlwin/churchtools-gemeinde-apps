/**
 * **Die Grundlage für Nachweise in ChurchTools** (Etappe F, N1a; Oberfläche folgt in N1b): die Gruppenart „Nachweis“ samt
 * Rechte an ihrer Leiter-Rolle (fünf in der Gruppe, dazu das Modulrecht „‚Anmeldungen‘ sehen“). Lesen und Sichern trennt, was ein Mensch ohne Recht noch sehen darf:
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
  modulRechtHolen,
  listeHolen,
  rechteErgaenzen,
  type CtPort,
  type RechtRoh,
  type SollRecht,
} from '@shared/ct/gruppenart';
import {
  istNachweisArt,
  NACHWEIS_ART,
  NACHWEIS_LEITER_RECHTE,
  NACHWEIS_MODULRECHT,
  NACHWEIS_TEILNEHMER_RECHTE,
} from '@shared/anmeldung/nachweise';

const port = (): CtPort =>
  ctPortMit('Dir fehlt in ChurchTools das Recht dafür (Berechtigungen verwalten).');

/**
 * Die Soll-Rechte der Leiter-Rolle – **die eine Stelle**, an der sie entstehen (Lesen und Sichern nutzen beide sie): die
 * gruppeninternen aus `NACHWEIS_LEITER_RECHTE` plus das Modulrecht „‚Anmeldungen‘ sehen“, dessen Nummer aus den
 * Definitionen kommt. Wirft, wenn ChurchTools das Recht nicht kennt.
 */
async function leiterSoll(p: CtPort): Promise<SollRecht[]> {
  const { modul, recht, name } = NACHWEIS_MODULRECHT;
  return [...NACHWEIS_LEITER_RECHTE, await modulRechtHolen(p, modul, recht, name)];
}

export interface NachweisGrundlage {
  /** Nummer der Gruppenart „Nachweis“ – `null`: gibt es noch nicht. */
  typId: number | null;
  /**
   * Fehlt ein Recht an der Leiter- oder Teilnehmer-Rolle (auch das Modulrecht „‚Anmeldungen‘ sehen“)? `null` = nicht lesbar: kein Recht dafür
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
      const { leiter, teilnehmer } = await gruppenartRollen(p, typId);
      if (leiter !== null && teilnehmer !== null) {
        const lesen = (rolle: number, name: string) =>
          listeHolen<RechtRoh>(
            p,
            `/permissions/group_type_role/${rolle}`,
            `Die Rechte der Rolle „${name}“`,
          );
        // Fehlt bei einer der beiden Rollen ein Recht, fehlt es.
        rechtFehlt =
          fehlendeRechte(await lesen(leiter, 'Leiter'), await leiterSoll(p)).length > 0 ||
          fehlendeRechte(await lesen(teilnehmer, 'Teilnehmer'), NACHWEIS_TEILNEHMER_RECHTE).length >
            0;
      }
    } catch {
      rechtFehlt = null;
    }
    return { typId, rechtFehlt, darfEinrichten };
  } catch (e) {
    throw uebersetzt(e);
  }
}

/** Legt die Gruppenart an (falls nötig) und ergänzt die Rechte an Leiter- und Teilnehmer-Rolle; liest nach. Wirft bei jedem Fehler. */
export async function nachweisGrundlageSichern(): Promise<{
  typId: number;
  leiterRolle: number;
  teilnehmerRolle: number;
}> {
  try {
    const p = port();
    const { typId, leiter, teilnehmer } = await gruppenartAnlegen(p, NACHWEIS_ART, istNachweisArt);
    await rechteErgaenzen(p, leiter, await leiterSoll(p));
    await rechteErgaenzen(p, teilnehmer, NACHWEIS_TEILNEHMER_RECHTE, 'Teilnehmer');
    return { typId, leiterRolle: leiter, teilnehmerRolle: teilnehmer };
  } catch (e) {
    throw uebersetzt(e);
  }
}
