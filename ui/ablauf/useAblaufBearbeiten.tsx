/**
 * **Die Bearbeiten-Liste des Ablaufs** (Bauplan E6-2b-3; vorher fest in `client/src/pages/Setlist.tsx`): Ziehen am
 * Griff, Punkt antippen → Punkt-Fenster, „Eintrag hinzufügen" (schwebendes Plus, das „Option wählen“ öffnet – am
 * iPad/Rechner auf Wunsch grün im Seitenkopf, Scheibe S2), Löschen mit Rückfrage,
 * „Rückgängig" für Löschen und Verschieben, Hinweis bei abgeschlossenem Ablauf. Musik-App und Dienstplaner (E6-3)
 * nutzen dieselbe Liste; die Musik-App steckt im Punkt-Fenster ihre Liedwahl ein.
 *
 * Ein Hook statt einer Komponente, weil die Seite zwei Orte füllt: die **Liste** steht im Inhalt (scrollt mit),
 * die **Überlagerung** (Fenster, Plus, Hinweise) schwebt darüber. Den Fehlertext teilt die Liste mit der Seite
 * (`fehlerZeigen`) – auch ein Fehler beim Abschließen steht in derselben Zeile.
 */
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import type { AgendaServiceOption } from '@shared/types/index';
import type { GeloeschterPunkt, PunktAenderung } from '@shared/ct/schreibKern';
import type { NeuerAgendaPunkt, PunktArt } from '@shared/ct/agendaItemChanges';
import {
  beginnStelle,
  itemLabel,
  punktStand,
  vorlaufNachUmsortieren,
  type AblaufZeile,
  type PunktStand,
} from '@shared/ct/ablaufZeile';
import { ConfirmDialog } from '../fenster/ConfirmDialog';
import { Toast } from '../fenster/Toast';
import { useToast } from '../fenster/useToast';
import { Icon } from '../icons/icons';
import { SchwebePlus } from '../bedienung/SchwebePlus';
import { AuswahlBlatt, HinzufuegenMenue, type Option } from '../bedienung/OptionWaehlen';
import { HANDY_BREITE, useMedienAbfrage } from '../bedienung/useMedienAbfrage';
import { useRueckgaengig } from '../bedienung/useRueckgaengig';
import { useZiehSensoren } from '../bedienung/useZiehSensoren';
import { innerScrollOnly, resetViewportAfterDrag } from '../bedienung/dndAutoScroll';
import { SortableRow } from './AgendaSortableRow';
import { BeginnLinie, VerborgeneGruppenHinweis } from './AblaufTeile';
import { PunktFenster, type LiedWahlArgs } from './PunktFenster';
import styles from './AblaufBearbeiten.module.scss';

/**
 * Gebündelte Bearbeiten-Aktionen des Ablaufs – EIN Objekt statt einzelner Callback-Props durch alle Ebenen. Alle
 * Aktionen werfen bei Fehler (z. B. fehlende Rechte); die Liste zeigt die Meldung.
 */
export interface AblaufAktionen {
  /** Speichert die neue Reihenfolge (Item-IDs); `gesehen` = die Reihenfolge davor (E6-3c, sonst 412). */
  reorder: (order: number[], gesehen?: number[]) => Promise<void>;
  /** Löscht einen Ablaufpunkt; liefert den Merkzettel für „Rückgängig" (`null`: war schon weg). */
  remove: (itemId: number) => Promise<GeloeschterPunkt | null>;
  /** Legt einen eben gelöschten Punkt an seiner alten Stelle wieder an. */
  restore: (punkt: GeloeschterPunkt) => Promise<void>;
  /** Schreibt geänderte Felder eines Punkts gesammelt (ein Request); `gesehen` wie beim Öffnen (E6-3c, sonst 412). */
  update: (itemId: number, fields: PunktAenderung, gesehen?: PunktStand) => Promise<void>;
  /** Legt fest, ob der Punkt (samt allen darüber bzw. darunter) vor dem Beginn läuft (#423). */
  setVorBeginn: (itemId: number, vorBeginn: boolean) => Promise<void>;
  /** Lässt den Punkt an diesem Termin weg (Auge) oder zeigt ihn wieder (E6-3b, #652). */
  setWeggelassen: (itemId: number, weggelassen: boolean) => Promise<void>;
  /** Legt einen neuen Punkt an. */
  add: (data: NeuerAgendaPunkt) => Promise<void>;
}

/**
 * Muss nach diesem Schreibfehler der Ablauf neu gelesen werden? Punkt weg (404), Ablauf anders (409), derselbe Punkt
 * oder die Reihenfolge inzwischen geändert (412, E6-3c), abgeschlossen (423). Eine Stelle für Musik-App und
 * Dienstplaner – sonst zeigte eine App nach dem Fehler den alten Stand.
 */
export function verlangtNeuLaden(e: unknown): boolean {
  const status = (e as { status?: unknown } | null)?.status;
  return typeof status === 'number' && [404, 409, 412, 423].includes(status);
}

export interface AblaufBearbeitenOptionen<T extends AblaufZeile> {
  /** Bearbeiten-Modus an? Aus: Überlagerung leer, „Rückgängig" verworfen. */
  aktiv: boolean;
  /** Ablauf geladen und ohne Fehler – erst dann gibt es das Plus. */
  bereit: boolean;
  /** Der Server-Stand (auch mit „entfernt"-Platzhaltern – die gehören nur in die Ansicht). */
  items: readonly T[];
  /** Uhrzeit des Beginns für den Balken „Beginn" (#423). */
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
  /**
   * Sieht der Bearbeitende nicht alle Dienstgruppen (`siehtAlleDienstgruppen`, #676)? Dann steht ein Hinweis über der
   * Liste und im Punkt-Fenster.
   */
  gruppenVerborgen?: boolean;
  /** Zusätzlich bei jedem Schreibfehler – z. B. bei 423 (inzwischen abgeschlossen) die Termine neu holen. */
  beiFehler?: (e: unknown) => void;
  /**
   * „Neu aufsetzen …“ rechts in der Hinweiszeile (E6-5b, Entwurf A) – öffnet der Aufrufer (`NeuAufsetzen`). Ist der
   * Ablauf abgeschlossen, steht der Knopf allein da und zeigt den Sperr-Hinweis wie das Plus.
   */
  neuAufsetzen?: () => void;
  /**
   * Am iPad/Rechner statt des schwebenden Plus ein grünes „+ Eintrag hinzufügen“ im Seitenkopf (`kopfKnopf`) – wie
   * „+ Gruppe erstellen“ in ChurchTools (Scheibe S2, Alwin 26.10.2026). Am Handy bleibt das Plus.
   */
  plusImKopf?: boolean;
}

export function useAblaufBearbeiten<T extends AblaufZeile>(
  o: AblaufBearbeitenOptionen<T>,
): {
  liste: ReactNode;
  ueberlagerung: ReactNode;
  /** Das grüne „+ Eintrag hinzufügen“ für den Seitenkopf – nur mit `plusImKopf` auf breiten Bildschirmen, sonst `null`. */
  kopfKnopf: ReactNode;
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
  // „Neuer Eintrag" – derselbe Dialog wie Bearbeiten (05.10.2026); womit er anfängt, sagt „Option wählen“ (S2).
  const [neuStart, setNeuStart] = useState<{ art: PunktArt; lied: boolean } | null>(null);
  const [auswahlOffen, setAuswahlOffen] = useState(false);
  const handy = useMedienAbfrage(HANDY_BREITE);
  const imKopf = !!o.plusImKopf && !handy;
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

  const sensors = useZiehSensoren();

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
    // `gesehen`: die Reihenfolge, auf der gezogen wurde – hat inzwischen jemand umsortiert, kommt 412 (E6-3c).
    const ids = (liste: T[]) => liste.map((i) => i.id);
    aktionen
      .reorder(ids(next), ids(vorher))
      .then(() =>
        rueckgaengig.anbieten(`„${itemLabel(vorher[oldIndex])}" verschoben`, () => {
          setLocalItems(vorher); // optimistisch zurück
          return aktionen.reorder(ids(vorher), ids(next));
        }),
      )
      .catch((e: unknown) => {
        setLocalItems(serverStand()); // zurückrollen
        fehlerZeigen(e, 'Reihenfolge konnte nicht gespeichert werden.');
      });
  }

  /**
   * Schreibt Feld-Änderungen (ein Request) und spiegelt die einfachen Felder optimistisch lokal – auch damit ein gleich
   * wieder geöffnetes Fenster sie als „gesehen“ mitschickt und keinen Konflikt mit sich selbst meldet (E6-3c).
   */
  function handleUpdate(
    itemId: number,
    fields: PunktAenderung,
    gesehen: PunktStand | undefined,
  ): Promise<void> {
    setErr(null);
    setLocalItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              ...(fields.title !== undefined ? { title: fields.title } : {}),
              ...(fields.note !== undefined ? { note: fields.note } : {}),
              ...(fields.responsible !== undefined ? { responsibleText: fields.responsible } : {}),
              ...(fields.durationMin !== undefined
                ? { durationMin: fields.durationMin > 0 ? fields.durationMin : null }
                : {}),
            }
          : i,
      ),
    );
    // Fehler zeigt das Punkt-Fenster – hier nur lokal zurückrollen und weiterwerfen.
    return aktionen.update(itemId, fields, gesehen).catch((e: unknown) => {
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

  /** „Option wählen“ (S2) – wie in der ChurchTools-App; „Lied hinzufügen“ nur, wo es eine Liedwahl gibt. */
  function neuOeffnen(art: PunktArt, lied = false): void {
    setAuswahlOffen(false);
    setNeuStart({ art, lied });
  }
  const optionen: Option[] = [
    { label: 'Programmpunkt hinzufügen', onClick: () => neuOeffnen('programmpunkt') },
    ...(o.liedWahl
      ? [{ label: 'Lied hinzufügen', onClick: () => neuOeffnen('programmpunkt', true) }]
      : []),
    { label: 'Überschrift hinzufügen', onClick: () => neuOeffnen('ueberschrift') },
  ];
  const gesperrt = abgeschlossen ? () => zeigeSperrHinweis(o.sperrHinweis) : undefined;

  const kopfKnopf =
    imKopf && aktiv && o.bereit ? (
      <HinzufuegenMenue
        label="Eintrag hinzufügen"
        dataTour="edit-add"
        optionen={optionen}
        gesperrt={gesperrt}
      />
    ) : null;

  // Balken „Beginn" in der Bearbeiten-Liste – dieselbe Regel wie in der Ansicht (#423).
  const beginnBeiBearbeiten = beginnStelle(localItems);

  const anleitung = o.speichertGerade ? (
    'Speichere…'
  ) : (
    <>
      Ziehen <Icon name="grip" size={14} className={styles.hintIcon} /> zum Sortieren · Eintrag
      antippen zum Bearbeiten.
    </>
  );

  const liste = (
    <>
      {/* Abgeschlossen: keine Anleitung zum Sortieren – der Knopf oben rechts sagt genug (Alwin). */}
      {!abgeschlossen && !o.neuAufsetzen && <div className={styles.editHint}>{anleitung}</div>}
      {o.neuAufsetzen && (
        <div className={`${styles.editHint} ${styles.hintZeile}`}>
          <span>{abgeschlossen ? null : anleitung}</span>
          <button
            type="button"
            className={styles.neuAufsetzen}
            onClick={() => (abgeschlossen ? zeigeSperrHinweis(o.sperrHinweis) : o.neuAufsetzen?.())}
          >
            <Icon name="refresh" size={14} /> Neu aufsetzen …
          </button>
        </div>
      )}
      {o.gruppenVerborgen && (
        <div className={styles.editHint}>
          <VerborgeneGruppenHinweis />
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
          „Eintrag hinzufügen" am Listenende. Auch bei einem leeren Ablauf, der sonst nicht zu füllen war.
          Ein Tipp öffnet „Option wählen“ wie in der ChurchTools-App (S2); mit `plusImKopf` am iPad/Rechner im Kopf. */}
      {aktiv && o.bereit && !imKopf && !neuStart && !auswahlOffen && (
        <SchwebePlus
          label="Eintrag hinzufügen"
          dataTour="edit-add"
          onClick={() => (gesperrt ? gesperrt() : setAuswahlOffen(true))}
        />
      )}

      {auswahlOffen && <AuswahlBlatt optionen={optionen} onClose={() => setAuswahlOffen(false)} />}

      {neuStart && (
        <PunktFenster
          modus="neu"
          startArt={neuStart.art}
          startLied={neuStart.lied}
          services={o.dienste}
          liedWahl={o.liedWahl}
          onClose={() => setNeuStart(null)}
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
          // Verglichen wird mit dem Stand beim Öffnen; „Trotzdem speichern“ schreibt ohne Vergleich (E6-3c).
          onUpdate={(fields, trotzdem) =>
            handleUpdate(actionItem.id, fields, trotzdem ? undefined : punktStand(actionItem))
          }
          vorBeginn={actionItem.vorBeginn}
          onSetVorBeginn={(vorBeginn) => aktionen.setVorBeginn(actionItem.id, vorBeginn)}
          onSetWeggelassen={(weg) => aktionen.setWeggelassen(actionItem.id, weg)}
          onRequestDelete={() => setPendingDelete(actionItem)}
          gruppenVerborgen={o.gruppenVerborgen}
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

  return { liste, ueberlagerung, kopfKnopf, fehlerZeigen, fehlerLoeschen: () => setErr(null) };
}
