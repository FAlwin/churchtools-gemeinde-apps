import type { ReactNode } from 'react';
import styles from './ConfirmDialog.module.scss';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  /** `null`: kein Abbrechen – etwa, wenn nur noch eine Meldung zu bestätigen ist. */
  cancelLabel?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  /** `true`: die Bestätigung zerstört nichts (blau statt rot), z. B. „Teilen". */
  harmlos?: boolean;
  /**
   * Ein zweiter Weg neben der Bestätigung (E6-5b: „Nur für diesen Termin neu“). Dann stehen die Knöpfe untereinander:
   * Bestätigung, zweiter Weg, Abbrechen.
   */
  zweit?: { label: string; onClick: () => void };
  /** Zwischen Text und Knöpfen – etwa die Termine, die es mittrifft. */
  children?: ReactNode;
  /** Kleiner Text unter den Knöpfen. */
  fuss?: string;
  /** Läuft gerade: Knöpfe gesperrt, damit nichts doppelt geschrieben wird. */
  beschaeftigt?: boolean;
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
  zweit,
  children,
  fuss,
  beschaeftigt = false,
}: ConfirmDialogProps) {
  const abbrechen = cancelLabel !== null && (
    <button className={`${styles.btn} ${styles.cancel}`} onClick={onCancel} disabled={beschaeftigt}>
      {cancelLabel}
    </button>
  );
  const bestaetigen = (
    <button
      className={`${styles.btn} ${harmlos ? styles.primary : styles.danger}`}
      onClick={onConfirm}
      disabled={beschaeftigt}
    >
      {confirmLabel}
    </button>
  );
  return (
    <div className={styles.overlay} onClick={beschaeftigt ? undefined : onCancel}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>{title}</div>
        <div className={styles.msg}>{message}</div>
        {children}
        {zweit ? (
          <div className={styles.stapel}>
            {bestaetigen}
            <button
              className={`${styles.btn} ${styles.zweit}`}
              onClick={zweit.onClick}
              disabled={beschaeftigt}
            >
              {zweit.label}
            </button>
            {abbrechen}
          </div>
        ) : (
          <div className={styles.actions}>
            {abbrechen}
            {bestaetigen}
          </div>
        )}
        {fuss && <p className={styles.fuss}>{fuss}</p>}
      </div>
    </div>
  );
}
