/**
 * **Ziehen in der To-Do-Übersicht** (Bauplan S7-3, Alwin 30.10.2026) – ein Baustein für Board und Liste:
 * - **zwischen Spalten** (nur Board): Status setzen bzw. die gezogene Person tauschen – was das heißt, entscheidet der
 *   Aufrufer (`onAblegen`, Regel `ablegen` in `@shared/protokolle/uebersicht`);
 * - **innerhalb einer Spalte** (nur bei „Manuell“): meine Reihenfolge (`onUmordnen`, Regel `umordnen`).
 *
 * Maus: die ganze Karte nach 6 px; Finger: **lange drücken** (~0,4 s), vorher blättert ein Wischen
 * (`useZiehSensorenLangDruecken`). Kein Griff. Das Blättern beim Ziehen bleibt im Board (`innerScrollOnly`).
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  useDroppable,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  type SortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BodyPortal } from '@ui/fenster/BodyPortal';
import { innerScrollOnly, resetViewportAfterDrag } from '@ui/bedienung/dndAutoScroll';
import { useZiehSensorenLangDruecken } from '@ui/bedienung/useZiehSensoren';
import { loslassen, type Daten } from './toDoZiehenRegel';
import styles from './ToDos.module.scss';

const datenVon = (x: { data: { current?: unknown } } | null): Daten | null =>
  (x?.data.current as Daten | undefined) ?? null;

/** Ohne „Manuell“ rücken die Karten beim Ziehen nicht auseinander – es gibt keine Stelle, an die man legt. */
const stillstehen: SortingStrategy = () => null;

const Lage = createContext<{ ziel: string | null; manuell: boolean; zwischen: boolean }>({
  ziel: null,
  manuell: false,
  zwischen: false,
});

/**
 * Was unter dem Zeiger liegt: erst eine Karte (für „Manuell“), sonst die Spalte. Ohne Zeiger (Tastatur) die nächste.
 */
const erkennen: CollisionDetection = (args) => {
  const unter = pointerWithin(args);
  if (unter.length) {
    const karte = unter.find(
      (u) => datenVon(args.droppableContainers.find((c) => c.id === u.id) ?? null)?.art === 'karte',
    );
    return karte ? [karte] : unter;
  }
  return closestCenter(args);
};

export function ToDoZiehBereich({
  zwischen,
  manuell,
  spalten,
  onAblegen,
  onUmordnen,
  bild,
  children,
}: {
  /** Ablegen in einer anderen Spalte erlaubt (Board). */
  zwischen: boolean;
  /** Innerhalb einer Spalte ordnen („Manuell“). */
  manuell: boolean;
  /** Die Schlüssel der Karten je Spalte, wie sie gerade zu sehen sind. */
  spalten: ReadonlyMap<string, readonly string[]>;
  onAblegen: (karte: string, von: string, nach: string) => void;
  /** `vor` = die Karte, vor der die gezogene jetzt steht (`null` = am Ende). */
  onUmordnen: (spalte: string, karte: string, vor: string | null) => void;
  /** Das Bild unter dem Finger/Zeiger. */
  bild: (karte: string) => ReactNode;
  children: ReactNode;
}) {
  const sensors = useZiehSensorenLangDruecken();
  const [gezogen, setGezogen] = useState<string | null>(null);
  const [ziel, setZiel] = useState<string | null>(null);

  const ende = () => {
    resetViewportAfterDrag();
    setGezogen(null);
    setZiel(null);
  };
  const beiStart = (e: DragStartEvent) => setGezogen(String(e.active.id));
  const beiUeber = (e: DragOverEvent) => {
    const o = datenVon(e.over);
    const a = datenVon(e.active);
    setZiel(o && a && o.spalte !== a.spalte && zwischen ? o.spalte : null);
  };
  const beiEnde = (e: DragEndEvent) => {
    ende();
    const r = loslassen({
      karte: String(e.active.id),
      von: datenVon(e.active),
      ueber: datenVon(e.over),
      ueberId: e.over ? String(e.over.id) : null,
      zwischen,
      manuell,
      spalten,
    });
    if (r?.art === 'ablegen') onAblegen(r.karte, r.von, r.nach);
    if (r?.art === 'umordnen') onUmordnen(r.spalte, r.karte, r.vor);
  };

  return (
    <Lage.Provider value={{ ziel, manuell, zwischen }}>
      <DndContext
        sensors={sensors}
        collisionDetection={erkennen}
        onDragStart={beiStart}
        onDragOver={beiUeber}
        onDragEnd={beiEnde}
        onDragCancel={ende}
        autoScroll={innerScrollOnly}
        accessibility={{ container: document.body }}
      >
        {children}
        <BodyPortal>
          <DragOverlay dropAnimation={null}>
            {gezogen && <div className={styles.ziehBild}>{bild(gezogen)}</div>}
          </DragOverlay>
        </BodyPortal>
      </DndContext>
    </Lage.Provider>
  );
}

/** Eine Spalte (Board) bzw. ein Abschnitt (Liste): Ablagefläche und die Reihenfolge ihrer Karten. */
export function ZiehSpalte({
  schluessel,
  nimmtAn,
  karten,
  className,
  children,
}: {
  schluessel: string;
  nimmtAn: boolean;
  karten: readonly string[];
  className?: string;
  children: ReactNode;
}) {
  const { ziel, manuell } = useContext(Lage);
  const { setNodeRef } = useDroppable({
    id: `spalte:${schluessel}`,
    data: { art: 'spalte', spalte: schluessel } satisfies Daten,
    disabled: !nimmtAn,
  });
  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ''}${ziel === schluessel && nimmtAn ? ' ' + styles.ziel : ''}`}
    >
      <SortableContext
        id={schluessel}
        items={[...karten]}
        strategy={manuell ? verticalListSortingStrategy : stillstehen}
      >
        {children}
      </SortableContext>
    </div>
  );
}

/** Eine Karte, die man ziehen kann. `darf: false` – liegt still (Liste ohne „Manuell“). */
export function ZiehKarte({
  schluessel,
  spalte,
  darf,
  children,
}: {
  schluessel: string;
  spalte: string;
  darf: boolean;
  children: ReactNode;
}) {
  const { manuell, zwischen } = useContext(Lage);
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: schluessel,
    data: { art: 'karte', spalte } satisfies Daten,
    disabled: !darf || (!manuell && !zwischen),
  });
  return (
    <li
      ref={setNodeRef}
      className={`${styles.zeile} ${styles.ziehbar}${isDragging ? ' ' + styles.gezogen : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      // Die Karte selbst ist kein Knopf – drin sind Text und Status-Marke die Knöpfe.
      role="listitem"
      tabIndex={darf ? 0 : -1}
    >
      {children}
    </li>
  );
}
