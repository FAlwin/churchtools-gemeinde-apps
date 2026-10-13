// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { einstellungenAlsText, type OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import {
  aufmerksamkeit,
  einteilen,
  veranstaltungAus,
  type Belegung,
  type Veranstaltung,
  type VeranstaltungRoh,
} from '@shared/anmeldung/uebersicht';
import type { MeineGruppe } from '@shared/ct/gruppen';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import { Startseite } from './Startseite';
import type { Start } from './start';
import type { Uebersicht } from './veranstaltungen';

/**
 * Die Startseite (A2, #480). Die Übersicht entsteht mit denselben Regeln wie im Betrieb
 * (`veranstaltungAus`, `einteilen`, `aufmerksamkeit`) – nicht als handgeschriebenes Ergebnis.
 */
const HEUTE = '2026-10-12';
const JETZT = new Date('2026-10-12T10:00:00Z');

function beschreibung(beginn: string, betragCent = 0, bezahlt?: number): string {
  const e: OeffentlicheEinstellungen = {
    ...neueEinstellungen('einfach'),
    termin: { beginn, ende: null, ort: 'Gemeindesaal', terminId: null },
    preis: {
      ...neueEinstellungen('einfach').preis,
      grundpreis: { art: 'fest', betragCent, gilt: 'person', auswahlName: '', optionen: [] },
    },
    ctFelder: bezahlt ? { bezahlt } : {},
  };
  return einstellungenAlsText(e);
}

function v(
  roh: Omit<VeranstaltungRoh, 'beschreibung'> & { beginn: string; betragCent?: number },
  belegung: Belegung | null,
  max = 20,
): Veranstaltung {
  const x = veranstaltungAus(
    { ...roh, beschreibung: beschreibung(roh.beginn, roh.betragCent, 73) },
    {
      maxPlaetze: max,
      anmeldungAb: '2026-10-01T00:00:00Z',
      anmeldungBis: '2026-10-30T22:00:00Z',
      warteliste: true,
    },
    belegung,
    HEUTE,
    JETZT,
  );
  if (!x) throw new Error('keine Veranstaltung');
  return x;
}

const GRUPPEN: MeineGruppe[] = [
  { id: 9, name: 'Lobpreisteam', leitung: true },
  { id: 7, name: 'Technik', leitung: false },
];
const START: Start = { vorname: 'Alwin', gemeinde: 'ECG', gruppen: GRUPPEN };

function uebersicht(
  verborgen = new Map([
    [9, 0],
    [7, 0],
  ]),
): Uebersicht {
  const liste = [
    v(
      { id: 40, name: 'Lobpreisabend', gruppeId: 9, statusId: 1, beginn: '2026-11-01T19:00' },
      { aktiv: 5, wartend: 2, unbezahlt: null },
      6,
    ),
    v(
      {
        id: 46,
        name: 'Freizeit',
        gruppeId: 9,
        statusId: 1,
        beginn: '2026-11-20T18:00',
        betragCent: 6552,
      },
      { aktiv: 4, wartend: 0, unbezahlt: 3 },
    ),
    v({ id: 43, name: 'Workshop', gruppeId: 9, statusId: 2, beginn: '2026-12-05T10:00' }, null),
    v(
      {
        id: 52,
        name: 'Grundkurs',
        gruppeId: 7,
        statusId: 1,
        beginn: '2026-11-14T09:30',
        betragCent: 1200,
      },
      { aktiv: 2, wartend: 0, unbezahlt: 2 },
      12,
    ),
    v({ id: 49, name: 'Schulung', gruppeId: 7, statusId: 1, beginn: '2026-09-19T10:00' }, null),
  ];
  return {
    einteilung: einteilen(liste),
    hinweise: aufmerksamkeit(liste, [], new Set([9])),
    offen: new Map([
      [9, 3],
      [7, 1],
    ]),
    verborgen,
  };
}

function zeigen(u = uebersicht()) {
  const oeffnen = vi.fn();
  render(
    <Startseite
      start={START}
      uebersicht={u}
      heute={HEUTE}
      zeitzone="Europe/Berlin"
      onOeffnen={oeffnen}
    />,
  );
  return oeffnen;
}

const abschnitt = (name: string) => screen.getByRole('region', { name });

describe('Startseite (A2, #480)', () => {
  it('„Braucht deine Aufmerksamkeit“: nachrücken, Zahlungen (nur Leitung), Freigabe', () => {
    zeigen();
    const texte = within(abschnitt('Braucht deine Aufmerksamkeit'))
      .getAllByText(/frei$|offen$|wartet auf Freigabe$/)
      .map((e) => e.textContent);
    // Grundkurs (Technik, nicht Leitung) hat auch offene Zahlungen – erscheint aber nicht.
    expect(texte).toEqual([
      'Lobpreisabend: 1 Platz frei',
      'Freizeit: 3 Zahlungen offen',
      'Workshop wartet auf Freigabe',
    ]);
  });

  it('Anstehend mit Monatsüberschriften; Zähler an den Reitern; Entwürfe und Vorbei auf Klick', () => {
    zeigen();
    const liste = abschnitt('Veranstaltungen');
    expect(within(liste).getByRole('button', { name: /Anstehend\s*3/ })).toBeTruthy();
    expect(within(liste).getByText('November 2026')).toBeTruthy();
    expect(
      within(liste)
        .getAllByText(/^(Lobpreisabend|Grundkurs|Freizeit)$/)
        .map((e) => e.textContent),
    ).toEqual(['Lobpreisabend', 'Grundkurs', 'Freizeit']);
    fireEvent.click(within(liste).getByRole('button', { name: /Entwürfe/ }));
    expect(within(liste).getByText('Workshop')).toBeTruthy();
    expect(within(liste).queryByText('Lobpreisabend')).toBeNull();
    fireEvent.click(within(liste).getByRole('button', { name: /Vorbei/ }));
    expect(within(liste).getByText('Schulung')).toBeTruthy();
  });

  it('eine Zeile: Datum · Gruppe · Preis, Stand, Anmeldeschluss, Belegung', () => {
    zeigen();
    const liste = abschnitt('Veranstaltungen');
    expect(within(liste).getByText('Sa, 14.11.2026 · Technik · 12,00 € p. P.')).toBeTruthy();
    expect(within(liste).getAllByText('Anmeldung offen').length).toBeGreaterThan(0);
    expect(
      within(liste).getAllByText('Anmeldeschluss 30.10. (noch 18 Tage)').length,
    ).toBeGreaterThan(0);
    expect(within(liste).getByText('2 auf der Warteliste')).toBeTruthy();
  });

  it('Gruppen-Filter blendet die Veranstaltungen einer Gruppe aus und wieder ein', () => {
    zeigen();
    const liste = abschnitt('Veranstaltungen');
    const technik = within(liste).getByRole('button', { name: 'Technik' });
    fireEvent.click(technik);
    expect(technik.getAttribute('aria-pressed')).toBe('false');
    expect(within(liste).queryByText('Grundkurs')).toBeNull();
    fireEvent.click(technik);
    expect(within(liste).getByText('Grundkurs')).toBeTruthy();
  });

  it('„Deine Gruppen“: Anzahl, Rolle und „nicht freigegeben“, wenn es Verborgenes gibt', () => {
    zeigen(
      uebersicht(
        new Map([
          [9, 0],
          [7, 2],
        ]),
      ),
    );
    const zeilen = within(abschnitt('Deine Gruppen'))
      .getAllByRole('listitem')
      .map((z) => z.textContent);
    expect(zeilen).toEqual([
      'Lobpreisteam3 VeranstaltungenLeitung',
      'Technik1 Veranstaltung · Untergruppen für dich nicht freigegebenMitglied',
    ]);
  });

  it('ein Klick auf den Namen öffnet die Veranstaltung; „Ansehen“ beim Entwurf ebenso (A3)', () => {
    const oeffnen = zeigen();
    fireEvent.click(
      within(abschnitt('Veranstaltungen')).getByRole('button', { name: 'Grundkurs' }),
    );
    expect(oeffnen).toHaveBeenLastCalledWith(52);
    fireEvent.click(
      within(abschnitt('Braucht deine Aufmerksamkeit')).getByRole('button', { name: 'Ansehen' }),
    );
    expect(oeffnen).toHaveBeenLastCalledWith(43);
  });

  it('jede Veranstaltung führt zu ihrer Gruppe in ChurchTools', () => {
    zeigen();
    const link = within(abschnitt('Veranstaltungen')).getByRole('link', {
      name: 'Lobpreisabend in ChurchTools öffnen',
    });
    expect(link.getAttribute('href')).toMatch(/\/groups\/40$/);
  });
});

describe('Freigabe-Hinweis für Admins (A5, aus der A3-Abnahme)', () => {
  // Ein Entwurf in einem Team, in dem man keine Leitung ist.
  const technikEntwurf = (): Uebersicht => {
    const liste = [
      v(
        { id: 61, name: 'Gemeindecamp', gruppeId: 7, statusId: 2, beginn: '2027-06-01T10:00' },
        null,
      ),
    ];
    return {
      einteilung: einteilen(liste),
      hinweise: aufmerksamkeit(liste, [], new Set([9])),
      offen: new Map(),
      verborgen: new Map(),
    };
  };

  it('ohne Admin-Recht: „Freigeben kann die Leitung der Gruppe.“', () => {
    zeigen(technikEntwurf());
    expect(screen.getByText('Technik · Freigeben kann die Leitung der Gruppe.')).toBeTruthy();
  });

  it('als Admin: „Freigeben kannst du als Admin.“', () => {
    render(
      <Startseite
        start={START}
        uebersicht={technikEntwurf()}
        heute={HEUTE}
        zeitzone="Europe/Berlin"
        onOeffnen={() => {}}
        admin
      />,
    );
    expect(screen.getByText('Technik · Freigeben kannst du als Admin.')).toBeTruthy();
  });
});
