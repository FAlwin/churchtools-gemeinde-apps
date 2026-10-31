/**
 * Die Dateiverwaltung eines Arrangements: laden, hochladen, löschen (#321, Schritt 4).
 *
 * **Warum als Hook und nicht inline in `ChordChart`:** Die Reihenfolge „erst melden, dann
 * auffrischen" ist eine Regel, die man testen können muss – siehe unten. Inline in einer Seite mit
 * über 800 Zeilen wäre sie nur durch Anklicken prüfbar, und genau dort ist sie mir schon einmal
 * durchgegangen.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ArrangementFileEntry } from '@shared/types/index';
import {
  deleteSongFile,
  getArrangementFiles,
  getSongFileBlob,
  holeChordProAusSongSelect,
  renameArrangementFile,
  updateVersion,
  uploadArrangementFile,
} from '../services/churchtoolsApi';
import { umbenannteVersionMitnehmen } from '../services/versionUmbenannt';
import { shareOrDownload } from '@ui/teilen/shareFile';
import { pruefeUpload, umbenennVorlage } from '../utils/dateiVerwaltung';
import { schluessel } from './abfrageSchluessel';

interface Args {
  songId: number;
  arrangementId: number;
  /** Nur laden, wenn das Blatt offen ist – sonst ein Abruf gegen ChurchTools für nichts (#300). */
  aktiv: boolean;
  showToast: (text: string) => void;
  /** Das Lied neu holen, damit ein neues PDF auch im Menü unter „Anzeige" auftaucht. */
  onReload?: () => void;
  /** Die gerade gezeigte Version – wird SIE umbenannt, zeigt das Blatt danach die Version unter neuem Namen. */
  versionKey?: string;
  selectVersion?: (songId: number, versionKey: string) => void;
}

export function useArrangementDateien({
  songId,
  arrangementId,
  aktiv,
  showToast,
  onReload,
  versionKey,
  selectVersion,
}: Args) {
  const qc = useQueryClient();
  const [laedtHoch, setLaedtHoch] = useState(false);
  /** Datei, deren Löschung nachgefragt wird – `null` = keine Rückfrage offen. */
  const [loeschDatei, setLoeschDatei] = useState<ArrangementFileEntry | null>(null);
  /** Ausgewählte Datei, deren Doppel-Warnung noch bestätigt werden muss. */
  const [uploadWarnung, setUploadWarnung] = useState<{ datei: File; text: string } | null>(null);

  const dateien = useQuery({
    queryKey: schluessel.arrangementDateien(songId, arrangementId),
    queryFn: () => getArrangementFiles(songId, arrangementId),
    enabled: aktiv,
    staleTime: 1000 * 30,
  });

  /**
   * Liste und Lied auffrischen – **ohne `await`, und das ist der Kern dieser Datei.**
   *
   * Gefunden beim Durchklicken (11.08.2026): Stand hier `await qc.invalidateQueries(...)` vor der
   * Erfolgsmeldung, blieb nach einem erfolgreichen Löschen **jede Rückmeldung aus**. Grund ist
   * dieselbe Mechanik wie beim Laden: Gilt der Server als unerreichbar, **hält React Query das
   * Nachladen an** – und das Versprechen von `invalidateQueries` wird dann nie erfüllt. Der `await`
   * hing also für immer, und die Zeile mit der Meldung wurde nie erreicht.
   *
   * Richtig ist die Reihenfolge ohnehin: Gemeldet wird, was **passiert ist** (das Löschen war
   * erfolgreich). Das Auffrischen der Anzeige ist eine Bequemlichkeit danach – es darf die Nachricht
   * über den Erfolg nicht aufhalten und schon gar nicht verschlucken.
   */
  const auffrischen = (): void => {
    void qc.invalidateQueries({ queryKey: schluessel.arrangementDateien(songId, arrangementId) });
    onReload?.();
  };

  const herunterladen = async (f: ArrangementFileEntry): Promise<void> => {
    try {
      await shareOrDownload(await getSongFileBlob(songId, f.fileId), f.name);
    } catch {
      showToast('Die Datei konnte nicht geladen werden.');
    }
  };

  const hochladen = async (datei: File): Promise<void> => {
    setLaedtHoch(true);
    try {
      await uploadArrangementFile(songId, arrangementId, datei);
      showToast(`„${datei.name}" wurde hinzugefügt.`);
      auffrischen();
    } catch (e) {
      // Der Grund kommt vom Server (z. B. „Keine Berechtigung …"), nicht als allgemeines „hat nicht
      // geklappt": Nur so weiß man, ob es am Recht, an der Datei oder am Netz lag (#270).
      showToast(e instanceof Error ? e.message : 'Das Hochladen ist fehlgeschlagen.');
    } finally {
      setLaedtHoch(false);
    }
  };

  /** Eine ausgewählte Datei annehmen: prüfen, dann hochladen oder nachfragen. */
  const dateiGewaehlt = (datei: File): void => {
    const befund = pruefeUpload(datei, dateien.data ?? []);
    if (befund?.art === 'fehler') {
      showToast(befund.text);
      return;
    }
    if (befund?.art === 'warnung') {
      setUploadWarnung({ datei, text: befund.text });
      return;
    }
    void hochladen(datei);
  };

  const warnungBestaetigen = (): void => {
    const datei = uploadWarnung?.datei;
    setUploadWarnung(null);
    if (datei) void hochladen(datei);
  };

  /**
   * Das Notenblatt aus SongSelect holen (#322).
   *
   * **Ersetzt** ein vorhandenes Original-ChordPro – deshalb fragt die Oberfläche vorher, und deshalb
   * steht die Folge im Text der Rückfrage. Der Server erledigt die Reihenfolge (erst holen, dann das
   * alte löschen); hier zählt nur, dass ein Fehlschlag **benannt** wird.
   */
  const [holtChordPro, setHoltChordPro] = useState(false);
  const chordProHolen = async (songNumber: number): Promise<void> => {
    setHoltChordPro(true);
    try {
      await holeChordProAusSongSelect(songId, arrangementId, songNumber);
      showToast('Notenblatt aus SongSelect geholt.');
      auffrischen();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Das Holen aus SongSelect ist fehlgeschlagen.');
    } finally {
      setHoltChordPro(false);
    }
  };

  const loeschenBestaetigen = async (): Promise<void> => {
    const f = loeschDatei;
    setLoeschDatei(null);
    if (!f) return;
    try {
      await deleteSongFile(songId, f.fileId);
      showToast(`„${f.name}" wurde gelöscht.`);
      auffrischen();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Das Löschen ist fehlgeschlagen.');
    }
  };

  /** Datei im Fenster „Umbenennen“ – `null` = Fenster zu. */
  const [umbenennDatei, setUmbenennDateiRoh] = useState<ArrangementFileEntry | null>(null);
  const [benennt, setBenennt] = useState(false);
  /** Warum es nicht ging – steht IM Fenster, das offen bleibt: So kann man den Namen gleich verbessern. */
  const [umbenennFehler, setUmbenennFehler] = useState<string | null>(null);
  const setUmbenennDatei = (f: ArrangementFileEntry | null): void => {
    setUmbenennFehler(null);
    setUmbenennDateiRoh(f);
  };

  /**
   * Umbenennen (31.10.2026) – **zwei Wege, je nach Art.**
   *
   * Eine Datei (PDF, Bild, Original-ChordPro) bekommt in ChurchTools direkt einen neuen Namen; ID und Inhalt bleiben,
   * und mit der ID bleiben gewählte Anzeige und PDF-Anmerkungen. Eine **Version** dagegen geht über `updateVersion` wie
   * beim Speichern im Editor: Ihr Name steckt im Schlüssel, und Aussehen und Anmerkungen ziehen mit um
   * (`umbenannteVersionMitnehmen`). Ist es die gerade gezeigte, zeigt das Blatt sie danach unter dem neuen Schlüssel –
   * sonst fiele es auf das Original zurück.
   */
  const umbenennen = async (eingabe: string): Promise<void> => {
    const f = umbenennDatei;
    if (!f) return;
    setBenennt(true);
    setUmbenennFehler(null);
    try {
      const alt = umbenennVorlage(f).versionKey;
      if (alt !== null) {
        const v = await updateVersion(songId, arrangementId, alt, { name: eingabe.trim() });
        umbenannteVersionMitnehmen(songId, alt, v.key);
        if (versionKey === alt) selectVersion?.(songId, v.key);
        showToast(`Version heißt jetzt „${v.name}".`);
      } else {
        const liste = await renameArrangementFile(songId, arrangementId, f.fileId, eingabe);
        const neu = liste.find((d) => d.fileId === f.fileId)?.name ?? eingabe;
        showToast(`Datei heißt jetzt „${neu}".`);
      }
      setUmbenennDateiRoh(null);
      auffrischen();
    } catch (e) {
      setUmbenennFehler(e instanceof Error ? e.message : 'Das Umbenennen ist fehlgeschlagen.');
    } finally {
      setBenennt(false);
    }
  };

  return {
    dateien,
    umbenennDatei,
    setUmbenennDatei,
    benennt,
    umbenennFehler,
    umbenennen,
    laedtHoch,
    loeschDatei,
    setLoeschDatei,
    uploadWarnung,
    setUploadWarnung,
    herunterladen,
    holtChordPro,
    chordProHolen,
    dateiGewaehlt,
    warnungBestaetigen,
    loeschenBestaetigen,
  };
}
