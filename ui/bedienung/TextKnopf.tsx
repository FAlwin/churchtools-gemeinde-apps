import type { ReactNode } from 'react';
import styles from './TextKnopf.module.scss';

/**
 * **Ein stiller Knopf als blaues Wort** (R2 „Still“, Entwurf „Restliche Bildschirme“ B4): „Weitere Wochen laden“ unter einer
 * Liste, „Alle Termine zeigen“ in einem leeren Zustand – ein Nebenweg, der nicht wie ein Knopf aussieht und nichts
 * Lautes neben den Inhalt stellt. Blaue, fette Schrift ohne Rand und Fläche (`m.textKnopf`), erst beim Darüberfahren
 * (nur Maus) unterstrichen. Ein `KopfKnopf` taugt dafür nicht: Er zeigt am Handy nur sein Symbol.
 */
export function TextKnopf({
  onClick,
  children,
  disabled,
  dataTour,
}: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  dataTour?: string;
}) {
  return (
    <button
      type="button"
      className={styles.knopf}
      onClick={onClick}
      disabled={disabled}
      data-tour={dataTour}
    >
      {children}
    </button>
  );
}
