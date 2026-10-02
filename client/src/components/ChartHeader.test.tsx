// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ChartHeader } from './ChartHeader';
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
