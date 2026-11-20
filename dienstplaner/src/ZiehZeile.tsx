import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@ui/icons/icons';
import styles from './PersonenRaster.module.scss';

/**
 * **Eine Personenzeile, die man am Griff ziehen kann** (PL-2, „Liste bearbeiten“): dieselbe Zieh-Technik wie die Ablauf-Liste
 * (dnd-kit, `useZiehSensoren` im Raster – Maus nach 6 px, Finger am Griff, Tastatur mit Leertaste und Pfeilen). Gezogen wird
 * **nur am Griff** – ein Tipp auf den Namen öffnet das Personen-Fenster und darf kein Ziehen einleiten. Das Raster reicht die
 * Zelleninhalte als Funktion herein, die den Griff bekommt (er steht vor dem Bild in der Namenszelle).
 */
export function ZiehZeile({
  id,
  name,
  aktiv,
  className,
  personId,
  children,
}: {
  /** Zieh-ID – im Block eindeutig (`RasterZeile.schluessel`). */
  id: string;
  /** Für Screenreader: wer gezogen wird. */
  name: string;
  /** Gesperrt, solange gespeichert wird. */
  aktiv: boolean;
  className: string;
  personId: number;
  children: (griff: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !aktiv });
  const griff = (
    <span
      ref={setActivatorNodeRef}
      className={`${styles.griff}${aktiv ? '' : ' ' + styles.griffGesperrt}`}
      {...(aktiv ? { ...attributes, ...listeners } : {})}
      aria-label={`${name} verschieben`}
      title="Ziehen zum Verschieben"
    >
      <Icon name="grip" size={14} />
    </span>
  );
  return (
    <tr
      ref={setNodeRef}
      className={`${className}${isDragging ? ' ' + styles.zieht : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-person={personId}
    >
      {children(griff)}
    </tr>
  );
}
