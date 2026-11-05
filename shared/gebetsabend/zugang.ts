/**
 * **Die Zugangsdaten einer Übertragung** (Bauplan Gebetsabend G1): StreamID und Passwort für VDO.Ninja, dazu
 * „Bild + Ton“ oder „Nur Ton“ und seit wann gesendet wird. Sie liegen als ein Wert in der Kategorie „Zugang“ der
 * Erweiterung – lesen dürfen sie alle, die zuhören dürfen, schreiben nur die Technik.
 *
 * Gemessen (Messung S0, 05.11.2026), nicht angenommen:
 *  - VDO.Ninja nimmt in der StreamID **nur Buchstaben und Ziffern**; alles andere ersetzt es mit einem Hinweisfenster
 *    durch `_`. Deshalb erzeugen wir nur aus diesem Vorrat.
 *  - **Jeder Start setzt neue Daten** – ein weitergegebener Link gilt höchstens einen Abend.
 */
import type { Dokumentart } from '../ct/versionierterWert';

/** Ohne Zeichen, die man verwechselt (i/l/1, o/0) – falls jemand doch einmal etwas abtippt. */
export const ZEICHEN = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Länge der StreamID nach dem Präfix und des Passworts (31^12 bzw. 31^16 Möglichkeiten). */
export const ID_LAENGE = 12;
export const PASSWORT_LAENGE = 16;

/** Präfix der StreamID – ohne Gemeindenamen, die Erweiterung läuft auch bei anderen Gemeinden. */
export const ID_PRAEFIX = 'gebet';

/** Was VDO.Ninja als StreamID unverändert annimmt (S0: nur Buchstaben und Ziffern). */
export function istGueltigeId(id: string): boolean {
  return /^[a-z0-9]+$/i.test(id);
}

/**
 * `laenge` Zeichen aus `ZEICHEN`, **ohne Schieflage**: Bytes ab dem größten Vielfachen der Vorratsgröße werden
 * verworfen statt per Rest gefaltet (sonst kämen die ersten Zeichen häufiger vor).
 */
export function zufallsText(laenge: number, zufall: (n: number) => Uint8Array): string {
  const grenze = 256 - (256 % ZEICHEN.length);
  let text = '';
  while (text.length < laenge) {
    for (const b of zufall(laenge * 2)) {
      if (b >= grenze) continue;
      text += ZEICHEN[b % ZEICHEN.length];
      if (text.length === laenge) break;
    }
  }
  return text;
}

/** Zufall aus dem Browser bzw. aus Node – beide haben `crypto.getRandomValues`. */
export const sichererZufall = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));

export interface Zugang {
  streamId: string;
  passwort: string;
  /** „Bild + Ton“ (true) oder „Nur Ton“ (false). */
  mitBild: boolean;
  /** Seit wann gesendet wird (ISO), `null` = keine Übertragung. */
  laeuftSeit: string | null;
}

/** Neue Zugangsdaten für einen Start – StreamID und Passwort sind nie die alten. */
export function neuerZugang(
  mitBild: boolean,
  jetzt: string,
  zufall: (n: number) => Uint8Array = sichererZufall,
): Zugang {
  return {
    streamId: ID_PRAEFIX + zufallsText(ID_LAENGE, zufall),
    passwort: zufallsText(PASSWORT_LAENGE, zufall),
    mitBild,
    laeuftSeit: jetzt,
  };
}

/**
 * Woran der Zugang im Speicher erkannt wird – seit G3 ein **Dokument mit Versionsnummer** (`@shared/ct/versionierterWert`,
 * `ablage.ts`): Starten zwei Technik-Geräte zugleich, geht keiner still verloren. Fassung 1 (bis G2, nie live) war ein
 * einfacher Wert ohne Version und gilt als „kein Zugang“.
 */
export const ZUGANG_DOKUMENT: Dokumentart = { art: 'gebetsabend-zugang', fassung: 2 };

/**
 * Der Zugang aus dem gespeicherten Inhalt – `null`, wenn er nicht von uns ist oder nicht passt (dann gilt: keine
 * Übertragung, die Technik startet neu). Eine StreamID mit Sonderzeichen gilt als kaputt, nicht als „fast richtig“.
 */
export function zugangAus(inhalt: unknown): Zugang | null {
  const r = inhalt as Partial<Zugang> | null;
  if (!r || typeof r.streamId !== 'string' || typeof r.passwort !== 'string') return null;
  if (!istGueltigeId(r.streamId) || !r.passwort) return null;
  return {
    streamId: r.streamId,
    passwort: r.passwort,
    mitBild: r.mitBild !== false,
    laeuftSeit: typeof r.laeuftSeit === 'string' ? r.laeuftSeit : null,
  };
}
