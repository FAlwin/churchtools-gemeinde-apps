// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import type { RohKandidat } from '@shared/dienstplan/werKann';
import { WerKann, type FreierPlatz } from './WerKann';
import { ladeWerKann, vergissWerKann } from './ladeWerKann';
import { STANDARD } from '@shared/dienstplan/vorlieben';

vi.mock('./ladeWerKann', () => ({ ladeWerKann: vi.fn(), vergissWerKann: vi.fn() }));
const laden = vi.mocked(ladeWerKann);
afterEach(() => laden.mockReset());

const PLATZ: FreierPlatz = {
  eventId: 166,
  serviceId: 6,
  dienst: 'Ton',
  termin: 'Gottesdienst',
  tag: 'So 08.11.',
  uhrzeit: '10:00',
  monat: '2026-11',
  monatName: 'November',
  nr: 1,
  von: 2,
  schonDa: [9],
  index: 1,
  gruppeId: 3,
};
const k = (id: number, name: string, o: Partial<RohKandidat> = {}): RohKandidat => ({
  person: { domainIdentifier: String(id), title: name },
  score: 0,
  ...o,
});

describe('WerKann', () => {
  it('Kopf, Kandidaten mit Hinweis und „N× im Monat“; wer schon da ist, fehlt', async () => {
    laden.mockResolvedValue([
      k(1, 'Anna', { monthlyUtilization: { '2026-11': 2 } }),
      k(2, 'David', { score: -1000, absences: [{ absenceReason: { nameTranslated: 'Urlaub' } }] }),
      k(9, 'Schon Da'),
    ]);
    render(<WerKann platz={PLATZ} onClose={() => {}} />);
    expect(screen.getByText('Ton · So 08.11.')).toBeTruthy();
    expect(screen.getByText('Gottesdienst um 10:00 Uhr · Platz 1 von 2')).toBeTruthy();
    const liste = await screen.findByRole('list', { name: 'Wer kann?' });
    const zeilen = within(liste)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(zeilen).toEqual(['Annafrei2× im November', 'Davidabwesend: Urlaub0× im November']);
    expect(laden).toHaveBeenCalledWith(166, 6);
  });

  it('niemand vorgeschlagen → sagt es', async () => {
    laden.mockResolvedValue([]);
    render(<WerKann platz={PLATZ} onClose={() => {}} />);
    expect(await screen.findByText(/schlägt ChurchTools niemanden vor/)).toBeTruthy();
  });

  it('ab 7 Kandidaten ein Suchfeld, das filtert', async () => {
    laden.mockResolvedValue(
      ['Anna', 'Ben', 'Clara', 'David', 'Ella', 'Finn', 'Greta'].map((n, i) => k(i + 1, n)),
    );
    render(<WerKann platz={PLATZ} onClose={() => {}} />);
    const suche = await screen.findByRole('searchbox', { name: 'Name suchen' });
    fireEvent.change(suche, { target: { value: 'fi' } });
    expect(
      within(screen.getByRole('list'))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Finnfrei0× im November']);
  });

  it('weniger als 7 → kein Suchfeld', async () => {
    laden.mockResolvedValue([k(1, 'Anna')]);
    render(<WerKann platz={PLATZ} onClose={() => {}} />);
    await screen.findByRole('list');
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('Ladefehler → Fehlerkasten; „Nochmal“ lädt neu', async () => {
    laden.mockRejectedValueOnce(new ApiError(503, 'ChurchTools antwortet gerade nicht.'));
    laden.mockResolvedValueOnce([k(1, 'Anna')]);
    render(<WerKann platz={PLATZ} onClose={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    await screen.findByRole('list');
    expect(laden).toHaveBeenCalledTimes(2);
  });

  it('„Schließen“ schließt', async () => {
    laden.mockResolvedValue([]);
    const onClose = vi.fn();
    render(<WerKann platz={PLATZ} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

// ── Eintragen als Entwurf (E4-3-2) ───────────────────────────────────────────
describe('WerKann – Eintragen', () => {
  const spikeEntwurf = (version = 2) => ({
    ort: { eventId: 166, serviceId: 6, index: 1 },
    ziel: { art: 'person' as const, personId: 47, name: 'Finn' },
    modus: 'anfrage' as const,
    gesehen: { art: 'frei' as const },
    von: { personId: 19, name: 'Spike' },
    zeit: '2026-10-14T20:00:00.000Z',
    version,
  });

  it('ohne Anschluss nur zum Ansehen: keine Knöpfe, kein Gast-Feld', async () => {
    laden.mockResolvedValue([k(1, 'Anna')]);
    render(<WerKann platz={PLATZ} onClose={() => {}} />);
    await screen.findByRole('list', { name: 'Wer kann?' });
    expect(screen.queryByRole('button', { name: /Anna/ })).toBeNull();
    expect(screen.queryByLabelText('Name eines Gastes')).toBeNull();
  });

  it('bereit: Person antippen trägt sie ein (noch ohne Version); Gast über das Feld', async () => {
    laden.mockResolvedValue([k(1, 'Anna')]);
    const onWahl = vi.fn(() => Promise.resolve({ ok: true as const, entwurf: null }));
    render(<WerKann platz={PLATZ} onClose={() => {}} eintragen={{ art: 'bereit', onWahl }} />);
    fireEvent.click(await screen.findByRole('button', { name: /Anna/ }));
    expect(onWahl).toHaveBeenCalledWith({ art: 'person', personId: 1, name: 'Anna' }, null);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Anna/ })).toHaveProperty('disabled', false),
    );
    const feld = screen.getByLabelText('Name eines Gastes');
    const eintragen = screen.getByRole('button', { name: 'Eintragen' });
    fireEvent.change(feld, { target: { value: ' M ' } });
    expect(eintragen).toHaveProperty('disabled', true); // zu kurz
    // Auch die Eingabetaste (Formular abschicken) trägt keinen zu kurzen Namen ein.
    fireEvent.submit(feld.closest('form')!);
    expect(onWahl).toHaveBeenCalledTimes(1);
    fireEvent.change(feld, { target: { value: ' Max Gast ' } });
    fireEvent.click(eintragen);
    expect(onWahl).toHaveBeenLastCalledWith({ art: 'gast', name: 'Max Gast' }, null);
  });

  it('Konflikt: sagt wer und was; „lassen“ schließt, „trotzdem“ speichert mit SEINER Version', async () => {
    laden.mockResolvedValue([k(1, 'Anna')]);
    const onWahl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, grund: 'konflikt', jetzt: spikeEntwurf() })
      .mockResolvedValueOnce({ ok: true, entwurf: null });
    const onClose = vi.fn();
    render(<WerKann platz={PLATZ} onClose={onClose} eintragen={{ art: 'bereit', onWahl }} />);
    fireEvent.click(await screen.findByRole('button', { name: /Anna/ }));
    const hinweis = await screen.findByRole('alert');
    expect(hinweis.textContent).toContain('Spike hat diesen Platz eben geändert:');
    expect(hinweis.textContent).toContain('Entwurf „Finn“');
    expect(hinweis.textContent).toContain('Dein „Anna“ wurde nicht gespeichert.');
    fireEvent.click(screen.getByRole('button', { name: 'Trotzdem Anna eintragen' }));
    expect(onWahl).toHaveBeenLastCalledWith({ art: 'person', personId: 1, name: 'Anna' }, 2);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ein Hinweis (Konflikt, Fehler) wird ins Bild gerollt – er steht unter der langen Liste', async () => {
    laden.mockResolvedValue([k(1, 'Anna')]);
    const rollen = vi.fn();
    Element.prototype.scrollIntoView = rollen;
    try {
      const onWahl = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, grund: 'konflikt', jetzt: spikeEntwurf() })
        .mockResolvedValueOnce({ ok: false, grund: 'voruebergehend' });
      render(<WerKann platz={PLATZ} onClose={() => {}} eintragen={{ art: 'bereit', onWahl }} />);
      fireEvent.click(await screen.findByRole('button', { name: /^Anna/ }));
      await screen.findByRole('button', { name: 'Entwurf von Spike lassen' });
      expect(rollen).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: /^Anna/ }));
      await screen.findByText(/antwortet gerade nicht/);
      expect(rollen).toHaveBeenCalledTimes(2);
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it('Konflikt „lassen“ schließt das Fach, ohne zu speichern', async () => {
    laden.mockResolvedValue([k(1, 'Anna')]);
    const onWahl = vi
      .fn()
      .mockResolvedValue({ ok: false, grund: 'konflikt', jetzt: spikeEntwurf() });
    const onClose = vi.fn();
    render(<WerKann platz={PLATZ} onClose={onClose} eintragen={{ art: 'bereit', onWahl }} />);
    fireEvent.click(await screen.findByRole('button', { name: /Anna/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Entwurf von Spike lassen' }));
    expect(onClose).toHaveBeenCalled();
    expect(onWahl).toHaveBeenCalledTimes(1);
  });

  it('anderer Fehler → eigener Text, das Fach bleibt offen und ein zweiter Tipp versucht es erneut', async () => {
    laden.mockResolvedValue([k(1, 'Anna')]);
    const onWahl = vi.fn().mockResolvedValue({ ok: false, grund: 'voruebergehend' });
    render(<WerKann platz={PLATZ} onClose={() => {}} eintragen={{ art: 'bereit', onWahl }} />);
    fireEvent.click(await screen.findByRole('button', { name: /Anna/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/antwortet gerade nicht/);
    fireEvent.click(screen.getByRole('button', { name: /Anna/ }));
    await waitFor(() => expect(onWahl).toHaveBeenCalledTimes(2));
  });

  it('gesperrt: Text und „Erneut versuchen“; lädt: Hinweis – beide ohne Knöpfe an den Personen', async () => {
    laden.mockResolvedValue([k(1, 'Anna')]);
    const onNochmal = vi.fn();
    const { rerender } = render(
      <WerKann
        platz={PLATZ}
        onClose={() => {}}
        eintragen={{ art: 'gesperrt', text: 'Kein Platz.', onNochmal }}
      />,
    );
    await screen.findByRole('list', { name: 'Wer kann?' });
    expect(screen.getByText('Kein Platz.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Anna/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(onNochmal).toHaveBeenCalled();
    rerender(<WerKann platz={PLATZ} onClose={() => {}} eintragen={{ art: 'laedt' }} />);
    expect(screen.getByText('Entwürfe werden geladen …')).toBeTruthy();
  });

  it('Schublade fehlt, aber anlegbar: „Einrichten“ mit Warnung; ein Fehler dabei steht da', async () => {
    laden.mockResolvedValue([]);
    const onEinrichten = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError(403, 'ChurchTools erlaubt dir nicht, Kategorien anzulegen.'),
      )
      .mockResolvedValueOnce(undefined);
    render(
      <WerKann
        platz={PLATZ}
        onClose={() => {}}
        eintragen={{ art: 'einrichten', gruppe: 'Technik', onEinrichten }}
      />,
    );
    expect(screen.getByText(/Entwürfe für „Technik“ einrichten/)).toBeTruthy();
    expect(screen.getByText(/sonst entsteht ein zweiter/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Einrichten' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'ChurchTools erlaubt dir nicht, Kategorien anzulegen.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Einrichten' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(onEinrichten).toHaveBeenCalledTimes(2);
  });

  it('Stift (E5-3): neben jedem Namen; speichern → „Wer kann?“ neu (mit neuen Punkten), Hinweis', async () => {
    laden.mockResolvedValue([k(1, 'Anna'), k(2, 'Ben')]);
    const vorlieben = {
      lesen: vi.fn(() => Promise.resolve({ ok: true as const, vorliebe: STANDARD })),
      speichern: vi.fn(() => Promise.resolve({ ok: true as const })),
    };
    render(
      <WerKann
        platz={PLATZ}
        onClose={() => {}}
        stift={{ vorlieben, gruppe: { id: 3, name: 'Technik' } }}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Vorlieben von Ben' }));
    expect(await screen.findByText('Vorlieben · Ben')).toBeTruthy();
    fireEvent.change(await screen.findByRole('combobox', { name: 'Tageszeit' }), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await screen.findByText('Vorlieben von Ben gespeichert.');
    expect(vergissWerKann).toHaveBeenCalledWith(166, 6);
    await waitFor(() => expect(laden).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Vorlieben · Ben')).toBeNull();
  });

  it('ohne `stift` kein Stift (Termin-Admin ohne Gruppenrecht)', async () => {
    laden.mockResolvedValue([k(1, 'Anna')]);
    render(<WerKann platz={PLATZ} onClose={() => {}} />);
    await screen.findByText('Anna');
    expect(screen.queryByRole('button', { name: /^Vorlieben von/ })).toBeNull();
  });
});

/** Fenster wie ChurchTools (E6-O F2, #720): X oben rechts, die Knöpfe unten rechts – der Hauptknopf zuletzt. */
const knopfFolge = () =>
  screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);

describe('WerKann im ChurchTools-Aufbau', () => {
  it('nur auswählen: X oben, unten nur Schließen', async () => {
    laden.mockResolvedValue([k(1, 'Anna')]);
    render(<WerKann platz={PLATZ} onClose={() => {}} />);
    await screen.findByRole('list', { name: 'Wer kann?' });
    expect(screen.getByRole('dialog', { name: 'Ton · So 08.11.' })).toBeTruthy();
    expect(knopfFolge()[0]).toBe('Fenster schließen');
    expect(knopfFolge().at(-1)).toBe('Schließen');
  });
});
