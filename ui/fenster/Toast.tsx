import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BEREICH_ATTRIBUT } from '../erweiterung/cssBereich';
import styles from './Toast.module.scss';

// useToast lebt in `useToast.ts` daneben (getrennt, damit diese Datei nur Komponenten exportiert). Seit
// 14.10.2026 in `ui/` – der Dienstplaner braucht denselben Hinweis (E4-3); vorher nur in der Musik-App.

/** Ein Knopf im Hinweis – etwa „Rückgängig" nach dem Löschen eines Ablaufpunkts (12.10.2026). */
export interface ToastAktion {
  label: string;
  onClick: () => void;
}

/**
 * Der kleine dunkle Hinweis unten.
 *
 * **Hängt per Portal an `body`** (12.10.2026): Mitten im Inhalt gezeichnet, saß er oben statt unten –
 * der Bereich für „Zum Aktualisieren nach unten ziehen" verschiebt per `transform`, und daran richtet
 * sich ein `position: fixed` dann aus statt am Fenster. `BEREICH_ATTRIBUT` sorgt wie bei den Coachmarks
 * dafür, dass in der ChurchTools-Erweiterung unsere Stilregeln auch außerhalb von `#root` gelten.
 */
export function Toast({ message, aktion }: { message: ReactNode; aktion?: ToastAktion }) {
  if (!message) return null;
  return createPortal(
    <div
      className={`${styles.toast}${aktion ? ` ${styles.mitAktion}` : ''}`}
      role="status"
      {...{ [BEREICH_ATTRIBUT]: '' }}
    >
      <span>{message}</span>
      {aktion && (
        <button type="button" className={styles.aktion} onClick={aktion.onClick}>
          {aktion.label}
        </button>
      )}
    </div>,
    document.body,
  );
}
