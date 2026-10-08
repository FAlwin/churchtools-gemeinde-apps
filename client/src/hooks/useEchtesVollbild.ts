import { useCallback, useEffect, useRef } from 'react';

/**
 * **Echtes Vollbild in der ChurchTools-Erweiterung** (Alwin, 08.10.2026: „das wäre richtig cool").
 *
 * In der Erweiterung läuft die App als Seite in ChurchTools: „Vollbild" blendete nur unsere Leisten
 * aus – die Leiste von ChurchTools und die des Browsers blieben stehen. Die Homescreen-App (PWA) hat
 * dieses Problem nicht, deshalb nur hier.
 *
 * Genutzt wird das Vollbild des Browsers für den App-Bereich `#root` (darin liegen auch Hinweise und
 * Menüs). Wo es das nicht gibt – **am iPhone erlaubt Safari es nur für Videos** –, bleibt es beim
 * Ausblenden der Leisten wie bisher. Lehnt der Browser ab, ebenso: kein Fehler, kein Hinweis.
 *
 * - **Aus dem Tipp heraus anfordern:** Browser erlauben das Vollbild nur als Folge einer Berührung.
 *   Deshalb ruft der Umschalter `schalten` direkt auf, nicht ein Effekt hinterher.
 * - **Wer das Vollbild anders verlässt** (Esc, Wischgeste, Systemknopf), bekommt die Leisten zurück
 *   (`onVerlassen`) – sonst stünde er vor einem Blatt ohne Bedienung, aber mit ChurchTools drumherum.
 * - Wer das Blatt verlässt, verlässt auch das Vollbild.
 */
type VollbildDokument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};
type VollbildElement = HTMLElement & { webkitRequestFullscreen?: () => void };

const EREIGNISSE = ['fullscreenchange', 'webkitfullscreenchange'] as const;

/** Bietet dieser Browser das Vollbild für Elemente an? Am iPhone: nein. */
export function kannEchtesVollbild(doc: Document = document): boolean {
  const d = doc as VollbildDokument;
  return d.fullscreenEnabled === true || d.webkitFullscreenEnabled === true;
}

function imEchtenVollbild(doc: Document): boolean {
  const d = doc as VollbildDokument;
  return Boolean(d.fullscreenElement ?? d.webkitFullscreenElement);
}

/** Ein abgelehntes Vollbild ist kein Fehler – dann bleibt es beim Ausblenden der Leisten. */
function still(ergebnis: unknown): void {
  if (ergebnis instanceof Promise) ergebnis.catch(() => undefined);
}

function anfordern(el: HTMLElement): void {
  const e = el as VollbildElement;
  try {
    if (typeof e.requestFullscreen === 'function') still(e.requestFullscreen());
    else e.webkitRequestFullscreen?.();
  } catch {
    // Ältere Browser werfen statt abzulehnen – gleiche Folge: Leisten aus, Rahmen bleibt.
  }
}

function verlassen(doc: Document): void {
  if (!imEchtenVollbild(doc)) return;
  const d = doc as VollbildDokument;
  try {
    if (typeof d.exitFullscreen === 'function') still(d.exitFullscreen());
    else d.webkitExitFullscreen?.();
  } catch {
    // Schon draußen oder nicht erlaubt – nichts zu tun.
  }
}

/**
 * @param erlaubt   nur in der Erweiterung (`funktionen.echtesVollbild`)
 * @param onVerlassen das Vollbild wurde von außen beendet → Leisten wieder zeigen
 * @returns `schalten(an)` – im Tipp-Handler aufrufen
 */
export function useEchtesVollbild(
  erlaubt: boolean,
  onVerlassen: () => void,
): (an: boolean) => void {
  const nutzbar = erlaubt && kannEchtesVollbild();
  const verlassenRef = useRef(onVerlassen);
  verlassenRef.current = onVerlassen;

  useEffect(() => {
    if (!nutzbar) return;
    const beimWechsel = () => {
      if (!imEchtenVollbild(document)) verlassenRef.current();
    };
    for (const e of EREIGNISSE) document.addEventListener(e, beimWechsel);
    return () => {
      for (const e of EREIGNISSE) document.removeEventListener(e, beimWechsel);
      verlassen(document);
    };
  }, [nutzbar]);

  return useCallback(
    (an: boolean) => {
      if (!nutzbar) return;
      if (!an) return verlassen(document);
      const root = document.getElementById('root');
      if (root) anfordern(root);
    },
    [nutzbar],
  );
}
