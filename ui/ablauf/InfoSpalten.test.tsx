// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ablaufZeileAus, type AblaufZeile } from '@shared/ct/ablaufZeile';
import type { CtAgendaItem } from '@shared/ct/typen';
import type { InfoGruppe } from '@shared/types/index';
import { AblaufListe } from './AblaufListe';
import { InfoSpaltenKnopf } from './InfoSpalten';
import { useInfoSpalten } from './infoSpaltenWahl';
import { PunktFenster } from './PunktFenster';

/**
 * **Infos je Dienstgruppe** in der Oberfläche (E6-4, Entwurf `e6-infos-spalten.html`, abgenommen 30.10.2026): Knopf
 * „Spalten“ (Bild 1), Spalten am Rechner bzw. Zeilen am Handy (Bild 2), Felder im Punkt-Fenster (Bild 3), keine Infos
 * in der Matrix (Bild 4 A). Die Zeilen kommen aus dem echten `ablaufZeileAus`.
 */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => localStorage.clear());

const handy = () =>
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

const z = (item: Partial<CtAgendaItem> & { id: number; title: string }): AblaufZeile =>
  ablaufZeileAus(item, 7, 'Europe/Berlin');

const GRUPPEN: InfoGruppe[] = [
  { id: 3, name: 'Technik' },
  { id: 4, name: 'Musik' },
  { id: 1, name: 'Programm' },
];
const ZEILEN = [
  z({
    id: 1,
    title: 'Begrüßung',
    serviceGroupNotes: [{ serviceGroupId: 3, note: 'Mikro 1 an' }],
  }),
  z({
    id: 2,
    title: 'Treu',
    serviceGroupNotes: [
      { serviceGroupId: 4, note: 'Intro leise' },
      { serviceGroupId: 3, note: 'Band-Mikros' },
    ],
  }),
  z({ id: 3, title: 'Predigt' }),
];

describe('Ablaufliste mit Infos (Bild 1 + 2)', () => {
  it('am Rechner: je gewählter Gruppe eine Spalte mit Kopf; leer = „–“', () => {
    render(<AblaufListe zeilen={ZEILEN} infoSpalten={[GRUPPEN[0], GRUPPEN[1]]} />);
    expect(screen.getByText('Punkt')).toBeTruthy();
    expect(screen.getByText('Technik')).toBeTruthy();
    expect(screen.getByText('Musik')).toBeTruthy();
    const zeile = screen.getByText('Treu').closest('div[class*="flowRow"]')!;
    expect(zeile.textContent).toContain('Band-Mikros');
    expect(zeile.textContent).toContain('Intro leise');
    const predigt = screen.getByText('Predigt').closest('div[class*="flowRow"]')!;
    expect(within(predigt as HTMLElement).getAllByText('–')).toHaveLength(2);
  });

  it('Köpfe und Zellen stehen je in EINEM Block – sonst schöbe der Abstand der Zeile die Zellen gegen ihre Köpfe (30.10.2026)', () => {
    render(<AblaufListe zeilen={ZEILEN} infoSpalten={GRUPPEN} />);
    const kopfBlock = screen.getByText('Programm').parentElement!;
    expect(kopfBlock.className).toMatch(/infoZellen/);
    expect(kopfBlock.children).toHaveLength(3);
    const zeile = screen.getByText('Treu').closest('div[class*="flowRow"]')!;
    const zellen = within(zeile as HTMLElement).getByText('Intro leise').parentElement!;
    expect(zellen.className).toBe(kopfBlock.className);
    expect(zellen.children).toHaveLength(3);
  });

  it('am Handy: eine Zeile „Gruppe: Text“ unter dem Punkt, keine Spalten', () => {
    handy();
    render(<AblaufListe zeilen={ZEILEN} infoSpalten={[GRUPPEN[0]]} />);
    expect(screen.queryByText('Punkt')).toBeNull();
    const zeile = screen.getByText('Treu').closest('div[class*="flowRow"]')!;
    expect(zeile.textContent).toContain('Technik: Band-Mikros');
    expect(zeile.textContent).not.toContain('Intro leise');
  });

  it('schmal (Matrix, Bild 4 A): keine Infos', () => {
    render(<AblaufListe zeilen={ZEILEN} infoSpalten={GRUPPEN} schmal />);
    expect(screen.queryByText('Punkt')).toBeNull();
    expect(screen.queryByText(/Mikro 1 an/)).toBeNull();
  });

  it('ohne Wahl: wie bisher', () => {
    render(<AblaufListe zeilen={ZEILEN} />);
    expect(screen.queryByText(/Mikro 1 an/)).toBeNull();
  });
});

describe('Knopf „Spalten“ (Bild 1)', () => {
  it('listet die sichtbaren Gruppen mit der Zahl der Punkte; Haken setzt die Wahl', () => {
    const onIds = vi.fn();
    render(<InfoSpaltenKnopf gruppen={GRUPPEN} zeilen={ZEILEN} ids={[3]} onIds={onIds} />);
    fireEvent.click(screen.getByRole('button', { name: 'Infos je Gruppe zeigen' }));
    const menue = screen.getByRole('dialog', { name: 'Infos je Gruppe zeigen' });
    expect(within(menue).getByText('Infos als Spalten zeigen')).toBeTruthy();
    const technik = within(menue).getByRole('checkbox', { name: /Technik/ });
    expect((technik as HTMLInputElement).checked).toBe(true);
    expect(technik.closest('label')!.textContent).toContain('2 Punkte');
    expect(
      within(menue).getByRole('checkbox', { name: /Musik/ }).closest('label')!.textContent,
    ).toContain('1 Punkt');
    expect(
      within(menue)
        .getByRole('checkbox', { name: /Programm/ })
        .closest('label')!.textContent,
    ).toContain('–');
    fireEvent.click(within(menue).getByRole('checkbox', { name: /Musik/ }));
    expect(onIds).toHaveBeenLastCalledWith([3, 4]);
    fireEvent.click(technik);
    expect(onIds).toHaveBeenLastCalledWith([]);
  });

  it('ohne sichtbare Gruppen: kein Knopf', () => {
    render(<InfoSpaltenKnopf gruppen={[]} zeilen={ZEILEN} ids={[]} onIds={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('die Wahl merkt sich das Gerät; gezeigt in der Reihenfolge der Gemeinde, nicht gesehene Gruppen fallen weg', () => {
    const { result, unmount } = renderHook(() => useInfoSpalten('test.spalten', GRUPPEN));
    act(() => result.current.setIds([1, 3, 99]));
    expect(result.current.gewaehlt.map((g) => g.name)).toEqual(['Technik', 'Programm']);
    unmount();
    const wieder = renderHook(() => useInfoSpalten('test.spalten', GRUPPEN));
    expect(wieder.result.current.ids).toEqual([1, 3, 99]);
    // Von Hand verändert oder kaputt: nur die Zahlen zählen, Unlesbares → nichts gewählt.
    localStorage.setItem('test.spalten', JSON.stringify(['Technik', 3, null]));
    expect(renderHook(() => useInfoSpalten('test.spalten', GRUPPEN)).result.current.ids).toEqual([
      3,
    ]);
    localStorage.setItem('test.spalten', '{kaputt');
    expect(renderHook(() => useInfoSpalten('test.spalten', GRUPPEN)).result.current.ids).toEqual(
      [],
    );
  });
});

describe('Punkt-Fenster: Infos je Gruppe (Bild 3)', () => {
  function zeige(item: AblaufZeile, gruppen: InfoGruppe[] = GRUPPEN.slice(0, 2)) {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <PunktFenster
        item={item}
        onClose={onClose}
        onUpdate={onUpdate}
        vorBeginn={false}
        onSetVorBeginn={vi.fn().mockResolvedValue(undefined)}
        onSetWeggelassen={vi.fn().mockResolvedValue(undefined)}
        services={[]}
        onRequestDelete={vi.fn()}
        infoGruppen={gruppen}
      />,
    );
    return { onUpdate, onClose };
  }

  it('ein Feld je sichtbarer Gruppe mit dem Text aus ChurchTools; nur Geändertes wird geschrieben', async () => {
    const { onUpdate, onClose } = zeige(ZEILEN[1]);
    expect(screen.getByText('Infos je Gruppe')).toBeTruthy();
    const technik = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Info für Technik',
    });
    expect(technik.value).toBe('Band-Mikros');
    fireEvent.change(technik, { target: { value: 'Band-Mikros + Headset' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Info für Musik' }), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onUpdate).toHaveBeenCalledWith({ infos: { 3: 'Band-Mikros + Headset', 4: '' } }, false);
  });

  it('nichts geändert → „Speichern“ gesperrt; eine Info geändert → frei', () => {
    zeige(ZEILEN[1]);
    const speichern = screen.getByRole<HTMLButtonElement>('button', { name: 'Speichern' });
    expect(speichern.disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Info für Musik' }), {
      target: { value: 'Intro laut' },
    });
    expect(speichern.disabled).toBe(false);
  });

  it('nicht bei Überschriften (ChurchTools führt dort keine Infos) und nicht ohne Gruppen', () => {
    zeige(z({ id: 9, title: 'Ankommen', type: 'header' }));
    expect(screen.queryByText('Infos je Gruppe')).toBeNull();
    cleanup();
    zeige(ZEILEN[1], []);
    expect(screen.queryByText('Infos je Gruppe')).toBeNull();
  });
});
