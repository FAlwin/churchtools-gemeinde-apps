/**
 * **Was die Reihe-Blöcke wissen müssen** (Baustein „Reihe“) – BlockNote zeichnet die Blöcke im React-Baum des Editors,
 * deshalb reicht ein Kontext vom Bildschirm (`ReiheAnbieter`) bis in die Blöcke und die Lese-Ansicht. Die Fenster hängen
 * **nicht** im Editor-Baum, sondern im Anbieter daneben (React-Ereignisse laufen auch durch Portale bis in den Editor).
 *
 * Zwei Kontexte: `ReiheBasis` kommt einmal von der App (wer ich bin, welche Gruppen, welche Rechte), `ReiheKontext` je
 * Protokoll vom Anbieter (die geladenen Reihen und die Fenster). **Ohne `ReiheKontext`** (Tests, Vorschau) zeigen die Blöcke
 * die Reihe nur an, ohne Knöpfe.
 */
import { createContext } from 'react';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import type { Themenreihe } from '@shared/protokolle/themenreihe';

export interface ReiheBasisWert {
  modul: number;
  gruppen: readonly ProtokollGruppe[];
  /** `Start.schreibbar` – für `darfSchreibenIn`. */
  schreibbar: readonly number[];
  ich: { person: number; name: string };
  /** Kalender mit „edit events“ (`Start.eventsAendern`, aus `/permissions/global` – `eventInfosKalender`; `null` = alle) – für `darfTerminAendern`. */
  eventKalender: readonly number[] | null;
  /** Kalender, in denen man Termine **und** Events anlegen darf (`kalenderMitEvents`) – für „Event neu anlegen“ in der Reihe. */
  eventAnlegen: readonly number[];
}

export const ReiheBasis = createContext<ReiheBasisWert | null>(null);

export type ReiheStand = 'leer' | 'laedt' | 'fertig' | 'fehler';

export interface ReiheKontextWert {
  reihen: ReadonlyMap<string, Themenreihe>;
  stand: ReiheStand;
  /** Darf hier Reihen bauen und bearbeiten (`darfSchreibenIn` in dieser Gruppe)? */
  darfBauen: boolean;
  bearbeiten: (id: string) => void;
  uebertragen: (id: string) => void;
  /**
   * Eine neue Reihe: das Fenster geht mit einer **schon vergebenen ID** auf (ein zweiter Versuch legt nichts doppelt an).
   * Erst nach dem Speichern ruft es `fertig(id)` – dort setzt der Editor den Block ein. Wird das Fenster ohne Speichern
   * geschlossen, entsteht kein Block (und nichts bleibt im Dokument zurück).
   */
  neu: (fertig: (id: string) => void) => void;
  /** Neu laden (nach „Erneut versuchen“). */
  neuLaden: () => void;
}

export const ReiheKontext = createContext<ReiheKontextWert | null>(null);
