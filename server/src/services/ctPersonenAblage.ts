/**
 * **Die Personen-Ablage der Server-App** – der Server-Anschluss an `@shared/ct/personenAblage`
 * (Ablage in ChurchTools, Alwin 09.10.2026: „so viel wie möglich bei ChurchTools").
 *
 * Bis dahin lagen Anmerkungen, Lied-Einstellungen, „gesehen" und Teilen auf dem Daten-Volume des Servers;
 * die Erweiterung sah sie nicht. Jetzt schreiben beide in dieselben Personen-Dateien in ChurchTools –
 * der Server mit der Sitzung der Person. Die Regeln stehen in `shared/ct`; hier nur, wie der Server
 * ChurchTools anspricht (`ctGet`, `fetchFileBytes`, `uploadPersonFile`, `deleteFile`).
 *
 * **Eine Ablage je Person**, im Speicher gehalten: Sie merkt sich Dateiliste und geladene Inhalte und
 * hält alle Zugriffe dieser Person in einer Reihe. Höchstens `MAX_PERSONEN` gleichzeitig (die zuletzt
 * genutzten), und je Person höchstens `MAX_BILDER` Bilder im Speicher – sonst wüchse der Container mit
 * jeder bemalten Seite.
 *
 * ⚠️ Prozesslokal – siehe „Ein Prozess, ein Zustand" in `docs/entwicklung/entscheidungen.md`.
 */
import { HttpError } from '../middleware/errorHandler.js';
import {
  erstellePersonenAblage,
  type AblagePort,
  type PersonenAblage,
} from '@shared/ct/personenAblage';
import { ctGet } from './ctHttp.js';
import { fetchFileBytes } from './ctFiles.js';
import { deleteFile, uploadPersonFile } from './ctWrite.js';

const MAX_PERSONEN = 50;
const MAX_BILDER = 80;

/** Der Anschluss für EINE Anfrage – mit ihrer Sitzung und der Person aus dem App-Cookie. */
export function ablagePortFuer(cookie: string, personId: number): AblagePort {
  return {
    meineId: () => Promise.resolve(personId),
    // `ctGet` packt `data` schon aus – die Ablage erwartet den Rumpf wie ChurchTools ihn schickt.
    lesen: async (pfad) => ({ data: await ctGet<unknown>(cookie, `/api${pfad}`) }),
    datei: async (fileUrl) => new Uint8Array((await fetchFileBytes(cookie, fileUrl)).buffer),
    hochladen: (pid, name, inhalt, typ) => uploadPersonFile(cookie, pid, name, inhalt, typ),
    loeschen: (fileId) => deleteFile(cookie, fileId),
    fehler: (status, meldung) => new HttpError(status, meldung),
    istKeinRecht: (e) => e instanceof HttpError && e.status === 403,
    istNichtGefunden: (e) => e instanceof HttpError && e.status === 404,
  };
}

const ablagen = new Map<number, PersonenAblage>();

/** Die Ablage dieser Person (zuletzt genutzt nach hinten; die älteste fällt bei Überlauf heraus). */
export function ablageVon(personId: number): PersonenAblage {
  let a = ablagen.get(personId);
  if (a) ablagen.delete(personId);
  else a = erstellePersonenAblage({ maxBilder: MAX_BILDER });
  ablagen.set(personId, a);
  if (ablagen.size > MAX_PERSONEN) {
    const aelteste = ablagen.keys().next().value;
    if (aelteste !== undefined) ablagen.delete(aelteste);
  }
  return a;
}

/** Nur für Tests. */
export function __resetAblagenForTests(): void {
  ablagen.clear();
}
