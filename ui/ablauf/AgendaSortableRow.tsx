/**
 * Eine sortierbare Zeile im Bearbeiten-Modus (#198 – vorher in `pages/Setlist.tsx`; seit E6-2b-1 in `ui/ablauf`, damit
 * Musik-App und Dienstplaner dieselbe Zeile nutzen).
 *
 * Tippen auf den Titel öffnet das Aktionsmenü; gezogen wird ausschließlich am Griff – sonst würde
 * jeder Tipp auf die Zeile ein Ziehen einleiten und das Menü ließe sich kaum öffnen. Aufbau seit E6-O1 wie die
 * Ansicht (`ZeitSpalte`, `ZeilenInhalt` aus `AblaufListe`) – eine Stelle für beide.
 */
import type { AblaufZeile } from '@shared/ct/ablaufZeile';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '../icons/icons';
import { WeggelassenHinweis } from './AblaufTeile';
import { ZeilenInhalt, ZeitSpalte } from './AblaufListe';
import styles from './AgendaSortableRow.module.scss';
import zeile from './AblaufListe.module.scss';

/** Eine sortierbare Zeile im Bearbeiten-Modus. Tippen auf den Titel öffnet das Aktionsmenü. */
export function SortableRow<T extends AblaufZeile>({
  item,
  onOpenActions,
  schmal = false,
  ziehId,
  daten,
}: {
  item: T;
  onOpenActions: (item: T) => void;
  /** Schmale Form für die Matrix (E6-6a) – derselbe Inhalt wie `AblaufListe schmal`. */
  schmal?: boolean;
  /** Im Zieh-Bereich der Matrix (E6-6b): eigene Zieh-ID (Spalte + Punkt) und was der Bereich über den Punkt wissen muss. */
  ziehId?: string;
  daten?: Record<string, unknown>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ziehId ?? item.id,
    data: daten,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Nur beim Ziehen – ein festes `opacity: 1` überschrieb das Blass-Machen „weggelassen“ (seit E6-3b, gefunden E6-O1).
    opacity: isDragging ? 0.6 : undefined,
    zIndex: isDragging ? 1 : undefined,
  };
  // An diesem Termin weggelassen (E6-3b): grau wie in der Ansicht.
  const weg = item.weggelassen ? ` ${zeile.weggelassen}` : '';
  // Überschriften bleiben schmale Bänder wie in der Ansicht – nur mit Ziehen-Griff davor,
  // damit sich beim Umschalten in den Bearbeiten-Modus Position und Höhe nicht ändern.
  if (item.isHeader) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`${zeile.sectionBand} ${styles.editBand}${weg}`}
      >
        <button
          className={styles.bandHandle}
          {...attributes}
          {...listeners}
          aria-label="Verschieben"
        >
          <Icon name="grip" size={16} />
        </button>
        <button className={styles.bandEdit} onClick={() => onOpenActions(item)}>
          {item.title}
          {item.weggelassen && <WeggelassenHinweis />}
        </button>
        <button
          className={styles.rowEdit}
          onClick={() => onOpenActions(item)}
          aria-label="Bearbeiten"
        >
          <Icon name="pencil" size={15} stroke={2} />
        </button>
      </div>
    );
  }

  // Normale Zeile (E6-O1, Entwurf Variante 1 / B): Griff links, dann dieselbe Zeitspalte und derselbe Inhalt wie die
  // Ansicht – damit beim Umschalten nichts springt –, rechts nur der Stift (keine Kreise). Antippen öffnet das
  // Punkt-Fenster statt zu den Charts zu führen.
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${zeile.flowRow}${item.song ? ' ' + zeile.songRow : ''}${weg}${schmal ? ' ' + styles.schmalZeile : ''}`}
    >
      <button
        className={styles.dragCol}
        data-tour="edit-drag"
        {...attributes}
        {...listeners}
        aria-label="Verschieben"
      >
        <Icon name="grip" size={16} />
      </button>
      <ZeitSpalte item={item} />
      <button className={styles.editBody} data-tour="edit-item" onClick={() => onOpenActions(item)}>
        <ZeilenInhalt item={item} schmal={schmal} />
      </button>
      <button
        className={styles.rowEdit}
        onClick={() => onOpenActions(item)}
        aria-label="Bearbeiten"
      >
        <Icon name="pencil" size={15} stroke={2} />
      </button>
    </div>
  );
}
