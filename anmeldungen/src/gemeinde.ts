import { ApiError } from '@ui/ct/fehler';
import { modulId, modulPort } from '@ui/ct/modulPort';
import {
  inhaltAus,
  istDauerhaftLeer,
  kategorieSicherstellen,
  kategorieSuchen,
  wertAendern,
  wertAnlegen,
  werteLesen,
  type Wert,
} from '@shared/ct/modulDaten';
import {
  vorgabenVollstaendig,
  vorgabenVorschlag,
  type NeuePersonVorgaben,
  type Stammdaten,
} from '@shared/anmeldung/vorbereiten';
import { stammdaten } from './einrichten';

/**
 * **Was für die ganze Gemeinde gilt** (A6-2, #548) – zuerst die Vorgaben für neue Personen (Alwin, 14.10.2026:
 * „einmal je Gemeinde“). Abgelegt im Datenbereich der Erweiterung (wie die Einstellungen der Musik-App): eine
 * Kategorie mit einem Wert, darin JSON. Ein Gruppen-Admin legt sie fest; ohne gespeicherte Einstellung gilt der
 * Vorschlag („Interessent“, dazu Standort und Bereich, wenn es genau einen gibt).
 *
 * Wer die Kategorie in ChurchTools nicht sehen darf, bekommt eine leere Liste (gemessen, Musik-App) – dann gilt
 * ebenfalls der Vorschlag. Netz, Drosselung, 5xx **werfen**: Ein Aussetzer darf nicht still die Wahl der Gemeinde
 * durch den Vorschlag ersetzen.
 */

export const KATEGORIE_KUERZEL = 'anmeldungen-einstellungen';
export const KATEGORIE_NAME = 'Einstellungen der Anmeldungen';
const ART = 'anmeldungen-einstellungen';
const FASSUNG = 1;
const VERWEIGERT = 'ChurchTools erlaubt dir nicht, die Einstellungen der Anmeldungen zu speichern.';

interface Ablage {
  art: typeof ART;
  fassung: typeof FASSUNG;
  neuePersonen: NeuePersonVorgaben;
}

function ablageAus(w: Wert): Ablage | null {
  const a = inhaltAus<Ablage>(w, ART, FASSUNG);
  return a && vorgabenVollstaendig(a.neuePersonen) ? a : null;
}

/** Unser Wert – bei mehreren (zwei gleichzeitige erste Speichervorgänge) der älteste. */
function unserWert(werte: Wert[]): Wert | null {
  return [...werte].sort((a, b) => a.id - b.id).find((w) => ablageAus(w) !== null) ?? null;
}

/** Die gespeicherten Vorgaben – `null`, wenn es keine gibt oder man sie nicht sehen darf. */
export async function gespeicherteVorgaben(): Promise<NeuePersonVorgaben | null> {
  try {
    const modul = await modulId();
    const kategorie = await kategorieSuchen(modulPort, modul, KATEGORIE_KUERZEL);
    if (kategorie === null) return null;
    const w = unserWert(await werteLesen(modulPort, modul, kategorie));
    return w ? ablageAus(w)!.neuePersonen : null;
  } catch (e) {
    if (istDauerhaftLeer(modulPort, e)) return null;
    throw e;
  }
}

/**
 * **Was beim Freigeben gilt** – die gespeicherten Vorgaben, sonst der Vorschlag. Gespeichertes, das es in
 * ChurchTools nicht mehr gibt (Standort gelöscht), zählt nicht: Dann gilt der Vorschlag, und ist der unvollständig,
 * sagt das Freigeben, dass ein Admin es festlegen muss.
 */
export async function gemeindeVorgaben(s?: Stammdaten): Promise<Partial<NeuePersonVorgaben>> {
  const [gespeichert, daten] = await Promise.all([gespeicherteVorgaben(), s ?? stammdaten()]);
  const gibt = (liste: { id: number }[], id: number) => liste.some((x) => x.id === id);
  if (
    gespeichert &&
    gibt(daten.status, gespeichert.statusId) &&
    gibt(daten.standorte, gespeichert.campusId) &&
    gibt(daten.bereiche, gespeichert.departmentId)
  )
    return gespeichert;
  return vorgabenVorschlag(daten);
}

/**
 * **Speichern** (nur Gruppen-Admins; das Recht prüft ChurchTools) – und nachlesen: Ein „201“ beweist nicht, dass
 * der Wert dasteht (Lehre vom 11.08.2026).
 */
export async function speichereGemeindeVorgaben(v: NeuePersonVorgaben): Promise<void> {
  const text = JSON.stringify({ art: ART, fassung: FASSUNG, neuePersonen: v } satisfies Ablage);
  const modul = await modulId();
  const kategorie = await kategorieSicherstellen(
    modulPort,
    modul,
    {
      kuerzel: KATEGORIE_KUERZEL,
      name: KATEGORIE_NAME,
      beschreibung: 'Von der Erweiterung „Anmeldungen“ angelegt – bitte nicht löschen.',
    },
    VERWEIGERT,
  );
  const vorhanden = unserWert(await werteLesen(modulPort, modul, kategorie));
  if (vorhanden) await wertAendern(modulPort, modul, kategorie, vorhanden.id, text, VERWEIGERT);
  else await wertAnlegen(modulPort, modul, kategorie, text, VERWEIGERT);
  const nachher = unserWert(await werteLesen(modulPort, modul, kategorie));
  if (nachher?.value !== text)
    throw new ApiError(
      502,
      'ChurchTools hat die Einstellungen nicht übernommen. Bitte erneut versuchen.',
    );
}
