import { useCallback } from 'react';
import { VIEW_NS } from '../services/teamNotes';
import {
  anmerkungsquelleFuer,
  drawKeyForPage,
  pageLabelFor,
  viewKeyForPage,
  zoomKeyBaseForPage,
} from '../utils/chartPageKeys';
import type { SongSettings } from '../utils/chartSettings';
import type { StreamOwner } from '../utils/streamCompose';
import type { useTeamNotesImport } from './useTeamNotesImport';

type TeamNotes = ReturnType<typeof useTeamNotesImport>;

/**
 * **Die Schlüssel je Seite im Lied-Blatt** (#845, Scheibe 4e: aus `ChordChart` herausgezogen, unverändert) – unter
 * welchem Schlüssel eine Strom-Seite ihre Anmerkungen und ihren Zoom ablegt, was „Notizen von …“ dazu zeigt, die
 * Seitenangabe im Kopf und im Scroll-Modus die Anmerkungen einer ganzen Rolle. Die Regeln selbst stehen in
 * `utils/chartPageKeys`.
 */
export function useSeitenSchluessel({
  owners,
  publishedSettings,
  effSettings,
  viewing,
  viewMode,
}: {
  owners: StreamOwner[];
  publishedSettings: Record<number, SongSettings>;
  effSettings: Record<number, SongSettings>;
  viewing: TeamNotes['viewing'];
  viewMode: TeamNotes['viewMode'];
}) {
  // Anmerkungs-/Zoom-Schlüssel je Strom-Seite. Die Regeln – welche Darstellungsart gilt, wann es
  // KEINEN Schlüssel gibt – stehen rein und getestet in `utils/chartPageKeys` (#314); hier nur die
  // Verdrahtung an die aktuellen Daten.
  const drawKeyFor = (page: number): string | null =>
    drawKeyForPage(page, owners, publishedSettings, effSettings);
  const zoomKeyBaseFor = (page: number): string =>
    zoomKeyBaseForPage(page, owners, publishedSettings, effSettings);
  const pageLabel = (activePg: number, pageIdx: number): string | null =>
    pageLabelFor(activePg, pageIdx, owners);
  // „Notizen von …": stabile Identität für die PageDeck-Effekte, deshalb `useCallback`.
  // `viewingId` gehört bewusst in die Abhängigkeiten, obwohl er im Schlüssel nicht vorkommt: Beim
  // Wechsel auf eine andere Person mit derselben Ebene bliebe die Funktion sonst identisch, und
  // PageDeck bekäme kein Signal, den Ansichts-Spiegel neu zu lesen.
  const viewingId = viewing?.id ?? null;
  const viewingSongId = viewing?.songId ?? null;
  const viewingLyr = viewing?.lyr ?? false;
  // SEIN Arrangement (#320, 3c) – gesucht wird unter dem Schlüssel des Kollegen, nicht dem eigenen.
  const viewingArr = viewing?.arrangementId ?? null;
  const viewKeyFor = useCallback(
    (page: number): string | null =>
      viewKeyForPage(
        page,
        owners,
        viewingId == null || viewingSongId == null
          ? null
          : { songId: viewingSongId, lyr: viewingLyr, arrangementId: viewingArr },
        VIEW_NS,
      ),
    [owners, viewingId, viewingSongId, viewingLyr, viewingArr],
  );
  /** Scroll-Modus: welche Anmerkungen eine Seite zeigt – bei der Rolle die aller A4-Seiten des Lieds (#614). */
  const anmerkungFuer = (page: number) =>
    anmerkungsquelleFuer(
      page,
      owners,
      publishedSettings,
      effSettings,
      viewingId == null || viewingSongId == null
        ? null
        : { songId: viewingSongId, lyr: viewingLyr, arrangementId: viewingArr },
      VIEW_NS,
      viewMode === 'merge',
    );

  return { drawKeyFor, zoomKeyBaseFor, pageLabel, viewKeyFor, anmerkungFuer };
}
