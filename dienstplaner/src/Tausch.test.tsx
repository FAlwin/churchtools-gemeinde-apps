// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { TauschPort } from '@shared/dienstplan/tausch';
import { ALWIN, GESANG, nachbau, SPIKE } from '@shared/dienstplan/tausch.testutil';
import { useTausch } from './useTausch';
import { TauschAmDienst, TauschEingang, TauschGetauscht, type EigenerDienst } from './TauschTeile';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Spikes offener Gesang am 10.01. (Termin 166) – wie in der Messung vom 04.11.2026. */
const SPIKE_GESANG: EigenerDienst = {
  terminId: 166,
  termin: 'Messung',
  tag: '2027-01-10',
  dienst: 'Gesang',
  ort: { serviceId: GESANG, index: 1 },
};

/** Ein kleiner Rahmen: der Zustand wie in der App, darunter der eigene Dienst und der Eingang. */
function Rahmen({
  ich,
  port,
  onGeaendert,
}: {
  ich: number;
  port: TauschPort;
  onGeaendert: () => void;
}) {
  const t = useTausch(ich, 'Europe/Berlin', onGeaendert, port);
  return (
    <ul>
      {ich === SPIKE && <TauschAmDienst d={SPIKE_GESANG} tausch={t} zeitzone="Europe/Berlin" />}
      {t.getauscht.map((g) => (
        <TauschGetauscht key={g.id} text={g.text} />
      ))}
      {t.eingang.map((e) => (
        <TauschEingang key={e.id} e={e} tausch={t} zeitzone="Europe/Berlin" />
      ))}
    </ul>
  );
}

const zeige = (ich: number, port: TauschPort, onGeaendert = vi.fn()) => {
  const r = render(<Rahmen ich={ich} port={port} onGeaendert={onGeaendert} />);
  return { ...r, onGeaendert };
};

async function anfragenAlsSpike(port: TauschPort) {
  const r = zeige(SPIKE, port);
  fireEvent.click(await screen.findByRole('button', { name: /Tauschen/ }));
  fireEvent.click(await screen.findByRole('radio', { name: /Alwin/ }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Tausch anfragen' }));
    await Promise.resolve();
  });
  await screen.findByText('Tausch angefragt');
  return r;
}

describe('Tauschen am eigenen Dienst (E7-3)', () => {
  it('„Tauschen“ öffnet das Fenster mit den möglichen Partnern; „Tausch anfragen“ schickt und zeigt den Stand', async () => {
    const ct = nachbau();
    await anfragenAlsSpike(ct.port);
    expect(ct.aufrufe).toContain('POST anfragen 954→1026');
    expect(screen.getByText(/bei Alwin Friesen \(So, 15\.11\.\)/)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('„Tausch anfragen“ geht erst, wenn jemand gewählt ist', async () => {
    zeige(SPIKE, nachbau().port);
    fireEvent.click(await screen.findByRole('button', { name: /Tauschen/ }));
    await screen.findByRole('radio', { name: /Alwin/ });
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Tausch anfragen' }).disabled,
    ).toBe(true);
  });

  it('„Zurückziehen“ nimmt die offene Anfrage zurück – danach wieder „Tauschen“', async () => {
    const ct = nachbau();
    await anfragenAlsSpike(ct.port);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Zurückziehen' }));
      await Promise.resolve();
    });
    await screen.findByRole('button', { name: /Tauschen/ });
    expect(ct.anfragen[0].status).toBe('CANCELLED');
  });

  it('niemand zum Tauschen → das Fenster sagt es, ohne Knopf zum Anfragen', async () => {
    const ct = nachbau();
    ct.plaetze.splice(1, 1); // Alwins Gesang weg
    zeige(SPIKE, ct.port);
    fireEvent.click(await screen.findByRole('button', { name: /Tauschen/ }));
    expect(await screen.findByText(/Gerade hat niemand sonst „Gesang“/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tausch anfragen' })).toBeNull();
  });

  it('die Partner lassen sich gerade nicht lesen → Meldung statt leerer Liste', async () => {
    const ct = nachbau();
    ct.port.kandidaten = () => Promise.reject(new Error('503'));
    zeige(SPIKE, ct.port);
    fireEvent.click(await screen.findByRole('button', { name: /Tauschen/ }));
    expect(await screen.findByText(/antwortet gerade nicht/)).toBeTruthy();
  });

  it('der Stand lässt sich nicht laden → „Tauschen“ steht trotzdem da (der Kern prüft beim Schreiben selbst)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ct = nachbau();
    ct.port.eingang = () => Promise.reject(new Error('503'));
    zeige(SPIKE, ct.port);
    expect(await screen.findByRole('button', { name: /Tauschen/ })).toBeTruthy();
  });
});

describe('Tausch-Anfragen an mich (E7-3)', () => {
  it('stehen mit Text und „Annehmen“/„Ablehnen“ da; Annehmen tauscht und lädt die Termine neu', async () => {
    const ct = nachbau();
    await anfragenAlsSpike(ct.port);
    const { onGeaendert } = zeige(ALWIN, ct.port);
    expect(await screen.findByText('Tausch-Anfrage · Gesang')).toBeTruthy();
    expect(screen.getByText(/möchte tauschen: Du bekämst Gesang am/).textContent).toBe(
      'Spike Musiker möchte tauschen: Du bekämst Gesang am So, 10.01. und gibst deinen am So, 15.11. ab.',
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Annehmen' }));
      await Promise.resolve();
    });
    expect(await screen.findByText('Getauscht – du hast jetzt Gesang am So, 10.01.')).toBeTruthy();
    expect(onGeaendert).toHaveBeenCalled();
    expect(ct.plaetze.find((p) => p.eventId === 166)?.personId).toBe(ALWIN);
  });

  it('Ablehnen lässt alles, wie es war – die anfragende Person sieht „abgelehnt“ und kann andere fragen', async () => {
    const ct = nachbau();
    const spike = await anfragenAlsSpike(ct.port);
    spike.unmount();
    zeige(ALWIN, ct.port);
    // Erst finden, dann klicken: Ein `findBy…` innerhalb von `act` wartet auf ein Zeichnen, das `act` gerade zurückhält.
    const ablehnen = await screen.findByRole('button', { name: 'Ablehnen' });
    await act(async () => {
      fireEvent.click(ablehnen);
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.queryByText('Tausch-Anfrage · Gesang')).toBeNull());
    expect(ct.plaetze.find((p) => p.eventId === 166)?.personId).toBe(SPIKE);
    zeige(SPIKE, ct.port);
    expect(await screen.findByText('abgelehnt')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Andere fragen' })).toBeTruthy();
  });
});
