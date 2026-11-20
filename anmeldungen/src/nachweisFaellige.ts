/**
 * **Fällige anschreiben – das Schreiben** (N2c; Entwurf `n2-stand-v1`, Ansicht 4). Die Regeln (Empfänger, Texte, Vermerk,
 * Meldung) stehen in `shared/anmeldung/nachweisFaellige.ts`; hier passiert, was in ChurchTools geschieht, in fester Reihenfolge:
 *
 * 1. **Mails senden** (`rundmailSenden`, Gruppe = die Nachweis-Gruppe): je Person eine Mail, Absender ist die angemeldete
 *    Vertrauensperson. Scheitert das, wird nichts weiter getan. War die Antwort unklar (`UnklarObVerschickt`), ist unbekannt,
 *    ob Mails rausgingen: **kein Vermerk, kein zweiter Versuch**.
 * 2. **Vermerk** (nur mit Häkchen und nur, wenn sicher alle Mails raus sind): je Empfänger mit offener Aufgabe eine Notiz
 *    (`POST /followups/{id}/notes`, gemessen 20.11.2026: 204 ohne Inhalt) und **nachlesen** (`GET /notes/follow_up/{id}`) –
 *    ein 204 beweist nichts. Ein Fehler beim Vermerk macht die Mail nicht ungeschehen: Er steht in der Meldung, die Mails
 *    bleiben verschickt, und die übrigen Vermerke werden trotzdem geschrieben.
 *
 * „Sicher raus“: Das Protokoll von ChurchTools war nicht lesbar (`bestaetigt` `null`, für Vertrauenspersonen ohne Admin
 * üblich – die Übergabe selbst hat geklappt) oder nennt alle Adressen. Nennt es weniger, ist unklar, WER keine bekam – dann
 * gibt es keinen Vermerk, damit nicht jemand als angeschrieben gilt, der nichts bekam.
 */
import { ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { personenRoh } from '@ui/ct/personen';
import { nachweisMail } from '@shared/anmeldung/nachweise';
import {
  faelligeMailFehler,
  faelligeMeldung,
  vermerkText,
  type FaelligeBilanz,
  type FaelligerEmpfaenger,
} from '@shared/anmeldung/nachweisFaellige';
import { ichLaden, type Vertrauensperson } from './nachweisArten';
import { rundmailSenden } from './rundmail';

/** Die Meldung, wenn ChurchTools das Mailen verweigert: kein Rechtefehler der Erweiterung, sondern einer der Gruppe. */
export const FAELLIGE_VERWEIGERT =
  'ChurchTools lässt dich in dieser Gruppe keine Mails verschicken – dir fehlt dafür ein Recht. Verschickt wurde nichts. Bitte sag es der Person, die in ChurchTools die Rechte vergibt.';

export interface FaelligeEingabe {
  /** Die Nachweis-Gruppe: Von ihr aus wird gemailt. */
  gruppeId: number;
  /** Wer die Mail bekommt – nur Personen mit Adresse. */
  an: (FaelligerEmpfaenger & { email: string })[];
  betreff: string;
  text: string;
  /** Der Vermerk an der offenen Folgeaufgabe (Häkchen). */
  vermerk: boolean;
  /** Name der angemeldeten Person – steht im Vermerk. */
  absenderName: string;
  /** `YYYY-MM-DD`, „heute“ der Gemeinde. */
  heute: string;
}

export interface FaelligeErgebnis extends FaelligeBilanz {
  /** Die Meldung nach dem Schließen. */
  text: string;
}

interface NotizRoh {
  text?: unknown;
}

/** Kurz, warum der Vermerk fehlt – steht in Klammern in der Meldung (kein „noch einmal versuchen“: Die Mail ist raus). */
function vermerkGrund(f: unknown): string {
  if (f instanceof NichtUebernommen) return 'von ChurchTools nicht übernommen';
  if (f instanceof ApiError && f.status === 403) return 'dir fehlt das Recht an der Aufgabe';
  if (f instanceof ApiError && f.status === 404) return 'die Aufgabe gibt es nicht mehr';
  if (f instanceof ApiError && f.status === 401) return 'nicht mehr angemeldet';
  return 'ChurchTools antwortet nicht';
}

/** Schreibt die Notiz und liest nach, dass sie da ist – sonst wirft es. */
async function vermerkSchreiben(aufgabeId: number, text: string): Promise<void> {
  await ctAnfrage(`/followups/${aufgabeId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ comment: text }),
  });
  const notizen = await ctDaten<NotizRoh[]>(`/notes/follow_up/${aufgabeId}`);
  if (!notizen.some((n) => typeof n.text === 'string' && n.text.includes(text)))
    throw new NichtUebernommen('der Vermerk');
}

/**
 * **Fällige anschreiben.** Wirft, wenn schon das Senden scheitert (nichts verschickt) oder unklar bleibt
 * (`UnklarObVerschickt`); danach nie mehr – Vermerk-Fehler stehen im Ergebnis.
 */
export async function faelligeSenden(e: FaelligeEingabe): Promise<FaelligeErgebnis> {
  const pruef = faelligeMailFehler(e);
  if (pruef) throw new ApiError(422, pruef);
  if (e.an.length === 0) throw new ApiError(422, 'Niemand ausgewählt.');
  const mail = nachweisMail(e);

  // ── 1. Mails ──
  const { bestaetigt } = await rundmailSenden(
    e.gruppeId,
    e.an.map((x) => ({ personId: x.personId, email: x.email })),
    mail.betreff,
    mail.html,
    FAELLIGE_VERWEIGERT,
  );
  const adressen = new Set(e.an.map((x) => x.email.toLowerCase())).size;
  const bilanz: FaelligeBilanz = {
    gesendet: e.an.length,
    bestaetigt,
    adressen,
    vermerkGewollt: e.vermerk,
    vermerkt: [],
    vermerkFehlt: [],
    ohneAufgabe: [],
    vermerkUnsicher: false,
  };

  // ── 2. Vermerk ──
  if (e.vermerk) {
    if (bestaetigt !== null && bestaetigt < adressen) bilanz.vermerkUnsicher = true;
    else {
      const text = vermerkText(e.heute, e.absenderName);
      for (const x of e.an) {
        if (x.aufgabeId === null) {
          bilanz.ohneAufgabe.push(x.name);
          continue;
        }
        try {
          await vermerkSchreiben(x.aufgabeId, text);
          bilanz.vermerkt.push(x.name);
        } catch (f) {
          bilanz.vermerkFehlt.push({ name: x.name, grund: vermerkGrund(f) });
        }
      }
    }
  }
  return { ...bilanz, text: faelligeMeldung(bilanz) };
}

/**
 * **Was das Fenster beim Öffnen braucht:** die Mailadressen der fälligen Personen und wer gerade anschreibt (Name im Gruß
 * und im Vermerk). Nicht lesbar ist ein Fehler, nicht „niemand hat eine Adresse“ – sonst stünden alle grau da, obwohl
 * ChurchTools nur gerade nicht antwortet.
 */
export async function faelligeLaden(
  personIds: number[],
): Promise<{ emails: Map<number, string | null>; ich: Vertrauensperson }> {
  const [roh, ich] = await Promise.all([
    personenRoh(personIds).catch((x: unknown) => {
      if (x instanceof ApiError && x.status === 403)
        throw new ApiError(
          403,
          'Die Mailadressen sind für dich in ChurchTools nicht sichtbar – so lässt sich niemand anschreiben.',
        );
      throw x;
    }),
    ichLaden(),
  ]);
  return { emails: new Map(roh.map((p) => [p.id, p.email?.trim() || null])), ich };
}
