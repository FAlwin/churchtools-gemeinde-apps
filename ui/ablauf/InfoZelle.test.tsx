// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ablaufZeileAus, punktStand, type AblaufZeile } from '@shared/ct/ablaufZeile';
import { PUNKT_GEAENDERT } from '@shared/ct/schreibKern';
import { InfoZelle } from './InfoZelle';

/**
 * Die Info-Zelle im Bearbeiten-Modus (Entwurf `ablauf-infos-bearbeiten.html`, Variante B): Klick öffnet ein Feld,
 * gespeichert wird beim Verlassen und nur bei Änderung, Esc verwirft, ein Fehler bringt das Feld mit dem Text zurück.
 * Der Punkt kommt aus dem echten `ablaufZeileAus`, `gesehen` wird gegen `punktStand` geprüft – nicht gegen ein Literal.
 */
afterEach(cleanup);

const GRUPPE = { id: 3, name: 'Technik' };
const mitInfo = ablaufZeileAus(
  {
    id: 5,
    title: 'Rückblick',
    type: 'normal',
    serviceGroupNotes: [{ serviceGroupId: 3, note: 'Video abspielen' }],
  },
  7,
  'Europe/Berlin',
);
const ohneInfo = ablaufZeileAus({ id: 6, title: 'Predigt', type: 'normal' }, 7, 'Europe/Berlin');

function zeige(
  item: AblaufZeile,
  over: { onSpeichern?: () => Promise<void>; gesperrt?: () => void } = {},
) {
  const onSpeichern = vi.fn(over.onSpeichern ?? (() => Promise.resolve()));
  render(
    <InfoZelle item={item} gruppe={GRUPPE} onSpeichern={onSpeichern} gesperrt={over.gesperrt} />,
  );
  return onSpeichern;
}
const knopf = (item: AblaufZeile) =>
  screen.getByRole('button', { name: `Info für Technik bei „${item.title}“ bearbeiten` });
const feld = () => screen.getByRole<HTMLTextAreaElement>('textbox');

describe('InfoZelle', () => {
  it('zeigt den Text bzw. „–“ und öffnet beim Klick ein Feld mit dem Text, Fokus am Ende', () => {
    zeige(mitInfo);
    expect(knopf(mitInfo).textContent).toBe('Video abspielen');
    fireEvent.click(knopf(mitInfo));
    expect(feld().value).toBe('Video abspielen');
    expect(document.activeElement).toBe(feld());
    expect(feld().selectionStart).toBe('Video abspielen'.length);
    expect(screen.getByText('Speichert beim Verlassen · Esc verwirft')).toBeTruthy();
  });

  it('leere Zelle: „–“ und ein „+ Info“ für die Maus', () => {
    zeige(ohneInfo);
    expect(knopf(ohneInfo).textContent).toBe('–+ Info');
  });

  it('Verlassen mit geändertem Text: onSpeichern genau einmal mit Gruppe, Text und dem Stand beim Öffnen', async () => {
    const onSpeichern = zeige(mitInfo);
    fireEvent.click(knopf(mitInfo));
    fireEvent.change(feld(), { target: { value: 'Video abspielen, Ton an' } });
    fireEvent.blur(feld());
    await waitFor(() => expect(onSpeichern).toHaveBeenCalledTimes(1));
    expect(onSpeichern).toHaveBeenCalledWith(3, 'Video abspielen, Ton an', punktStand(mitInfo));
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('Verlassen ohne Änderung (auch nur Leerzeichen am Rand): nichts wird gespeichert, das Feld schließt', () => {
    const onSpeichern = zeige(mitInfo);
    fireEvent.click(knopf(mitInfo));
    fireEvent.change(feld(), { target: { value: '  Video abspielen ' } });
    fireEvent.blur(feld());
    expect(onSpeichern).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('Esc verwirft: schließt, speichert nicht – auch nicht beim Blur, das darauf folgt', () => {
    const onSpeichern = zeige(mitInfo);
    fireEvent.click(knopf(mitInfo));
    fireEvent.change(feld(), { target: { value: 'etwas ganz anderes' } });
    fireEvent.keyDown(feld(), { key: 'Escape' });
    expect(onSpeichern).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
    // Der alte Text steht wieder da.
    expect(knopf(mitInfo).textContent).toBe('Video abspielen');
  });

  it('Fehler: das Feld geht wieder auf – mit dem eingegebenen Text und der Meldung des Fehlers', async () => {
    const onSpeichern = zeige(mitInfo, {
      onSpeichern: () => Promise.reject(new Error('Der Punkt wurde inzwischen geändert.')),
    });
    fireEvent.click(knopf(mitInfo));
    fireEvent.change(feld(), { target: { value: 'Mein neuer Text' } });
    fireEvent.blur(feld());
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('Der Punkt wurde inzwischen geändert.'),
    );
    expect(feld().value).toBe('Mein neuer Text');
    expect(onSpeichern).toHaveBeenCalledTimes(1);
  });

  it('Fehler ohne Text: die allgemeine Meldung; der zweite Versuch nutzt denselben Stand von damals', async () => {
    const onSpeichern = vi
      .fn<(g: number, t: string, s: unknown) => Promise<void>>()
      .mockRejectedValueOnce('kaputt')
      .mockResolvedValueOnce(undefined);
    render(<InfoZelle item={mitInfo} gruppe={GRUPPE} onSpeichern={onSpeichern} />);
    fireEvent.click(knopf(mitInfo));
    fireEvent.change(feld(), { target: { value: 'Neu' } });
    fireEvent.blur(feld());
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('Info konnte nicht gespeichert werden.'),
    );
    fireEvent.blur(feld());
    await waitFor(() => expect(onSpeichern).toHaveBeenCalledTimes(2));
    expect(onSpeichern.mock.calls[1]).toEqual(onSpeichern.mock.calls[0]);
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
  });

  it('Konflikt (412): Meldung mit „speichert trotzdem“; der nächste Versuch schreibt ohne Vergleich, wie im Punkt-Fenster', async () => {
    const konflikt = Object.assign(new Error(PUNKT_GEAENDERT), { status: 412 });
    const onSpeichern = vi
      .fn<(g: number, t: string, s: unknown) => Promise<void>>()
      .mockRejectedValueOnce(konflikt)
      .mockResolvedValueOnce(undefined);
    render(<InfoZelle item={mitInfo} gruppe={GRUPPE} onSpeichern={onSpeichern} />);
    fireEvent.click(knopf(mitInfo));
    fireEvent.change(feld(), { target: { value: 'Mein Text' } });
    fireEvent.blur(feld());
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        `${PUNKT_GEAENDERT} Verlassen speichert trotzdem · Esc verwirft.`,
      ),
    );
    expect(feld().value).toBe('Mein Text');
    expect(onSpeichern.mock.calls[0][2]).toEqual(punktStand(mitInfo));
    fireEvent.blur(feld());
    await waitFor(() => expect(onSpeichern).toHaveBeenCalledTimes(2));
    expect(onSpeichern.mock.calls[1]).toEqual([GRUPPE.id, 'Mein Text', undefined]);
  });

  it('nach einem Konflikt neu geöffnet: wieder mit Vergleich (das „trotzdem“ gilt nur für den einen Versuch)', async () => {
    const konflikt = Object.assign(new Error(PUNKT_GEAENDERT), { status: 412 });
    const onSpeichern = vi
      .fn<(g: number, t: string, s: unknown) => Promise<void>>()
      .mockRejectedValueOnce(konflikt)
      .mockResolvedValue(undefined);
    render(<InfoZelle item={mitInfo} gruppe={GRUPPE} onSpeichern={onSpeichern} />);
    fireEvent.click(knopf(mitInfo));
    fireEvent.change(feld(), { target: { value: 'Mein Text' } });
    fireEvent.blur(feld());
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    fireEvent.keyDown(feld(), { key: 'Escape' });
    fireEvent.click(knopf(mitInfo));
    fireEvent.change(feld(), { target: { value: 'Anderer Text' } });
    fireEvent.blur(feld());
    await waitFor(() => expect(onSpeichern).toHaveBeenCalledTimes(2));
    expect(onSpeichern.mock.calls[1][2]).toEqual(punktStand(mitInfo));
  });

  it('verglichen wird mit dem Stand beim ÖFFNEN – auch wenn der Punkt inzwischen neu geladen wurde (sonst kein 412)', async () => {
    const onSpeichern = vi.fn(() => Promise.resolve());
    const { rerender } = render(
      <InfoZelle item={mitInfo} gruppe={GRUPPE} onSpeichern={onSpeichern} />,
    );
    fireEvent.click(knopf(mitInfo));
    fireEvent.change(feld(), { target: { value: 'Mein Text' } });
    // Während des Tippens liefert ein Neuladen eine fremde Änderung an derselben Info.
    const fremd = ablaufZeileAus(
      {
        id: 5,
        title: 'Rückblick',
        type: 'normal',
        serviceGroupNotes: [{ serviceGroupId: 3, note: 'Jemand anderes war schneller' }],
      },
      7,
      'Europe/Berlin',
    );
    rerender(<InfoZelle item={fremd} gruppe={GRUPPE} onSpeichern={onSpeichern} />);
    fireEvent.blur(feld());
    await waitFor(() => expect(onSpeichern).toHaveBeenCalledTimes(1));
    expect(onSpeichern).toHaveBeenCalledWith(3, 'Mein Text', punktStand(mitInfo));
    expect(punktStand(fremd)).not.toEqual(punktStand(mitInfo));
  });

  it('Leeren eines vorhandenen Texts speichert einen leeren Text (= Info löschen)', async () => {
    const onSpeichern = zeige(mitInfo);
    fireEvent.click(knopf(mitInfo));
    fireEvent.change(feld(), { target: { value: '' } });
    fireEvent.blur(feld());
    await waitFor(() => expect(onSpeichern).toHaveBeenCalledWith(3, '', punktStand(mitInfo)));
  });

  it('Eintippen in eine leere Zelle speichert den Text', async () => {
    const onSpeichern = zeige(ohneInfo);
    fireEvent.click(knopf(ohneInfo));
    fireEvent.change(feld(), { target: { value: 'Mikro 2' } });
    fireEvent.blur(feld());
    await waitFor(() =>
      expect(onSpeichern).toHaveBeenCalledWith(3, 'Mikro 2', punktStand(ohneInfo)),
    );
  });

  it('abgeschlossen (gesperrt): kein Feld, stattdessen der Hinweis', () => {
    const gesperrt = vi.fn();
    const onSpeichern = zeige(mitInfo, { gesperrt });
    fireEvent.click(knopf(mitInfo));
    expect(gesperrt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(onSpeichern).not.toHaveBeenCalled();
  });
});
