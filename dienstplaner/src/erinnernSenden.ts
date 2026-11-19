/**
 * **„Erinnern“ verschicken** (Bauplan E5c-5): je Person **ein** Aufruf `POST /events/send`, nacheinander. Gemessen
 * 18./19.11.2026 (`docs/messung-e5c.md`): `eventIds` (Pflicht, mind. 1) = ihre offenen Termine, `recipients` = [Person],
 * `subject`, `body` (HTML), `sendCopyToMe`. ChurchTools antwortet 200 mit `sentRecipientIds` (versendet wird im Hintergrund)
 * und `rejectedRecipientIds`; 422 = niemand mit Mail-Adresse.
 *
 * **Die Zweige einzeln – hier kann eine Mail doppelt rausgehen oder verloren sein, nichts wird wiederholt:**
 * - **Erfolg erst, wenn die Person in `sentRecipientIds` steht.** Ein 200 ohne sie ist kein Beleg: steht sie in
 *   `rejectedRecipientIds` (z. B. ohne Mail-Adresse), ist sie **nicht erinnert** und es geht weiter; steht sie in keiner Liste,
 *   hat ChurchTools nichts bestätigt – **unklar, anhalten** (ein Aussetzer in der Form der Antwort träfe sonst jede Person).
 * - **422** = diese Person hat keine Mail-Adresse → nicht erinnert, **weiter mit der nächsten**.
 * - **Vorübergehend** (Netz, Zeitüberschreitung, 429/Bremse, 5xx, 408): die Mail **könnte trotzdem rausgegangen sein** →
 *   Person „unklar“, **anhalten**, **nichts automatisch wiederholen**. „An die übrigen“ wählt sie standardmäßig nicht vor.
 * - **401** (abgemeldet) → anhalten. **403** / fehlendes Recht (`KeinSpeicherRecht`) → anhalten, dauerhaft.
 * - **Anderes 4xx** (ChurchTools hat die Mail ausdrücklich nicht genommen) → anhalten, die Person ist **nicht** versendet.
 * Keine Namen oder IDs in `console.*` – hier steht gar keine Ausgabe.
 */
import { ctId } from '@shared/ct/ctId';
import { ApiError } from '@ui/ct/fehler';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import type { Empfaenger } from '@shared/dienstplan/erinnern';

/** Was `POST /events/send` bekommt. */
export interface MailAuftrag {
  eventIds: number[];
  recipients: number[];
  subject: string;
  /** HTML. */
  body: string;
  sendCopyToMe: boolean;
  /**
   * **Pflichtfelder von ChurchTools** (Probe 19.11.2026, Test-Instanz: ohne sie **400** „validation.error“ –
   * `appendAgendaButton` „muss TRUE oder FALSE sein“, `files` „muss ein Array sein“). Kein Ablauf-Knopf, keine Anhänge.
   */
  appendAgendaButton: false;
  files: [];
}

/** Schickt einen Auftrag und liefert den Rumpf der Antwort (`ctAnfrage`); wirft `ApiError` oder einen Netzfehler. */
export type MailSender = (auftrag: MailAuftrag) => Promise<unknown>;

/** Was mit einer Person geschah. */
export type MailErgebnis =
  /** `sentRecipientIds` nennt sie. */
  | { art: 'verschickt' }
  /** Nicht erinnert, weil ChurchTools keine Mail für sie hat (422 oder `rejectedRecipientIds`) – es ging weiter. */
  | { art: 'ohneMail' }
  /** Vorübergehender Fehler: **unklar, ob die Mail rausging** – nicht wiederholt. */
  | { art: 'unklar' }
  /** ChurchTools hat die Mail ausdrücklich nicht genommen (anderes 4xx, 401, 403) – sicher nicht verschickt. */
  | { art: 'abgelehnt' };

export type AnhaltGrund = 'abgemeldet' | 'keinRecht' | 'unklar' | 'abgelehnt';

/** Der Stand nach einem Lauf. */
export interface MailLauf {
  /** Je Person das Ergebnis – wer nicht drin steht, wurde nicht mehr versucht (nach einem Anhalten). */
  ergebnisse: Map<number, MailErgebnis>;
  /** Gestoppt? Warum, und bei wem (die Person, bei der es hakte – sie hat ein Ergebnis `unklar` oder `abgelehnt`). */
  angehalten: { grund: AnhaltGrund; text: string; bei: number } | null;
  /**
   * Ist die Kopie an den Absender schon angefordert (ein Aufruf mit `sendCopyToMe` ist durchgegangen oder unklar)? Dann
   * fordert der nächste Lauf („An die übrigen“) keine zweite an.
   */
  kopieAngefordert: boolean;
}

/** Die Zahlen aus `sentRecipientIds` / `rejectedRecipientIds` – tolerant für `{data: {…}}` und `{…}`. */
export function listenAus(rumpf: unknown): { gesendet: Set<number>; abgelehnt: Set<number> } {
  const wurzel = (rumpf && typeof rumpf === 'object' ? rumpf : {}) as {
    data?: unknown;
    sentRecipientIds?: unknown;
    rejectedRecipientIds?: unknown;
  };
  const k = (
    wurzel.data && typeof wurzel.data === 'object' ? wurzel.data : wurzel
  ) as typeof wurzel;
  const ids = (x: unknown) => new Set(Array.isArray(x) ? x.flatMap((i) => ctId(i) ?? []) : []);
  return { gesendet: ids(k.sentRecipientIds), abgelehnt: ids(k.rejectedRecipientIds) };
}

/** Ein Fehler von `ctAnfrage` → was das für diese Person und den Lauf heißt (Zweige oben). */
export function ausgangAus(
  e: unknown,
): { art: 'ohneMail' } | { art: 'anhalten'; ergebnis: 'unklar' | 'abgelehnt'; grund: AnhaltGrund } {
  if (e instanceof ApiError) {
    if (e.status === 401) return { art: 'anhalten', ergebnis: 'abgelehnt', grund: 'abgemeldet' };
    // 403 – auch „fehlendes Recht“ (`KeinSpeicherRecht`, ChurchTools meldet es oft als 401) trägt den Status 403.
    if (e.status === 403) return { art: 'anhalten', ergebnis: 'abgelehnt', grund: 'keinRecht' };
    if (e.status === 422) return { art: 'ohneMail' };
    // 408, 429 (Bremse kommt als 503), 5xx: ChurchTools kann es angenommen haben.
    if (e.status === 408 || e.status === 429 || e.status >= 500)
      return { art: 'anhalten', ergebnis: 'unklar', grund: 'unklar' };
    return { art: 'anhalten', ergebnis: 'abgelehnt', grund: 'abgelehnt' };
  }
  // Kein ApiError: Netz weg, Antwort nicht gekommen – ob ChurchTools die Anfrage noch bekam, weiß man nicht.
  return { art: 'anhalten', ergebnis: 'unklar', grund: 'unklar' };
}

/** Der Satz zum Anhalten – an `bei` (Name) gebunden, damit er sagt, wo es hakte. */
export function anhaltText(grund: AnhaltGrund, name: string, e: unknown): string {
  switch (grund) {
    case 'abgemeldet':
      return fehlerMeldung(e).text;
    case 'keinRecht':
      return 'ChurchTools erlaubt dir nicht, Mails zu Terminen zu schicken.';
    case 'unklar':
      return `ChurchTools hat nicht geantwortet. Bei ${name} ist unklar, ob die Mail rausging – bitte nicht einfach noch einmal senden.`;
    case 'abgelehnt':
      return `ChurchTools hat die Mail an ${name} nicht genommen. Angehalten, nichts doppelt.`;
  }
}

/**
 * **Verschickt an die Empfänger, einen nach dem anderen.** `inhalt` baut Betreff und HTML je Person (dieselbe Funktion wie
 * die Vorschau). `kopie`: dem ersten Aufruf, der etwas verschicken kann, hängt `sendCopyToMe` an – **nur einmal** (ein
 * Aufruf, der ohnehin nichts verschickt – 422, „abgelehnt“ – verbraucht sie nicht). `melde` sagt nach jeder Person, wie es
 * ging (Fortschritt im Fenster).
 */
export async function erinnernSenden(o: {
  empfaenger: readonly Empfaenger[];
  inhalt: (e: Empfaenger) => { subject: string; body: string };
  kopie: boolean;
  senden: MailSender;
  melde?: (personId: number, ergebnis: MailErgebnis) => void;
}): Promise<MailLauf> {
  const lauf: MailLauf = { ergebnisse: new Map(), angehalten: null, kopieAngefordert: !o.kopie };
  const festhalten = (id: number, e: MailErgebnis) => {
    lauf.ergebnisse.set(id, e);
    o.melde?.(id, e);
  };
  for (const e of o.empfaenger) {
    const { subject, body } = o.inhalt(e);
    try {
      const rumpf = await o.senden({
        eventIds: e.termine.map((t) => t.terminId),
        recipients: [e.personId],
        subject,
        body,
        sendCopyToMe: !lauf.kopieAngefordert,
        appendAgendaButton: false,
        files: [],
      });
      const { gesendet, abgelehnt } = listenAus(rumpf);
      if (gesendet.has(e.personId)) {
        lauf.kopieAngefordert = true;
        festhalten(e.personId, { art: 'verschickt' });
      } else if (abgelehnt.has(e.personId)) {
        festhalten(e.personId, { art: 'ohneMail' });
      } else {
        // 200, aber keine Bestätigung für diese Person: kein Beleg – unklar, anhalten.
        lauf.kopieAngefordert = true;
        festhalten(e.personId, { art: 'unklar' });
        lauf.angehalten = {
          grund: 'unklar',
          text: `ChurchTools hat die Mail an ${e.name} nicht bestätigt. Bei ${e.name} ist unklar, ob sie rausging – bitte nicht einfach noch einmal senden.`,
          bei: e.personId,
        };
        return lauf;
      }
    } catch (fehler) {
      const aus = ausgangAus(fehler);
      if (aus.art === 'ohneMail') {
        festhalten(e.personId, { art: 'ohneMail' });
        continue;
      }
      if (aus.ergebnis === 'unklar') lauf.kopieAngefordert = true;
      festhalten(e.personId, { art: aus.ergebnis });
      lauf.angehalten = {
        grund: aus.grund,
        text: anhaltText(aus.grund, e.name, fehler),
        bei: e.personId,
      };
      return lauf;
    }
  }
  return lauf;
}
