/**
 * **Rundmail über ChurchTools** (A7-5) – gemessen 22.10.2026 (`messung-a7`, Abschnitt „Rundmail“):
 * - Senden: **seit W3b-3 im gemeinsamen Baustein `@ui/ct/mailSenden`** (`sendEMailToPersonIds`, Nachlesen im Protokoll,
 *   `UnklarObVerschickt`) – hier nur noch `rundmailSenden`, das ihn mit den Worten der Anmeldungen aufruft.
 * - Platzhalter: `GET /placeholders/group/{id}` (alle Felder der Gruppe), Vorschau: `POST /emails/preview`.
 */
import { ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { mailSenden, UnklarObVerschickt, type MailEmpfaenger } from '@ui/ct/mailSenden';

// Die Klasse steht im gemeinsamen Baustein (`@ui/ct/mailSenden`); die Fenster der Anmeldungen kennen sie weiter von hier.
export { UnklarObVerschickt };

const PLATZHALTER = /^\{\{\{?[^{}]+\}?\}\}$/;

/** Bezeichnung → Platzhalter aus der verschachtelten Liste von ChurchTools (Menü für den Editor). */
export function platzhalterAus(roh: unknown): Map<string, string> {
  const m = new Map<string, string>();
  const gehe = (x: unknown) => {
    if (Array.isArray(x)) return x.forEach(gehe);
    if (!x || typeof x !== 'object') return;
    const o = x as Record<string, unknown>;
    const token = Object.values(o).find((v) => typeof v === 'string' && PLATZHALTER.test(v.trim()));
    const name = [o.label, o.name, o.title].find((v) => typeof v === 'string' && v.trim());
    if (typeof token === 'string' && typeof name === 'string' && !m.has(name.trim()))
      m.set(name.trim(), token.trim());
    Object.values(o).forEach((v) => {
      if (v && typeof v === 'object') gehe(v);
    });
  };
  gehe(roh);
  return m;
}

/** **Die Platzhalter der Gruppe** – Feldname → Platzhalter, z. B. „Betrag“ → `{{{groupMemberField.betrag}}}`. */
export async function platzhalterLaden(gruppeId: number): Promise<Map<string, string>> {
  return platzhalterAus(await ctDaten<unknown>(`/placeholders/group/${gruppeId}`));
}

/** **Vorschau** für eine Person – so, wie ChurchTools die Mail bei ihr füllt. */
export async function vorschauLaden(
  gruppeId: number,
  personId: number,
  betreff: string,
  html: string,
): Promise<{ betreff: string; html: string }> {
  // Gemessen 22.10.2026: die Antwort steht direkt da (`{subject, html}`), nicht in `data` – beides annehmen.
  type Vorschau = { html?: string; subject?: string };
  const r = await ctAnfrage<(Vorschau & { data?: Vorschau }) | null>('/emails/preview', {
    method: 'POST',
    body: JSON.stringify({ content: [html], subject: betreff, personId, groupId: gruppeId }),
  });
  const d = r?.data ?? r;
  if (typeof d?.html !== 'string')
    throw new ApiError(502, 'ChurchTools hat keine Vorschau geliefert.');
  return { html: d.html, betreff: d.subject ?? betreff };
}

/** Die Meldung bei „unklar“ – die Anmeldungen schreiben an Familien, darum fragt man dort bei einer Familie nach. */
const UNKLAR_ANMELDUNGEN =
  'ChurchTools hat beim Senden nicht geantwortet – ob die Mails rausgingen, ist unklar. Bitte erst nachsehen (z. B. bei einer Familie nachfragen), bevor du noch einmal sendest.';

/**
 * **Senden** – je Person eine Mail (der Ablauf steht in `mailSenden`), mit den Worten der Anmeldungen. `verweigert` ist die
 * Meldung, wenn ChurchTools das Senden verweigert (403) – die Nachweise sagen es anders als die Anmeldungen.
 */
export function rundmailSenden(
  gruppeId: number,
  an: readonly MailEmpfaenger[],
  betreff: string,
  html: string,
  verweigert?: string,
): Promise<{ bestaetigt: number | null }> {
  return mailSenden(gruppeId, an, betreff, html, { verweigert, unklar: UNKLAR_ANMELDUNGEN });
}
