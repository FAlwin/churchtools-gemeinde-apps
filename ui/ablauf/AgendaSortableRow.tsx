/**
 * Eine sortierbare Zeile im Bearbeiten-Modus (#198 – vorher in `pages/Setlist.tsx`; seit E6-2b-1 in `ui/ablauf`, damit
 * Musik-App und Dienstplaner dieselbe Zeile nutzen).
 *
 * Tippen auf den Titel öffnet das Aktionsmenü; gezogen wird ausschließlich am Griff – sonst würde
 * jeder Tipp auf die Zeile ein Ziehen einleiten und das Menü ließe sich kaum öffnen.
 */
import type { AblaufZeile } from '@shared/ct/ablaufZeile';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '../icons/icons';
import { ItemTitle, ResponsibleLine, WeggelassenHinweis } from './AblaufTeile';
import styles from './AgendaSortableRow.module.scss';
import zeile from './AblaufListe.module.scss';

/** Eine sortierbare Zeile im Bearbeiten-Modus. Tippen auf den Titel öffnet das Aktionsmenü. */
export function SortableRow<T extends AblaufZeile>({
  item,
  onOpenActions,
}: {
  item: T;
  onOpenActions: (item: T) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
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

  // Normale Zeile: gleiche Optik wie die Ansicht (Zeit-Spalte → Ziehen-Griff), Antippen öffnet
  // das Aktionsmenü statt zu den Charts zu führen. Dauer + Zuständige bleiben sichtbar, damit die
  // Zeilenhöhe exakt der Ansicht entspricht.
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${zeile.flowRow}${item.song ? ' ' + zeile.songRow : ''}${weg}`}
    >
      <button
        className={styles.dragCol}
        data-tour="edit-drag"
        {...attributes}
        {...listeners}
        aria-label="Verschieben"
      >
        <Icon name="grip" size={18} />
      </button>
      <button className={styles.editBody} data-tour="edit-item" onClick={() => onOpenActions(item)}>
        <div className={zeile.flowHead}>
          <ItemTitle item={item} />
          {item.song && (
            <span className={zeile.flowSongTag}>
              <Icon name="music" size={12} />
            </span>
          )}
          {item.weggelassen && <WeggelassenHinweis />}
          {item.durationMin && <span className={zeile.flowDur}>{item.durationMin} Min</span>}
        </div>
        {item.note && <div className={zeile.flowNote}>{item.note}</div>}
        <ResponsibleLine entries={item.responsible} />
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
