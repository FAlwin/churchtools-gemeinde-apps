import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AgendaItem } from '@shared/types/index';
import { useMarkSetlistSeen, useSetlistVersion } from './useServices';
import { schluessel } from './abfrageSchluessel';

/**
 * Live-Abgleich des geöffneten Ablaufs (#159/#161): Solange Ablauf oder Liederheft (aus dem
 * Ablauf) offen sind, wird alle 30 s (`ABLAUF_ABGLEICH_MS`, #557) der billige Fingerabdruck gepollt. Ändert er sich:
 * Die Ablauf-Ansicht lädt sofort nach (dort stört das nie); im Liederheft wird stattdessen
 * `chartOutdated` gesetzt (Hinweis-Balken) – NIE automatisch umsortieren, sonst springen mitten
 * im Spielen die Seiten unter den Fingern.
 *
 * Die Effekte sind über `lastLiveHash` idempotent (gleicher Hash → nichts zu tun), daher kommen
 * sie ohne reduzierte Dependency-Arrays aus.
 */
export function useSetlistLiveSync(args: {
  eventId: number | null;
  inSetlistView: boolean;
  inSetlistChart: boolean;
  online: boolean;
}): {
  chartOutdated: boolean;
  reloadAblauf: (eventId: number) => void;
  dismissChartOutdated: () => void;
} {
  const { eventId, inSetlistView, inSetlistChart, online } = args;
  const qc = useQueryClient();
  const liveVersion = useSetlistVersion(eventId, online && (inSetlistView || inSetlistChart));
  const [chartOutdated, setChartOutdated] = useState(false);
  const lastLiveHash = useRef<{ eventId: number; hash: string } | null>(null);

  // Ablauf neu laden (Live-Update): Der Server markiert die geänderten Punkte anhand des zuletzt
  // GESEHENEN Stands; gemerkt wird er, nachdem der neue Stand angezeigt wurde (useMarkSeenAfterShown).
  const reloadAblauf = useCallback(
    (id: number) => {
      void qc.invalidateQueries({ queryKey: schluessel.agenda(id) });
      setChartOutdated(false);
    },
    [qc],
  );

  useEffect(() => {
    const hash = liveVersion.data?.hash;
    if (hash === undefined || eventId == null) return;
    const prev = lastLiveHash.current;
    lastLiveHash.current = { eventId, hash };
    // Erster Poll für diesen Termin = Referenz, noch keine Änderung.
    if (!prev || prev.eventId !== eventId || prev.hash === hash) return;
    if (inSetlistView) reloadAblauf(eventId);
    else if (inSetlistChart) setChartOutdated(true);
  }, [liveVersion.data?.hash, eventId, inSetlistView, inSetlistChart, reloadAblauf]);

  useEffect(() => {
    // Vom Liederheft mit offenem „geändert"-Hinweis zurück in den Ablauf → dort direkt neu laden.
    if (chartOutdated && inSetlistView && eventId != null) reloadAblauf(eventId);
    // Termin komplett verlassen → Hinweis und Referenz zurücksetzen.
    if (!inSetlistView && !inSetlistChart) {
      setChartOutdated(false);
      lastLiveHash.current = null;
    }
  }, [chartOutdated, inSetlistView, inSetlistChart, eventId, reloadAblauf]);

  const dismissChartOutdated = useCallback(() => setChartOutdated(false), []);
  return { chartOutdated, reloadAblauf, dismissChartOutdated };
}

/**
 * „Gesehen" gilt, **sobald ein Stand mit Änderungen angezeigt wurde** (Alwin, 12.10.2026).
 *
 * Vorher galt es erst beim VERLASSEN eines Termins innerhalb der App (#143/#161). In der
 * ChurchTools-Erweiterung verlässt man aber meist die ganze Seite – dann lief nichts, und beim nächsten
 * Öffnen kamen dieselben Änderungen noch einmal („bleibt länger stehen"). Jetzt wird gemerkt, nachdem
 * der FRISCH geholte Ablauf in der Ablauf-Ansicht stand. Hinweis und Schildchen stehen ohnehin nur ein
 * paar Sekunden (`useKurzerHinweis`) – der nächste Abruf meldet nur, was seitdem dazukam.
 *
 * Geschrieben wird nur, wenn es etwas zu quittieren gibt (markierte Punkte) oder noch gar kein
 * Gesehen-Stand existiert (`changed` überall `undefined`) – in der Erweiterung ist jedes Merken ein
 * Schreiben in die Personen-Dateien, das soll nicht bei jedem Fokus passieren.
 */
export function useMarkSeenAfterShown(args: {
  eventId: number | null;
  /** Steht der Ablauf gerade in der Ablauf-Ansicht (nicht im Liederheft)? */
  angezeigt: boolean;
  items: AgendaItem[] | undefined;
  /** Zeitpunkt des Abrufs (`dataUpdatedAt`) – jeder neue Abruf wird höchstens einmal quittiert. */
  stand: number;
  /** Läuft gerade ein Abruf? Dann ist das Angezeigte (aus dem Speicher) nicht der aktuelle Stand. */
  laedt: boolean;
}): void {
  const { eventId, angezeigt, items, stand, laedt } = args;
  const { mutate } = useMarkSetlistSeen();
  const erledigt = useRef<string | null>(null);
  useEffect(() => {
    if (!angezeigt || eventId == null || !items || items.length === 0 || laedt || stand === 0)
      return;
    const schluessel = `${eventId}:${stand}`;
    if (erledigt.current === schluessel) return;
    const markiert = items.some((i) => i.changed || i.removed);
    const ohneBasis = items.every((i) => i.changed === undefined && !i.removed);
    if (!markiert && !ohneBasis) return;
    erledigt.current = schluessel;
    mutate({ eventId, refresh: markiert });
  }, [angezeigt, eventId, items, stand, laedt, mutate]);
}
