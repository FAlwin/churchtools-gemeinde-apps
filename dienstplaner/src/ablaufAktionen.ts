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
import type { AblaufAktionen, VorlagenAktionen } from '@ui/ablauf/useAblaufBearbeiten';
import { browserSchreiber } from '@ui/ct/schreiber';
import {
  ablaufUmsortieren,
  punktAendern,
  punktAnlegen,
  punktLoeschen,
  punktWiederherstellen,
  vorBeginnSetzen,
  weglassenSetzen,
  type AblaufZiel,
} from '@shared/ct/schreibKern';

/**
 * Hinweis, wenn man einen abgeschlossenen Ablauf ändern will – öffnen kann man ihn hier (noch) nicht. Eine Stelle für
 * die Bearbeiten-Liste und das Ziehen zwischen Terminen (E6-6b).
 */
export const GESPERRT =
  'Dieser Ablauf ist in ChurchTools abgeschlossen. Zum Ändern erst in ChurchTools oder in der Musik-App öffnen.';

/**
 * Die Aktionen für die Punkte eines Ablaufs – Termin (`number`) oder Ablaufvorlage (`{ vorlageId }`, E10-V3a): **eine**
 * Zuordnung auf den Schreib-Kern, der Kern kennt beide Ziele. Das Auge (`weglassenSetzen`) gibt es nur am Termin.
 */
function punktAktionen(ziel: AblaufZiel, geschrieben: () => void): VorlagenAktionen {
  const s = browserSchreiber;
  async function danach<T>(schreiben: Promise<T>): Promise<T> {
    const ergebnis = await schreiben;
    geschrieben();
    return ergebnis;
  }
  return {
    reorder: (order, gesehen) => danach(ablaufUmsortieren(s, ziel, order, gesehen)),
    remove: (itemId) => danach(punktLoeschen(s, ziel, itemId)),
    restore: async (punkt) => {
      await danach(punktWiederherstellen(s, ziel, punkt));
    },
    update: (itemId, fields, gesehen) => danach(punktAendern(s, ziel, itemId, fields, gesehen)),
    setVorBeginn: (itemId, vorBeginn) => danach(vorBeginnSetzen(s, ziel, itemId, vorBeginn)),
    add: (data) => danach(punktAnlegen(s, ziel, data)),
  };
}

export function ablaufAktionen(eventId: number, geschrieben: () => void): AblaufAktionen {
  return {
    ...punktAktionen(eventId, geschrieben),
    setWeggelassen: async (itemId, weg) => {
      await weglassenSetzen(browserSchreiber, eventId, itemId, weg);
      geschrieben();
    },
  };
}

/** Die Aktionen für den Ablauf einer Ablaufvorlage – ohne Auge. */
export function vorlagenAktionen(vorlageId: number, geschrieben: () => void): VorlagenAktionen {
  return punktAktionen({ vorlageId }, geschrieben);
}
