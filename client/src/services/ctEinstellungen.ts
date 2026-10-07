/**
 * **Die Gemeinde-Einstellungen der Erweiterung** (#335, Phase 3b-4) – das Gegenstück zur `site.json` des
 * Servers: Links, Standard-Ansicht, Gruppen und Rollen der Team-Notizen, später Termin-Arten.
 *
 * Abgelegt im **Datenbereich des eigenen ChurchTools-Moduls** (Alwin, 07.10.2026: „In den Daten der
 * Erweiterung"): eine Kategorie `musikapp-einstellungen` mit einem Wert, darin JSON. Gemessen auf der
 * Test-Instanz (Plan §2c): ein Wert fasst höchstens 10.000 Zeichen, und wer die Kategorie nicht sehen
 * darf, bekommt eine **leere** Liste. Der Zugriff auf den Datenbereich steht in `ctModulDaten.ts`.
 *
 * Geprüft und zusammengesetzt wird mit `@shared/ct/einstellungen` – derselben Regel wie im Server. Das
 * gilt auch beim LESEN: Den Wert kann jeder ändern, der in ChurchTools Schreibrecht an der Kategorie hat,
 * an der App vorbei. Ein `javascript:`-Link darf deshalb auch auf diesem Weg nicht in die Seite kommen.
 *
 * Der Gemeindename steht nicht im Wert: Er kommt aus ChurchTools (`/api/info`).
 */
import { DEFAULT_SITE_CONFIG, type SiteConfig } from '@shared/types/index';
import { einstellungenPruefen } from '@shared/ct/einstellungen';
import { ApiError } from './api';
import {
  inhaltAus,
  istDauerhaftLeer,
  kategorieSicherstellen,
  kategorieSuchen,
  MAX_ZEICHEN,
  modulId,
  wertAendern,
  wertAnlegen,
  werteLesen,
  type Wert,
} from './ctModulDaten';

/** Kürzel und Name der Kategorie, wie sie in ChurchTools erscheint (Administration → Erweiterung). */
export const KATEGORIE_KUERZEL = 'musikapp-einstellungen';
export const KATEGORIE_NAME = 'Einstellungen der Musik App';
/** Kennung im Wert – damit ein fremder Wert in derselben Kategorie nicht für unserer gehalten wird. */
const ART = 'musikapp-einstellungen';
const FASSUNG = 1;

const VERWEIGERT = 'ChurchTools erlaubt dir nicht, die Einstellungen der Musik App zu speichern.';

/** Was im Wert steht. */
interface Ablage {
  art: typeof ART;
  fassung: typeof FASSUNG;
  config: Omit<SiteConfig, 'appName' | 'description' | 'orgName'>;
}

/** Der Inhalt eines Werts – oder `null`, wenn er nicht von uns ist (kaputtes JSON, andere Art). */
function ablageAus(wert: Wert): Ablage['config'] | null {
  return inhaltAus<Ablage>(wert, ART, FASSUNG)?.config ?? null;
}

/**
 * Unser Wert in der Kategorie. Sollten es – etwa nach zwei gleichzeitigen ersten Speichervorgängen –
 * mehrere sein, gilt der älteste (kleinste ID); geschrieben wird ebenfalls in ihn.
 */
function unserWert(werte: Wert[]): Wert | null {
  return [...werte].sort((a, b) => a.id - b.id).find((w) => ablageAus(w) !== null) ?? null;
}

/**
 * Die gespeicherten Einstellungen (ohne Namen) – roh, geprüft wird beim Aufrufer. `null`, wenn es
 * keine gibt oder die Person sie nicht sehen darf: Dann gelten die Vorgaben.
 *
 * Die Zweige einzeln: keine Kategorie / leere Liste (kein Recht „view custom category") / fehlendes
 * Recht / kein Modul → `null` (`istDauerhaftLeer`). Alles andere – Netz, Drosselung, 5xx – **wirft**:
 * Sonst setzte ein Aussetzer die Wahl der Gemeinde auf dem Gerät auf die Vorgabe zurück
 * (`standardAnsicht.ts`).
 */
export async function gespeicherteEinstellungen(): Promise<Ablage['config'] | null> {
  try {
    const modul = await modulId();
    const kategorie = await kategorieSuchen(modul, KATEGORIE_KUERZEL);
    if (kategorie === null) return null;
    const wert = unserWert(await werteLesen(modul, kategorie));
    return wert ? ablageAus(wert) : null;
  } catch (e) {
    if (istDauerhaftLeer(e)) return null;
    throw e;
  }
}

/**
 * Speichert die Einstellungen (nur Admins; das Recht prüft ChurchTools) und liefert, was danach
 * **gelesen** wurde – nicht, was geschickt wurde. Ein „201" allein beweist nicht, dass der Wert dasteht
 * (Lehre vom 11.08.2026).
 *
 * Gibt es die Kategorie noch nicht, wird sie beim ersten Speichern angelegt. Damit Musiker die
 * Einstellungen bekommen, braucht ihre Gruppe in ChurchTools das Recht, sie zu sehen
 * (`docs/betrieb/ERWEITERUNG.md`).
 */
export async function einstellungenSpeichern(eingabe: SiteConfig): Promise<SiteConfig> {
  const fehler = (status: number, meldung: string) => new ApiError(status, meldung);
  // Der Name wird nicht gespeichert (er kommt aus ChurchTools) – und darf deshalb auch nicht an der
  // 80-Zeichen-Grenze des Schemas scheitern. Geprüft wird mit dem Standardnamen.
  const geprueft = einstellungenPruefen(
    { ...eingabe, orgName: DEFAULT_SITE_CONFIG.orgName },
    fehler,
  );
  // Alles außer den festen Feldern und dem Namen – ohne Aufzählung, damit ein neues Feld nicht
  // vergessen werden kann (so wie es im Server-Controller bis 3b-4 drohte).
  const { appName: _a, description: _d, orgName: _o, ...config } = geprueft;
  const text = JSON.stringify({ art: ART, fassung: FASSUNG, config } satisfies Ablage);
  if (text.length > MAX_ZEICHEN) {
    throw fehler(
      413,
      'Die Einstellungen sind zu umfangreich für ChurchTools (z. B. zu viele Links).',
    );
  }

  const modul = await modulId();
  const kategorie = await kategorieSicherstellen(
    modul,
    {
      kuerzel: KATEGORIE_KUERZEL,
      name: KATEGORIE_NAME,
      beschreibung: 'Von der Musik App angelegt – bitte nicht löschen.',
    },
    VERWEIGERT,
  );

  const vorhanden = unserWert(await werteLesen(modul, kategorie));
  if (vorhanden) await wertAendern(modul, kategorie, vorhanden.id, text, VERWEIGERT);
  else await wertAnlegen(modul, kategorie, text, VERWEIGERT);

  // Nachsehen statt glauben: Steht jetzt genau dieser Text da?
  const nachher = unserWert(await werteLesen(modul, kategorie));
  if (nachher?.value !== text) {
    throw fehler(
      502,
      'ChurchTools hat die Einstellungen nicht übernommen. Bitte erneut versuchen.',
    );
  }
  return { ...geprueft, orgName: eingabe.orgName };
}
