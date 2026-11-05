import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError, z } from 'zod';

/**
 * Eigene Fehlerklasse mit HTTP-Statuscode.
 *
 * `retryAfterMs` ist optional und wird vom `errorHandler` in den `Retry-After`-Kopf übersetzt (#300):
 * Bremst ChurchTools uns aus, ist „wann darf ich wieder?" die einzig brauchbare Zusatzinformation.
 * Der dritte Parameter bleibt optional, damit die bestehenden ~58 `new HttpError(...)` unberührt sind.
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Abbruch wegen Zeitüberschreitung (`AbortSignal.timeout`) – die eine Stelle für diese Erkennung.
 *
 * Steht hier und nicht in `ctHttp.ts`, weil auch der `errorHandler` sie braucht und `ctHttp.ts` von
 * hier importiert (umgekehrt wäre es ein Kreis).
 */
export function istZeitueberschreitung(e: unknown): boolean {
  return e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
}

/** Die Meldung dazu – `CtTimeoutError` und der `errorHandler` sagen dasselbe. */
export const CT_ANTWORTET_NICHT =
  'ChurchTools antwortet gerade nicht. Bitte später erneut versuchen.';

/**
 * Ein abgewiesener Rumpf (#844): zu groß, kein gültiges JSON, falsche Zeichenkodierung. Die Parser von
 * Express (body-parser) melden das als `http-errors`-Fehler mit Status 4xx und `expose: true`. Das ist
 * eine falsche Anfrage, kein Programmfehler – vorher wurde daraus ein 500 samt Stacktrace im Log, und
 * jede anonyme Anfrage mit kaputtem JSON schrieb eine Fehlerzeile.
 */
export function rumpfFehlerStatus(e: unknown): number | null {
  if (typeof e !== 'object' || e === null) return null;
  const { status, expose } = e as { status?: unknown; expose?: unknown };
  return expose === true && typeof status === 'number' && status >= 400 && status < 500
    ? status
    : null;
}

/** 404 für unbekannte Routen. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Nicht gefunden' });
};

/** Zentrale Fehlerbehandlung – immer als Letztes registrieren. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Ungültige Eingabe', details: z.flattenError(err) });
    return;
  }
  const rumpfStatus = rumpfFehlerStatus(err);
  if (rumpfStatus !== null) {
    res
      .status(rumpfStatus)
      .json({ error: rumpfStatus === 413 ? 'Die Daten sind zu groß.' : 'Ungültige Eingabe' });
    return;
  }
  if (err instanceof HttpError) {
    // `Retry-After` in Sekunden, aufgerundet und mindestens 1 – der Kopf erlaubt keine 0 und keine
    // Bruchteile (#300). Nur gesetzt, wenn der Fehler wirklich eine Wartezeit kennt.
    if (err.retryAfterMs && err.retryAfterMs > 0) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(err.retryAfterMs / 1000))));
    }
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Zeitüberschreitung beim LESEN einer ChurchTools-Antwort (#489): Das Abbruch-Signal gilt auch für
  // den Rumpf, und dort greift `ctFetch` nicht mehr. Vorübergehend, also 504 wie beim Abschicken –
  // ohne Stacktrace, denn es ist kein Programmfehler.
  if (istZeitueberschreitung(err)) {
    console.warn('[churchtools] Zeitüberschreitung beim Lesen der Antwort');
    res.status(504).json({ error: CT_ANTWORTET_NICHT });
    return;
  }
  console.error('Unerwarteter Fehler:', err);
  res.status(500).json({ error: 'Interner Serverfehler' });
};
