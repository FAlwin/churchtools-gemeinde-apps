// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BlattKopf } from './BlattKopf';
import {
  KOMPAKT_UNTER_BREITE,
  KOMPAKT_UNTER_HOEHE,
  kopfAufbau,
  leistenTipp,
  verfuegbareWerkzeuge,
} from '../utils/werkzeuge';
import type { HeadInfoPart } from '../utils/activeSongView';

/**
 * **Die Kopfkarte des Liedblatts** (Scheibe B1+B2, löst `ChartHeader` ab). Geprüft wird, was hier entschieden wird:
 * welche Zahl neben dem gewählten Lied steht und womit der Puls schlägt (übernommen aus den Tests des alten Kopfs –
 * dort durch eine leere Gegenprobe entdeckt), welche Knöpfe es in welchem Zustand gibt, der Aufbau breit/kompakt, die
 * Ablauf-Leiste und die gemessene Unterkante.
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const LIEDER = [
  { idx: 0, titel: 'Treu' },
  { idx: 1, titel: 'Halleluja' },
  { idx: 2, titel: 'Heilig' },
];

const props = {
  kopf: { titel: 'Gottesdienst – Sonntag, 01. Nov · 10:00', zurueckZiel: 'Ablauf' },
  lieder: LIEDER,
  mitNummer: true,
  sichtbar: new Set([0]) as ReadonlySet<number>,
  gewaehlt: 0,
  onLiedTipp: vi.fn(),
  offenesWerkzeug: null as 'aussehen' | 'tempo' | null,
  headInfo: [] as HeadInfoPart[],
  menuOpen: false,
  liedFensterOffen: false,
  viewing: false,
  showsDocument: false,
  canUseGlobalNotes: false,
  drawMode: false,
  zoomed: false,
  bpmPulse: false,
  pulsBpm: null as number | null,
  klickBpm: null as number | null,
  taktStartMs: null as number | null,
  schlaegeProTakt: 4,
  tempoAktiv: false,
  onBack: vi.fn(),
  onAppearance: vi.fn(),
  onTempo: vi.fn(),
  onResetZoom: vi.fn(),
  onToggleTeamNotes: vi.fn(),
  onToggleDraw: vi.fn(),
};

function zeige(over: Partial<ComponentProps<typeof BlattKopf>> = {}) {
  return render(<BlattKopf {...props} {...over} />);
}

/** Die Angabe neben dem gewählten Lied als Text. */
const infoZeile = (c: HTMLElement) =>
  (c.querySelector('[aria-current="true"] [class*="info"]')?.textContent ?? '').trim();

/** Die beschrifteten Knöpfe in Reihenfolge (ohne Zurück, Vollbild und Leiste). */
const knoepfe = (c: HTMLElement) =>
  [...c.querySelectorAll('[data-tour="chart-werkzeuge"] button')].map((b) =>
    b.getAttribute('aria-label'),
  );

describe('BlattKopf – die Tempo-Angabe neben dem gewählten Lied', () => {
  it('zeigt das Tempo des Lieds', () => {
    const { container } = zeige({ headInfo: [{ art: 'bpm', bpm: 72 }] });
    expect(infoZeile(container)).toContain('72');
  });

  it('zeigt statt dessen das EINGESTELLTE Tempo, sobald eines abweicht', () => {
    const { container } = zeige({ headInfo: [{ art: 'bpm', bpm: 72 }], pulsBpm: 96 });
    expect(infoZeile(container)).toContain('96');
    expect(infoZeile(container)).not.toContain('72');
  });

  it('zeigt ein eingestelltes Tempo AUCH, wenn im Lied keines steht', () => {
    // Der gemeldete Fehler: „Der Puls wird erst sichtbar, wenn ich in ChurchTools gespeichert habe."
    const { container } = zeige({ headInfo: [{ art: 'key', text: 'A' }], pulsBpm: 96 });
    expect(infoZeile(container)).toContain('96');
  });

  it('zeigt es sogar, wenn das Lied gar keine Info hätte', () => {
    const { container } = zeige({ headInfo: [], pulsBpm: 96 });
    expect(infoZeile(container)).toContain('96');
  });

  it('zeigt ohne jedes Tempo auch keines an', () => {
    const { container } = zeige({ headInfo: [{ art: 'key', text: 'A' }] });
    expect(infoZeile(container)).toBe('A');
  });

  it('hängt das Tempo NICHT doppelt an, wenn das Lied schon eines hat', () => {
    const { container } = zeige({ headInfo: [{ art: 'bpm', bpm: 72 }], pulsBpm: 96 });
    expect(infoZeile(container).match(/96/g)?.length).toBe(1);
  });

  it('die Angabe steht nur beim gewählten Lied, nicht bei den anderen', () => {
    const { container } = zeige({ headInfo: [{ art: 'key', text: 'E' }], gewaehlt: 1 });
    const halleluja = screen.getByRole('button', { name: /Halleluja/ });
    expect(halleluja.textContent).toContain('E');
    expect(screen.getByRole('button', { name: /Treu/ }).textContent).not.toContain('E');
    expect(container.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
  });
});

describe('BlattKopf – der Puls schlägt im GEZÄHLTEN Tempo', () => {
  /** Pulst es? Der Punkt erscheint nur bei brauchbarem gezähltem Tempo. */
  function pulst(over: Partial<typeof props>): boolean {
    const { container } = zeige({ ...over, bpmPulse: true });
    return container.querySelector('[class*="punkt"]') !== null;
  }

  it('pulst, wenn ein gezähltes Tempo da ist', () => {
    expect(pulst({ headInfo: [{ art: 'bpm', bpm: 120 }], klickBpm: 40 })).toBe(true);
  });

  it('pulst NICHT, wenn das gezählte Tempo unbrauchbar wird', () => {
    // 30 Grundschläge in Dreiergruppen = 10 gezählte je Minute – angezeigt wird trotzdem die 30.
    expect(pulst({ headInfo: [{ art: 'bpm', bpm: 30 }], klickBpm: 10 })).toBe(false);
  });

  it('zeigt dabei weiter die Grundschläge an', () => {
    const { container } = zeige({ headInfo: [{ art: 'bpm', bpm: 120 }], klickBpm: 40 });
    expect(infoZeile(container)).toContain('120');
    expect(infoZeile(container)).not.toContain('40');
  });
});

describe('BlattKopf – die Knöpfe je Zustand (gegen `verfuegbareWerkzeuge`)', () => {
  it('Akkorde: Aussehen, Tempo, Anmerken – beschriftet', () => {
    const { container } = zeige();
    expect(knoepfe(container)).toEqual(['Aussehen', 'Tempo', 'Anmerken']);
    expect(screen.getByRole('button', { name: 'Aussehen' }).textContent).toContain('Aussehen');
  });

  it('mit Zoom und Team-Recht kommen „Zoom zurücksetzen“ und „Notizen von …“ dazu', () => {
    const { container } = zeige({ zoomed: true, canUseGlobalNotes: true });
    expect(knoepfe(container)).toEqual([
      'Aussehen',
      'Tempo',
      'Zoom zurücksetzen',
      'Notizen von …',
      'Anmerken',
    ]);
  });

  it('Dokument: weder Aussehen noch Notizen', () => {
    const { container } = zeige({ showsDocument: true, canUseGlobalNotes: true });
    expect(knoepfe(container)).toEqual(['Tempo', 'Anmerken']);
  });

  it('beim Ansehen fremder Notizen nur der Weg zurück – hervorgehoben', () => {
    const { container } = zeige({ viewing: true, canUseGlobalNotes: true });
    expect(knoepfe(container)).toEqual(['Zurück zu den eigenen Notizen']);
    const zurueck = screen.getByRole('button', { name: 'Zurück zu den eigenen Notizen' });
    expect(zurueck.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(zurueck);
    expect(props.onToggleTeamNotes).toHaveBeenCalledTimes(1);
  });

  it('beim Zeichnen heißt Anmerken „Anmerken beenden“ und ist hervorgehoben', () => {
    zeige({ drawMode: true });
    const knopf = screen.getByRole('button', { name: 'Anmerken beenden' });
    expect(knopf.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Anmerken' })).toBeNull();
  });

  it('Puls oder Klick laufen: „Tempo“ ist hervorgehoben, sonst nicht', () => {
    const { rerender } = zeige();
    expect(screen.getByRole('button', { name: 'Tempo' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    rerender(<BlattKopf {...props} tempoAktiv />);
    expect(screen.getByRole('button', { name: 'Tempo' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('ein offenes Fenster markiert SEINEN Knopf (hellblau), ohne ihn „gedrückt“ zu machen', () => {
    zeige({ offenesWerkzeug: 'aussehen' });
    const aussehen = screen.getByRole('button', { name: 'Aussehen' });
    expect(aussehen.className).toMatch(/offen/);
    expect(aussehen.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Tempo' }).className).not.toMatch(/offen/);
  });

  it('jeder Knopf ruft genau SEINE Aktion – einmal', () => {
    const p = {
      onAppearance: vi.fn(),
      onTempo: vi.fn(),
      onResetZoom: vi.fn(),
      onToggleTeamNotes: vi.fn(),
      onToggleDraw: vi.fn(),
    };
    zeige({ ...p, zoomed: true, canUseGlobalNotes: true });
    for (const [name, fn] of [
      ['Aussehen', p.onAppearance],
      ['Tempo', p.onTempo],
      ['Zoom zurücksetzen', p.onResetZoom],
      ['Notizen von …', p.onToggleTeamNotes],
      ['Anmerken', p.onToggleDraw],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });
});

describe('BlattKopf – Titelzeile und Vollbild', () => {
  it('breit: „← Ablauf“ und der Termin als Titel', () => {
    const onBack = vi.fn();
    zeige({ onBack });
    expect(screen.getByText('Gottesdienst – Sonntag, 01. Nov · 10:00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zurück zu Ablauf' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('ohne onVollbild (Homescreen-App) gibt es keinen Vollbild-Knopf', () => {
    zeige();
    expect(screen.queryByRole('button', { name: 'Vollbild' })).toBeNull();
  });

  it('Knopf „Vollbild“, Tipp schaltet; eingeschaltet heißt er „Vollbild beenden“', () => {
    const onVollbild = vi.fn();
    const { rerender } = zeige({ onVollbild });
    fireEvent.click(screen.getByRole('button', { name: 'Vollbild' }));
    expect(onVollbild).toHaveBeenCalledTimes(1);
    rerender(<BlattKopf {...props} onVollbild={onVollbild} vollbildAn />);
    expect(screen.getByRole('button', { name: 'Vollbild beenden' })).toBeTruthy();
  });
});

describe('kopfAufbau – breit oder kompakt', () => {
  it('iPad hochkant (744 breit) und quer: breit', () => {
    expect(kopfAufbau({ breite: 744 - 32, hoehe: 1133 })).toBe('breit');
    expect(kopfAufbau({ breite: 1180 - 32, hoehe: 820 })).toBe('breit');
  });
  it('Handy hochkant: kompakt', () => {
    expect(kopfAufbau({ breite: 390 - 16, hoehe: 844 })).toBe('kompakt');
  });
  it('Handy quer: breit genug, aber zu niedrig für zwei Zeilen – flach', () => {
    expect(kopfAufbau({ breite: 844 - 32, hoehe: 390 })).toBe('flach');
  });
  it('niedrig geht vor schmal: kleines Fenster – flach', () => {
    expect(kopfAufbau({ breite: 390 - 16, hoehe: 420 })).toBe('flach');
  });
  it('genau an den Grenzen: breit; ein Pixel darunter: kompakt bzw. flach', () => {
    expect(kopfAufbau({ breite: KOMPAKT_UNTER_BREITE, hoehe: KOMPAKT_UNTER_HOEHE })).toBe('breit');
    expect(kopfAufbau({ breite: KOMPAKT_UNTER_BREITE - 1, hoehe: 900 })).toBe('kompakt');
    expect(kopfAufbau({ breite: 900, hoehe: KOMPAKT_UNTER_HOEHE - 1 })).toBe('flach');
  });
  it('ohne Messung (jsdom, noch kein Layout): breit', () => {
    expect(kopfAufbau({ breite: 0, hoehe: 0 })).toBe('breit');
  });
});

describe('BlattKopf – kompakt (Handy)', () => {
  function handy() {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(374);
  }

  it('keine Titelzeile: Zurück und Vollbild nur als Symbol neben der Leiste', () => {
    handy();
    zeige({ onVollbild: vi.fn() });
    expect(screen.queryByText('Gottesdienst – Sonntag, 01. Nov · 10:00')).toBeNull();
    const zurueck = screen.getByRole('button', { name: 'Zurück zu Ablauf' });
    expect(zurueck.textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Vollbild' })).toBeTruthy();
  });

  it('Knöpfe im Raster mit Kurzwort – der volle Name bleibt für Screenreader', () => {
    handy();
    const { container } = zeige({ canUseGlobalNotes: true });
    const raster = container.querySelector('[data-tour="chart-werkzeuge"]') as HTMLElement;
    expect(raster.className).toMatch(/raster/);
    expect(raster.style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
    const notizen = screen.getByRole('button', { name: 'Notizen von …' });
    expect(notizen.textContent).toBe('Notizen');
  });
});

describe('BlattKopf – flach (Handy quer)', () => {
  it('eine Zeile: keine Titelzeile, Knöpfe nur als Symbol, kein Raster', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(812);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(390);
    const { container } = zeige({ onVollbild: vi.fn() });
    expect(screen.queryByText('Gottesdienst – Sonntag, 01. Nov · 10:00')).toBeNull();
    const reihe = container.querySelector('[data-tour="chart-werkzeuge"]') as HTMLElement;
    expect(reihe.className).not.toMatch(/raster/);
    expect(screen.getByRole('button', { name: 'Aussehen' }).textContent).toBe('Aa');
    expect(screen.getByRole('button', { name: 'Zurück zu Ablauf' }).textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Vollbild' })).toBeTruthy();
  });
});

describe('Ablauf-Leiste (Scheibe B2)', () => {
  it('alle Lieder mit Nummer; das gewählte trägt aria-current und öffnet ein Menü', () => {
    const { container } = zeige({ gewaehlt: 1, sichtbar: new Set([1]) });
    const leiste = screen.getByRole('navigation', { name: 'Lieder im Ablauf' });
    expect(leiste.textContent).toContain('1Treu');
    expect(leiste.textContent).toContain('2Halleluja');
    expect(leiste.textContent).toContain('3Heilig');
    const gewaehlt = container.querySelector('[aria-current="true"]')!;
    expect(gewaehlt.textContent).toContain('Halleluja');
    expect(gewaehlt.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('einzelnes Lied aus der Liederliste: ohne Nummer', () => {
    zeige({ lieder: [{ idx: 0, titel: 'Treu' }], mitNummer: false });
    expect(screen.getByRole('navigation', { name: 'Lieder im Ablauf' }).textContent).toBe('Treu');
  });

  it('sichtbare Lieder sind hinterlegt, das gewählte unterstrichen', () => {
    zeige({ gewaehlt: 0, sichtbar: new Set([0, 1]) });
    const [treu, halleluja, heilig] = ['Treu', 'Halleluja', 'Heilig'].map((t) =>
      screen.getByRole('button', { name: new RegExp(t) }),
    );
    expect(treu.className).toMatch(/liedSichtbar/);
    expect(treu.className).toMatch(/liedGewaehlt/);
    expect(halleluja.className).toMatch(/liedSichtbar/);
    expect(halleluja.className).not.toMatch(/liedGewaehlt/);
    expect(heilig.className).not.toMatch(/liedSichtbar/);
  });

  it('Lied-Menü oder eines seiner Fenster offen: das gewählte ist hellblau', () => {
    zeige({ liedFensterOffen: true });
    expect(screen.getByRole('button', { name: /Treu/ }).className).toMatch(/liedOffen/);
  });

  it('ein Tipp meldet das Lied an den Aufrufer', () => {
    const onLiedTipp = vi.fn();
    zeige({ onLiedTipp });
    fireEvent.click(screen.getByRole('button', { name: /Heilig/ }));
    expect(onLiedTipp).toHaveBeenCalledWith(2);
  });

  it('scrollt mit, wenn das gewählte Lied außerhalb steht – sonst nicht', () => {
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      value: scrollTo,
      configurable: true,
    });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(40);
    // Lied k steht bei k × 200 px; die Leiste zeigt 300 px, an den Rändern blendet sie 24 px aus.
    vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return Number(this.dataset.lied ?? 0) * 200;
    });
    const { rerender } = zeige({ gewaehlt: 0 });
    scrollTo.mockClear();
    // Lied 1 (200–240 px) ist zu sehen: kein Scrollen.
    rerender(<BlattKopf {...props} gewaehlt={1} />);
    expect(scrollTo).not.toHaveBeenCalled();
    // Lied 2 (400 px) liegt dahinter: so weit scrollen, dass es mit Rand zu sehen ist.
    rerender(<BlattKopf {...props} gewaehlt={2} />);
    expect(scrollTo).toHaveBeenCalledWith({ left: 400 - 24, behavior: 'smooth' });
    delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
  });
});

describe('leistenTipp – was ein Tipp in der Leiste tut', () => {
  const b = { gewaehlt: 3, sichtbar: new Set([3, 4]), ansehen: false };
  it('das gewählte → sein Lied-Menü', () => {
    expect(leistenTipp(3, b)).toBe('menue');
  });
  it('beim Ansehen fremder Notizen öffnet das gewählte NICHTS – das Lied-Menü ist gesperrt', () => {
    expect(leistenTipp(3, { ...b, ansehen: true })).toBe('nichts');
    // Wählen und Springen gehen weiter.
    expect(leistenTipp(4, { ...b, ansehen: true })).toBe('waehlen');
  });
  it('ein anderes sichtbares (Querformat) → wählen', () => {
    expect(leistenTipp(4, b)).toBe('waehlen');
  });
  it('eines, das nicht zu sehen ist → hinspringen', () => {
    expect(leistenTipp(7, b)).toBe('springen');
  });
});

describe('BlattKopf – gemessene Unterkante für die Fenster darunter', () => {
  it('setzt die Unterkante (relativ und am Bildschirm) und räumt beim Verlassen auf', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 56,
      bottom: 180,
      left: 0,
      right: 800,
      width: 800,
      height: 124,
      x: 0,
      y: 56,
      toJSON: () => ({}),
    });
    const { unmount } = zeige();
    const wurzel = document.documentElement.style;
    expect(wurzel.getPropertyValue('--blatt-kopf-unten-fix')).toBe('180px');
    expect(wurzel.getPropertyValue('--blatt-kopf-unten')).not.toBe('');
    unmount();
    expect(wurzel.getPropertyValue('--blatt-kopf-unten')).toBe('');
    expect(wurzel.getPropertyValue('--blatt-kopf-unten-fix')).toBe('');
  });
});

describe('verfuegbareWerkzeuge – die eine Regel', () => {
  const basis = { zeigtDokument: false, ansehen: false, gezoomt: false, teamNotizen: false };
  it('Akkorde: Aussehen, Tempo, Anmerken', () => {
    expect(verfuegbareWerkzeuge(basis)).toEqual(['aussehen', 'tempo', 'anmerken']);
  });
  it('mit Zoom und Team-Recht kommen Zoom und Notizen dazu', () => {
    expect(verfuegbareWerkzeuge({ ...basis, gezoomt: true, teamNotizen: true })).toEqual([
      'aussehen',
      'tempo',
      'zoom',
      'team',
      'anmerken',
    ]);
  });
  it('Dokument: weder Aussehen noch Notizen', () => {
    expect(verfuegbareWerkzeuge({ ...basis, zeigtDokument: true, teamNotizen: true })).toEqual([
      'tempo',
      'anmerken',
    ]);
  });
  it('beim Ansehen fremder Notizen nur der Weg zurück', () => {
    expect(verfuegbareWerkzeuge({ ...basis, ansehen: true, teamNotizen: true })).toEqual(['team']);
  });
});
