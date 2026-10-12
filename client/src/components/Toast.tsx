import styles from './Toast.module.scss';

// useToast lebt in `hooks/useToast.ts` (getrennt, damit diese Datei nur Komponenten exportiert).

/** Ein Knopf im Hinweis – etwa „Rückgängig" nach dem Löschen eines Ablaufpunkts (12.10.2026). */
export interface ToastAktion {
  label: string;
  onClick: () => void;
}

export function Toast({ message, aktion }: { message: string | null; aktion?: ToastAktion }) {
  if (!message) return null;
  return (
    <div className={`${styles.toast}${aktion ? ` ${styles.mitAktion}` : ''}`} role="status">
      <span>{message}</span>
      {aktion && (
        <button type="button" className={styles.aktion} onClick={aktion.onClick}>
          {aktion.label}
        </button>
      )}
    </div>
  );
}
