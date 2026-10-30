import { useEffect, useState } from 'react';
import { syncAppHeight } from './appHeight';
import { tastaturHoehe } from './useTastaturOffen';

/**
 * So viel Höhe bleibt dem Overlay über der Tastatur mindestens (samt 2 × 16 px Rand) – genug für Kopf und Knöpfe eines
 * Fensters. Eine echte Tastatur lässt hochkant deutlich mehr übrig; am Handy quer reicht das Fenster dann eher etwas
 * unter die Tastatur, als zu verschwinden.
 */
export const FENSTER_PLATZ_PX = 160;

/**
 * Hält einen Vollbild-Overlay über der iOS-Tastatur frei (#207).
 *
 * Zwei Dinge passieren auf iOS, sobald ein Eingabefeld fokussiert wird:
 *  1. Die Tastatur verdeckt den unteren Teil des Bildschirms – ohne Aussparung liegen Trefferlisten
 *     und Knöpfe darunter (im Dialog „Lied verknüpfen" waren die Treffer nicht erreichbar, man
 *     musste erst wischen). Der Overlay bekommt daher unten einen Innenabstand in Höhe der Tastatur
 *     (`--kb`, gemessen am `visualViewport`); weil er per Flexbox zentriert, rutscht der Inhalt
 *     automatisch in den verbleibenden Bereich.
 *  2. iOS scrollt zusätzlich das DOKUMENT nach oben, um das Feld über die Tastatur zu heben. Da die
 *     App eine feste Höhe hat (`--app-h`) und nur innere Container scrollen, bleibt die Seite danach
 *     verschoben: Die Kopfleiste wandert aus dem Bild und „klebt" hinterher oben mit einer Lücke.
 *     `scrollTo(0, 0)` neutralisiert das laufend.
 *
 * Das Rezept stammt aus dem ChordEditor, wo es sich bewährt hat – es liegt hier gemeinsam, damit die
 * beiden Kopien nicht auseinanderlaufen. Der Overlay MUSS `position: fixed` sein (nicht `absolute`),
 * sonst scrollt er mit dem Dokument mit und die Aussparung nützt nichts.
 */
export function useOverlayKeyboardInset(): (el: HTMLElement | null) => void {
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
    const apply = () => {
      // Sicherheitsnetz: Was auch immer gemeldet wird, das Fenster behält `FENSTER_PLATZ_PX` – nie wieder nur den
      // Schleier (30.10.2026; die Ursache, eine gemeldete Tastatur ohne Eingabefeld, fängt `tastaturHoehe`). Gerechnet
      // mit der Höhe des Overlays, nicht des Browserfensters: In ChurchTools liegt es unter dessen Leiste und ist
      // ~60 px kürzer (in der Test-Instanz gemessen: mit `innerHeight` blieben dem Fenster 63 statt 112 px).
      const hoehe = el.clientHeight || window.innerHeight;
      const kb = Math.min(tastaturHoehe(vv), Math.max(0, hoehe - FENSTER_PLATZ_PX));
      el.style.setProperty('--kb', `${kb}px`);
      if (window.scrollY !== 0 || vv.offsetTop !== 0) window.scrollTo(0, 0);
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      el.style.removeProperty('--kb');
      // Beim Schließen den Dokument-Scroll zurückholen und `--app-h` neu setzen – sonst bleibt die
      // Ansicht verschoben, wenn die Tastatur gemeinsam mit dem Dialog verschwindet.
      // `syncAppHeight` direkt statt eines synthetischen `resize`-Events (#215): Der Hook sitzt in
      // JEDEM Dialog, und das Event hätte beim Schließen eines Pickers nebenbei die Resize-Handler
      // von PageDeck/ChordChart/useChartNavigation ausgelöst – Fernwirkung auf Verdacht.
      window.scrollTo(0, 0);
      syncAppHeight();
    };
  }, [el]);

  // `setEl` kommt aus `useState` und hat eine stabile Identität – als Ref-Callback nutzbar,
  // ohne dass React ihn bei jedem Render mit null und dem Element erneut aufruft.
  return setEl;
}
