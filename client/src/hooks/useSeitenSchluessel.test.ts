// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { VIEW_NS } from '../services/teamNotes';
import {
  anmerkungsquelleFuer,
  drawKeyForPage,
  pageLabelFor,
  viewKeyForPage,
  zoomKeyBaseForPage,
} from '../utils/chartPageKeys';
import { DEFAULT_SETTINGS, type SongSettings } from '../utils/chartSettings';
import type { StreamOwner } from '../utils/streamCompose';
import { useSeitenSchluessel } from './useSeitenSchluessel';

/**
 * `useSeitenSchluessel` (#845, 4e) – die Verdrahtung der Seiten-Schlüssel im Lied-Blatt. Die Regeln selbst prüft
 * `chartPageKeys.test.ts`; hier, dass jede Seite IHREN Schlüssel bekommt und „Notizen von …“ richtig angeschlossen ist.
 * Erwartet wird gegen dieselben Erzeuger, nicht gegen handgeschriebene Schlüssel.
 */
const owner = (over: Partial<StreamOwner>): StreamOwner => ({
  songIdx: 0,
  songId: 12,
  localPage: 0,
  kind: 'chord',
  versionKey: 'original',
  arrangementId: 45,
  ...over,
});
// Lied 12 mit zwei Seiten, dann Lied 13.
const owners = [
  owner({}),
  owner({ localPage: 1 }),
  owner({ songIdx: 1, songId: 13, arrangementId: 46 }),
];
const settings: Record<number, SongSettings> = { 12: DEFAULT_SETTINGS, 13: DEFAULT_SETTINGS };
const kollege = {
  id: 7,
  name: 'Jonas',
  songId: 12,
  versionKey: 'original',
  lyr: false,
  arrangementId: 45,
};
type Props = Parameters<typeof useSeitenSchluessel>[0];
const mit = (over: Partial<Props> = {}) =>
  renderHook((p: Props) => useSeitenSchluessel(p), {
    initialProps: {
      owners,
      publishedSettings: settings,
      effSettings: settings,
      viewing: null,
      viewMode: 'view',
      ...over,
    },
  });

describe('useSeitenSchluessel', () => {
  it('jede Seite hat ihren eigenen Anmerkungs- und Zoom-Schlüssel, die Seitenangabe zählt im Lied', () => {
    const { result } = mit();
    expect(result.current.drawKeyFor(2)).toBe(drawKeyForPage(2, owners, settings, settings));
    expect(result.current.drawKeyFor(2)).not.toBe(result.current.drawKeyFor(0));
    expect(result.current.zoomKeyBaseFor(2)).toBe(
      zoomKeyBaseForPage(2, owners, settings, settings),
    );
    expect(result.current.zoomKeyBaseFor(2)).not.toBe(result.current.zoomKeyBaseFor(0));
    expect(result.current.pageLabel(1, 1)).toBe(pageLabelFor(1, 1, owners));
    expect(result.current.pageLabel(1, 1)).toBe('Seite 2 / 2');
  });

  it('„Notizen von …“: Schlüssel der angesehenen Ebene je Seite – ohne Ansehen keiner', () => {
    expect(mit().result.current.viewKeyFor(1)).toBeNull();
    const { result } = mit({ viewing: kollege });
    const ebene = { songId: 12, lyr: false, arrangementId: 45 };
    expect(result.current.viewKeyFor(1)).toBe(viewKeyForPage(1, owners, ebene, VIEW_NS));
    expect(result.current.viewKeyFor(1)).not.toBeNull();
    expect(result.current.viewKeyFor(1)).not.toBe(result.current.viewKeyFor(0));
  });

  it('eine andere Person mit derselben Ebene → neue Funktion (sonst läse PageDeck den Spiegel nicht neu)', () => {
    const { result, rerender } = mit({ viewing: kollege });
    const vorher = result.current.viewKeyFor;
    rerender({
      owners,
      publishedSettings: settings,
      effSettings: settings,
      viewing: { ...kollege, id: 8, name: 'Lena' },
      viewMode: 'view',
    });
    expect(result.current.viewKeyFor).not.toBe(vorher);
  });

  it('Scroll-Modus: beim Zusammenführen zeigt die Seite auch die eigenen Anmerkungen', () => {
    const ebene = { songId: 12, lyr: false, arrangementId: 45 };
    const nur = mit({ viewing: kollege, viewMode: 'view' }).result.current.anmerkungFuer(0);
    const zusammen = mit({ viewing: kollege, viewMode: 'merge' }).result.current.anmerkungFuer(0);
    expect(nur).toEqual(anmerkungsquelleFuer(0, owners, settings, settings, ebene, VIEW_NS, false));
    expect(zusammen).toEqual(
      anmerkungsquelleFuer(0, owners, settings, settings, ebene, VIEW_NS, true),
    );
    expect(zusammen).not.toEqual(nur);
  });
});
