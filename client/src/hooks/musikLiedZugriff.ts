import {
  anlegenUngewissAus,
  liedRechteAus,
  notenblattTextAus,
  type LiedZugriff,
} from '@ui/lied/liedZugriff';
import * as api from '../services/churchtoolsApi';
import { schluessel } from './abfrageSchluessel';
import { funktionen } from '../services/funktionen';
import { useCapabilities } from './useServices';
import { useAppLogo } from './useAppLogo';
import { getLiedansicht } from '../utils/devicePrefs';

/**
 * **Der Liedzugriff der Musik-App** (LW1a, 06.11.2026): Die Liedwahl in `ui/lied` holt ihre Daten über diese Wege –
 * dieselben Aufrufe wie vor dem Umzug (`churchtoolsApi`, mit der Weiche Server/Erweiterung). Die Liedtext-Suche gibt es
 * nur, wo `funktionen` sie kennt (nicht in der Erweiterung, #300); die Rechte kommen aus der vorhandenen Abfrage.
 */
export const musikLiedZugriff: LiedZugriff = {
  liederliste: api.getSongLibrary,
  nutzung: api.getSongUsage,
  liedtextVorschau: api.holeLiedtextVorschau,
  songSelectSuche: api.sucheSongSelect,
  songSelectLied: api.getSongSelectSong,
  songSelectLiedtext: api.holeSongSelectLiedtext,
  liedtextSuche: funktionen.liedtextSuche ? api.sucheImLiedtext : undefined,
  useRechte() {
    const c = useCapabilities(true).data;
    return c ? liedRechteAus(c) : undefined;
  },
  // Notenblatt-Editor (LW1b-1): dieselbe Einstellung und dasselbe Logo wie das Liedblatt.
  liedansicht: getLiedansicht,
  useBlattLogo: useAppLogo,
  // „Neues Lied", Stammdaten, Arrangements (LW1b-2): dieselben Aufrufe wie vorher in `useServices`/`useNotenblatt`.
  kategorien: api.getSongCategories,
  liedAnlegen: api.legeLiedAn,
  anlegenUngewiss: anlegenUngewissAus,
  notenblattAusSongSelect: async (songId, arrangementId, songNumber) => {
    await api.holeChordProAusSongSelect(songId, arrangementId, songNumber);
  },
  notenblattLesen: async (songId, arrangementId) =>
    notenblattTextAus(await api.getSongChart(songId, arrangementId)),
  notenblattSpeichern: async (songId, arrangementId, text) => {
    await api.speichereNotenblatt(songId, arrangementId, text);
  },
  stammdaten: api.getSongStammdaten,
  liedAendern: api.aendereLied,
  arrangements: api.getArrangements,
  arrangementAendern: api.aendereArrangement,
  /**
   * Was nur die Musik-App neu lädt – genau die Schlüssel, die vor LW1b-2 in `useServices`/`useNotenblatt` standen:
   * nach einem Lied das Blatt und die Abläufe (Liedname), nach einem Arrangement das Blatt und die
   * Arrangement-Auswahl, nach einem Notenblatt das Blatt.
   */
  nachAenderung(qc, { art, songId }) {
    void qc.invalidateQueries({ queryKey: schluessel.liedblaetter(songId) });
    if (art === 'lied') void qc.invalidateQueries({ queryKey: schluessel.agendaAlle() });
    if (art === 'arrangement')
      void qc.invalidateQueries({ queryKey: schluessel.liedArrangements(songId) });
  },
};
