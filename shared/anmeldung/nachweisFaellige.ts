/**
 * **Fällige anschreiben** (N2c; Entwurf `n2-stand-v1`, Ansicht 4, abgenommen 20.11.2026) – die Regeln an EINER Stelle:
 * wer angeschrieben wird, was in der Mail steht, was im Vermerk steht und was die Meldung danach sagt. Das Schreiben
 * (Mail senden, Notiz an die Aufgabe) steht in `anmeldungen/src/nachweisFaellige.ts`, das Fenster in `FaelligeFenster.tsx`.
 *
 * - **Empfänger:** alle mit Stand „läuft ab“ (0–56 Tage) und „abgelaufen“ – abgelaufen zuerst, dann nach Name. Wer keine
 *   Mailadresse hat, steht dabei, bekommt aber keine Mail.
 * - **Mail:** Betreff und Text sind vorgegeben und änderbar; nur `[Vorname]` ist ein Platzhalter (wie die Aufforderung der
 *   Art, `nachweisMail`). Das Ablaufdatum steht nicht im Text: Eine Rundmail ist für alle gleich.
 * - **Vermerk:** eine Notiz an der offenen Folgeaufgabe, damit die anderen Vertrauenspersonen sehen, wer schon eine Mail hat.
 */
import { tagPunkt } from '../ct/datum';
import { NACHWEIS_BETREFF_MAX, NACHWEIS_TEXT_MAX, nachweisMail } from './nachweise';
import type { NachweisStand } from './nachweisStand';

/** Eine Person der Art, soweit die Regeln sie brauchen (`PersonMitStand` passt). */
export interface FaelligePerson {
  personId: number;
  name: string;
  stand: NachweisStand;
  /** „Antrag unvollständig: …“ oder `null`. */
  luecke: string | null;
  /** Ihre offene Folgeaufgabe – dort steht später der Vermerk. */
  aufgabe: { id: number } | null;
}

/** Ein Eintrag der Liste „An“ im Fenster. */
export interface FaelligerEmpfaenger {
  personId: number;
  name: string;
  /** `null`: ChurchTools kennt keine Adresse – die Zeile ist grau und nicht wählbar. */
  email: string | null;
  /** „läuft ab am 28.12.2026“ / „abgelaufen seit 02.10.2026“. */
  wann: string;
  abgelaufen: boolean;
  luecke: string | null;
  /** Nummer der offenen Folgeaufgabe, `null`: keine – dann gibt es nichts zu vermerken. */
  aufgabeId: number | null;
}

/** Braucht diese Person eine Mail? Nur „läuft ab“ und „abgelaufen“ – nicht gültig, angefordert, fehlt, Rücksprache. */
export const istFaellig = (s: NachweisStand): s is NachweisStand & { bis: string } =>
  s.art === 'laeuftAb' || s.art === 'abgelaufen';

/** Wie viele Personen die Art zum Anschreiben hat (für den Knopf im Kartenkopf) – ohne Blick auf Mailadressen. */
export const faelligeZahl = (personen: readonly Pick<FaelligePerson, 'stand'>[]): number =>
  personen.filter((p) => istFaellig(p.stand)).length;

/**
 * **Wer angeschrieben werden kann** – abgelaufen zuerst, dann nach Name. `emails`: Personennummer → Adresse (leer oder
 * fehlend = keine). Die Reihenfolge ist fest, damit sie nicht von der Tabelle der Seite abhängt.
 */
export function faelligeEmpfaenger(
  personen: readonly FaelligePerson[],
  emails: ReadonlyMap<number, string | null | undefined>,
): FaelligerEmpfaenger[] {
  return personen
    .flatMap((p) => {
      const s = p.stand;
      if (!istFaellig(s)) return [];
      const mail = emails.get(p.personId)?.trim() || null;
      const abgelaufen = s.art === 'abgelaufen';
      return [
        {
          personId: p.personId,
          name: p.name,
          email: mail,
          wann: `${abgelaufen ? 'abgelaufen seit' : 'läuft ab am'} ${tagPunkt(s.bis)}`,
          abgelaufen,
          luecke: p.luecke,
          aufgabeId: p.aufgabe?.id ?? null,
        },
      ];
    })
    .sort(
      (a, b) => Number(b.abgelaufen) - Number(a.abgelaufen) || a.name.localeCompare(b.name, 'de'),
    );
}

/**
 * **Die Vorgabe für Betreff und Text** (Entwurf Ansicht 4). Der Name der Art steht statt „Führungszeugnis“ darin; den Weg
 * zum Antrag („Meine Gruppen“ → „Nachweis: …“ → Bescheinigungen) nennt der Text nur bei Arten mit Antrag. Gruß mit dem
 * Vornamen der angemeldeten Person (Antworten gehen an sie).
 */
export function faelligeVorgabe(
  art: { name: string; mitAntrag: boolean },
  absenderVorname: string,
): { betreff: string; text: string } {
  const name = art.name.trim();
  const weg = art.mitAntrag
    ? `Den Antrag mit deinen Daten findest du in ChurchTools unter „Meine Gruppen“ → „Nachweis: ${name}“ → Bescheinigungen. Für Ehrenamtliche ist er kostenlos. Wenn du den neuen Nachweis hast, zeig ihn bitte einer Vertrauensperson.`
    : 'Wenn du den neuen Nachweis hast, zeig ihn bitte einer Vertrauensperson.';
  return {
    betreff: `Dein Nachweis „${name}“ läuft ab`.slice(0, NACHWEIS_BETREFF_MAX),
    text: [
      'Hallo [Vorname],',
      '',
      `dein Nachweis „${name}“ für die Mitarbeit läuft bald ab oder ist schon abgelaufen. Bitte besorge einen neuen.`,
      '',
      weg,
      '',
      'Viele Grüße',
      absenderVorname.trim(),
    ]
      .join('\n')
      .trim(),
  };
}

/** Was an Betreff und Text nicht passt (wie bei der Aufforderung der Art) – `null`, wenn die Mail so raus darf. */
export function faelligeMailFehler(m: { betreff: string; text: string }): string | null {
  if (!m.betreff.trim()) return 'Bitte einen Betreff eintragen.';
  if (m.betreff.length > NACHWEIS_BETREFF_MAX)
    return `Der Betreff ist zu lang (höchstens ${NACHWEIS_BETREFF_MAX} Zeichen).`;
  if (!m.text.trim()) return 'Bitte einen Text eintragen.';
  if (m.text.length > NACHWEIS_TEXT_MAX)
    return `Der Text ist zu lang (höchstens ${NACHWEIS_TEXT_MAX} Zeichen).`;
  const { unbekannt } = nachweisMail(m);
  if (unbekannt.length)
    return `Im Text steht ${unbekannt.map((u) => `[${u}]`).join(', ')} – nur [Vorname] kennt die Mail. Eckige Klammern sonst bitte weglassen.`;
  return null;
}

/** Die Notiz an der Folgeaufgabe: „Angeschrieben am 20.11.2026 von Otto Messnull“. */
export const vermerkText = (heute: string, absenderName: string): string =>
  `Angeschrieben am ${tagPunkt(heute)} von ${absenderName.trim()}`;

/** „2 Mails“ / „1 Mail“. */
const mails = (n: number) => `${n} ${n === 1 ? 'Mail' : 'Mails'}`;

/** Wie der Vermerk ausging – das Schreiben meldet es, die Meldung macht daraus Text. */
export interface FaelligeBilanz {
  /** So viele Mails wurden übergeben. */
  gesendet: number;
  /** Wie viele verschiedene Adressen im Protokoll von ChurchTools stehen; `null`: Protokoll nicht lesbar. */
  bestaetigt: number | null;
  /** Wie viele verschiedene Adressen es waren. */
  adressen: number;
  /** Der Vermerk war gewünscht (Häkchen). */
  vermerkGewollt: boolean;
  /** Wer einen Vermerk bekommen hat (nachgelesen). */
  vermerkt: string[];
  /** Wer keinen bekommen hat, obwohl er sollte – mit dem Grund. */
  vermerkFehlt: { name: string; grund: string }[];
  /** Wer keine offene Aufgabe hat. */
  ohneAufgabe: string[];
  /** Es wurde kein Vermerk versucht, weil nicht sicher ist, dass alle Mails raus sind. */
  vermerkUnsicher: boolean;
}

/**
 * **Der Satz nach dem Senden** („2 Mails verschickt, Vermerk an beiden Aufgaben.“) – ehrlich in jedem Zweig: Was nicht
 * nachgelesen werden konnte, steht als nicht nachgelesen da, und ein fehlender Vermerk macht die Mail nicht ungeschehen.
 */
export function faelligeMeldung(b: FaelligeBilanz): string {
  const teile: string[] = [];
  const kopf = `${mails(b.gesendet)} verschickt`;
  if (b.bestaetigt === null)
    teile.push(`${kopf}, die Bestätigung von ChurchTools war nicht lesbar`);
  else if (b.bestaetigt < b.adressen)
    teile.push(
      `${kopf}, aber im Protokoll von ChurchTools stehen nur ${b.bestaetigt} von ${b.adressen} Adressen – bitte dort nachsehen`,
    );
  else teile.push(kopf);

  if (b.vermerkGewollt) {
    if (b.vermerkUnsicher)
      teile.push('Vermerk nicht geschrieben, weil nicht sicher ist, wer die Mail bekam');
    else {
      const n = b.vermerkt.length;
      if (n > 0)
        teile.push(
          n === 1
            ? 'Vermerk an der Aufgabe'
            : n === 2
              ? 'Vermerk an beiden Aufgaben'
              : `Vermerk an ${n} Aufgaben`,
        );
      if (b.vermerkFehlt.length > 0)
        teile.push(
          `Vermerk bei ${b.vermerkFehlt.map((f) => `${f.name} (${f.grund})`).join(', ')} fehlt`,
        );
      if (b.ohneAufgabe.length > 0)
        teile.push(`keine offene Aufgabe bei ${b.ohneAufgabe.join(', ')}, dort kein Vermerk`);
    }
  }
  return `${teile.join(', ')}.`;
}
