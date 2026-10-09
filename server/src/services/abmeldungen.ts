/**
 * **Abgemeldete Sitzungen** – damit Abmelden auch serverseitig wirklich beendet (#460).
 *
 * Das App-Cookie ist selbsttragend (kein Sitzungs-Speicher, #194) und trägt seit dem 23.09.2026 den
 * ChurchTools-Anmeldeschlüssel. `getMe` holt damit still eine neue ChurchTools-Sitzung, wenn die alte
 * endet. Folge: Eine **vor** dem Abmelden kopierte App-Sitzung (Backup, fremdes Gerät, Proxy-Log)
 * konnte sich bis zu 90 Tage lang selbst wiederbeleben – `postLogout` beendete nur die
 * ChurchTools-Sitzung. Den Schlüssel in ChurchTools zu löschen kommt nicht infrage: Es gibt ihn je
 * Person nur einmal, andere Dienste nutzen ihn mit.
 *
 * **Deshalb merkt sich der Server, welche Anmeldung abgemeldet wurde** – als Kennung aus Konto und
 * Login-Zeitpunkt (`sitzungsKennung`). Beides steht in jedem Cookie dieser Anmeldung und ändert sich
 * weder beim Rollieren noch beim stillen Erneuern; Kopien haben dieselbe Kennung. Andere Geräte
 * derselben Person haben einen anderen Login-Zeitpunkt und bleiben angemeldet.
 *
 * Die Liste liegt im Daten-Volume (`abmeldungen.json`, wie `sharing.json`), damit sie einen Neustart
 * übersteht, und wird beim Start einmal gelesen – `readSession` ist synchron und fragt nur den
 * Speicher. Einträge verfallen, sobald die Anmeldung ohnehin abgelaufen wäre (90 Tage nach Login).
 *
 * ⚠️ Prozesslokal – siehe „Ein Prozess, ein Zustand" in `docs/entwicklung/entscheidungen.md`.
 */
import path from 'node:path';
import { config } from '../config.js';
import { readJsonStore, writeJsonStore } from './jsonStore.js';

/** Kennung → bis wann der Eintrag gebraucht wird (ms). */
type Store = Record<string, number>;

let gesperrt: Store = {};
let writeChain: Promise<unknown> = Promise.resolve();

function file(): string {
  return path.join(config.annotationsPath, 'abmeldungen.json');
}

/**
 * Beim Start einmal lesen. Ein Lesefehler (nicht „gibt es noch nicht") wirft – der Start meldet ihn
 * laut, statt still mit leerer Liste zu laufen (dann wären abgemeldete Kopien wieder gültig).
 */
export async function abmeldungenLaden(): Promise<void> {
  gesperrt = (await readJsonStore<Store>(file(), 'Abmeldungen')) ?? {};
}

/** Wurde diese Anmeldung abgemeldet? Synchron – für `readSession`. */
export function istAbgemeldet(kennung: string): boolean {
  return gesperrt[kennung] !== undefined;
}

/**
 * Diese Anmeldung als abgemeldet merken. **Im Speicher sofort**, auf der Platte so gut es geht: Scheitert
 * das Schreiben, gilt die Sperre bis zum nächsten Neustart und der Fehler wird geloggt – das Abmelden
 * selbst darf daran nie scheitern.
 */
export async function alsAbgemeldetMerken(kennung: string, bis: number): Promise<void> {
  const jetzt = Date.now();
  const neu: Store = {};
  // Bei dieser Gelegenheit aufräumen: Was ohnehin abgelaufen wäre, braucht keine Sperre mehr.
  for (const [k, v] of Object.entries(gesperrt)) if (v > jetzt) neu[k] = v;
  neu[kennung] = bis;
  gesperrt = neu;
  const run = async (): Promise<void> => writeJsonStore(file(), JSON.stringify(neu));
  writeChain = writeChain.then(run, run);
  try {
    await writeChain;
  } catch (e) {
    console.error('[abmeldungen] Konnte die Abmeldung nicht speichern:', (e as Error).message);
  }
}

/** Nur für Tests. */
export function __resetAbmeldungenForTests(): void {
  gesperrt = {};
  writeChain = Promise.resolve();
}
