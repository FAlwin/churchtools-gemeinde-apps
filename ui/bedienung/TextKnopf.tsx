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
  titel,
  ariaLabel,
  kompakt = false,
}: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  dataTour?: string;
  /** Tooltip – z. B. der ganze Text, wenn der Inhalt gekürzt ist (Predigtserie im Spaltenkopf). */
  titel?: string;
  /** Name für Screenreader, wenn der Inhalt allein nicht sagt, was der Knopf tut. */
  ariaLabel?: string;
  /**
   * Ohne Mindesthöhe und Rand – für ein Wort mitten in einem Kopf, der nicht wachsen darf (Predigtserie im Spaltenkopf der
   * Matrix, nur am Rechner/iPad). Am Handy bleibt die 40-px-Fläche die Regel.
   */
  kompakt?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${styles.knopf}${kompakt ? ` ${styles.kompakt}` : ''}`}
      onClick={onClick}
      disabled={disabled}
      data-tour={dataTour}
      title={titel}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
