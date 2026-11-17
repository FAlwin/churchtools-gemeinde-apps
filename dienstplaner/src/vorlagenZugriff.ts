/**
 * **Wie der Dienstplaner die Seite „Ablaufvorlagen“ mit ChurchTools verbindet** (E10-V3a): lesen über `ctDaten`, schreiben
 * über den Browser-Schreiber und den Kern (`@shared/ct/ablaufVorlagen`, `schreibKern`) – hier steht keine Regel, nur die
 * Verdrahtung für `@ui/ablauf/VorlagenBereich`. Die Musik-App bekommt in V3b einen eigenen Zugriff über ihren Server.
 */
import type { VorlagenZugriff } from '@ui/ablauf/vorlagenZugriff';
import { ApiError } from '@ui/ct/fehler';
import { browserSchreiber } from '@ui/ct/schreiber';
import { ctDaten } from '@ui/ct/verbindung';
import { vorlageAnlegen, vorlageLoeschen, vorlageUmbenennen } from '@shared/ct/ablaufVorlagen';
import { vorlagenStandAus } from '@shared/ct/ablaufVorlagenListe';
import type { CtAblaufVorlage, CtKalender } from '@shared/ct/typen';
import { gemeindeZeitzone } from '@shared/ct/zeit';
import { vorlagenAktionen } from './ablaufAktionen';

/** Eine einzige Instanz – die Seite lädt neu, sobald sich ihr Zugriff ändert. */
export const vorlagenZugriff: VorlagenZugriff = {
  liste: async () => {
    const [roh, kalender] = await Promise.all([
      ctDaten<unknown>('/agendatemplates'),
      ctDaten<unknown>('/calendars'),
    ]);
    if (!Array.isArray(roh)) {
      throw new ApiError(502, 'ChurchTools hat die Vorlagen nicht geliefert.');
    }
    if (!Array.isArray(kalender)) {
      throw new ApiError(502, 'ChurchTools hat die Kalender nicht geliefert.');
    }
    return vorlagenStandAus(roh as CtAblaufVorlage[], kalender as CtKalender[], gemeindeZeitzone());
  },
  vorlage: (id) => browserSchreiber.vorlage(id),
  aktionen: vorlagenAktionen,
  anlegen: (daten) => vorlageAnlegen(browserSchreiber, daten),
  umbenennen: (id, name) => vorlageUmbenennen(browserSchreiber, id, name),
  loeschen: (id) => vorlageLoeschen(browserSchreiber, id),
};
