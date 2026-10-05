// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ChartHeader, type AndereHaelfte } from './ChartHeader';
import { KAPSEL_MIN, verfuegbareWerkzeuge, werkzeugeEinzeln } from '../utils/werkzeuge';
import type { HeadInfoPart } from '../utils/activeSongView';

/**
 * Die Kopfzeile war bis hierhin ungeprüft – aufgefallen ist das erst durch eine **leere
 * Gegenprobe**: Der gemeldete Fehler „der Puls wird erst sichtbar, wenn ich in ChurchTools
 * gespeichert habe" liess sich zurücknehmen, ohne dass ein Test fiel.
 *
 * Geprüft wird deshalb genau das, was hier entschieden wird und sonst nirgends: **welche Zahl in
 * der Info-Zeile steht** und **womit der Puls schlägt**. Beides ist im Tempo-Menü unterschiedlich –
 * angezeigt werden die Grundschläge (so steht es in ChurchTools), gepulst wird im gezählten Tempo.
 */
const props = {
  songTitle: 'Höher',
  andereHaelfte: null as AndereHaelfte | null,
  querformat: false,
  offenesWerkzeug: null as 'aussehen' | 'tempo' | null,
  headInfo: [] as HeadInfoPart[],
  menuOpen: false,
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
  werkzeugeOffen: false,
  werkzeugFensterOffen: false,
  liedFensterOffen: false,
  tempoAktiv: false,
  onBack: vi.fn(),
  onToggleMenu: vi.fn(),
  onToggleWerkzeuge: vi.fn(),
  onCloseWerkzeuge: vi.fn(),
  onAppearance: vi.fn(),
  onTempo: vi.fn(),
  onResetZoom: vi.fn(),
  onToggleTeamNotes: vi.fn(),
  onToggleDraw: vi.fn(),
};

function zeige(over: Partial<typeof props> = {}) {
  return render(<ChartHeader {...props} {...over} />);
}

/** Die Info-Zeile unter dem Titel als Text. */
const infoZeile = (c: HTMLElement) =>
  (c.querySelector('[class*="menuInfo"]')?.textContent ?? '').trim();

describe('ChartHeader – die Tempo-Angabe', () => {
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
    // Der gemeldete Fehler: Ohne Tempo in ChurchTools gab es keinen Tempo-Teil in `headInfo` – also
    // weder Zahl noch Puls, obwohl der Klick längst damit lief. „Man sieht nichts, bis man
    // gespeichert hat."
    const { container } = zeige({ headInfo: [{ art: 'key', text: 'A' }], pulsBpm: 96 });
    expect(infoZeile(container)).toContain('96');
  });

  it('zeigt es sogar, wenn das Lied gar keine Info-Zeile hätte', () => {
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
});

describe('ChartHeader – der Puls schlägt im GEZÄHLTEN Tempo', () => {
  /** Wie schnell pulst es? Ausgelesen aus dem, was die Kopfzeile an `BpmPulse` weiterreicht. */
  function pulsTempo(over: Partial<typeof props>): number | null {
    const { container } = zeige({ ...over, bpmPulse: true });
    // Der Punkt erscheint nur bei brauchbarem Tempo – seine Anwesenheit ist das Signal.
    const punkt = container.querySelector('[class*="punkt"]');
    return punkt ? 1 : null;
  }

  it('pulst, wenn ein gezähltes Tempo da ist', () => {
    expect(pulsTempo({ headInfo: [{ art: 'bpm', bpm: 120 }], klickBpm: 40 })).toBe(1);
  });

  it('pulst NICHT, wenn das gezählte Tempo unbrauchbar wird', () => {
    // 30 Grundschläge in Dreiergruppen = 10 gezählte je Minute. Angezeigt wird trotzdem die 30 –
    // gepulst wird nichts. Nähme der Puls die angezeigte Zahl, schlüge er dreimal zu schnell.
    expect(pulsTempo({ headInfo: [{ art: 'bpm', bpm: 30 }], klickBpm: 10 })).toBeNull();
  });

  it('zeigt dabei weiter die Grundschläge an', () => {
    const { container } = zeige({ headInfo: [{ art: 'bpm', bpm: 120 }], klickBpm: 40 });
    expect(infoZeile(container)).toContain('120');
    expect(infoZeile(container)).not.toContain('40');
  });
});

/**
 * **Ein Knopf für alle Werkzeuge** (02.10.2026, Alwin). Geprüft werden die Bedingungen, die früher
 * an den einzelnen Knöpfen hingen und jetzt an den Menü-Einträgen – und die beiden Modi, aus denen
 * der Knopf selbst wieder herausführen muss, weil es dafür keinen anderen sichtbaren Weg gibt.
 */
describe('ChartHeader – der Werkzeuge-Knopf', () => {
  const eintraege = () =>
    within(screen.getByRole('menu', { name: 'Werkzeuge' }))
      .getAllByRole('menuitem')
      .map((b) => b.textContent);

  it('öffnet das Menü und meldet seinen Zustand', () => {
    const onToggleWerkzeuge = vi.fn<() => void>();
    zeige({ onToggleWerkzeuge });
    const knopf = screen.getByRole('button', { name: 'Werkzeuge' });
    expect(knopf.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(knopf);
    expect(onToggleWerkzeuge).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('zeigt im Menü Aussehen, Tempo und Anmerken – Tempo auch ohne gepflegtes Tempo', () => {
    zeige({ werkzeugeOffen: true, headInfo: [{ art: 'key', text: 'A' }] });
    expect(eintraege()).toEqual(['AussehenAa', 'Tempo', 'Anmerken']);
  });

  it('nimmt Zoom und Notizen von anderen nur auf, wenn es sie gibt', () => {
    zeige({ werkzeugeOffen: true, zoomed: true, canUseGlobalNotes: true });
    expect(eintraege()).toEqual([
      'AussehenAa',
      'Tempo',
      'Zoom zurücksetzen',
      'Notizen von …',
      'Anmerken',
    ]);
  });

  it('lässt bei einem Dokument Aussehen und Notizen weg (sie wirken nur auf Akkorde)', () => {
    zeige({ werkzeugeOffen: true, showsDocument: true, canUseGlobalNotes: true });
    expect(eintraege()).toEqual(['Tempo', 'Anmerken']);
  });

  it('ein Eintrag ruft NUR seine Aktion – kein Schließen hinterher (es setzte das Fenster zurück)', () => {
    const onTempo = vi.fn<() => void>();
    const onCloseWerkzeuge = vi.fn<() => void>();
    zeige({ werkzeugeOffen: true, onTempo, onCloseWerkzeuge });
    fireEvent.click(screen.getByRole('menuitem', { name: /Tempo/ }));
    expect(onTempo).toHaveBeenCalledTimes(1);
    expect(onCloseWerkzeuge).not.toHaveBeenCalled();
  });

  it('wird beim Zeichnen zum Haken, der das Zeichnen beendet', () => {
    const onToggleDraw = vi.fn<() => void>();
    zeige({ drawMode: true, werkzeugeOffen: true, onToggleDraw });
    expect(screen.queryByRole('button', { name: 'Werkzeuge' })).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Anmerken beenden' }));
    expect(onToggleDraw).toHaveBeenCalledTimes(1);
  });

  it('führt beim Ansehen fremder Notizen zurück zu den eigenen', () => {
    const onToggleTeamNotes = vi.fn<() => void>();
    zeige({ viewing: true, onToggleTeamNotes });
    fireEvent.click(screen.getByRole('button', { name: 'Zurück zu den eigenen Notizen' }));
    expect(onToggleTeamNotes).toHaveBeenCalledTimes(1);
  });

  it('ist hellblau, solange eines seiner Fenster offen ist – voll blau bleibt dem Puls vorbehalten', () => {
    zeige({ werkzeugFensterOffen: true });
    const knopf = screen.getByRole('button', { name: 'Werkzeuge' });
    expect(knopf.className).toMatch(/offen/);
    expect(knopf.className).not.toMatch(/aktiv/);
  });

  it('färbt auch die Titel-Kapsel, solange das Lied-Menü oder eines seiner Fenster offen ist', () => {
    const { container } = zeige({ liedFensterOffen: true });
    expect(container.querySelector('[data-tour="chart-lied"]')?.className).toMatch(/menuBtnOffen/);
  });

  it('leuchtet, solange Puls oder Klick laufen', () => {
    zeige({ tempoAktiv: true });
    expect(screen.getByRole('button', { name: 'Werkzeuge' }).className).toMatch(/aktiv/);
  });
});

/**
 * **Querformat mit zwei Liedern** (#421, Entwurf mit Alwin 03.10.2026): je Hälfte eine Kapsel. Die
 * aktive öffnet das Lied-Menü, die andere wählt nur ihr Lied – vorher tat das ein Tipp aufs Blatt
 * und schaltete dabei ins Vollbild.
 */
describe('ChartHeader – zwei Kapseln im Querformat', () => {
  const andere = (
    slot: 0 | 1,
    onWaehlen = vi.fn<() => void>(),
    onWerkzeug = vi.fn<(id: string) => void>(),
  ): AndereHaelfte => ({
    slot,
    titel: 'Jesus Herr ich denke an dein Opfer',
    info: [{ art: 'key', text: 'E' }] as HeadInfoPart[],
    zeigtDokument: false,
    onWaehlen,
    onWerkzeug,
  });

  it('zeigt ohne zweites Lied nur eine Kapsel', () => {
    zeige();
    expect(screen.queryByRole('button', { name: /auswählen$/ })).toBeNull();
  });

  it('die andere Kapsel wählt nur ihr Lied – sie öffnet kein Menü', () => {
    const onWaehlen = vi.fn<() => void>();
    const onToggleMenu = vi.fn<() => void>();
    zeige({ querformat: true, andereHaelfte: andere(1, onWaehlen), onToggleMenu });
    fireEvent.click(
      screen.getByRole('button', { name: 'Jesus Herr ich denke an dein Opfer auswählen' }),
    );
    expect(onWaehlen).toHaveBeenCalledTimes(1);
    expect(onToggleMenu).not.toHaveBeenCalled();
  });

  it('die aktive Kapsel trägt den Ring und öffnet weiter das Lied-Menü', () => {
    const onToggleMenu = vi.fn<() => void>();
    const { container } = zeige({ querformat: true, andereHaelfte: andere(1), onToggleMenu });
    const aktiv = container.querySelector('[data-tour="chart-lied"]')!;
    expect(aktiv.className).toMatch(/kapselAktiv/);
    fireEvent.click(aktiv);
    expect(onToggleMenu).toHaveBeenCalledTimes(1);
  });

  it('steht auf der Seite ihres Blatts: links aktiv → andere rechts, und umgekehrt', () => {
    const reihenfolge = (c: HTMLElement) =>
      Array.from(c.querySelectorAll('[class*="kapselPaar"] > div')).map((g) =>
        g.querySelector('[data-tour="chart-lied"]') ? 'aktiv' : 'andere',
      );
    const erste = zeige({ querformat: true, andereHaelfte: andere(1) });
    expect(reihenfolge(erste.container)).toEqual(['aktiv', 'andere']);
    erste.unmount();
    const zweite = zeige({ querformat: true, andereHaelfte: andere(0) });
    expect(reihenfolge(zweite.container)).toEqual(['andere', 'aktiv']);
  });
});

/**
 * **Werkzeuge einzeln je Lied im Querformat** (Alwin, 03.10.2026: „nicht hinter einen gemeinsamen
 * Button, sondern jeweils einzeln … bitte immer über dem Lied"). Eine Regel (`verfuegbareWerkzeuge`)
 * für Menü und Knöpfe – geprüft wird sie selbst und dass beide Darstellungen sie nutzen.
 */
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

describe('ChartHeader – Werkzeuge einzeln im Querformat', () => {
  const andere = (onWerkzeug = vi.fn<(id: string) => void>()): AndereHaelfte => ({
    slot: 1,
    titel: 'Staunen',
    info: [],
    zeigtDokument: false,
    onWaehlen: vi.fn<() => void>(),
    onWerkzeug,
  });

  it('kein gemeinsamer Werkzeuge-Knopf, sondern die Werkzeuge einzeln', () => {
    const onAppearance = vi.fn<() => void>();
    zeige({ querformat: true, onAppearance });
    expect(screen.queryByRole('button', { name: 'Werkzeuge' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Aussehen' }));
    expect(onAppearance).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Tempo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Anmerken' })).toBeTruthy();
  });

  it('die Knöpfe zeigen ihren Zustand: Puls voll blau, offenes Fenster hellblau, Zeichnen voll blau', () => {
    zeige({ querformat: true, tempoAktiv: true, offenesWerkzeug: 'aussehen', drawMode: true });
    expect(screen.getByRole('button', { name: 'Tempo' }).className).toMatch(/aktiv/);
    expect(screen.getByRole('button', { name: 'Aussehen' }).className).toMatch(/offen/);
    expect(screen.getByRole('button', { name: 'Anmerken beenden' }).className).toMatch(/aktiv/);
  });

  it('die Werkzeuge des anderen Lieds wählen dieses Lied – nicht das Werkzeug des aktiven', () => {
    const onWerkzeug = vi.fn<(id: string) => void>();
    const onAppearance = vi.fn<() => void>();
    zeige({ querformat: true, andereHaelfte: andere(onWerkzeug), onAppearance });
    fireEvent.click(screen.getByRole('button', { name: 'Aussehen – Staunen' }));
    expect(onWerkzeug).toHaveBeenCalledWith('aussehen');
    expect(onAppearance).not.toHaveBeenCalled();
  });

  it('im Hochformat ohne Messung (jsdom hat kein Layout) bleibt der eine Werkzeuge-Knopf', () => {
    zeige({ querformat: false });
    expect(screen.getByRole('button', { name: 'Werkzeuge' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Aussehen' })).toBeNull();
  });
});

/**
 * Hochformat (Alwin, 05.10.2026): Die Werkzeuge stehen einzeln oben, solange die Titel-Kapsel
 * `KAPSEL_MIN` behält – gemessen an der echten Breite, laufend (Stage Manager am iPad).
 */
describe('werkzeugeEinzeln – die Breitenregel', () => {
  const knopf = 44;
  const abstand = 8;
  /** Genau die Breite, bei der die Kapsel noch `KAPSEL_MIN` behält – aus der Regel selbst gebaut. */
  const grenze = (anzahl: number) => KAPSEL_MIN + knopf + abstand + anzahl * (knopf + abstand);

  it('genau an der Grenze: einzeln', () => {
    expect(werkzeugeEinzeln({ kopfBreite: grenze(3), knopf, abstand, anzahl: 3 })).toBe(true);
  });

  it('ein Pixel darunter: hinter dem Knopf', () => {
    expect(werkzeugeEinzeln({ kopfBreite: grenze(3) - 1, knopf, abstand, anzahl: 3 })).toBe(false);
  });

  it('ein Werkzeug mehr braucht einen Knopf mehr Platz', () => {
    expect(werkzeugeEinzeln({ kopfBreite: grenze(3), knopf, abstand, anzahl: 4 })).toBe(false);
  });

  it('iPhone hochkant (358 px Kopf): hinter dem Knopf; iPad hochkant (712 px): einzeln', () => {
    expect(werkzeugeEinzeln({ kopfBreite: 358, knopf, abstand, anzahl: 3 })).toBe(false);
    expect(werkzeugeEinzeln({ kopfBreite: 712, knopf, abstand, anzahl: 4 })).toBe(true);
  });
});

describe('ChartHeader – Hochformat richtet sich nach der Breite', () => {
  /** jsdom hat kein Layout: Breite und Beobachter von Hand. */
  let breite = 0;
  let melden: (() => void) | null = null;
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => breite);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private cb: () => void) {}
        // Erst wer wirklich beobachtet, bekommt Meldungen – sonst bliebe der Test ohne `observe` grün.
        observe() {
          melden = this.cb;
        }
        disconnect() {
          melden = null;
        }
      },
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    melden = null;
  });

  it('breit: Werkzeuge einzeln, kein gemeinsamer Knopf', () => {
    breite = 900;
    zeige();
    expect(screen.queryByRole('button', { name: 'Werkzeuge' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Aussehen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tempo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Anmerken' })).toBeTruthy();
  });

  it('schmal: der eine Werkzeuge-Knopf', () => {
    breite = 360;
    zeige();
    expect(screen.getByRole('button', { name: 'Werkzeuge' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Aussehen' })).toBeNull();
  });

  it('wird das Fenster schmal, wandern die Werkzeuge hinter den Knopf – und umgekehrt', () => {
    breite = 900;
    zeige();
    expect(screen.getByRole('button', { name: 'Aussehen' })).toBeTruthy();
    breite = 360;
    act(() => melden?.());
    expect(screen.getByRole('button', { name: 'Werkzeuge' })).toBeTruthy();
    breite = 900;
    act(() => melden?.());
    expect(screen.queryByRole('button', { name: 'Werkzeuge' })).toBeNull();
  });

  it('wird das Fenster breit, während das Menü offen ist, schließt es (sein Knopf ist weg)', () => {
    breite = 360;
    const onCloseWerkzeuge = vi.fn<() => void>();
    zeige({ werkzeugeOffen: true, onCloseWerkzeuge });
    expect(screen.getByRole('menu', { name: 'Werkzeuge' })).toBeTruthy();
    expect(onCloseWerkzeuge).not.toHaveBeenCalled();
    breite = 900;
    act(() => melden?.());
    expect(onCloseWerkzeuge).toHaveBeenCalled();
    expect(screen.queryByRole('menu', { name: 'Werkzeuge' })).toBeNull();
  });
});
