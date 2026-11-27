import type { ReactNode } from 'react';
import { Schalter } from './Schalter';
import styles from './SchalterKnopf.module.scss';

/**
 * **Eine Zeile mit Schalter** (Nachweise je Veranstaltung, N3b): links die Beschriftung, rechts der Schalter (`Schalter`) –
 * die ganze Zeile ist der Knopf. Er trägt `aria-pressed` und die Beschriftung; der Schalter selbst ist nur Anzeige. Liegt in
 * `ui/`, damit die Erweiterungen keinen weiteren eigenen `<button>` bekommen (Obergrenze in `bedienKnoepfe.test.ts`).
 */
export function SchalterKnopf({
  an,
  onClick,
  disabled,
  children,
}: {
  an: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={styles.zeile}
      aria-pressed={an}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
      <Schalter an={an} />
    </button>
  );
}
