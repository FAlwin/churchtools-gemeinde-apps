import { useEffect, useState } from 'react';
import type { Service } from '@shared/types/index';
import { SeitenGeruest } from '../components/SeitenGeruest';
import { CenterMessage } from '../components/CenterMessage';
import { Segment } from '@ui/bedienung/Segment';
import { Icon } from '@ui/icons/icons';
import { Spinner } from '../components/Spinner';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { usePastServices, useServicesOhneAblauf } from '../hooks/useServices';
import { useSiteConfig } from '../hooks/useSiteConfig';
import { AblaufAnlegenFenster } from '../components/AblaufAnlegenFenster';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineServices } from '../hooks/useOfflineServices';
import { heuteIso } from '../utils/heute';
import { saveServiceOffline } from '../services/offline';
import { liedAnzahl } from '../utils/songFilter';
import { queryClient } from '../queryClient';
import styles from './Agenda.module.scss';
import { standKurz } from '../utils/zeitstempel';
import { funktionen } from '../services/funktionen';
import { agendaAbfrage } from '../hooks/abfrageSchluessel';
import { DatumKachel } from '@ui/bedienung/DatumKachel';

interface AgendaProps {
  services: Service[];
  isLoading?: boolean;
  isError?: boolean;
  /**
   * Neu laden. Gibt das Versprechen des Abrufs zurück, damit die Ladeanzeige beim Runterziehen
   * so lange steht, bis die Termine wirklich da sind (22.09.2026).
   */
  onRetry?: () => Promise<unknown>;
  onSelect: (service: Service) => void;
  /** Öffnet direkt das „Liederheft" (Lieder-Charts) des Gottesdienstes. */
  onOpenSongs: (service: Service) => void;
  /**
   * Darf Abläufe anlegen (Recht „Ablauf bearbeiten" in ChurchTools, 13.10.2026). Ohne das Recht stehen
   * Termine ohne Ablauf trotzdem in der Liste – nur ohne „Ablauf anlegen".
   */
  kannAblaufAnlegen?: boolean;
}

const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

const OFFLINE_HINT = 'Offline nicht verfügbar – einmal online öffnen oder vorher speichern.';

/** Gruppiert Gottesdienste nach „Monat JJJJ" (Reihenfolge der Eingabe bleibt erhalten). */
function groupByMonth(list: Service[]): { key: string; items: Service[] }[] {
  const groups: { key: string; items: Service[] }[] = [];
  for (const s of list) {
    const [y, m] = s.date.split('-');
    const key = `${MONTHS[Number(m) - 1]} ${y}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, items: [] };
      groups.push(g);
    }
    g.items.push(s);
  }
  return groups;
}

/** Übersicht der Gottesdienste (kommend + vergangen), nach Monat gruppiert. */
export function Agenda({
  services,
  isLoading,
  isError,
  onRetry,
  onSelect,
  onOpenSongs,
  kannAblaufAnlegen = false,
}: AgendaProps) {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [monthsBack, setMonthsBack] = useState(1);
  // Gerade laufende „Für offline speichern"-Aktion (Termin-Zeile) → Spinner statt Knopf.
  const [savingId, setSavingId] = useState<number | null>(null);

  const online = useOnlineStatus();
  const offlineReg = useOfflineServices();
  const { toast, showToast } = useToast();

  // Vergangene Gottesdienste werden live geladen → ohne Netz nicht verfügbar. War man auf
  // „Vergangene" und geht offline, zurück auf „Kommende" (das Segment graut „Vergangene" aus).
  useEffect(() => {
    if (!online && tab === 'past') setTab('upcoming');
  }, [online, tab]);

  const today = heuteIso();
  const pastQuery = usePastServices(monthsBack, tab === 'past' && online);
  // Termine ohne Ablauf (13.10.2026) – nur, wenn die Verwaltung Kalender dafür gewählt hat.
  const regel = useSiteConfig().data.ablaufAnlegen;
  const ohneQuery = useServicesOhneAblauf(
    online && tab === 'upcoming' && (regel?.kalenderIds.length ?? 0) > 0,
  );
  const [anlegenFuer, setAnlegenFuer] = useState<Service | null>(null);
  const mitAblaufIds = new Set(services.map((s) => s.id));
  // Hat einer inzwischen einen Ablauf (in ChurchTools angelegt), steht er nur noch oben – nie doppelt.
  const ohneAblauf = (ohneQuery.data ?? []).filter(
    (s) => s.date >= today && !mitAblaufIds.has(s.id),
  );
  const ohneIds = new Set(ohneAblauf.map((s) => s.id));
  const upcoming = [...services, ...ohneAblauf]
    .filter((s) => s.date >= today)
    .sort((a, b) => a.start.localeCompare(b.start));
  const past = [...(pastQuery.data ?? [])]
    .filter((s) => s.date < today)
    .sort((a, b) => b.start.localeCompare(a.start));

  /** Lädt einen kommenden Gottesdienst komplett in den Offline-Vorrat (Zeilen-Knopf). */
  async function saveRow(s: Service) {
    if (savingId !== null) return;
    setSavingId(s.id);
    try {
      const items = await queryClient.fetchQuery(agendaAbfrage(s.id));
      const { total, failed } = await saveServiceOffline({ id: s.id, date: s.date }, items);
      // Teilweise geladen ist NICHT „gespeichert" (#277): Sonst verlässt sich jemand im Saal darauf
      // und die Dokumente fehlen. Die geglückten Dateien bleiben im Vorrat – erneut versuchen lädt
      // nur das Fehlende nach.
      if (failed > 0) {
        showToast(
          failed === total
            ? 'Keine Dokumente konnten geladen werden – bitte erneut versuchen.'
            : `${failed} von ${total} Dokumenten konnten nicht geladen werden – bitte erneut versuchen.`,
        );
      }
    } catch {
      showToast('Speichern fehlgeschlagen – bitte erneut versuchen.');
    } finally {
      setSavingId(null);
    }
  }

  /** Eine Veranstaltung ohne Ablauf: graue Kachel, „Kein Ablauf", rechts „Ablauf anlegen". */
  function ohneAblaufZeile(s: Service) {
    return (
      <div key={s.id} className={styles.card}>
        <button
          className={styles.cardMain}
          onClick={() =>
            kannAblaufAnlegen
              ? setAnlegenFuer(s)
              : showToast('Für diese Veranstaltung gibt es noch keinen Ablauf.')
          }
        >
          <DatumKachel tag={s.day} monat={s.month} gedimmt />
          <div className={styles.info}>
            <div className={`${styles.svcName} ${styles.svcNameOhne}`}>{s.name}</div>
            {/* „Kein Ablauf" VORN: Am Handy ist die Zeile schmal, und genau das muss sichtbar bleiben. */}
            <div className={styles.meta}>
              <span className={styles.keinAblauf}>Kein Ablauf</span>
              <span>{s.weekday.slice(0, 2)}</span>
              <span className={styles.dotSep}>·</span>
              <span>{s.time}</span>
            </div>
          </div>
          {kannAblaufAnlegen && (
            <span className={styles.ablaufAnlegen} aria-label="Ablauf anlegen">
              <Icon name="plus" size={14} stroke={2.4} />
              Anlegen
            </span>
          )}
        </button>
      </div>
    );
  }

  function row(s: Service) {
    if (ohneIds.has(s.id)) return ohneAblaufZeile(s);
    const held = !!offlineReg[s.id];
    // Ohne Netz ist nur bedienbar, was offline vorliegt – alles andere ausgegraut + Hinweis.
    const blocked = !online && !held;
    const isFuture = s.date >= today;
    return (
      <div key={s.id} className={`${styles.card}${blocked ? ' ' + styles.cardOff : ''}`}>
        <button
          className={styles.cardMain}
          onClick={() => (blocked ? showToast(OFFLINE_HINT) : onSelect(s))}
        >
          <DatumKachel tag={s.day} monat={s.month} />
          <div className={styles.info}>
            <div className={styles.svcName}>
              {/* Dezenter Punkt (#143, wie „ungelesen"): Ablauf hat sich seit dem letzten
                  Reinschauen geändert; verschwindet beim Öffnen. */}
              {s.setlistChanged && (
                <span
                  className={styles.changedDot}
                  data-tour="setlist-geaendert"
                  title="Der Ablauf hat sich geändert, seit du diesen Termin zuletzt geöffnet hast"
                  aria-label="Ablauf geändert"
                />
              )}
              {s.name}
              {s.subtitle && <span className={styles.subtitlePart}> · {s.subtitle}</span>}
            </div>
            <div className={styles.meta}>
              <span>{s.weekday}</span>
              <span className={styles.dotSep}>·</span>
              <span>{s.time}</span>
            </div>
          </div>
          {funktionen.offline && held && (
            <span
              className={styles.offBadge}
              data-tour="offline"
              title={`Offline verfügbar (Stand ${standKurz(offlineReg[s.id].savedAt)})`}
              aria-label="Offline verfügbar"
            >
              <Icon name="cloud-check" size={18} stroke={2} />
            </span>
          )}
          <Icon name="chev-right" size={18} stroke={2.2} className={styles.chev} />
        </button>
        {/* Kommender, noch nicht gespeicherter GD → per Knopf offline verfügbar machen (#32). */}
        {funktionen.offline && isFuture && !held && online && (
          <button
            className={styles.songBook}
            data-tour="offline"
            onClick={() => void saveRow(s)}
            disabled={savingId !== null}
            aria-label="Für offline speichern"
            title="Für offline speichern"
          >
            {savingId === s.id ? <Spinner /> : <Icon name="cloud-download" size={21} stroke={2} />}
          </button>
        )}
        {s.songCount > 0 && (
          <button
            className={styles.songBook}
            data-tour="songbook"
            onClick={() => (blocked ? showToast(OFFLINE_HINT) : onOpenSongs(s))}
            aria-label={`Liederheft öffnen (${liedAnzahl(s.songCount)})`}
            title="Liederheft öffnen"
          >
            <Icon name="music" size={21} stroke={2.2} />
            {/* Kleine Zahl am Noten-Knopf = Anzahl Lieder (früher in der Textzeile, dort abgeschnitten). */}
            <span className={styles.songCount}>{s.songCount}</span>
          </button>
        )}
      </div>
    );
  }

  function groups(list: Service[]) {
    return groupByMonth(list).map((g, gi) => (
      <div key={g.key} className={styles.group}>
        <div className={styles.groupHdr}>{g.key}</div>
        {/* Erste Monatsgruppe trägt den Tour-Marker (Einführung hebt die Terminliste hervor). */}
        <div className={styles.cardList} data-tour={gi === 0 ? 'termine-liste' : undefined}>
          {g.items.map(row)}
        </div>
      </div>
    ));
  }

  return (
    <SeitenGeruest
      titel="Termine"
      onNeuLaden={
        tab === 'upcoming'
          ? () => Promise.all([onRetry?.(), ohneQuery.isEnabled ? ohneQuery.refetch() : null])
          : () => pastQuery.refetch()
      }
      // In der Überlagerung, nicht im Inhalt: Dort scrollte das Fenster mit und wurde abgeschnitten
      // (im Bildschirmfoto gesehen, 13.10.2026) – wie die Fenster der Verwaltung (`useVerwaltung`).
      ueberlagerung={
        <>
          <Toast message={toast} />
          {anlegenFuer && (
            <AblaufAnlegenFenster
              termin={anlegenFuer}
              mitAblauf={services}
              onClose={() => setAnlegenFuer(null)}
              onAngelegt={(t) => {
                setAnlegenFuer(null);
                // Den frischen Termin öffnen: Der Ablauf ist da, die Liste lädt im Hintergrund neu.
                onSelect({ ...t, songCount: 0 });
              }}
            />
          )}
        </>
      }
    >
      <Segment
        className={styles.segWrap}
        value={tab}
        options={[
          { value: 'upcoming', label: 'Kommende' },
          { value: 'past', label: 'Vergangene' },
        ]}
        dimmed={online ? [] : ['past']}
        onChange={(v) => {
          if (!online && v === 'past') {
            showToast('Vergangene Gottesdienste sind offline nicht verfügbar.');
            return;
          }
          setTab(v);
        }}
      />
      {tab === 'upcoming' ? (
        isLoading ? (
          <CenterMessage loading text="Gottesdienste werden geladen…" />
        ) : isError ? (
          <CenterMessage
            icon="⚠️"
            text="Gottesdienste konnten nicht geladen werden."
            onRetry={onRetry}
          />
        ) : upcoming.length === 0 ? (
          <CenterMessage icon="📅" text="Keine kommenden Gottesdienste." />
        ) : (
          groups(upcoming)
        )
      ) : !online ? (
        <CenterMessage icon="📴" text="Vergangene Gottesdienste sind offline nicht verfügbar." />
      ) : pastQuery.isLoading ? (
        <CenterMessage loading text="Vergangene werden geladen…" />
      ) : pastQuery.isError ? (
        <CenterMessage
          icon="⚠️"
          text="Vergangene konnten nicht geladen werden."
          onRetry={() => pastQuery.refetch()}
        />
      ) : (
        <>
          {past.length === 0 ? (
            <CenterMessage icon="📅" text="Keine vergangenen Gottesdienste im Zeitraum." />
          ) : (
            groups(past)
          )}
          <button
            className={styles.loadMore}
            disabled={pastQuery.isFetching}
            onClick={() => setMonthsBack((m) => m + 1)}
          >
            {pastQuery.isFetching ? 'Lädt…' : 'Mehr laden'}
          </button>
        </>
      )}
    </SeitenGeruest>
  );
}
