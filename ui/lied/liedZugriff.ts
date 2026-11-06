import { createContext, useContext } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../ct/fehler';
import type {
  ArrangementAnsicht,
  ArrangementAuftrag,
  LiedAngelegt,
  LiedAnlegenAuftrag,
  LiedStammdaten,
  LiedStammdatenAnsicht,
  LiedtextVorschau,
  SongCategory,
  UserCapabilities,
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
  /** Lieder anlegen und ändern (`canEditSongs`) – davon hängt „Neues Lied" ab (LW1b-2). */
  liederAendern: boolean;
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

  /* ------------------------------------------------ „Neues Lied" und Liedinfo (LW1b-2, 06.11.2026) */

  /** Die Lied-Kategorien, in denen der Nutzer anlegen/ändern darf (das Recht schneidet die Liste zu). */
  kategorien(): Promise<SongCategory[]>;
  /** Legt Lied + erstes Arrangement an. */
  liedAnlegen(auftrag: LiedAnlegenAuftrag): Promise<LiedAngelegt>;
  /**
   * War der Fehler beim Anlegen einer, nach dem das Lied **vielleicht doch** angelegt ist (z. B. eine Zeitüberschreitung
   * auf dem Rückweg)? Dann sagt die Oberfläche „bitte erst in der Liederliste nachsehen" statt „nochmal versuchen" –
   * ein zweiter Versuch legte ein zweites Lied an. Welche Fehler das sind, weiß nur die App (Musik-App: 502).
   */
  anlegenUngewiss(fehler: unknown): boolean;
  /** Holt das Notenblatt aus SongSelect und legt es am Arrangement ab. */
  notenblattAusSongSelect(songId: number, arrangementId: number, songNumber: number): Promise<void>;
  /** Der ChordPro-Text des Original-Notenblatts – `null`, wenn es keins gibt. */
  notenblattLesen(songId: number, arrangementId: number): Promise<string | null>;
  /** Speichert den Text als Original-Notenblatt. */
  notenblattSpeichern(songId: number, arrangementId: number, text: string): Promise<void>;
  stammdaten(songId: number): Promise<LiedStammdatenAnsicht>;
  liedAendern(songId: number, aenderung: Partial<LiedStammdaten>): Promise<LiedStammdatenAnsicht>;
  arrangements(songId: number): Promise<ArrangementAnsicht[]>;
  arrangementAendern(
    songId: number,
    arrangementId: number,
    auftrag: ArrangementAuftrag,
  ): Promise<ArrangementAnsicht>;
  /**
   * Was **die App selbst** nach einer Änderung neu laden muss – zusätzlich zu dem, was `liedDaten.ts` für alle erneuert
   * (Liederliste, Stammdaten, Arrangements). Die Musik-App: ihre Liedblätter, Abläufe, Arrangement-Auswahl; der
   * Dienstplaner hat andere Zwischenspeicher. Ohne diesen Schritt zeigte eine App einen Stand, den es nicht mehr gibt.
   */
  nachAenderung(qc: QueryClient, anlass: LiedAenderungsAnlass): void;
}

/**
 * Die Lied-Rechte aus den ChurchTools-Rechten (`rechteAus` in `@shared/ct/rechte`) – **eine** Übersetzung für Musik-App
 * und Dienstplaner (LW2b, 06.11.2026).
 */
export function liedRechteAus(
  c: Pick<UserCapabilities, 'canViewSongStatistics' | 'canUseCcli' | 'canEditSongs'>,
): LiedRechte {
  return {
    statistik: c.canViewSongStatistics ?? false,
    ccli: c.canUseCcli ?? false,
    liederAendern: c.canEditSongs ?? false,
  };
}

/**
 * War der Fehler beim Anlegen einer, nach dem das Lied **vielleicht doch** steht? Ein 502 heißt hier „ChurchTools hat
 * nicht (vollständig) geantwortet“ – z. B. Lied angelegt, Arrangement nicht (#322). Für alle Apps, die ChurchTools über
 * `ApiError` ansprechen.
 */
export function anlegenUngewissAus(fehler: unknown): boolean {
  return fehler instanceof ApiError && fehler.status === 502;
}

/** Der Text des Original-Notenblatts aus einem Liedblatt – ohne Text gibt es keins (`null`). */
export function notenblattTextAus(blatt: { chordpro?: string | null }): string | null {
  return blatt.chordpro || null;
}

/** Wodurch sich etwas an einem Lied geändert hat – danach richtet sich, was die App neu lädt. */
export interface LiedAenderungsAnlass {
  art: 'lied' | 'arrangement' | 'notenblatt';
  songId: number;
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
