/**
 * **Der Altbestand auf dem Daten-Volume** – was die Server-App bis zur Ablage in ChurchTools
 * (09.10.2026) dort hatte, und der Stand des Umzugs je Konto (`ablage-umzug.json`).
 *
 * Eigenes Modul, weil drei Dienste es lesen: der Umzug (`ablageUmzug.ts`), die Ablage der Controller
 * (`kontoAblage.ts`) und die Team-Notizen (`ctTeilenServer.ts` – wer geteilt hat, aber noch nicht
 * umgezogen ist, wird weiter vom Volume gezeigt). Hier stehen nur Volume und Umzugsstand, kein
 * ChurchTools – so hängt niemand im Kreis.
 *
 * Auf Staging aus (`config.ablageUmzug`): Dort sind die Notizen auf dem Volume Testreste.
 *
 * ⚠️ Prozesslokal – siehe „Ein Prozess, ein Zustand" in `docs/entwicklung/entscheidungen.md`.
 */
import path from 'node:path';
import { config } from '../config.js';
import type { Altbestand } from '@shared/ct/personenAblage';
import { readJsonStore, writeJsonStore } from './jsonStore.js';
import * as annotations from './annotations.js';
import * as userSettings from './userSettings.js';
import { getSeenSetlists } from './seenSetlists.js';
import { sharingEintrag } from './sharing.js';

export interface Eintrag {
  fertigAm?: number;
  geloeschtAm?: number;
  /** Seiten, die während des Umzugs in ChurchTools geändert wurden – das Volume füllt sie nicht. */
  ueberschrieben?: string[];
}
type Store = Record<string, Eintrag>;

function datei(): string {
  return path.join(config.annotationsPath, 'ablage-umzug.json');
}

let stand: Store | null = null;
let schreibKette: Promise<unknown> = Promise.resolve();

export async function lesen(): Promise<Store> {
  // Nur „gibt es nicht" ist leer (#273) – ein Lesefehler darf keinen Umzug als „nicht fertig" werten
  // und schon gar keinen leeren Stand zurückschreiben.
  stand ??= (await readJsonStore<Store>(datei(), 'Umzug der Ablage')) ?? {};
  return stand;
}

export async function aendern(userId: number, fn: (e: Eintrag) => void): Promise<void> {
  const lauf = async (): Promise<void> => {
    const s = { ...(await lesen()) };
    const e = { ...(s[String(userId)] ?? {}) };
    fn(e);
    s[String(userId)] = e;
    await writeJsonStore(datei(), JSON.stringify(s));
    stand = s;
  };
  schreibKette = schreibKette.then(lauf, lauf);
  await schreibKette;
}

function istLeer(a: Altbestand): boolean {
  return (
    Object.keys(a.anmerkungen).length === 0 &&
    Object.keys(a.einstellungen).length === 0 &&
    Object.keys(a.gesehen).length === 0 &&
    !a.teilen
  );
}

/** Was auf dem Volume für dieses Konto liegt – ohne die Seiten, die in ChurchTools schon neuer sind. */
export async function altbestandVon(userId: number, ohne: string[] = []): Promise<Altbestand> {
  const anmerkungen = { ...(await annotations.getAnnotations(userId, [])) };
  for (const key of ohne) delete anmerkungen[key];
  const gesehen: Altbestand['gesehen'] = {};
  for (const [eventId, s] of Object.entries(await getSeenSetlists(userId))) {
    gesehen[Number(eventId)] = s;
  }
  return {
    anmerkungen,
    einstellungen: await userSettings.getSettings(userId, []),
    gesehen,
    teilen: await sharingEintrag(userId),
  };
}

/**
 * Für Lesezugriffe: der Altbestand, solange der Umzug nicht fertig ist – sonst `null`. Die Aufrufer
 * ergänzen damit, was in ChurchTools noch fehlt (ChurchTools gewinnt).
 */
export async function altFuerLesen(userId: number): Promise<Altbestand | null> {
  if (!config.ablageUmzug) return null;
  const e = (await lesen())[String(userId)];
  if (e?.fertigAm) return null;
  const alt = await altbestandVon(userId, e?.ueberschrieben);
  return istLeer(alt) ? null : alt;
}

/** Eine Seite wurde während des Umzugs geändert – das Volume darf sie nicht mehr füllen. */
export async function merkeUeberschrieben(userId: number, key: string): Promise<void> {
  if (!config.ablageUmzug) return;
  const e = (await lesen())[String(userId)];
  if (e?.fertigAm || e?.ueberschrieben?.includes(key)) return;
  await aendern(userId, (x) => {
    x.ueberschrieben = [...(x.ueberschrieben ?? []), key];
  });
}

/** Nur für Tests. */
export function __resetAltbestandForTests(): void {
  stand = null;
  schreibKette = Promise.resolve();
}
