/**
 * **Mails über ChurchTools senden – der eine Sende-Baustein** (A7-5 im Anmelde-Tool, seit W3b-3 auch für die Website).
 * Stand bis 23.11.2026 in `anmeldungen/src/rundmail.ts`; die Website braucht dieselbe Mechanik (Mail an die Leitung beim
 * Einreichen, an den Einreichenden beim Zurückgeben/Freigeben) – sie wird nicht noch einmal nachgebaut.
 *
 * Gemessen 22.10.2026 (`messung-a7`, Abschnitt „Rundmail“):
 * - Senden: alte Schnittstelle `churchhome/ajax` → `sendEMailToPersonIds` (so sendet der Mail-Editor von ChurchTools),
 *   über `ctAltAnfrage` – dieselbe Stelle wie Lied-Kategorien und SongSelect.
 *   ChurchTools verschickt je Person eine eigene Mail, Absender „Name <noreply@churchtools.de>“, Antwort an die
 *   Absenderin.
 * - Nachweis: Ein „success“ allein beweist nichts – im Protokoll (`GET /logs`) steht je Mail „Speichere Mail an …“.
 *
 * **Die Zweige beim Senden** (vorübergehend ist nicht „nicht verschickt“):
 * - ausdrücklich abgelehnt, kein Recht (4xx) oder gebremst → **sicher nicht verschickt**, der Fehler kommt an;
 * - Zeitgrenze, Netz, 5xx, unlesbare Antwort → ChurchTools kann trotzdem gesendet haben: **nachlesen**; steht nichts im
 *   Protokoll (oder ist es nicht lesbar), `UnklarObVerschickt`. **Nichts wird automatisch wiederholt** – das gäbe doppelte Mails.
 */
import { AltFehler, ChurchToolsBremst, ctAltAnfrage, ctDaten } from './verbindung';
import { ApiError } from './fehler';

/** Die Meldung bei „unklar“, wenn der Aufrufer keine eigene mitgibt. */
const UNKLAR_STANDARD =
  'ChurchTools hat beim Senden nicht geantwortet – ob die Mails rausgingen, ist unklar. Bitte erst nachsehen, bevor du noch einmal sendest.';

/** Die Meldung, wenn ChurchTools das Senden verweigert (403) und der Aufrufer nichts Eigenes sagt. */
const VERWEIGERT_STANDARD = 'Mails über ChurchTools schicken darfst du hier nicht.';

/**
 * ChurchTools hat beim Senden nicht (rechtzeitig) geantwortet, und im Protokoll steht nichts – **ob die Mails raus sind,
 * ist offen**. Kein „noch einmal versuchen“: Das gäbe doppelte Mails.
 */
export class UnklarObVerschickt extends ApiError {
  constructor(meldung: string = UNKLAR_STANDARD) {
    super(504, meldung);
    this.name = 'UnklarObVerschickt';
  }
}

/**
 * Ein Empfänger. **Die Adresse ist freiwillig**: Wer die Adressen der Empfänger nicht sehen darf (Redakteure sehen die der
 * Leitung evtl. nicht), kann trotzdem senden – ChurchTools braucht nur die Personen-ID. Nur das Nachlesen im Protokoll
 * braucht die Adresse.
 */
export interface MailEmpfaenger {
  personId: number;
  email?: string;
}

export interface MailOptionen {
  /** Die Meldung, wenn ChurchTools das Senden verweigert (403) – die Nachweise sagen es anders als die Anmeldungen. */
  verweigert?: string;
  /** Die Meldung bei `UnklarObVerschickt` (Anmeldungen sprechen von „einer Familie“, die Website nicht). */
  unklar?: string;
}

interface LogRoh {
  date?: string;
  message?: string;
}

/**
 * **Senden** – je Person eine Mail, danach im Protokoll nachgelesen: `bestaetigt` = an so viele der Adressen steht dort
 * „Speichere Mail an …“ (seit dem Senden); `null`, wenn das Protokoll nicht lesbar ist (fehlendes Recht, vorübergehend)
 * **oder keiner der Empfänger eine Adresse hat** (dann ist nichts nachprüfbar).
 * Nach dem Senden wirft hier nichts mehr – sonst sähe es nach „nicht verschickt“ aus und das Team schickte noch einmal.
 */
export async function mailSenden(
  gruppeId: number,
  an: readonly MailEmpfaenger[],
  betreff: string,
  html: string,
  optionen: MailOptionen = {},
): Promise<{ bestaetigt: number | null }> {
  if (an.length === 0) throw new ApiError(422, 'Niemand ausgewählt.');
  const ab = Date.now() - 5_000;
  let unklar = false;
  try {
    await ctAltAnfrage(
      'sendEMailToPersonIds',
      {},
      { verweigert: optionen.verweigert ?? VERWEIGERT_STANDARD },
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
  if (unklar && !bestaetigt) throw new UnklarObVerschickt(optionen.unklar);
  return { bestaetigt };
}

/**
 * Wie viele der Adressen stehen seit `ab` im Protokoll („Speichere Mail an …“) – `null`, wenn es nicht lesbar ist **oder
 * niemand eine Adresse hat** (nichts zum Nachprüfen).
 */
async function nachlesen(an: readonly MailEmpfaenger[], ab: number): Promise<number | null> {
  const adressen = an.flatMap((x) => (x.email ? [x.email.toLowerCase()] : []));
  if (adressen.length === 0) return null;
  try {
    const log = await ctDaten<LogRoh[]>(`/logs?limit=${Math.min(500, an.length * 4 + 20)}`);
    const gespeichert = log
      .filter((l) => typeof l.message === 'string' && Date.parse(l.date ?? '') >= ab)
      .map((l) => l.message!.toLowerCase());
    return new Set(
      adressen.filter((mail) =>
        gespeichert.some((m) => m.startsWith(`speichere mail an ${mail} `)),
      ),
    ).size;
  } catch (x) {
    console.warn('Protokoll nach dem Mailversand nicht lesbar', x);
    return null;
  }
}
