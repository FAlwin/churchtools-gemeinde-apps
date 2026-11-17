/**
 * **Die Bearbeiten-Aktionen des Ablaufs im Dienstplaner** (Bauplan E6-3a, #645) – für die Bearbeiten-Liste
 * `ui/ablauf/useAblaufBearbeiten`. Seit E10-V3b stehen sie in `@ui/ablauf/browserAblaufZugriff` (die Musik-App-Erweiterung
 * braucht denselben Browser-Weg für Vorlagen); hier bleibt, was nur der Dienstplaner hat: der Hinweis auf einen
 * abgeschlossenen Ablauf. Die Regeln stehen im Schreibkern (`@shared/ct/schreibKern`).
 */
import { terminAktionen } from '@ui/ablauf/browserAblaufZugriff';

/**
 * Hinweis, wenn man einen abgeschlossenen Ablauf ändern will – öffnen kann man ihn hier (noch) nicht. Eine Stelle für
 * die Bearbeiten-Liste und das Ziehen zwischen Terminen (E6-6b).
 */
export const GESPERRT =
  'Dieser Ablauf ist in ChurchTools abgeschlossen. Zum Ändern erst in ChurchTools oder in der Musik-App öffnen.';

/** Die Aktionen für den Ablauf eines Termins – mit Auge. */
export const ablaufAktionen = terminAktionen;
