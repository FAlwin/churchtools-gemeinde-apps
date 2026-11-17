// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vorlagenStandAus } from '@shared/ct/ablaufVorlagenListe';
import { ablaufZeileAus } from '@shared/ct/ablaufZeile';
import { useAlsVorlage } from './useAlsVorlage';
import { useAblaufBearbeiten, type AblaufAktionen } from './useAblaufBearbeiten';
import type { AlsVorlageZugriff } from './vorlagenZugriff';

/**
 * **„Als Vorlage …“ als Link der Hinweiszeile** (E10-V5): nur mit Recht im Kalender des Termins, **links** neben
 * „Neu aufsetzen …“, und nach dem Speichern zu mit Bestätigung. Eingebaut in den echten Bearbeiten-Baustein.
 */
afterEach(cleanup);

const ZEILEN = [ablaufZeileAus({ id: 1, title: 'Begrüßung', type: 'normal' }, 7, 'Europe/Berlin')];
const aktionen: AblaufAktionen = {
  reorder: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve(null)),
  restore: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  setVorBeginn: vi.fn(() => Promise.resolve()),
  setWeggelassen: vi.fn(() => Promise.resolve()),
  add: vi.fn(() => Promise.resolve()),
};
const STAND = vorlagenStandAus(
  [
    { id: 11, name: 'Sonntag', calendarId: 1, items: [{}, {}], meta: { modifiedDate: 'x' } },
  ] as never,
  [{ id: 1, name: 'Gottesdienst' }] as never,
  'Europe/Berlin',
);
const zugriff: AlsVorlageZugriff = {
  stand: vi.fn(() => Promise.resolve(STAND)),
  speichern: vi.fn(() => Promise.resolve(5)),
  ersetzen: vi.fn(() => Promise.resolve()),
};

function Harness({ an = true, darf = true }: { an?: boolean; darf?: boolean }) {
  const als = useAlsVorlage({
    an,
    darfIn: (k) => darf && k === 1,
    terminKalenderId: 1,
    terminTitel: 'Gottesdienst',
    terminText: 'Gottesdienst · So, 23.11.2026',
    punkte: 1,
    zugriff,
  });
  const b = useAblaufBearbeiten({
    aktiv: true,
    bereit: true,
    items: ZEILEN,
    beginn: '10:00',
    abgeschlossen: false,
    sperrHinweis: 'gesperrt',
    aktionen,
    dienste: [],
    neuAufsetzen: () => undefined,
    hinweisLinks: als.link ? [als.link] : undefined,
  });
  return (
    <>
      {b.liste}
      {b.ueberlagerung}
      {als.ueberlagerung}
    </>
  );
}

const link = () => screen.queryByRole('button', { name: /Als Vorlage/ });

describe('useAlsVorlage', () => {
  it('der Link steht mit Recht LINKS neben „Neu aufsetzen …“', () => {
    render(<Harness />);
    const alle = screen.getAllByRole('button').map((b) => b.textContent?.trim());
    expect(alle.indexOf('Als Vorlage …')).toBeGreaterThanOrEqual(0);
    expect(alle.indexOf('Als Vorlage …')).toBe(alle.indexOf('Neu aufsetzen …') - 1);
  });

  it('ohne Recht im Kalender des Termins: kein Link', () => {
    render(<Harness darf={false} />);
    expect(link()).toBeNull();
    expect(screen.getByRole('button', { name: /Neu aufsetzen/ })).toBeTruthy();
  });

  it('ausgeschaltet (Matrix, kein Ablauf): kein Link', () => {
    render(<Harness an={false} />);
    expect(link()).toBeNull();
  });

  it('Klick öffnet das Fenster; nach dem Speichern zu, Bestätigung mit dem Namen', async () => {
    render(<Harness />);
    fireEvent.click(link()!);
    expect(await screen.findByText('Als Vorlage speichern')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Vorlagen werden geladen …')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Als Vorlage „Gottesdienst“ gespeichert.')).toBeTruthy();
    expect(screen.queryByText('Als Vorlage speichern')).toBeNull();
    expect(zugriff.speichern).toHaveBeenCalledWith({ name: 'Gottesdienst', kalenderId: 1 });
  });
});
