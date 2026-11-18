import { useId, useRef } from 'react';
import { Icon } from '../icons/icons';
import { useAufklapp } from './useAufklapp';
import { useMenueImBild } from './useMenueImBild';
import styles from './TitelWahl.module.scss';

/**
 * **Die Überschrift ist der Auswahlknopf** („Bildtechnik ▾“, Alwin 18.11.2026, Variante A): ein Tipp klappt eine Liste mit
 * allen Möglichkeiten auf, die gewählte trägt ein Häkchen, eine Wahl schließt sie. Für die Gruppenwahl der Reiter
 * (Protokolle „Sitzungen“, Organigramm „Kinder & Jugend“) – die Leiste mit einem Knopf je Gruppe (`Segment verbunden`)
 * brach nicht um und schob am Handy die ganze Seite zur Seite, und mit vielen Gruppen wird sie auch am Rechner eng.
 * Das Menü teilt sich Mechanik (`useAufklapp`) und Rand-Messung (`useMenueImBild`) mit Filter und Sortieren.
 *
 * Die Größe der Überschrift bestimmt der Aufrufer über sein `h2` – der Knopf erbt sie. Gibt es nur eine Möglichkeit,
 * ist es eine einfache Überschrift ohne Knopf.
 */
export function TitelWahl<T extends string>({
  optionen,
  wert,
  onWahl,
  titel = 'Gruppe',
}: {
  optionen: readonly { wert: T; text: string }[];
  wert: T;
  onWahl: (w: T) => void;
  /** Was gewählt wird – steht im Namen des Knopfs („Gruppe wählen: Bildtechnik“). */
  titel?: string;
}) {
  const { offen, setOffen, rahmen, menue } = useAufklapp();
  useMenueImBild(menue, offen, 'links');
  const id = useId();
  const knopf = useRef<HTMLButtonElement>(null);
  const gewaehlt = optionen.find((o) => o.wert === wert) ?? optionen[0];
  const name = gewaehlt?.text ?? '';

  if (optionen.length <= 1) return <h2>{name}</h2>;
  return (
    <div className={styles.rahmen} ref={rahmen}>
      <h2>
        <button
          ref={knopf}
          type="button"
          className={styles.knopf}
          aria-haspopup="listbox"
          aria-expanded={offen}
          aria-controls={id}
          aria-label={`${titel} wählen: ${name}`}
          onClick={() => setOffen(!offen)}
        >
          <span className={styles.name}>{name}</span>
          <Icon name="chev-down" size={18} className={offen ? styles.auf : undefined} />
        </button>
      </h2>
      {offen && (
        <div ref={menue} className={styles.menue} id={id} role="listbox" aria-label={titel}>
          {optionen.map((o) => {
            const an = o.wert === wert;
            return (
              <button
                key={o.wert}
                type="button"
                role="option"
                aria-selected={an}
                className={`${styles.option}${an ? ' ' + styles.an : ''}`}
                onClick={() => {
                  setOffen(false);
                  knopf.current?.focus();
                  if (!an) onWahl(o.wert);
                }}
              >
                <span className={styles.haken}>{an && <Icon name="check" size={16} />}</span>
                {o.text}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
