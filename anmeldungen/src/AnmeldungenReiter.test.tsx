// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AnmeldungenReiter, type MitgliederZustand } from './AnmeldungenReiter';
import * as Z from './zahlung';
import { STICHTAG, absage, dazu, e, mitglieder, stand } from '@shared/anmeldung/liste.testdaten';

vi.mock('./zahlung', () => ({
  zahlungSpeichern: vi.fn().mockResolvedValue(undefined),
  betragAendern: vi.fn().mockResolvedValue(undefined),
  betragWiederherstellen: vi.fn().mockResolvedValue(undefined),
}));
const zm = vi.mocked(Z);

/**
 * Reiter „Anmeldungen“ (A7-1, Zahlung A7-2). Die Daten kommen aus dem, was das Formular schreibt (`liste.testdaten.ts`); gerechnet
 * wird in `shared/anmeldung/liste.ts` (dort getestet) – hier nur, was man sieht und anklickt.
 */
function zeigen(
  zustand: MitgliederZustand | null,
  max: number | null = 10,
  entwurf = false,
  darf = true,
) {
  const onNeuLaden = vi.fn();
  const onGeaendert = vi.fn();
  render(
    <AnmeldungenReiter
      id={165}
      e={e()}
      maxPlaetze={max}
      entwurf={entwurf}
      zustand={zustand}
      stichtag={STICHTAG}
      heute="2026-10-19"
      darf={darf}
      zahlarten={['Überweisung', 'Bar']}
      onNeuLaden={onNeuLaden}
      onGeaendert={onGeaendert}
    />,
  );
  return Object.assign(onNeuLaden, { onGeaendert });
}
const fertig = (
  roh = mitglieder('AAAAAA', [true, false], 10),
  verlauf = [dazu(10, '2026-10-17')],
) => ({ art: 'fertig', stand: { ...stand(roh, verlauf), verlaufGekuerzt: false } }) as const;

describe('Reiter Anmeldungen', () => {
  it('Zahlen, Hinweis „frei, aber jemand wartet“, eine Zeile je Anmeldung', () => {
    zeigen(fertig());
    expect(screen.getByText('1 von 10')).toBeTruthy();
    expect(screen.getByText(/9 Plätze frei – 1 wartet\./)).toBeTruthy();
    expect(screen.getByText(/Als Nächste wartet Lena Beispiel \(seit 17\.10\.\)/)).toBeTruthy();
    const zeile = screen.getByRole('button', { name: /Maria Beispiel/ });
    expect(zeile.textContent).toMatch(/AAAAAA.*Jonas 9.*Lena 7.*Warteliste 1.*6,00 €.*offen/);
  });

  it('kein Hinweis, wenn niemand wartet oder alles voll ist', () => {
    zeigen(fertig(mitglieder('AAAAAA', [true, true], 10)));
    expect(screen.queryByText(/warten?\./)).toBeNull();
    cleanup();
    // Voll (1 von 1), eine wartet – ChurchTools hat recht, niemand kann nachrücken.
    zeigen(fertig(), 1);
    expect(screen.getByText('kein Platz frei')).toBeTruthy();
    expect(screen.queryByText(/Als Nächste wartet/)).toBeNull();
  });

  it('Klick öffnet das Fenster: einmal oben mit Unterschrift, je Person die Antworten', () => {
    zeigen(fertig());
    fireEvent.click(screen.getByRole('button', { name: /Maria Beispiel/ }));
    expect(screen.getByText('Für die ganze Anmeldung · gilt für Jonas, Lena')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Unterschrift' })).toBeTruthy();
    expect(screen.getByText('✓ Maria Beispiel, 17.10.2026')).toBeTruthy();
    expect(screen.getByText('Jonas Beispiel, 9')).toBeTruthy();
    expect(screen.getByText('Nüsse')).toBeTruthy();
    expect(screen.getAllByText('Warteliste 1').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByText(/Für die ganze Anmeldung/)).toBeNull();
  });

  it('Filter Warteliste, Abgesagt und Suche', () => {
    const [jonas, lena] = mitglieder('AAAAAA', [true, false], 10);
    zeigen(fertig([lena], [absage(jonas, '2026-10-18', 10)]));
    fireEvent.click(screen.getByRole('button', { name: /^Warteliste/ }));
    expect(screen.getByRole('button', { name: /1 · Lena Beispiel/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Abgesagt/ }));
    const ab = screen.getByText('Jonas Beispiel').closest('li')!;
    expect(within(ab).getByText(/am 18\.10\. selbst abgesagt/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Alle/ }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Name suchen' }), {
      target: { value: 'xyz' },
    });
    expect(screen.getByText('Niemand mit „xyz“ gefunden.')).toBeTruthy();
  });

  it('Entwurf, ohne Recht, Fehler mit „Nochmal“', () => {
    zeigen(null, 10, true);
    expect(screen.getByText('Noch keine Anmeldungen.')).toBeTruthy();
    cleanup();
    zeigen({ art: 'verboten' });
    expect(screen.getByText(/Mitglieder dieser Gruppe sehen darf/)).toBeTruthy();
    cleanup();
    const neu = zeigen({ art: 'fehler', text: 'ChurchTools antwortet gerade nicht.' });
    fireEvent.click(screen.getByRole('button', { name: 'Nochmal' }));
    expect(neu).toHaveBeenCalled();
  });
});

describe('Zahlung im Fenster (A7-2)', () => {
  const oeffnen = () => fireEvent.click(screen.getByRole('button', { name: /Maria Beispiel/ }));

  it('als bezahlt markieren: Zahlart wählen, bei der ersten Person, mit „Rückgängig“', async () => {
    const z = zeigen(fertig(mitglieder('AAAAAA', [true, true], 10)));
    oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Bar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Als bezahlt markieren' }));
    await waitFor(() => expect(z.onGeaendert).toHaveBeenCalled());
    expect(zm.zahlungSpeichern).toHaveBeenCalledWith(165, 10, {
      bezahlt: true,
      am: '2026-10-19',
      zahlart: 'Bar',
    });
    const aenderung = z.onGeaendert.mock.calls[0][0];
    expect(aenderung.text).toBe('Maria Beispiel: als bezahlt markiert (Bar).');
    await aenderung.rueckgaengig();
    expect(zm.zahlungSpeichern).toHaveBeenLastCalledWith(165, 10, {
      bezahlt: false,
      am: null,
      zahlart: null,
    });
  });

  it('bezahlt → Anzeige mit Zahlart, „Zurücksetzen“; in der Liste „✓ Bar“', async () => {
    const z = zeigen(fertig(mitglieder('AAAAAA', [true, true], 10, { bezahlt: true })));
    expect(screen.getByRole('button', { name: /Maria Beispiel/ }).textContent).toMatch(
      /✓ Bar 18\.10\./,
    );
    oeffnen();
    expect(screen.getByText('✓ bezahlt am 18.10.2026 · Bar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }));
    await waitFor(() => expect(z.onGeaendert).toHaveBeenCalled());
    expect(zm.zahlungSpeichern).toHaveBeenCalledWith(165, 10, {
      bezahlt: false,
      am: null,
      zahlart: null,
    });
  });

  it('Betrag ändern: nur ein gültiger, anderer Betrag; Rückgängig schreibt den alten zurück', async () => {
    const z = zeigen(fertig(mitglieder('AAAAAA', [true, true], 10)));
    oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Betrag ändern' }));
    const feld = screen.getByLabelText('Neuer Betrag');
    const speichern = () => screen.getByRole('button', { name: 'Speichern' });
    expect(speichern()).toHaveProperty('disabled', true);
    fireEvent.change(feld, { target: { value: 'zehn' } });
    expect(screen.getByText(/Bitte einen Betrag/)).toBeTruthy();
    fireEvent.change(feld, { target: { value: '10' } });
    fireEvent.click(speichern());
    await waitFor(() => expect(z.onGeaendert).toHaveBeenCalled());
    expect(zm.betragAendern).toHaveBeenCalledWith(
      165,
      10,
      1000,
      expect.stringMatching(/Gesamt: 12,00 €$/),
      '2026-10-19',
    );
    await z.onGeaendert.mock.calls[0][0].rueckgaengig();
    expect(zm.betragWiederherstellen).toHaveBeenCalledWith(165, 10, {
      betrag: '12,00 €',
      aufschluesselung: expect.stringMatching(/Gesamt: 12,00 €$/),
    });
  });

  it('ohne Recht nur Anzeige; erste Person abgesagt → nichts zum Klicken', () => {
    zeigen(fertig(mitglieder('AAAAAA', [true, true], 10)), 10, false, false);
    oeffnen();
    expect(screen.getByText('Noch nicht bezahlt.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Als bezahlt markieren' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Betrag ändern' })).toBeNull();
    cleanup();
    const [jonas, lena] = mitglieder('AAAAAA', [true, true], 10);
    zeigen(fertig([lena], [absage(jonas, '2026-10-18', 10)]));
    oeffnen();
    expect(screen.getByText(/hat abgesagt. Anpassen geht mit dem nächsten Schritt/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Betrag ändern' })).toBeNull();
  });
});
