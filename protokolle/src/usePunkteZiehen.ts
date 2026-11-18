import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ZeigerEreignis,
  type RefObject,
} from 'react';

/**
 * **Ziehen in der Liste von „Punkte ordnen“** (Bauplan W7, Entwurf `punkte-ordnen-v1`): Der Punkt samt Unterpunkten folgt
 * dem Zeiger als eine Einheit, an seinem Platz bleibt ein blasser Schatten, und eine **Einfügelinie** zeigt die Stelle.
 * Abgelegt wird nur unter den Geschwistern des Punkts (gleicher Elternpunkt) – mehr Stellen gibt es nicht, also zeigt die
 * Linie auch keine anderen.
 *
 * - **Maus:** nach 4 px Bewegung. **Finger:** erst nach ~0,3 s Halten (kurzes Vibrieren); wer vorher wischt (mehr als
 *   8 px), blättert nur. Danach hält `touchmove` die Seite still.
 * - **Esc** bricht das Ziehen ab (in der Einfangphase – das Fenster darunter schließt dabei nicht).
 * - Am Rand des Fensters blättert die Liste von selbst.
 * - Eigener Baustein statt `dnd-kit`: Die Stelle ergibt sich aus der Höhe des Zeigers über den Geschwistern, und die
 *   Linie ist die einzige Anzeige – so wie im abgenommenen Entwurf; `dnd-kit` hätte die Zeilen auseinanderrücken lassen.
 *
 * Die Stelle (`ziel`) ist der Platz unter den Geschwistern, wie ihn `punktVerschieben` nimmt (ohne den Punkt selbst
 * gezählt).
 */

/** Wie lange ein Finger liegen muss, bis das Ziehen beginnt (Entwurf: 0,3 s). */
export const HALTEN_MS = 300;
/** So weit darf der Finger beim Halten wandern, ohne dass es ein Blättern wird (px). */
const TOLERANZ_FINGER = 8;
/** So weit muss die Maus wandern, bis das Ziehen beginnt (px). */
const SCHWELLE_MAUS = 4;
/** So nah am Rand (px) blättert die Liste. */
const RAND = 48;

export interface ZiehAnzeige {
  id: string;
  /** Elternpunkt des gezogenen Punkts (`''` = oberste Ebene) – alle anderen Zeilen werden abgeblendet. */
  eltern: string;
  /** Schon der Platz, an dem losgelassen würde; `null`: hier geht es nicht (keine Linie). */
  ziel: number | null;
  /** Der gezogene Punkt – Lage fürs Bild unter dem Zeiger (Bildschirm). */
  bild: { top: number; left: number; breite: number };
  /** Die Einfügelinie – in der Liste gemessen. */
  linie: { top: number; left: number; breite: number } | null;
}

interface Zug {
  id: string;
  eltern: string;
  pid: number;
  x: number;
  y: number;
  cx: number;
  cy: number;
  touch: boolean;
  aktiv: boolean;
  timer: number;
  raf: number;
  griff: HTMLElement;
  /** Abstand des Zeigers zur Oberkante der Zeile – damit das Bild nicht unter dem Zeiger springt. */
  versatzY: number;
  links: number;
  breite: number;
  /** Der eigene Platz unter den Geschwistern (vor dem Ziehen). */
  eigener: number;
  ziel: number | null;
}

/** Der Platz unter den Geschwistern, an dem der Zeiger (Höhe `y`) den Punkt einfügen würde: so viele Geschwister (ohne ihn selbst) liegen mit ihrer Mitte darüber. */
export function einfuegePlatz(mitten: readonly number[], y: number): number {
  let platz = 0;
  for (const m of mitten) {
    if (y > m) platz++;
    else break;
  }
  return platz;
}

/** Das Element, das scrollt (der Inhalt des Fensters) – von der Liste aus gesucht. */
function blaetterElement(von: HTMLElement): HTMLElement | null {
  for (let e = von.parentElement; e; e = e.parentElement) {
    const o = getComputedStyle(e).overflowY;
    if (o === 'auto' || o === 'scroll') return e;
  }
  return null;
}

interface Abhaengig {
  liste: RefObject<HTMLElement | null>;
  gueltig: (id: string, platz: number) => boolean;
  onAblegen: (id: string, platz: number) => void;
}

/**
 * Die Steuerung des Ziehens – einmal je Fenster gebaut, ihre Handler sind darum dieselben Funktionen, die auch wieder
 * abgemeldet werden. Was sich bei jedem Rendern ändert (`gueltig`, `onAblegen`), holt sie sich über `hole()`.
 */
function ziehSteuerung(hole: () => Abhaengig, anzeige: (a: ZiehAnzeige | null) => void) {
  let zug: Zug | null = null;

  const geschwister = (z: Zug): HTMLElement[] => {
    const l = hole().liste.current;
    return l
      ? [...l.querySelectorAll<HTMLElement>('li[data-punkt]')].filter(
          (x) => x.dataset.eltern === z.eltern,
        )
      : [];
  };

  /** Bild und Linie neu rechnen, wenn sich Zeiger oder Blätterstand ändern. */
  const aktualisieren = (z: Zug): void => {
    const l = hole().liste.current;
    if (!l) return;
    const alle = geschwister(z);
    const andere = alle.filter((x) => x.dataset.punkt !== z.id);
    const platz = einfuegePlatz(
      andere.map((a) => {
        const r = a.getBoundingClientRect();
        return r.top + r.height / 2;
      }),
      z.cy,
    );
    // Ohne Geschwister gibt es keine Stelle; und ein Schritt, der die Ebene änderte, gibt es nicht (`punktVerschieben`).
    const geht = andere.length > 0 && hole().gueltig(z.id, platz);
    let linie: ZiehAnzeige['linie'] = null;
    if (geht) {
      const lr = l.getBoundingClientRect();
      const erste = andere[0].getBoundingClientRect();
      const y = platz === 0 ? erste.top : andere[platz - 1].getBoundingClientRect().bottom;
      linie = { top: y - lr.top, left: erste.left - lr.left + 5, breite: erste.width - 10 };
    }
    z.ziel = geht ? platz : null;
    anzeige({
      id: z.id,
      eltern: z.eltern,
      ziel: z.ziel,
      bild: { top: z.cy - z.versatzY, left: z.links, breite: z.breite },
      linie,
    });
  };

  const beenden = (z: Zug, ablegen: boolean): void => {
    window.clearTimeout(z.timer);
    cancelAnimationFrame(z.raf);
    window.removeEventListener('pointermove', bewegt, true);
    window.removeEventListener('pointerup', losgelassen, true);
    window.removeEventListener('pointercancel', abgebrochen, true);
    window.removeEventListener('keydown', taste, true);
    document.body.style.userSelect = '';
    try {
      z.griff.releasePointerCapture(z.pid);
    } catch {
      // Schon losgelassen – dann gibt es nichts freizugeben.
    }
    if (zug === z) zug = null;
    anzeige(null);
    if (z.aktiv && ablegen && z.ziel !== null && z.ziel !== z.eigener)
      hole().onAblegen(z.id, z.ziel);
  };

  /** Das Ziehen beginnt: Bild, Schatten, Linie; die Liste blättert am Rand von selbst. */
  const starten = (z: Zug): void => {
    z.aktiv = true;
    navigator.vibrate?.(12);
    document.body.style.userSelect = 'none';
    aktualisieren(z);
    const l = hole().liste.current;
    const blaettern = l ? blaetterElement(l) : null;
    const tick = (): void => {
      if (zug !== z || !z.aktiv) return;
      const r = blaettern?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
      const d = z.cy < r.top + RAND ? -10 : z.cy > r.bottom - RAND ? 10 : 0;
      if (d && blaettern) {
        blaettern.scrollTop += d;
        aktualisieren(z);
      }
      z.raf = requestAnimationFrame(tick);
    };
    z.raf = requestAnimationFrame(tick);
  };

  function bewegt(e: PointerEvent): void {
    const z = zug;
    if (!z || e.pointerId !== z.pid) return;
    z.cx = e.clientX;
    z.cy = e.clientY;
    if (!z.aktiv) {
      const weg = Math.hypot(z.cx - z.x, z.cy - z.y);
      if (z.touch) {
        if (weg > TOLERANZ_FINGER) beenden(z, false);
      } else if (weg > SCHWELLE_MAUS) starten(z);
      return;
    }
    aktualisieren(z);
  }
  function losgelassen(e: PointerEvent): void {
    if (zug && e.pointerId === zug.pid) beenden(zug, true);
  }
  function abgebrochen(e: PointerEvent): void {
    if (zug && e.pointerId === zug.pid) beenden(zug, false);
  }
  function taste(e: KeyboardEvent): void {
    if (e.key !== 'Escape' || !zug?.aktiv) return;
    // Esc bricht nur das Ziehen ab – das Fenster darunter bleibt offen.
    e.stopPropagation();
    e.preventDefault();
    beenden(zug, false);
  }

  return {
    beiGriffDruck: (e: ZeigerEreignis<HTMLElement>, id: string): void => {
      if (e.button > 0 || zug) return;
      const zeile = e.currentTarget.closest<HTMLElement>('li[data-punkt]');
      const kopf = zeile?.firstElementChild;
      if (!zeile || !kopf) return;
      const r = kopf.getBoundingClientRect();
      const eltern = zeile.dataset.eltern ?? '';
      const z: Zug = {
        id,
        eltern,
        pid: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        cx: e.clientX,
        cy: e.clientY,
        touch: e.pointerType !== 'mouse',
        aktiv: false,
        timer: 0,
        raf: 0,
        griff: e.currentTarget,
        versatzY: e.clientY - r.top,
        links: r.left,
        breite: r.width,
        eigener: 0,
        ziel: null,
      };
      z.eigener = geschwister(z).findIndex((x) => x.dataset.punkt === id);
      zug = z;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ohne Erfassen laufen die Ereignisse über das Fenster – für das Ziehen reicht das.
      }
      window.addEventListener('pointermove', bewegt, true);
      window.addEventListener('pointerup', losgelassen, true);
      window.addEventListener('pointercancel', abgebrochen, true);
      window.addEventListener('keydown', taste, true);
      if (z.touch) z.timer = window.setTimeout(() => zug === z && starten(z), HALTEN_MS);
      else {
        e.preventDefault();
        e.currentTarget.focus({ preventScroll: true });
      }
    },
    /** Auf dem Finger hält `touchmove` die Seite still, sobald gezogen wird – sonst wischt das Fenster mit. */
    stillhalten: (e: TouchEvent): void => {
      if (zug?.aktiv) e.preventDefault();
    },
    /** Das Fenster geht zu: ein laufendes Ziehen endet ohne Ablegen. */
    abbauen: (): void => {
      if (zug) beenden(zug, false);
    },
  };
}

export function usePunkteZiehen(abhaengig: Abhaengig): {
  zieht: ZiehAnzeige | null;
  beiGriffDruck: (e: ZeigerEreignis<HTMLElement>, id: string) => void;
} {
  const [zieht, setZieht] = useState<ZiehAnzeige | null>(null);
  // `gueltig` und `onAblegen` ändern sich bei jedem Rendern – gebraucht wird immer die aktuelle Fassung.
  const neu = useRef(abhaengig);
  neu.current = abhaengig;
  const [steuerung] = useState(() => ziehSteuerung(() => neu.current, setZieht));
  useEffect(() => {
    document.addEventListener('touchmove', steuerung.stillhalten, { passive: false });
    return () => {
      document.removeEventListener('touchmove', steuerung.stillhalten);
      steuerung.abbauen();
    };
  }, [steuerung]);
  return { zieht, beiGriffDruck: steuerung.beiGriffDruck };
}
