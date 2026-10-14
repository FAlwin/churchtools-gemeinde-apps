import { ApiError } from '@ui/ct/fehler';
import { ctDaten } from '@ui/ct/verbindung';
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
import { formularAdresseAus, herkunftVon } from '@shared/anmeldung/oeffentlich';
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
 * Dazu die **Adresse der Formular-Seite** (Alwin, 14.10.2026): Jede Gemeinde legt das öffentliche Formular auf
 * ihren eigenen Webspace – „Voraussetzung für diese Extension, auf keinen Fall soll unsere Domain da sichtbar
 * werden“. Ohne Adresse gibt es keinen Link, und die Erweiterung zeigt nur, was einzurichten ist.
 *
 * Wer die Kategorie in ChurchTools nicht sehen darf, bekommt eine leere Liste (gemessen, Musik-App) – dann gilt
 * der Vorschlag bzw. „keine Adresse“. Netz, Drosselung, 5xx **werfen**: Ein Aussetzer darf nicht still die Wahl der
 * Gemeinde ersetzen.
 */

export const KATEGORIE_KUERZEL = 'anmeldungen-einstellungen';
export const KATEGORIE_NAME = 'Einstellungen der Anmeldungen';
const ART = 'anmeldungen-einstellungen';
const FASSUNG = 1;
const VERWEIGERT = 'ChurchTools erlaubt dir nicht, die Einstellungen der Anmeldungen zu speichern.';

interface Ablage {
  art: typeof ART;
  fassung: typeof FASSUNG;
  neuePersonen?: NeuePersonVorgaben | null;
  formularAdresse?: string | null;
}

/** Was eine Gemeinde eingestellt hat – jeder Teil einzeln geprüft, Ungültiges zählt als „nicht eingestellt“. */
export interface GemeindeEinstellungen {
  neuePersonen: NeuePersonVorgaben | null;
  formularAdresse: string | null;
}

function ablageAus(w: Wert): GemeindeEinstellungen | null {
  const a = inhaltAus<Ablage>(w, ART, FASSUNG);
  if (!a) return null;
  return {
    neuePersonen: vorgabenVollstaendig(a.neuePersonen) ? a.neuePersonen : null,
    formularAdresse:
      typeof a.formularAdresse === 'string' ? formularAdresseAus(a.formularAdresse) : null,
  };
}

/** Unser Wert – bei mehreren (zwei gleichzeitige erste Speichervorgänge) der älteste. */
function unserWert(werte: Wert[]): Wert | null {
  return [...werte].sort((a, b) => a.id - b.id).find((w) => ablageAus(w) !== null) ?? null;
}

const NICHTS: GemeindeEinstellungen = { neuePersonen: null, formularAdresse: null };

/** Was gespeichert ist – „nichts“, wenn es keine Einstellungen gibt oder man sie nicht sehen darf. */
export async function gemeindeEinstellungen(): Promise<GemeindeEinstellungen> {
  try {
    const modul = await modulId();
    const kategorie = await kategorieSuchen(modulPort, modul, KATEGORIE_KUERZEL);
    if (kategorie === null) return NICHTS;
    const w = unserWert(await werteLesen(modulPort, modul, kategorie));
    return w ? ablageAus(w)! : NICHTS;
  } catch (e) {
    if (istDauerhaftLeer(modulPort, e)) return NICHTS;
    throw e;
  }
}

/** Die gespeicherten Vorgaben für neue Personen – `null`, wenn es keine gibt oder man sie nicht sehen darf. */
export async function gespeicherteVorgaben(): Promise<NeuePersonVorgaben | null> {
  return (await gemeindeEinstellungen()).neuePersonen;
}

/** Die Adresse der Formular-Seite – `null`, solange keine eingerichtet ist (dann gibt es keinen Link). */
export async function formularAdresse(): Promise<string | null> {
  return (await gemeindeEinstellungen()).formularAdresse;
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
export async function speichereGemeindeEinstellungen(g: {
  neuePersonen: NeuePersonVorgaben;
  formularAdresse: string;
}): Promise<void> {
  const adresse = formularAdresseAus(g.formularAdresse);
  if (!adresse)
    throw new ApiError(422, 'Bitte eine gültige https-Adresse für das Formular eintragen.');
  const text = JSON.stringify({
    art: ART,
    fassung: FASSUNG,
    neuePersonen: g.neuePersonen,
    formularAdresse: adresse,
  } satisfies Ablage);
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

/** Was die Prüfung der Formular-Seite ergeben hat. `erlaubt: null` = in ChurchTools nicht lesbar. */
export interface SeitenPruefung {
  erreichbar: boolean;
  erlaubt: boolean | null;
  herkunft: string;
}

/**
 * **Die Formular-Seite prüfen**, bevor die Adresse gespeichert wird: Ist sie erreichbar (ohne CORS lässt sich nur
 * „antwortet“ feststellen, nicht der Inhalt), und steht ihre Herkunft in ChurchTools als erlaubt
 * (`access_control_allow_origins`, gemessen A0)? Ohne den Eintrag blockt der Browser jede Anfrage des Formulars.
 */
export async function pruefeFormularSeite(adresse: string): Promise<SeitenPruefung> {
  const herkunft = herkunftVon(adresse);
  const erreichbar = await fetch(adresse, { mode: 'no-cors', cache: 'no-store' }).then(
    () => true,
    () => false,
  );
  let erlaubt: boolean | null = null;
  try {
    const c = await ctDaten<{ access_control_allow_origins?: string | string[] | null }>('/config');
    const roh = c?.access_control_allow_origins;
    const liste: unknown = typeof roh === 'string' ? JSON.parse(roh || '[]') : roh;
    if (Array.isArray(liste))
      erlaubt = liste.some((x) => String(x).replace(/\/+$/, '') === herkunft);
  } catch {
    erlaubt = null;
  }
  return { erreichbar, erlaubt, herkunft };
}
