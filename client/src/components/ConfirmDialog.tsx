import styles from './ConfirmDialog.module.scss';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** `true`: die Bestätigung zerstört nichts (blau statt rot), z. B. „Teilen". */
  harmlos?: boolean;
}

/** Bestätigungs-Dialog – für destruktive Aktionen (rot) oder, mit `harmlos`, für einen zweiten Schritt. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Abbrechen',
  onConfirm,
  onCancel,
  harmlos = false,
}: ConfirmDialogProps) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>{title}</div>
        <div className={styles.msg}>{message}</div>
        <div className={styles.actions}>
          <button className={`${styles.btn} ${styles.cancel}`} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`${styles.btn} ${harmlos ? styles.primary : styles.danger}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
