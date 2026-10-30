import { useEffect, useState } from 'react';
import type { Service } from '@shared/types/index';
import type { DirektLink } from '@shared/ct/musikAppLink';
import type { TabId } from '../components/TabBar';
import { type View, type PersistedNav, loadNav, saveNav, clearNav } from '../utils/navStorage';

interface UseAppNavArgs {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  /** Geladene Terminliste – nötig, um den gespeicherten Gottesdienst nach einem Kaltstart wiederzufinden. */
  services: Service[] | undefined;
  servicesLoading: boolean;
  /** Ein Direktlink aus dem Dienstplaner (`useDirektLink`) – geht vor dem gemerkten Stand. */
  direkt?: DirektLink | null;
}

interface AppNav {
  /** Beim Mount einmalig gelesener gespeicherter Stand (oder null). */
  restored: PersistedNav | null;
  tab: TabId;
  setTab: (t: TabId) => void;
  view: View;
  setView: (v: View) => void;
  service: Service | null;
  setService: (s: Service | null) => void;
  songIndex: number;
  setSongIndex: (i: number) => void;
  libSel: { songId: number; arrangementId?: number } | null;
  setLibSel: (s: { songId: number; arrangementId?: number } | null) => void;
  /**
   * Kam die App über einen Direktlink (Dienstplaner, „In der Musik-App öffnen“, E6-O O4), der Ablaufpunkt, zu dessen
   * Lied das Blatt springen soll – bis die App ihn gefunden hat (`zielErreicht`), sonst `null`.
   */
  zielPunkt: number | null;
  zielErreicht: () => void;
}

/**
 * Navigations-Zustand der App (Tab / Vollbild-Ansicht / gewählter Gottesdienst & Lied) inklusive
 * Persistenz gegen den iOS-PWA-Kaltstart: sichert den Stand laufend und stellt ihn beim Start wieder
 * her. Reine Zustands-/Speicherlogik – ohne sie wäre `App` mit drei Effekten und sechs States voll.
 */
export function useAppNav({
  isAuthenticated,
  isAuthLoading,
  services,
  servicesLoading,
  direkt = null,
}: UseAppNavArgs): AppNav {
  // Einmalig beim Mount: ein Direktlink (Termin + Punkt: das Lied; nur Termin: sein Ablauf) – sonst der gespeicherte
  // Stand (oder null).
  const [restored] = useState<PersistedNav | null>(() =>
    direkt
      ? {
          tab: 'termine',
          view:
            direkt.punktId === undefined
              ? { type: 'setlist' }
              : { type: 'chart', source: 'setlist' },
          serviceId: direkt.terminId,
          songIndex: 0,
          libSel: null,
          savedAt: Date.now(),
        }
      : loadNav(),
  );
  const [zielPunkt, setZielPunkt] = useState<number | null>(direkt?.punktId ?? null);
  const [tab, setTab] = useState<TabId>(() => restored?.tab ?? 'termine');
  const [view, setView] = useState<View>(() => restored?.view ?? null);
  const [service, setService] = useState<Service | null>(null);
  const [songIndex, setSongIndex] = useState(() => restored?.songIndex ?? 0);
  const [libSel, setLibSel] = useState<{ songId: number; arrangementId?: number } | null>(
    () => restored?.libSel ?? null,
  );

  // Nach dem Abmelden (nicht: während des initialen Auth-Ladens) zurück in den Startzustand
  // und gespeicherte Ansicht verwerfen.
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      setService(null);
      setView(null);
      setTab('termine');
      setSongIndex(0);
      setLibSel(null);
      clearNav();
    }
  }, [isAuthLoading, isAuthenticated]);

  // Wiederherstellung: gespeicherten Gottesdienst anhand der ID erneut auswählen, sobald die
  // Terminliste geladen ist. Nur wenn eine Ansicht wiederhergestellt wurde (view != null).
  // Lässt er sich nicht finden (z. B. nicht mehr in der Liste), zurück zur Startansicht –
  // damit hängt nichts im Lade-Screen.
  //
  // **Nur für eine Ansicht, die einen Gottesdienst braucht** (09.10.2026, Alwin: „Lieder lassen sich
  // nicht aus der Liedliste öffnen – kurz auf, dann zurück"). Vorher griff die Suche bei JEDER Ansicht:
  // Stand der gemerkte Gottesdienst nicht in der Liste (vergangen; in der Test-Instanz gab es gar keine
  // kommenden), warf das Öffnen eines Lieds aus der Liederliste sofort zurück – und ebenso ein nach dem
  // Kaltstart wiederhergestelltes Lied aus der Liederliste.
  useEffect(() => {
    if (!restored?.serviceId || service || !isAuthenticated || !view) return;
    const brauchtDienst =
      view.type === 'setlist' || (view.type === 'chart' && view.source === 'setlist');
    if (!brauchtDienst || servicesLoading) return;
    const found = services?.find((s) => s.id === restored.serviceId);
    if (found) setService(found);
    else {
      setView(null);
      // Den Termin gibt es hier nicht (etwa außerhalb der geladenen Wochen) – dann auch kein Lied mehr suchen.
      setZielPunkt(null);
    }
  }, [restored, service, isAuthenticated, view, servicesLoading, services]);

  // Aktuellen Stand sichern (nur eingeloggt), damit ein iOS-PWA-Kaltstart unsichtbar bleibt.
  useEffect(() => {
    if (!isAuthenticated) return;
    saveNav({ tab, view, serviceId: service?.id ?? null, songIndex, libSel, savedAt: Date.now() });
  }, [isAuthenticated, tab, view, service, songIndex, libSel]);

  return {
    restored,
    tab,
    setTab,
    view,
    setView,
    service,
    setService,
    songIndex,
    setSongIndex,
    libSel,
    setLibSel,
    zielPunkt,
    zielErreicht: () => setZielPunkt(null),
  };
}
