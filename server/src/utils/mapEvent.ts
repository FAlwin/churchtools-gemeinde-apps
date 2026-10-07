// Die Regel liegt seit #335 in `@shared/ct/mapEvent`; der Server gibt seine Zeitzone mit.
import { config } from '../config.js';
import { mapEventToService as mapEventIn } from '@shared/ct/mapEvent';
import type { CtEvent } from '../services/ctTypes.js';
import type { Service } from '@shared/types/index';

/** Wandelt ein ChurchTools-Event in unser Service-Format um. */
export function mapEventToService(
  ev: CtEvent,
  songCount: number,
  subtitle: string | null = null,
): Service {
  return mapEventIn(ev, songCount, subtitle, config.zeitzone);
}
