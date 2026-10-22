/**
 * **Die Bearbeiten-Aktionen des Ablaufs im Dienstplaner** (Bauplan E6-3a, #645) – für die Bearbeiten-Liste
 * `ui/ablauf/useAblaufBearbeiten`. Die Regeln stehen im Schreibkern (`@shared/ct/schreibKern`: frisch lesen, Rumpf
 * aus dem Ist-Zustand, Reihenfolge-Schutz), geschrieben wird über den Browser-Schreiber beider Apps
 * (`@ui/ct/schreiber`).
 *
 * Nach jedem gelungenen Schreiben `geschrieben()` – die Termin-Ansicht liest den Ablauf dann neu (wie die Musik-App
 * nach jeder Änderung). Nicht abgewartet: Scheitert nur das Neu-Lesen, war das Schreiben trotzdem gelungen und darf
 * nicht als Fehler zurückgerollt werden.
 */
import type { AblaufAktionen } from '@ui/ablauf/useAblaufBearbeiten';
import { browserSchreiber } from '@ui/ct/schreiber';
import {
  ablaufUmsortieren,
  punktAendern,
  punktAnlegen,
  punktLoeschen,
  punktWiederherstellen,
  vorBeginnSetzen,
} from '@shared/ct/schreibKern';

export function ablaufAktionen(eventId: number, geschrieben: () => void): AblaufAktionen {
  const s = browserSchreiber;
  async function danach<T>(schreiben: Promise<T>): Promise<T> {
    const ergebnis = await schreiben;
    geschrieben();
    return ergebnis;
  }
  return {
    reorder: (order) => danach(ablaufUmsortieren(s, eventId, order)),
    remove: (itemId) => danach(punktLoeschen(s, eventId, itemId)),
    restore: (punkt) => danach(punktWiederherstellen(s, eventId, punkt)),
    update: (itemId, fields) => danach(punktAendern(s, eventId, itemId, fields)),
    setVorBeginn: (itemId, vorBeginn) => danach(vorBeginnSetzen(s, eventId, itemId, vorBeginn)),
    add: (data) => danach(punktAnlegen(s, eventId, data)),
  };
}
