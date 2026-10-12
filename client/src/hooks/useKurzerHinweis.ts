import { useEffect, useRef, useState } from 'react';

/** So lange stehen Hinweis und Schildchen. */
export const HINWEIS_MS = 6000;

/**
 * Ob Hinweis und Schildchen gerade stehen. `schluessel` beschreibt die Meldung (`''` = nichts zu
 * melden): Jede NEUE Meldung zeigt sie für `HINWEIS_MS`; dieselbe Meldung noch einmal (etwa ein
 * erneuter Abruf, bevor das Gesehen-Merken ankam) zeigt nichts erneut – der Effekt hängt am Schlüssel.
 */
export function useKurzerHinweis(schluessel: string): boolean {
  const [sichtbar, setSichtbar] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!schluessel) {
      // Nichts (mehr) zu melden – etwa weil der einzige entfernte Punkt zurückgeholt wurde.
      setSichtbar(false);
      return;
    }
    setSichtbar(true);
    timer.current = setTimeout(() => setSichtbar(false), HINWEIS_MS);
  }, [schluessel]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return sichtbar;
}
