import { useLaden } from '@ui/ct/useLaden';
import { ladeMusikApp } from './ladeBeiwerk';

/**
 * **Die Adresse der Musik-App als Hook** – EINE Stelle für Startseite, Termin-Ansicht und Matrix (#845; vorher drei
 * Ladeblöcke mit verschiedenem Umgang mit Fehlern). `undefined` = noch unbekannt oder gescheitert (Beiwerk: dann fehlt
 * nur der Knopf), `null` = nicht installiert (die Lied-Ansicht sagt es dann). Ohne `aktiv` wird nicht gefragt.
 */
export function useMusikApp(aktiv = true): string | null | undefined {
  const s = useLaden(() => (aktiv ? ladeMusikApp() : null), [aktiv]).stand;
  return s.art === 'fertig' ? s.daten : undefined;
}
