import { useEffect } from 'react';
import { HINT_VOLLBILD_KNOPF, isTourDone, markTourDone } from '../utils/onboarding';

/**
 * Einmal nach dem Update auf den neuen Vollbild-Knopf hinweisen (`HINT_VOLLBILD_KNOPF`) – nur wo es
 * ihn gibt (Erweiterung), erst wenn die App steht, und nicht über eine laufende Einführung.
 */
export function useVollbildHinweis(bereit: boolean, showToast: (text: string) => void): void {
  useEffect(() => {
    if (!bereit || isTourDone(HINT_VOLLBILD_KNOPF)) return;
    markTourDone(HINT_VOLLBILD_KNOPF);
    showToast(
      'Neu: Vollbild – der Knopf oben rechts legt die Musik App über die ChurchTools-Leiste.',
    );
  }, [bereit, showToast]);
}
