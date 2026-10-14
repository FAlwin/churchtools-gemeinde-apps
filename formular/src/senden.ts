import { apiBasis, type AnmeldeOrt } from '@shared/anmeldung/oeffentlich';
import type { Antworten, OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import {
  PasstNicht,
  anmeldungAufbauen,
  type CtFormular,
  type PreisWahl,
} from '@shared/anmeldung/senden';
import { WARTEN_MS } from './laden';

/**
 * **Eine Anmeldung abschicken** (A6-2, #548) – ohne Login, drei Schritte wie gemessen (14.10.2026): Token holen,
 * Formular-Aufbau mit den Feldnummern lesen, anmelden. Die Antwort enthält keine Personen; ob jemand schon bekannt
 * ist, sagt `verificationNotice` – dann bestätigt die Person per Mail, bis dahin ändert sich nichts.
 */

export type Gesendet = { art: 'angemeldet' } | { art: 'bestaetigen'; mail: string };

/** Was beim Abschicken schiefgehen kann – je Fall ein Satz für die Person, die sich anmeldet. */
export class SendeProblem extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SendeProblem';
  }
}

const VORUEBERGEHEND =
  'ChurchTools antwortet gerade nicht. Deine Angaben sind noch da – bitte gleich noch einmal versuchen.';

async function anfrage(url: string, init: RequestInit = {}): Promise<unknown> {
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), WARTEN_MS);
  let r: Response;
  try {
    r = await fetch(url, {
      ...init,
      credentials: 'omit',
      signal: abbruch.signal,
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    });
  } catch {
    throw new SendeProblem(
      abbruch.signal.aborted
        ? VORUEBERGEHEND
        : 'Keine Verbindung. Deine Angaben sind noch da – bitte die Internetverbindung prüfen und noch einmal versuchen.',
    );
  } finally {
    clearTimeout(uhr);
  }
  if (r.status === 429 || r.status >= 500) throw new SendeProblem(VORUEBERGEHEND);
  if (r.status === 401 || r.status === 403)
    throw new SendeProblem(
      'Zu dieser Veranstaltung kann man sich gerade nicht anmelden – vielleicht ist sie voll oder schon geschlossen. Bei Fragen hilft die Gemeinde weiter.',
    );
  if (!r.ok) {
    const text = await r
      .json()
      .then(
        (j: { translatedMessage?: string; message?: string }) => j.translatedMessage ?? j.message,
      )
      .catch(() => null);
    throw new SendeProblem(
      `ChurchTools hat die Anmeldung nicht angenommen${text ? `: „${text}“` : ''}. Bitte die Angaben prüfen.`,
    );
  }
  return r.status === 204 ? null : r.json();
}

export async function abschicken(
  ort: AnmeldeOrt,
  e: OeffentlicheEinstellungen,
  antworten: Antworten,
  wahl: PreisWahl,
  heute: string,
): Promise<Gesendet> {
  const basis = `${apiBasis(ort)}/publicgroups/${ort.gruppeId}`;
  const t = (await anfrage(`${basis}/token`, { method: 'POST', body: '{}' })) as {
    data?: { token?: string };
  } | null;
  const token = t?.data?.token;
  if (!token) throw new SendeProblem(VORUEBERGEHEND);
  const f = (await anfrage(`${basis}/form?token=${encodeURIComponent(token)}`)) as {
    data?: CtFormular;
  } | null;
  if (!f?.data?.form) throw new SendeProblem(VORUEBERGEHEND);
  let anmeldung;
  try {
    anmeldung = anmeldungAufbauen(e, antworten, wahl, heute, f.data);
  } catch (fehler) {
    if (fehler instanceof PasstNicht)
      throw new SendeProblem(
        'Diese Anmeldung ist gerade nicht richtig eingerichtet. Bitte der Gemeinde Bescheid geben – abgeschickt wurde nichts.',
      );
    throw fehler;
  }
  const antwort = (await anfrage(`${basis}/signup`, {
    method: 'POST',
    body: JSON.stringify({ token, ...anmeldung }),
  })) as { verificationNotice?: boolean; verificationEmail?: string | null } | null;
  if (antwort?.verificationNotice)
    return { art: 'bestaetigen', mail: antwort.verificationEmail ?? '' };
  return { art: 'angemeldet' };
}
