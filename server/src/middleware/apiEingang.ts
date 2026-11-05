import express, { type Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ipRateKey } from '../utils/ipKey.js';
import { sessionRateKey } from './session.js';

/**
 * **Der Eingang jeder Anfrage: erst zählen, dann lesen** (#844, Code-Check 04.11.2026).
 *
 * Bis dahin las `express.json({ limit: '8mb' })` jeden Rumpf, bevor das Rate-Limit zählte – auch
 * anonym, etwa bei `/api/auth/login`. Wer den Server lahmlegen wollte, konnte beliebig oft 8 MB
 * schicken, und jede Anfrage kostete erst Speicher und Rechenzeit, bevor sie abgewiesen wurde
 * (dazu kam die Lücke GHSA-27r3-jxmh-p828 in body-parser 2.3.0). Jetzt:
 *
 * 1. **Rate-Limit zuerst** – eine Anfrage über dem Kontingent wird abgewiesen, ohne dass ihr Rumpf
 *    gelesen wird.
 * 2. **Kleine Grenze für alle** (`RUMPF_GRENZE`), die große nur dort, wo sie gebraucht wird
 *    (`GROSSE_RUEMPFE`). Der erste passende Parser liest den Rumpf, der zweite überspringt ihn dann.
 *
 * Gezählt wird PRO ANGEMELDETEM NUTZER (Session-Cookie), sonst pro IP: Im Gemeinde-WLAN gehen alle
 * Geräte über EINE öffentliche IP raus – ohne Nutzer-Schlüssel teilte sich das ganze Team ein
 * Kontingent und lief sofort in „Too many requests". Deshalb muss `cookieParser` VOR diesem Eingang
 * laufen. Nur `/api` wird gezählt, nicht die statischen Dateien (JS/CSS/Icons) – die zählten sonst
 * jede beim App-Laden mit. Login bekommt zusätzlich ein strengeres Limit (`routes/auth.ts`).
 */

/**
 * Für alle Routen: 1 MB. Der größte gewöhnliche Rumpf ist das „Rückgängig“ eines gelöschten
 * Ablaufpunkts mit bis zu 100 Gruppen-Infos à 4000 Zeichen (`geloeschterPunktSchema`), gut 400 kB –
 * 100 kB wären dafür zu knapp.
 */
export const RUMPF_GRENZE = '1mb';

/** Die Anmerkungs-Striche einer Seite (PNG-DataURL, bis 6 Mio. Zeichen) und die Lied-Einstellungen. */
export const RUMPF_GRENZE_GROSS = '8mb';
export const GROSSE_RUEMPFE = ['/api/annotations', '/api/settings'];

/** Methoden, die etwas ändern – nur sie müssen von der eigenen Seite kommen. */
const SCHREIBEND = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * **Schreibende Anfragen nur von der eigenen Seite** (#849). `SameSite=Lax` am Sitzungs-Cookie schützt nur vor
 * fremden *Sites* – andere Seiten unter derselben Domain (`ecg-donrath.de`: WordPress, `anmeldung.`, `musik-test.`)
 * schicken das Cookie mit. Der Browser sagt in `Sec-Fetch-Site`, woher eine Anfrage kommt; ein Reverse-Proxy kann das
 * nicht verfälschen (anders als `Host`). Fehlt der Kopf (sehr alte Browser, Werkzeuge wie curl), bleibt es beim
 * bisherigen Verhalten – Angreifer brauchen den Browser der Person, und der sendet ihn.
 */
export const nurEigeneSeite: express.RequestHandler = (req, res, next) => {
  const herkunft = req.get('sec-fetch-site');
  if (SCHREIBEND.has(req.method) && herkunft !== undefined && herkunft !== 'same-origin') {
    res.status(403).json({ error: 'Diese Anfrage kommt nicht aus der App.' });
    return;
  }
  next();
};

export function apiEingang(opts: { max?: number } = {}): Router {
  const eingang = express.Router();
  // Zuerst die Herkunft: kostet nichts und weist fremde Seiten ab, bevor gezählt oder gelesen wird.
  eingang.use('/api', nurEigeneSeite);
  eingang.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: opts.max ?? 600,
      standardHeaders: true,
      legacyHeaders: false,
      // Angemeldet zählt die SITZUNG (stabiler Schlüssel, siehe `sessionRateKey` – #194): Seit der
      // Cookie-Verschlüsselung ändert sich der rohe Cookie-Wert bei jeder Anfrage, als Schlüssel wäre
      // das Limit wirkungslos. Ohne Session der Anschluss, nicht die einzelne Adresse: `ipRateKey`
      // fasst IPv6 auf das /64-Netz zusammen (#146).
      keyGenerator: (req) => sessionRateKey(req) ?? ipRateKey(req.ip),
    }),
  );
  eingang.use(GROSSE_RUEMPFE, express.json({ limit: RUMPF_GRENZE_GROSS }));
  eingang.use(express.json({ limit: RUMPF_GRENZE }));
  return eingang;
}
