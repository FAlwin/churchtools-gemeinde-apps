// Die Regeln liegen seit #335 in `@shared/ct/agendaDiff` – Server und ChurchTools-Extension teilen sie.
// Hier bleibt nur das Hashen mit `node:crypto`; der Browser rechnet dasselbe mit `crypto.subtle`.
import { createHash } from 'node:crypto';
import { fingerprintRohtext } from '@shared/ct/agendaDiff';
import type { CtAgendaItem } from '@shared/ct/typen';

export * from '@shared/ct/agendaDiff';

/**
 * Fingerabdruck einer Setlist (#143): sha256 über `fingerprintRohtext` – nie der Klartext, siehe
 * dort. Leerer Ablauf → `''`.
 */
export function setlistFingerprint(items: CtAgendaItem[]): string {
  return fingerprintAusText(fingerprintRohtext(items));
}

/** sha256 eines `fingerprintRohtext` – leerer Text bleibt `''` (leerer Ablauf). */
export function fingerprintAusText(raw: string): string {
  return raw ? createHash('sha256').update(raw).digest('hex') : '';
}
