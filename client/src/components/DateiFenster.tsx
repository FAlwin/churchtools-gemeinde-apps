import { useState } from 'react';
import type { SetlistSong } from '@shared/types/index';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { ArrangementFilesSheet } from './ArrangementFilesSheet';
import { DateiUmbenennenFenster } from './DateiUmbenennenFenster';
import type { useArrangementDateien } from '../hooks/useArrangementDateien';
import { loeschFrage } from '../utils/dateiVerwaltung';
import type { NamenQuelle } from '../utils/annotationLevelLabel';
import type { ChartFenster } from '../hooks/useChartOverlay';

/**
 * **Die Fenster rund um die Dateien eines Arrangements** (#321; #845, Scheibe 4e: aus `ChordChart` herausgezogen,
 * unverändert) – die Liste mit Hochladen, Herunterladen und SongSelect, dazu die Rückfragen vor dem Holen aus
 * SongSelect und vor dem Löschen, das Umbenennen und die Warnung bei gleichem Dateinamen.
 */
export function DateiFenster({
  song,
  datei,
  overlay,
  setOverlay,
  ebenenNamen,
  canUseCcli,
}: {
  song: SetlistSong;
  datei: ReturnType<typeof useArrangementDateien>;
  overlay: ChartFenster;
  setOverlay: (o: ChartFenster) => void;
  ebenenNamen: NamenQuelle;
  canUseCcli: boolean;
}) {
  /** Rückfrage vor dem Holen aus SongSelect (#322) – es ersetzt ein vorhandenes Notenblatt. */
  const [songSelectFrage, setSongSelectFrage] = useState(false);
  return (
    <>
      {/* Dateien des Arrangements (#321). Hochladen/Löschen folgt in Schritt 4. */}
      {overlay === 'files' && (
        <ArrangementFilesSheet
          arrangementName={ebenenNamen.arrangementName(song.arrangementId)}
          files={datei.dateien.data ?? []}
          laedt={datei.dateien.isPending}
          // `paused` heißt: React Query wartet auf den Server, statt weiter zu versuchen.
          angehalten={datei.dateien.fetchStatus === 'paused'}
          fehler={
            datei.dateien.error
              ? 'Die Dateien konnten nicht geladen werden. Bitte erneut versuchen.'
              : null
          }
          laedtHoch={datei.laedtHoch}
          /**
           * Aus SongSelect holen nur, wenn beides da ist: das Recht der Gemeinde (`canUseCcli`)
           * UND eine CCLI-Nummer am Lied. Ohne die Nummer wüsste CCLI nicht, welches Lied gemeint
           * ist; ohne das Recht scheitert der Aufruf immer.
           */
          songSelect={
            canUseCcli && song.ccli
              ? { songNumber: Number(song.ccli), laeuft: datei.holtChordPro }
              : null
          }
          onDownload={(f) => void datei.herunterladen(f)}
          onUpload={datei.dateiGewaehlt}
          onDelete={datei.setLoeschDatei}
          onRename={datei.setUmbenennDatei}
          onSongSelect={() => setSongSelectFrage(true)}
          onClose={() => setOverlay(null)}
          zurueck={() => setOverlay('menu')}
        />
      )}

      {/* Die Rückfrage nennt die FOLGE: Ein vorhandenes Notenblatt wird ersetzt, und die Tonart
        kommt aus dem Arrangement (CCLI transponiert beim Herunterladen). */}
      {songSelectFrage && song.ccli && (
        <ConfirmDialog
          title="Notenblatt aus SongSelect holen?"
          message={`Für „${song.title}" (CCLI-Nummer ${song.ccli}) wird das Notenblatt bei SongSelect geholt und in „${song.arrangementName}" abgelegt – in der Tonart des Arrangements. Ein vorhandenes Notenblatt dieses Arrangements wird dabei ERSETZT; deine eigenen Versionen bleiben.`}
          confirmLabel="Holen"
          onConfirm={() => {
            setSongSelectFrage(false);
            void datei.chordProHolen(Number(song.ccli));
          }}
          onCancel={() => setSongSelectFrage(false)}
        />
      )}

      {/* Rückfrage vor dem Löschen. Bei einer flachen Liste ist dieser Text die einzige Bremse –
        deshalb nennt er die FOLGE und nicht nur „wirklich?". */}
      {datei.loeschDatei && (
        <ConfirmDialog
          title="Datei löschen?"
          message={loeschFrage(datei.loeschDatei)}
          confirmLabel="Löschen"
          onConfirm={() => void datei.loeschenBestaetigen()}
          onCancel={() => datei.setLoeschDatei(null)}
        />
      )}

      {/* Umbenennen (31.10.2026): Datei direkt in ChurchTools, Version über die Version. Fehler stehen im Fenster,
        das offen bleibt. */}
      {datei.umbenennDatei && (
        <DateiUmbenennenFenster
          datei={datei.umbenennDatei}
          benennt={datei.benennt}
          fehler={datei.umbenennFehler}
          onUmbenennen={(eingabe) => void datei.umbenennen(eingabe)}
          onZurueck={() => datei.setUmbenennDatei(null)}
          // Das X schließt alles – auch die Dateien darunter (02.11.2026).
          onClose={() => {
            datei.setUmbenennDatei(null);
            setOverlay(null);
          }}
        />
      )}

      {/* Gleicher Name: ChurchTools ersetzt nicht, es läge zweimal da. Was die richtige Datei ist,
        weiß nur der Nutzer – also Auskunft geben und ihn entscheiden lassen. */}
      {datei.uploadWarnung && (
        <ConfirmDialog
          title="Datei gibt es schon"
          message={datei.uploadWarnung.text}
          confirmLabel="Trotzdem hochladen"
          onConfirm={datei.warnungBestaetigen}
          onCancel={() => datei.setUploadWarnung(null)}
        />
      )}
    </>
  );
}
