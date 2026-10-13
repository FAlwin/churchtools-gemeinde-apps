import styles from './FilterChips.module.scss';

/**
 * **Filter zum An- und Ausschalten** – Veranstaltungen in der Termine-Liste, Veranstaltungen und Gruppen in
 * der Matrix. Gedrückt (`aria-pressed`) heißt: wird gezeigt. Eine Stelle für Aussehen und Bedienung.
 */
export function FilterChips({
  name,
  optionen,
  aus,
  onAus,
}: {
  /** Name der Gruppe für Screenreader („Veranstaltungen“, „Gruppen“). */
  name: string;
  optionen: { wert: string; text: string }[];
  /** Die ausgeschalteten Werte. */
  aus: string[];
  /** Die neue Liste der ausgeschalteten Werte nach einem Tipp. */
  onAus: (aus: string[]) => void;
}) {
  return (
    <div className={styles.chips} role="group" aria-label={name}>
      {optionen.map((o) => (
        <button
          key={o.wert || '–'}
          type="button"
          className={styles.chip}
          aria-pressed={!aus.includes(o.wert)}
          onClick={() =>
            onAus(aus.includes(o.wert) ? aus.filter((x) => x !== o.wert) : [...aus, o.wert])
          }
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}
