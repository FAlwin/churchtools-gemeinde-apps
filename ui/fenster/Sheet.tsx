import { useId, type ReactNode } from 'react';
import { Icon } from '../icons/icons';
import { FensterKnopf } from './FensterKnopf';
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
   * so ziehen die Fenster App für App um.
   */
  knoepfe?: ReactNode;
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
}: SheetProps) {
  // Hält den Dialog über der iOS-Tastatur frei und verhindert, dass die Seite verrutscht (#207).
  const overlayRef = useOverlayKeyboardInset();
  const titelId = useId();

  if (knoepfe !== undefined) {
    // Kopf und Fußzeile bleiben stehen, dazwischen scrollt der Inhalt – das ist die eine Scrollfläche des Fensters.
    return (
      <div ref={overlayRef} className={styles.overlay} onClick={onClose}>
        <div
          className={`${styles.sheet} ${styles.ct}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titelId}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.kopf}>
            <div id={titelId} className={styles.kopfTitel}>
              {title}
            </div>
            <button className={styles.x} aria-label="Schließen" onClick={onClose}>
              <Icon name="x" size={20} />
            </button>
          </div>
          <div className={styles.inhalt}>{children}</div>
          <div className={styles.fuss}>
            {cancelLabel !== null && (
              <FensterKnopf art="zweit" onClick={onClose}>
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
