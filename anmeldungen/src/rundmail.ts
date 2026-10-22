/**
 * **Rundmail über ChurchTools** (A7-5) – gemessen 22.10.2026 (`messung-a7`, Abschnitt „Rundmail“):
 * - Senden: alte Schnittstelle `churchhome/ajax` → `sendEMailToPersonIds` (so sendet der Mail-Editor von ChurchTools),
 *   über `ctAltAnfrage` – dieselbe Stelle wie Lied-Kategorien und SongSelect.
 *   ChurchTools verschickt je Person eine eigene Mail, Absender „Name <noreply@churchtools.de>“, Antwort an die
 *   Absenderin.
 * - Platzhalter: `GET /placeholders/group/{id}` (alle Felder der Gruppe), Vorschau: `POST /emails/preview`.
 * - Nachweis: Ein „success“ allein beweist nichts – im Protokoll (`GET /logs`) steht je Mail „Speichere Mail an …“.
 */
import { AltFehler, ChurchToolsBremst, ctAltAnfrage, ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';

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

/**
 * ChurchTools hat beim Senden nicht (rechtzeitig) geantwortet, und im Protokoll steht nichts – **ob die Mails raus sind,
 * ist offen**. Kein „noch einmal versuchen“: Das gäbe doppelte Mails.
 */
export class UnklarObVerschickt extends ApiError {
  constructor() {
    super(
      504,
      'ChurchTools hat beim Senden nicht geantwortet – ob die Mails rausgingen, ist unklar. Bitte erst nachsehen (z. B. bei einer Familie nachfragen), bevor du noch einmal sendest.',
    );
    this.name = 'UnklarObVerschickt';
  }
}

interface LogRoh {
  date?: string;
  message?: string;
}

/**
 * **Senden** – je Person eine Mail, danach im Protokoll nachgelesen: `bestaetigt` = an so viele der Adressen steht dort
 * „Speichere Mail an …“ (seit dem Senden); `null`, wenn das Protokoll nicht lesbar ist (fehlendes Recht, vorübergehend).
 * Nach dem Senden wirft hier nichts mehr – sonst sähe es nach „nicht verschickt“ aus und das Team schickte noch einmal.
 */
export async function rundmailSenden(
  gruppeId: number,
  an: { personId: number; email: string }[],
  betreff: string,
  html: string,
): Promise<{ bestaetigt: number | null }> {
  if (an.length === 0) throw new ApiError(422, 'Niemand ausgewählt.');
  const ab = Date.now() - 5_000;
  let unklar = false;
  try {
    await ctAltAnfrage(
      'sendEMailToPersonIds',
      {},
      { verweigert: 'Mails über ChurchTools schicken darfst du hier nicht.' },
      {
        modul: 'churchhome',
        json: {
          ids: an.map((x) => x.personId).join(','),
          betreff,
          inhalt: html,
          attachments: '',
          domain_id: null,
          group_id: gruppeId,
          template_id: null,
        },
      },
    );
  } catch (x) {
    // Sicher nicht verschickt: ChurchTools hat ausdrücklich abgelehnt, das Recht fehlt (4xx) oder es wurde gebremst
    // (gar nicht erst geschickt). Sonst – Zeitgrenze, Netz, 5xx, unlesbare Antwort – kann ChurchTools trotzdem gesendet
    // haben: nachlesen statt raten.
    if (x instanceof AltFehler && x.art === 'abgelehnt')
      throw new ApiError(422, `ChurchTools hat die Mails nicht angenommen: ${x.message}`);
    if (x instanceof ChurchToolsBremst || (x instanceof ApiError && x.status < 500)) throw x;
    unklar = true;
  }
  const bestaetigt = await nachlesen(an, ab);
  if (unklar && !bestaetigt) throw new UnklarObVerschickt();
  return { bestaetigt };
}

/** Wie viele der Adressen stehen seit `ab` im Protokoll („Speichere Mail an …“) – `null`, wenn es nicht lesbar ist. */
async function nachlesen(an: { email: string }[], ab: number): Promise<number | null> {
  try {
    const log = await ctDaten<LogRoh[]>(`/logs?limit=${Math.min(500, an.length * 4 + 20)}`);
    const gespeichert = log
      .filter((l) => typeof l.message === 'string' && Date.parse(l.date ?? '') >= ab)
      .map((l) => l.message!.toLowerCase());
    return new Set(
      an
        .map((x) => x.email.toLowerCase())
        .filter((mail) => gespeichert.some((m) => m.startsWith(`speichere mail an ${mail} `))),
    ).size;
  } catch (x) {
    console.warn('Protokoll nach der Rundmail nicht lesbar', x);
    return null;
  }
}
