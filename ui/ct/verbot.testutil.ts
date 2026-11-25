/**
 * **ChurchTools verweigert etwas – für Tests der Erweiterungen** (#1147). Stellt die Verbindung wie eine Erweiterung ein,
 * aber mit einem Ersatztext, den man wiedererkennt (`ERSATZTEXT`): Kommt er heraus, hat der Aufruf keinen eigenen Text
 * mitgegeben. Den Wortlaut in `main.tsx` prüft das nicht – der wird in keinem Test geladen.
 *
 * `ctAntwortet` beantwortet jede Anfrage mit `antwort(methode, pfad)`; das CSRF-Token für Schreibendes liefert es selbst.
 */
import { afterEach, beforeEach, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf, verbindungEinrichten } from './verbindung';

export const ERSATZTEXT = 'Ersatztext aus main.tsx';

/** Die Antwort von ChurchTools bei fehlendem Recht (so gemessen, auch Dienstplaner #1142). */
export const VERBOT = {
  message: 'Keine ausreichende Berechtigung.',
  messageKey: 'error.forbidden.view',
};

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const verboten = (): Response => json(403, VERBOT);

/** Vor/nach jedem Test: Verbindung mit `ERSATZTEXT`, Adresse der Instanz, danach alles zurück. */
export function verbindungMitErsatztext(): void {
  beforeEach(() => {
    _vergissCsrf();
    _bremseLoesen();
    verbindungEinrichten({ keinRecht: ERSATZTEXT });
    vi.stubGlobal('window', {
      settings: { base_url: 'https://ct.test/' },
      location: { origin: 'https://ct.test' },
    });
  });
  afterEach(() => {
    verbindungEinrichten({});
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
}

export function ctAntwortet(antwort: (methode: string, pfad: string) => Response): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation((eingabe, init) => {
    const url = new URL(eingabe instanceof Request ? eingabe.url : String(eingabe));
    const pfad = url.pathname.replace(/^\/api/, '') + url.search;
    if (pfad === '/csrftoken') return Promise.resolve(json(200, { data: 'token' }));
    return Promise.resolve(antwort(init?.method ?? 'GET', pfad));
  });
}
