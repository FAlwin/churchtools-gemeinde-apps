// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import type { SetlistSong, SongArrangementOption } from '@shared/types/index';
import { DEFAULT_SETTINGS, type SongSettings } from '../utils/chartSettings';
import { SongMenu } from './SongMenu';

/**
 * #198: Das Lied-Menü, ausgelagert aus `pages/ChordChart.tsx`.
 *
 * Zwei Dinge sind hier wichtig und waren vorher nirgends festgehalten:
 *
 * 1. **Jede Auswahl schließt das Menü.** Vorher stand `setShowSongMenu(false)` elf Mal in den
 *    Handlern; ein vergessener Aufruf hätte das Menü offen über der Änderung stehen lassen.
 * 2. **Was bei einem Dokument NICHT erscheinen darf.** Zeigt das Lied ein hochgeladenes PDF/Bild,
 *    sind Abschnitts-Transponierung, Teilen, Bearbeiten und die Versionsliste sinnlos – sie
 *    beziehen sich alle auf den ChordPro-Text, der gerade nicht zu sehen ist.
 */
function song(over: Partial<SetlistSong> = {}): SetlistSong {
  return {
    id: 7,
    title: 'Testlied',
    documents: [],
    versions: [],
    originalKey: 'C',
    targetKey: 'C',
    bpm: null,
    ...over,
  } as unknown as SetlistSong;
}

const VERSIONS = [
  { key: 'original', name: 'Original' },
  { key: 'akustik', name: 'Akustik' },
];

function setup(
  over: {
    song?: SetlistSong;
    set?: Partial<SongSettings>;
    canEdit?: boolean;
    arrangements?: SongArrangementOption[];
    zuletzt?: string | null;
  } = {},
) {
  const handlers = {
    onClose: vi.fn(),
    onOpenKeyPicker: vi.fn(),
    onOpenCapoPicker: vi.fn(),
    onOpenSectionTranspose: vi.fn(),
    onSharePdf: vi.fn(),
    onEditCurrent: vi.fn(),
    onOpenFiles: vi.fn(),
    onEditSong: vi.fn(),
    onNewVersion: vi.fn(),
    onDeleteVersion: vi.fn(),
    onChange: vi.fn(),
    onSelectVersion: vi.fn(),
  };
  const set = { ...DEFAULT_SETTINGS, ...over.set };
  render(
    <SongMenu
      song={over.song ?? song()}
      set={set}
      curKey="C"
      arrangements={over.arrangements ?? []}
      ablaufArrangementId={1}
      sections={[{ type: 'verse', label: 'Vers 1', lines: [] }] as never}
      versions={VERSIONS}
      currentVersion={VERSIONS.find((v) => v.key === set.versionKey) ?? VERSIONS[0]}
      isOriginal={set.versionKey === 'original'}
      hasVersions
      canEditSong={over.canEdit ?? true}
      zuletztGesungen={over.zuletzt}
      {...handlers}
    />,
  );
  return handlers;
}

afterEach(cleanup);

/** In die Unterseite einer Gruppe der Übersicht („Tonart“, „Anzeige“, „Version“, „Lied“). */
function unterseite(gruppe: string) {
  const zeilen = within(screen.getByRole('region', { name: gruppe })).getAllByRole('button');
  // `fireEvent`, nicht `.click()`: Der Seitenwechsel ist ein React-Zustand und muss vor der nächsten Abfrage stehen.
  fireEvent.click(zeilen[zeilen.length - 1]);
}

/** Die Gruppen der Übersicht, in ihrer Reihenfolge. */
function gruppen(): string[] {
  return screen.getAllByRole('region').map((r) => r.getAttribute('aria-label') ?? '');
}

/**
 * **Fenster mit Übersicht und Unterseiten** (Alwin am iPhone, 29.10.2026; Variante 1 mit der Aufteilung aus Variante 2).
 */
describe('SongMenu – Übersicht und Unterseiten', () => {
  it('die Übersicht: Tonart, Anzeige, Version, Bearbeiten, Teilen', () => {
    setup();
    expect(gruppen()).toEqual(['Tonart', 'Anzeige', 'Version', 'Bearbeiten', 'Teilen']);
    // Häufiges direkt, Seltenes eine Ebene tiefer.
    expect(screen.getByText('Transponieren')).toBeTruthy();
    expect(screen.getByText('Akkorde & Text')).toBeTruthy();
    expect(screen.queryByText('Abschnitte transponieren')).toBeNull();
    expect(screen.queryByText('Dateien …')).toBeNull();
    expect(screen.getByRole('dialog').textContent).toContain('Testlied');
  });

  /**
   * Der Editor steht direkt in der Übersicht (Alwin am iPhone, 29.10.2026: unter „Lied › Teilen, Bearbeiten …“ fand er
   * ihn nicht). Rechts steht, was dabei entsteht: beim Original eine neue Version, sonst die gewählte.
   */
  it('„Im Editor öffnen“ steht direkt unter „Bearbeiten“, öffnet den Editor und schließt', () => {
    const h = setup();
    const bearbeiten = within(screen.getByRole('region', { name: 'Bearbeiten' }));
    expect(bearbeiten.getByText('als neue Version')).toBeTruthy();
    fireEvent.click(bearbeiten.getByText('Im Editor öffnen'));
    expect(h.onEditCurrent).toHaveBeenCalledTimes(1);
    expect(h.onClose).toHaveBeenCalledTimes(1);
  });

  it('bei einer benannten Version steht ihr Name neben „Im Editor öffnen“', () => {
    setup({ set: { versionKey: 'akustik' } });
    const bearbeiten = within(screen.getByRole('region', { name: 'Bearbeiten' }));
    expect(bearbeiten.getByText('Akustik')).toBeTruthy();
    expect(bearbeiten.queryByText('als neue Version')).toBeNull();
  });

  it('in eine Unterseite und mit „‹“ zurück – beides schließt nicht', () => {
    const h = setup();
    unterseite('Tonart');
    expect(screen.getByText('Abschnitte transponieren')).toBeTruthy();
    expect(screen.getByRole('dialog').textContent).toContain('Kapo & Abschnitte');
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(gruppen()).toEqual(['Tonart', 'Anzeige', 'Version', 'Bearbeiten', 'Teilen']);
    expect(h.onClose).not.toHaveBeenCalled();
  });

  it('die Übersicht hat kein „‹“', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Zurück' })).toBeNull();
  });

  it('ohne Recht: keine Gruppe „Bearbeiten“, „Als PDF teilen“ bleibt', () => {
    setup({ canEdit: false });
    expect(gruppen()).toEqual(['Tonart', 'Anzeige', 'Version', 'Teilen']);
    expect(
      within(screen.getByRole('region', { name: 'Teilen' })).getByText('Als PDF teilen'),
    ).toBeTruthy();
  });

  it('mit Dokumenten: „Nur Text · PDF ›“, das gezeigte Dokument steht als Wert daneben', () => {
    const withDoc = song({
      documents: [{ fileId: 99, name: 'Noten.pdf', type: 'pdf' }] as never,
    });
    setup({ song: withDoc, set: { viewSource: 99 } });
    expect(screen.getByText('Nur Text · PDF')).toBeTruthy();
    expect(screen.getByText('Noten.pdf')).toBeTruthy();
  });
});

describe('SongMenu – jede Auswahl schließt das Menü', () => {
  /** Auf welcher Unterseite der Punkt steht (sonst in der Übersicht). */
  const WO: Record<string, string> = {
    Kapo: 'Tonart',
    'Abschnitte transponieren': 'Tonart',
    'Neue Version…': 'Version',
  };
  const cases: [string, keyof ReturnType<typeof setup>][] = [
    ['Transponieren', 'onOpenKeyPicker'],
    ['Kapo', 'onOpenCapoPicker'],
    ['Abschnitte transponieren', 'onOpenSectionTranspose'],
    ['Als PDF teilen', 'onSharePdf'],
    ['Neue Version…', 'onNewVersion'],
  ];

  for (const [label, handler] of cases) {
    it(`„${label}" löst die Aktion aus UND schließt`, () => {
      const h = setup();
      if (WO[label]) unterseite(WO[label]);
      screen.getByText(label).click();
      expect(h[handler]).toHaveBeenCalledTimes(1);
      expect(h.onClose).toHaveBeenCalledTimes(1);
    });
  }

  it('ein Versionswechsel meldet den Schlüssel und schließt', () => {
    const h = setup();
    unterseite('Version');
    screen.getByText('Akustik').click();
    expect(h.onSelectVersion).toHaveBeenCalledWith('akustik');
    expect(h.onClose).toHaveBeenCalledTimes(1);
  });

  it('„Nur Text" schaltet Anzeige UND Textmodus in EINEM Schritt', () => {
    // Beides zusammen ist wichtig: Ein Dokument-Lied muss beim Wechsel auf „Nur Text" auch
    // wirklich auf die Akkord-Quelle zurückspringen.
    const h = setup({ set: { viewSource: 99 } });
    screen.getByText('Nur Text').click();
    expect(h.onChange).toHaveBeenCalledWith({ viewSource: 'chords', lyricsOnly: true });
    expect(h.onClose).toHaveBeenCalledTimes(1);
  });

  it('der Klick daneben schließt, ohne etwas zu ändern', () => {
    const h = setup();
    // Gezielt die Fläche UM das Fenster – ein „erstes div"-Selektor wäre auch grün, wenn er das Fenster selbst
    // träfe, und würde damit nichts beweisen.
    const daneben = screen.getByRole('dialog').parentElement;
    expect(daneben).not.toBeNull();
    (daneben as HTMLElement).click();
    expect(h.onClose).toHaveBeenCalledTimes(1);
    expect(h.onChange).not.toHaveBeenCalled();
    expect(h.onSelectVersion).not.toHaveBeenCalled();
  });
});

describe('SongMenu – was zum angezeigten Inhalt passt', () => {
  it('bei einem Dokument entfallen Abschnitte, Bearbeiten und die Versionsliste – Teilen bleibt', () => {
    const withDoc = song({
      documents: [{ fileId: 99, name: 'Noten.pdf', type: 'pdf' }] as never,
    });
    setup({ song: withDoc, set: { viewSource: 99 } });
    // Ohne Abschnitte ist „Kapo“ der einzige Punkt – er steht direkt in der Übersicht, keine Unterseite.
    expect(screen.getByText('Kapo')).toBeTruthy();
    expect(screen.queryByText('Kapo · Abschnitte')).toBeNull();
    // Keine Versionen – die Gruppe entfällt.
    expect(gruppen()).toEqual(['Tonart', 'Anzeige', 'Bearbeiten', 'Teilen']);
    // Die Anzeige-Umschalter bleiben – sonst käme man vom Dokument nicht mehr weg.
    expect(screen.getByText('Akkorde & Text')).toBeTruthy();
    unterseite('Anzeige');
    expect(screen.getByText('Noten.pdf', { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    // Seit 07.10.2026: Geteilt wird, was das Lied zeigt – auch sein Dokument (Gemeinde ohne ChordPro).
    expect(screen.getByText('Als PDF teilen')).toBeTruthy();
    // Kein Editor beim Dokument – Dateien und Stammdaten stehen dann direkt da, ohne Unterseite.
    const bearbeiten = within(screen.getByRole('region', { name: 'Bearbeiten' }));
    expect(bearbeiten.queryByText('Im Editor öffnen')).toBeNull();
    expect(bearbeiten.getByText('Dateien …')).toBeTruthy();
    expect(bearbeiten.getByText('Stammdaten …')).toBeTruthy();
    expect(screen.queryByText('Abschnitte transponieren')).toBeNull();
    expect(screen.queryByText('Akustik')).toBeNull();
  });

  it('ohne Bearbeitungsrecht fehlen Bearbeiten, Neue Version und Löschen', () => {
    setup({ canEdit: false, set: { versionKey: 'akustik' } });
    expect(screen.queryByText('Im Editor öffnen')).toBeNull();
    unterseite('Version');
    expect(screen.queryByText('Neue Version…')).toBeNull();
    expect(screen.queryByText('„Akustik" löschen')).toBeNull();
  });

  it('das Original lässt sich nicht löschen, eine Version schon', () => {
    setup({ set: { versionKey: 'original' } });
    unterseite('Version');
    expect(screen.queryByText('„Original" löschen')).toBeNull();
    cleanup();
    setup({ set: { versionKey: 'akustik' } });
    unterseite('Version');
    expect(screen.getByText('„Akustik" löschen')).toBeTruthy();
  });
});

/**
 * Wäre der Pfad zum CSS-Modul falsch, gäbe es keinen Fehler – CSS-Module liefern still `undefined`, und das Menü
 * stünde ohne Layout im Fenster (bis 29.10.2026 kam es aus `pages/ChordChart.module.scss`, jetzt `SongMenu.module.scss`).
 */
describe('CSS-Modul erreichbar', () => {
  it('die Einträge bekommen echte Klassennamen, nicht „undefined"', () => {
    setup();
    const cls = (screen.getByText('Transponieren').parentElement as HTMLElement).className;
    expect(cls).toBeTruthy();
    expect(cls).not.toContain('undefined');
  });
});

describe('SongMenu – Arrangement umschalten (#320)', () => {
  // Namen bewusst NICHT „Akustik": Die Test-Vorlage hat schon eine VERSION dieses Namens, und die
  // Verwechslung ist genau der Unterschied, den die Oberfläche erkennbar machen soll – Versionen
  // sind ChordPro-Dateien INNERHALB eines Arrangements.
  const arrs = [
    { arrangementId: 1, arrangementName: 'Band', key: null, bpm: null, isDefault: true },
    { arrangementId: 2, arrangementName: 'Unplugged', key: null, bpm: null, isDefault: false },
  ] as unknown as SongArrangementOption[];

  it('zeigt die Auswahl bei mehreren Arrangements', () => {
    setup({ arrangements: arrs, song: song({ arrangementId: 1 }) });
    // In der Übersicht steht die Wahl mit der Version: „Band · Original ›“.
    expect(screen.getByText('Band · Original')).toBeTruthy();
    unterseite('Version');
    expect(screen.getByText('Arrangement')).toBeTruthy();
    expect(screen.getByText('Band')).toBeTruthy();
    expect(screen.getByText('Unplugged')).toBeTruthy();
  });

  it('zeigt bei nur einem NICHTS – kein Bedienelement ohne Zweck', () => {
    setup({ arrangements: [arrs[0]], song: song({ arrangementId: 1 }) });
    unterseite('Version');
    expect(screen.queryByText('Arrangement')).toBeNull();
    expect(screen.queryByText('Band')).toBeNull();
  });

  it('merkt eine Abweichung als Nummer', () => {
    const props = setup({ arrangements: arrs, song: song({ arrangementId: 1 }) });
    unterseite('Version');
    screen.getByText('Unplugged').click();
    expect(props.onChange).toHaveBeenCalledWith({ arrangementId: 2 });
  });

  it('merkt die Wahl auf das Ablauf-Arrangement als „keine Wahl"', () => {
    // Sonst hielte die App an einer Nummer fest, die einmal die richtige war: Ändert das Team den
    // Ablauf später, soll die App wieder folgen.
    const props = setup({ arrangements: arrs, song: song({ arrangementId: 2 }) });
    unterseite('Version');
    screen.getByText('Band').click();
    expect(props.onChange).toHaveBeenCalledWith({ arrangementId: null });
  });
});

/**
 * #321: Der Einstieg in die Dateiverwaltung.
 *
 * Zwei Zusagen: Er erscheint **nur** für Berechtigte (Dateien in ChurchTools zu ändern ist kein
 * Anzeige-Detail), und er erscheint **auch bei einem Dokument** – wer ein PDF ansieht, will genau
 * dort ein neues hochladen können. Der Bearbeiten-Punkt daneben ist an Akkorde gebunden, dieser
 * bewusst nicht.
 */
describe('SongMenu – Dateien (#321)', () => {
  it('zeigt „Dateien …" für Berechtigte und meldet den Klick', () => {
    const h = setup({ canEdit: true });
    unterseite('Bearbeiten');
    expect(screen.getByRole('dialog').textContent).toContain('Dateien & Stammdaten');
    screen.getByText('Dateien …').click();
    expect(h.onOpenFiles).toHaveBeenCalledTimes(1);
  });

  it('zeigt es NICHT ohne Berechtigung', () => {
    setup({ canEdit: false });
    // Ohne Recht gibt es die Gruppe „Bearbeiten“ gar nicht.
    expect(screen.queryByRole('region', { name: 'Bearbeiten' })).toBeNull();
    expect(screen.queryByText('Dateien · Stammdaten')).toBeNull();
    expect(screen.queryByText('Dateien …')).toBeNull();
  });

  it('zeigt es auch, wenn gerade ein Dokument angesehen wird', () => {
    // `viewSource` ist dann eine Datei-ID statt 'chords'. „Bearbeiten" verschwindet hier zu Recht –
    // „Dateien" muss bleiben, sonst käme man beim PDF nicht an die Dateiverwaltung.
    setup({ canEdit: true, set: { viewSource: 4711 } });
    expect(screen.getByText('Dateien …')).toBeTruthy();
    expect(screen.queryByText('Im Editor öffnen')).toBeNull();
  });
});

/** **Zuletzt gesungen** oben im Lied-Menü (Alwin beim Planen, 30.10.2026). */
describe('SongMenu – zuletzt gesungen', () => {
  it('zeigt das Datum ganz oben, vor der Gruppe „Tonart“', () => {
    setup({ zuletzt: '2026-10-12' });
    const text = screen.getByRole('dialog').textContent ?? '';
    expect(text).toContain('Zuletzt gesungen12.10.2026');
    expect(text.indexOf('Zuletzt gesungen')).toBeLessThan(text.indexOf('Tonart'));
  });

  it('noch nie gesungen: „noch nie“', () => {
    setup({ zuletzt: null });
    expect(screen.getByRole('dialog').textContent).toContain('Zuletzt gesungennoch nie');
  });

  it('ohne Statistik (kein Recht, lädt, Fehler) keine Zeile – keine Behauptung', () => {
    setup();
    expect(screen.queryByText('Zuletzt gesungen')).toBeNull();
  });
});
