/**
 * **Bezahlung einer Veranstaltung** (A4, Alwin 13.10.2026: „Bezahlung mit rein“): wohin überwiesen wird, bis
 * wann und mit welchem Verwendungszweck. Das steht später in der Bestätigungsmail (A9) und auf „Deine
 * Anmeldung“ (A6).
 *
 * Die Angaben liegen in den öffentlichen Einstellungen (Gruppen-Beschreibung), sind also **ohne Login
 * lesbar** – richtig so, die öffentliche Seite braucht sie. Darum gehört hier nur ein Konto hin, das ohnehin
 * öffentlich ist (das Gemeindekonto), und die Erweiterung sagt das beim Eintragen.
 *
 * Bewusst je Veranstaltung und nicht einmal für die ganze Gemeinde: Ein gemeinsamer Speicher wäre der
 * Erweiterungs-Speicher von ChurchTools – der ist ohne Login nicht lesbar (A0) und nicht gemessen. „Wie eine
 * frühere Veranstaltung“ übernimmt das Konto mit.
 */

export interface Bezahlung {
  kontoinhaber: string;
  /** Ohne Leerzeichen, in Großbuchstaben (`ibanNormal`). Leer = noch keine Bankverbindung. */
  iban: string;
  /** Freiwillig – für Überweisungen im Euroraum nicht nötig. */
  bic: string;
  /** Zahlungsfrist in Tagen nach der Anmeldung; 0 = keine Frist. */
  fristTage: number;
  /** Mit Platzhalter `[Nachname]`, der beim Versand ersetzt wird. */
  zweck: string;
  /**
   * Zahlarten der Gemeinde, die es bei dieser Veranstaltung nicht gibt (A7-2, `zahlung.ts`). Fehlt, wenn keine abgewählt
   * ist – so bleiben die Einstellungen kurz (die Sicherung passt in EIN Feld, `gestaltung.test.ts`).
   */
  ohneZahlarten?: string[];
}

/** Der Platzhalter im Verwendungszweck. */
export const NACHNAME = '[Nachname]';

/** Höchstlänge des Verwendungszwecks bei einer SEPA-Überweisung. */
export const ZWECK_MAX = 140;

/** Die Startwerte – auch für Veranstaltungen, die vor A4 angelegt wurden. */
export const STANDARD_BEZAHLUNG: Bezahlung = {
  kontoinhaber: '',
  iban: '',
  bic: '',
  fristTage: 14,
  zweck: NACHNAME,
};

/** IBAN ohne Leerzeichen, in Großbuchstaben – so wird sie gespeichert. */
export function ibanNormal(text: string): string {
  return text.replace(/\s+/g, '').toUpperCase();
}

/**
 * **Stimmt die IBAN?** Aufbau (Land, Prüfziffer, Kontoteil) und die Prüfziffer nach ISO 13616 (Rest 1 bei
 * Division durch 97). Fängt die üblichen Tippfehler – ein Zahlendreher in der IBAN hieße Geld auf einem
 * fremden Konto.
 */
export function ibanGueltig(text: string): boolean {
  const iban = ibanNormal(text);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  // Deutsche IBAN: immer 22 Zeichen.
  if (iban.startsWith('DE') && iban.length !== 22) return false;
  const umgestellt = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const z of umgestellt) {
    const wert = z >= 'A' ? String(z.charCodeAt(0) - 55) : z;
    for (const ziffer of wert) rest = (rest * 10 + Number(ziffer)) % 97;
  }
  return rest === 1;
}

/** IBAN zum Lesen: in Vierergruppen. */
export function ibanText(text: string): string {
  return ibanNormal(text).replace(/(.{4})(?=.)/g, '$1 ');
}

/** Der Verwendungszweck einer Anmeldung: `[Nachname]` ersetzt. */
export function verwendungszweck(zweck: string, nachname: string): string {
  return zweck.split(NACHNAME).join(nachname.trim()).trim();
}

/**
 * **Der Verwendungszweck folgt dem Namen** (Durchklicken 13.10.2026: Die Kopie „Freizeit 2027“ hätte mit
 * „Freizeit 2026 Müller“ überweisen lassen). Steht der alte Name im Zweck, wird er durch den neuen ersetzt;
 * einen selbst geschriebenen Zweck ohne den Namen lässt es stehen. Beim Kopieren und Umbenennen.
 */
export function zweckMitNeuemNamen(zweck: string, altName: string, neuName: string): string {
  const alt = altName.trim();
  if (!alt || alt === neuName.trim() || !zweck.includes(alt)) return zweck;
  return zweck.split(alt).join(neuName.trim()).slice(0, ZWECK_MAX);
}

/** **Was an der Bezahlung nicht stimmt** – leer, wenn alles passt. Eine fehlende IBAN ist erlaubt (kostenlos). */
export function pruefeBezahlung(b: Bezahlung): string[] {
  const fehler: string[] = [];
  if (b.iban && !ibanGueltig(b.iban))
    fehler.push('Die IBAN stimmt nicht. Bitte Ziffer für Ziffer prüfen.');
  if (b.iban && !b.kontoinhaber.trim()) fehler.push('Bitte den Kontoinhaber eintragen.');
  if (!b.iban && b.kontoinhaber.trim()) fehler.push('Bitte auch die IBAN eintragen.');
  if (b.bic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(b.bic))
    fehler.push('Die BIC hat 8 oder 11 Zeichen (oder bleibt leer).');
  if (!Number.isInteger(b.fristTage) || b.fristTage < 0 || b.fristTage > 365)
    fehler.push('Die Zahlungsfrist liegt zwischen 0 und 365 Tagen.');
  if (b.zweck.length > ZWECK_MAX)
    fehler.push(`Der Verwendungszweck hat höchstens ${ZWECK_MAX} Zeichen.`);
  return fehler;
}
