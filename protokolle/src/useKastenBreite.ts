import { useLayoutEffect, useState } from 'react';

/**
 * Ab dieser Breite des Kastens zeigt die Liste die Tabelle, darunter Karten. Entwurf v2: „unter ca. 640 px Karten“ – gemessen
 * 20.11.2026: bei 640 blieben dem Titel nach den festen Spalten unter 140 px, er war nur noch „Angebote für …“. Ab 720 sind es
 * knapp 190 px.
 */
export const TABELLE_AB = 720;
/** Darunter fällt in der Tabelle zuerst die Spalte „Gruppe“ weg. */
export const GRUPPE_AB = 860;

export type ListenForm = 'karten' | 'tabelleOhneGruppe' | 'tabelle';

/**
 * **Welche Form die Liste hat**, gemessen an der Breite des Kastens (nicht des Fensters – die Erweiterung läuft in
 * ChurchTools mit unbekannter Breite neben dessen Menü). Unbekannt (noch nicht gemessen, kein `ResizeObserver`) = Karten.
 */
export function listenForm(breite: number | null): ListenForm {
  if (breite === null || breite < TABELLE_AB) return 'karten';
  return breite < GRUPPE_AB ? 'tabelleOhneGruppe' : 'tabelle';
}

/**
 * **Die Breite eines Elements**, laufend nachgeführt (`ResizeObserver`) – eine Container-Abfrage in Schrift: Tabelle und
 * Karte brauchen verschiedene Bausteine, das kann CSS allein nicht umschalten. Gibt den Callback fürs `ref` und die Breite
 * (`null`, solange unbekannt).
 */
export function useKastenBreite() {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [breite, setBreite] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return;
    setBreite(el.getBoundingClientRect().width);
    const beobachter = new ResizeObserver((e) => {
      const w = e[0]?.contentRect.width;
      if (w !== undefined) setBreite(w);
    });
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, [el]);
  return [setEl, breite] as const;
}
