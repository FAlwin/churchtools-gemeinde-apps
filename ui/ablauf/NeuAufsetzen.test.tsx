// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { standAus, type AblaufBestand } from '@shared/ct/ablaufNeu';
import { NeuAufsetzen } from './NeuAufsetzen';

/**
 * „Neu aufsetzen“ (E6-5b, #691; Entwurf `e6-5b-entwurf.html`): Fenster → frischer Stand → Nachfrage → Schreiben. Die
 * Regeln (Vergleich, Nachlesen) prüft `shared/ct/ablaufNeu.test.ts`; hier, dass die Oberfläche den gezeigten Stand
 * weitergibt, die richtigen Worte findet und bei Fehlern neu lädt.
 */
afterEach(cleanup);

const VORLAGEN = {
  liste: [{ id: 28, name: 'Gottesdienst', kalenderId: 2, punkte: 5 }],
  laedt: false,
  fehler: false,
};
const VORSCHLAEGE = [
  { id: 142, titel: '19. Okt · Gottesdienst', meta: '7 Punkte' },
  { id: 171, titel: '26. Okt · Gottesdienst (2. Teil)', meta: '7 Punkte' },
];

const bestand = (over: Partial<AblaufBestand> = {}): AblaufBestand => ({
  punkte: [11, 12, 13],
  geaendert: '2026-10-23T10:00:00Z',
  verbunden: [],
  ...over,
});

function zeige(b: AblaufBestand, neuAufsetzen = vi.fn(() => Promise.resolve())) {
  const p = {
    bestandLesen: vi.fn(() => Promise.resolve(b)),
    neuAufsetzen,
    neuLaden: vi.fn(),
    onClose: vi.fn(),
  };
  render(
    <NeuAufsetzen
      fuer="Gottesdienst · So, 26.10.2026 · 10:00 Uhr"
      vorlagen={VORLAGEN}
      vorschlaege={VORSCHLAEGE}
      keineVorschlaege="keine"
      {...p}
    />,
  );
  return p;
}

async function weiter(): Promise<void> {
  // Warten, bis das erste Lesen durch ist (blendet verbundene Termine aus).
  await waitFor(() => expect(screen.getByRole('button', { name: 'Weiter' })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
}

describe('NeuAufsetzen', () => {
  it('dasselbe Fenster wie „Ablauf anlegen“ – mit eigenem Titel und „Weiter“', () => {
    zeige(bestand());
    expect(screen.getByText('Ablauf neu aufsetzen')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeTruthy();
  });

  it('Nachfrage nennt Zahl und Vorlage; „Ersetzen“ schreibt mit dem gezeigten Stand, dann neu laden und zu', async () => {
    const b = bestand();
    const p = zeige(b);
    await weiter();
    expect(await screen.findByText('Ablauf ersetzen?')).toBeTruthy();
    expect(
      screen.getByText(
        /Die 3 Punkte dieses Ablaufs werden durch die Vorlage „Gottesdienst“ ersetzt/,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Rückgängig geht danach nicht/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ersetzen' }));
    await waitFor(() => expect(p.onClose).toHaveBeenCalled());
    expect(p.neuAufsetzen).toHaveBeenCalledWith(
      { art: 'vorlage', vorlageId: 28 },
      standAus(b),
      false,
    );
    expect(p.neuLaden).toHaveBeenCalled();
  });

  it('leer: „Ablauf leeren?“ mit „Leeren“; ein einzelner Punkt in der Einzahl', async () => {
    zeige(bestand({ punkte: [11] }));
    await waitFor(() => screen.getByRole('button', { name: /^Leer/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Leer/ }));
    await weiter();
    expect(await screen.findByText('Ablauf leeren?')).toBeTruthy();
    expect(screen.getByText(/Der eine Punkt dieses Ablaufs wird entfernt/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Leeren' })).toBeTruthy();
  });

  it('Abbrechen in der Nachfrage schreibt nichts', async () => {
    const p = zeige(bestand());
    await weiter();
    await screen.findByText('Ablauf ersetzen?');
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(p.neuAufsetzen).not.toHaveBeenCalled();
    expect(p.onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Ablauf neu aufsetzen')).toBeTruthy();
  });

  it('leerer Ablauf: nichts geht verloren – ohne Nachfrage geschrieben', async () => {
    const b = bestand({ punkte: [] });
    const p = zeige(b);
    await weiter();
    await waitFor(() => expect(p.onClose).toHaveBeenCalled());
    expect(screen.queryByText('Ablauf ersetzen?')).toBeNull();
    expect(p.neuAufsetzen).toHaveBeenCalledWith(
      { art: 'vorlage', vorlageId: 28 },
      standAus(b),
      false,
    );
  });

  describe('geteilter Ablauf', () => {
    const geteilt = bestand({
      verbunden: [{ id: 171, name: 'Gottesdienst (2. Teil)', beginn: '2026-10-26T12:00' }],
    });

    it('nennt den anderen Termin; „Nur für diesen Termin neu“ schreibt mit `nurDieser`', async () => {
      const p = zeige(geteilt);
      await weiter();
      expect(await screen.findByText(/gilt auch für einen weiteren Termin/)).toBeTruthy();
      expect(screen.getByText('Mo, 26.10. · 12:00 · Gottesdienst (2. Teil)')).toBeTruthy();
      expect(screen.getByText(/Der andere Termin behält den bisherigen Ablauf/)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Nur für diesen Termin neu' }));
      await waitFor(() => expect(p.neuAufsetzen).toHaveBeenCalled());
      expect(p.neuAufsetzen).toHaveBeenCalledWith(expect.anything(), standAus(geteilt), true);
    });

    it('„Für beide ersetzen“ schreibt für alle (`nurDieser` false); bei mehreren heißt es „alle“', async () => {
      const p = zeige(geteilt);
      await weiter();
      fireEvent.click(await screen.findByRole('button', { name: 'Für beide ersetzen' }));
      await waitFor(() =>
        expect(p.neuAufsetzen).toHaveBeenCalledWith(expect.anything(), standAus(geteilt), false),
      );
      cleanup();

      zeige(
        bestand({
          verbunden: [
            { id: 171, name: 'A', beginn: '2026-10-26T12:00' },
            { id: 172, name: null, beginn: null },
          ],
        }),
      );
      await weiter();
      expect(await screen.findByRole('button', { name: 'Für alle ersetzen' })).toBeTruthy();
      expect(screen.getByText(/2 weitere Termine/)).toBeTruthy();
      expect(screen.getByText('Ein weiterer Termin (für dich nicht sichtbar)')).toBeTruthy();
    });

    it('verbundene Termine stehen nicht unter „Wie eine frühere“ – eine Kopie aus sich selbst wäre keine', async () => {
      zeige(geteilt);
      fireEvent.click(screen.getByRole('button', { name: /Wie eine frühere/ }));
      await waitFor(() =>
        expect(screen.queryByText('26. Okt · Gottesdienst (2. Teil)')).toBeNull(),
      );
      expect(screen.getByText('19. Okt · Gottesdienst')).toBeTruthy();
    });
  });

  it('Fehler beim Schreiben: Meldung statt Nachfrage, trotzdem neu laden (es kann sich etwas geändert haben)', async () => {
    const fehler = Object.assign(new Error('Der Ablauf wurde eben woanders geändert.'), {
      status: 412,
    });
    const p = zeige(
      bestand(),
      vi.fn(() => Promise.reject(fehler)),
    );
    await weiter();
    fireEvent.click(await screen.findByRole('button', { name: 'Ersetzen' }));
    expect(await screen.findByText('Nicht neu aufgesetzt')).toBeTruthy();
    expect(screen.getByText('Der Ablauf wurde eben woanders geändert.')).toBeTruthy();
    expect(p.neuLaden).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Abbrechen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(p.onClose).toHaveBeenCalled();
  });

  it('der Stand wird bei „Weiter“ frisch gelesen – nicht der vom Öffnen weitergegeben', async () => {
    const p = zeige(bestand());
    const spaeter = bestand({ punkte: [11, 12, 13, 14] });
    await waitFor(() => expect(p.bestandLesen).toHaveBeenCalledTimes(1));
    p.bestandLesen.mockResolvedValueOnce(spaeter);
    await weiter();
    expect(await screen.findByText(/Die 4 Punkte/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ersetzen' }));
    await waitFor(() =>
      expect(p.neuAufsetzen).toHaveBeenCalledWith(expect.anything(), standAus(spaeter), false),
    );
  });
});
