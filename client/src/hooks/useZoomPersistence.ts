import type { GespeicherterZoom } from '@shared/types/index';
import type { MutableRefObject } from 'react';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { pushField } from '../services/annotations';
import { deviceClass } from '../utils/deviceClass';
import {
  ZOOM_GRENZEN,
  ausschnittAus,
  transformAus,
  type Ausschnitt,
  type Blatt,
  type Flaeche,
} from '../utils/zoomAusschnitt';
import { lokalSchreiben } from '../utils/lokalSpeicher';

/** Gespeicherter Zoom – dieselbe Form wie im Konto-Sync (`@shared/types`, mit `fx`/`fy` seit #420). */
export type ZoomState = GespeicherterZoom;

interface UseZoomPersistenceParams {
  /** Basis-Schlüssel für den gespeicherten Zoom einer Seite (ohne Layout-Suffix). */
  zoomKeyBaseFor: (page: number) => string;
  /** Sichtbare Seiten je Ansicht (1 Hochformat / 2 Querformat). */
  perView: number;
  /** Index der ersten sichtbaren Seite. */
  pageIndex: number;
  /** Transform-Refs der sichtbaren Zoom-Ebenen (je Slot). */
  transformRefs: MutableRefObject<ReactZoomPanPinchRef | null>[];
  /** Letzter Zoom-Faktor je Slot (Nutzer-Herauszoomen ↔ programmatischer Reset). */
  lastScale: MutableRefObject<[number, number]>;
  /** Slot einer laufenden Pinch-/Pan-Geste (nur echte Gesten werden gesichert). */
  gestureSlot: MutableRefObject<number | null>;
  /** Welche sichtbaren Slots gerade reingezoomt sind. */
  zoomedSlots: [boolean, boolean];
  /** Fläche und Blatt eines Slots – für die Umrechnung in einen Ausschnitt (#420). */
  geometrie: (slot: number) => { flaeche: Flaeche; blatt: Blatt } | null;
  /**
   * Der zuletzt vom NUTZER gewählte (oder wiederhergestellte) Ausschnitt je Slot. Daraus stellt
   * `useZoomOrchestration` nach einer neuen Flächengröße denselben Ausschnitt her. Bewusst nicht aus
   * jedem `onTransformed` – die Neuausrichtung der Bibliothek nach einer Größenänderung würde ihn
   * sonst mit dem verrutschten Stand überschreiben.
   */
  letzterAusschnitt: MutableRefObject<[Ausschnitt | null, Ausschnitt | null]>;
}

/**
 * Kapselt das dauerhafte Speichern/Laden des Pinch-Zooms pro Seite.
 *
 * Der Zoom hängt an der Bildschirm-Geometrie → Geräteklasse UND Layout (1-spaltig
 * Hochformat / 2-spaltig Querformat) stecken im Schlüssel. Sonst würde ein im
 * Hochformat gespeicherter Pixel-Ausschnitt im Querformat (halbe Breite, 2 Seiten)
 * angewendet und die Seite „einfrieren" (#33).
 *
 * Bewusst NICHT memoisiert: die Funktionen werden je Render neu erzeugt (wie zuvor
 * als innere Funktionen in PageDeck) und in Effekten mit `exhaustive-deps`-Disable
 * verwendet – Verhalten unverändert, nur zentralisiert.
 */
export function useZoomPersistence({
  zoomKeyBaseFor,
  perView,
  pageIndex,
  transformRefs,
  lastScale,
  gestureSlot,
  zoomedSlots,
  geometrie,
  letzterAusschnitt,
}: UseZoomPersistenceParams) {
  const zoomKeyFor = (page: number): string =>
    `${zoomKeyBaseFor(page)}_d${deviceClass()}${perView}`;

  function loadZoom(page: number): ZoomState | null {
    try {
      const s = localStorage.getItem(zoomKeyFor(page));
      if (s) {
        // `JSON.parse` liefert `any` – erst prüfen, dann als ZoomState behandeln (#279).
        const parsed = JSON.parse(s) as Partial<ZoomState> | null;
        if (parsed && typeof parsed.scale === 'number') return parsed as ZoomState;
      }
    } catch {
      /* ignorieren */
    }
    return null;
  }

  /**
   * Gespeicherten Zoom einer Seite dauerhaft löschen – lokal UND auf dem Konto (#283).
   *
   * Vorher war die Regel halb umgesetzt: Lokal wurden beide Schlüssel entfernt (der aktuelle
   * Layout-Schlüssel und der alte Basis-Schlüssel als Rückfall), dem Server aber nur der
   * Layout-Schlüssel gemeldet. Der Alt-Eintrag blieb damit für immer in der Kontodatei und kam bei
   * jedem Abgleich zurück – „gelöscht" hielt also nur bis zum nächsten Öffnen auf einem Gerät, das
   * noch den alten Schlüssel kannte.
   */
  function clearStoredZoom(page: number) {
    for (const k of [zoomKeyFor(page), zoomKeyBaseFor(page)]) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignorieren */
      }
      pushField(k, 'zoom', null); // beide Schlüssel auch auf dem Konto abräumen
    }
  }

  // Zoom/Ausschnitt einer sichtbaren Seite automatisch sichern, sobald eine Geste endet (#33).
  // So bleibt ein freier Pinch-Zoom auch ohne „Fertig" erhalten – über die Sitzung und nach
  // Neuöffnen. Bei Rückkehr auf Fit (scale ≈ 1) wird der gespeicherte Zoom wieder entfernt.
  function persistZoom(slot: number) {
    // Nur echte Nutzer-Gesten sichern (beim Pinch/Pan hält gestureSlot diesen Slot) – NICHT das
    // programmatische Wiederherstellen, sonst wird der gerade geladene Wert quer über Lieder
    // zurückgeschrieben („bei allen Liedern gleich"). gestureSlot ist eine Ref → schon das ERSTE
    // onTransformed der Geste sieht den korrekten Slot (kein State-Timing-Loch).
    if (gestureSlot.current !== slot) return;
    const t = transformRefs[slot].current?.instance?.transformState;
    if (!t) return;
    const page = pageIndex + slot;
    if (t.scale > 1.01) {
      // Neben den Pixeln die Stelle auf dem Blatt (#420) – nur sie übersteht eine neue Fläche.
      const geo = geometrie(slot);
      const a = geo
        ? ausschnittAus({ x: t.positionX, y: t.positionY, scale: t.scale }, geo.flaeche, geo.blatt)
        : null;
      letzterAusschnitt.current[slot] = a;
      const zoom: ZoomState = {
        x: t.positionX,
        y: t.positionY,
        scale: t.scale,
        ...(a ? { fx: a.fx, fy: a.fy } : {}),
      };
      const zk = zoomKeyFor(page);
      lokalSchreiben(zk, JSON.stringify(zoom));
      pushField(zk, 'zoom', zoom);
    } else if (lastScale.current[slot] > 1.01) {
      // Nur löschen, wenn der Nutzer AKTIV wieder auf Fit herausgezoomt hat – nicht beim
      // programmatischen Zurücksetzen/Mounten (das würde einen gespeicherten Zoom fälschlich wipen).
      clearStoredZoom(page);
      letzterAusschnitt.current[slot] = null;
    }
    lastScale.current[slot] = t.scale;
  }

  // Notausgang: sichtbare reingezoomte Seiten auf Normalgröße zurücksetzen UND ihren Speicher löschen.
  function resetVisibleZoom() {
    for (let j = 0; j < perView; j++) {
      if (!zoomedSlots[j]) continue;
      transformRefs[j].current?.resetTransform(150);
      clearStoredZoom(pageIndex + j);
      letzterAusschnitt.current[j] = null;
    }
    gestureSlot.current = null;
  }

  /**
   * Einen gespeicherten Zoom auf eine Ebene anwenden – **über den Ausschnitt** (#420), nicht über
   * die gespeicherten Pixel. Ein Eintrag mit `fx`/`fy` zeigt dieselbe Stelle des Blatts; ein älterer
   * ohne wird aus seinen Pixeln gelesen und dann wenigstens am Rand begrenzt (vorher konnte er das
   * Blatt seitlich abschneiden). Ohne vermessenes Blatt bleibt es bei den Pixeln wie bisher.
   */
  function zoomAnwenden(ref: ReactZoomPanPinchRef, slot: number, saved: ZoomState) {
    const geo = geometrie(slot);
    const a =
      geo && saved.fx !== undefined && saved.fy !== undefined
        ? { fx: saved.fx, fy: saved.fy }
        : geo
          ? ausschnittAus(saved, geo.flaeche, geo.blatt)
          : null;
    if (!geo || !a) {
      ref.setTransform(saved.x, saved.y, saved.scale, 0);
      return;
    }
    const t = transformAus(a, saved.scale, geo.flaeche, geo.blatt, ZOOM_GRENZEN);
    ref.setTransform(t.x, t.y, t.scale, 0);
    letzterAusschnitt.current[slot] = ausschnittAus(t, geo.flaeche, geo.blatt);
  }

  /**
   * Gespeicherten Zoom auf die aktuell sichtbaren Slots (erneut) anwenden. Ein gerade aktiv
   * bewegter Slot (`gestureSlot`) bleibt IMMER unberührt (kein laufender Pinch abbrechen, #33).
   * `fitUnsaved`: Slots ohne gespeicherten Zoom, die aber „hängengeblieben" reingezoomt sind
   * (z. B. nach Hoch-/Querformat-Wechsel = anderer Layout-Schlüssel), auf Fit zurücksetzen.
   * Ohne `fitUnsaved` (Hintergrund-Neuaufbau desselben Layouts) wird NIE auf Fit gesetzt.
   */
  function restoreVisibleZoom(opts?: { fitUnsaved?: boolean }) {
    const fitUnsaved = opts?.fitUnsaved ?? false;
    for (let j = 0; j < perView; j++) {
      if (gestureSlot.current === j) continue;
      const ref = transformRefs[j].current;
      if (!ref) continue;
      const saved = loadZoom(pageIndex + j);
      if (saved) {
        zoomAnwenden(ref, j, saved);
      } else if (fitUnsaved) {
        const st = ref.instance?.transformState;
        if (st && st.scale > 1.01) ref.resetTransform(0);
        letzterAusschnitt.current[j] = null;
      }
    }
  }

  return {
    zoomKeyFor,
    loadZoom,
    persistZoom,
    clearStoredZoom,
    resetVisibleZoom,
    restoreVisibleZoom,
    zoomAnwenden,
  };
}
