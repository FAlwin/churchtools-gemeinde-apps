import { useMemo } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@ui/icons/icons';
import { useZiehSensoren } from '@ui/bedienung/useZiehSensoren';
import { innerScrollOnly } from '@ui/bedienung/dndAutoScroll';
import { flowEintraege, parseChordPro, parseMetadata, teileImFlow } from '../utils/chordpro';
import styles from './AblaufKarte.module.scss';

interface Props {
  /** Der ChordPro-Text, wie er gerade im Editor steht. */
  text: string;
  /** Neue Reihenfolge übernehmen – leer heißt „wie im Text“ (die Flow-Zeile fällt weg). */
  setzen: (eintraege: string[]) => void;
  /** Handy: Liste untereinander statt Kärtchen in Reihen. */
  kompakt?: boolean;
}

/**
 * **Der Ablauf eines Lieds als Kärtchen** (Lied-Editor L2, 22.10.2026; Alwin: „wie in ProPresenter“ –
 * Teile hinzufügen, verschieben, entfernen). Geschrieben wird nur die `{flow: …}`-Zeile (`flowSetzen`); die
 * Regeln, welche Namen zu welchem Teil passen, stehen in `teileImFlow` (#606) und werden hier nicht
 * nachgebaut.
 *
 * Ohne Flow-Zeile zeigt die Karte die Teile in der Reihenfolge des Texts – so wie das Blatt sie dann auch
 * zeigt. Die erste Änderung legt die Zeile an; „Wie im Text“ nimmt sie wieder heraus.
 */
export function AblaufKarte({ text, setzen, kompakt = false }: Props) {
  const sensors = useZiehSensoren();
  const { eintraege, ausFlow, unbekannt, teile } = useMemo(() => {
    const abschnitte = parseChordPro(text);
    const flow = flowEintraege(parseMetadata(text).flow);
    // Teile mit Überschrift, je Name einmal – nur die kann eine Flow-Zeile nennen.
    const namen: string[] = [];
    for (const s of abschnitte) {
      const n = s.label.trim();
      if (n && !namen.some((x) => x.toLowerCase() === n.toLowerCase())) namen.push(n);
    }
    return {
      eintraege: flow.length > 0 ? flow : namen,
      ausFlow: flow.length > 0,
      unbekannt: teileImFlow(abschnitte, parseMetadata(text).flow).unbekannt,
      teile: namen,
    };
  }, [text]);

  const ids = eintraege.map((e, i) => `${i}:${e}`);

  function ziehenEnde(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const von = ids.indexOf(String(active.id));
    const nach = ids.indexOf(String(over.id));
    if (von < 0 || nach < 0) return;
    setzen(arrayMove(eintraege, von, nach));
  }

  return (
    <section
      aria-label="Ablauf"
      className={`${styles.karte}${kompakt ? ' ' + styles.kompakt : ''}`}
    >
      <div className={styles.kopf}>
        <span className={styles.titel}>Ablauf</span>
        <span className={styles.hinweis}>
          {ausFlow ? 'So wird das Lied gesungen' : 'Wie im Text'} · am Griff ziehen zum Verschieben
        </span>
        {ausFlow && (
          <button type="button" className={styles.zurueck} onClick={() => setzen([])}>
            Wie im Text
          </button>
        )}
      </div>

      {teile.length === 0 ? (
        <p className={styles.leer}>
          Noch keine Teile mit Überschrift – zuerst im Text einen Teil anlegen (Format → Abschnitt).
        </p>
      ) : (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={ziehenEnde}
            autoScroll={innerScrollOnly}
          >
            <SortableContext
              items={ids}
              strategy={kompakt ? verticalListSortingStrategy : rectSortingStrategy}
            >
              <ol className={styles.reihe}>
                {eintraege.map((e, i) => (
                  <Kaertchen
                    key={ids[i]}
                    id={ids[i]}
                    name={e}
                    fehlt={unbekannt.includes(e)}
                    entfernen={() => setzen(eintraege.filter((_, j) => j !== i))}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>

          <div className={styles.hinzu}>
            <span className={styles.hinzuLbl}>Hinzufügen:</span>
            {teile.map((t) => (
              <button
                key={t}
                type="button"
                className={styles.hinzuKnopf}
                onClick={() => setzen([...eintraege, t])}
              >
                <Icon name="plus" size={14} stroke={2} />
                {t}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Kaertchen({
  id,
  name,
  fehlt,
  entfernen,
}: {
  id: string;
  name: string;
  fehlt: boolean;
  entfernen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${styles.kaertchen}${fehlt ? ' ' + styles.fehlt : ''}${isDragging ? ' ' + styles.zieht : ''}`}
    >
      <button
        type="button"
        className={styles.griff}
        aria-label={`${name} verschieben`}
        {...attributes}
        {...listeners}
      >
        <Icon name="grip" size={16} />
      </button>
      <span className={styles.name}>{name}</span>
      {fehlt && <span className={styles.fehltText}>fehlt im Text</span>}
      <button
        type="button"
        className={styles.weg}
        aria-label={`${name} aus dem Ablauf nehmen`}
        onClick={entfernen}
      >
        <Icon name="x" size={14} stroke={2} />
      </button>
    </li>
  );
}
