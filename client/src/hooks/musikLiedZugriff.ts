import type { LiedZugriff } from '@ui/lied/liedZugriff';
import * as api from '../services/churchtoolsApi';
import { funktionen } from '../services/funktionen';
import { useCapabilities } from './useServices';

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
    return c
      ? { statistik: c.canViewSongStatistics ?? false, ccli: c.canUseCcli ?? false }
      : undefined;
  },
};
