import type { VorlagenEintrag } from '@shared/ct/ablaufVorlagenListe';
import { tagMonat } from '@shared/ct/datum';

/** „1 Punkt“ / „9 Punkte“ – die eine Schreibweise für Liste, „Ablauf anlegen“ und „Als Vorlage …“. */
export function punkteText(n: number): string {
  return n === 1 ? '1 Punkt' : `${n} Punkte`;
}

/** „9 Punkte · 2 vor Beginn · geändert 12.11.“ – was unter dem Namen steht. */
export function vorlagenMeta(v: Pick<VorlagenEintrag, 'punkte' | 'vorlauf' | 'geaendert'>): string {
  return [
    punkteText(v.punkte),
    v.vorlauf > 0 ? `${v.vorlauf} vor Beginn` : null,
    v.geaendert ? `geändert ${tagMonat(v.geaendert)}` : null,
  ]
    .filter((t): t is string => t !== null)
    .join(' · ');
}

/** Was schiefging, als Text – `Error.message` kommt aus dem Kern (403, 423, 412 …). */
export function meldung(e: unknown, sonst: string): string {
  return e instanceof Error && e.message ? e.message : sonst;
}

/** Die Meldung nach „Als Vorlage …“ (E10-V5) – eine Stelle für beide Wege; die Apps zeigen sie als kleinen Hinweis. */
export function alsVorlageMeldung(art: 'neu' | 'ersetzt', name: string): string {
  return art === 'neu' ? `Als Vorlage „${name}“ gespeichert.` : `Vorlage „${name}“ ersetzt.`;
}
