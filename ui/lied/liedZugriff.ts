import { createContext, useContext } from 'react';
import type {
  LiedtextVorschau,
  SongLibraryEntry,
  SongSelectLiedtext,
  SongSelectSong,
  SongSelectSuchergebnis,
  SongTextTreffer,
} from '@shared/types/index';

/** Wann ein Lied gespielt wurde – je Lied-ID die Tage (`getSongUsage`). Stand bis 06.11.2026 in `churchtoolsApi.ts`. */
export type SongUsageMap = Record<string, { dates: string[] }>;

/** Was die Liedwahl von den Rechten wissen muss. */
export interface LiedRechte {
  /** Häufigkeit/Zuletzt zeigen (`canViewSongStatistics`). */
  statistik: boolean;
  /** SongSelect nutzen (`canUseCcli`). */
  ccli: boolean;
}

/**
 * **Woher die Liedwahl ihre Daten hat** (Dienstplaner-Bauplan E9, Wunsch 4 „LW1a", 06.11.2026).
 *
 * Die Liedwahl (`SongPicker` und ihre Bausteine) liegt seit LW1a in `ui/lied` und wird von der Musik-App und vom
 * Dienstplaner genutzt. Die Regeln – wann gesucht wird, was zwischengespeichert wird, wie lange – stehen **einmal**
 * in `liedDaten.ts`; jede App gibt hier nur ihre Wege zu ChurchTools herein. Die Musik-App steckt ihre
 * `churchtoolsApi` ein (Server oder Erweiterung), der Dienstplaner spricht ChurchTools direkt an.
 *
 * Die Rechte kommen als **Hook**: Die Musik-App hält sie schon in ihrer eigenen Abfrage (`useCapabilities`) – eine
 * zweite Abfrage hier würde dieselben Rechte doppelt holen.
 */
export interface LiedZugriff {
  liederliste(): Promise<SongLibraryEntry[]>;
  nutzung(): Promise<SongUsageMap>;
  liedtextVorschau(songId: number): Promise<LiedtextVorschau>;
  songSelectSuche(titel: string): Promise<SongSelectSuchergebnis>;
  songSelectLied(songNumber: number): Promise<SongSelectSong>;
  songSelectLiedtext(songNumber: number): Promise<SongSelectLiedtext>;
  /** Die Suche im Liedtext – **fehlt sie, gibt es sie hier nicht** (z. B. in ChurchTools-Erweiterungen, #300). */
  liedtextSuche?: (q: string) => Promise<SongTextTreffer[]>;
  /** Die Rechte; `undefined`, solange sie noch laden. */
  useRechte(): LiedRechte | undefined;

  /* ------------------------------------------------ Notenblatt-Editor (LW1b-1, 06.11.2026) */

  /**
   * Wie die Vorschau im Editor das Blatt zeigt: als durchgehende Rolle (`scrollen`) oder seitenweise. Die Musik-App
   * gibt ihre Geräte-Einstellung „Liedansicht" herein, damit Editor und Liedblatt gleich aussehen.
   */
  liedansicht(): 'scrollen' | 'blaettern';
  /**
   * Das Logo für die Kopfzeile der PDF-Vorschau – `null`, solange es lädt, wenn es fehlt oder die Gemeinde es
   * ausgeblendet hat. Ein Hook, weil die Musik-App es aus ihren Einstellungen lädt (`useAppLogo`).
   */
  useBlattLogo(): HTMLImageElement | null;
}

/**
 * Gibt der Liedwahl darunter ihren Zugriff: `<LiedZugriffKontext.Provider value={…}>`. Bewusst ohne eigene
 * Hülle-Komponente – so bleibt diese Datei reine Logik (Fast Refresh, `react-refresh/only-export-components`).
 */
export const LiedZugriffKontext = createContext<LiedZugriff | null>(null);

/** Der Zugriff der Liedwahl. **Wirft**, wenn keiner gegeben ist – ein Fehler beim Einbau, kein Laufzeitfall. */
export function useLiedZugriff(): LiedZugriff {
  const q = useContext(LiedZugriffKontext);
  if (!q) throw new Error('Die Liedwahl braucht einen Liedzugriff (LiedZugriffKontext.Provider).');
  return q;
}
