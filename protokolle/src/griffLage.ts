/**
 * **Wo der Griff steht** (K1, beim Durchklicken 28.10.2026: „sitzt die ganze Zeit falsch“). BlockNote setzt den Griff an
 * die Oberkante des Blocks – gemessen lag seine Mitte je nach Art 6 bis 9 px über der ersten Textzeile (Überschrift 9,
 * Aufgabe 7, Beschluss 6) und sah damit aus, als gehöre er zur Zeile darüber. Hier wird er um den Abstand bis zur Mitte
 * der ersten Zeile nach unten gerückt – eine Rechnung für alle Arten, auch für eigene Blöcke und feste Punkte.
 */

/**
 * Der Inhalt eines Blocks ohne seine Unterpunkte (die stehen in einer eigenen Gruppe daneben). Eigene Blöcke (Aufgabe,
 * Beschluss, Termin, feste Punkte) legt BlockNote in eine Hülle mehr (`.bn-react-node-view-renderer`).
 */
export function blockInhalt(wurzel: ParentNode, id: string): Element | null {
  const aussen = wurzel.querySelector(`.bn-block-outer[data-id="${CSS.escape(id)}"]`);
  return (
    aussen?.querySelector(
      ':scope > .bn-block > .bn-block-content, :scope > .bn-block > .bn-react-node-view-renderer > .bn-block-content',
    ) ?? null
  );
}

/** Das Rechteck der ersten Textzeile – erster sichtbarer Text, sonst die (leere) Textzeile des Blocks. */
function ersteZeile(inhalt: Element): { top: number; height: number } | null {
  const gang = document.createTreeWalker(inhalt, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
  });
  const text = gang.nextNode();
  if (text) {
    const bereich = document.createRange();
    bereich.selectNodeContents(text);
    const r = bereich.getClientRects()[0];
    if (r && r.height > 0) return r;
  }
  const zeile = inhalt.querySelector('.bn-inline-content')?.getBoundingClientRect();
  return zeile && zeile.height > 0 ? zeile : null;
}

/** Um so viele Pixel rückt der Griff (Höhe `griffHoehe`) nach unten; nie nach oben, ohne Text gar nicht. */
export function griffVersatz(inhalt: Element | null, griffHoehe: number): number {
  if (!inhalt) return 0;
  const zeile = ersteZeile(inhalt);
  if (!zeile) return 0;
  const mitte = zeile.top + zeile.height / 2 - inhalt.getBoundingClientRect().top;
  return Math.max(0, Math.round(mitte - griffHoehe / 2));
}
