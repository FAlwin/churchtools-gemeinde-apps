import { gemeindeNameAus } from '@shared/ct/info';
import {
  abmeldeDatenAus,
  apiBasis,
  ladeFehlerAus,
  type AbmeldeDaten,
  type AbmeldeOrt,
  veranstaltungAus,
  type AnmeldeOrt,
  type LadeFehler,
  type OeffentlicheGruppeRoh,
  type OeffentlicheVeranstaltung,
} from '@shared/anmeldung/oeffentlich';

/** Wie lange die Seite auf ChurchTools wartet, bevor sie „antwortet gerade nicht“ sagt. */
export const WARTEN_MS = 15_000;

/** Ein Fehler beim Laden – mit der Art, die die Seite erklärt. */
export class LadeProblem extends Error {
  constructor(readonly art: LadeFehler) {
    super(art);
    this.name = 'LadeProblem';
  }
}

/**
 * Eine Anfrage OHNE Login (`credentials: 'omit'`) – das Formular ist für Gäste. Zeitüberschreitung, kein Netz
 * und jeder Status ≠ 2xx werden zu einem `LadeProblem` mit der passenden Art.
 */
async function anfrage(url: string): Promise<unknown> {
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), WARTEN_MS);
  let antwort: Response;
  try {
    antwort = await fetch(url, { credentials: 'omit', signal: abbruch.signal });
  } catch {
    throw new LadeProblem(ladeFehlerAus(abbruch.signal.aborted ? 'zeit' : 'netz'));
  } finally {
    clearTimeout(uhr);
  }
  if (!antwort.ok) throw new LadeProblem(ladeFehlerAus(antwort.status));
  return antwort.json();
}

export interface Geladen {
  veranstaltung: OeffentlicheVeranstaltung;
  gemeinde: string | null;
}

/**
 * **Die Veranstaltung laden** – Gruppe und Gemeindename gleichzeitig. Fehlt nur der Gemeindename, ist das kein
 * Grund, das Formular nicht zu zeigen.
 */
export async function ladeVeranstaltung(ort: AnmeldeOrt): Promise<Geladen> {
  const basis = apiBasis(ort);
  const [gruppe, info] = await Promise.all([
    anfrage(`${basis}/publicgroups/${ort.gruppeId}`),
    anfrage(`${basis}/info`).catch(() => null),
  ]);
  const veranstaltung = veranstaltungAus(
    (gruppe as { data?: OeffentlicheGruppeRoh } | null)?.data ?? {},
  );
  if (!veranstaltung) throw new LadeProblem('keine-anmeldung');
  return { veranstaltung, gemeinde: gemeindeNameAus(info) };
}

export interface AbmeldungGeladen {
  abmeldung: AbmeldeDaten;
  /** `null`, wenn die Veranstaltung selbst nicht mehr lesbar ist (z. B. beendet) – absagen geht trotzdem. */
  veranstaltung: OeffentlicheVeranstaltung | null;
  gemeinde: string | null;
}

/**
 * **„Deine Anmeldung“ laden** (A6-4): was ChurchTools zum Schlüssel aus der Mail herausgibt (`signoutdata`, ohne Login)
 * und die Veranstaltung für Kopf, Bankdaten und Kontakt. Ein falscher Schlüssel ist 404 (gemessen) → „Link gilt
 * nicht“. Ist nur die Veranstaltung nicht mehr lesbar (403/404), zeigt die Seite trotzdem, wer angemeldet ist;
 * Vorübergehendes wirft – dann „noch einmal versuchen“.
 */
export async function ladeAbmeldung(ort: AbmeldeOrt): Promise<AbmeldungGeladen> {
  const [roh, geladen] = await Promise.all([
    anfrage(
      `${apiBasis(ort)}/publicgroups/${ort.gruppeId}/signoutdata?token=${encodeURIComponent(ort.token)}`,
    ).catch((e: unknown) => {
      if (e instanceof LadeProblem && e.art === 'nicht-gefunden')
        throw new LadeProblem('abmeldelink');
      throw e;
    }),
    ladeVeranstaltung(ort).catch((e: unknown) => {
      if (e instanceof LadeProblem && ['voruebergehend', 'keine-verbindung'].includes(e.art))
        throw e;
      return null;
    }),
  ]);
  const abmeldung = abmeldeDatenAus(roh);
  if (!abmeldung) throw new LadeProblem('voruebergehend');
  return {
    abmeldung,
    veranstaltung: geladen?.veranstaltung ?? null,
    gemeinde: geladen?.gemeinde ?? null,
  };
}
