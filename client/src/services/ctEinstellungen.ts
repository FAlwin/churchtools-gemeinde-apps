/**
 * **Die Gemeinde-Einstellungen der Erweiterung** (#335, Phase 3b-4) – das Gegenstück zur `site.json` des
 * Servers: Links, Standard-Ansicht, später Gruppen und Termin-Arten.
 *
 * Abgelegt im **Datenbereich des eigenen ChurchTools-Moduls** (Alwin, 07.10.2026: „In den Daten der
 * Erweiterung"): eine Kategorie `musikapp-einstellungen` mit einem Wert, darin JSON. Gemessen auf der
 * Test-Instanz (Plan §2c): Das Modul findet man nur über die Liste (`shorty` = Kürzel), ein Wert fasst
 * höchstens 10.000 Zeichen, und wer die Kategorie nicht sehen darf, bekommt eine **leere** Liste.
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
import { ctAnfrage, KeinSpeicherRecht } from './ctRuntime';
import { erweiterungsKuerzel } from './modus';

/** Kürzel und Name der Kategorie, wie sie in ChurchTools erscheint (Administration → Erweiterung). */
export const KATEGORIE_KUERZEL = 'musikapp-einstellungen';
export const KATEGORIE_NAME = 'Einstellungen der Musik App';
/** Kennung im Wert – damit ein fremder Wert in derselben Kategorie nicht für unserer gehalten wird. */
const ART = 'musikapp-einstellungen';
const FASSUNG = 1;
/** Gemessen (Plan §2b): Mehr nimmt ChurchTools in einem Wert nicht an. */
const MAX_ZEICHEN = 10_000;

const VERWEIGERT = 'ChurchTools erlaubt dir nicht, die Einstellungen der Musik App zu speichern.';

interface Modul {
  id: number;
  shorty: string;
}
interface Kategorie {
  id: number;
  shorty: string;
}
interface Wert {
  id: number;
  dataCategoryId: number;
  value: string;
}

/** Was im Wert steht. */
interface Ablage {
  art: typeof ART;
  fassung: typeof FASSUNG;
  config: Omit<SiteConfig, 'appName' | 'description' | 'orgName'>;
}

async function daten<T>(pfad: string): Promise<T> {
  const body = await ctAnfrage<{ data?: T } | null>(pfad);
  return (body?.data ?? body) as T;
}

/**
 * Die ID des eigenen Moduls – je Sitzung der Seite einmal gesucht. Ein Fehlschlag wird NICHT gemerkt
 * (vorübergehend ist nicht ungültig).
 */
let modulSuche: Promise<number> | null = null;

function modulId(): Promise<number> {
  modulSuche ??= (async () => {
    const kuerzel = erweiterungsKuerzel();
    const module = await daten<Modul[]>('/custommodules');
    const modul = (module ?? []).find((m) => m.shorty === kuerzel);
    if (!modul) throw new ApiError(404, 'Die Musik App ist in ChurchTools nicht zu finden.');
    return modul.id;
  })();
  modulSuche.catch(() => (modulSuche = null));
  return modulSuche;
}

/** Nur für Tests: das gemerkte Modul vergessen. */
export function _vergissModul(): void {
  modulSuche = null;
}

async function kategorieSuchen(modul: number): Promise<Kategorie | null> {
  const liste = await daten<Kategorie[]>(`/custommodules/${modul}/customdatacategories`);
  return (liste ?? []).find((k) => k.shorty === KATEGORIE_KUERZEL) ?? null;
}

function werteLesen(modul: number, kategorie: number): Promise<Wert[]> {
  return daten<Wert[]>(
    `/custommodules/${modul}/customdatacategories/${kategorie}/customdatavalues`,
  );
}

/** Der Inhalt eines Werts – oder `null`, wenn er nicht von uns ist (kaputtes JSON, andere Art). */
function ablageAus(wert: Wert): Ablage['config'] | null {
  try {
    const roh = JSON.parse(wert.value) as Partial<Ablage> | null;
    if (roh?.art !== ART || roh.fassung !== FASSUNG || !roh.config) return null;
    return roh.config;
  } catch {
    return null;
  }
}

/**
 * Unser Wert in der Kategorie. Sollten es – etwa nach zwei gleichzeitigen ersten Speichervorgängen –
 * mehrere sein, gilt der älteste (kleinste ID); geschrieben wird ebenfalls in ihn.
 */
function unserWert(werte: Wert[]): Wert | null {
  return [...(werte ?? [])].sort((a, b) => a.id - b.id).find((w) => ablageAus(w) !== null) ?? null;
}

/**
 * Die gespeicherten Einstellungen (ohne Namen) – roh, geprüft wird beim Aufrufer. `null`, wenn es
 * keine gibt oder die Person sie nicht sehen darf: Dann gelten die Vorgaben.
 *
 * Die Zweige einzeln: keine Kategorie / leere Liste (kein Recht „Kategorien sehen") / fehlendes Recht
 * (`KeinSpeicherRecht`) / kein Modul (404) → `null`. Alles andere – Netz, Drosselung, 5xx – **wirft**: Sonst setzte ein
 * Aussetzer die Wahl der Gemeinde auf dem Gerät auf die Vorgabe zurück (`standardAnsicht.ts`).
 */
export async function gespeicherteEinstellungen(): Promise<Ablage['config'] | null> {
  try {
    const modul = await modulId();
    const kategorie = await kategorieSuchen(modul);
    if (!kategorie) return null;
    const wert = unserWert(await werteLesen(modul, kategorie.id));
    return wert ? ablageAus(wert) : null;
  } catch (e) {
    // Kein Recht oder kein Modul (falsches Kürzel) – beides bleibt so, bis jemand in ChurchTools etwas
    // ändert. Ein Neuladen ändert daran nichts, also gelten die Vorgaben.
    if (e instanceof KeinSpeicherRecht || (e instanceof ApiError && e.status === 404)) return null;
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
  let kategorie = await kategorieSuchen(modul);
  if (!kategorie) {
    await ctAnfrage(`/custommodules/${modul}/customdatacategories`, {
      method: 'POST',
      body: JSON.stringify({
        customModuleId: modul,
        name: KATEGORIE_NAME,
        shorty: KATEGORIE_KUERZEL,
        description: 'Von der Musik App angelegt – bitte nicht löschen.',
      }),
      verweigert: VERWEIGERT,
    });
    kategorie = await kategorieSuchen(modul);
    if (!kategorie) {
      throw fehler(502, 'ChurchTools hat den Speicherort für die Einstellungen nicht angelegt.');
    }
  }

  const basis = `/custommodules/${modul}/customdatacategories/${kategorie.id}/customdatavalues`;
  const vorhanden = unserWert(await werteLesen(modul, kategorie.id));
  if (vorhanden) {
    await ctAnfrage(`${basis}/${vorhanden.id}`, {
      method: 'PUT',
      body: JSON.stringify({ id: vorhanden.id, dataCategoryId: kategorie.id, value: text }),
      verweigert: VERWEIGERT,
    });
  } else {
    await ctAnfrage(basis, {
      method: 'POST',
      body: JSON.stringify({ dataCategoryId: kategorie.id, value: text }),
      verweigert: VERWEIGERT,
    });
  }

  // Nachsehen statt glauben: Steht jetzt genau dieser Text da?
  const nachher = unserWert(await werteLesen(modul, kategorie.id));
  if (nachher?.value !== text) {
    throw fehler(
      502,
      'ChurchTools hat die Einstellungen nicht übernommen. Bitte erneut versuchen.',
    );
  }
  return { ...geprueft, orgName: eingabe.orgName };
}
