/**
 * **Welche Taste heißt „weiter", welche „zurück"?** (#551, Dev-Stammtisch 14.10.2026)
 *
 * Bluetooth-Pedale (AirTurn, PageFlip …) senden je nach Modus Pfeiltasten, Bild↑/↓ oder die
 * Leertaste. Vorher kannte die Liedansicht nur ←/→ – viele Pedale taten darum nichts. Die Regel steht
 * hier EINMAL und gilt fürs Blättern wie fürs Scrollen.
 *
 * Bewusst KEINE Reaktion:
 * - **gedrückt gehaltene Taste** (`repeat`): Ein Pedal wiederholt nicht, eine festgehaltene Taste
 *   würde sonst durch den ganzen Ablauf rasen;
 * - **Strg/⌘/Alt**: Das sind Kürzel des Browsers bzw. von ChurchTools;
 * - **Eingaben** (Textfeld, Auswahl, bearbeitbarer Text);
 * - **Leertaste/Eingabe auf einem Knopf**: Der Knopf löst selbst aus – zusammen mit dem Pedal-Schritt
 *   wäre das ein doppelter Schritt (so im Entwurf passiert, 14.10.2026).
 */
export type PedalRichtung = 1 | -1;

const WEITER = new Set(['ArrowRight', 'ArrowDown', 'PageDown']);
const ZURUECK = new Set(['ArrowLeft', 'ArrowUp', 'PageUp']);

export interface PedalTaste {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  target?: EventTarget | null;
}

function istEingabe(t: EventTarget | null | undefined): boolean {
  const el = t as HTMLElement | null | undefined;
  if (!el || typeof el.tagName !== 'string') return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable === true
  );
}

function istKnopf(t: EventTarget | null | undefined): boolean {
  const el = t as HTMLElement | null | undefined;
  return !!el && (el.tagName === 'BUTTON' || el.getAttribute?.('role') === 'button');
}

/** `1` = weiter, `-1` = zurück, `null` = keine Pedal-Taste (oder gerade nicht zuständig). */
export function pedalRichtung(e: PedalTaste): PedalRichtung | null {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return null;
  if (istEingabe(e.target)) return null;
  if (e.key === ' ') {
    if (istKnopf(e.target)) return null;
    return e.shiftKey ? -1 : 1;
  }
  if (WEITER.has(e.key)) return 1;
  if (ZURUECK.has(e.key)) return -1;
  return null;
}
