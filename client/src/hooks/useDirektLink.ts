import { useEffect, useState } from 'react';
import { direktLinkAus, type DirektLink } from '@shared/ct/musikAppLink';

/**
 * Ein Direktlink in der Adresse geht vor dem gemerkten Stand: Wer gezielt ein Lied öffnet, will dorthin. **Nur lesen**
 * – aus der Adresse nimmt ihn ein Effekt danach. React ruft Startwerte im StrictMode zweimal auf; als das Lesen ihn
 * gleich löschte, fand der zweite Aufruf nichts mehr, und der Direktlink ging verloren (gefunden im E2E, E6-O O4).
 */
function direktLinkLesen() {
  return typeof window === 'undefined' ? null : direktLinkAus(window.location.hash);
}

/**
 * **Der Direktlink aus dem Dienstplaner** (E6-O O4) – einmal beim Start gelesen, danach aus der Adresse genommen, sonst
 * spränge jedes Neuladen wieder zu diesem Lied. Eigener Hook, weil ihn zwei brauchen: die Terminabfrage in `App` (holt
 * einen Termin außerhalb der geladenen Wochen nach) und `useAppNav` (springt hin) – und die Terminabfrage muss vor
 * `useAppNav` stehen.
 */
export function useDirektLink(): DirektLink | null {
  const [direkt] = useState(direktLinkLesen);
  useEffect(() => {
    if (direkt)
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, [direkt]);
  return direkt;
}
