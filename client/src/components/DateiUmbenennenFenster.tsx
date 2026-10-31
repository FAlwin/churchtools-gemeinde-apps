/**
 * „Datei umbenennen“ (31.10.2026, Entwurf „Auswahl, Anzeige & Dateien“, Board 3).
 *
 * **Die Endung steht fest daneben**, nicht im Feld: An ihr erkennt die App die Art der Datei – wer sie wegtippt, hätte
 * aus einem PDF etwas gemacht, das die App nicht mehr anzeigt. Bei einer Version aus dem Editor steht nur ihr Name im
 * Feld; Lied-Titel, „(App)“ und Endung setzt die App selbst.
 *
 * Die Prüfung ist dieselbe Regel, die der Kern vor dem Schreiben anwendet (`umbenennPruefung` → `neuerDateiname`) –
 * das Fenster sagt es nur früher. Was ChurchTools ablehnt (Recht, gleicher Name), steht danach hier im Fenster.
 */
import { useState } from 'react';
import type { ArrangementFileEntry } from '@shared/types/index';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Sheet } from '@ui/fenster/Sheet';
import { umbenennPruefung, umbenennVorlage } from '../utils/dateiVerwaltung';
import feld from './SongFields.module.scss';
import styles from './NewSongSheet.module.scss';
import eigen from './DateiUmbenennenFenster.module.scss';

interface Props {
  datei: ArrangementFileEntry;
  /** Läuft das Umbenennen gerade? Dann ist das Fenster gesperrt. */
  benennt: boolean;
  /** Was ChurchTools (oder der Kern) abgelehnt hat. */
  fehler: string | null;
  onUmbenennen: (eingabe: string) => void;
  onClose: () => void;
}

export function DateiUmbenennenFenster({ datei, benennt, fehler, onUmbenennen, onClose }: Props) {
  const vorlage = umbenennVorlage(datei);
  const istVersion = vorlage.versionKey !== null;
  const [eingabe, setEingabe] = useState(vorlage.basis);
  const pruefung = umbenennPruefung(datei, eingabe);
  const bereit = !benennt && pruefung.fehler === null && !pruefung.gleich;
  // Den Prüf-Fehler erst zeigen, wenn man etwas getippt hat – ein Fenster, das beim Öffnen schon schimpft, wäre falsch.
  const hinweis = fehler ?? (pruefung.gleich ? null : pruefung.fehler);

  return (
    <Sheet
      title={istVersion ? 'Version umbenennen' : 'Datei umbenennen'}
      onClose={onClose}
      beschaeftigt={benennt}
      knoepfe={
        <FensterKnopf disabled={!bereit} onClick={() => onUmbenennen(eingabe)}>
          {benennt ? 'Wird umbenannt …' : 'Umbenennen'}
        </FensterKnopf>
      }
    >
      {hinweis && (
        <div className={styles.err} role="alert">
          {hinweis}
        </div>
      )}
      <form
        className={feld.field}
        onSubmit={(e) => {
          e.preventDefault();
          if (bereit) onUmbenennen(eingabe);
        }}
      >
        <label className={feld.label} htmlFor="datei-neuer-name">
          Name
        </label>
        <div className={eigen.zeile}>
          <input
            id="datei-neuer-name"
            className={`${feld.input}${vorlage.endung ? ' ' + eigen.mitEndung : ''}`}
            value={eingabe}
            maxLength={255}
            autoFocus
            disabled={benennt}
            onChange={(e) => setEingabe(e.target.value)}
          />
          {vorlage.endung && <span className={eigen.endung}>{vorlage.endung}</span>}
        </div>
      </form>
      <p className={eigen.erklaerung}>
        {istVersion
          ? 'Die Version bekommt den neuen Namen – Tonart, Aussehen und deine Anmerkungen gehen mit.'
          : 'Die Endung bleibt. Der neue Name gilt für alle – in der App und in ChurchTools.'}
      </p>
    </Sheet>
  );
}
