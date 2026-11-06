import * as ct from '../ct/lieder';
import { anlegenUngewissAus, notenblattTextAus, type LiedZugriff } from './liedZugriff';

/** Was die App selbst beisteuert – alles, was nicht „ChurchTools direkt aus dem Browser" ist. */
export type LiedZugriffAppTeil = Pick<
  LiedZugriff,
  'useRechte' | 'liedansicht' | 'useBlattLogo' | 'nachAenderung'
>;

/**
 * **Der Liedzugriff einer Erweiterung, die ChurchTools direkt anspricht** (Dienstplaner, LW2b, 06.11.2026).
 *
 * Die Wege sind dieselben, die die Musik-App als Erweiterung nimmt (`ui/ct/lieder.ts`, seit LW2a) – samt derselben
 * Zwischenspeicher. Die Musik-App hat einen eigenen Liedzugriff (`musikLiedZugriff`), weil sie auch mit Server läuft;
 * die beiden Regeln, die dabei über den Rohwert hinausgehen („leeres Blatt = keins", „502 = vielleicht doch angelegt"),
 * kommen für beide aus `liedZugriff.ts`.
 *
 * Eine Suche im Liedtext gibt es hier nicht – sie braucht den Server der Musik-App (#300).
 */
export function ctLiedZugriff(app: LiedZugriffAppTeil): LiedZugriff {
  return {
    liederliste: ct.lieder,
    nutzung: ct.liedNutzung,
    liedtextVorschau: ct.liedtextVorschau,
    songSelectSuche: ct.songSelectSuche,
    songSelectLied: ct.songSelectLiedHolen,
    songSelectLiedtext: ct.songSelectLiedtextHolen,
    kategorien: ct.bearbeitbareKategorien,
    liedAnlegen: ct.liedNeu,
    anlegenUngewiss: anlegenUngewissAus,
    notenblattAusSongSelect: async (songId, arrangementId, songNumber) => {
      await ct.notenblattAusCcli(songId, arrangementId, songNumber);
    },
    notenblattLesen: async (songId, arrangementId) =>
      notenblattTextAus(await ct.blatt(songId, arrangementId)),
    notenblattSpeichern: async (songId, arrangementId, text) => {
      await ct.notenblatt(songId, arrangementId, text);
    },
    stammdaten: ct.liedStammdatenAnsicht,
    liedAendern: ct.liedAendern,
    arrangements: ct.arrangementVerwaltung,
    arrangementAendern: ct.arrangement,
    ...app,
  };
}
