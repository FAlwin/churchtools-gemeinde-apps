/**
 * **Die Mails im Freigabe-Weg senden** (Bauplan Website W3b-3, E-W20). Die Regeln (wer bekommt was, was steht drin) stehen rein
 * in `@shared/website/mail`, der Schalter und die Leitung in `@shared/website/mailWerte`; gesendet wird mit dem gemeinsamen
 * Baustein `@ui/ct/mailSenden` (derselbe wie das Anmelde-Tool). Hier steht nur das Zusammenstecken mit ChurchTools.
 *
 * **Eine Mail macht nie eine Handlung rückgängig und lässt nie eine scheitern:** Aufgerufen wird erst, **nachdem** der Status
 * geschrieben bzw. die Seite freigegeben **und nachgelesen** ist; und diese Funktionen **werfen nicht** – sie sagen im
 * Ergebnis, was geschah (`MailErgebnis`), die Oberfläche zeigt es als kurzen Hinweis. Drei Ausgänge, die der Mensch
 * unterscheiden muss:
 * - **gesendet** – ChurchTools hat die Mail angenommen (und, wo die Adresse bekannt ist, im Protokoll belegt);
 * - **nicht verschickt** – sicher nicht (abgelehnt, kein Recht, gebremst, oder schon das Vorbereiten – Schalter lesen,
 *   Leitung finden – ist gescheitert), mit dem Grund;
 * - **unklar** – ChurchTools hat nicht (rechtzeitig) geantwortet und nichts ist belegt: **nichts wird wiederholt** (doppelte Mails).
 * Ist der Schalter aus oder niemand übrig, gibt es weder Aufruf noch Hinweis (`aus`, `niemand`).
 *
 * Keine Namen, IDs oder Adressen in `console.*`.
 */
import { modulPort } from '@ui/ct/modulPort';
import { ctAlleSeiten, ctBasis } from '@ui/ct/verbindung';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { mailSenden, UnklarObVerschickt } from '@ui/ct/mailSenden';
import { erweiterungsLink } from '@ui/erweiterung/kuerzel';
import { ctId } from '@shared/ct/ctId';
import { werteLesen, type Wert } from '@shared/ct/modulDaten';
import { gruppenRollenAus, rollenLesen } from '@shared/ct/rollenRechte';
import type { Schreiber } from '@shared/ct/sperre';
import { mitgliederAus, type RohMitglied } from '@shared/organigramm/mitglieder';
import {
  freigabeMails,
  leitungEmpfaenger,
  leitungsRollen,
  leitungsTypen,
  mailText,
  zurueckEmpfaenger,
  type FreigegebeneSeite,
  type GruppenMitglied,
  type MailAnlass,
  type MailInhalt,
  type MailPerson,
} from '@shared/website/mail';
import { leitungAusWerten, mailAnAusWerten } from '@shared/website/mailWerte';

/** Wohin die Mails gehören: das Modul, die Kategorie „Entwürfe“ (dort liegen Schalter und Leitung) und die Website-Gruppe. */
export interface MailOrt {
  modul: number;
  entwuerfe: number;
  /**
   * Die Website-Gruppe (Obergruppe). Untergruppen kommen in W3b-4c dazu (E-W29). Bis dahin liest ein Redakteur, der nur in einer
   * Untergruppe ist, hier eine leere Mitgliederliste (unsichtbar, Messung W3b-4-0) → „niemand“, keine Mail (`mail.ts`).
   */
  gruppe: number;
}

export type MailErgebnis =
  /** Der Schalter ist aus – nichts getan, nichts zu sagen. */
  | { art: 'aus' }
  /** Niemand zu benachrichtigen (nur der Handelnde selbst, oder keine Leitung gefunden) – nichts zu sagen. */
  | { art: 'niemand' }
  | { art: 'gesendet' }
  | { art: 'nichtVerschickt'; grund: string }
  | { art: 'unklar' };

const VERWEIGERT = 'Mails über ChurchTools schicken darfst du hier nicht.';
const UNKLAR =
  'ChurchTools hat beim Senden nicht geantwortet – ob die Mail rausging, ist unklar. Bitte erst nachsehen, bevor du noch einmal sendest.';

/** Der Link in die Erweiterung (die Startseite – der Reiter „Freigaben“ hat keine eigene Adresse). */
const link = (): string => erweiterungsLink(ctBasis(), modulPort.kuerzel() ?? 'website');

/** Was `GET /groups/{id}/members` je Eintrag liefert – dazu die Adresse, falls ChurchTools sie dem Leser zeigt. */
type MitgliedRoh = RohMitglied & { person?: { email?: unknown } | null };

/**
 * **Die aktiven Mitglieder der Website-Gruppe mit ihrer Rolle** – gelesen mit der Liste aller Seiten, ausgewertet wie im
 * Organigramm (`mitgliederAus`: nur aktive, nicht beendete; Rolle = `groupTypeRoleId`). Die Adresse (`person.email`) nur, wenn
 * ChurchTools sie liefert – **gemessen 23.11.2026: auch für den Admin nicht** (`person` ist nur das Kurzprofil); ohne sie kann
 * das Nachlesen im Protokoll nicht prüfen (`mailSenden` gibt dann `null`, die Website meldet „gesendet“, sobald ChurchTools
 * den Auftrag angenommen hat). Die Mitglieder samt Rollen der eigenen
 * Gruppe sind für Redakteure lesbar (gemessen W3b-0).
 */
async function gruppenMitglieder(gruppe: number): Promise<GruppenMitglied[]> {
  const roh = await ctAlleSeiten<MitgliedRoh>(`/groups/${gruppe}/members`);
  const adresse = new Map<number, string>();
  for (const r of roh) {
    const id = ctId(r.personId);
    const mail = r.person?.email;
    if (id !== null && typeof mail === 'string' && mail.trim() !== '') adresse.set(id, mail.trim());
  }
  return mitgliederAus(roh).mitglieder.map((m) => ({
    personId: m.personId,
    rolleId: m.rolleId,
    ...(adresse.has(m.personId) ? { email: adresse.get(m.personId) } : {}),
  }));
}

/** **Die Leitung der Website-Gruppe** als Empfänger – ohne den Handelnden (Rollen aus dem Wert, sonst die Vorbelegung). */
async function leitungLaden(
  o: MailOrt,
  werte: readonly Wert[],
  ichId: number,
): Promise<MailPerson[]> {
  const [rollenRoh, mitglieder] = await Promise.all([
    rollenLesen(modulPort, o.gruppe),
    gruppenMitglieder(o.gruppe),
  ]);
  const rollen = leitungsRollen(leitungAusWerten(werte), gruppenRollenAus(rollenRoh));
  return leitungEmpfaenger(mitglieder, leitungsTypen(rollen, rollenRoh), ichId);
}

interface GeplanteMail {
  an: MailPerson[];
  inhalt: MailInhalt;
}

/**
 * Der gemeinsame Lauf: Schalter lesen (aus → nichts), die Mails planen (Empfänger finden), nacheinander senden, Ausgänge
 * zusammenfassen – **unklar vor nicht verschickt vor gesendet**. Wirft nie.
 */
async function lauf(
  o: MailOrt,
  planen: (werte: readonly Wert[]) => Promise<GeplanteMail[]>,
): Promise<MailErgebnis> {
  let geplant: GeplanteMail[];
  try {
    const werte = await werteLesen(modulPort, o.modul, o.entwuerfe);
    if (!mailAnAusWerten(werte)) return { art: 'aus' };
    geplant = await planen(werte);
  } catch (e) {
    return { art: 'nichtVerschickt', grund: fehlerMeldung(e).text };
  }
  geplant = geplant.filter((m) => m.an.length > 0);
  if (geplant.length === 0) return { art: 'niemand' };

  const ausgaenge: MailErgebnis[] = [];
  for (const m of geplant) {
    try {
      await mailSenden(o.gruppe, m.an, m.inhalt.betreff, m.inhalt.html, {
        verweigert: VERWEIGERT,
        unklar: UNKLAR,
      });
      ausgaenge.push({ art: 'gesendet' });
    } catch (e) {
      ausgaenge.push(
        e instanceof UnklarObVerschickt
          ? { art: 'unklar' }
          : { art: 'nichtVerschickt', grund: fehlerMeldung(e).text },
      );
    }
  }
  return (
    ausgaenge.find((a) => a.art === 'unklar') ??
    ausgaenge.find((a) => a.art === 'nichtVerschickt') ?? { art: 'gesendet' }
  );
}

/** **Einreichen / Löschen anfragen → Mail an die Leitung.** */
export function mailAnLeitung(
  o: MailOrt,
  anlass: { art: 'eingereicht' | 'loeschenAngefragt'; seite: string },
  ich: Schreiber,
): Promise<MailErgebnis> {
  const text: MailAnlass = { ...anlass, wer: ich.name };
  return lauf(o, async (werte) => [
    { an: await leitungLaden(o, werte, ich.person), inhalt: mailText(text, link()) },
  ]);
}

/** **Zurückgeben → Mail an den Einreichenden** (`einreicher`: seine Person-ID, `null` = unbekannt). */
export function mailZurueck(
  o: MailOrt,
  angaben: { seite: string; anmerkung: string; einreicher: number | null },
  ich: Schreiber,
): Promise<MailErgebnis> {
  const an = zurueckEmpfaenger(angaben.einreicher, ich.person);
  return lauf(o, () =>
    Promise.resolve(
      an === null
        ? []
        : [
            {
              an: [{ personId: an }],
              inhalt: mailText(
                {
                  art: 'zurueck',
                  wer: ich.name,
                  seite: angaben.seite,
                  anmerkung: angaben.anmerkung,
                },
                link(),
              ),
            },
          ],
    ),
  );
}

/**
 * **Freigeben → Mail an die Einreichenden: eine Mail je Person** mit allen ihren freigegebenen Seiten (auch bei „Alles
 * freigeben“). `seiten` = nur die **eingereichten** Seiten, die jetzt online sind.
 */
export function mailFreigaben(
  o: MailOrt,
  seiten: readonly FreigegebeneSeite[],
  ich: Schreiber,
): Promise<MailErgebnis> {
  return lauf(o, () =>
    Promise.resolve(
      freigabeMails(seiten, ich.person).map((m) => ({
        an: [{ personId: m.personId }],
        inhalt: mailText({ art: 'freigegeben', wer: ich.name, seiten: m.seiten }, link()),
      })),
    ),
  );
}
