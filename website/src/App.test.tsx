// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { einrichtungAus } from '@shared/website/einrichten';
import { kategorienFuer } from '@shared/website/einrichten';
import { App } from './App';
import type { Start } from './start';
import * as S from './start';

vi.mock('./start', () => ({ ladeStart: vi.fn() }));
// Die Seiten selbst sind in `Seiten.test.tsx` geprüft – hier geht es um den Rahmen und wer hineindarf.
vi.mock('./Seiten', () => ({ Seiten: () => <p>SEITEN-INHALT</p> }));
vi.mock('./Einrichtung', () => ({ Einrichtung: () => <p>EINRICHTUNG</p> }));
const ladeStart = vi.mocked(S.ladeStart);

const einrichtung = einrichtungAus(
  kategorienFuer(7, 'Website').map((k, i) => ({ id: 20 + i, shorty: k.kuerzel, name: k.name })),
);
const start = (o: Partial<Start> = {}): Start => ({
  ichId: 1,
  vorname: 'Helene',
  name: 'Helene Wiebe',
  gemeinde: 'ECG',
  modul: 7,
  einrichtung,
  stand: 'fertig',
  admin: false,
  zugang: 'leitung',
  ...o,
});

beforeEach(() => {
  ladeStart.mockResolvedValue(start());
});

describe('Rahmen und Zugang', () => {
  it('Leitung der Gruppe: Reiter „Seiten | Aussehen | Freigaben“, Seiten zuerst', async () => {
    render(<App />);
    expect(await screen.findByText('SEITEN-INHALT')).toBeTruthy();
    for (const name of ['Seiten', 'Aussehen', 'Freigaben'])
      expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Seiten' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('„Aussehen“ und „Freigaben“ zeigen in dieser Scheibe nur einen ruhigen Hinweis', async () => {
    render(<App />);
    await screen.findByText('SEITEN-INHALT');
    fireEvent.click(screen.getByRole('button', { name: 'Aussehen' }));
    expect(screen.getByText(/Das kommt in einem der nächsten Schritte/)).toBeTruthy();
    expect(screen.queryByText('SEITEN-INHALT')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Freigaben' }));
    expect(screen.getByText(/Das kommt in einem der nächsten Schritte/)).toBeTruthy();
  });

  it('Mitglied ohne Leitung: freundlicher Hinweis, KEIN Editor, keine Reiter', async () => {
    ladeStart.mockResolvedValue(start({ zugang: null }));
    render(<App />);
    expect(await screen.findByText(/dürfen die Admins und die Leitung der Gruppe/)).toBeTruthy();
    expect(screen.queryByText('SEITEN-INHALT')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Aussehen' })).toBeNull();
  });

  it('nicht eingerichtet, Admin: die Einrichtung', async () => {
    ladeStart.mockResolvedValue(
      start({ einrichtung: null, stand: 'einrichten', admin: true, zugang: 'admin' }),
    );
    render(<App />);
    expect(await screen.findByText('EINRICHTUNG')).toBeTruthy();
    expect(screen.queryByText('SEITEN-INHALT')).toBeNull();
  });

  it('nicht eingerichtet, kein Admin: freundlicher Hinweis statt Einrichtung', async () => {
    ladeStart.mockResolvedValue(start({ einrichtung: null, stand: 'fehlt', zugang: null }));
    render(<App />);
    expect(
      await screen.findByText(/noch nicht eingerichtet, oder dir fehlt das Recht/),
    ).toBeTruthy();
    expect(screen.queryByText('EINRICHTUNG')).toBeNull();
    expect(screen.queryByText('SEITEN-INHALT')).toBeNull();
  });

  it('nur zum Teil eingerichtet, kein Admin: Hinweis „zum Teil eingerichtet“', async () => {
    ladeStart.mockResolvedValue(start({ stand: 'unvollstaendig', zugang: null }));
    render(<App />);
    expect(await screen.findByText(/nur zum Teil eingerichtet/)).toBeTruthy();
  });

  it('ein vorübergehender Fehler beim Laden zeigt „Erneut versuchen“ statt eines leeren Rahmens', async () => {
    ladeStart.mockRejectedValueOnce(new Error('Netz'));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText('SEITEN-INHALT')).toBeTruthy();
  });
});
