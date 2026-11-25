/**
 * **Gruppentypen und Gruppen aus ChurchTools** (W15-5, Reiter „Anmeldung“ im Fenster „In Kalender eintragen“).
 *
 * - `ladeGruppentypen`: `GET /group/grouptypes` (`nameTranslated`), nur die Typen, in denen man Gruppen anlegen darf.
 *   **Wirft bei jedem Fehler** – „keine Typen“ ist nicht „ChurchTools antwortet nicht“.
 * - `ladeGruppenDesTyps`: `GET /groups?group_type_ids[]=…` über alle Seiten (`ctAlleSeiten`, wie die Anmeldungen) – die
 *   Auswahl „Gruppe als Kopiervorlage“. Ohne Statusfilter: ChurchTools zeigt im Dialog „Gruppen des gewählten Typs“.
 * - `anmeldungNachlesen`: **Ein Erfolgssignal ist kein Beleg** (Lehre 11.08.2026). ChurchTools legt mit dem Termin sofort
 *   echte Gruppen an, die Antwort nennt sie nicht. Nachgelesen wird (1) `signup` am gelesenen Termin und (2) die Gruppen des
 *   Typs: Steht zu jedem angekündigten Einzeltermin eine Gruppe, deren Name mit „<Titel> – TT.MM.JJJJ, HH:MM“ beginnt?
 *   Scheitert das Lesen, ist es **unklar**, nicht „fehlt“ (vorübergehend ist nicht ungültig). Nichts wird gelöscht.
 */
import {
  gruppenAus,
  gruppenName,
  gruppentypenAus,
  signupAus,
  type AnmeldungErgebnis,
  type AnmeldungTermin,
  type Gruppe,
  type Gruppentyp,
} from '@shared/protokolle/terminAnmeldung';
import { ctAlleSeiten, ctDaten } from '@ui/ct/verbindung';

export async function ladeGruppentypen(erlaubt: ReadonlySet<number>): Promise<Gruppentyp[]> {
  return gruppentypenAus(await ctDaten<unknown>('/group/grouptypes'), erlaubt);
}

/** Der Pfad, der die Gruppen eines Typs liest. */
export const gruppenPfad = (typ: number): string => `/groups?group_type_ids[]=${typ}`;

export async function ladeGruppenDesTyps(typ: number): Promise<Gruppe[]> {
  return gruppenAus(await ctAlleSeiten<unknown>(gruppenPfad(typ)));
}

/**
 * Ist die Anmeldung am Termin angekommen – und die angekündigten Gruppen da? `signup` ist das Feld `signup` des gelesenen
 * Termins (`terminLaden`). Wirft nie.
 */
export async function anmeldungNachlesen(q: {
  signup: unknown;
  typ: number;
  titel: string;
  erwartet: readonly AnmeldungTermin[];
}): Promise<AnmeldungErgebnis> {
  if (signupAus(q.signup)?.typ !== q.typ) return { signupFehlt: true, fehlend: [], unklar: false };
  if (!q.erwartet.length) return { signupFehlt: false, fehlend: [], unklar: false };
  try {
    const gelesen = await ladeGruppenDesTyps(q.typ);
    const namen = q.erwartet.map((t) => gruppenName(q.titel, t));
    return {
      signupFehlt: false,
      fehlend: namen.filter((n) => !gelesen.some((g) => g.name.startsWith(n))),
      unklar: false,
    };
  } catch {
    return { signupFehlt: false, fehlend: [], unklar: true };
  }
}
