import { useSyncExternalStore } from 'react';

/**
 * **Vollbild der ganzen App in der ChurchTools-Erweiterung** (Entwurf mit Alwin, 08.10.2026).
 *
 * In der Erweiterung läuft die App als Seite in ChurchTools; darüber steht die Leiste von ChurchTools.
 * „Vollbild" legt die App einfach **über** diese Leiste (`#root[data-vollbild]`, Regel in
 * `styles/main.scss`). Bewusst NICHT das Vollbild des Browsers – das war der erste Versuch und am iPad
 * schlechter: Safari setzt ein X in die Ecke, blendet einen Hinweis ein und animiert den Wechsel, das
 * Blatt flackerte. In einer als Homescreen-App installierten ChurchTools-Seite gibt es die
 * Browser-Variante gar nicht. So geht es in jedem Browser, auch am iPhone, und mit ChurchTools als
 * Homescreen-App ist es echtes Vollbild.
 *
 * Ein Zustand für die ganze App: Wer in der Liederliste einschaltet, bleibt beim Öffnen eines Lieds
 * und beim Zurückgehen im Vollbild. Nicht gemerkt über ein Neuladen hinaus (Alwins Wahl).
 */
let an = false;
const hoerer = new Set<() => void>();

function anwenden(): void {
  document.getElementById('root')?.toggleAttribute('data-vollbild', an);
}

export function setzeAppVollbild(wert: boolean): void {
  if (wert === an) return;
  an = wert;
  anwenden();
  for (const h of hoerer) h();
}

function abonnieren(h: () => void): () => void {
  hoerer.add(h);
  return () => hoerer.delete(h);
}

/** `[an, umschalten]` – für Knöpfe in Liste, Ablauf und Liedblatt. */
export function useAppVollbild(): [boolean, () => void] {
  const wert = useSyncExternalStore(abonnieren, () => an);
  return [wert, () => setzeAppVollbild(!an)];
}
