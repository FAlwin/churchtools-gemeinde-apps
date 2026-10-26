import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AgendaItem, AgendaServiceOption, Service, SetlistSong } from '@shared/types/index';
import { SeitenGeruest } from '../components/SeitenGeruest';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { CenterMessage } from '../components/CenterMessage';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { AgendaFullView } from '../components/AgendaFullView';
import { LiedVerknuepfen } from '../components/LiedVerknuepfen';
import { AblaufNeuAufsetzen } from '../components/AblaufAnlegenFenster';
import { Icon } from '@ui/icons/icons';
import {
  useAblaufBearbeiten,
  verlangtNeuLaden,
  type AblaufAktionen,
} from '@ui/ablauf/useAblaufBearbeiten';
import { ApiError } from '../services/api';
import { useAblaufAbschliessen } from '../hooks/useServices';
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
import { loadSongPdfOpts } from '../utils/songPdfOpts';
import { useAppLogo } from '../hooks/useAppLogo';
import { schluessel } from '../hooks/abfrageSchluessel';

/** Der Hinweis, wenn man einen abgeschlossenen Ablauf ändern will (Alwin, 13.10.2026). */
const GESPERRT =
  'Dieser Ablauf ist in ChurchTools abgeschlossen. Zum Ändern oben rechts das Schloss antippen.';

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
  /** Bearbeiten-Aktionen (Reihenfolge, Löschen, Feld-Änderungen, Anlegen) – `ui/ablauf/useAblaufBearbeiten`. */
  actions: AblaufAktionen;
  isReordering?: boolean;
  /** Verfügbare ChurchTools-Dienste (Chips im Verantwortlich-Editor). */
  services: AgendaServiceOption[];
  /** Darf der Nutzer den Ablauf bearbeiten? (blendet die Bearbeiten-UI aus) */
  canEdit?: boolean;
  /** Sieht der Nutzer nicht alle Dienstgruppen (#676)? Dann warnt die Bearbeiten-Liste vor verlorenen Gruppen-Infos. */
  gruppenVerborgen?: boolean;
  /** Steht die Ablauf-Ansicht gerade? (für das Gesehen-Merken, siehe `AgendaFullView.onSichtbar`) */
  onAblaufSichtbar?: (sichtbar: boolean) => void;
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
  gruppenVerborgen = false,
  onAblaufSichtbar,
}: SetlistProps) {
  const [editMode, setEditMode] = useState(false);
  // Geführte Einführung (#Onboarding, Gruppen 3+4): Ablauf-Ansicht beim ersten Öffnen, Bearbeiten-
  // Modus beim ersten Wechsel dorthin. Startet erst, wenn die Ziel-Elemente gerendert sind.
  const [setlistTour, setSetlistTour] = useState(false);
  const [editTour, setEditTour] = useState(false);
  /**
   * **Abgeschlossen** (Alwin, 09.10.2026): In ChurchTools kann man einen Ablauf abschließen; dann lässt
   * ChurchTools kein Ändern zu. Vorher meldete die App beim Löschen nur „Keine Berechtigung". In der Ansicht
   * bewusst kein Hinweis (Alwin). Beim Bearbeiten steht oben rechts statt des Schlosses zum Abschließen
   * „Ablauf öffnen" – und wer trotzdem etwas ändern will (Punkt antippen, ziehen, Plus), bekommt den
   * Hinweis `GESPERRT` (Alwin, 13.10.2026: „nur der Knopf"; vorher ein großer Kasten über dem Ablauf).
   */
  const abgeschlossen = service.ablaufAbgeschlossen === true;
  const abschluss = useAblaufAbschliessen(service.id);
  const [abschliessenFrage, setAbschliessenFrage] = useState(false);
  // „Neu aufsetzen …“ (E6-5b) – Fenster und Nachfrage in `AblaufNeuAufsetzen`.
  const [neuAufsetzenOffen, setNeuAufsetzenOffen] = useState(false);
  const qc = useQueryClient();
  // Liederheft: dasselbe Logo wie auf dem Liedblatt, vorgeladen – samt Gemeinde-Schalter (19.10.2026).
  const logo = useAppLogo();

  // Die Bearbeiten-Liste (`ui/ablauf/useAblaufBearbeiten`, E6-2b-3). Hat in der Zwischenzeit jemand den Ablauf
  // abgeschlossen (423 vom Schreib-Kern), den Termin neu holen: Dann erscheint gleich der Hinweis mit „Ablauf öffnen".
  const bearbeiten = useAblaufBearbeiten({
    aktiv: editMode,
    bereit: !isLoading && !isError,
    items,
    beginn: service.time,
    abgeschlossen,
    sperrHinweis: GESPERRT,
    speichertGerade: isReordering,
    gruppenVerborgen,
    aktionen: actions,
    dienste: services,
    liedWahl: (args) => <LiedVerknuepfen {...args} />,
    beiFehler: (e) => {
      if (e instanceof ApiError && e.status === 423) {
        void qc.invalidateQueries({ queryKey: schluessel.termine() });
      }
      // Ablauf inzwischen anders (E6-3c: auch 412) – frisch holen, statt bis zum nächsten Abgleich den alten zu zeigen.
      if (verlangtNeuLaden(e))
        void qc.invalidateQueries({ queryKey: schluessel.agenda(service.id) });
    },
    neuAufsetzen: () => setNeuAufsetzenOffen(true),
  });
  const { fehlerZeigen } = bearbeiten;

  function abschlussSetzen(zu: boolean): void {
    bearbeiten.fehlerLoeschen();
    abschluss.mutate(zu, {
      onError: (e) =>
        fehlerZeigen(
          e,
          zu ? 'Ablauf konnte nicht abgeschlossen werden.' : 'Ablauf konnte nicht geöffnet werden.',
        ),
    });
  }

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
   * Die Knöpfe im Seitenkopf (`KopfKnopf`, Scheibe S, 26.10.2026): mit Rahmen und Beschriftung wie in ChurchTools,
   * „Bearbeiten“ blau als Hauptaktion; am Handy nur das Symbol. Vorher runde Knöpfe (`RundKnopf`, 02.10.2026).
   */
  // Auch bei einem LEEREN Ablauf (13.10.2026): Sonst gab es keinen Stift, und ein in der App leer
  // angelegter Ablauf ließ sich nicht füllen. Das Teilen braucht Lieder und fragt selbst (`teilbar`).
  const aktionen =
    !isLoading && !isError ? (
      <>
        {teilbar.length > 0 && !editMode && (
          <KopfKnopf
            onClick={teilenOeffnen}
            label="Teilen"
            title="Alle Lieder als PDF teilen"
            dataTour="setlist-share"
            symbol={<Icon name="share" size={18} stroke={2.2} />}
          />
        )}
        {canEdit && editMode && !abgeschlossen && (
          <KopfKnopf
            onClick={() => setAbschliessenFrage(true)}
            label="Abschließen"
            title="Ablauf abschließen"
            dataTour="edit-lock"
            symbol={<Icon name="lock" size={18} stroke={2.2} />}
          />
        )}
        {/* Öffnen ohne Rückfrage – es zerstört nichts. */}
        {canEdit && editMode && abgeschlossen && (
          <KopfKnopf
            onClick={() => !abschluss.isPending && abschlussSetzen(false)}
            label="Öffnen"
            title="Ablauf öffnen"
            dataTour="edit-lock"
            aktiv
            symbol={<Icon name="lock-open" size={18} stroke={2.2} />}
          />
        )}
        {canEdit && (
          <KopfKnopf
            onClick={() => {
              bearbeiten.fehlerLoeschen();
              setEditMode((v) => !v);
            }}
            label={editMode ? 'Fertig' : 'Bearbeiten'}
            title={editMode ? 'Fertig' : 'Ablauf bearbeiten'}
            haupt
            dataTour="setlist-edit"
            symbol={<Icon name={editMode ? 'check' : 'pencil'} size={18} stroke={2.2} />}
          />
        )}
      </>
    ) : undefined;

  /** Dialoge und Fenster schweben über dem Inhalt – sie scrollen nicht mit. */
  const ueberlagerung = (
    <>
      {neuAufsetzenOffen && (
        <AblaufNeuAufsetzen termin={service} onClose={() => setNeuAufsetzenOffen(false)} />
      )}

      {teilenOffen && (
        <TeilenFenster
          titel="Ablauf teilen"
          dateiname={service.name || 'Ablauf'}
          bauen={ablaufPdf}
          onClose={() => setTeilenOffen(false)}
        />
      )}

      {abschliessenFrage && (
        <ConfirmDialog
          title="Ablauf abschließen?"
          message="Danach kann niemand den Ablauf mehr ändern – weder hier noch in ChurchTools –, bis ihn jemand wieder öffnet. Teilen sich mehrere Termine diesen Ablauf, gilt es für alle."
          confirmLabel="Abschließen"
          onConfirm={() => {
            setAbschliessenFrage(false);
            abschlussSetzen(true);
          }}
          onCancel={() => setAbschliessenFrage(false)}
        />
      )}

      {bearbeiten.ueberlagerung}

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
        <CenterMessage
          icon="warnung"
          text="Ablauf konnte nicht geladen werden."
          onRetry={onRetry}
        />
      ) : items.length === 0 ? (
        <CenterMessage icon="calendar" text="Dieser Ablauf enthält noch keine Punkte." />
      ) : editMode ? (
        bearbeiten.liste
      ) : (
        <AgendaFullView
          items={items}
          eventId={service.id}
          beginn={service.time}
          onSelect={onSelect}
          onSichtbar={onAblaufSichtbar}
        />
      )}
    </SeitenGeruest>
  );
}
