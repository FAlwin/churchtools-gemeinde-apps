// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import * as E from './einrichten';
import { VerwaltenFenster } from './Verwalten';
import { ArchivSeite } from './ArchivSeite';
import { RueckgaengigLeiste, type Aenderung } from './Rueckgaengig';

vi.mock('./einrichten', async (original) => {
  const echt = await original<typeof import('./einrichten')>();
  return {
    ...echt,
    umbenennen: vi.fn(),
    setzeStatus: vi.fn(),
    verschieben: vi.fn(),
    archivListe: vi.fn(),
    istGruppenAdmin: vi.fn(),
    loeschenEndgueltig: vi.fn(),
  };
});
const m = vi.mocked(E);

const TEAMS = [
  { id: 7, name: 'Technik', leitung: false },
  { id: 9, name: 'Lobpreisteam', leitung: true },
];

function verwalten(mehr: { admin?: boolean; statusId?: number; anmeldungen?: number | null } = {}) {
  const geaendert = vi.fn<(a: Aenderung, weg: boolean) => void>();
  render(
    <VerwaltenFenster
      id={91}
      name="Gemeindeessen"
      statusId={mehr.statusId ?? 1}
      team={{ id: 9, name: 'Lobpreisteam' }}
      teams={TEAMS}
      admin={mehr.admin ?? false}
      anmeldungen={mehr.anmeldungen ?? 0}
      onClose={() => {}}
      onGeaendert={geaendert}
    />,
  );
  return geaendert;
}

describe('Verwalten (A4-Nachtrag)', () => {
  it('Auswahl: Verschieben nur für Gruppen-Admins, sonst gesperrt mit Grund; Freigabe zurück nur wenn freigegeben', () => {
    verwalten({ statusId: 2 });
    expect(screen.getByRole('button', { name: /In ein anderes Team/ })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByText(/Nur Gruppen-Admins/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Freigabe zurücknehmen/ })).toBeNull();
  });

  it('Umbenennen: unverändert gesperrt; danach Meldung mit Weg zurück zum alten Namen', async () => {
    m.umbenennen.mockResolvedValue();
    const geaendert = verwalten();
    fireEvent.click(screen.getByRole('button', { name: /Umbenennen/ }));
    expect(screen.getByRole('button', { name: 'Umbenennen' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Name der Veranstaltung'), {
      target: { value: 'Herbstessen' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Umbenennen' }));
    await waitFor(() => expect(geaendert).toHaveBeenCalled());
    expect(m.umbenennen).toHaveBeenCalledWith(91, 'Herbstessen');
    const [a, weg] = geaendert.mock.calls[0];
    expect(a.text).toBe('Umbenannt in „Herbstessen“.');
    expect(weg).toBe(false);
    await a.rueckgaengig!();
    expect(m.umbenennen).toHaveBeenLastCalledWith(91, 'Gemeindeessen');
  });

  it('Freigabe zurücknehmen: Warnung nennt die Anmeldungen; Rückgängig gibt wieder frei', async () => {
    m.setzeStatus.mockResolvedValue();
    const geaendert = verwalten({ anmeldungen: 12 });
    fireEvent.click(screen.getByRole('button', { name: /Freigabe zurücknehmen/ }));
    expect(screen.getByText(/Die 12 Anmeldungen bleiben erhalten/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Freigabe zurücknehmen' }));
    await waitFor(() => expect(geaendert).toHaveBeenCalled());
    expect(m.setzeStatus).toHaveBeenCalledWith(91, E.STATUS.entwurf);
    await geaendert.mock.calls[0][0].rueckgaengig!();
    expect(m.setzeStatus).toHaveBeenLastCalledWith(91, E.STATUS.freigegeben);
  });

  it('Löschen = ins Archiv: danach zur Übersicht; Rückgängig stellt den alten Status her', async () => {
    m.setzeStatus.mockResolvedValue();
    const geaendert = verwalten({ statusId: 1 });
    fireEvent.click(screen.getByRole('button', { name: /Löschen/ }));
    expect(screen.getByText(/Wiederherstellen kannst du sie jederzeit/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ins Archiv verschieben' }));
    await waitFor(() => expect(geaendert).toHaveBeenCalled());
    expect(m.setzeStatus).toHaveBeenCalledWith(91, E.STATUS.archiviert);
    const [a, weg] = geaendert.mock.calls[0];
    expect(weg).toBe(true);
    await a.rueckgaengig!();
    expect(m.setzeStatus).toHaveBeenLastCalledWith(91, 1);
  });

  it('Verschieben (Admin): in ein anderes Team, Rückgängig zurück ins alte', async () => {
    m.verschieben.mockResolvedValue();
    const geaendert = verwalten({ admin: true });
    fireEvent.click(screen.getByRole('button', { name: /In ein anderes Team/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Zu „Technik“ verschieben' }));
    await waitFor(() => expect(geaendert).toHaveBeenCalled());
    expect(m.verschieben).toHaveBeenCalledWith(91, 9, 7);
    await geaendert.mock.calls[0][0].rueckgaengig!();
    expect(m.verschieben).toHaveBeenLastCalledWith(91, 7, 9);
  });

  it('ChurchTools lehnt ab → Meldung im Fenster, keine Änderung gemeldet', async () => {
    m.setzeStatus.mockRejectedValue(new ApiError(403, 'Du darfst das nicht.'));
    const geaendert = verwalten();
    fireEvent.click(screen.getByRole('button', { name: /Löschen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ins Archiv verschieben' }));
    expect(await screen.findByText('Du darfst das nicht.')).toBeTruthy();
    expect(geaendert).not.toHaveBeenCalled();
  });
});

describe('Archiv (A4-Nachtrag)', () => {
  const ARCHIV = [{ id: 40, name: 'Lobpreisabend', team: 'Lobpreisteam', tag: '2026-11-02' }];

  it('Wiederherstellen → als Entwurf, mit Rückgängig (zurück ins Archiv)', async () => {
    m.archivListe.mockResolvedValue(ARCHIV);
    m.istGruppenAdmin.mockResolvedValue(false);
    m.setzeStatus.mockResolvedValue();
    const geaendert = vi.fn<(a: Aenderung) => void>();
    render(<ArchivSeite artId={5} onZurueck={() => {}} onGeaendert={geaendert} />);
    expect(await screen.findByText('Lobpreisteam · Mo, 02.11.2026')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Endgültig löschen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Wiederherstellen' }));
    await waitFor(() => expect(geaendert).toHaveBeenCalled());
    expect(m.setzeStatus).toHaveBeenCalledWith(40, E.STATUS.entwurf);
    await geaendert.mock.calls[0][0].rueckgaengig!();
    expect(m.setzeStatus).toHaveBeenLastCalledWith(40, E.STATUS.archiviert);
  });

  it('endgültig löschen (Admin): erst nach Eintippen des Namens, ohne Rückgängig', async () => {
    m.archivListe.mockResolvedValue(ARCHIV);
    m.istGruppenAdmin.mockResolvedValue(true);
    m.loeschenEndgueltig.mockResolvedValue();
    const geaendert = vi.fn<(a: Aenderung) => void>();
    render(<ArchivSeite artId={5} onZurueck={() => {}} onGeaendert={geaendert} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Endgültig löschen' }));
    const los = () => screen.getAllByRole('button', { name: 'Endgültig löschen' }).at(-1)!;
    expect(screen.getByText(/allen Anmeldungen/)).toBeTruthy();
    expect(los()).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Zum Bestätigen den Namen eintippen'), {
      target: { value: 'Lobpreis' },
    });
    expect(los()).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Zum Bestätigen den Namen eintippen'), {
      target: { value: 'Lobpreisabend' },
    });
    fireEvent.click(los());
    await waitFor(() => expect(geaendert).toHaveBeenCalled());
    expect(m.loeschenEndgueltig).toHaveBeenCalledWith(40);
    expect(geaendert.mock.calls[0][0]).toEqual({
      text: '„Lobpreisabend“ wurde endgültig gelöscht.',
      rueckgaengig: null,
    });
  });
});

describe('Leiste „Rückgängig“', () => {
  it('Rückgängig ausführen → „Rückgängig gemacht.“, Seite lädt neu', async () => {
    const zurueck = vi.fn().mockResolvedValue(undefined);
    const neuLaden = vi.fn();
    render(
      <RueckgaengigLeiste
        aenderung={{ text: 'Preise gespeichert.', rueckgaengig: zurueck }}
        onRueckgaengig={neuLaden}
        onSchliessen={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));
    expect(await screen.findByText('Rückgängig gemacht.')).toBeTruthy();
    expect(zurueck).toHaveBeenCalledTimes(1);
    expect(neuLaden).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull();
  });

  it('scheitert das Zurücknehmen → Meldung, der Knopf bleibt für einen zweiten Versuch', async () => {
    const zurueck = vi.fn().mockRejectedValue(new ApiError(502, 'x'));
    render(
      <RueckgaengigLeiste
        aenderung={{ text: 'Preise gespeichert.', rueckgaengig: zurueck }}
        onRueckgaengig={() => {}}
        onSchliessen={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));
    expect(await screen.findByText(/antwortet gerade nicht/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rückgängig' })).toHaveProperty('disabled', false);
  });

  it('nicht umkehrbar (endgültig gelöscht) → kein Knopf', () => {
    render(
      <RueckgaengigLeiste
        aenderung={{ text: 'gelöscht', rueckgaengig: null }}
        onRueckgaengig={() => {}}
        onSchliessen={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull();
  });
});
