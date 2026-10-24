import { useId, type ReactNode } from 'react';
import { Icon } from '../icons/icons';
import { FensterKnopf } from './FensterKnopf';
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
   * Ein zweiter Weg neben der Bestätigung (E6-5b: „Nur für diesen Termin neu“). Er steht zwischen Abbrechen und
   * Bestätigung. Am Handy stehen alle Knöpfe untereinander, die Bestätigung oben (`m.fensterKnopfZeile`).
   */
  zweit?: { label: string; onClick: () => void };
  /** Zwischen Text und Knöpfen – etwa die Termine, die es mittrifft. */
  children?: ReactNode;
  /** Kleiner Text unter den Knöpfen. */
  fuss?: string;
  /** Läuft gerade: Knöpfe gesperrt, damit nichts doppelt geschrieben wird. */
  beschaeftigt?: boolean;
}

/**
 * Bestätigungs-Dialog – für destruktive Aktionen (rot) oder, mit `harmlos`, für einen zweiten Schritt. Aufbau wie die
 * ChurchTools-Fenster (E6-O F1, #716): Titel links, X rechts, Knöpfe rechts unten. Ohne Abbrechen gibt es auch kein X –
 * dann ist nur noch eine Meldung zu bestätigen.
 */
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
  const titelId = useId();
  return (
    <div className={styles.overlay} onClick={beschaeftigt ? undefined : onCancel}>
      <div
        className={styles.card}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titelId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.kopf}>
          <div id={titelId} className={styles.title}>
            {title}
          </div>
          {cancelLabel !== null && (
            <button
              className={styles.x}
              aria-label="Fenster schließen"
              onClick={onCancel}
              disabled={beschaeftigt}
            >
              <Icon name="x" size={20} />
            </button>
          )}
        </div>
        <div className={styles.msg}>{message}</div>
        {children}
        <div className={styles.actions}>
          {cancelLabel !== null && (
            <FensterKnopf art="zweit" onClick={onCancel} disabled={beschaeftigt}>
              {cancelLabel}
            </FensterKnopf>
          )}
          {zweit && (
            <FensterKnopf art="hell" onClick={zweit.onClick} disabled={beschaeftigt}>
              {zweit.label}
            </FensterKnopf>
          )}
          <FensterKnopf
            art={harmlos ? 'haupt' : 'gefahr'}
            onClick={onConfirm}
            disabled={beschaeftigt}
          >
            {confirmLabel}
          </FensterKnopf>
        </div>
        {fuss && <p className={styles.fuss}>{fuss}</p>}
      </div>
    </div>
  );
}
