import { Fragment, useEffect, useState } from 'react';
import type { AgendaItem, AgendaServiceOption, Service, SetlistSong } from '@shared/types/index';
import type { AgendaItemUpdate } from '../services/churchtoolsApi';
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
import { SeitenGeruest } from '../components/SeitenGeruest';
import { RundKnopf } from '@ui/bedienung/KnopfReihe';
import { CenterMessage } from '../components/CenterMessage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SchwebePlus } from '../components/SchwebePlus';
import { AgendaFullView } from '../components/AgendaFullView';
import { SortableRow } from '../components/AgendaSortableRow';
import { BeginnLinie } from '../components/AgendaRowParts';
import { ItemActionSheet } from '../components/ItemActionSheet';
import { Icon } from '@ui/icons/icons';
import { itemLabel } from '../utils/agendaItemTitle';
import type { NeuerAgendaPunkt } from '../utils/agendaItemChanges';
import { beginnStelle, vorlaufNachUmsortieren } from '../utils/vorlauf';
import { Coachmarks } from '../components/Coachmarks';
import {
  SETLIST_STEPS,
  SETLIST_EDIT_STEPS,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  isTourDone,
  markTourDone,
} from '../utils/onboarding';
import { ablaufPdfBauen, akkordeNichtGeladen, teilbareLieder } from '../utils/ablaufPdf';
import { eigeneEbene } from '../utils/anmerkungsEbene';
import { pullAnnotations } from '../services/annotations';
import { TeilenFenster, type GebautesPdf } from '../components/TeilenFenster';
import { dokumentSeiten } from '../utils/dokumentSeiten';
import { ladeDokument } from '../services/fileDownload';
import { loadSongPdfOpts, loadAppLogo } from '../utils/songPdfOpts';
import { innerScrollOnly, resetViewportAfterDrag } from '../utils/dndAutoScroll';
import styles from './Setlist.module.scss';

/**
 * Gebündelte Bearbeiten-Aktionen des Ablaufs – EIN Objekt statt einzelner Callback-Props durch
 * alle Ebenen. Alle Aktionen werfen bei Fehler (z. B. fehlende Rechte); die UI zeigt die Meldung.
 */
interface AgendaActions {
  /** Speichert die neue Reihenfolge (Item-IDs). */
  reorder: (order: number[]) => Promise<void>;
  /** Löscht einen Ablaufpunkt. */
  remove: (itemId: number) => Promise<void>;
  /** Schreibt geänderte Felder eines Punkts gesammelt (ein Request). */
  update: (itemId: number, fields: AgendaItemUpdate) => Promise<void>;
  /** Legt fest, ob der Punkt (samt allen darüber bzw. darunter) vor dem Beginn läuft (#423). */
  setVorBeginn: (itemId: number, vorBeginn: boolean) => Promise<void>;
  /** Legt einen neuen Punkt an. */
  add: (data: NeuerAgendaPunkt) => Promise<void>;
}

interface SetlistProps {
  service: Service;
  items: AgendaItem[];
  isLoading?: boolean;
  isError?: boolean;
  /** Neu laden – gibt das Versprechen zurück, damit die Ladeanzeige darauf warten kann. */
  onRetry?: () => Promise<unknown>;
  /** Wird mit dem Index des Lieds (nur Lieder gezählt) aufgerufen. */
  onSelect: (songIndex: number) => void;
  onBack: () => void;
  /** Bearbeiten-Aktionen (Reihenfolge, Löschen, Feld-Änderungen, Anlegen). */
  actions: AgendaActions;
  isReordering?: boolean;
  /** Verfügbare ChurchTools-Dienste (Chips im Verantwortlich-Editor). */
  services: AgendaServiceOption[];
  /** Darf der Nutzer den Ablauf bearbeiten? (blendet die Bearbeiten-UI aus) */
  canEdit?: boolean;
}

export function Setlist({
  service,
  items,
  isLoading,
  isError,
  onRetry,
  onSelect,
  onBack,
  actions,
  isReordering,
  services,
  canEdit = false,
}: SetlistProps) {
  const [editMode, setEditMode] = useState(false);
  // Geführte Einführung (#Onboarding, Gruppen 3+4): Ablauf-Ansicht beim ersten Öffnen, Bearbeiten-
  // Modus beim ersten Wechsel dorthin. Startet erst, wenn die Ziel-Elemente gerendert sind.
  const [setlistTour, setSetlistTour] = useState(false);
  const [editTour, setEditTour] = useState(false);
  // Bearbeiten-Modus/Drag arbeitet nur mit echten Punkten – die „entfernt"-Platzhalter (#161
  // Etappe B) gehören ausschließlich in die read-only Ansicht.
  const [localItems, setLocalItems] = useState<AgendaItem[]>(items.filter((i) => !i.removed));
  const [err, setErr] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AgendaItem | null>(null);
  // „Neuer Eintrag" – derselbe Dialog wie Bearbeiten (05.10.2026). Dauer, Zuständige und Notiz
  // werden gleich beim Anlegen gesetzt; der frühere zweite Dialog nach einem Lied entfällt.
  const [neuOffen, setNeuOffen] = useState(false);
  const [actionItem, setActionItem] = useState<AgendaItem | null>(null);

  // Server-Stand (auch nach dem Speichern) übernehmen – ohne „entfernt"-Platzhalter.
  useEffect(() => {
    setLocalItems(items.filter((i) => !i.removed));
  }, [items]);

  // Einführung Ablauf-Ansicht beim ersten Öffnen (Daten geladen, Ansicht-Modus).
  useEffect(() => {
    if (!isLoading && !isError && items.length > 0 && !editMode && !isTourDone(TOUR_SETLIST)) {
      setSetlistTour(true);
    }
  }, [isLoading, isError, items.length, editMode]);

  // Einführung Bearbeiten-Modus beim ersten Wechsel dorthin.
  useEffect(() => {
    if (editMode && !isTourDone(TOUR_SETLIST_EDIT)) setEditTour(true);
  }, [editMode]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    resetViewportAfterDrag(); // #56: weggerutschte Kopfleiste zurückholen (auch ohne Umsortierung)
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = localItems.findIndex((i) => i.id === active.id);
    const newIndex = localItems.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    // Die Beginn-Grenze bleibt an ihrem Platz, wie ChurchTools sie nach dem Speichern rechnet (#423).
    const next = vorlaufNachUmsortieren(localItems, arrayMove(localItems, oldIndex, newIndex));
    setLocalItems(next); // optimistisch
    setErr(null);
    actions.reorder(next.map((i) => i.id)).catch((e: unknown) => {
      setLocalItems(items); // zurückrollen
      setErr(e instanceof Error ? e.message : 'Reihenfolge konnte nicht gespeichert werden.');
    });
  }

  /** Schreibt Feld-Änderungen (ein Request); Titel optimistisch lokal spiegeln. */
  function handleUpdate(itemId: number, fields: AgendaItemUpdate): Promise<void> {
    setErr(null);
    if (fields.title !== undefined) {
      const title = fields.title;
      setLocalItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, title } : i)));
    }
    // Fehler wird vom Aktionsmenü angezeigt – hier nur lokal zurückrollen und weiterwerfen.
    return actions.update(itemId, fields).catch((e: unknown) => {
      setLocalItems(items.filter((i) => !i.removed));
      throw e;
    });
  }

  function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    setErr(null);
    setLocalItems((prev) => prev.filter((i) => i.id !== target.id)); // optimistisch
    actions.remove(target.id).catch((e: unknown) => {
      setLocalItems(items); // zurückrollen
      setErr(e instanceof Error ? e.message : 'Punkt konnte nicht gelöscht werden.');
    });
  }

  // Alle Lieder des Ablaufs als eine PDF teilen – jedes Lied EXAKT wie in der App angezeigt
  // (gespeicherte Tonart/Kapo/Schrift/Spalten + gewählte Version + Logo im Kopf) – und seit 07.10.2026
  // auch mit den Seiten eines angezeigten Dokuments (PDF/Bild), `utils/ablaufPdf.ts`.
  const lieder = items.map((i) => i.song).filter((s): s is NonNullable<typeof s> => !!s);
  const teilbar = teilbareLieder(lieder);
  // Lieder, die NUR wegen eines Ladefehlers fehlen würden (#274). Ohne diesen Hinweis fiele das Lied
  // stumm aus der geteilten PDF – und niemandem fällt auf, dass ein Blatt fehlt.
  const nichtGeladen = akkordeNichtGeladen(lieder, teilbar);
  // Das Teilen-Fenster (Anmerkungen ja/nein, PDF entsteht im Hintergrund) – `TeilenFenster`.
  const [teilenOffen, setTeilenOffen] = useState(false);

  function teilenOeffnen() {
    if (nichtGeladen.length > 0) {
      const liste = nichtGeladen.join(', ');
      const weiter = window.confirm(
        `Von ${nichtGeladen.length === 1 ? 'einem Lied' : `${nichtGeladen.length} Liedern`} konnten die Akkorde nicht geladen werden (${liste}). ` +
          `${nichtGeladen.length === 1 ? 'Es fehlt' : 'Sie fehlen'} dann im PDF.\n\nTrotzdem teilen?`,
      );
      if (!weiter) return;
    }
    if (teilbar.length > 0) setTeilenOffen(true);
  }

  async function ablaufPdf(mitAnmerkungen: boolean): Promise<GebautesPdf> {
    const logo = await loadAppLogo();
    const optsFor = (s: SetlistSong) =>
      loadSongPdfOpts(s, logo, teilbar.find((t) => t.song.id === s.id)?.versionKey);
    // Die Anmerkungen liegen auf dem Gerät erst, wenn ein Lied einmal offen war – deshalb vorher vom
    // Konto holen. Scheitert das (offline), gilt, was das Gerät hat.
    if (mitAnmerkungen) await pullAnnotations(teilbar.map((t) => t.song.id)).catch(() => undefined);
    const { doc, fehlend, ersetzt } = await ablaufPdfBauen(
      teilbar.map((t) => ({
        song: t.song,
        versionKey: t.versionKey,
        quelle: t.dokument
          ? { art: 'dokument', dokument: t.dokument }
          : { art: 'akkorde', opts: optsFor(t.song) },
      })),
      {
        ladeSeiten: async (song, dokument) =>
          dokumentSeiten(await ladeDokument(song.id, dokument.fileId), dokument.type),
        akkordOpts: optsFor,
        ebene: mitAnmerkungen ? eigeneEbene : undefined,
      },
    );
    const hinweis = [
      fehlend.length > 0 ? `Nicht geladen, fehlt im PDF: ${fehlend.join(', ')}` : '',
      ersetzt.length > 0 ? `Statt des Dokuments mit Akkorden: ${ersetzt.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('. ');
    return { doc, hinweis };
  }

  /**
   * Die runden Knöpfe rechts (`KnopfReihe`, 02.10.2026). Titel und Datum stehen groß im Inhalt.
   * Bis dahin saßen die Knöpfe in einer weißen Leiste im Unschärfe-Band von iOS 26/27 – dort waren
   * auch Symbole weich, nicht nur Text (Screenshot Alwin, 02.10.2026). Jetzt schweben sie darunter.
   */
  const aktionen =
    !isLoading && !isError && items.length > 0 ? (
      <>
        {teilbar.length > 0 && !editMode && (
          <RundKnopf
            onClick={teilenOeffnen}
            title="Alle Lieder als PDF teilen"
            dataTour="setlist-share"
          >
            <Icon name="share" size={20} stroke={2.2} />
          </RundKnopf>
        )}
        {canEdit && (
          <RundKnopf
            onClick={() => {
              setErr(null);
              setEditMode((v) => !v);
            }}
            title={editMode ? 'Fertig' : 'Ablauf bearbeiten'}
            dataTour="setlist-edit"
          >
            <Icon name={editMode ? 'check' : 'pencil'} size={20} stroke={2.2} />
          </RundKnopf>
        )}
      </>
    ) : undefined;

  /** Dialoge und Fenster schweben über dem Inhalt – sie scrollen nicht mit. */
  const ueberlagerung = (
    <>
      {teilenOffen && (
        <TeilenFenster
          titel="Ablauf teilen"
          dateiname={service.name || 'Ablauf'}
          bauen={ablaufPdf}
          onClose={() => setTeilenOffen(false)}
        />
      )}

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
      {editMode && !isLoading && !isError && !neuOffen && (
        <SchwebePlus
          label="Eintrag hinzufügen"
          dataTour="edit-add"
          onClick={() => setNeuOffen(true)}
        />
      )}

      {neuOffen && (
        <ItemActionSheet
          modus="neu"
          services={services}
          onClose={() => setNeuOffen(false)}
          onAdd={(punkt) => {
            setErr(null);
            return actions.add(punkt); // wirft bei Fehler → der Dialog zeigt die Meldung, bleibt offen
          }}
        />
      )}

      {actionItem && (
        <ItemActionSheet
          // Beim Wechsel eines anderen Punkts frischen Dialog-Zustand aufbauen.
          key={actionItem.id}
          item={actionItem}
          services={services}
          onClose={() => setActionItem(null)}
          onUpdate={(fields) => handleUpdate(actionItem.id, fields)}
          vorBeginn={actionItem.vorBeginn}
          onSetVorBeginn={(vorBeginn) => actions.setVorBeginn(actionItem.id, vorBeginn)}
          onRequestDelete={() => setPendingDelete(actionItem)}
        />
      )}

      {setlistTour && (
        <Coachmarks
          steps={SETLIST_STEPS}
          onClose={() => {
            markTourDone(TOUR_SETLIST);
            setSetlistTour(false);
          }}
        />
      )}
      {editTour && (
        <Coachmarks
          steps={SETLIST_EDIT_STEPS}
          onClose={() => {
            markTourDone(TOUR_SETLIST_EDIT);
            setEditTour(false);
          }}
        />
      )}
    </>
  );

  // Linie „Beginn" in der Bearbeiten-Liste – dieselbe Regel wie in der Ansicht (#423).
  const beginnBeiBearbeiten = beginnStelle(localItems);

  return (
    <SeitenGeruest
      titel={service.name}
      unterzeile={`${service.weekday}, ${service.day}. ${service.month} · ${service.time}`}
      zurueck={onBack}
      zurueckLabel="Termine"
      aktionen={aktionen}
      onNeuLaden={editMode ? undefined : onRetry}
      ueberlagerung={ueberlagerung}
    >
      {isLoading ? (
        <CenterMessage loading text="Ablauf wird geladen…" />
      ) : isError ? (
        <CenterMessage icon="⚠️" text="Ablauf konnte nicht geladen werden." onRetry={onRetry} />
      ) : items.length === 0 ? (
        <CenterMessage icon="📋" text="Dieser Ablauf enthält noch keine Punkte." />
      ) : editMode ? (
        <>
          <div className={styles.editHint}>
            {isReordering ? (
              'Speichere…'
            ) : (
              <>
                Ziehen <Icon name="grip" size={14} className={styles.hintIcon} /> zum Sortieren ·
                Eintrag antippen zum Bearbeiten.
              </>
            )}
          </div>
          {err && <div className={styles.editError}>{err}</div>}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            onDragCancel={resetViewportAfterDrag}
            autoScroll={innerScrollOnly}
          >
            <SortableContext
              items={localItems.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className={styles.list}>
                {localItems.map((item, i) => (
                  <Fragment key={item.id}>
                    {i === beginnBeiBearbeiten && <BeginnLinie zeit={service.time} />}
                    <SortableRow item={item} onOpenActions={setActionItem} />
                  </Fragment>
                ))}
                {beginnBeiBearbeiten === localItems.length && <BeginnLinie zeit={service.time} />}
              </div>
            </SortableContext>
          </DndContext>
        </>
      ) : (
        <AgendaFullView
          items={items}
          eventId={service.id}
          beginn={service.time}
          onSelect={onSelect}
        />
      )}
    </SeitenGeruest>
  );
}
