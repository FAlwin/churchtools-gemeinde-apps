// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Entwurf } from '@shared/dienstplan/entwuerfe';
import { EntwurfFach } from './EntwurfFach';
import type { FreierPlatz } from './WerKann';

const PLATZ: FreierPlatz = {
  eventId: 148,
  serviceId: 6,
  dienst: 'Ton',
  termin: 'Gottesdienst',
  tag: 'So 25.10.',
  uhrzeit: '10:00',
  monat: '2026-10',
  monatName: 'Oktober',
  nr: 1,
  von: 1,
  schonDa: [],
  index: null,
  gruppeId: 3,
};

const entwurf = (x: Partial<Entwurf> = {}): Entwurf => ({
  ort: { eventId: 148, serviceId: 6, index: null },
  ziel: { art: 'person', personId: 46, name: 'Ben Test' },
  modus: 'anfrage',
  gesehen: { art: 'frei' },
  von: { personId: 19, name: 'Spike' },
  zeit: '2026-10-14T16:42:00.000Z',
  version: 3,
  ...x,
});

function zeige(x: Partial<Parameters<typeof EntwurfFach>[0]> = {}) {
  const p = {
    onModus: vi.fn(() => Promise.resolve({ ok: true as const, entwurf: null })),
    onEntfernen: vi.fn(() => Promise.resolve({ ok: true as const, entwurf: null })),
    onAnderePerson: vi.fn(),
    onClose: vi.fn(),
    ...x,
  };
  render(
    <EntwurfFach
      platz={PLATZ}
      entwurf={entwurf()}
      inChurchTools={null}
      zeitzone="Europe/Berlin"
      {...p}
    />,
  );
  return p;
}

describe('EntwurfFach (E4-3-3)', () => {
  it('wer, von wem und wann; „Beim Senden“ steht auf dem gespeicherten Modus', () => {
    zeige();
    expect(screen.getByText('Ton · So 25.10.')).toBeTruthy();
    expect(screen.getByText(/– Entwurf, noch nicht gesendet\./)).toBeTruthy();
    expect(screen.getByText(/^Eingetragen von Spike, /)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Anfrage senden' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('Modus umstellen speichert sofort mit der Version; derselbe Modus speichert nicht', async () => {
    const p = zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Anfrage senden' }));
    expect(p.onModus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Direkt zuteilen' }));
    await waitFor(() => expect(p.onModus).toHaveBeenCalledWith('direkt', 3));
  });

  it('Gast: kein „Beim Senden“, nur der Hinweis', () => {
    zeige({ entwurf: entwurf({ ziel: { art: 'gast', name: 'Max' } }) });
    expect(screen.queryByRole('button', { name: 'Direkt zuteilen' })).toBeNull();
    expect(screen.getByText(/Ein Gast bekommt keine Anfrage/)).toBeTruthy();
  });

  it('Entfernen mit der Version; „Andere Person wählen“ geht zurück an den Aufrufer', async () => {
    const p = zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Andere Person wählen' }));
    expect(p.onAnderePerson).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    await waitFor(() => expect(p.onEntfernen).toHaveBeenCalledWith(3));
  });

  it('E4-5 Zurückziehen: „Zurückziehen: Anna“, Warnung, kein „Beim Senden“', () => {
    zeige({
      entwurf: entwurf({ ziel: { art: 'frei' }, gesehen: { art: 'zusage', personId: 46 } }),
      platz: {
        ...PLATZ,
        bisher: { belegung: { art: 'zusage', personId: 46 }, name: 'Anna Test', gast: false },
      },
    });
    expect(screen.getByText('Zurückziehen: Anna Test')).toBeTruthy();
    expect(screen.getByText(/ChurchTools sagt Anna Test nicht Bescheid/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Direkt zuteilen' })).toBeNull();
  });

  it('E4-5 Ersetzen: „Ben Test statt Anna“, „Beim Senden“ bleibt, Anna bekommt „ausgetragen“', () => {
    zeige({
      entwurf: entwurf({ gesehen: { art: 'anfrage', personId: 47 } }),
      platz: {
        ...PLATZ,
        bisher: { belegung: { art: 'anfrage', personId: 47 }, name: 'Anna Test', gast: false },
      },
    });
    expect(screen.getByText(/statt Anna Test – Entwurf, noch nicht gesendet\./)).toBeTruthy();
    expect(
      screen.getByText(/Anna Test bekommt von ChurchTools „Du wurdest … ausgetragen“/),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Direkt zuteilen' })).toBeTruthy();
  });

  it('veraltet: sagt, was in ChurchTools steht; nur „Entwurf verwerfen“', async () => {
    const p = zeige({ inChurchTools: 'Clara Test ist dort angefragt.' });
    expect(screen.getByText(/Inzwischen in ChurchTools geändert:/)).toBeTruthy();
    expect(screen.getByText(/Clara Test ist dort angefragt\./)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Direkt zuteilen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Andere Person wählen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Entwurf verwerfen' }));
    await waitFor(() => expect(p.onEntfernen).toHaveBeenCalledWith(3));
  });

  it('Konflikt beim Umstellen: wer und was; „So lassen“ schließt, „Trotzdem ändern“ mit SEINER Version', async () => {
    const neu = entwurf({
      von: { personId: 1, name: 'Alwin' },
      ziel: { art: 'gast', name: 'Max' },
      version: 5,
    });
    const onModus = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, grund: 'konflikt', jetzt: neu })
      .mockResolvedValueOnce({ ok: true, entwurf: null });
    const p = zeige({ onModus });
    fireEvent.click(screen.getByRole('button', { name: 'Direkt zuteilen' }));
    const hinweis = await screen.findByRole('alert');
    expect(hinweis.textContent).toContain('Alwin hat diesen Entwurf eben geändert:');
    // Was jetzt dasteht, mit Art (Prüfung mit zwei Planern, 16.10.2026: vorher nur der Name).
    expect(hinweis.textContent).toContain('Gast eintragen: Max.');
    expect(hinweis.textContent).toContain('Nichts geändert.');
    fireEvent.click(screen.getByRole('button', { name: 'Trotzdem ändern' }));
    await waitFor(() => expect(onModus).toHaveBeenLastCalledWith('direkt', 5));
    expect(p.onClose).not.toHaveBeenCalled();
  });

  it('Konflikt beim Entfernen, der Entwurf ist schon weg → „eben entfernt“, kein „Trotzdem“', async () => {
    const onEntfernen = vi.fn().mockResolvedValue({ ok: false, grund: 'konflikt', jetzt: null });
    const p = zeige({ onEntfernen });
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Jemand hat diesen Entwurf eben entfernt.',
    );
    expect(screen.queryByRole('button', { name: /^Trotzdem/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'So lassen' }));
    expect(p.onClose).toHaveBeenCalled();
  });

  it('anderer Fehler → eigener Text, das Fach bleibt offen', async () => {
    const onEntfernen = vi.fn().mockResolvedValue({ ok: false, grund: 'kein-recht' });
    const p = zeige({ onEntfernen });
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/erlaubt dir nicht/);
    expect(p.onClose).not.toHaveBeenCalled();
  });
});
