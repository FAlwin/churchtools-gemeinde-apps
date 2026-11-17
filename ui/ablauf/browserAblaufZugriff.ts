/**
 * **Der Zugriff auf Ablauf und Ablaufvorlagen direkt aus dem Browser** (E6-3a/E10-V3a, in V3b hierher gezogen): lesen über `ctDaten`,
 * schreiben über den Browser-Schreiber und den Kern (`@shared/ct/ablaufVorlagen`, `schreibKern`). Hier steht keine Regel,
 * nur die Verdrahtung für `VorlagenBereich` – der Dienstplaner nimmt ihn, wie er ist; die Musik-App-Erweiterung nimmt die
 * einzelnen Vorgänge über ihre Weiche (`churchtoolsApi.ts`), damit der Server-Betrieb denselben Zugriff hat.
 */
import type { AblaufAktionen, VorlagenAktionen } from './useAblaufBearbeiten';
import type { VorlagenZugriff } from './vorlagenZugriff';
import { ApiError } from '../ct/fehler';
import { browserSchreiber } from '../ct/schreiber';
import { ctDaten } from '../ct/verbindung';
import { vorlageAnlegen, vorlageLoeschen, vorlageUmbenennen } from '@shared/ct/ablaufVorlagen';
import { vorlagenStandAusRohdaten } from '@shared/ct/ablaufVorlagenListe';
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
import { gemeindeZeitzone } from '@shared/ct/zeit';

/**
 * Die Aktionen für die Punkte eines Ablaufs – Termin (`number`) oder Ablaufvorlage (`{ vorlageId }`, E10-V3a): **eine**
 * Zuordnung auf den Schreib-Kern, der Kern kennt beide Ziele. Das Auge (`weglassenSetzen`) gibt es nur am Termin.
 *
 * Nach jedem gelungenen Schreiben `geschrieben()` – nicht abgewartet: Scheitert nur das Neu-Lesen, war das Schreiben
 * trotzdem gelungen und darf nicht als Fehler zurückgerollt werden.
 */
export function punktAktionen(ziel: AblaufZiel, geschrieben: () => void): VorlagenAktionen {
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

/** Die Aktionen für den Ablauf eines **Termins**: die Punkt-Aktionen plus das Auge. */
export function terminAktionen(eventId: number, geschrieben: () => void): AblaufAktionen {
  return {
    ...punktAktionen(eventId, geschrieben),
    setWeggelassen: async (itemId, weg) => {
      await weglassenSetzen(browserSchreiber, eventId, itemId, weg);
      geschrieben();
    },
  };
}

/** Die Liste samt Kalendern – frisch aus ChurchTools. */
export async function browserVorlagenStand(): ReturnType<VorlagenZugriff['liste']> {
  const [roh, kalender] = await Promise.all([
    ctDaten<unknown>('/agendatemplates'),
    ctDaten<unknown>('/calendars'),
  ]);
  return vorlagenStandAusRohdaten(
    roh,
    kalender,
    gemeindeZeitzone(),
    (status, meldung) => new ApiError(status, meldung),
  );
}

/** Eine einzige Instanz – die Seite lädt neu, sobald sich ihr Zugriff ändert. */
export const browserVorlagenZugriff: VorlagenZugriff = {
  liste: browserVorlagenStand,
  vorlage: (id) => browserSchreiber.vorlage(id),
  aktionen: (vorlageId, geschrieben) => punktAktionen({ vorlageId }, geschrieben),
  anlegen: (daten) => vorlageAnlegen(browserSchreiber, daten),
  umbenennen: (id, name) => vorlageUmbenennen(browserSchreiber, id, name),
  loeschen: (id) => vorlageLoeschen(browserSchreiber, id),
};
