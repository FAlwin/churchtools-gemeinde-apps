import { useId, type ReactNode } from 'react';
import { Icon } from '../icons/icons';
import { FensterKnopf } from './FensterKnopf';
import { useKnopfZeile } from './useKnopfZeile';
import { useOverlayKeyboardInset } from './useOverlayKeyboardInset';
import styles from './Sheet.module.scss';

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Beschriftung des Abbrechen-Buttons (Standard: „Abbrechen"); `null` nur mit `knoepfe`: kein Abbrechen. */
  cancelLabel?: string | null;
  /**
   * Die Knöpfe für die Fußzeile (`FensterKnopf`), rechts neben „Abbrechen“. Wer sie reicht, bekommt den Aufbau der
   * ChurchTools-Fenster (E6-O F1, #716): Kopf mit Titel und X, unten rechts die Knöpfe. Ohne bleibt der alte Aufbau –
   * so zogen die Fenster App für App um; seit F5 nutzt ihn keins mehr (`fensterAufbau.test.ts`). Ein Fenster nur zum Ansehen oder Wählen reicht `null` – dann steht unten nur
   * der Knopf aus `cancelLabel` („Abbrechen“; zum Ansehen „Schließen“, im Baukasten „Fertig“).
   */
  knoepfe?: ReactNode;
  /**
   * Nur mit `knoepfe`: ein Knopf ganz links in der Fußzeile, abgesetzt von „Abbrechen · …“ – „Eintrag löschen“ im
   * Punkt-Fenster (E6-O O3, Entwurf B; `FensterKnopf art="loeschen"`). Steht auch im Dokument zuerst, damit Tastatur und
   * Vorleser dieselbe Reihenfolge haben wie das Auge; stehen die Knöpfe untereinander, steht er unten.
   */
  links?: ReactNode;
  /**
   * Nur mit `knoepfe`: Während etwas läuft (senden, speichern …), sperrt das Fenster X, „Abbrechen“ und den Klick
   * daneben – wie `ConfirmDialog`. Was gerade passiert, zeigt der Hauptknopf oder der Titel (E6-O F2, #720).
   */
  beschaeftigt?: boolean;
  /** Nur mit `knoepfe`: breiter (bis 760 px) – für Fenster, in denen man etwas liest, etwa ein Protokoll (S4-3a). */
  breit?: boolean;
  /** Nur mit `knoepfe`: mittelbreit (bis 560 px) – für eine Feldliste „Beschriftung | Feld“ (Punkt-Fenster, E6-O O3). */
  mittel?: boolean;
  /**
   * Was der Tipp neben das Fenster tut – ohne Angabe dasselbe wie X. Ein Fenster mit ungespeicherten Änderungen reicht
   * hier etwas, das dann nicht schließt: Ein versehentlicher Tipp daneben soll nichts verwerfen (Punkt-Fenster).
   */
  onHintergrund?: () => void;
  /**
   * `false`: ohne Einblenden – wenn ein Fenster durch ein gleiches ersetzt wird (‹ › im Punkt-Fenster), soll es nicht
   * flackern.
   */
  einblenden?: boolean;
  /**
   * Nur mit `knoepfe`: „‹“ links neben dem Titel – zurück zur vorigen Seite desselben Fensters (Unterseiten im
   * Lied-Menü, 29.10.2026). Ohne Angabe kein Pfeil.
   */
  zurueck?: () => void;
}

/**
 * Zentriertes Dialog-Fenster (Modal) mit Titel und Abbrechen-Button. **Das Fenster scrollt selbst** (bis
 * 88 % Höhe) – Inhalten darin **keine eigene Scrollfläche** geben (`max-height` + `overflow`): zwei
 * Scrollbereiche ineinander sind am Handy unbedienbar (Alwin, 14.10.2026, „Wer kann?“).
 */
export function Sheet({
  title,
  onClose,
  children,
  cancelLabel = 'Abbrechen',
  knoepfe,
  links,
  beschaeftigt = false,
  breit = false,
  mittel = false,
  onHintergrund = onClose,
  einblenden = true,
  zurueck,
}: SheetProps) {
  // Hält den Dialog über der iOS-Tastatur frei und verhindert, dass die Seite verrutscht (#207).
  const overlayRef = useOverlayKeyboardInset();
  const titelId = useId();
  const knopfZeile = useKnopfZeile<HTMLDivElement>();

  if (knoepfe !== undefined) {
    // Kopf und Fußzeile bleiben stehen, dazwischen scrollt der Inhalt – das ist die eine Scrollfläche des Fensters.
    return (
      <div
        ref={overlayRef}
        className={`${styles.overlay}${einblenden ? '' : ` ${styles.still}`}`}
        onClick={beschaeftigt ? undefined : onHintergrund}
      >
        <div
          className={`${styles.sheet} ${styles.ct}${breit ? ` ${styles.breit}` : ''}${mittel ? ` ${styles.mittel}` : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titelId}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.kopf}>
            {zurueck && (
              <button
                className={styles.zurueck}
                aria-label="Zurück"
                onClick={zurueck}
                disabled={beschaeftigt}
              >
                <Icon name="chev-left" size={20} />
              </button>
            )}
            <div id={titelId} className={styles.kopfTitel}>
              {title}
            </div>
            <button
              className={styles.x}
              aria-label="Fenster schließen"
              onClick={onClose}
              disabled={beschaeftigt}
            >
              <Icon name="x" size={20} />
            </button>
          </div>
          <div className={styles.inhalt}>{children}</div>
          <div
            ref={knopfZeile.ref}
            className={styles.fuss}
            data-stapel={knopfZeile.stapel || undefined}
          >
            {links}
            {cancelLabel !== null && (
              <FensterKnopf art="zweit" onClick={onClose} disabled={beschaeftigt}>
                {cancelLabel}
              </FensterKnopf>
            )}
            {knoepfe}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={overlayRef} className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>{title}</div>
        {children}
        <button className={styles.cancel} onClick={onClose}>
          {cancelLabel ?? 'Abbrechen'}
        </button>
      </div>
    </div>
  );
}
