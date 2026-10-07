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
  /** Verwaltung (Name, Links, Termin-Arten, Anmerkungen) – liegt im `site.json` des Servers. */
  verwaltung: !istExtension,
  /** Lied-Statistik (Häufigkeit, zuletzt) – Massenlauf, den nur der Server bündeln kann (Plan 3c). */
  statistik: !istExtension,
  /** Suche im Liedtext – ebenso (Plan 3c). */
  liedtextSuche: !istExtension,
  /**
   * Etwas in ChurchTools ÄNDERN (Tempo, Ablauf, Lieder) – kommt in der Extension erst mit Phase 3b.
   * Die Knöpfe dafür blenden die Rechte aus (`ctLesen.meineRechte`); diese Angabe braucht es dort, wo
   * die Oberfläche sonst einen GRUND nennt – sie darf nicht „fehlende Berechtigung" behaupten, wenn
   * die Person das Recht hat (Alwin, 07.10.2026, Tempo-Menü).
   */
  schreibenInChurchTools: !istExtension,
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
