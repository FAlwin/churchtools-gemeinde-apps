// Test-Hilfe: echte BlockNote-Editoren in Tests einhängen – EINE Stelle, die sie auch wieder aushängt (#744).
import { afterEach } from 'vitest';

/**
 * **Eingehängte Editoren nach jedem Test wieder aushängen.** ProseMirror stellt beim Aktualisieren einen Zeitgeber
 * (20 ms, `DOMObserver.stop`); feuert er nach dem Abbau von jsdom an einem noch eingehängten Editor, fasst er
 * `document` an – der Lauf scheitert mit „document is not defined“, obwohl alle Tests grün sind (CI 26.10.2026, #744).
 * Ein ausgehängter Editor ist zerstört (`docView = null`), sein später Zeitgeber kehrt sofort um.
 *
 * Der Helfer stand zuerst nur in `editorSchema.test.tsx`; der nächste Test mit Editor (`abschnittZiehen.test.ts`,
 * S4-3b) hängte deshalb wieder selbst ein – und die CI wackelte am 28.10.2026 erneut. Darum liegt er hier, und
 * `ui/design/editorEinhaengen.test.ts` verbietet ein eigenes `.mount(` in Tests.
 *
 * Wer `einhaengen` importiert, bekommt das Aushängen nach jedem Test mit – ohne eigenes `afterEach`.
 */
interface Einhaengbar {
  mount: (element: HTMLElement) => void;
  unmount: () => void;
}

const eingehaengt: Einhaengbar[] = [];

/** Hängt den Editor in ein frisches `<div>` ein; nach dem Test wird er von selbst wieder ausgehängt. */
export function einhaengen<E extends Einhaengbar>(editor: E): E {
  editor.mount(document.createElement('div'));
  eingehaengt.push(editor);
  return editor;
}

/** Hängt alle eingehängten Editoren aus – läuft nach jedem Test; von Hand nur für den Mechanismus-Test. */
export function aushaengen(): void {
  for (const e of eingehaengt.splice(0)) e.unmount();
}

afterEach(aushaengen);
