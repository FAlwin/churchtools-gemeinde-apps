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
import { plusTage } from '@shared/ct/datum';
import type { NachweisEinstellungen } from '@shared/anmeldung/nachweise';
import { plusJahre } from '@shared/anmeldung/nachweisStand';
import type { NachweisEinstiegDaten } from './nachweisArten';
import type { NachweisArtMitPersonen, NachweisPerson } from './nachweisPersonen';
import { offeneAufgabe } from './nachweisArten.testutil';
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
    expect(texte).toEqual(['1 Platz frei', '3 Zahlungen offen', 'wartet auf Freigabe']);
    // Der Name steht über dem Etikett in derselben Zeile (E24).
    const zeilen = within(abschnitt('Braucht deine Aufmerksamkeit'));
    const namen = [...zeilen.getAllByRole('button'), ...zeilen.getAllByRole('link')].map(
      (z) => z.querySelector('div > b')?.textContent,
    );
    expect(namen).toEqual(expect.arrayContaining(['Lobpreisabend', 'Freizeit', 'Workshop']));
  });

  it('N3d: „n Personen ohne gültigen Nachweis“ – eine Zeile je Veranstaltung der Leitung, ein Klick öffnet sie', () => {
    const u = uebersicht();
    const liste = [...u.einteilung.anstehend];
    const frei = liste.find((x) => x.id === 40)!;
    const freizeit = liste.find((x) => x.id === 46)!;
    const grundkurs = liste.find((x) => x.id === 52)!; // Technik: keine Leitung
    const oeffnen = zeigen({
      ...u,
      hinweise: aufmerksamkeit(
        [frei, freizeit, grundkurs],
        [],
        new Set([9]),
        HEUTE,
        new Set(),
        new Map(),
        new Map([
          [40, 1],
          [46, 3],
          [52, 4],
        ]),
      ),
    });
    const bereich = within(abschnitt('Braucht deine Aufmerksamkeit'));
    expect(bereich.getByText('1 Person ohne gültigen Nachweis')).toBeTruthy();
    expect(bereich.getByText('3 Personen ohne gültigen Nachweis')).toBeTruthy();
    expect(bereich.queryByText('4 Personen ohne gültigen Nachweis')).toBeNull();
    fireEvent.click(bereich.getByText('3 Personen ohne gültigen Nachweis'));
    expect(oeffnen).toHaveBeenCalledWith(46);
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
      '1 Platz frei',
      'Plätze frei',
    ]);
    expect(bereich.getByText('1 Person wartet auf der Warteliste. Wer rückt nach?')).toBeTruthy();
    expect(bereich.getByText('2 Personen warten auf der Warteliste. Wer rückt nach?')).toBeTruthy();
  });

  it('Anstehend mit Monatsüberschriften; Zähler an den Reitern; Entwürfe und Vorbei auf Klick', () => {
    zeigen();
    const liste = abschnitt('Veranstaltungen');
    expect(within(liste).getByRole('button', { name: 'Anstehend, 3' })).toBeTruthy();
    expect(within(liste).getByRole('button', { name: 'Entwürfe, 1' })).toBeTruthy();
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
    // Die Gruppen stehen im Filter (R6, B7): angehakt heißt „wird gezeigt“, die Zahl am Knopf sagt, wie viel fehlt.
    fireEvent.click(within(liste).getByRole('button', { name: 'Filter' }));
    const technik = within(liste).getByRole('checkbox', { name: 'Technik' });
    fireEvent.click(technik);
    expect((technik as HTMLInputElement).checked).toBe(false);
    expect(within(liste).queryByText('Grundkurs')).toBeNull();
    expect(within(liste).getByRole('button', { name: 'Filter, 1 ausgeblendet' })).toBeTruthy();
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

  it('die ganze Zeile öffnet die Veranstaltung (E24); beim Entwurf in „Braucht deine Aufmerksamkeit“ ebenso (A3)', () => {
    const oeffnen = zeigen();
    fireEvent.click(
      within(abschnitt('Veranstaltungen')).getByRole('button', { name: /^Grundkurs/ }),
    );
    expect(oeffnen).toHaveBeenLastCalledWith(52);
    fireEvent.click(
      within(abschnitt('Braucht deine Aufmerksamkeit')).getByRole('button', {
        name: /^Workshop wartet auf Freigabe/,
      }),
    );
    expect(oeffnen).toHaveBeenLastCalledWith(43);
  });

  it('keine Zeile hat mehr einen eigenen Knopf daneben: jede ist EIN Knopf oder Link mit „›“', () => {
    zeigen();
    const zeilen = [
      ...within(abschnitt('Veranstaltungen')).getAllByRole('button'),
      ...within(abschnitt('Braucht deine Aufmerksamkeit')).getAllByRole('button'),
      ...within(abschnitt('Braucht deine Aufmerksamkeit')).getAllByRole('link'),
    ].filter((z) => z.querySelector('svg:last-child') && z.textContent !== 'Filter');
    expect(zeilen.length).toBeGreaterThan(5);
    for (const z of zeilen) expect(z.querySelector('button, a')).toBeNull();
  });

  it('Hinweise, die nach ChurchTools führen, sind Links mit „in ChurchTools“; die Veranstaltungszeile nicht (der Weg steht im Kopf der Veranstaltung)', () => {
    zeigen();
    const link = within(abschnitt('Braucht deine Aufmerksamkeit')).getByRole('link', {
      name: /^Lobpreisabend.*in ChurchTools/,
    });
    expect(link.getAttribute('href')).toMatch(/\/groups\/40$/);
    expect(within(abschnitt('Veranstaltungen')).queryByRole('link')).toBeNull();
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
    expect(bereich().getByText('Anmeldungen gelöscht')).toBeTruthy();
    expect(
      bereich().getByText(/Seit dem Di, 01\.09\.2026 – die Antworten stehen aber noch im Verlauf/),
    ).toBeTruthy();
    // Die ganze Zeile öffnet die Rückfrage – gelöscht wird erst dort, nach dem Eintippen des Namens.
    fireEvent.click(bereich().getByRole('button', { name: /^Sommerfest/ }));
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
    expect(bereich().queryByRole('button', { name: /^Sommerfest/ })).toBeNull();
    fireEvent.click(bereich().getByRole('button', { name: 'Ins Archiv' }));
    await waitFor(() => expect(geaendert).toHaveBeenCalledWith(meldung));
    expect(ar.insArchiv).toHaveBeenCalledWith(55, 'Sommerfest', E.STATUS.freigegeben);
  });

  it('D6: Mitglied ohne Leitung sieht den Hinweis, aber weder Löschen noch Archiv', () => {
    mitSommerfest(7, []);
    expect(bereich().getByText('Anmeldungen gelöscht')).toBeTruthy();
    expect(bereich().queryByRole('button', { name: 'Ins Archiv' })).toBeNull();
    expect(bereich().queryByRole('button', { name: /^Sommerfest/ })).toBeNull();
    // Er führt nur nach ChurchTools.
    expect(bereich().getByRole('link', { name: /^Sommerfest/ })).toBeTruthy();
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
    // Die ganze Zeile öffnet die Rückfrage.
    fireEvent.click(
      bereich().getByRole('button', { name: /^Grundkurs: Mails und Löschen einrichten/ }),
    );
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
    fireEvent.click(
      bereich().getByRole('button', { name: /^Grundkurs: Mails und Löschen einrichten/ }),
    );
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
    // Dieselbe Zeile, aber sie öffnet die Veranstaltung statt der Rückfrage.
    fireEvent.click(
      bereich().getByRole('button', { name: /^Grundkurs: Mails und Löschen einrichten/ }),
    );
    expect(screen.queryByRole('dialog', { name: 'Mails und Löschen einrichten?' })).toBeNull();
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

  it('drei: eine Zeile für alle, die einzelnen erst nach dem Aufklappen; ein zweiter Klick klappt wieder zu', () => {
    zeigeAlte(3);
    expect(bereich().getByText('3 Veranstaltungen: Mails und Löschen einrichten')).toBeTruthy();
    expect(bereich().queryByText('Alt 1: Mails und Löschen einrichten')).toBeNull();
    const knopf = bereich().getByRole('button', { name: /^3 Veranstaltungen: Mails/ });
    expect(knopf.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(knopf);
    expect(knopf.getAttribute('aria-expanded')).toBe('true');
    for (const n of [1, 2, 3])
      expect(bereich().getByText(`Alt ${n}: Mails und Löschen einrichten`)).toBeTruthy();
    fireEvent.click(knopf);
    expect(bereich().queryByText('Alt 2: Mails und Löschen einrichten')).toBeNull();
  });

  it('aufgeklappt stehen alle gleich unter der Sammelzeile – nicht verstreut zwischen anderen Hinweisen', () => {
    const [a1, a2] = alte(2);
    const spaeter = v(
      { id: 70, name: 'Alt 3', gruppeId: 9, statusId: 1, beginn: '2026-11-25T10:00' },
      { aktiv: 1, wartend: 0, unbezahlt: null },
    );
    const entwurf = v(
      { id: 71, name: 'Dazwischen', gruppeId: 9, statusId: 2, beginn: '2026-11-21T10:00' },
      null,
    );
    const liste = [a1, a2, spaeter, entwurf];
    render(
      <Startseite
        start={START}
        uebersicht={{
          einteilung: einteilen(liste),
          hinweise: aufmerksamkeit(
            liste,
            [],
            new Set([9]),
            HEUTE,
            new Set(),
            new Map([a1, a2, spaeter].map((x) => [x.id, true])),
          ),
          offen: new Map(),
          verborgen: new Map(),
        }}
        heute={HEUTE}
        zeitzone="Europe/Berlin"
        onOeffnen={() => {}}
      />,
    );
    fireEvent.click(bereich().getByRole('button', { name: /^3 Veranstaltungen: Mails/ }));
    const titel = abschnitt('Braucht deine Aufmerksamkeit').querySelectorAll('b');
    // Die Kacheln tragen den Tag ebenfalls fett – gezählt werden nur die Überschriften.
    expect([...titel].map((b) => b.textContent).filter((t) => !/^\d+$/.test(t ?? ''))).toEqual([
      '3 Veranstaltungen: Mails und Löschen einrichten',
      'Alt 1: Mails und Löschen einrichten',
      'Alt 2: Mails und Löschen einrichten',
      'Alt 3: Mails und Löschen einrichten',
      'Dazwischen',
    ]);
  });

  it('zwei: einzeln, ohne Sammelzeile', () => {
    zeigeAlte(2);
    expect(bereich().queryByText(/Veranstaltungen: Mails und Löschen einrichten/)).toBeNull();
    expect(bereich().getByText('Alt 1: Mails und Löschen einrichten')).toBeTruthy();
    expect(bereich().getByText('Alt 2: Mails und Löschen einrichten')).toBeTruthy();
  });
});

// ── Nachweise (N2a): Aufmerksamkeit und Karte ────────────────────────────────────────────────────────────────────

describe('Nachweise auf der Startseite (N2a)', () => {
  const E: NachweisEinstellungen = {
    gueltigJahre: 3,
    ab: 'ausstellung',
    betreff: 'B',
    text: 'T [Vorname]',
  };
  const P = (id: number, p: Partial<NachweisPerson> = {}): NachweisPerson => ({
    personId: id,
    name: `Person ${id}`,
    eingesehenAm: null,
    ausgestelltAm: null,
    ergebnis: null,
    aufgabe: null,
    profil: null,
    ...p,
  });
  const eingesehen = (tage: number, p: Partial<NachweisPerson> = {}): Partial<NachweisPerson> => ({
    eingesehenAm: plusTage(HEUTE, -5),
    ausgestelltAm: plusJahre(plusTage(HEUTE, tage), -3),
    ...p,
  });
  const art = (
    id: number,
    name: string,
    personen: NachweisPerson[] | null,
  ): NachweisArtMitPersonen => ({
    id,
    gruppenName: `Nachweis: ${name}`,
    name,
    einstellungen: E,
    vertrauen: [],
    personen,
  });
  /** Führungszeugnis: 2 gültig, 1 angefordert, je 1 fehlt / läuft ab / abgelaufen / Rücksprache. */
  const FZ = art(61, 'Führungszeugnis', [
    P(1, eingesehen(900)),
    P(2, eingesehen(900)),
    P(3, { aufgabe: offeneAufgabe(plusTage(HEUTE, -3)) }),
    P(4, { aufgabe: offeneAufgabe(plusTage(HEUTE, -40)) }),
    P(5, eingesehen(20)),
    P(6, eingesehen(-20)),
    P(7, eingesehen(900, { ergebnis: 'eintrag' })),
  ]);
  const JULEICA = art(62, 'JuLeiCa', [P(8, eingesehen(900)), P(9, eingesehen(900))]);
  const LEER_UEBERSICHT: Uebersicht = {
    einteilung: { anstehend: [], entwuerfe: [], vorbei: [] },
    hinweise: [],
    offen: new Map(),
    verborgen: new Map(),
  };

  function mit(nachweise: NachweisEinstiegDaten | undefined, u = uebersicht(), mitKlick = true) {
    const onNachweise = vi.fn();
    render(
      <Startseite
        start={START}
        uebersicht={u}
        heute={HEUTE}
        zeitzone="Europe/Berlin"
        onOeffnen={vi.fn()}
        nachweise={nachweise}
        onNachweise={mitKlick ? onNachweise : undefined}
      />,
    );
    return onNachweise;
  }

  it('„Braucht deine Aufmerksamkeit“: eine Zeile je Art mit Fällen, mit allen vier Etiketten und dem Satz', () => {
    mit({ darfEinrichten: true, arten: [FZ, JULEICA] });
    const aufm = within(abschnitt('Braucht deine Aufmerksamkeit'));
    expect(aufm.getByText('1 fehlt seit über 4 Wochen')).toBeTruthy();
    expect(aufm.getByText('1 läuft bald ab')).toBeTruthy();
    expect(aufm.getByText('1 abgelaufen')).toBeTruthy();
    expect(aufm.getByText('1 Rücksprache')).toBeTruthy();
    expect(aufm.getByText('4 Personen brauchen dich als Vertrauensperson.')).toBeTruthy();
    // JuLeiCa: alle gültig – keine Zeile hier.
    expect(aufm.queryByText('JuLeiCa')).toBeNull();
  });

  it('die Zahl im Kopf zählt die Nachweis-Zeilen mit den anderen Hinweisen', () => {
    const u = uebersicht();
    mit({ darfEinrichten: true, arten: [FZ] }, u);
    const kopf = abschnitt('Braucht deine Aufmerksamkeit').querySelector('h2')!.parentElement!;
    expect(kopf.textContent).toBe(`Braucht deine Aufmerksamkeit${u.hinweise.length + 1}`);
  });

  it('die Karte erscheint auch, wenn es NUR Nachweis-Fälle gibt', () => {
    mit({ darfEinrichten: false, arten: [FZ] }, LEER_UEBERSICHT);
    expect(abschnitt('Braucht deine Aufmerksamkeit')).toBeTruthy();
  });

  it('ohne Fälle (und ohne andere Hinweise) gibt es die Karte nicht', () => {
    mit({ darfEinrichten: false, arten: [JULEICA] }, LEER_UEBERSICHT);
    expect(screen.queryByRole('region', { name: 'Braucht deine Aufmerksamkeit' })).toBeNull();
  });

  it('ein Klick auf die Zeile öffnet die Seite mit „Braucht Aufmerksamkeit“', () => {
    const auf = mit({ darfEinrichten: true, arten: [FZ] });
    fireEvent.click(
      within(abschnitt('Braucht deine Aufmerksamkeit')).getByRole('button', {
        name: /Führungszeugnis/,
      }),
    );
    expect(auf).toHaveBeenCalledWith('aufmerksam');
  });

  it('Karte „Nachweise“: je Art eine Zeile mit der Zählung; Klick öffnet die Seite (alle)', () => {
    const auf = mit({ darfEinrichten: true, arten: [FZ, JULEICA] });
    const karte = within(abschnitt('Nachweise'));
    expect(karte.getByText('7 Personen: 2 gültig · 1 angefordert · 4 brauchen dich')).toBeTruthy();
    expect(karte.getByText('2 Personen: alle gültig')).toBeTruthy();
    fireEvent.click(karte.getByRole('button', { name: /JuLeiCa/ }));
    expect(auf).toHaveBeenCalledWith('alle');
  });

  it('eine Art ohne Personen: „Noch niemand eingetragen“; eine nicht sichtbare Art fehlt ganz', () => {
    mit({ darfEinrichten: true, arten: [art(63, 'Leer', []), art(64, 'Fremd', null)] });
    const karte = within(abschnitt('Nachweise'));
    expect(karte.getByText('Noch niemand eingetragen')).toBeTruthy();
    expect(karte.queryByText('Fremd')).toBeNull();
  });

  it('keine sichtbare Art (nichts gelesen oder nichts geleitet): die bisherige Zeile zum Einrichten', () => {
    const auf = mit({ darfEinrichten: true, arten: [] });
    const karte = within(abschnitt('Nachweise'));
    expect(karte.getByText('Nachweis-Arten ansehen und einrichten')).toBeTruthy();
    fireEvent.click(karte.getByRole('button', { name: /Führungszeugnis & Co/ }));
    expect(auf).toHaveBeenCalledWith('alle');
  });

  it('ohne Recht (kein Einstieg): weder Karte noch Zeilen', () => {
    mit({ darfEinrichten: false, arten: [FZ] }, uebersicht(), false);
    expect(screen.queryByRole('region', { name: 'Nachweise' })).toBeNull();
    expect(screen.queryByText('1 fehlt seit über 4 Wochen')).toBeNull();
  });
});
