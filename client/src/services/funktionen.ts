/**
 * Was es in dieser Auslieferung gibt (#336) – **die eine Stelle, die Komponenten fragen**.
 *
 * Komponenten und Hooks fragen nie nach dem Modus (`modus.ts`), sondern nach einer Funktion. So bleibt
 * die Weiche in der Service-Schicht (Plan §4), und eine Komponente sagt im Code, WAS fehlt, statt WO sie
 * läuft. Was es nicht gibt, wird nicht angezeigt – kein toter Knopf, keine Fehlermeldung beim Antippen.
 *
 * Bearbeiten steckt NICHT hier: Das regeln die Rechte (`ctLesen.meineRechte`), weil es dort ohnehin
 * je Person unterschiedlich ist.
 */
import { istExtension } from './modus';

export const funktionen = {
  /** Gottesdienste für offline speichern (Service-Worker-Cache – den gibt es unter /ccm/… nicht). */
  offline: !istExtension,
  /** „Als App installieren" (PWA). */
  installieren: !istExtension,
  /** Eigenes Abmelden – in der Extension meldet man sich in ChurchTools ab. */
  abmelden: !istExtension,
  /**
   * Den Gemeindenamen in der Verwaltung ändern. In der Extension kommt er aus ChurchTools (`/api/info`);
   * die übrige Verwaltung gibt es dort seit 3b-4 auch (Daten der Erweiterung, `ctEinstellungen.ts`).
   */
  gemeindeName: !istExtension,
  /**
   * Die Einstellungen liegen im Datenbereich der Erweiterung (3b-4) – und erreichen Musiker nur, wenn
   * ihre Gruppe die Kategorie sehen darf. Das sagt die Verwaltung dazu.
   */
  einstellungenInChurchTools: istExtension,
  /** Abwesenheiten samt Termin-Arten – in der Extension ab 3b-3. */
  abwesenheiten: !istExtension,
  /**
   * Suche im Liedtext – ein Lauf über jede Lieddatei; im Browser liefe er auf jedem Gerät einzeln (Plan
   * 3c, #300). Die Lied-Statistik gibt es seit 08.10.2026 auch hier (`getSongStatistic`, ein Aufruf).
   */
  liedtextSuche: !istExtension,
  /**
   * Der Vollbild-Knopf (Liederliste, Ablauf, Werkzeug im Liedblatt): legt die App über die Leiste von
   * ChurchTools (`useAppVollbild`). Nur in der Erweiterung – nur dort gibt es diese Leiste.
   */
  vollbildKnopf: istExtension,
  /** Der Hinweis auf die Musik App mit eigenem Server (Plan §6, „der Teaser"). */
  hinweisAufServerVariante: istExtension,
} as const;

/**
 * Wohin „Mehr erfahren" im Hinweis führt: direkt in den README-Abschnitt „Für andere Gemeinden"
 * (eigener Server, Schnellstart) – nicht auf die Projektseite, wo das README erst unter der Dateiliste
 * kommt (Alwin, 07.10.2026). Wird die Überschrift im README umbenannt, hier mitziehen.
 */
export const PROJEKT_ADRESSE =
  'https://github.com/FAlwin/churchtools-musik-app#f%C3%BCr-andere-gemeinden';
