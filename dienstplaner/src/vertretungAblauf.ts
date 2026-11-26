/**
 * **Der Ablauf von „Absagen und fragen“** (Bauplan E5c-6, Entwurf `e5c-6-vertretung.html` v1). Die Reihenfolge ist Absicht,
 * jeder Schritt ist geprüft, bevor der nächste kommt – ein Erfolgssignal allein zählt nicht:
 *
 * 1. **Markierung speichern** („Vertretung gesucht“ im eigenen Wert der Ablage „Antworten <Dienstgruppe>“, nachgelesen).
 *    Scheitert das, **geschieht nichts weiter** – nichts ist abgesagt, niemand gefragt.
 * 2. **Absagen** mit Kommentar („Vertretung gesucht – gefragt: Ben, Finn“), am zugesagten Platz, frisch gelesen und nachgelesen
 *    (`absagenNachZusage`). Scheitert das, ist **nichts abgesagt** – eine Markierung ohne freien Platz ist unsichtbar
 *    (`gesuchtGilt`: sie zählt nur, solange ein Platz des Dienstes frei ist).
 * 3. **Mails**: je gefragter Person eine eigene, danach – nur wenn jemand gefragt wurde – eine Kopie je Leitungsperson. Mit
 *    den Bausteinen von „Erinnern“ (`erinnernSenden`: je Person ein Aufruf, Erfolg erst mit `sentRecipientIds`, bei einem
 *    vorübergehenden Fehler anhalten, **nichts wird automatisch wiederholt**).
 *
 * Reihenfolge, warum so: Würde zuerst abgesagt und dann die Markierung gespeichert, könnte der Platz frei sein, ohne dass das
 * Team es erfährt. Würden zuerst die Mails verschickt, könnte jemand zusagen wollen, bevor der Platz frei ist.
 *
 * **Teil-Fehlschläge ehrlich:** Sind die Mails nicht (alle) raus, ist trotzdem abgesagt – das Ergebnis (`MailBericht`) sagt,
 * an wen nicht, und `mailsErneut` schickt genau diese noch einmal, **nur auf Knopfdruck**. Wer „unklar“ ist (die Mail kann
 * trotzdem angekommen sein), steht mit diesem Hinweis da, nicht stillschweigend in der Wiederholung.
 */
import type { AntwortErgebnis } from '@shared/dienstplan/antworten';
import type { OffenerTermin } from '@shared/dienstplan/erinnern';
import {
  absageKommentar,
  leitungMail,
  vertretungBetreff,
  vertretungMail,
  type MailTermin,
  type Vorschlag,
} from '@shared/dienstplan/vertretung';
import type { Vertretung, Zusage } from '@shared/dienstplan/verfuegbarkeit';
import type { Person } from '@shared/organigramm/mitglieder';
import { antwortFehlerText } from './antwortTexte';
import { erinnernSenden, type MailErgebnis, type MailSender } from './erinnernSenden';

/** Was die Person im Fenster gewählt hat. */
export interface VertretungsAuftrag {
  termin: MailTermin & { id: number };
  /** `index`: der abgesagte Platz (`null` bei einem Dienst mit nur einem Platz) – die Suche gilt genau für ihn. */
  dienst: { id: number; name: string; index: number | null };
  /** Wer sucht (Name für Mail und Markierung). */
  ich: { id: number; name: string };
  /** Die Angehakten, in der Reihenfolge der Liste. Leer = niemand wird gefragt, nur abgesagt. */
  gefragt: readonly Vorschlag[];
  /** Die Leitung der Teams am Dienst (ohne die Gefragten und ohne mich) – bekommt eine Kopie. */
  leitung: readonly Person[];
  nachricht: string;
}

/** Wie die Schritte ausgeführt werden – im Browser ChurchTools, im Test ein Nachbau. */
export interface Ablaufschritte {
  /** Schreibt die Markierung und liest sie nach. */
  markieren: (v: Vertretung) => Promise<{ ok: true } | { ok: false; text: string }>;
  /** Sagt den zugesagten Platz ab (`absagenNachZusage`). */
  absagen: (kommentar: string) => Promise<AntwortErgebnis>;
  senden: MailSender;
  /** Die volle Adresse des Knopfs in der Mail. */
  link: () => string;
  /** Jetzt als ISO-Zeitpunkt (für `seit`). */
  jetzt: () => string;
}

export type MailRolle = 'gefragt' | 'leitung';

/** Wer eine Mail bekommen soll – mit dem, was die Mail über die Person sagt. */
export interface MailZiel {
  personId: number;
  name: string;
  rolle: MailRolle;
  /** Ihre Antwort aus „Verfügbarkeit“ zu diesem Termin (nur Gefragte) – steht als Satz in der Mail. */
  antwort: Zusage | null;
}

/** Der Stand der Mails – über mehrere Läufe (erster Versand, „Erneut senden“). */
export interface MailBericht {
  ziele: MailZiel[];
  /** Je Person das letzte Ergebnis; wer fehlt, wurde nicht mehr versucht (nach einem Anhalten). */
  ergebnisse: Map<number, MailErgebnis>;
  /** Warum der letzte Lauf angehalten hat – `null`, wenn er durchlief. */
  angehalten: string | null;
}

export type AblaufErgebnis =
  /** Markierung oder Absage sind gescheitert – **nichts** wurde verschickt; `text` sagt, was Sache ist. */
  | { art: 'nichtAbgesagt'; text: string }
  /** Abgesagt. Die Mails stehen im Bericht (vielleicht nicht alle verschickt). */
  | { art: 'abgesagt'; mails: MailBericht };

/** Was nach dem Absagen in dieser Gruppe nicht geklappt hat, in Worten – mit der Gewissheit, was schon passiert ist. */
function absageFehler(grund: Exclude<AntwortErgebnis, { ok: true }>['grund']): string {
  switch (grund) {
    case 'konflikt':
      return 'Dein Dienst hat sich inzwischen geändert – vielleicht hat die Leitung ihn schon anders besetzt. Es wurde nichts abgesagt und niemand gefragt.';
    case 'voruebergehend':
      return 'ChurchTools antwortet gerade nicht. Es ist nicht bestätigt, ob dein Dienst abgesagt ist – bitte unter „Dienste“ nachsehen, bevor du es noch einmal versuchst. Gefragt wurde niemand.';
    case 'nicht-angekommen':
      return 'ChurchTools hat die Absage nicht übernommen. Es wurde niemand gefragt – bitte noch einmal versuchen.';
    default:
      return `${antwortFehlerText(grund)} Es wurde niemand gefragt.`;
  }
}

/** Ein Termin als Zeile der Mail-Liste von „Erinnern“ – `erinnernSenden` braucht ihn je Empfänger (`eventIds`). */
const alsOffen = (t: VertretungsAuftrag['termin']): OffenerTermin => ({
  terminId: t.id,
  tag: t.tag,
  name: t.name,
  uhrzeit: t.uhrzeit,
});

/** Die Ziele eines Auftrags: erst die Gefragten, dann die Leitung (nie jemand doppelt). Ohne Gefragte keine Leitungs-Kopie. */
export function mailZiele(a: VertretungsAuftrag): MailZiel[] {
  if (a.gefragt.length === 0) return [];
  const gefragt = new Set(a.gefragt.map((g) => g.personId));
  return [
    ...a.gefragt.map(
      (g): MailZiel => ({ personId: g.personId, name: g.name, rolle: 'gefragt', antwort: g.a }),
    ),
    ...a.leitung
      .filter((l) => !gefragt.has(l.id) && l.id !== a.ich.id)
      .map((l): MailZiel => ({ personId: l.id, name: l.name, rolle: 'leitung', antwort: null })),
  ];
}

/**
 * Verschickt an die übergebenen Ziele (`erinnernSenden`: nacheinander, Erfolg erst mit `sentRecipientIds`, bei Fehler
 * anhalten, nichts wiederholt). Ergänzt den Bericht um die Ergebnisse dieses Laufs.
 */
export async function mailsSenden(
  a: VertretungsAuftrag,
  an: readonly MailZiel[],
  s: Pick<Ablaufschritte, 'senden' | 'link'>,
  bisher: MailBericht,
): Promise<MailBericht> {
  const ziel = new Map(bisher.ziele.map((z) => [z.personId, z]));
  const link = s.link();
  const andere = (id: number) => a.gefragt.filter((g) => g.personId !== id).map((g) => g.name);
  const lauf = await erinnernSenden({
    empfaenger: an.map((z) => ({
      personId: z.personId,
      name: z.name,
      gruppen: [],
      termine: [alsOffen(a.termin)],
    })),
    kopie: false,
    senden: s.senden,
    inhalt: (e) => {
      const z = ziel.get(e.personId)!;
      return z.rolle === 'gefragt'
        ? {
            subject: vertretungBetreff(a.dienst.name, a.termin.tag),
            body: vertretungMail({
              empfaenger: e.name,
              von: a.ich.name,
              dienst: a.dienst.name,
              termin: a.termin,
              antwort: z.antwort,
              nachricht: a.nachricht,
              andere: andere(e.personId),
              link,
            }),
          }
        : {
            subject: `Kopie: ${vertretungBetreff(a.dienst.name, a.termin.tag)}`,
            body: leitungMail({
              empfaenger: e.name,
              von: a.ich.name,
              dienst: a.dienst.name,
              termin: a.termin,
              gefragt: a.gefragt.map((g) => g.name),
              nachricht: a.nachricht,
              link,
            }),
          };
    },
  });
  return {
    ziele: bisher.ziele,
    ergebnisse: new Map([...bisher.ergebnisse, ...lauf.ergebnisse]),
    angehalten: lauf.angehalten?.text ?? null,
  };
}

/** Wer noch eine Mail braucht: nicht verschickt und nicht „ohne Mail-Adresse“ (das ändert Wiederholen nicht). */
export function offeneMails(b: MailBericht): MailZiel[] {
  return b.ziele.filter((z) => {
    const e = b.ergebnisse.get(z.personId)?.art;
    return e !== 'verschickt' && e !== 'ohneMail';
  });
}

/** Wer keine Mail bekommen kann, weil ChurchTools keine Adresse hat. */
export const ohneMailAdresse = (b: MailBericht): MailZiel[] =>
  b.ziele.filter((z) => b.ergebnisse.get(z.personId)?.art === 'ohneMail');

/** Bei wem ist unklar, ob die Mail rausging (vorübergehender Fehler)? Ein erneutes Senden könnte doppelt senden. */
export const unklareMails = (b: MailBericht): MailZiel[] =>
  b.ziele.filter((z) => b.ergebnisse.get(z.personId)?.art === 'unklar');

/** Hat jede Mail, die es geben soll, ihr Ziel erreicht (oder konnte nicht, mangels Adresse)? */
export const mailsFertig = (b: MailBericht): boolean => offeneMails(b).length === 0;

/**
 * **„Absagen und fragen“** – die drei Schritte oben. Wirft nie: Jeder Fehlschlag steht im Ergebnis.
 */
export async function vertretungSuchen(
  a: VertretungsAuftrag,
  s: Ablaufschritte,
): Promise<AblaufErgebnis> {
  const gefragtNamen = a.gefragt.map((g) => g.name);
  // 1. Markierung – erst wenn sie nachgelesen dasteht, geht es weiter.
  const m = await s.markieren({
    dienst: a.dienst.id,
    gefragt: a.gefragt.map((g) => g.personId),
    seit: s.jetzt(),
    tag: a.termin.tag,
    index: a.dienst.index,
    name: a.ich.name,
    gefragtNamen,
  });
  if (!m.ok) return { art: 'nichtAbgesagt', text: m.text };

  // 2. Absagen – erst wenn ich nachgelesen nicht mehr am Platz stehe, geht es weiter.
  const r = await s.absagen(absageKommentar(gefragtNamen));
  if (!r.ok) return { art: 'nichtAbgesagt', text: absageFehler(r.grund) };

  // 3. Mails – ab hier ist abgesagt; was nicht rausgeht, steht im Bericht.
  const bericht: MailBericht = { ziele: mailZiele(a), ergebnisse: new Map(), angehalten: null };
  return { art: 'abgesagt', mails: await mailsSenden(a, bericht.ziele, s, bericht) };
}

/** „Erneut senden“ – genau an die, die noch keine Mail haben (`offeneMails`); nichts davon läuft von allein. */
export function mailsErneut(
  a: VertretungsAuftrag,
  bisher: MailBericht,
  s: Pick<Ablaufschritte, 'senden' | 'link'>,
): Promise<MailBericht> {
  return mailsSenden(a, offeneMails(bisher), s, bisher);
}
