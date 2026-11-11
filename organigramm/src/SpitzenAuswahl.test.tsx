// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Knoten } from '@shared/organigramm/gruppen';
import { SpitzenAuswahl } from './SpitzenAuswahl';
import { spitzenKnopf, spitzenOptionen, waehleSpitze } from './spitzenAuswahl.testutil';

const g = (id: number, name: string, kinder: Knoten[] = []): Knoten => ({
  gruppe: { id, name, typId: 2, statusId: 1, farbe: null },
  kinder,
});
const BAUM: Knoten[] = [
  g(1, 'Gottesdienst', [g(2, 'Café-Team', [g(3, 'Café Team 1'), g(4, 'Café Team 2')])]),
  g(10, 'Technik', [g(11, 'Ton'), g(12, 'Licht')]),
];

function zeigen(wert: string | null = null) {
  const onWahl = vi.fn();
  render(
    <SpitzenAuswahl label="Anfangen bei" baum={BAUM} wert={wert} onWahl={onWahl} feldKlasse="" />,
  );
  return { onWahl };
}
const liste = () => within(screen.getByRole('listbox', { name: 'Anfangen bei' }));
const suche = () => screen.getByRole('combobox', { name: 'Gruppe suchen' });

afterEach(cleanup);

describe('SpitzenAuswahl (#915)', () => {
  it('zeigt die Wahl; aufgeklappt die Gemeinde und jede Gruppe, nach Ebene eingerückt', () => {
    zeigen('1/2');
    expect(spitzenKnopf('Anfangen bei').textContent).toBe('Café-Team');
    expect(spitzenOptionen('Anfangen bei')).toEqual([
      'Ganze Gemeinde',
      'Gottesdienst',
      'Café-Team',
      'Café Team 1',
      'Café Team 2',
      'Technik',
      'Ton',
      'Licht',
    ]);
    fireEvent.click(spitzenKnopf('Anfangen bei'));
    const einzug = (name: string) => liste().getByRole('option', { name }).style.paddingLeft;
    expect([
      einzug('Ganze Gemeinde'),
      einzug('Gottesdienst'),
      einzug('Café-Team'),
      einzug('Café Team 1'),
    ]).toEqual(['10px', '24px', '38px', '52px']);
    expect(liste().getByRole('option', { name: 'Café-Team' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('ein Klick wählt den Pfad und klappt zu – „Ganze Gemeinde“ heißt null', () => {
    const { onWahl } = zeigen('10');
    waehleSpitze('Anfangen bei', 'Café-Team');
    expect(onWahl).toHaveBeenLastCalledWith('1/2');
    expect(screen.queryByRole('listbox')).toBeNull();
    waehleSpitze('Anfangen bei', 'Ganze Gemeinde');
    expect(onWahl).toHaveBeenLastCalledWith(null);
  });

  it('Suche: Treffer ohne Einzug, mit Obergruppen; Pfeiltasten und Enter; nichts gefunden', () => {
    const { onWahl } = zeigen();
    fireEvent.click(spitzenKnopf('Anfangen bei'));
    fireEvent.change(suche(), { target: { value: 'café team' } });
    const treffer = liste().getAllByRole('option');
    expect(treffer.map((o) => o.textContent)).toEqual([
      'Café Team 1Gottesdienst › Café-Team',
      'Café Team 2Gottesdienst › Café-Team',
    ]);
    expect(treffer.map((o) => o.style.paddingLeft)).toEqual(['10px', '10px']);
    fireEvent.keyDown(suche(), { key: 'ArrowDown' });
    fireEvent.keyDown(suche(), { key: 'ArrowDown' }); // am Ende bleibt es beim letzten
    expect(suche().getAttribute('aria-activedescendant')).toBe(treffer[1].id);
    fireEvent.keyDown(suche(), { key: 'Enter' });
    expect(onWahl).toHaveBeenLastCalledWith('1/2/4');

    fireEvent.click(spitzenKnopf('Anfangen bei'));
    expect((suche() as HTMLInputElement).value).toBe(''); // neu aufgeklappt = neue Suche
    fireEvent.change(suche(), { target: { value: 'Orgel' } });
    expect(liste().queryAllByRole('option')).toEqual([]);
    expect(screen.getByText('Keine Gruppe gefunden')).toBeTruthy();
    fireEvent.keyDown(suche(), { key: 'Enter' });
    expect(onWahl).toHaveBeenCalledTimes(1);
  });

  it('Escape und ein Tipp daneben klappen zu, ohne zu wählen', () => {
    const { onWahl } = zeigen();
    fireEvent.click(spitzenKnopf('Anfangen bei'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(spitzenKnopf('Anfangen bei'));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onWahl).not.toHaveBeenCalled();
  });

  it('am Handy rückt das Menü nach links, statt rechts hinauszuragen – und schiebt die Seite nicht (Test-Instanz 11.11.)', () => {
    // So stand es in der Test-Instanz bei 375 px: Knopf ab 104 px, Menü 320 px breit.
    const rechteck = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ left: 104, width: 320 } as DOMRect);
    const breite = vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(375);
    const insBild = vi.fn();
    Element.prototype.scrollIntoView = insBild;
    try {
      zeigen('1/2');
      fireEvent.click(spitzenKnopf('Anfangen bei'));
      const menue = screen.getByRole('listbox', { name: 'Anfangen bei' }).parentElement!;
      expect(menue.style.left).toBe('-65px'); // 104 + 320 − (375 − 16)
      fireEvent.keyDown(suche(), { key: 'ArrowDown' });
      expect(insBild).not.toHaveBeenCalled();
    } finally {
      rechteck.mockRestore();
      breite.mockRestore();
      delete (Element.prototype as Partial<Element>).scrollIntoView;
    }
  });

  it('mit Maus: Fokus ins Suchfeld erst nach dem Einrücken und ohne Scrollen (Test-Instanz 11.11.)', () => {
    vi.stubGlobal(
      'matchMedia',
      (q: string) =>
        ({
          matches: true,
          media: q,
          addEventListener() {},
          removeEventListener() {},
        }) as unknown as MediaQueryList,
    );
    const rechteck = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ left: 89, width: 320 } as DOMRect);
    const breite = vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(375);
    const reihenfolge: string[] = [];
    const fokus = vi.spyOn(HTMLInputElement.prototype, 'focus').mockImplementation(function (
      this: HTMLInputElement,
      o?: FocusOptions,
    ) {
      const menue = this.closest('[class]')?.parentElement as HTMLElement;
      reihenfolge.push(`fokus preventScroll=${String(o?.preventScroll)} left=${menue.style.left}`);
    });
    try {
      zeigen();
      fireEvent.click(spitzenKnopf('Anfangen bei'));
      expect(reihenfolge).toEqual(['fokus preventScroll=true left=-50px']);
    } finally {
      vi.unstubAllGlobals();
      rechteck.mockRestore();
      breite.mockRestore();
      fokus.mockRestore();
    }
  });

  it('ohne Maus (Handy): kein Fokus ins Suchfeld – sonst ginge die Tastatur auf', () => {
    const fokus = vi.spyOn(HTMLInputElement.prototype, 'focus');
    try {
      zeigen();
      fireEvent.click(spitzenKnopf('Anfangen bei'));
      expect(fokus).not.toHaveBeenCalled();
    } finally {
      fokus.mockRestore();
    }
  });
});
