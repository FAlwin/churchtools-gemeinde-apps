// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LIEDINFO_FELDER, LIEDINFO_ZEILE, TONART_ZEILE } from '@shared/ct/liedinfo';
import { EinfuegenMenue } from './EinfuegenMenue';
import { ANDERE, KOPFANGABEN, TEILE } from '../utils/einfuegen';

/** Lied-Editor L6 (24.10.2026): Menü „Einfügen“ statt Format-Menü (Variante B). */
function zeige(offen = true, mitLiedinfo = true) {
  const waehlen = vi.fn();
  const umschalten = vi.fn();
  render(
    <EinfuegenMenue
      offen={offen}
      umschalten={umschalten}
      waehlen={waehlen}
      mitLiedinfo={mitLiedinfo}
    />,
  );
  return { waehlen, umschalten };
}

describe('EinfuegenMenue', () => {
  it('zu: nur der Knopf, ein Tipp schaltet um', () => {
    const { umschalten } = zeige(false);
    expect(screen.queryByText('Neuer Teil')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Einfügen' }));
    expect(umschalten).toHaveBeenCalledOnce();
  });

  it('Teil, Pedal-Halt und „andere Programme“ melden, was eingefügt werden soll', () => {
    const { waehlen } = zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Refrain' }));
    fireEvent.click(screen.getByRole('button', { name: /Pedal-Halt/ }));
    fireEvent.click(screen.getByRole('button', { name: /Kapo/ }));
    expect(waehlen.mock.calls.map((c) => c[0])).toEqual([
      { art: 'teil', name: 'Refrain' },
      { art: 'pedal' },
      { art: 'anderes', tag: 'capo', mitWert: true },
    ]);
    // Knopf + Teile + „Eigener Name …“ + Pedal-Halt + Kopfangaben + andere Programme
    expect(screen.getAllByRole('button')).toHaveLength(
      1 + TEILE.length + 1 + 1 + KOPFANGABEN.length + ANDERE.length,
    );
  });

  it('alle Kopfangaben des alten Format-Menüs sind da – jedes Liedinfo-Feld und die Tonart (26.10.2026)', () => {
    const { waehlen } = zeige();
    const erwartet = [...LIEDINFO_FELDER.map((f) => f.zeile), 'key'].sort();
    expect(KOPFANGABEN.map((k) => k.tag).sort()).toEqual(erwartet);
    // Jede Angabe ist eine Kopfzeile, die der Editor ausblendet – deshalb führt sie zur Liedinfo.
    for (const k of KOPFANGABEN)
      expect(LIEDINFO_ZEILE.test(`{${k.tag}: x}`) || TONART_ZEILE.test(`{${k.tag}: x}`)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Tempo \(BPM\)/ }));
    expect(waehlen).toHaveBeenCalledWith({ art: 'liedinfo', feld: 'tempo', tag: 'tempo' });
    expect(screen.getByText(/öffnet das Feld in der Liedinfo/)).toBeTruthy();
  });

  it('ohne Liedinfo sagt der Hinweis, dass die Angabe in den Text kommt', () => {
    zeige(true, false);
    expect(screen.getByText('Kommt als Angabe in den Text.')).toBeTruthy();
  });

  it('„Eigener Name …“: Feld erscheint, „Hinzufügen“ erst mit Namen, meldet den Teil', () => {
    const { waehlen } = zeige();
    fireEvent.click(screen.getByRole('button', { name: /Eigener Name/ }));
    const feld = screen.getByLabelText('Name des Teils');
    const knopf = screen.getByRole('button', { name: 'Hinzufügen' });
    expect(knopf).toHaveProperty('disabled', true);
    fireEvent.change(feld, { target: { value: '  Instrumental ' } });
    fireEvent.click(knopf);
    expect(waehlen).toHaveBeenCalledWith({ art: 'teil', name: 'Instrumental' });
  });

  it('„andere Programme“ enthält keine Kopfangabe – die gehören in die Liedinfo', () => {
    const kopf = [...LIEDINFO_FELDER.map((f) => f.zeile), 'key'];
    for (const a of ANDERE) {
      expect(kopf).not.toContain(a.tag);
      // Was das Menü einfügt, blendet der Editor nicht aus.
      const zeile = a.mitWert ? `{${a.tag}: 2}` : `{${a.tag}}`;
      expect(LIEDINFO_ZEILE.test(zeile) || TONART_ZEILE.test(zeile)).toBe(false);
    }
  });
});
