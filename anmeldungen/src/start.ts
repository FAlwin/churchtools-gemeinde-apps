/**
 * **Was die Startseite der Anmeldungen braucht** (#474, A1): wer angemeldet ist, die Gemeinde und die
 * eigenen Gruppen – mit Leitung oder Mitglied. Jede Veranstaltung gehört später zu einer dieser Gruppen.
 *
 * Wer angemeldet ist, Gemeinde, Gruppen und Rollen liest `ladeIch` – dieselbe Stelle wie im
 * Dienstplaner (`ui/ct/ich.ts`). Hier steht nur, was die Anmeldungen anders machen: Ihre eigenen
 * Veranstaltungen zählen nicht als Teams.
 */
import { ladeIch } from '@ui/ct/ich';
import { meineGruppen, type MeineGruppe } from '@shared/ct/gruppen';
import { istVeranstaltung } from '@shared/anmeldung/uebersicht';

export interface Start {
  vorname: string;
  /** `null`, wenn ChurchTools keinen Namen nennt oder `/info` gerade nicht antwortet. */
  gemeinde: string | null;
  gruppen: MeineGruppe[];
}

/**
 * Lädt alles für die Startseite. **Wirft**, wenn Person oder Gruppen nicht lesbar sind (`ladeIch`) – eine
 * leere Liste hieße „du bist in keiner Gruppe", und das wäre bei einem Aussetzer von ChurchTools falsch.
 */
export async function ladeStart(): Promise<Start> {
  const ich = await ladeIch();
  // Veranstaltungen, in denen man selbst Mitglied ist (Leitung, angemeldet mit Konto), sind keine Teams
  // (gemessen A3: /persons/{id}/groups liefert sie mit, samt Beschreibung).
  const teams = ich.mitgliedschaften.filter(
    (m) => !istVeranstaltung({ beschreibung: m.group?.domainAttributes?.note ?? '' }),
  );
  return { vorname: ich.vorname, gemeinde: ich.gemeinde, gruppen: meineGruppen(teams, ich.rollen) };
}
