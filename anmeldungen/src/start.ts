/**
 * **Was die Startseite der Anmeldungen braucht** (#474, A1): wer angemeldet ist, die Gemeinde und die
 * eigenen Gruppen – mit Leitung oder Mitglied. Jede Veranstaltung gehört später zu einer dieser Gruppen.
 *
 * Gelesen wird mit der Sitzung der ChurchTools-Seite (`ui/ct/verbindung.ts`). Die Regeln stehen in
 * `shared/ct/` (`whoamiId`, `meineGruppen`, `gemeindeNameAus`) – dieselben, die die Musik-App nutzt.
 */
import { ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { whoamiId } from '@shared/ct/whoami';
import { meineGruppen, type MeineGruppe, type RohMitgliedschaft } from '@shared/ct/gruppen';
import { gemeindeNameAus } from '@shared/ct/info';
import { istVeranstaltung } from '@shared/anmeldung/uebersicht';

export interface Start {
  vorname: string;
  /** `null`, wenn ChurchTools keinen Namen nennt oder `/info` gerade nicht antwortet. */
  gemeinde: string | null;
  gruppen: MeineGruppe[];
}

/**
 * Lädt alles für die Startseite. **Wirft**, wenn Person oder Gruppen nicht lesbar sind – eine leere
 * Liste hieße „du bist in keiner Gruppe", und das wäre bei einem Aussetzer von ChurchTools falsch
 * (vorübergehend ist nicht ungültig). Nur der Gemeindename ist Beiwerk und darf fehlen.
 */
export async function ladeStart(): Promise<Start> {
  const ich = await ctDaten<{ id?: unknown; firstName?: unknown } | null>('/whoami');
  const id = whoamiId(ich);
  if (id === 0) throw new ApiError(401, 'Bei ChurchTools nicht angemeldet.');
  if (id === null) throw new ApiError(503, 'ChurchTools antwortet gerade nicht eindeutig.');
  const [mitgliedschaften, rollen, gemeinde] = await Promise.all([
    ctDaten<RohMitgliedschaft[] | null>(`/persons/${id}/groups`),
    ctDaten<{ id?: unknown; isLeader?: unknown }[] | null>('/group/roles'),
    ctAnfrage<unknown>('/info').then(gemeindeNameAus, () => null),
  ]);
  const vorname = typeof ich?.firstName === 'string' ? ich.firstName.trim() : '';
  // Veranstaltungen, in denen man selbst Mitglied ist (Leitung, angemeldet mit Konto), sind keine Teams
  // (gemessen A3: /persons/{id}/groups liefert sie mit, samt Beschreibung).
  const teams = (mitgliedschaften ?? []).filter(
    (m) => !istVeranstaltung({ beschreibung: m.group?.domainAttributes?.note ?? '' }),
  );
  return { vorname, gemeinde, gruppen: meineGruppen(teams, rollen) };
}
