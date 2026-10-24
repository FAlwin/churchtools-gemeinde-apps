import { useEffect, useRef } from 'react';
import { Icon } from '@ui/icons/icons';
import styles from './SuchLeiste.module.scss';

/**
 * **Die Lupe im Kopf** (Bauplan S3-4b, Alwin 23.10.2026): ein Tipp klappt die Suchleiste neben den Reitern aus; ist
 * die Zeile zu schmal, bekommt sie eine eigene. ✕ oder Esc klappt sie zu und führt zur vorherigen Ansicht zurück.
 */
export function SuchLeiste({
  offen,
  begriff,
  onOeffnen,
  onBegriff,
  onSchliessen,
}: {
  offen: boolean;
  begriff: string;
  onOeffnen: () => void;
  onBegriff: (b: string) => void;
  onSchliessen: () => void;
}) {
  const feld = useRef<HTMLInputElement>(null);

  // Nach dem Aufklappen gleich tippen können.
  useEffect(() => {
    if (offen) feld.current?.focus();
  }, [offen]);

  if (!offen)
    return (
      <button type="button" className={styles.lupe} aria-label="Suchen" onClick={onOeffnen}>
        <Icon name="search" size={18} />
      </button>
    );

  return (
    <div className={styles.leiste} role="search">
      <Icon name="search" size={16} />
      <input
        ref={feld}
        type="search"
        aria-label="Suchbegriff"
        placeholder="Beschlüsse, To-Dos, Protokolle …"
        value={begriff}
        onChange={(e) => onBegriff(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onSchliessen();
        }}
      />
      <button type="button" aria-label="Suche schließen" onClick={onSchliessen}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
