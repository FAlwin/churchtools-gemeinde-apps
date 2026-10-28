// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Zeitraum } from '@shared/ct/zeitraum';
import { ZeitraumKnopf } from './ZeitraumKnopf';

function zeige(
  zeitraum: Zeitraum = { art: 'abHeute' },
  abHeuteZusatz = 'passend zur Fensterbreite',
) {
  const onWahl = vi.fn();
  render(
    <>
      <ZeitraumKnopf
        zeitraum={zeitraum}
        zeile1="18.10. – 08.11.2026"
        zeile2="4 Termine · passend zur Fensterbreite"
        heute="2026-12-14"
        abHeuteZusatz={abHeuteZusatz}
        onWahl={onWahl}
      />
      <p>draußen</p>
    </>,
  );
  fireEvent.click(screen.getByRole('button', { name: /^Zeitraum:/ }));
  return { onWahl };
}

const gedrueckt = () =>
  screen
    .getAllByRole('button', { pressed: true })
    .map((b) => b.firstChild?.textContent)
    .join();

describe('ZeitraumKnopf (14.10.2026)', () => {
  it('Knopf sagt, was zu sehen ist; Menü: ab heute, dieser/nächster Monat (über den Jahreswechsel)', () => {
    const { onWahl } = zeige();
    expect(screen.getByRole('button', { name: /^Zeitraum:/ }).getAttribute('aria-label')).toBe(
      'Zeitraum: 18.10. – 08.11.2026, 4 Termine · passend zur Fensterbreite',
    );
    expect(screen.getByRole('button', { name: /^Dieser Monat/ }).textContent).toBe(
      'Dieser MonatDezember',
    );
    expect(screen.getByRole('button', { name: /^Nächster Monat/ }).textContent).toBe(
      'Nächster MonatJanuar',
    );
    expect(gedrueckt()).toBe('Ab heute');
    fireEvent.click(screen.getByRole('button', { name: /^Nächster Monat/ }));
    expect(onWahl).toHaveBeenCalledWith({ art: 'monat', monat: '2027-01' });
    expect(screen.queryByRole('dialog')).toBeNull(); // nach der Wahl zu
  });

  it('der gewählte Monat ist markiert; die Felder stehen auf seinem ersten und letzten Tag', () => {
    zeige({ art: 'monat', monat: '2026-12' });
    expect(gedrueckt()).toBe('Dieser Monat');
    expect(screen.getByLabelText<HTMLInputElement>('von').value).toBe('2026-12-01');
    expect(screen.getByLabelText<HTMLInputElement>('bis').value).toBe('2026-12-31');
  });

  it('nach ‹ › zeigen die Felder beim nächsten Öffnen den neuen Zeitraum, nicht den vom ersten Mal', () => {
    const el = (monat: string) => (
      <ZeitraumKnopf
        zeitraum={{ art: 'monat', monat }}
        zeile1="x"
        zeile2="y"
        heute="2026-12-14"
        abHeuteZusatz="passend zur Fensterbreite"
        onWahl={() => {}}
      />
    );
    const { rerender } = render(el('2026-12'));
    rerender(el('2027-02'));
    fireEvent.click(screen.getByRole('button', { name: /^Zeitraum:/ }));
    expect(screen.getByLabelText<HTMLInputElement>('von').value).toBe('2027-02-01');
    expect(screen.getByLabelText<HTMLInputElement>('bis').value).toBe('2027-02-28');
  });

  it('bei „ab heute“ schlagen die Felder heute bis in vier Wochen vor', () => {
    const { onWahl } = zeige();
    expect(screen.getByLabelText<HTMLInputElement>('von').value).toBe('2026-12-14');
    expect(screen.getByLabelText<HTMLInputElement>('bis').value).toBe('2027-01-10');
    fireEvent.click(screen.getByRole('button', { name: 'Anzeigen' }));
    expect(onWahl).toHaveBeenCalledWith({ art: 'eigen', von: '2026-12-14', bis: '2027-01-10' });
  });

  it('kein gültiger Tag → „Anzeigen“ gesperrt', () => {
    zeige();
    fireEvent.change(screen.getByLabelText('bis'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Anzeigen' })).toHaveProperty('disabled', true);
  });

  it('was „Ab heute“ heißt, sagt der Aufrufer – Matrix am Handy, Abwesenheiten (seit 28.10.2026 in ui/)', () => {
    zeige({ art: 'abHeute' }, 'die nächsten Termine');
    expect(screen.getByRole('button', { name: /^Ab heute/ }).textContent).toBe(
      'Ab heutedie nächsten Termine',
    );
    cleanup();
    zeige({ art: 'abHeute' }, 'die nächsten 4 Wochen');
    expect(screen.getByRole('button', { name: /^Ab heute/ }).textContent).toBe(
      'Ab heutedie nächsten 4 Wochen',
    );
  });

  it('mit `spaetestens`: ein eigener Zeitraum darüber hinaus wird nicht angezeigt – mit Hinweis', () => {
    const onWahl = vi.fn();
    render(
      <ZeitraumKnopf
        zeitraum={{ art: 'abHeute' }}
        zeile1="x"
        zeile2="y"
        heute="2026-12-14"
        abHeuteZusatz="die nächsten 4 Wochen"
        spaetestens="2027-12-14"
        onWahl={onWahl}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Zeitraum:/ }));
    expect(screen.getByLabelText('bis').getAttribute('max')).toBe('2027-12-14');
    fireEvent.change(screen.getByLabelText('bis'), { target: { value: '2027-12-15' } });
    expect(screen.getByText('Höchstens bis 14.12.2027')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Anzeigen' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('bis'), { target: { value: '2027-12-14' } });
    expect(screen.queryByText(/Höchstens bis/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Anzeigen' }));
    expect(onWahl).toHaveBeenCalledWith({ art: 'eigen', von: '2026-12-14', bis: '2027-12-14' });
  });

  it('Tipp daneben oder Escape schließt', () => {
    zeige();
    fireEvent.pointerDown(screen.getByText('draußen'));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Zeitraum:/ }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
