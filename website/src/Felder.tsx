import { useId, useState, type ReactNode } from 'react';
import styles from './Fenster.module.scss';

/** Ein Feld mit Beschriftung und – wenn nötig – Erklärung darunter. */
export function Feld({
  label,
  hilfe,
  children,
}: {
  label: string;
  hilfe?: ReactNode;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={styles.feld}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hilfe && <p className={styles.unterText}>{hilfe}</p>}
    </div>
  );
}

/** Eine Gruppe von Knöpfen (Segment) mit Beschriftung – ohne einzelnes Feld, darum keine `label`-Verknüpfung. */
export function Gruppe({
  label,
  hilfe,
  children,
}: {
  label: string;
  hilfe?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.feld} role="group" aria-label={label}>
      <span>{label}</span>
      {children}
      {hilfe && <p className={styles.unterText}>{hilfe}</p>}
    </div>
  );
}

export function Haken({
  an,
  onChange,
  children,
}: {
  an: boolean;
  onChange: (an: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className={styles.haken}>
      <input type="checkbox" checked={an} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

/** Eine Liste ganzer Zahlen („3, 7, 12“) – der Text bleibt beim Tippen stehen, das Modell bekommt nur Gültiges. */
export function ZahlenListe({
  label,
  hilfe,
  wert,
  onChange,
}: {
  label: string;
  hilfe?: ReactNode;
  wert: readonly number[];
  onChange: (zahlen: number[]) => void;
}) {
  const [text, setText] = useState(wert.join(', '));
  const teile = text
    .split(/[,\s;]+/)
    .map((t) => t.trim())
    .filter((t) => t !== '');
  const gueltig = teile.every((t) => /^\d+$/.test(t));
  return (
    <Feld
      label={label}
      hilfe={
        gueltig ? (
          hilfe
        ) : (
          <span role="alert" className={styles.fehler}>
            Nur Zahlen, durch Komma getrennt.
          </span>
        )
      }
    >
      {(id) => (
        <input
          id={id}
          className={styles.eingabe}
          inputMode="numeric"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const t = e.target.value
              .split(/[,\s;]+/)
              .map((x) => x.trim())
              .filter((x) => x !== '');
            if (t.every((x) => /^\d+$/.test(x))) onChange(t.map(Number));
          }}
        />
      )}
    </Feld>
  );
}

/** Eine ganze Zahl in Grenzen. Leer lassen geht, solange getippt wird; das Modell bekommt nur Zahlen im Bereich. */
export function ZahlFeld({
  label,
  hilfe,
  wert,
  min,
  max,
  onChange,
}: {
  label: string;
  hilfe?: ReactNode;
  wert: number | undefined;
  min: number;
  max: number;
  onChange: (zahl: number) => void;
}) {
  const [text, setText] = useState(wert === undefined ? '' : String(wert));
  const zahl = Number(text);
  const ok = text.trim() !== '' && Number.isInteger(zahl) && zahl >= min && zahl <= max;
  return (
    <Feld
      label={label}
      hilfe={
        ok || text.trim() === '' ? (
          hilfe
        ) : (
          <span role="alert" className={styles.fehler}>
            Eine ganze Zahl von {min} bis {max}.
          </span>
        )
      }
    >
      {(id) => (
        <input
          id={id}
          className={`${styles.eingabe} ${styles.zahlenfeld}`}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value.trim() !== '' && Number.isInteger(n) && n >= min && n <= max)
              onChange(n);
          }}
        />
      )}
    </Feld>
  );
}
