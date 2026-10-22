/**
 * **Zahlung einer Anmeldung** (A7-2, Entwurf `a7-anmeldungen-v2`): bezahlt mit Zahlart und Tag, Betrag von Hand ändern.
 * Alles steht bei der ersten Person der Anmeldung (Variante A, `senden.ts`) in den Systemfeldern „Bezahlt“, „Bezahlt am“,
 * „Zahlart“, „Betrag“, „Aufschlüsselung“. Gemessen 19.10.2026: `PATCH /groups/{id}/members/{personId}` mit
 * `{fields: {<Nummer>: Wert}}` ändert nur die geschickten Felder, Ankreuzen als `true`/`false`, Datum `YYYY-MM-DD`, leeren
 * mit `null`; keine Mail.
 *
 * **Zahlarten** (Alwin, 19.10.2026: „je Gemeinde + je Veranstaltung“): Die Gemeinde legt die Liste fest, eine
 * Veranstaltung kann einzelne abwählen (`bezahlung.ohneZahlarten`) – so erscheinen neue Zahlarten der Gemeinde von
 * selbst überall.
 */
import { tagPunkt } from '../ct/datum';
import { centAusEuroText, euroText } from './preis';

/** Vorbelegt, solange die Gemeinde nichts gespeichert hat. */
export const STANDARD_ZAHLARTEN = ['Überweisung', 'Bar', 'PayPal'] as const;

/** Höchstlänge einer Zahlart (Text im Feld „Zahlart“). */
export const ZAHLART_MAX = 40;

/** Eine Liste von Zahlarten bereinigt: getrimmt, ohne leere und doppelte, nicht zu lang. */
export function zahlartenSauber(liste: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const x of liste) {
    if (typeof x !== 'string') continue;
    const t = x.trim().slice(0, ZAHLART_MAX);
    if (t && !out.some((y) => y.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out;
}

/** **Die Zahlarten einer Veranstaltung** – die der Gemeinde ohne die abgewählten. */
export function zahlartenFuer(gemeinde: readonly string[], ohne: readonly string[]): string[] {
  return gemeinde.filter((z) => !ohne.includes(z));
}

/**
 * **Die Zeile „von Hand geändert“** in der Aufschlüsselung – so sieht man in ChurchTools, woher der Betrag kommt, und
 * die Nachprüfung meldet ihn nicht mehr als abweichend (`vonHandBetrag`, die Gegenseite).
 */
export function vonHandZeile(cent: number, tag: string): string {
  return `Von Hand geändert am ${tagPunkt(tag)}: ${euroText(cent)}`;
}

const VON_HAND = /^Von Hand geändert am \d{2}\.\d{2}\.\d{4}: (.+)$/;

/** Der zuletzt von Hand gesetzte Betrag aus der Aufschlüsselung – `null`, wenn keiner. */
export function vonHandBetrag(aufschluesselung: string | null | undefined): number | null {
  const zeilen = (aufschluesselung ?? '').split('\n').map((z) => z.trim());
  for (let i = zeilen.length - 1; i >= 0; i--) {
    const m = VON_HAND.exec(zeilen[i]);
    if (m) return centAusEuroText(m[1]);
  }
  return null;
}

/** Die Aufschlüsselung nach einer Änderung von Hand: die alte Zeile „von Hand“ ersetzt, die neue ans Ende. */
export function aufschluesselungMitHand(alt: string | null, cent: number, tag: string): string {
  const zeilen = (alt ?? '').split('\n').filter((z) => z.trim() && !VON_HAND.test(z.trim()));
  return [...zeilen, vonHandZeile(cent, tag)].join('\n');
}

// ── Nachrücken und Absagen (A7-3) ───────────────────────────────────────────────────────────────

/**
 * **Erste Zeile der eigenen Zahlung einer Nachgerückten** (Alwin, 19.10.2026: „Eine neue Zahlung. Also so als ob ein
 * Kind neu angemeldet wurde“) – daran erkennen Liste und Nachprüfung, dass der Betrag dieser Person zusätzlich zur
 * Zahlung der Anmeldung gilt (`istEigeneZahlung`, die Gegenseite).
 */
export function nachrueckKopf(tag: string): string {
  return `Nachgerückt am ${tagPunkt(tag)}`;
}

/**
 * **Erste Zeile der eigenen Zahlung einer Person, die von Hand zur Anmeldung dazukommt** (A7-4b, Alwin 22.10.2026:
 * „eigene Zahlung“) – dieselbe Art Zahlung wie beim Nachrücken.
 */
export function dazuKopf(tag: string): string {
  return `Dazu angemeldet am ${tagPunkt(tag)}`;
}

/**
 * **Zeile bzw. Kopf beim Zurückholen einer Abgesagten** (A7-4c): Kopf ihrer eigenen Zahlung, wenn die Anmeldung noch
 * besteht – sonst die letzte Zeile der neu gerechneten Zahlung der Anmeldung.
 */
export function zurueckKopf(tag: string): string {
  return `Zurückgeholt am ${tagPunkt(tag)}`;
}

const EIGENE = /^(Nachgerückt|Dazu angemeldet|Zurückgeholt) am \d{2}\.\d{2}\.\d{4}$/;
const ART = {
  Nachgerückt: 'nachgerueckt',
  'Dazu angemeldet': 'dazu',
  Zurückgeholt: 'zurueck',
} as const;

/**
 * Wofür eine eigene Zahlung steht (nachgerückt, dazu angemeldet, zurückgeholt) – `null`, wenn es die Zahlung der
 * Anmeldung ist (deren erste Zeile ist ein Posten, kein Kopf).
 */
export function eigeneZahlungArt(
  aufschluesselung: string | null | undefined,
): 'nachgerueckt' | 'dazu' | 'zurueck' | null {
  const m = EIGENE.exec((aufschluesselung ?? '').split('\n')[0].trim());
  return m ? ART[m[1] as keyof typeof ART] : null;
}

/**
 * Ist das die Aufschlüsselung einer **eigenen** Zahlung (Nachgerückte, A7-3; dazu angemeldet, A7-4b)? Sie gilt
 * zusätzlich zur Zahlung der Anmeldung und macht die Person nicht zur ersten.
 */
export function istEigeneZahlung(aufschluesselung: string | null | undefined): boolean {
  return eigeneZahlungArt(aufschluesselung) !== null;
}

/** Die Zeile in der Aufschlüsselung der Anmeldung, wenn jemand abgesagt hat. */
export function absageZeile(
  name: string,
  tag: string,
  z: { neuCent: number | null; rueckzahlungCent: number },
): string {
  const teile = [`Abgesagt am ${tagPunkt(tag)}: ${name}`];
  if (z.neuCent !== null) teile.push(`Zahlung der Anmeldung jetzt ${euroText(z.neuCent)}`);
  if (z.rueckzahlungCent > 0) teile.push(`Rückzahlung ${euroText(z.rueckzahlungCent)} offen`);
  return teile.join(' – ');
}
