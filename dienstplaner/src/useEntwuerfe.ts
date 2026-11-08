import { useEffect, useState } from 'react';
import { useLaden } from '@ui/ct/useLaden';
import type { Plan } from '@shared/dienstplan/plan';
import {
  ortSchluessel,
  type Entwurf,
  type EntwurfErgebnis,
  type EntwurfZiel,
} from '@shared/dienstplan/entwuerfe';
import type { Belegung, PlatzOrt } from '@shared/dienstplan/einteilen';
import type { EntwuerfeDaten, EntwurfAnschluss } from './ladeEntwuerfe';
import type { TerminStand } from './terminStand';
import { entwurfsLage } from './planEntwuerfe';

export type EntwuerfeZustand =
  | { art: 'laedt' }
  | { art: 'fehler'; text: string }
  | { art: 'fertig'; daten: EntwuerfeDaten };

/**
 * **Die Entwürfe in „Planen“** (E4-3; #845, Scheibe 4a-2: aus der Komponente herausgezogen, unverändert): geladen beim
 * Öffnen, neu nach dem Einrichten einer Schublade oder „Erneut versuchen“ (`neu`). Dazu, wo welcher Entwurf steht
 * (`lage`, Regeln in `planEntwuerfe`) – Termine außerhalb des Zeitraums werden dafür nachgefragt.
 */
export function useEntwuerfe(
  entwuerfe: EntwurfAnschluss | undefined,
  plan: Plan | null,
  heute: string,
) {
  const { stand, neu, setze } = useLaden(() => (entwuerfe ? entwuerfe.laden() : null), [entwuerfe]);
  const ew: EntwuerfeZustand =
    stand.art === 'fertig'
      ? { art: 'fertig', daten: stand.daten }
      : stand.art === 'fehler'
        ? { art: 'fehler', text: stand.fehler.text }
        : { art: 'laedt' };
  const daten = ew.art === 'fertig' ? ew.daten : null;

  /** Einen Entwurf (oder sein Fehlen) in die geladenen Daten übernehmen – ohne alles neu zu laden. */
  const setzen = (k: string, e: Entwurf | null) =>
    setze((alt) => {
      const map = new Map(alt.entwuerfe);
      if (e) map.set(k, e);
      else map.delete(k);
      return { ...alt, entwuerfe: map };
    });

  /**
   * Einen Entwurf speichern und das Ergebnis gleich in die geladenen Daten übernehmen – bei einem Konflikt das, was
   * jetzt dasteht. **Eine Stelle** für „Wer kann?“, Zurückziehen und Zauberstab (E5-2): Wer die Eingabe ändert
   * (etwa „direkt zuteilen“ als Vorgabe je Dienst), ändert sie für alle.
   */
  const speichern = async (
    daten: EntwuerfeDaten,
    gruppeId: number,
    e: { ort: PlatzOrt; ziel: EntwurfZiel; gesehen: Belegung; modus?: Entwurf['modus'] },
    erwartet: number | null,
  ): Promise<EntwurfErgebnis> => {
    if (!entwuerfe) return { ok: false, grund: 'voruebergehend' };
    const r = await entwuerfe.speichern(
      daten,
      gruppeId,
      {
        ort: e.ort,
        ziel: e.ziel,
        modus: e.modus ?? 'anfrage',
        gesehen: e.gesehen,
        von: entwuerfe.ich,
      },
      erwartet,
    );
    const k = ortSchluessel(e.ort);
    if (r.ok) setzen(k, r.entwurf);
    else if (r.grund === 'konflikt') setzen(k, r.jetzt ?? null);
    return r;
  };

  const [staende, setStaende] = useState<Map<number, TerminStand>>(new Map());
  const lage = entwurfsLage(plan, daten, staende, heute);
  const fremdSchluessel = lage.fremd.join(',');
  // Gesammelt, nicht ersetzt: Mit jeder Antwort werden weniger Termine „fremd“ – die bekannten bleiben bekannt.
  // Scheitert es, bleibt der Stand „unbekannt“: nichts als alt melden (vorübergehend ist nicht gelöscht).
  const nachgefragt = useLaden(
    () =>
      entwuerfe && fremdSchluessel
        ? entwuerfe.termine(fremdSchluessel.split(',').map(Number))
        : null,
    [entwuerfe, fremdSchluessel],
  ).stand;
  useEffect(() => {
    if (nachgefragt.art === 'fertig') setStaende((alt) => new Map([...alt, ...nachgefragt.daten]));
  }, [nachgefragt]);

  return { ew, daten, neu, setzen, speichern, lage };
}
