/**
 * **Was die Technik-Karte zeigt und tut** (Bauplan Gebetsabend G3, Entwurf v3 vom 05.11.2026) – die Regeln an EINER
 * Stelle, ohne Oberfläche.
 *
 * Der Sender läuft **in der Seite** (G0-3), auf genau dem Gerät, auf dem „Übertragung starten“ oder „Sender hier
 * starten“ getippt wurde. Das weiß nur dieses Gerät – gespeichert ist allein, DASS gesendet wird („läuft seit“).
 * Deshalb startet die Seite den Sender **nie von selbst**: Nach dem Neuladen oder auf einem zweiten Gerät steht
 * „Läuft – der Sender ist auf diesem Gerät nicht aktiv“, und zwei Geräte senden nie unbemerkt gleichzeitig.
 */
import type { SpeicherGrund } from '../ct/versionierterWert';
import type { Zugang } from './zugang';

/**
 * - `aus`: keine Übertragung.
 * - `hier`: Übertragung läuft, der Sender läuft auf DIESEM Gerät.
 * - `woanders`: Übertragung läuft, aber nicht von hier (anderes Gerät oder Seite neu geladen).
 */
export type TechnikStand = 'aus' | 'hier' | 'woanders';

/** `gesendet` = womit der Sender auf diesem Gerät läuft (`null` = er läuft hier nicht). */
export function technikStand(zugang: Zugang | null, gesendet: Zugang | null): TechnikStand {
  if (!zugang?.laeuftSeit) return 'aus';
  return gesendet && senderBleibt(gesendet, zugang) ? 'hier' : 'woanders';
}

/**
 * Darf der Sender auf diesem Gerät nach einer Nachfrage weiterlaufen? Nur, wenn noch dieselbe Übertragung gilt. Hat
 * ein anderes Gerät beendet oder neu gestartet (neue StreamID/Passwort), sendet dieses Gerät ins Leere – es hört auf.
 */
export function senderBleibt(gesendet: Zugang, jetzt: Zugang | null): boolean {
  return (
    !!jetzt?.laeuftSeit &&
    jetzt.streamId === gesendet.streamId &&
    jetzt.passwort === gesendet.passwort &&
    jetzt.mitBild === gesendet.mitBild
  );
}

/** Beenden: Zugangsdaten bleiben stehen (der nächste Start erzeugt neue), nur „läuft seit“ fällt weg. */
export function beendet(z: Zugang): Zugang {
  return { ...z, laeuftSeit: null };
}

export const TECHNIK_TEXT = {
  startHinweis:
    'Auf dem Gerät im Raum starten. Beim ersten Mal fragt der Browser nach Kamera und Mikrofon – „Erlauben“ und am besten „Immer“. Jeder Start setzt ein neues Passwort.',
  bildHinweis: 'Mit Bild braucht es im Gemeindehaus mehr Internet.',
  offenLassen:
    'Diese Seite offen lassen und das Gerät nicht sperren – sonst bricht die Übertragung ab.',
  woanders:
    'Der Sender ist auf diesem Gerät nicht aktiv – er läuft auf einem anderen Gerät, oder die Seite wurde neu geladen.',
  hierStartenHinweis:
    '„Sender hier starten“ nur, wenn auf dem anderen Gerät nicht mehr gesendet wird – gleiches Passwort, die Zuhörer bleiben verbunden.',
  senderWeg:
    'Die Übertragung wurde auf einem anderen Gerät beendet oder neu gestartet – hier wird nicht mehr gesendet.',
  beendenFrage:
    'Alle, die gerade zuhören, werden getrennt. Beim nächsten Start gibt es ein neues Passwort.',
  /** Statt „Gebetsabend zuhören“ auf dem Gerät, das sendet. */
  nichtHierZuhoeren:
    'Du sendest von diesem Gerät. Zum Mithören bitte ein anderes Gerät nehmen – hier liefe der Ton wieder ins Mikrofon.',
} as const;

/**
 * Was beim Speichern schiefging – im Ton der Organigramm-/Dienstplaner-Texte (`planTexte`, `plaetzeTexte`). `was` ist
 * die Handlung („gestartet“, „beendet“, „gespeichert“), `kategorie` die ChurchTools-Kategorie für fehlende Rechte.
 */
export function speicherFehlerText(
  grund: SpeicherGrund,
  was: string,
  kategorie: string,
  von?: string,
): string {
  switch (grund) {
    case 'konflikt':
      return `${von ?? 'Jemand anderes'} hat das inzwischen geändert – nichts überschrieben, hier steht jetzt der neue Stand.`;
    case 'abgemeldet':
      return 'Nicht mehr bei ChurchTools angemeldet – Seite neu laden.';
    case 'kein-recht':
      return `ChurchTools erlaubt dir das nicht. Dafür braucht es in ChurchTools das Recht, die Kategorie „${kategorie}“ der Erweiterung zu bearbeiten.`;
    case 'voruebergehend':
      return `ChurchTools antwortet gerade nicht – nicht ${was}. Bitte gleich noch einmal.`;
    case 'nicht-angekommen':
      return `ChurchTools hat es angenommen, nachgelesen steht es aber nicht da – nicht ${was}. Bitte noch einmal.`;
    case 'zu-gross':
      return `Das ist zu groß für ChurchTools – nicht ${was}.`;
  }
}
