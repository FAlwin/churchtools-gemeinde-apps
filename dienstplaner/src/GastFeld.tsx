import styles from './WerKann.module.scss';

/** Das Namensfeld für einen Gast – ein Platzhalter und eine Beschriftung für beide Stellen. */
export function GastFeld({
  wert,
  onChange,
  autoFocus = false,
}: {
  wert: string;
  onChange: (wert: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <input
      className={styles.suche}
      placeholder="z. B. Andreas Reimer"
      aria-label="Name eines Gastes"
      value={wert}
      onChange={(e) => onChange(e.target.value)}
      autoComplete="off"
      autoFocus={autoFocus}
    />
  );
}
