import { ApiError } from '../services/api';

/**
 * Warum das Speichern einer Einstellung scheiterte – die Meldung von Server oder ChurchTools („erlaubt
 * dir nicht …"), sonst allgemein. In der Erweiterung ist das fehlende Recht der häufigste Grund (3b-4);
 * bis dahin stand an allen Stellen nur „Speichern fehlgeschlagen.".
 */
export function speicherFehler(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen.';
}
