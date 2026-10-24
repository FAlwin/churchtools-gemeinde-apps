import { useLayoutEffect, useRef, useState } from 'react';

/**
 * **Passen die Knöpfe unten im Fenster nicht nebeneinander, stehen sie untereinander** – der Hauptknopf oben, wie am
 * Handy (Alwin, 24.10.2026, E6-O F3 #726). Vorher rutschte bei drei langen Knöpfen („Zurück zum Formular“ · „Trotzdem
 * neu anlegen“ · „„Treu" verwenden“) der Hauptknopf allein in eine zweite Zeile.
 *
 * CSS allein kann das nicht: Ob die Knöpfe passen, hängt an ihren Beschriftungen. Darum misst die Zeile sich selbst –
 * kurz nebeneinander ohne Umbruch (`data-messen`), ist sie dann breiter als ihr Platz, bekommt sie `data-stapel`. Beide
 * Zustände gestaltet `m.fensterKnopfZeile`. Gemessen wird beim Öffnen, wenn sich die Breite ändert und wenn sich die
 * Knöpfe ändern (eine Beschriftung wird etwa zu „Wird gespeichert …“, ein Knopf kommt dazu).
 */
export function useKnopfZeile<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [stapel, setStapel] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const messen = () => setStapel(zuBreit(el));
    messen();
    const groesse = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(messen);
    groesse?.observe(el);
    // Nur Knöpfe und Texte, nicht die eigenen Attribute – sonst löste das Messen selbst neues Messen aus.
    const inhalt = new MutationObserver(messen);
    inhalt.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      groesse?.disconnect();
      inhalt.disconnect();
    };
  }, []);

  return { ref, stapel };
}

/** Wäre die Zeile nebeneinander breiter als ihr Platz? (+1 gegen Rundung bei Bruchteil-Pixeln) */
function zuBreit(el: HTMLElement): boolean {
  el.setAttribute('data-messen', '');
  const zuBreit = el.scrollWidth > el.clientWidth + 1;
  el.removeAttribute('data-messen');
  return zuBreit;
}
