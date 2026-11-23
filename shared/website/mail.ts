/**
 * **Die Mails im Freigabe-Weg – Wer bekommt was, und was steht drin** (Bauplan Website W3b-3, E-W20, Alwins Entscheidung
 * 23.11.2026). Nur Regeln und Texte, **rein** und ohne ChurchTools – gesendet wird in `website/src/mailVersand.ts` mit dem
 * gemeinsamen Baustein `@ui/ct/mailSenden`.
 *
 * | Anlass                      | Empfänger                                  |
 * |-----------------------------|--------------------------------------------|
 * | Zur Prüfung einreichen      | die **Leitung** der Website-Gruppe         |
 * | Löschen anfragen            | die **Leitung**                            |
 * | Mit Anmerkung zurückgeben   | die Person, die **eingereicht** hatte      |
 * | Freigeben (eingereichte Seite) | die Person, die **eingereicht** hatte – bei „Alles freigeben“ **eine Mail je Person** mit allen ihren Seiten |
 *
 * **Nie an sich selbst:** Wer handelt, bekommt keine Mail (eine Leitung, die selbst eingereicht hat und selbst freigibt, ebenso
 * wenig). Bleibt niemand übrig, gibt es keine Mail und keinen Fehler.
 *
 * **Wer ist „Leitung“?** Der Wert `website-leitung` (`mailWerte.ts`, vom Admin beim Festlegen der Stufen geschrieben); fehlt er
 * (bestehende Installationen), gilt dieselbe Vorbelegung wie in „Wer darf was“ (`vorschlag` in `rechte.ts` – nicht nachgebaut).
 * Empfänger sind die aktiven Mitglieder der Website-Gruppe mit einer dieser Rollen. **W3b-4 (Untergruppen):** Dann gehört zur
 * Seite ein Bereich, und die Leitung dieses Bereichs ist zusätzlich gemeint – an dieser Stelle (`leitungEmpfaenger`) kommt sie dazu.
 *
 * **Mailtext „kurz mit Link“:** wer, welche Seite, beim Zurückgeben die Anmerkung, ein Link in die Erweiterung. Alles, was ein
 * Mensch getippt hat (Seitentitel, Namen, Anmerkung), geht durch `htmlText` (`html.ts`) – ein Titel wie `<script>` bleibt Text.
 * Der Betreff ist reiner Text (kein HTML) und einzeilig.
 */
import type { GruppenRolle } from '../ct/rollenRechte';
import { htmlAttr, htmlText } from './html';
import { vorschlag } from './rechte';

/** Ein Empfänger – die Adresse ist freiwillig (Redakteure sehen die der Leitung evtl. nicht). */
export interface MailPerson {
  personId: number;
  email?: string;
}

/** Ein aktives Mitglied der Website-Gruppe, wie es aus ChurchTools kommt. */
export interface GruppenMitglied extends MailPerson {
  /** Rolle in der Gruppe (`group_role`) – `null`, wenn nur über eine Untergruppe dabei. */
  rolleId: number | null;
}

/**
 * **Die Rollen der Leitung:** der gespeicherte Wert, sonst die Vorbelegung aus den Rollen der Gruppe (Rollen mit
 * Leiter-Kennzeichen). `gespeichert = null` heißt „kein (gültiger) Wert“; ein leerer Wert (`[]`) ist eine echte Aussage des
 * Admins („niemand“) und wird nicht durch die Vorbelegung ersetzt.
 */
export function leitungsRollen(
  gespeichert: readonly number[] | null,
  rollen: readonly GruppenRolle[],
): number[] {
  if (gespeichert) return [...gespeichert];
  return vorschlag(rollen)
    .filter((r) => r.stufe === 'leitung')
    .map((r) => r.rolle);
}

/** Je Person einmal – die erste Fundstelle gilt (dort steht ggf. die Adresse). */
function einzeln<T extends MailPerson>(liste: readonly T[]): T[] {
  const gesehen = new Set<number>();
  return liste.filter((p) => !gesehen.has(p.personId) && gesehen.add(p.personId));
}

/** Als Empfänger – ohne die Rolle, und nur mit Adresse, wenn eine bekannt ist. */
function alsEmpfaenger(p: MailPerson): MailPerson {
  return p.email ? { personId: p.personId, email: p.email } : { personId: p.personId };
}

/**
 * **Die Leitung als Empfänger** (Einreichen, Löschen anfragen): die Mitglieder mit einer Leitungs-Rolle, je Person einmal,
 * **ohne den Handelnden** (`ichId`).
 */
export function leitungEmpfaenger(
  mitglieder: readonly GruppenMitglied[],
  rollenDerLeitung: readonly number[],
  ichId: number,
): MailPerson[] {
  const leitung = new Set(rollenDerLeitung);
  return einzeln(
    mitglieder.filter((m) => m.rolleId !== null && leitung.has(m.rolleId) && m.personId !== ichId),
  ).map(alsEmpfaenger);
}

/** Eine freigegebene Seite und wer sie eingereicht hatte (`null`: unbekannt). */
export interface FreigegebeneSeite {
  titel: string;
  einreicher: number | null;
}

/** Eine Mail an eine Person mit allen ihren freigegebenen Seiten. */
export interface FreigabeMail {
  personId: number;
  seiten: string[];
}

/**
 * **Bei „Alles freigeben“: eine Mail je Person** – nicht eine je Seite. Wer mehrere Seiten eingereicht hatte, bekommt eine Mail
 * mit allen. Seiten ohne bekannten Einreichenden und Seiten, die der Handelnde selbst eingereicht hatte, entfallen. Die
 * Reihenfolge ist die der Seiten (wer zuerst vorkommt, steht zuerst).
 */
export function freigabeMails(seiten: readonly FreigegebeneSeite[], ichId: number): FreigabeMail[] {
  const je = new Map<number, string[]>();
  for (const s of seiten) {
    if (s.einreicher === null || s.einreicher === ichId) continue;
    je.set(s.einreicher, [...(je.get(s.einreicher) ?? []), s.titel]);
  }
  return [...je].map(([personId, titel]) => ({ personId, seiten: titel }));
}

/** Der Einreichende, der bei „Zurückgeben“ die Mail bekommt – `null`, wenn er unbekannt oder der Handelnde selbst ist. */
export function zurueckEmpfaenger(einreicher: number | null, ichId: number): number | null {
  return einreicher !== null && einreicher !== ichId ? einreicher : null;
}

// ── Die Texte ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Was geschehen ist – der Anlass für Betreff und Text. `wer` ist der Name des Handelnden. */
export type MailAnlass =
  | { art: 'eingereicht'; wer: string; seite: string }
  | { art: 'loeschenAngefragt'; wer: string; seite: string }
  | { art: 'zurueck'; wer: string; seite: string; anmerkung: string }
  | { art: 'freigegeben'; wer: string; seiten: readonly string[] };

export interface MailInhalt {
  betreff: string;
  /** Der Text als HTML – alles Getippte ist geschützt. */
  html: string;
}

/** Ein Betreff ist ein Text, kein HTML – und eine Zeile. */
const einzeilig = (t: string): string => t.replace(/\s+/g, ' ').trim();

const wer = (name: string): string => htmlText(einzeilig(name) || 'Jemand');
const titel = (t: string): string => `„${htmlText(einzeilig(t))}“`;
const kopfTitel = (t: string): string => `„${einzeilig(t)}“`;

/** Die Anmerkung, wie sie getippt wurde: geschützt, Zeilenumbrüche bleiben Zeilenumbrüche. */
const anmerkungHtml = (a: string): string => htmlText(a.trim()).replace(/\r?\n/g, '<br>');

/**
 * **Betreff und Text** – kurz, mit Link (`link` = die Erweiterung; **die App hat keine Adresse für den Reiter „Freigaben“**,
 * der Reiter ist ein Zustand der Seite – der Text sagt darum, wo man ihn findet).
 */
export function mailText(anlass: MailAnlass, link: string): MailInhalt {
  const zumLink = (satz: string): string =>
    `<p>${satz}</p><p><a href="${htmlAttr(link)}">Website in ChurchTools öffnen</a></p>`;
  switch (anlass.art) {
    case 'eingereicht':
      return {
        betreff: `Website: ${kopfTitel(anlass.seite)} wartet auf Freigabe`,
        html: zumLink(
          `${wer(anlass.wer)} hat die Seite ${titel(anlass.seite)} zur Prüfung eingereicht. Du findest sie im Reiter „Freigaben“.`,
        ),
      };
    case 'loeschenAngefragt':
      return {
        betreff: `Website: ${kopfTitel(anlass.seite)} – Löschen angefragt`,
        html: zumLink(
          `${wer(anlass.wer)} bittet darum, die Seite ${titel(anlass.seite)} zu löschen. Entscheiden kannst du im Reiter „Freigaben“.`,
        ),
      };
    case 'zurueck':
      return {
        betreff: `Website: ${kopfTitel(anlass.seite)} zurückgegeben`,
        html: `<p>${wer(anlass.wer)} hat die Seite ${titel(anlass.seite)} zurückgegeben.</p><p><strong>Anmerkung:</strong><br>${anmerkungHtml(anlass.anmerkung)}</p><p><a href="${htmlAttr(link)}">Website in ChurchTools öffnen</a></p>`,
      };
    case 'freigegeben': {
      const eine = anlass.seiten.length === 1;
      return {
        betreff: eine
          ? `Website: ${kopfTitel(anlass.seiten[0])} ist freigegeben`
          : `Website: ${anlass.seiten.length} Seiten sind freigegeben`,
        html: eine
          ? zumLink(
              `${wer(anlass.wer)} hat die Seite ${titel(anlass.seiten[0])} freigegeben. Sie ist jetzt online.`,
            )
          : `<p>${wer(anlass.wer)} hat diese Seiten freigegeben. Sie sind jetzt online:</p><ul>${anlass.seiten
              .map((s) => `<li>${titel(s)}</li>`)
              .join('')}</ul><p><a href="${htmlAttr(link)}">Website in ChurchTools öffnen</a></p>`,
      };
    }
  }
}
