// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import {
  FENSTER_PLATZ_PX,
  TASTATUR_RUHE_MS,
  useOverlayKeyboardInset,
} from './useOverlayKeyboardInset';

/**
 * Mechanik der Tastatur-Aussparung (#207). Der eigentliche Effekt ist iOS-spezifisch, aber die
 * Rechnung, das Aufräumen und das Verhalten ohne `visualViewport` sind hier prüfbar.
 */
function Overlay() {
  const ref = useOverlayKeyboardInset();
  return <div ref={ref} data-testid="overlay" />;
}

interface FakeVv {
  height: number;
  offsetTop: number;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

function stubViewport(height: number, offsetTop = 0): FakeVv {
  const vv: FakeVv = {
    height,
    offsetTop,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  return vv;
}

// Eine Tastatur gibt es nur, wenn in einem Feld geschrieben wird (`tastaturHoehe`, 30.10.2026) – die Tests unten
// rechnen mit einem; wer ohne prüft, nimmt ihm den Fokus.
let schreibfeld: HTMLInputElement;
beforeEach(() => {
  schreibfeld = document.createElement('input');
  document.body.append(schreibfeld);
  schreibfeld.focus();
});

afterEach(() => {
  cleanup(); // sonst stapeln sich die gerenderten Overlays über die Tests hinweg
  schreibfeld.remove();
  Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
  vi.restoreAllMocks();
});

describe('useOverlayKeyboardInset', () => {
  it('setzt --kb auf die Höhe der Tastatur', () => {
    window.innerHeight = 800;
    stubViewport(500); // 800 - 500 - 0 = 300px Tastatur
    const { getByTestId } = render(<Overlay />);
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe('300px');
  });

  it('ohne Tastatur ist --kb 0 (nie negativ)', () => {
    window.innerHeight = 800;
    stubViewport(900); // größer als innerHeight → darf nicht negativ werden
    const { getByTestId } = render(<Overlay />);
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe('0px');
  });

  it('rechnet den vom Browser verschobenen Viewport mit ein', () => {
    window.innerHeight = 800;
    stubViewport(500, 100); // 800 - 500 - 100 = 200px
    const { getByTestId } = render(<Overlay />);
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe('200px');
  });

  it('hört auf Viewport-Änderungen und meldet sich beim Schließen wieder ab', () => {
    window.innerHeight = 800;
    const vv = stubViewport(500);
    const { unmount } = render(<Overlay />);
    expect(vv.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(vv.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
    unmount();
    expect(vv.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(vv.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('holt beim Schließen den Dokument-Scroll zurück', () => {
    window.innerHeight = 800;
    stubViewport(500);
    const scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollTo', { value: scrollTo, configurable: true });
    const { unmount } = render(<Overlay />);
    scrollTo.mockClear();
    unmount();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('ohne Feld, in dem geschrieben wird, spart es nichts aus – auch wenn iOS die Tastatur noch meldet', () => {
    // Alwin am iPad (30.10.2026): „Einstellungen“ gab nur den dunklen Schleier, das Fenster hatte 0 px.
    window.innerHeight = 800;
    stubViewport(60);
    schreibfeld.blur();
    const { getByTestId } = render(<Overlay />);
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe('0px');
  });

  it('Sicherheitsnetz: das Fenster behält immer seinen Platz, auch bei einer zu großen Meldung', () => {
    window.innerHeight = 800;
    stubViewport(60); // gemeldet: 740 px Tastatur – mit Feld im Fokus
    const { getByTestId } = render(<Overlay />);
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe(
      `${800 - FENSTER_PLATZ_PX}px`,
    );
  });

  it('Sicherheitsnetz rechnet mit der Höhe des Overlays – in ChurchTools ist es kürzer als das Fenster', () => {
    window.innerHeight = 800;
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(680); // unter der ChurchTools-Leiste
    stubViewport(60);
    const { getByTestId } = render(<Overlay />);
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe(
      `${680 - FENSTER_PLATZ_PX}px`,
    );
  });

  it('ohne visualViewport passiert nichts (kein Absturz, kein --kb)', () => {
    const { getByTestId } = render(<Overlay />);
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe('');
  });
});

/**
 * #215: Der Hook las das Element früher NUR beim Mount. Tauschte ein Dialog seine Wurzel aus
 * (zusätzlicher Wrapper, anderer `key`, zweiter Rückgabezweig), lief die Aussparung ins Leere –
 * ohne Fehler, nur mit Knöpfen unter der Tastatur. Mit dem Callback-Ref zieht sie mit.
 */
describe('useOverlayKeyboardInset – Wechsel der Overlay-Wurzel', () => {
  function Switcher({ zweite }: { zweite: boolean }) {
    const ref = useOverlayKeyboardInset();
    return zweite ? <div ref={ref} data-testid="zweite" /> : <div ref={ref} data-testid="erste" />;
  }

  it('spart auch die NEUE Wurzel aus, wenn der Dialog seinen Zweig wechselt', () => {
    stubViewport(500);
    window.innerHeight = 900;

    const { rerender, getByTestId } = render(<Switcher zweite={false} />);
    expect(getByTestId('erste').style.getPropertyValue('--kb')).toBe('400px');

    rerender(<Switcher zweite />);
    expect(getByTestId('zweite').style.getPropertyValue('--kb')).toBe('400px');
  });
});

/**
 * 18.11.2026 (Alwin am iPhone, „Punkt vorschlagen“): iOS feuert während der Tastatur-Animation viele `visualViewport`-
 * Ereignisse, das Fenster schrumpfte in kleinen Sprüngen. Hier mit echtem Event-Target und Fake-Timern – mit echten
 * Timern erledigte die Ruhezeit selbst, was der Test dem Hook zuschreibt.
 */
describe('useOverlayKeyboardInset – Ruhe statt Pixel-Verfolgung', () => {
  interface EchtesVv extends EventTarget {
    height: number;
    offsetTop: number;
  }

  function stubEchtesViewport(height: number): EchtesVv {
    const vv = Object.assign(new EventTarget(), { height, offsetTop: 0 });
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    return vv;
  }

  /** Tastatur bewegt sich: neue Höhe, ein Ereignis, dann `ms` vergehen lassen. */
  function melde(vv: EchtesVv, hoehe: number, ms = 0) {
    vv.height = hoehe;
    vv.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(ms);
  }

  function FensterMitFeld({ feldInsBild }: { feldInsBild?: boolean }) {
    const ref = useOverlayKeyboardInset({ feldInsBild });
    return (
      <div ref={ref} data-testid="overlay">
        <div data-testid="inhalt" style={{ overflowY: 'auto' }}>
          <input data-testid="innen" />
        </div>
      </div>
    );
  }

  /**
   * Gibt dem Inhalt ein Layout (jsdom hat keins): 100 px hoch, 400 px Inhalt, ab y = 100; das Feld bei y = 300, 42 px hoch –
   * also unterhalb des sichtbaren Bereichs. Liefert jede Zuweisung an `scrollTop`.
   */
  function layout(inhalt: HTMLElement, feld: HTMLElement): number[] {
    let top = 0;
    const gesetzt: number[] = [];
    Object.defineProperty(inhalt, 'scrollHeight', { value: 400, configurable: true });
    Object.defineProperty(inhalt, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(inhalt, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (v: number) => {
        top = v;
        gesetzt.push(v);
      },
    });
    inhalt.getBoundingClientRect = () => ({ top: 100, height: 100 }) as DOMRect;
    feld.getBoundingClientRect = () => ({ top: 300, height: 42 }) as DOMRect;
    return gesetzt;
  }

  let scrollIntoView: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    window.innerHeight = 800;
    // jsdom kennt `scrollIntoView` nicht
    scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      value: scrollIntoView,
      configurable: true,
      writable: true,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  });

  /** Alle `--kb`-Schreibzugriffe (mit Wert) seit dem Aufruf. */
  function kbSchreiber() {
    const orig = CSSStyleDeclaration.prototype.setProperty;
    const werte: string[] = [];
    vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty').mockImplementation(function (
      this: CSSStyleDeclaration,
      name: string,
      wert: string | null,
    ) {
      if (name === '--kb') werte.push(String(wert));
      orig.call(this, name, wert);
    });
    return werte;
  }

  it('schreibt --kb erst nach der Ruhezeit – genau einmal, mit dem End-Wert', () => {
    const vv = stubEchtesViewport(800);
    const { getByTestId } = render(<Overlay />);
    const werte = kbSchreiber();

    // Tastatur-Animation: viele Zwischenwerte im Abstand von 40 ms (kürzer als die Ruhezeit)
    [760, 700, 640, 580, 540, 520, 500].forEach((h) => melde(vv, h, 40));
    expect(werte).toEqual([]); // noch nichts geschrieben
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe('0px');

    vi.advanceTimersByTime(TASTATUR_RUHE_MS);
    expect(werte).toEqual(['300px']);
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe('300px');
  });

  it('jedes neue Ereignis startet die Ruhezeit neu', () => {
    const vv = stubEchtesViewport(800);
    const { getByTestId } = render(<Overlay />);
    melde(vv, 600, TASTATUR_RUHE_MS - 10); // 10 ms vor Ablauf …
    melde(vv, 500, TASTATUR_RUHE_MS - 10); // … kommt das nächste Ereignis: der Zähler beginnt von vorn
    // der erste Zähler wäre schon abgelaufen und hätte 200px geschrieben
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe('0px');
    vi.advanceTimersByTime(10);
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe('300px');
  });

  it('beim Schließen der Tastatur gilt 0 sofort – ohne Ruhezeit, ein wartender Zwischenwert verfällt', () => {
    const vv = stubEchtesViewport(500);
    const { getByTestId } = render(<Overlay />);
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe('300px');

    melde(vv, 520); // kurz davor: wieder ein Zwischenwert – wartet auf die Ruhezeit
    melde(vv, 800); // Tastatur zu
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe('0px');
    vi.advanceTimersByTime(TASTATUR_RUHE_MS * 3); // der verworfene Zwischenwert darf nicht mehr nachkommen
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe('0px');
  });

  it('ohne Schreibfeld (Fokus weg) gilt 0 ebenfalls sofort', () => {
    const vv = stubEchtesViewport(500);
    const { getByTestId } = render(<Overlay />);
    schreibfeld.blur();
    melde(vv, 500); // iOS meldet noch klein – `tastaturHoehe` sagt 0
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe('0px');
  });

  it('holt den Dokument-Scroll bei JEDEM Ereignis zurück, nicht erst nach der Ruhezeit', () => {
    const vv = stubEchtesViewport(800);
    const scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollTo', { value: scrollTo, configurable: true });
    render(<Overlay />);
    scrollTo.mockClear();
    vv.offsetTop = 40; // iOS hat das Dokument hochgeschoben
    vv.dispatchEvent(new Event('scroll'));
    expect(scrollTo).toHaveBeenCalledWith(0, 0); // sofort, die Ruhezeit ist noch nicht um
    scrollTo.mockClear();
    vv.offsetTop = 0; // nichts verschoben → nichts zu tun
    vv.dispatchEvent(new Event('resize'));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('data-tastatur steht, solange die Tastatur offen ist – und fällt mit ihr', () => {
    const vv = stubEchtesViewport(800);
    const { getByTestId } = render(<Overlay />);
    const overlay = getByTestId('overlay');
    expect(overlay.hasAttribute('data-tastatur')).toBe(false);

    melde(vv, 500, TASTATUR_RUHE_MS);
    expect(overlay.hasAttribute('data-tastatur')).toBe(true);

    melde(vv, 800);
    expect(overlay.hasAttribute('data-tastatur')).toBe(false);
  });

  it('data-tastatur kommt erst mit dem angewendeten Wert, nicht beim ersten Ereignis', () => {
    const vv = stubEchtesViewport(800);
    const { getByTestId } = render(<Overlay />);
    melde(vv, 500, TASTATUR_RUHE_MS - 1);
    expect(getByTestId('overlay').hasAttribute('data-tastatur')).toBe(false);
  });

  it('räumt beim Schließen --kb, data-tastatur und den wartenden Timer ab', () => {
    const vv = stubEchtesViewport(800);
    const { getByTestId, unmount } = render(<Overlay />);
    const overlay = getByTestId('overlay');
    melde(vv, 500, TASTATUR_RUHE_MS);
    melde(vv, 450); // wartet noch
    unmount();
    expect(overlay.style.getPropertyValue('--kb')).toBe('');
    expect(overlay.hasAttribute('data-tastatur')).toBe(false);
    vi.advanceTimersByTime(TASTATUR_RUHE_MS * 2); // darf nichts mehr schreiben
    expect(overlay.style.getPropertyValue('--kb')).toBe('');
  });

  it('holt das fokussierte Feld im Fenster nach dem Anwenden ins Bild', () => {
    const vv = stubEchtesViewport(800);
    const { getByTestId } = render(<FensterMitFeld />);
    const gesetzt = layout(getByTestId('inhalt'), getByTestId('innen'));
    getByTestId('innen').focus();

    melde(vv, 500, TASTATUR_RUHE_MS - 1);
    expect(gesetzt).toEqual([]); // erst nach dem Anwenden
    vi.advanceTimersByTime(1);
    // Unterkante des Felds (300 − 100 + 42) an die Unterkante des Inhalts (100): 142.
    expect(gesetzt).toEqual([142]);
    // Nur der Inhalt des Fensters scrollt – nie `scrollIntoView`, das in ChurchTools die Seite verschob (menueLage.ts).
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('ein Feld außerhalb des Fensters wird nicht angefasst', () => {
    const vv = stubEchtesViewport(800);
    const { getByTestId } = render(<FensterMitFeld />);
    const gesetzt = layout(getByTestId('inhalt'), getByTestId('innen'));
    schreibfeld.focus(); // das Feld liegt im body, nicht im Overlay
    melde(vv, 500, TASTATUR_RUHE_MS);
    expect(gesetzt).toEqual([]);
  });

  it('beim Schließen der Tastatur wird nichts ins Bild geholt', () => {
    const vv = stubEchtesViewport(500);
    const { getByTestId } = render(<FensterMitFeld />);
    const gesetzt = layout(getByTestId('inhalt'), getByTestId('innen'));
    getByTestId('innen').focus();
    gesetzt.length = 0;
    melde(vv, 800);
    expect(gesetzt).toEqual([]);
  });

  it('feldInsBild: false schaltet das Ins-Bild-Holen ab (Lied-Editor)', () => {
    const vv = stubEchtesViewport(800);
    const { getByTestId } = render(<FensterMitFeld feldInsBild={false} />);
    const gesetzt = layout(getByTestId('inhalt'), getByTestId('innen'));
    getByTestId('innen').focus();
    melde(vv, 500, TASTATUR_RUHE_MS);
    expect(gesetzt).toEqual([]);
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe('300px');
  });
});
