import { useEffect, useState } from 'react';
import { syncAppHeight } from './appHeight';
import { tastaturHoehe } from './useTastaturOffen';
import { listenScroll } from '../bedienung/menueLage';

/**
 * So viel Höhe bleibt dem Overlay über der Tastatur mindestens (samt Rand) – genug für Kopf und Knöpfe eines
 * Fensters. Eine echte Tastatur lässt hochkant deutlich mehr übrig; am Handy quer reicht das Fenster dann eher etwas
 * unter die Tastatur, als zu verschwinden.
 */
export const FENSTER_PLATZ_PX = 160;

/**
 * So lange muss der `visualViewport` still sein, bevor `--kb` geschrieben wird. iOS feuert während der
 * Tastatur-Animation (~0,5 s) viele `resize`/`scroll`-Ereignisse mit Zwischenwerten; jedes davon verschob das
 * Fenster, es schrumpfte über ~2 s in kleinen Sprüngen (Alwin am iPhone, 18.11.2026, „Punkt vorschlagen“). Nach der
 * Ruhezeit steht der End-Wert – das Fenster springt einmal. Das SCHLIESSEN der Tastatur (Wert 0) gilt sofort, sonst
 * bliebe das Fenster einen Moment klein hängen.
 */
export const TASTATUR_RUHE_MS = 140;

/** Optionen von `useOverlayKeyboardInset`. */
export interface TastaturAussparungOptionen {
  /**
   * Das fokussierte Feld nach dem Anwenden in seinem Scrollbereich ins Bild holen (`feldZeigen`), wenn es im Overlay
   * liegt. Standard: ja. **Aus** für den Lied-Editor: Dort ist das Feld der CodeMirror-Editor selbst, der seinen
   * Cursor eigenständig im Bild hält – das ganze Editor-Element ins Bild zu rücken, würde dagegen arbeiten.
   */
  feldInsBild?: boolean;
}

/**
 * **Holt `feld` in seinem Scrollbereich innerhalb von `grenze` ins Bild** (der Inhalt eines Fensters) – sonst bleibt alles,
 * wo es ist. Bewusst von Hand statt `scrollIntoView`: Das scrollt auch alle Behälter darüber, und in ChurchTools rückte
 * so schon einmal die ganze Seite zur Seite (Lehre aus `listenScroll`, `menueLage.ts`, Test-Instanz 11.11.2026).
 */
export function feldZeigen(feld: HTMLElement, grenze: HTMLElement): void {
  for (let b = feld.parentElement; b && grenze.contains(b); b = b.parentElement) {
    const oy = getComputedStyle(b).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && b.scrollHeight > b.clientHeight) {
      const f = feld.getBoundingClientRect();
      const oben = f.top - b.getBoundingClientRect().top + b.scrollTop;
      b.scrollTop = listenScroll(b.scrollTop, b.clientHeight, oben, f.height);
      return;
    }
  }
}

/**
 * Hält einen Vollbild-Overlay über der iOS-Tastatur frei (#207).
 *
 * Zwei Dinge passieren auf iOS, sobald ein Eingabefeld fokussiert wird:
 *  1. Die Tastatur verdeckt den unteren Teil des Bildschirms – ohne Aussparung liegen Trefferlisten
 *     und Knöpfe darunter (im Dialog „Lied verknüpfen" waren die Treffer nicht erreichbar, man
 *     musste erst wischen). Der Overlay bekommt daher unten einen Innenabstand in Höhe der Tastatur
 *     (`--kb`, gemessen am `visualViewport`). Damit nichts ruckelt, gilt der Wert erst, wenn er sich gesetzt hat
 *     (`TASTATUR_RUHE_MS`, 18.11.2026), und solange die Tastatur offen ist, trägt der Overlay `data-tastatur`: Das
 *     Fenster steht dann OBEN verankert (`Sheet.module.scss`), nur seine Unterkante bewegt sich – zentriert wanderte
 *     bei jeder Änderung auch der Kopf.
 *  2. iOS scrollt zusätzlich das DOKUMENT nach oben, um das Feld über die Tastatur zu heben. Da die
 *     App eine feste Höhe hat (`--app-h`) und nur innere Container scrollen, bleibt die Seite danach
 *     verschoben: Die Kopfleiste wandert aus dem Bild und „klebt" hinterher oben mit einer Lücke.
 *     `scrollTo(0, 0)` neutralisiert das – bei JEDEM Ereignis, nicht entprellt: Es verändert `--kb` nicht und ist ein
 *     No-op, solange nichts verschoben ist; verzögert würde der Dokument-Versatz sichtbar hinter dem Schleier stehen.
 *
 * Ist die Tastatur oben und das neue Maß angewendet, holt der Hook das fokussierte Feld ins Bild, falls das Fenster
 * kürzer geworden ist und es verdeckt (`feldInsBild`, `feldZeigen` – nur im Fenster, nie die Seite).
 *
 * Das Rezept stammt aus dem ChordEditor, wo es sich bewährt hat – es liegt hier gemeinsam, damit die
 * beiden Kopien nicht auseinanderlaufen. Der Overlay MUSS `position: fixed` sein (nicht `absolute`),
 * sonst scrollt er mit dem Dokument mit und die Aussparung nützt nichts.
 */
export function useOverlayKeyboardInset(
  optionen: TastaturAussparungOptionen = {},
): (el: HTMLElement | null) => void {
  const { feldInsBild = true } = optionen;
  // Callback-Ref statt `useRef` (#215): Vorher las der Hook `ref.current` NUR beim Mount. Das ging
  // gut, solange jeder Rückgabezweig dieselbe DOM-Wurzel wiederverwendet – im früheren `ItemActionSheet`
  // taten das die beiden Zweige (`songMode`) zufällig; seit E6-2b-2 hat die Liedwahl (`LiedVerknuepfen`) ihren
  // eigenen Hook, was erst mit dem Callback-Ref geht. Ein zusätzlicher Wrapper oder ein `key` hätte
  // die Tastatur-Aussparung STILL abgeschaltet: kein Fehler, nur Knöpfe unter der Tastatur.
  // Über den State läuft der Effekt jetzt genau dann neu, wenn sich das Element wirklich ändert.
  const [el, setEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let angewendet = Number.NaN; // zuletzt geschriebener Wert; NaN = noch nichts
    const messen = () => {
      // Sicherheitsnetz: Was auch immer gemeldet wird, das Fenster behält `FENSTER_PLATZ_PX` – nie wieder nur den
      // Schleier (30.10.2026; die Ursache, eine gemeldete Tastatur ohne Eingabefeld, fängt `tastaturHoehe`). Gerechnet
      // mit der Höhe des Overlays, nicht des Browserfensters: In ChurchTools liegt es unter dessen Leiste und ist
      // ~60 px kürzer (in der Test-Instanz gemessen: mit `innerHeight` blieben dem Fenster 63 statt 112 px).
      const hoehe = el.clientHeight || window.innerHeight;
      return Math.min(tastaturHoehe(vv), Math.max(0, hoehe - FENSTER_PLATZ_PX));
    };
    const anwenden = () => {
      timer = undefined;
      const kb = messen();
      if (kb === angewendet) return;
      angewendet = kb;
      el.style.setProperty('--kb', `${kb}px`);
      if (kb > 0) el.setAttribute('data-tastatur', '');
      else el.removeAttribute('data-tastatur');
      // Erst nach dem neuen Maß: Vorher war das Fenster höher und das Feld womöglich sichtbar.
      if (kb > 0 && feldInsBild) {
        const feld = document.activeElement;
        if (feld instanceof HTMLElement && el.contains(feld)) feldZeigen(feld, el);
      }
    };
    const beiAenderung = () => {
      if (window.scrollY !== 0 || vv.offsetTop !== 0) window.scrollTo(0, 0);
      if (messen() === 0) {
        // Tastatur zu: sofort, ein noch wartender Zwischenwert wird verworfen.
        clearTimeout(timer);
        anwenden();
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(anwenden, TASTATUR_RUHE_MS);
    };
    anwenden();
    if (window.scrollY !== 0 || vv.offsetTop !== 0) window.scrollTo(0, 0);
    vv.addEventListener('resize', beiAenderung);
    vv.addEventListener('scroll', beiAenderung);
    return () => {
      clearTimeout(timer);
      vv.removeEventListener('resize', beiAenderung);
      vv.removeEventListener('scroll', beiAenderung);
      el.style.removeProperty('--kb');
      el.removeAttribute('data-tastatur');
      // Beim Schließen den Dokument-Scroll zurückholen und `--app-h` neu setzen – sonst bleibt die
      // Ansicht verschoben, wenn die Tastatur gemeinsam mit dem Dialog verschwindet.
      // `syncAppHeight` direkt statt eines synthetischen `resize`-Events (#215): Der Hook sitzt in
      // JEDEM Dialog, und das Event hätte beim Schließen eines Pickers nebenbei die Resize-Handler
      // von PageDeck/ChordChart/useChartNavigation ausgelöst – Fernwirkung auf Verdacht.
      window.scrollTo(0, 0);
      syncAppHeight();
    };
  }, [el, feldInsBild]);

  // `setEl` kommt aus `useState` und hat eine stabile Identität – als Ref-Callback nutzbar,
  // ohne dass React ihn bei jedem Render mit null und dem Element erneut aufruft.
  return setEl;
}
