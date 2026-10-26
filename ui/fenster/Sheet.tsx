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
   * so ziehen die Fenster App für App um. Ein Fenster nur zum Ansehen oder Wählen reicht `null` – dann steht unten nur
   * der Knopf aus `cancelLabel` („Abbrechen“; zum Ansehen „Schließen“, im Baukasten „Fertig“).
   */
  knoepfe?: ReactNode;
  /**
   * Nur mit `knoepfe`: Während etwas läuft (senden, speichern …), sperrt das Fenster X, „Abbrechen“ und den Klick
   * daneben – wie `ConfirmDialog`. Was gerade passiert, zeigt der Hauptknopf oder der Titel (E6-O F2, #720).
   */
  beschaeftigt?: boolean;
  /** Nur mit `knoepfe`: breiter (bis 760 px) – für Fenster, in denen man etwas liest, etwa ein Protokoll (S4-3a). */
  breit?: boolean;
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
  beschaeftigt = false,
  breit = false,
}: SheetProps) {
  // Hält den Dialog über der iOS-Tastatur frei und verhindert, dass die Seite verrutscht (#207).
  const overlayRef = useOverlayKeyboardInset();
  const titelId = useId();
  const knopfZeile = useKnopfZeile<HTMLDivElement>();

  if (knoepfe !== undefined) {
    // Kopf und Fußzeile bleiben stehen, dazwischen scrollt der Inhalt – das ist die eine Scrollfläche des Fensters.
    return (
      <div ref={overlayRef} className={styles.overlay} onClick={beschaeftigt ? undefined : onClose}>
        <div
          className={`${styles.sheet} ${styles.ct}${breit ? ` ${styles.breit}` : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titelId}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.kopf}>
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
