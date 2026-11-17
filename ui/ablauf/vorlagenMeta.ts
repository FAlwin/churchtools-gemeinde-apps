import type { VorlagenEintrag } from '@shared/ct/ablaufVorlagenListe';
import { tagMonat } from '@shared/ct/datum';

/** „9 Punkte · 2 vor Beginn · geändert 12.11.“ – was unter dem Namen steht. */
export function vorlagenMeta(v: Pick<VorlagenEintrag, 'punkte' | 'vorlauf' | 'geaendert'>): string {
  return [
    v.punkte === 1 ? '1 Punkt' : `${v.punkte} Punkte`,
    v.vorlauf > 0 ? `${v.vorlauf} vor Beginn` : null,
    v.geaendert ? `geändert ${tagMonat(v.geaendert)}` : null,
  ]
    .filter((t): t is string => t !== null)
    .join(' · ');
}
