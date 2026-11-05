/**
 * Die Wahl im Fenster „Termin teilen“ (E8-1) – gemerkt im Gerät (`ui/bedienung/geraet.ts`), ein Schlüssel für
 * Dienstplaner und Musik-App. Getrennt vom Fenster, damit jene Datei nur Komponenten exportiert.
 */
import { BLATT_VORGABE, type BlattEinstellungen } from '@shared/ct/terminBlatt';
import { leseImGeraet, merkeImGeraet, zahlen } from '../bedienung/geraet';

const SCHLUESSEL = 'teilen.terminBlatt';

/**
 * Gemerktes über die Vorgabe legen – Feld für Feld und nur mit passendem Typ. So bleibt eine alte oder von Hand
 * veränderte Wahl lesbar, und ein später neues Feld bekommt seine Vorgabe.
 */
export function wahlAus(roh: unknown): BlattEinstellungen {
  const w = structuredClone(BLATT_VORGABE);
  const r = (roh ?? {}) as Record<string, Record<string, unknown> | boolean | undefined>;
  for (const teil of ['dienste', 'ablauf', 'infos'] as const) {
    const quelle = r[teil];
    if (!quelle || typeof quelle !== 'object') continue;
    const ziel = w[teil] as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(ziel)) {
      const neu = quelle[k];
      if (typeof v === 'boolean' && typeof neu === 'boolean') ziel[k] = neu;
    }
  }
  const d = r.dienste;
  if (d && typeof d === 'object') w.dienste.ohne = zahlen(d.ohne);
  const i = r.infos;
  if (i && typeof i === 'object' && Array.isArray(i.gruppen)) w.infos.gruppen = zahlen(i.gruppen);
  if (typeof r.quer === 'boolean') w.quer = r.quer;
  return w;
}

export const leseWahl = () => leseImGeraet(SCHLUESSEL, structuredClone(BLATT_VORGABE), wahlAus);
export const merkeWahl = (w: BlattEinstellungen) => merkeImGeraet(SCHLUESSEL, w);
