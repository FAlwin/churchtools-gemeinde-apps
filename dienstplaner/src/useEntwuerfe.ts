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
import type { Personenliste } from '@shared/dienstplan/personenliste';
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
  /**
   * Termine außerhalb von `plan` nachfragen, um alte Entwürfe zu erkennen – nur in „Planen“. Die Termin-Ansicht (F1)
   * zeigt nur ihren Termin; dort wären fast alle Entwürfe „fremd“, jede Ansicht fragte sie neu ab.
   */
  nachfragen = true,
) {
  const { stand, neu, setze } = useLaden(() => (entwuerfe ? entwuerfe.laden() : null), [entwuerfe]);
  const ew: EntwuerfeZustand =
    stand.art === 'fertig'
      ? { art: 'fertig', daten: stand.daten }
      : stand.art === 'fehler'
        ? { art: 'fehler', text: stand.fehler.text }
        : { art: 'laedt' };
  const daten = ew.art === 'fertig' ? ew.daten : null;

  /**
   * Einen Entwurf (oder sein Fehlen) in die geladenen Daten übernehmen – ohne alles neu zu laden. **Samt `gruppeJe`**
   * (18.11.2026, Abnahme „Alle verwerfen“ auf der Test-Instanz): Vorher stand dort nur, was beim Laden da war – ein
   * frisch angelegter Entwurf fehlte bis zum Neuladen, „Alle verwerfen“ übersprang ihn, und der Zauberstab zählte ihn
   * nicht als eingeplant (`zauberEingeplant`).
   */
  const setzen = (k: string, e: Entwurf | null, gruppeId: number) =>
    setze((alt) => {
      const map = new Map(alt.entwuerfe);
      const gruppen = new Map(alt.gruppeJe);
      if (e) {
        map.set(k, e);
        gruppen.set(k, gruppeId);
      } else {
        map.delete(k);
        gruppen.delete(k);
      }
      return { ...alt, entwuerfe: map, gruppeJe: gruppen };
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
    if (r.ok) setzen(k, r.entwurf, gruppeId);
    else if (r.grund === 'konflikt') setzen(k, r.jetzt ?? null, gruppeId);
    return r;
  };

  /**
   * Die Personenliste einer Dienstgruppe in die geladenen Daten übernehmen (PL-2) – **nur, was nachgelesen bestätigt ist**
   * (`personenlisteSpeichern` liefert nach `ok` und bei einem Konflikt, was jetzt dasteht). `null`: es gibt keine Liste.
   */
  const setzeListe = (gruppeId: number, liste: Personenliste | null) =>
    setze((alt) => {
      const listen = new Map(alt.personenlisten);
      if (liste) listen.set(gruppeId, liste);
      else listen.delete(gruppeId);
      return { ...alt, personenlisten: listen };
    });

  const [staende, setStaende] = useState<Map<number, TerminStand>>(new Map());
  const lage = entwurfsLage(plan, daten, staende, heute);
  const fremdSchluessel = nachfragen ? lage.fremd.join(',') : '';
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

  return { ew, daten, neu, setzen, setzeListe, speichern, lage };
}
