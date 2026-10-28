// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Kennzahlen, SchrittLeiste } from './Einstieg';
import { naechsterSchritt, schritteBisZurFreigabe, type Schritt } from './schritte';
import type { MitgliederZustand } from './AnmeldungenReiter';
import { dazu, e, mitglieder, stand, STICHTAG } from '@shared/anmeldung/liste.testdaten';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';

/**
 * Einstieg einer Veranstaltung (U1, Variante D): vor der Freigabe die Schritte, danach die Kennzahlen. Gezählt wird mit
 * `listenZahlen` (dort getestet) – hier, was man sieht, was hervorgehoben ist und wohin ein Klick führt.
 */
afterEach(cleanup);

const ZONE = 'Europe/Berlin';
const HEUTE = '2026-10-19';

describe('Schritte bis zur Freigabe', () => {
  const ohneTermin = () => ({ ...neueEinstellungen('einfach'), termin: null });
  const mitTermin = () => ({
    ...neueEinstellungen('einfach'),
    termin: { beginn: '2026-11-15T10:00', ende: null, ort: '', terminId: 1 },
  });

  it('ohne Termin und Beginn: der Termin ist dran; das Formular gilt als fertig, Freigeben nie', () => {
    const s = schritteBisZurFreigabe(ohneTermin(), { ab: null }, ZONE);
    expect(s.map((x) => [x.id, x.fertig])).toContainEqual(['formular', true]);
    expect(s.at(-1)).toMatchObject({ id: 'freigeben', fertig: false });
    expect(naechsterSchritt(s).id).toBe('termin');
  });

  it('Termin und Beginn da, kostet nichts → als Nächstes „Freigeben“; Bezahlung kommt nicht vor', () => {
    const s = schritteBisZurFreigabe(mitTermin(), { ab: '2026-10-01T22:00:00Z' }, ZONE);
    expect(s.map((x) => x.id)).not.toContain('bezahlung');
    expect(s.find((x) => x.id === 'anmeldung')?.text).toMatch(/ab .*02\.10\.2026/);
    expect(naechsterSchritt(s).id).toBe('freigeben');
  });

  it('kostet etwas, aber keine Bankverbindung → „Bezahlung“ ist dran', () => {
    const x = mitTermin();
    x.preis = { ...x.preis, grundpreis: { ...x.preis.grundpreis, betragCent: 1000 } };
    x.bezahlung = { ...x.bezahlung, iban: '' };
    const s = schritteBisZurFreigabe(x, { ab: '2026-10-01T22:00:00Z' }, ZONE);
    expect(naechsterSchritt(s)).toMatchObject({ id: 'bezahlung', text: 'Bankverbindung fehlt' });
  });

  it('Leiste: der nächste Schritt mit Satz und Knopf; ohne Recht nur die Leiste', () => {
    const s: Schritt[] = schritteBisZurFreigabe(ohneTermin(), { ab: null }, ZONE);
    const onSchritt = vi.fn();
    render(<SchrittLeiste schritte={s} darf onSchritt={onSchritt} />);
    expect(screen.getByText(/Wähl einen Termin/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Termin wählen' }));
    expect(onSchritt).toHaveBeenCalledWith('termin');
    cleanup();
    render(<SchrittLeiste schritte={s} darf={false} onSchritt={onSchritt} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Termin')).toBeTruthy();
  });
});

describe('Kennzahlen nach der Freigabe', () => {
  const fertig = (roh = mitglieder('AAAAAA', [true, false], 10)): MitgliederZustand => ({
    art: 'fertig',
    stand: { ...stand(roh, [dazu(10, '2026-10-17')]), verlaufGekuerzt: false },
  });
  const zeigen = (
    zustand: MitgliederZustand | null,
    max: number | null = 10,
    schluss: string | null = null,
    onAnmeldung?: () => void,
  ) => {
    const onAnsicht = vi.fn();
    render(
      <Kennzahlen
        einstellungen={e()}
        zustand={zustand}
        stichtag={STICHTAG}
        maxPlaetze={max}
        anmeldeschluss={schluss}
        heute={HEUTE}
        zeitzone={ZONE}
        onAnsicht={onAnsicht}
        onAnmeldung={onAnmeldung}
      />,
    );
    return onAnsicht;
  };
  const kachel = (titel: string) => screen.getByText(titel).closest('button, div')!;

  it('Plätze, Warteliste, Zahlung offen – wie in der Liste gezählt', () => {
    zeigen(fertig());
    expect(screen.getByText('1 von 10')).toBeTruthy();
    expect(screen.getByText('1 Anmeldung')).toBeTruthy();
    expect(kachel('Zahlung offen').textContent).toMatch(/6,00 €/);
  });

  it('wartet jemand trotz freiem Platz → Warteliste hervorgehoben; voll oder niemand wartet → nicht', () => {
    zeigen(fertig());
    expect(kachel('Warteliste').textContent).toMatch(/9 Plätze frei – nachrücken lassen/);
    expect(kachel('Warteliste').className).toMatch(/hervor/);
    expect(kachel('Zahlung offen').className).not.toMatch(/hervor/);
    cleanup();
    zeigen(fertig(), 1);
    expect(kachel('Warteliste').textContent).toMatch(/kein Platz frei/);
    expect(kachel('Warteliste').className).not.toMatch(/hervor/);
    cleanup();
    zeigen(fertig(mitglieder('AAAAAA', [true, true], 10)));
    expect(kachel('Warteliste').className).not.toMatch(/hervor/);
  });

  it('Klick führt in die passende Ansicht der Liste', () => {
    const onAnsicht = zeigen(fertig());
    fireEvent.click(kachel('Warteliste'));
    fireEvent.click(kachel('Zahlung offen'));
    fireEvent.click(kachel('Plätze'));
    expect(onAnsicht.mock.calls.map((c) => c[0])).toEqual(['warte', 'offen', 'alle']);
  });

  it('Anmeldeschluss: keiner / Tag mit Restzeit / vorbei; Fenster nur, wenn man es öffnen darf', () => {
    zeigen(fertig(), 10, null);
    expect(kachel('Anmeldeschluss').textContent).toMatch(/keiner/);
    expect(kachel('Anmeldeschluss').tagName).toBe('DIV');
    cleanup();
    const onAnmeldung = vi.fn();
    zeigen(fertig(), 10, '2026-10-22T21:59:00Z', onAnmeldung);
    expect(kachel('Anmeldeschluss').textContent).toMatch(/22\.10\.2026.*noch 3 Tage/);
    fireEvent.click(kachel('Anmeldeschluss'));
    expect(onAnmeldung).toHaveBeenCalled();
    cleanup();
    zeigen(fertig(), 10, '2026-10-10T21:59:00Z');
    expect(kachel('Anmeldeschluss').textContent).toMatch(/vorbei/);
  });

  it('Mitglieder nicht lesbar → keine Kennzahlen; noch nicht geladen → Platzhalter; Fehler → ohne „Wird geladen“', () => {
    zeigen({ art: 'verboten' });
    expect(screen.queryByRole('region', { name: 'Kennzahlen' })).toBeNull();
    cleanup();
    zeigen({ art: 'laedt' });
    expect(kachel('Plätze').textContent).toMatch(/–.*Wird geladen/);
    cleanup();
    // Laden gescheitert: der Fehler steht bei der Liste – hier nicht ewig „Wird geladen …“.
    zeigen({ art: 'fehler', text: 'ChurchTools-Fehler 502' });
    expect(kachel('Plätze').textContent).not.toMatch(/Wird geladen/);
  });
});
