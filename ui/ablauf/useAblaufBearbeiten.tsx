/**
 * **Die Bearbeiten-Liste des Ablaufs** (Bauplan E6-2b-3; vorher fest in `client/src/pages/Setlist.tsx`): Ziehen am
 * Griff, Punkt antippen → Punkt-Fenster, „Eintrag hinzufügen" (schwebendes Plus), Löschen mit Rückfrage,
 * „Rückgängig" für Löschen und Verschieben, Hinweis bei abgeschlossenem Ablauf. Musik-App und Dienstplaner (E6-3)
 * nutzen dieselbe Liste; die Musik-App steckt im Punkt-Fenster ihre Liedwahl ein.
 *
 * Ein Hook statt einer Komponente, weil die Seite zwei Orte füllt: die **Liste** steht im Inhalt (scrollt mit),
 * die **Überlagerung** (Fenster, Plus, Hinweise) schwebt darüber. Den Fehlertext teilt die Liste mit der Seite
 * (`fehlerZeigen`) – auch ein Fehler beim Abschließen steht in derselben Zeile.
 */
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import type { AgendaServiceOption } from '@shared/types/index';
import type { GeloeschterPunkt, PunktAenderung } from '@shared/ct/schreibKern';
import type { NeuerAgendaPunkt } from '@shared/ct/agendaItemChanges';
import {
  beginnStelle,
  itemLabel,
  vorlaufNachUmsortieren,
  type AblaufZeile,
} from '@shared/ct/ablaufZeile';
import { ConfirmDialog } from '../fenster/ConfirmDialog';
import { Toast } from '../fenster/Toast';
import { useToast } from '../fenster/useToast';
import { Icon } from '../icons/icons';
import { SchwebePlus } from '../bedienung/SchwebePlus';
import { useRueckgaengig } from '../bedienung/useRueckgaengig';
import { innerScrollOnly, resetViewportAfterDrag } from '../bedienung/dndAutoScroll';
import { SortableRow } from './AgendaSortableRow';
import { BeginnLinie } from './AblaufTeile';
import { PunktFenster, type LiedWahlArgs } from './PunktFenster';
import styles from './AblaufBearbeiten.module.scss';

/**
 * Gebündelte Bearbeiten-Aktionen des Ablaufs – EIN Objekt statt einzelner Callback-Props durch alle Ebenen. Alle
 * Aktionen werfen bei Fehler (z. B. fehlende Rechte); die Liste zeigt die Meldung.
 */
export interface AblaufAktionen {
  /** Speichert die neue Reihenfolge (Item-IDs). */
  reorder: (order: number[]) => Promise<void>;
  /** Löscht einen Ablaufpunkt; liefert den Merkzettel für „Rückgängig" (`null`: war schon weg). */
  remove: (itemId: number) => Promise<GeloeschterPunkt | null>;
  /** Legt einen eben gelöschten Punkt an seiner alten Stelle wieder an. */
  restore: (punkt: GeloeschterPunkt) => Promise<void>;
  /** Schreibt geänderte Felder eines Punkts gesammelt (ein Request). */
  update: (itemId: number, fields: PunktAenderung) => Promise<void>;
  /** Legt fest, ob der Punkt (samt allen darüber bzw. darunter) vor dem Beginn läuft (#423). */
  setVorBeginn: (itemId: number, vorBeginn: boolean) => Promise<void>;
  /** Legt einen neuen Punkt an. */
  add: (data: NeuerAgendaPunkt) => Promise<void>;
}

export interface AblaufBearbeitenOptionen<T extends AblaufZeile> {
  /** Bearbeiten-Modus an? Aus: Überlagerung leer, „Rückgängig" verworfen. */
  aktiv: boolean;
  /** Ablauf geladen und ohne Fehler – erst dann gibt es das Plus. */
  bereit: boolean;
  /** Der Server-Stand (auch mit „entfernt"-Platzhaltern – die gehören nur in die Ansicht). */
  items: readonly T[];
  /** Uhrzeit des Beginns für die Linie „Beginn" (#423). */
  beginn: string;
  /** In ChurchTools abgeschlossen: nichts ändern, stattdessen `sperrHinweis` zeigen. */
  abgeschlossen: boolean;
  sperrHinweis: string;
  /** Speichert gerade die Reihenfolge („Speichere…" statt der Anleitung). */
  speichertGerade?: boolean;
  aktionen: AblaufAktionen;
  /** Verfügbare ChurchTools-Dienste (Chips im Verantwortlich-Editor). */
  dienste: AgendaServiceOption[];
  /** Liedwahl im Punkt-Fenster (Musik-App); ohne nur anzeigen (Dienstplaner). */
  liedWahl?: (args: LiedWahlArgs) => ReactNode;
  /** Zusätzlich bei jedem Schreibfehler – z. B. bei 423 (inzwischen abgeschlossen) die Termine neu holen. */
  beiFehler?: (e: unknown) => void;
}

export function useAblaufBearbeiten<T extends AblaufZeile>(
  o: AblaufBearbeitenOptionen<T>,
): {
  liste: ReactNode;
  ueberlagerung: ReactNode;
  /** Eine Fehlermeldung in der Zeile über der Liste zeigen (und `beiFehler` auslösen). */
  fehlerZeigen: (e: unknown, sonst: string) => void;
  fehlerLoeschen: () => void;
} {
  const { aktiv, items, abgeschlossen, aktionen, beiFehler } = o;
  // Der Stand, auf den nach einem Fehler zurückgerollt wird – ohne „entfernt"-Platzhalter (#161). Bis E6-2b-3
  // rollten Ziehen und Löschen auf `items` MIT Platzhaltern zurück, Bearbeiten und Rückgängig ohne.
  const serverStand = (): T[] => items.filter((i) => !i.removed);
  const [localItems, setLocalItems] = useState<T[]>(serverStand);
  const [err, setErr] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);
  // „Neuer Eintrag" – derselbe Dialog wie Bearbeiten (05.10.2026).
  const [neuOffen, setNeuOffen] = useState(false);
  const [actionItem, setActionItem] = useState<T | null>(null);
  // „Rückgängig" für Löschen und Verschieben (Alwin, 12.10.2026) – Bearbeiten und Anlegen bewusst nicht.
  const rueckgaengig = useRueckgaengig();
  const { toast: sperrToast, showToast: zeigeSperrHinweis } = useToast();

  function fehlerZeigen(e: unknown, sonst: string): void {
    setErr(e instanceof Error ? e.message : sonst);
    beiFehler?.(e);
  }

  // Server-Stand (auch nach dem Speichern) übernehmen – ohne „entfernt"-Platzhalter.
  useEffect(() => {
    setLocalItems(items.filter((i) => !i.removed));
  }, [items]);

  // „Fertig" beendet auch das Angebot „Rückgängig" – es gehört zum Bearbeiten.
  const { verwerfen: rueckgaengigVerwerfen } = rueckgaengig;
  useEffect(() => {
    if (!aktiv) rueckgaengigVerwerfen();
  }, [aktiv, rueckgaengigVerwerfen]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    resetViewportAfterDrag(); // #56: weggerutschte Kopfleiste zurückholen (auch ohne Umsortierung)
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    // Abgeschlossen: nicht speichern – der Punkt springt zurück, der Hinweis sagt warum.
    if (abgeschlossen) {
      zeigeSperrHinweis(o.sperrHinweis);
      return;
    }
    const oldIndex = localItems.findIndex((i) => i.id === active.id);
    const newIndex = localItems.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    // Die Beginn-Grenze bleibt an ihrem Platz, wie ChurchTools sie nach dem Speichern rechnet (#423).
    const vorher = localItems;
    const next = vorlaufNachUmsortieren(localItems, arrayMove(localItems, oldIndex, newIndex));
    setLocalItems(next); // optimistisch
    setErr(null);
    rueckgaengig.verwerfen();
    aktionen
      .reorder(next.map((i) => i.id))
      .then(() =>
        rueckgaengig.anbieten(`„${itemLabel(vorher[oldIndex])}" verschoben`, () => {
          setLocalItems(vorher); // optimistisch zurück
          return aktionen.reorder(vorher.map((i) => i.id));
        }),
      )
      .catch((e: unknown) => {
        setLocalItems(serverStand()); // zurückrollen
        fehlerZeigen(e, 'Reihenfolge konnte nicht gespeichert werden.');
      });
  }

  /** Schreibt Feld-Änderungen (ein Request); Titel optimistisch lokal spiegeln. */
  function handleUpdate(itemId: number, fields: PunktAenderung): Promise<void> {
    setErr(null);
    if (fields.title !== undefined) {
      const title = fields.title;
      setLocalItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, title } : i)));
    }
    // Fehler zeigt das Punkt-Fenster – hier nur lokal zurückrollen und weiterwerfen.
    return aktionen.update(itemId, fields).catch((e: unknown) => {
      setLocalItems(serverStand());
      beiFehler?.(e);
      throw e;
    });
  }

  function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    setErr(null);
    setLocalItems((prev) => prev.filter((i) => i.id !== target.id)); // optimistisch
    rueckgaengig.verwerfen();
    aktionen
      .remove(target.id)
      .then((g) => {
        if (g) rueckgaengig.anbieten(`„${itemLabel(target)}" gelöscht`, () => aktionen.restore(g));
      })
      .catch((e: unknown) => {
        setLocalItems(serverStand()); // zurückrollen
        fehlerZeigen(e, 'Punkt konnte nicht gelöscht werden.');
      });
  }

  /** „Rückgängig" antippen – scheitert es (z. B. Ablauf inzwischen geändert), steht die Meldung oben. */
  function rueckgaengigMachen(): void {
    setErr(null);
    rueckgaengig.ausloesen().catch((e: unknown) => {
      setLocalItems(serverStand());
      fehlerZeigen(e, 'Rückgängig machen hat nicht geklappt.');
    });
  }

  // Linie „Beginn" in der Bearbeiten-Liste – dieselbe Regel wie in der Ansicht (#423).
  const beginnBeiBearbeiten = beginnStelle(localItems);

  const liste = (
    <>
      {/* Abgeschlossen: keine Anleitung zum Sortieren – der Knopf oben rechts sagt genug (Alwin). */}
      {!abgeschlossen && (
        <div className={styles.editHint}>
          {o.speichertGerade ? (
            'Speichere…'
          ) : (
            <>
              Ziehen <Icon name="grip" size={14} className={styles.hintIcon} /> zum Sortieren ·
              Eintrag antippen zum Bearbeiten.
            </>
          )}
        </div>
      )}
      {err && <div className={styles.editError}>{err}</div>}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        onDragCancel={resetViewportAfterDrag}
        autoScroll={innerScrollOnly}
      >
        <SortableContext items={localItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className={styles.list}>
            {localItems.map((item, i) => (
              <Fragment key={item.id}>
                {i === beginnBeiBearbeiten && <BeginnLinie zeit={o.beginn} />}
                <SortableRow
                  item={item}
                  onOpenActions={(it) =>
                    abgeschlossen ? zeigeSperrHinweis(o.sperrHinweis) : setActionItem(it)
                  }
                />
              </Fragment>
            ))}
            {beginnBeiBearbeiten === localItems.length && <BeginnLinie zeit={o.beginn} />}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );

  const ueberlagerung = (
    <>
      {pendingDelete && (
        <ConfirmDialog
          title="Eintrag löschen?"
          message={`„${itemLabel(pendingDelete)}" wird aus dem Ablauf in ChurchTools entfernt.`}
          confirmLabel="Löschen"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {/* Das Plus schwebt im Bearbeiten-Modus über dem Ablauf (Alwin, 05.10.2026) – vorher stand
          „Eintrag hinzufügen" am Listenende. Auch bei einem leeren Ablauf, der sonst nicht zu füllen war. */}
      {aktiv && o.bereit && !neuOffen && (
        <SchwebePlus
          label="Eintrag hinzufügen"
          dataTour="edit-add"
          onClick={() => (abgeschlossen ? zeigeSperrHinweis(o.sperrHinweis) : setNeuOffen(true))}
        />
      )}

      {neuOffen && (
        <PunktFenster
          modus="neu"
          services={o.dienste}
          liedWahl={o.liedWahl}
          onClose={() => setNeuOffen(false)}
          onAdd={(punkt) => {
            setErr(null);
            return aktionen.add(punkt); // wirft bei Fehler → das Fenster zeigt die Meldung, bleibt offen
          }}
        />
      )}

      {actionItem && (
        <PunktFenster
          // Beim Wechsel eines anderen Punkts frischen Fenster-Zustand aufbauen.
          key={actionItem.id}
          item={actionItem}
          services={o.dienste}
          liedWahl={o.liedWahl}
          onClose={() => setActionItem(null)}
          onUpdate={(fields) => handleUpdate(actionItem.id, fields)}
          vorBeginn={actionItem.vorBeginn}
          onSetVorBeginn={(vorBeginn) => aktionen.setVorBeginn(actionItem.id, vorBeginn)}
          onRequestDelete={() => setPendingDelete(actionItem)}
        />
      )}

      {aktiv && (
        <Toast
          message={rueckgaengig.angebot}
          aktion={{ label: 'Rückgängig', onClick: rueckgaengigMachen }}
        />
      )}
      {aktiv && <Toast message={sperrToast} />}
    </>
  );

  return { liste, ueberlagerung, fehlerZeigen, fehlerLoeschen: () => setErr(null) };
}
