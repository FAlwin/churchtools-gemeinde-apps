// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import * as E from './einrichten';
import * as A from './archiv';
import * as AB from './ablaeufe';
import type { Aenderung } from './Rueckgaengig';
import type { Start } from './start';
import type { Uebersicht } from './veranstaltungen';

/**
 * Die Startseite (A2, #480). Die Übersicht entsteht mit denselben Regeln wie im Betrieb
 * (`veranstaltungAus`, `einteilen`, `aufmerksamkeit`) – nicht als handgeschriebenes Ergebnis.
 */
vi.mock('./einrichten', async (original) => ({
  ...(await original<typeof import('./einrichten')>()),
  loeschenEndgueltig: vi.fn(),
  einstellungenVon: vi.fn(),
  anmeldungenIn: vi.fn(),
}));
vi.mock('./archiv', () => ({ insArchiv: vi.fn() }));
vi.mock('./ablaeufe', async (original) => ({
  ...(await original<typeof import('./ablaeufe')>()),
  ablaeufeNachholen: vi.fn(),
}));
const ei = vi.mocked(E);
const ar = vi.mocked(A);
const ab = vi.mocked(AB);

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
  max: number | null = 20,
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

  it('nachrücken ohne Platzgrenze: „Plätze frei“ ohne Zahl; gezählt werden wartende Personen', () => {
    const liste = [
      v(
        { id: 61, name: 'Gemeindeabend', gruppeId: 9, statusId: 1, beginn: '2026-11-08T19:00' },
        { aktiv: 40, wartend: 1, unbezahlt: null },
        null,
      ),
      v(
        { id: 40, name: 'Lobpreisabend', gruppeId: 9, statusId: 1, beginn: '2026-11-01T19:00' },
        { aktiv: 5, wartend: 2, unbezahlt: null },
        6,
      ),
    ];
    zeigen({
      einteilung: einteilen(liste),
      hinweise: aufmerksamkeit(liste, [], new Set([9])),
      offen: new Map([[9, 0]]),
      verborgen: new Map([[9, 0]]),
    });
    const bereich = within(abschnitt('Braucht deine Aufmerksamkeit'));
    expect(bereich.getAllByText(/frei$/).map((e) => e.textContent)).toEqual([
      'Lobpreisabend: 1 Platz frei',
      'Gemeindeabend: Plätze frei',
    ]);
    expect(bereich.getByText('1 Person wartet auf der Warteliste. Wer rückt nach?')).toBeTruthy();
    expect(bereich.getByText('2 Personen warten auf der Warteliste. Wer rückt nach?')).toBeTruthy();
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

describe('Abgelaufen: endgültig löschen (A9-4, D3/D4/D6–D8)', () => {
  /** Sommerfest am 01.06.2026 → Löschdatum 01.09.2026; ChurchTools hat schon alle entfernt. */
  function mitSommerfest(gruppeId: number, loeschbar: number[], admin = false) {
    const x = v(
      { id: 55, name: 'Sommerfest', gruppeId, statusId: 1, beginn: '2026-06-01T10:00' },
      { aktiv: 0, wartend: 0, unbezahlt: null },
    );
    const geaendert = vi.fn<(a: Aenderung) => void>();
    render(
      <Startseite
        start={START}
        uebersicht={{
          einteilung: einteilen([x]),
          hinweise: aufmerksamkeit([x], [], new Set([9]), HEUTE, new Set(loeschbar)),
          offen: new Map(),
          verborgen: new Map(),
        }}
        heute={HEUTE}
        zeitzone="Europe/Berlin"
        onOeffnen={() => {}}
        admin={admin}
        onGeaendert={geaendert}
      />,
    );
    return geaendert;
  }
  const bereich = () => within(abschnitt('Braucht deine Aufmerksamkeit'));

  it('wer darf (Probelauf): „Endgültig löschen“ mit Namen eintippen, danach gemeldet – ohne Rückgängig', async () => {
    ei.loeschenEndgueltig.mockResolvedValue();
    const geaendert = mitSommerfest(9, [55]);
    expect(bereich().getByText('Sommerfest: Anmeldungen gelöscht')).toBeTruthy();
    expect(
      bereich().getByText(/Seit dem Di, 01\.09\.2026 – die Antworten stehen aber noch im Verlauf/),
    ).toBeTruthy();
    fireEvent.click(bereich().getByRole('button', { name: 'Endgültig löschen' }));
    const fenster = screen.getByRole('dialog', { name: 'Endgültig löschen?' });
    expect(within(fenster).getByText(/Verlauf mit allen Antworten/)).toBeTruthy();
    const los = within(fenster).getByRole<HTMLButtonElement>('button', {
      name: 'Endgültig löschen',
    });
    expect(los.disabled).toBe(true);
    fireEvent.change(within(fenster).getByRole('textbox'), { target: { value: 'Sommerfest' } });
    fireEvent.click(los);
    await waitFor(() => expect(geaendert).toHaveBeenCalled());
    expect(ei.loeschenEndgueltig).toHaveBeenCalledWith(55);
    expect(geaendert.mock.calls[0][0]).toEqual({
      text: '„Sommerfest“ wurde endgültig gelöscht.',
      rueckgaengig: null,
    });
  });

  it('D8: Leitung ohne Löschrecht → „Ins Archiv“ und der Satz; danach gemeldet mit Rückgängig', async () => {
    const meldung: Aenderung = {
      text: '„Sommerfest“ ist im Archiv.',
      rueckgaengig: async () => {},
    };
    ar.insArchiv.mockResolvedValue(meldung);
    const geaendert = mitSommerfest(9, []);
    expect(bereich().getByText(/Endgültig löschen kann ein Admin – im Archiv/)).toBeTruthy();
    expect(bereich().queryByRole('button', { name: 'Endgültig löschen' })).toBeNull();
    fireEvent.click(bereich().getByRole('button', { name: 'Ins Archiv' }));
    await waitFor(() => expect(geaendert).toHaveBeenCalledWith(meldung));
    expect(ar.insArchiv).toHaveBeenCalledWith(55, 'Sommerfest', E.STATUS.freigegeben);
  });

  it('D6: Mitglied ohne Leitung sieht den Hinweis, aber weder Löschen noch Archiv', () => {
    mitSommerfest(7, []);
    expect(bereich().getByText('Sommerfest: Anmeldungen gelöscht')).toBeTruthy();
    expect(bereich().queryByRole('button', { name: 'Ins Archiv' })).toBeNull();
    expect(bereich().queryByRole('button', { name: 'Endgültig löschen' })).toBeNull();
  });
});

describe('Ohne Abläufe: „Mails und Löschen einrichten“ (A9-5, F1–F3)', () => {
  /** Grundkurs (14.11.2026, 12 €) ist freigegeben, hat aber keine Abläufe – 2 sind angemeldet. */
  function mitGrundkurs(darf: boolean) {
    const x = v(
      {
        id: 52,
        name: 'Grundkurs',
        gruppeId: 7,
        statusId: 1,
        beginn: '2026-11-14T09:30',
        betragCent: 1200,
      },
      { aktiv: 2, wartend: 0, unbezahlt: null },
    );
    ei.einstellungenVon.mockResolvedValue(x.einstellungen);
    ei.anmeldungenIn.mockResolvedValue(2);
    const geaendert = vi.fn<(a: Aenderung) => void>();
    const oeffnen = vi.fn();
    render(
      <Startseite
        start={START}
        uebersicht={{
          einteilung: einteilen([x]),
          hinweise: aufmerksamkeit([x], [], new Set(), HEUTE, new Set(), new Map([[52, darf]])),
          offen: new Map(),
          verborgen: new Map(),
        }}
        heute={HEUTE}
        zeitzone="Europe/Berlin"
        onOeffnen={oeffnen}
        onGeaendert={geaendert}
      />,
    );
    return { geaendert, oeffnen };
  }
  const bereich = () => within(abschnitt('Braucht deine Aufmerksamkeit'));

  it('wer darf: „Einrichten“ öffnet gleich die Rückfrage; danach gemeldet, ohne Rückgängig', async () => {
    ab.ablaeufeNachholen.mockResolvedValue();
    const { geaendert } = mitGrundkurs(true);
    expect(bereich().getByText('Grundkurs: Mails und Löschen einrichten')).toBeTruthy();
    expect(bereich().getByText('Bisher löscht ChurchTools die Anmeldungen nie.')).toBeTruthy();
    fireEvent.click(bereich().getByRole('button', { name: 'Einrichten' }));
    const fenster = screen.getByRole('dialog', { name: 'Mails und Löschen einrichten?' });
    await waitFor(() =>
      expect(
        within(fenster).getByText(
          'Die 2 schon Angemeldeten bekommen keine neue Mail, für sie gilt das Löschdatum (So, 14.02.2027).',
        ),
      ).toBeTruthy(),
    );
    expect(within(fenster).getByText(/mit Betrag, Bankdaten und Link/)).toBeTruthy();
    // Von der Startseite aus muss klar sein, welche Veranstaltung (Fund der echten Prüfung).
    expect(within(fenster).getByText(/Für „Grundkurs“ schickt ChurchTools ab jetzt/)).toBeTruthy();
    fireEvent.click(within(fenster).getByRole('button', { name: 'Jetzt einrichten' }));
    await waitFor(() => expect(geaendert).toHaveBeenCalled());
    expect(ab.ablaeufeNachholen).toHaveBeenCalledWith(52, { loeschenBestaetigt: false });
    expect(geaendert.mock.calls[0][0]).toEqual({
      text: '„Grundkurs“: Mails und Löschen eingerichtet.',
      rueckgaengig: null,
    });
  });

  it('Löschdatum schon erreicht und noch Anmeldungen → erst „Sofort löschen?“, dann mit Bestätigung', async () => {
    ab.ablaeufeNachholen
      .mockRejectedValueOnce(new AB.LoeschdatumVorbei('2026-09-01', 2))
      .mockResolvedValueOnce();
    const { geaendert } = mitGrundkurs(true);
    fireEvent.click(bereich().getByRole('button', { name: 'Einrichten' }));
    const fenster = screen.getByRole('dialog', { name: 'Mails und Löschen einrichten?' });
    await waitFor(() =>
      expect(
        within(fenster).getByRole<HTMLButtonElement>('button', { name: 'Jetzt einrichten' })
          .disabled,
      ).toBe(false),
    );
    fireEvent.click(within(fenster).getByRole('button', { name: 'Jetzt einrichten' }));
    const frage = await screen.findByRole('dialog', { name: 'Sofort löschen?' });
    expect(within(frage).getByText(/Beim Einrichten entfernt ChurchTools/)).toBeTruthy();
    expect(within(frage).getByText(/alle 2 Anmeldungen/)).toBeTruthy();
    fireEvent.click(within(frage).getByRole('button', { name: 'Trotzdem einrichten' }));
    await waitFor(() => expect(geaendert).toHaveBeenCalled());
    expect(ab.ablaeufeNachholen).toHaveBeenLastCalledWith(52, { loeschenBestaetigt: true });
  });

  it('ohne Recht für Routinen: derselbe Hinweis mit dem Satz, statt „Einrichten“ nur „Ansehen“', () => {
    const { oeffnen } = mitGrundkurs(false);
    expect(
      bereich().getByText(/Einrichten kann, wer in ChurchTools Routinen verwalten darf/),
    ).toBeTruthy();
    expect(bereich().queryByRole('button', { name: 'Einrichten' })).toBeNull();
    fireEvent.click(bereich().getByRole('button', { name: 'Ansehen' }));
    expect(oeffnen).toHaveBeenCalledWith(52);
  });
});

describe('Viele ohne Abläufe: ab 3 eine Sammelzeile (A9-5, Fund der echten Prüfung)', () => {
  const alte = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      v(
        { id: 60 + i, name: `Alt ${i + 1}`, gruppeId: 9, statusId: 1, beginn: '2026-11-20T10:00' },
        { aktiv: 1, wartend: 0, unbezahlt: null },
      ),
    );
  function zeigeAlte(n: number) {
    const liste = alte(n);
    render(
      <Startseite
        start={START}
        uebersicht={{
          einteilung: einteilen(liste),
          hinweise: aufmerksamkeit(
            liste,
            [],
            new Set(),
            HEUTE,
            new Set(),
            new Map(liste.map((x) => [x.id, true])),
          ),
          offen: new Map(),
          verborgen: new Map(),
        }}
        heute={HEUTE}
        zeitzone="Europe/Berlin"
        onOeffnen={() => {}}
      />,
    );
  }
  const bereich = () => within(abschnitt('Braucht deine Aufmerksamkeit'));

  it('drei: eine Zeile für alle, die einzelnen erst nach „Anzeigen“; „Ausblenden“ klappt wieder zu', () => {
    zeigeAlte(3);
    expect(bereich().getByText('3 Veranstaltungen: Mails und Löschen einrichten')).toBeTruthy();
    expect(bereich().queryByText('Alt 1: Mails und Löschen einrichten')).toBeNull();
    const knopf = bereich().getByRole('button', { name: 'Anzeigen' });
    expect(knopf.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(knopf);
    for (const n of [1, 2, 3])
      expect(bereich().getByText(`Alt ${n}: Mails und Löschen einrichten`)).toBeTruthy();
    expect(bereich().getAllByRole('button', { name: 'Einrichten' })).toHaveLength(3);
    fireEvent.click(bereich().getByRole('button', { name: 'Ausblenden' }));
    expect(bereich().queryByText('Alt 2: Mails und Löschen einrichten')).toBeNull();
  });

  it('zwei: einzeln, ohne Sammelzeile', () => {
    zeigeAlte(2);
    expect(bereich().queryByText(/Veranstaltungen: Mails und Löschen einrichten/)).toBeNull();
    expect(bereich().getByText('Alt 1: Mails und Löschen einrichten')).toBeTruthy();
    expect(bereich().getByText('Alt 2: Mails und Löschen einrichten')).toBeTruthy();
  });
});
