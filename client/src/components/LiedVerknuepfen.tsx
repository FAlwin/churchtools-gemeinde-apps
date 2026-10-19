import { useState } from 'react';
import type { SongSelectTreffer } from '@shared/types/index';
import type { LiedWahlArgs } from '@ui/ablauf/PunktFenster';
import { useOverlayKeyboardInset } from '@ui/fenster/useOverlayKeyboardInset';
import styles from '@ui/ablauf/PunktFenster.module.scss';
import { SongPicker } from './SongPicker';
import { NewSongSheet } from './NewSongSheet';
import { useCapabilities } from '../hooks/useServices';

/**
 * **„Lied verknüpfen" der Musik-App** – die Liedwahl, die sie ins gemeinsame Punkt-Fenster (`ui/ablauf/PunktFenster`)
 * steckt (E6-2b-2/3; vorher Unterdialog in `ItemActionSheet`). Liedsuche, und mit dem Recht, Lieder zu bearbeiten,
 * der Anlege-Weg (#391) – „Neues Lied" (der Suchbegriff wird zum Titel) oder ein SongSelect-Treffer. Der Dienstplaner
 * steckt nichts ein: Dort werden Lieder nur angezeigt.
 */
export function LiedVerknuepfen({
  onGewaehlt,
  onAbbrechen,
  onHintergrund,
  fehler,
  busy,
}: LiedWahlArgs) {
  const canEditSongs = useCapabilities(true).data?.canEditSongs ?? false;
  const [neuesLied, setNeuesLied] = useState<{ treffer?: SongSelectTreffer; name?: string } | null>(
    null,
  );
  // Dialog über der iOS-Tastatur freihalten; verhindert auch die verrutschte Kopfleiste (#207).
  const overlayRef = useOverlayKeyboardInset();

  // Unterdialog: ein neues Lied anlegen und mit DIESEM Punkt verknüpfen. Bewusst ohne `eventId`: Das
  // Lied darf nicht als neuer Punkt in den Ablauf, es gehört in den vorhandenen. Die Verknüpfung wird
  // wie eine Auswahl aus der Suche nur vorgemerkt – geschrieben wird erst mit „Speichern"
  // (Entscheidung Alwin, 18.09.2026: ein Fenster, ein Speicherweg).
  if (neuesLied) {
    return (
      <NewSongSheet
        startTreffer={neuesLied.treffer}
        startName={neuesLied.name}
        onClose={() => setNeuesLied(null)}
        onVerknuepfen={onGewaehlt}
        /* Gibt es das Lied schon (gleiche CCLI-Nummer), wird es vorgemerkt wie eine Auswahl aus der
           Suche – geschrieben wird auch hier erst mit „Speichern" (#395). */
        onVorhandenes={(song) => onGewaehlt(song.arrangementId, song.name)}
      />
    );
  }

  return (
    <div ref={overlayRef} className={styles.overlay} onClick={onHintergrund}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>Lied verknüpfen</div>
        {fehler && <div className={styles.err}>{fehler}</div>}
        <SongPicker
          autoFocus
          aktionLabel="Mit diesem Eintrag verknüpfen"
          onPick={onGewaehlt}
          neuesLied={
            canEditSongs
              ? { label: 'Neues Lied', onClick: (name) => setNeuesLied({ name }) }
              : undefined
          }
          /* Ohne das Recht, Lieder zu bearbeiten, erscheint SongSelect gar nicht –
             ein Treffer, aus dem nichts werden kann, wäre eine Sackgasse (#378). */
          onSongSelectTreffer={canEditSongs ? (treffer) => setNeuesLied({ treffer }) : undefined}
        />
        {/* „Abbrechen", nicht „Zurück" (Entscheidung Alwin, 04.09.2026): Dieser Knopf verlässt die
            Suche ganz. Zur Trefferliste zurück führt der Pfeil oben in der Vorschau – zwei Knöpfe
            mit demselben Wort und verschiedenen Zielen hatten in die Irre geführt. */}
        <button className={styles.backBtn} onClick={onAbbrechen} disabled={busy}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
