/**
 * Höhe der App als CSS-Variable `--app-h` (iOS-PWA) – und was unten am Rand frei bleiben muss.
 *
 * Liegt in einem eigenen Modul (#215), damit Hooks die Höhe direkt nachführen können. Vorher stand
 * die Funktion in `main.tsx`; ein Import von dort hätte beim Testen den kompletten App-Start
 * mitgezogen (React-Root mounten). Wer die Höhe neu setzen will, ruft `syncAppHeight()` – ein
 * synthetisches `resize`-Event würde nebenbei alle Resize-Handler der App auslösen.
 */

/** Was beim Messen gebraucht wird – als eigener Typ, damit die Regel ohne Gerät prüfbar ist. */
export interface UntenMessung {
  /** Läuft die Seite als App vom Home-Bildschirm (unsere PWA oder die ChurchTools-App)? */
  standalone: boolean;
  /** Ein iPhone (nur dort ist der Fall „Home-Strich ohne Safe-Area“ gemessen). */
  iphone: boolean;
  hochkant: boolean;
  innerHeight: number;
  /** Bildschirmhöhe in der aktuellen Ausrichtung (`screen` dreht sich auf iOS nicht mit). */
  bildschirmHoehe: number;
  /** Die lange Seite des Bildschirms – ab 812 hat ein iPhone den Home-Strich (SE: 667, Plus: 736). */
  langeSeite: number;
  /** `env(safe-area-inset-bottom)`, wie iOS ihn meldet. */
  safeAreaUnten: number;
  /** `100lvh` – die große Fensterhöhe. In unserer installierten App bei beiden Messungen 874 = Bildschirm. */
  grosseHoehe: number;
}

/**
 * **Die Regel für den unteren Rand** (Messung mit Alwin, 29.10.2026, iPhone 402×874, iOS 18.7).
 *
 * - `hoehe`: Wie hoch `html` sein muss. **`innerHeight` taugt dafür nicht** – in unserer installierten App meldete iOS
 *   einmal 874 (= Bildschirm) und nach einem Neustart 812 (Bildschirm ohne Statusleiste), bei sonst gleicher Lage.
 *   Bis zum 29.10. galt immer `innerHeight` + Safe-Area (19.06.2026: `innerHeight` schloss den Home-Strich aus) – die App
 *   ragte damit mal 34 pt unter die Kante, mal endete sie 28 pt darüber. Verlässlich war in beiden Fällen die große
 *   Fensterhöhe (`100lvh` = 874); sie gilt, wo sie zur aktuellen Ausrichtung passt (beim Drehen könnte sie kurz den
 *   alten Wert halten). Der Fall vom Juni (`innerHeight` + Safe-Area = Bildschirm) bleibt abgedeckt.
 * - `homeStrich`: Wie viel Platz der Home-Strich unten braucht. Normalerweise die Safe-Area. In der ChurchTools-App
 *   vom Home-Bildschirm meldet iOS 0 (gemessen: `innerHeight` 812 + Statusleiste 62 = 874), obwohl der Strich über
 *   dem Inhalt liegt – dort 34 pt hochkant, 21 pt quer (die iOS-Werte).
 */
export function untenWerte(m: UntenMessung): { hoehe: number; homeStrich: number } {
  let hoehe = m.innerHeight;
  if (m.standalone) {
    if (m.grosseHoehe > hoehe && m.grosseHoehe <= m.bildschirmHoehe + 2) hoehe = m.grosseHoehe;
    const plusSafeArea = m.innerHeight + m.safeAreaUnten;
    if (m.safeAreaUnten > 0 && Math.abs(plusSafeArea - m.bildschirmHoehe) <= 2)
      hoehe = Math.max(hoehe, plusSafeArea);
  }
  if (m.safeAreaUnten > 0) return { hoehe, homeStrich: m.safeAreaUnten };
  // Reicht die Seite bis zur Unterkante? Oben fehlt dann höchstens die Statusleiste (≤ 70 pt, quer gar nichts).
  const bisUnten = m.bildschirmHoehe - m.innerHeight <= 70;
  const mitStrich = m.iphone && m.langeSeite >= 812;
  return {
    hoehe,
    homeStrich: m.standalone && mitStrich && bisUnten ? (m.hochkant ? 34 : 21) : 0,
  };
}

let probe: HTMLDivElement | null = null;
/** Ein unsichtbares Element: oben gepolstert um die Safe-Area unten, so hoch wie `100lvh`. */
function probeMessen(): { safeAreaUnten: number; grosseHoehe: number } {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:100lvh;box-sizing:content-box;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-bottom,0px);';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  return { safeAreaUnten: parseFloat(cs.paddingTop) || 0, grosseHoehe: parseFloat(cs.height) || 0 };
}

/** `matchMedia` fehlt in alten Browsern und in der Testumgebung – dann gilt „nein“, statt dass der Start abbricht. */
function passt(abfrage: string): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(abfrage).matches;
}

function messen(): UntenMessung {
  const hochkant = window.innerHeight >= window.innerWidth;
  const lang = Math.max(screen.width, screen.height);
  const kurz = Math.min(screen.width, screen.height);
  return {
    standalone:
      passt('(display-mode: standalone)') ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    iphone: /iPhone/.test(navigator.userAgent),
    hochkant,
    innerHeight: window.innerHeight,
    bildschirmHoehe: hochkant ? lang : kurz,
    langeSeite: lang,
    ...probeMessen(),
  };
}

export function syncAppHeight(): void {
  // Bei geöffneter Tastatur (Eingabefeld fokussiert) NICHT mitschrumpfen: sonst reflowt die
  // GANZE App nach oben („alles verschiebt sich"). Das Freihalten des Cursors übernehmen die
  // Tastatur-Ausweich-Logiken in PageDeck/ChordEditor; nach dem Blur kommt ein Resize und
  // die Höhe wird wieder normal nachgeführt.
  const ae = document.activeElement as HTMLElement | null;
  if (ae && (ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
  const s = document.documentElement.style;
  // `--app-h` bleibt `innerHeight`: Gegen sie messen die Tastatur-Hilfen (`useTastaturOffen`, `useKeyboardInsets`) –
  // im Maß von `visualViewport`. Die volle Höhe für `html` steht getrennt in `--app-voll`.
  s.setProperty('--app-h', `${window.innerHeight}px`);
  const { hoehe, homeStrich } = untenWerte(messen());
  s.setProperty('--app-voll', `${hoehe}px`);
  s.setProperty('--home-strich', `${homeStrich}px`);
}

/**
 * Für die Erweiterungen ohne eigene Höhen-Nachführung (Dienstplaner, Anmeldungen, Protokolle, Organigramm): einmal
 * messen und beim Drehen/Größe-Ändern nachführen – damit `--home-strich` auch dort stimmt (Reiterleiste, Plus).
 */
export function untenNachfuehren(): void {
  syncAppHeight();
  window.addEventListener('resize', syncAppHeight);
  window.addEventListener('orientationchange', syncAppHeight);
}
