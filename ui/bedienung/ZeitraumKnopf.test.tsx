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
  it('Knopf sagt, was zu sehen ist; Menü: ab heute und zwölf Monatsfelder – ein Klick zeigt den Monat (E9-3)', () => {
    const { onWahl } = zeige();
    expect(screen.getByRole('button', { name: /^Zeitraum:/ }).getAttribute('aria-label')).toBe(
      'Zeitraum: 18.10. – 08.11.2026, 4 Termine · passend zur Fensterbreite',
    );
    expect(screen.queryByRole('button', { name: /Dieser Monat|Nächster Monat/ })).toBeNull();
    expect(gedrueckt()).toBe('Ab heute');
    // Das Jahr von heute, der laufende Monat mit Punkt.
    expect(screen.getByText('2026')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Dezember 2026' }).className).toMatch(/heute/);
    expect(screen.getByRole('button', { name: 'November 2026' }).className).not.toMatch(/heute/);
    // Über den Jahreswechsel: Jahr weiter, dann Januar.
    fireEvent.click(screen.getByRole('button', { name: 'Jahr danach' }));
    fireEvent.click(screen.getByRole('button', { name: 'Januar 2027' }));
    expect(onWahl).toHaveBeenCalledWith({ art: 'monat', monat: '2027-01' });
    expect(screen.queryByRole('dialog')).toBeNull(); // nach der Wahl zu
  });

  it('auch Vergangenes: Jahr zurück, März 2025', () => {
    const { onWahl } = zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Jahr davor' }));
    fireEvent.click(screen.getByRole('button', { name: 'März 2025' }));
    expect(onWahl).toHaveBeenCalledWith({ art: 'monat', monat: '2025-03' });
  });

  it('der gewählte Monat ist markiert – auch mit ＋ daneben; die Felder stehen auf seinem ersten und letzten Tag', () => {
    zeige({ art: 'monat', monat: '2026-12' });
    expect(gedrueckt()).toBe('Dez');
    expect(screen.getByLabelText<HTMLInputElement>('von').value).toBe('2026-12-01');
    expect(screen.getByLabelText<HTMLInputElement>('bis').value).toBe('2026-12-31');
    cleanup();
    zeige({ art: 'monat', monat: '2027-02', dazu: { davor: 1, danach: 0 } });
    // Das Jahr der Felder ist das des gezeigten Monats.
    expect(screen.getByText('2027')).not.toBeNull();
    expect(gedrueckt()).toBe('Feb');
  });

  it('„Wer wie oft?“ (`vergangenheit`): oben die letzten 3, 6, 12 Monate statt „Ab heute“', () => {
    const onWahl = vi.fn();
    render(
      <ZeitraumKnopf
        zeitraum={{ art: 'letzte', monate: 3 }}
        zeile1="x"
        zeile2="y"
        heute="2026-11-05"
        abHeuteZusatz="passend zur Fensterbreite"
        vergangenheit
        onWahl={onWahl}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Zeitraum:/ }));
    expect(screen.queryByRole('button', { name: /^Ab heute/ })).toBeNull();
    expect(gedrueckt()).toBe('Letzte 3 Monate');
    expect(screen.getByLabelText<HTMLInputElement>('von').value).toBe('2026-08-05');
    fireEvent.click(screen.getByRole('button', { name: /^Letzte 12 Monate/ }));
    expect(onWahl).toHaveBeenCalledWith({ art: 'letzte', monate: 12 });
  });

  it('`fruehestens`/`spaetestens` sperren Monate und Jahre außerhalb (Abwesenheiten)', () => {
    render(
      <ZeitraumKnopf
        zeitraum={{ art: 'abHeute' }}
        zeile1="x"
        zeile2="y"
        heute="2026-11-05"
        abHeuteZusatz="die nächsten 4 Wochen"
        fruehestens="2026-11-01"
        spaetestens="2027-11-04"
        onWahl={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Zeitraum:/ }));
    const gesperrt = (name: string) =>
      screen.getByRole<HTMLButtonElement>('button', { name }).disabled;
    expect(gesperrt('Oktober 2026')).toBe(true);
    expect(gesperrt('November 2026')).toBe(false);
    expect(gesperrt('Jahr davor')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Jahr danach' }));
    expect(gesperrt('November 2027')).toBe(false);
    expect(gesperrt('Dezember 2027')).toBe(true);
    expect(gesperrt('Jahr danach')).toBe(true);
    expect(screen.getByLabelText('von').getAttribute('min')).toBe('2026-11-01');
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
    // Auch die Monatsfelder stehen im Jahr des neuen Zeitraums (E9-3).
    expect(screen.getByText('2027')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Februar 2027' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
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
