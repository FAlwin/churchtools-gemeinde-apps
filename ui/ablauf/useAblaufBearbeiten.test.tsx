// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ablaufZeileAus, punktStand, type AblaufZeile } from '@shared/ct/ablaufZeile';
import type { ReactNode } from 'react';
import { useAblaufBearbeiten, verlangtNeuLaden, type AblaufAktionen } from './useAblaufBearbeiten';
import type { LiedWahlArgs } from './PunktFenster';

/**
 * Die Bearbeiten-Liste als Baustein (E6-2b-3). Die Wege der Musik-App prüfen `Setlist.*.test.tsx` und die E2E-Tests;
 * hier der Teil, den es vorher zweimal verschieden gab: **Zurückrollen nach einem Fehler – ohne „entfernt"-Platzhalter**
 * (#161). Bis E6-2b-3 rollten Ziehen und Löschen auf den Stand MIT Platzhaltern zurück, dann stand ein längst
 * entfernter Punkt plötzlich wieder in der Bearbeiten-Liste.
 */
afterEach(cleanup);

const zeile = (id: number, title: string): AblaufZeile =>
  ablaufZeileAus({ id, title, type: 'normal' }, 7, 'Europe/Berlin');
const ITEMS: AblaufZeile[] = [
  zeile(1, 'Begrüßung'),
  { ...zeile(2, 'Weg (entfernt)'), removed: true },
];

function Harness({
  aktionen,
  items = ITEMS,
  gruppenVerborgen,
  neuAufsetzen,
  abgeschlossen = false,
  plusImKopf,
  liedWahl,
  schmal,
}: {
  aktionen: AblaufAktionen;
  items?: AblaufZeile[];
  gruppenVerborgen?: boolean;
  neuAufsetzen?: () => void;
  abgeschlossen?: boolean;
  plusImKopf?: boolean;
  liedWahl?: (args: LiedWahlArgs) => ReactNode;
  schmal?: boolean;
}) {
  const b = useAblaufBearbeiten({
    gruppenVerborgen,
    neuAufsetzen,
    plusImKopf,
    liedWahl,
    schmal,
    aktiv: true,
    bereit: true,
    items,
    beginn: '10:00',
    abgeschlossen,
    sperrHinweis: 'gesperrt',
    aktionen,
    dienste: [],
  });
  return (
    <>
      <div data-testid="kopf">{b.kopfKnopf}</div>
      <div data-testid="liste">{b.liste}</div>
      {b.ueberlagerung}
    </>
  );
}

const aktionen = (over: Partial<AblaufAktionen> = {}): AblaufAktionen => ({
  reorder: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve(null)),
  restore: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  setVorBeginn: vi.fn(() => Promise.resolve()),
  setWeggelassen: vi.fn(() => Promise.resolve()),
  add: vi.fn(() => Promise.resolve()),
  ...over,
});

describe('useAblaufBearbeiten – schmal (Matrix, E6-6a)', () => {
  it('kein schwebendes Plus und keine Hinweiszeilen; „+ Punkt“ am Ende öffnet „Option wählen“', () => {
    render(
      <Harness aktionen={aktionen()} schmal gruppenVerborgen neuAufsetzen={() => {}} plusImKopf />,
    );
    const liste = screen.getByTestId('liste');
    // Nebeneinander stehen mehrere Listen – ein schwebendes Plus je Liste stapelte sich in der Ecke.
    expect(screen.queryByRole('button', { name: 'Eintrag hinzufügen' })).toBeNull();
    expect(screen.getByTestId('kopf').textContent).toBe('');
    expect(liste.textContent).not.toContain('zum Sortieren');
    expect(liste.textContent).not.toContain('Neu aufsetzen');
    expect(liste.textContent).not.toMatch(/Dienstgruppen/);
    fireEvent.click(screen.getByRole('button', { name: /Punkt/ }));
    expect(screen.getByRole('button', { name: 'Programmpunkt hinzufügen' })).toBeTruthy();
  });

  it('ohne „Neu aufsetzen“ (wie in der Matrix): auch dann keine Anleitung über der Liste', () => {
    render(<Harness aktionen={aktionen()} schmal />);
    expect(screen.getByTestId('liste').textContent).not.toContain('zum Sortieren');
    cleanup();
    // Gegenprobe ohne `schmal`: dort steht sie.
    render(<Harness aktionen={aktionen()} />);
    expect(screen.getByTestId('liste').textContent).toContain('zum Sortieren');
  });

  it('abgeschlossen: „+ Punkt“ zeigt den Sperr-Hinweis statt der Auswahl', () => {
    render(<Harness aktionen={aktionen()} schmal abgeschlossen />);
    fireEvent.click(screen.getByRole('button', { name: /Punkt/ }));
    expect(screen.queryByRole('button', { name: 'Programmpunkt hinzufügen' })).toBeNull();
    expect(screen.getByText('gesperrt')).toBeTruthy();
  });
});

describe('useAblaufBearbeiten', () => {
  it('„entfernt"-Platzhalter stehen nie in der Bearbeiten-Liste – auch nicht nach einem gescheiterten Löschen', async () => {
    const a = aktionen({ remove: vi.fn(() => Promise.reject(new Error('Keine Berechtigung'))) });
    render(<Harness aktionen={a} />);
    const liste = screen.getByTestId('liste');
    expect(liste.textContent).toContain('Begrüßung');
    expect(liste.textContent).not.toContain('Weg (entfernt)');

    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: /Eintrag löschen/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Löschen$/ }));
    expect(a.remove).toHaveBeenCalledWith(1);

    expect(await screen.findByText('Keine Berechtigung')).toBeTruthy();
    // Zurückgerollt: „Begrüßung" ist wieder da, der Platzhalter NICHT.
    expect(liste.textContent).toContain('Begrüßung');
    expect(liste.textContent).not.toContain('Weg (entfernt)');
  });

  it('ein Schreibfehler geht auch an `beiFehler` (Musik-App: bei 423 die Termine neu holen)', async () => {
    const fehler = new Error('abgeschlossen');
    const beiFehler = vi.fn();
    const a = aktionen({ remove: vi.fn(() => Promise.reject(fehler)) });
    function MitBeiFehler() {
      const b = useAblaufBearbeiten({
        aktiv: true,
        bereit: true,
        items: ITEMS,
        beginn: '10:00',
        abgeschlossen: false,
        sperrHinweis: 'gesperrt',
        aktionen: a,
        dienste: [],
        beiFehler,
      });
      return (
        <>
          {b.liste}
          {b.ueberlagerung}
        </>
      );
    }
    render(<MitBeiFehler />);
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: /Eintrag löschen/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Löschen$/ }));
    await waitFor(() => expect(beiFehler).toHaveBeenCalledWith(fehler));
  });
});

describe('Auge in der Bearbeiten-Liste (E6-3b)', () => {
  const weg = ablaufZeileAus(
    { id: 5, title: 'Abkündigungen', type: 'normal', startTimes: { '7': null } },
    7,
    'Europe/Berlin',
  );

  it('die weggelassene Zeile steht grau mit Hinweis – wie in der Ansicht', () => {
    render(<Harness aktionen={aktionen()} items={[zeile(1, 'Begrüßung'), weg]} />);
    const liste = screen.getByTestId('liste');
    const zeileWeg = screen
      .getByText('Abkündigungen')
      .closest<HTMLElement>('div[class*="flowRow"]')!;
    expect(zeileWeg.className).toMatch(/weggelassen/);
    // Kein festes Inline-`opacity` – das überschrieb das Blass-Machen der Klasse (seit E6-3b, gefunden in E6-O1).
    expect(zeileWeg.style.opacity).toBe('');
    expect(liste.textContent?.match(/an diesem Termin weggelassen/g)).toHaveLength(1);
  });

  it('der Schalter im Punkt-Fenster geht als `setWeggelassen` an die Aktionen – mit der ID des Punkts', async () => {
    const a = aktionen();
    render(<Harness aktionen={a} items={[weg]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: /An diesem Termin weglassen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(a.setWeggelassen).toHaveBeenCalledWith(5, false));
  });
});

describe('Konflikt-Schutz in der Liste (E6-3c)', () => {
  it('Speichern schickt den Stand beim Öffnen als `gesehen`; „Trotzdem“ schickt keinen', async () => {
    const konflikt = Object.assign(new Error('Dieser Punkt wurde eben woanders geändert.'), {
      status: 412,
    });
    const a = aktionen({
      update: vi
        .fn<AblaufAktionen['update']>()
        .mockRejectedValueOnce(konflikt)
        .mockResolvedValue(undefined),
    });
    render(<Harness aktionen={a} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.change(screen.getByPlaceholderText('Titel'), { target: { value: 'Willkommen' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await screen.findByRole('alert');
    expect(a.update).toHaveBeenLastCalledWith(1, { title: 'Willkommen' }, punktStand(ITEMS[0]));
    fireEvent.click(screen.getByRole('button', { name: 'Trotzdem speichern' }));
    await waitFor(() =>
      expect(a.update).toHaveBeenLastCalledWith(1, { title: 'Willkommen' }, undefined),
    );
  });

  it('gleich wieder geöffnet: das Fenster zeigt das eben Gespeicherte und schickt es als `gesehen` – kein Konflikt mit sich selbst', async () => {
    const a = aktionen();
    render(<Harness aktionen={a} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.change(screen.getByPlaceholderText('Optionale Notiz…'), {
      target: { value: 'leise' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(a.update).toHaveBeenCalledTimes(1));
    // Der Server-Stand (items) ist noch der alte – das Neu-Lesen kommt erst später.
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    expect(screen.getByPlaceholderText('Optionale Notiz…')).toHaveProperty('value', 'leise');
    fireEvent.change(screen.getByPlaceholderText('Titel'), { target: { value: 'Willkommen' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(a.update).toHaveBeenCalledTimes(2));
    expect(vi.mocked(a.update).mock.calls[1][2]).toMatchObject({ note: 'leise' });
  });

  it('`verlangtNeuLaden`: 404, 409, 412, 423 ja – 403, 500 und Netzfehler nein', () => {
    for (const status of [404, 409, 412, 423]) expect(verlangtNeuLaden({ status })).toBe(true);
    for (const status of [403, 500]) expect(verlangtNeuLaden({ status })).toBe(false);
    expect(verlangtNeuLaden(new Error('Netz weg'))).toBe(false);
    expect(verlangtNeuLaden(null)).toBe(false);
  });
});

describe('Hinweis: nicht alle Dienstgruppen sichtbar (#676)', () => {
  const HINWEIS = /Du siehst nicht alle Dienstgruppen/;

  it('steht über der Liste und im Punkt-Fenster', () => {
    render(<Harness aktionen={aktionen()} gruppenVerborgen />);
    expect(screen.getByTestId('liste').textContent).toMatch(HINWEIS);
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    expect(screen.getAllByText(HINWEIS)).toHaveLength(2);
  });

  it('wer alle sieht (oder unbekannt), sieht ihn nicht', () => {
    render(<Harness aktionen={aktionen()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    expect(screen.queryByText(HINWEIS)).toBeNull();
  });
});

describe('„Neu aufsetzen …“ in der Hinweiszeile (E6-5b)', () => {
  it('steht nur, wenn der Aufrufer es anbietet – und ruft ihn', () => {
    const { unmount } = render(<Harness aktionen={aktionen()} />);
    expect(screen.queryByRole('button', { name: /Neu aufsetzen/ })).toBeNull();
    unmount();

    const neu = vi.fn();
    render(<Harness aktionen={aktionen()} neuAufsetzen={neu} />);
    // Die Anleitung genau einmal – in der Zeile mit dem Knopf, nicht noch einmal darüber.
    expect(screen.getByTestId('liste').textContent?.split('zum Sortieren')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Neu aufsetzen/ }));
    expect(neu).toHaveBeenCalledTimes(1);
  });

  it('abgeschlossen: der Knopf steht allein (ohne Anleitung) und zeigt den Sperr-Hinweis statt zu öffnen', async () => {
    const neu = vi.fn();
    render(<Harness aktionen={aktionen()} neuAufsetzen={neu} abgeschlossen />);
    expect(screen.getByTestId('liste').textContent).not.toContain('zum Sortieren');
    fireEvent.click(screen.getByRole('button', { name: /Neu aufsetzen/ }));
    expect(neu).not.toHaveBeenCalled();
    expect(await screen.findByText('gesperrt')).toBeTruthy();
  });
});

describe('Blättern im Punkt-Fenster (E6-O O3)', () => {
  const drei = [zeile(1, 'Begrüßung'), zeile(2, 'Lobpreis'), zeile(3, 'Predigt')];

  it('„Position“ zählt die Bearbeiten-Liste; ‹ › öffnet den Nachbarn, ohne neu einzublenden', () => {
    render(<Harness aktionen={aktionen()} items={drei} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[1]);
    expect(screen.getByRole('dialog', { name: 'Lobpreis' })).toBeTruthy();
    expect(screen.getByText(/^Position 2 von 3/)).toBeTruthy();
    // Beim ersten Öffnen blendet das Fenster ein …
    expect(screen.getByRole('dialog').parentElement!.className).not.toMatch(/still/);
    fireEvent.click(screen.getByRole('button', { name: 'Nächster Eintrag' }));
    expect(screen.getByRole('dialog', { name: 'Predigt' })).toBeTruthy();
    expect(screen.getByText(/^Position 3 von 3/)).toBeTruthy();
    // … beim Blättern ersetzt es nur sein voriges.
    expect(screen.getByRole('dialog').parentElement!.className).toMatch(/still/);
    expect(screen.getByRole('button', { name: 'Nächster Eintrag' })).toHaveProperty(
      'disabled',
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Voriger Eintrag' }));
    fireEvent.click(screen.getByRole('button', { name: 'Voriger Eintrag' }));
    expect(screen.getByRole('dialog', { name: 'Begrüßung' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Voriger Eintrag' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('nach dem Schließen blendet das nächste Öffnen wieder ein', () => {
    render(<Harness aktionen={aktionen()} items={drei} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Nächster Eintrag' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[2]);
    expect(screen.getByRole('dialog').parentElement!.className).not.toMatch(/still/);
  });
});

describe('„Option wählen“ nach dem Plus (Scheibe S2)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const handy = () =>
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  /** Die Liedwahl als Attrappe: zeigt sich, kann abbrechen oder „Treu“ wählen. */
  const liedWahl = ({ onGewaehlt, onAbbrechen }: LiedWahlArgs) => (
    <div>
      <span>Liedsuche</span>
      <button onClick={onAbbrechen}>Liedsuche abbrechen</button>
      <button onClick={() => onGewaehlt(5, 'Treu')}>Treu wählen</button>
    </div>
  );
  const optionen = () => screen.getAllByRole('button').map((k) => k.textContent);

  it('das schwebende Plus öffnet das Blatt „Option wählen“ – ohne Liedwahl nur Programmpunkt und Überschrift', () => {
    render(<Harness aktionen={aktionen()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag hinzufügen' }));
    const blatt = screen.getByRole('dialog', { name: 'Option wählen' });
    expect(blatt.textContent).toContain('Programmpunkt hinzufügen');
    expect(blatt.textContent).toContain('Überschrift hinzufügen');
    expect(blatt.textContent).not.toContain('Lied hinzufügen');
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog', { name: 'Option wählen' })).toBeNull();
  });

  it('„Überschrift hinzufügen“ öffnet das Fenster schon als Überschrift', () => {
    render(<Harness aktionen={aktionen()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Überschrift hinzufügen' }));
    expect(screen.queryByRole('dialog', { name: 'Option wählen' })).toBeNull();
    expect(screen.getByPlaceholderText('Titel der Überschrift')).toBeTruthy();
  });

  it('„Programmpunkt hinzufügen“ öffnet das Fenster als Programmpunkt', () => {
    render(<Harness aktionen={aktionen()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Programmpunkt hinzufügen' }));
    expect(screen.getByText('Neuer Eintrag')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Titel der Überschrift')).toBeNull();
  });

  it('„Lied hinzufügen“ zeigt gleich die Liedwahl; gewählt → das Fenster mit dem Lied als Titel', () => {
    render(<Harness aktionen={aktionen()} liedWahl={liedWahl} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lied hinzufügen' }));
    expect(screen.getByText('Liedsuche')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Treu wählen' }));
    expect(screen.getByText('Neuer Eintrag')).toBeTruthy();
    expect(screen.getByDisplayValue('Treu')).toBeTruthy();
  });

  it('„Lied hinzufügen“ abgebrochen: nichts angelegt – alles zu, kein leeres Programmpunkt-Fenster', () => {
    render(<Harness aktionen={aktionen()} liedWahl={liedWahl} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lied hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Liedsuche abbrechen' }));
    expect(screen.queryByText('Liedsuche')).toBeNull();
    expect(screen.queryByText('Neuer Eintrag')).toBeNull();
    expect(screen.getByRole('button', { name: 'Eintrag hinzufügen' })).toBeTruthy();
  });

  it('`plusImKopf` am iPad/Rechner: grüner Knopf im Kopf mit Menü – kein schwebendes Plus', () => {
    render(<Harness aktionen={aktionen()} plusImKopf liedWahl={liedWahl} />);
    const knopf = screen.getByRole('button', { name: 'Eintrag hinzufügen' });
    expect(screen.getByTestId('kopf').contains(knopf)).toBe(true);
    expect(knopf.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(knopf);
    expect(knopf.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual([
      'Programmpunkt hinzufügen',
      'Lied hinzufügen',
      'Überschrift hinzufügen',
    ]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Überschrift hinzufügen' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByPlaceholderText('Titel der Überschrift')).toBeTruthy();
  });

  it('ein Tipp neben das Menü schließt es – im Menü nicht (gemeinsamer Baustein `useAufklapp`)', () => {
    render(<Harness aktionen={aktionen()} plusImKopf />);
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag hinzufügen' }));
    fireEvent.pointerDown(screen.getByRole('menu'));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Escape schließt Blatt und Menü', () => {
    const { unmount } = render(<Harness aktionen={aktionen()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag hinzufügen' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Option wählen' })).toBeNull();
    unmount();

    render(<Harness aktionen={aktionen()} plusImKopf />);
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag hinzufügen' }));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('`plusImKopf` am Handy: nichts im Kopf, das Plus schwebt', () => {
    handy();
    render(<Harness aktionen={aktionen()} plusImKopf />);
    expect(screen.getByTestId('kopf').textContent).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag hinzufügen' }));
    expect(screen.getByRole('dialog', { name: 'Option wählen' })).toBeTruthy();
  });

  it('abgeschlossen: Plus und grüner Knopf zeigen den Sperr-Hinweis statt der Auswahl', async () => {
    const { unmount } = render(<Harness aktionen={aktionen()} abgeschlossen />);
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag hinzufügen' }));
    expect(screen.queryByRole('dialog', { name: 'Option wählen' })).toBeNull();
    expect(await screen.findByText('gesperrt')).toBeTruthy();
    unmount();

    render(<Harness aktionen={aktionen()} abgeschlossen plusImKopf />);
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag hinzufügen' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(await screen.findByText('gesperrt')).toBeTruthy();
    expect(optionen()).not.toContain('Programmpunkt hinzufügen');
  });
});
