/**
 * **Ziehen zwischen mehreren Abläufen** (Dienstplaner-Matrix, Bauplan E6-6b, Entwurf `e6-6-entwurf-2.html` Bild 3): EIN
 * Zieh-Bereich für alle Spalten statt einer eigenen Liste je Termin. Jede Bearbeiten-Liste (`useAblaufBearbeiten` mit
 * `ziehen`) meldet sich hier an; innerhalb einer Spalte bleibt alles wie vorher (`umsortieren` der Spalte), über eine
 * Spaltengrenze zeigt die Ziel-Spalte die gestrichelte Stelle „hier ablegen“, und beim Loslassen fragt der Aufrufer
 * (`onAblegen`) „Verschieben / Kopieren“. Wohin nicht (geteilt, abgeschlossen, kein Ablauf) entscheidet der Aufrufer
 * (`darfAblegen`) – dort erscheint keine Stelle, beim Loslassen kommt sein Hinweis.
 *
 * Ohne diesen Bereich (Musik-App, Termin-Ansicht, Handy) hat jede Liste ihr eigenes Ziehen wie bisher.
 */
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { itemLabel, type AblaufZeile } from '@shared/ct/ablaufZeile';
import { Icon } from '../icons/icons';
import { BodyPortal } from '../fenster/BodyPortal';
import { useZiehSensoren } from '../bedienung/useZiehSensoren';
import { innerScrollOnly, resetViewportAfterDrag } from '../bedienung/dndAutoScroll';
import {
  Bereich,
  datenVon,
  platzIn,
  type Ablegen,
  type Daten,
  type Platz,
  type ZiehSpalte,
} from './ablaufZiehen';
import styles from './AblaufBearbeiten.module.scss';

/**
 * Welche Spalte unter dem Zeiger liegt (Fläche), darin der nächste Punkt. Ohne Spalte unter dem Zeiger (oder mit der
 * Tastatur) bleibt es bei der Spalte, aus der gezogen wird – wie ohne Zieh-Bereich.
 */
const erkennen: CollisionDetection = (args) => {
  const flaechen = args.droppableContainers.filter(
    (c) => (c.data.current as Daten | undefined)?.art === 'flaeche',
  );
  const unter = pointerWithin({ ...args, droppableContainers: flaechen });
  const getroffen = unter[0] ? flaechen.find((c) => c.id === unter[0].id) : undefined;
  const spalte =
    (getroffen?.data.current as Daten | undefined)?.spalte ??
    (args.active.data.current as Daten | undefined)?.spalte;
  const punkte = args.droppableContainers.filter((c) => {
    const d = c.data.current as Daten | undefined;
    return d?.art === 'punkt' && d.spalte === spalte;
  });
  if (punkte.length === 0) return unter;
  return closestCenter({ ...args, droppableContainers: punkte });
};

/** Die Zeiger-Höhe während des Ziehens (Start + Weg); ohne Zeiger (Tastatur) die Mitte des gezogenen Punkts. */
function zeigerY(e: DragMoveEvent | DragEndEvent): number | null {
  const start = e.activatorEvent as Partial<PointerEvent> | null;
  if (typeof start?.clientY === 'number') return start.clientY + e.delta.y;
  const r = e.active.rect.current.translated;
  return r ? r.top + r.height / 2 : null;
}

export function AblaufZiehBereich({
  darfAblegen,
  onAblegen,
  onHinweis,
  children,
}: {
  /** Darf ein Punkt aus `von` nach `nach`? `true` oder der Hinweis, warum nicht. */
  darfAblegen: (von: number, nach: number) => true | string;
  onAblegen: (a: Ablegen) => void;
  onHinweis: (text: string) => void;
  children: ReactNode;
}) {
  const spalten = useRef(new Map<number, () => ZiehSpalte>());
  const [platz, setPlatz] = useState<Platz | null>(null);
  const [gezogen, setGezogen] = useState<AblaufZeile | null>(null);
  const sensors = useZiehSensoren();

  const anmelden = useCallback((spalte: number, lies: () => ZiehSpalte) => {
    spalten.current.set(spalte, lies);
    return () => {
      if (spalten.current.get(spalte) === lies) spalten.current.delete(spalte);
    };
  }, []);
  const wert = useMemo(() => ({ anmelden, platz }), [anmelden, platz]);

  /** Die Stelle in einer anderen Spalte, auf die der Zeiger gerade zeigt – `null` in der eigenen oder wo es nicht darf. */
  function platzAus(e: DragMoveEvent | DragEndEvent): Platz | null {
    const a = datenVon(e.active);
    const o = datenVon(e.over);
    if (a?.art !== 'punkt' || !o || o.spalte === a.spalte) return null;
    if (darfAblegen(a.spalte, o.spalte) !== true) return null;
    const ziel = spalten.current.get(o.spalte)?.();
    if (!ziel) return null;
    return platzIn(o.spalte, ziel.items, o, zeigerY(e), e.over?.rect ?? null);
  }

  function beiBewegung(e: DragMoveEvent) {
    const neu = platzAus(e);
    setPlatz((alt) =>
      alt?.spalte === neu?.spalte && alt?.index === neu?.index && alt?.vorBeginn === neu?.vorBeginn
        ? alt
        : neu,
    );
  }

  function beiStart(e: DragStartEvent) {
    const a = datenVon(e.active);
    if (a?.art !== 'punkt') return;
    setGezogen(
      spalten.current
        .get(a.spalte)?.()
        .items.find((x) => x.id === a.itemId) ?? null,
    );
  }

  function beiEnde(e: DragEndEvent) {
    resetViewportAfterDrag();
    setPlatz(null);
    setGezogen(null);
    const a = datenVon(e.active);
    const o = datenVon(e.over);
    if (a?.art !== 'punkt' || !o) return;
    const quelle = spalten.current.get(a.spalte)?.();
    if (!quelle) return;
    if (o.spalte === a.spalte) {
      if (o.art === 'punkt' && o.itemId !== a.itemId) quelle.umsortieren(a.itemId, o.itemId);
      return;
    }
    const darf = darfAblegen(a.spalte, o.spalte);
    if (darf !== true) {
      onHinweis(darf);
      return;
    }
    const p = platzAus(e);
    const ziel = spalten.current.get(o.spalte)?.();
    const punkt = quelle.items.find((x) => x.id === a.itemId);
    if (!p || !ziel || !punkt) return;
    const hinter = p.index > 0 ? ziel.items[p.index - 1] : null;
    onAblegen({
      von: a.spalte,
      nach: o.spalte,
      punkt,
      hinter,
      ablage: { nachId: hinter?.id ?? null, vorBeginn: p.vorBeginn },
      quelle,
      ziel,
    });
  }

  return (
    <Bereich.Provider value={wert}>
      <DndContext
        sensors={sensors}
        collisionDetection={erkennen}
        onDragStart={beiStart}
        onDragMove={beiBewegung}
        onDragOver={beiBewegung}
        onDragEnd={beiEnde}
        onDragCancel={() => {
          resetViewportAfterDrag();
          setPlatz(null);
          setGezogen(null);
        }}
        autoScroll={innerScrollOnly}
        // Der versteckte Text für Screenreader gehört nicht in die Tabelle (ein `div` in `tbody`).
        accessibility={{ container: document.body }}
      >
        {children}
        {/* Über allen Spalten – der Punkt selbst bliebe in seiner Zelle hinter den Nachbarspalten. Im `body`, weil der
            Bereich in einer Tabelle steht (ein `div` in `tbody` wäre kein gültiges HTML). */}
        <BodyPortal>
          <DragOverlay dropAnimation={null}>
            {gezogen && (
              <div className={styles.ziehBild}>
                <Icon name="grip" size={14} />
                <span>{itemLabel(gezogen)}</span>
              </div>
            )}
          </DragOverlay>
        </BodyPortal>
      </DndContext>
    </Bereich.Provider>
  );
}

/** Die gestrichelte Stelle „hier ablegen“ in der Ziel-Spalte. */
export function AblageStelle() {
  return (
    <div className={styles.ablageStelle} data-testid="ablage-stelle">
      <Icon name="chev-down" size={12} /> hier ablegen
    </div>
  );
}
