import { useId } from 'react';
import { Icon, type IconName } from '../icons/icons';
import { useAufklapp } from './useAufklapp';
import styles from './FilterKnopf.module.scss';

/**
 * **Ein Knopf mit Menü für EINE Wahl** (Protokolle S7-3: „Sortieren“) – Bauart und Aussehen wie der `FilterKnopf`
 * (dieselben Stile), nur mit Auswahlpunkten statt Häkchen. Der Knopf nennt die Wahl, wenn sie nicht die Vorgabe ist,
 * und ist dann blau getönt wie ein Filter, der etwas ausblendet.
 */
export function WahlKnopf<T extends string>({
  titel,
  icon,
  optionen,
  wert,
  vorgabe,
  onWahl,
}: {
  titel: string;
  icon: IconName;
  optionen: readonly { wert: T; text: string }[];
  wert: T;
  vorgabe: T;
  onWahl: (w: T) => void;
}) {
  const { offen, setOffen, rahmen } = useAufklapp();
  const id = useId();
  const gewaehlt = optionen.find((o) => o.wert === wert);
  const anders = wert !== vorgabe;
  return (
    <div className={styles.rahmen} ref={rahmen}>
      <button
        type="button"
        className={`${styles.knopf}${anders ? ' ' + styles.aktiv : ''}`}
        aria-expanded={offen}
        aria-controls={id}
        aria-label={`${titel}: ${gewaehlt?.text ?? ''}`}
        onClick={() => setOffen(!offen)}
      >
        <Icon name={icon} size={15} />
        {anders && gewaehlt ? gewaehlt.text : titel}
      </button>
      {offen && (
        <div className={styles.menue} id={id} role="dialog" aria-label={titel}>
          <fieldset className={styles.abschnitt}>
            <legend>{titel}</legend>
            {optionen.map((o) => (
              <label key={o.wert} className={styles.zeile}>
                <input
                  type="radio"
                  name={id}
                  checked={o.wert === wert}
                  onChange={() => {
                    onWahl(o.wert);
                    setOffen(false);
                  }}
                />
                {o.text}
              </label>
            ))}
          </fieldset>
        </div>
      )}
    </div>
  );
}
