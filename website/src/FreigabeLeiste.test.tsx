// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { SeitenStatus } from '@shared/website/status';
import { FreigabeBand, FreigabeLeiste } from './FreigabeLeiste';

const T = '2026-11-20T10:00:00.000Z';
const st = (zustand: SeitenStatus['zustand'], o: Partial<SeitenStatus> = {}): SeitenStatus => ({
  zustand,
  von: 5,
  name: 'Rita Redakteurin',
  zeit: T,
  ...o,
});

const leiste = (o: Partial<Parameters<typeof FreigabeLeiste>[0]> = {}) => {
  const onEinreichen = vi.fn();
  const onVeroeffentlichen = vi.fn();
  render(
    <FreigabeLeiste
      status={null}
      lage="nie"
      darfFreigeben={false}
      beschaeftigt={false}
      gesperrt={false}
      onEinreichen={onEinreichen}
      onVeroeffentlichen={onVeroeffentlichen}
      {...o}
    />,
  );
  return { onEinreichen, onVeroeffentlichen };
};

describe('FreigabeLeiste', () => {
  it('Redakteur: „Zur Prüfung einreichen“ – und KEIN Veröffentlichen (kein „Mehr“-Menü)', () => {
    const { onEinreichen } = leiste();
    fireEvent.click(screen.getByRole('button', { name: 'Zur Prüfung einreichen' }));
    expect(onEinreichen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Mehr' })).toBeNull();
  });

  it('Leitung: „Veröffentlichen“ im Mehr-Menü – und KEIN Einreichen', async () => {
    const { onVeroeffentlichen } = leiste({ darfFreigeben: true });
    expect(screen.queryByRole('button', { name: 'Zur Prüfung einreichen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mehr' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Veröffentlichen' }));
    expect(onVeroeffentlichen).toHaveBeenCalledTimes(1);
  });

  it('nicht gespeicherte Änderungen oder ein laufender Vorgang: Einreichen ist aus', () => {
    const { onEinreichen } = leiste({ gesperrt: true });
    const knopf = screen.getByRole('button', {
      name: 'Zur Prüfung einreichen',
    });
    expect(knopf).toHaveProperty('disabled', true);
    fireEvent.click(knopf);
    expect(onEinreichen).not.toHaveBeenCalled();
  });

  it('Leitung: bei nicht gespeicherten Änderungen ist „Veröffentlichen“ nicht wählbar', async () => {
    const { onVeroeffentlichen } = leiste({ darfFreigeben: true, beschaeftigt: true });
    fireEvent.click(screen.getByRole('button', { name: 'Mehr' }));
    const eintrag = await screen.findByRole('menuitem', { name: 'Veröffentlichen' });
    fireEvent.click(eintrag);
    expect(onVeroeffentlichen).not.toHaveBeenCalled();
  });

  it('Etikett je Lage, ein Status geht vor', () => {
    leiste({ lage: 'gleich' });
    expect(screen.getByText('Online')).toBeTruthy();
  });

  it('der Online-Stand ist unbekannt: kein Etikett, das etwas Falsches sagt', () => {
    leiste({ lage: null });
    expect(screen.queryByText('Online')).toBeNull();
    expect(screen.queryByText('Entwurf')).toBeNull();
  });
});

describe('FreigabeBand', () => {
  it('„Zurück“ zeigt die Anmerkung und wer sie geschrieben hat', () => {
    render(
      <FreigabeBand
        status={st('zurueck', { von: 1, name: 'Helene Wiebe', anmerkung: 'Foto tauschen.' })}
        darfFreigeben={false}
      />,
    );
    expect(screen.getByText(/Zurück von Helene Wiebe/)).toBeTruthy();
    expect(screen.getByText(/Foto tauschen\./)).toBeTruthy();
  });

  it('Löschen angefragt: der Leitung sagt es, was zu tun ist; dem Redakteur, dass es läuft', () => {
    const { rerender } = render(<FreigabeBand status={st('loeschenAngefragt')} darfFreigeben />);
    expect(screen.getByText(/Rita Redakteurin bittet darum/)).toBeTruthy();
    rerender(<FreigabeBand status={st('loeschenAngefragt')} darfFreigeben={false} />);
    expect(screen.getByText(/Du hast angefragt/)).toBeTruthy();
  });

  it('eingereicht oder ohne Status: kein Band', () => {
    const { container } = render(<FreigabeBand status={st('eingereicht')} darfFreigeben />);
    expect(container.textContent).toBe('');
  });
});
