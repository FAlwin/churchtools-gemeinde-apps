// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AnmeldungenReiter, type MitgliederZustand } from './AnmeldungenReiter';
import type { Mail } from '@shared/anmeldung/bewegung';
import { MailAnsicht, MailKnoepfe } from './AnmeldungAktion';
import { fensterKnoepfe } from '@ui/fenster/fenster.testutil';
import * as Z from './zahlung';
import * as B from './bewegung';
import * as H from './vonHand';
import * as M from './mitglieder';
import * as R from './rundmail';
import * as E from './einrichten';
import * as T from '@ui/teilen/sharePdf';
import {
  FELDER,
  STICHTAG,
  absage,
  dazu,
  e,
  mitglieder,
  stand,
} from '@shared/anmeldung/liste.testdaten';

vi.mock('./zahlung', () => ({
  zahlungSpeichern: vi.fn().mockResolvedValue(undefined),
  betragAendern: vi.fn().mockResolvedValue(undefined),
  betragWiederherstellen: vi.fn().mockResolvedValue(undefined),
}));
const zm = vi.mocked(Z);
vi.mock('./bewegung', () => ({
  nachrueckenLassen: vi.fn().mockResolvedValue(undefined),
  absagenLassen: vi.fn(),
}));
const bm = vi.mocked(B);
vi.mock('./vonHand', () => ({
  personenSuchen: vi.fn(),
  gleichNamige: vi.fn(),
  meinName: vi.fn(),
  vonHandAnmelden: vi.fn(),
  GibtEsSchon: class extends Error {},
}));
const hm = vi.mocked(H);
vi.mock('./mitglieder', () => ({ gruppenfelderLaden: vi.fn() }));
vi.mock('./rundmail', () => ({
  platzhalterLaden: vi.fn(),
  vorschauLaden: vi.fn(),
  rundmailSenden: vi.fn(),
  UnklarObVerschickt: class extends Error {},
}));
const rm = vi.mocked(R);
vi.mock('./einrichten', async (original) => ({
  ...(await original<typeof import('./einrichten')>()),
  aendereEinstellungen: vi.fn().mockResolvedValue(undefined),
}));
const em = vi.mocked(E);
vi.mock('@ui/teilen/sharePdf', () => ({ sharePdf: vi.fn(), downloadPdf: vi.fn() }));
const tm = vi.mocked(T);
const mm = vi.mocked(M);

/**
 * Reiter „Anmeldungen“ (A7-1, Zahlung A7-2). Die Daten kommen aus dem, was das Formular schreibt (`liste.testdaten.ts`); gerechnet
 * wird in `shared/anmeldung/liste.ts` (dort getestet) – hier nur, was man sieht und anklickt.
 */
function zeigen(
  zustand: MitgliederZustand | null,
  max: number | null = 10,
  entwurf = false,
  darf = true,
  mitBestaetigung = false,
) {
  const onNeuLaden = vi.fn();
  const onGespeichert = vi.fn();
  render(
    <AnmeldungenReiter
      id={165}
      veranstaltung="Kinderfreizeit"
      e={e()}
      maxPlaetze={max}
      warteliste
      anmeldeschluss={null}
      entwurf={entwurf}
      zustand={zustand}
      stichtag={STICHTAG}
      heute="2026-10-19"
      darf={darf}
      zahlarten={['Überweisung', 'Bar']}
      onNeuLaden={onNeuLaden}
      onGespeichert={onGespeichert}
      mitBestaetigung={mitBestaetigung}
    />,
  );
  return Object.assign(onNeuLaden, { onGespeichert });
}
/** Die Zeile der Tabelle zu einem Namen (U2-1: der Name ist der Knopf, die Zeile drumherum). */
const zeile = (name: string) => screen.getByRole('button', { name }).closest('tr')!;
const fertig = (
  roh = mitglieder('AAAAAA', [true, false], 10),
  verlauf = [dazu(10, '2026-10-17')],
) => ({ art: 'fertig', stand: { ...stand(roh, verlauf), verlaufGekuerzt: false } }) as const;

describe('Reiter Anmeldungen', () => {
  // Die Zahlen (Plätze, Warteliste, Zahlung offen) stehen seit U1 oben auf der Seite – getestet in `Einstieg.test.tsx`.
  it('eine Zeile je Anmeldung; „frei, aber jemand wartet“ steht nur im Reiter Warteliste (U2-1)', () => {
    zeigen(fertig());
    expect(screen.queryByText('1 von 10')).toBeNull();
    expect(zeile('Maria Beispiel').textContent).toMatch(
      /Maria Beispiel.*AAAAAA.*Jonas 9.*Lena 7.*Warteliste 1.*6,00 €.*offen/s,
    );
    // Unter „Alle“ kein Hinweis mehr – er stand vorher dreimal (Kachel, Nachprüfung, über der Liste).
    expect(screen.queryByText(/Als Nächste wartet/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Warteliste/ }));
    expect(screen.getByText(/9 Plätze frei – 1 wartet\./)).toBeTruthy();
    expect(screen.getByText(/Als Nächste wartet Lena Beispiel \(seit 17\.10\.\)/)).toBeTruthy();
  });

  it('alle warten (das Formular schreibt „0,00 €“) → „Betrag beim Nachrücken“ statt „0,00 €“', () => {
    zeigen(fertig(mitglieder('AAAAAA', [false, false], 10)));
    expect(zeile('Maria Beispiel').textContent).toMatch(/beim Nachrücken/);
    expect(zeile('Maria Beispiel').textContent).not.toMatch(/0,00 €/);
  });

  it('kein Hinweis, wenn niemand wartet oder alles voll ist', () => {
    zeigen(fertig(mitglieder('AAAAAA', [true, true], 10)));
    fireEvent.click(screen.getByRole('button', { name: /^Warteliste/ }));
    expect(screen.queryByText(/warten?\./)).toBeNull();
    cleanup();
    // Voll (1 von 1), eine wartet – ChurchTools hat recht, niemand kann nachrücken.
    zeigen(fertig(), 1);
    fireEvent.click(screen.getByRole('button', { name: /^Warteliste/ }));
    expect(zeile('Maria Beispiel')).toBeTruthy();
    expect(screen.queryByText(/Als Nächste wartet/)).toBeNull();
  });

  it('Klick öffnet das Fenster: einmal oben mit Unterschrift, je Person die Antworten', () => {
    zeigen(fertig());
    fireEvent.click(screen.getByRole('button', { name: /Maria Beispiel/ }));
    expect(screen.getByText('Für die ganze Anmeldung · gilt für Jonas, Lena')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Unterschrift' })).toBeTruthy();
    // Die Unterschrift steht auch als Spalte in der Tabelle – hier die im Fenster.
    expect(
      within(screen.getByRole('dialog')).getByText('✓ Maria Beispiel, 17.10.2026'),
    ).toBeTruthy();
    expect(screen.getByText('Jonas Beispiel, 9')).toBeTruthy();
    expect(screen.getByText('Nüsse')).toBeTruthy();
    expect(screen.getAllByText('Warteliste 1').length).toBeGreaterThan(0);
    // Fenster wie ChurchTools (E6-O F4): X oben, unten nur „Schließen“ – nichts zum Abbrechen.
    expect(fensterKnoepfe()[0]).toBe('Fenster schließen');
    expect(fensterKnoepfe().at(-1)).toBe('Schließen');
    expect(fensterKnoepfe()).not.toContain('Abbrechen');
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByText(/Für die ganze Anmeldung/)).toBeNull();
  });

  it('Filter Warteliste, Abgesagt und Suche', () => {
    const [jonas, lena] = mitglieder('AAAAAA', [true, false], 10);
    zeigen(fertig([lena], [absage(jonas, '2026-10-18', 10)]));
    fireEvent.click(screen.getByRole('button', { name: /^Warteliste/ }));
    // Eine Zeile je Anmeldung, mit dem Warteplatz als Spalte.
    expect(screen.getByRole('columnheader', { name: 'Warteplatz' })).toBeTruthy();
    expect(zeile('Maria Beispiel').textContent).toMatch(/Lena 7.*Warteliste 1/);
    fireEvent.click(screen.getByRole('button', { name: /^Abgesagt/ }));
    const ab = zeile('Jonas Beispiel');
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

describe('Tabelle (U2-1)', () => {
  const zwei = () =>
    fertig(
      [...mitglieder('AAAAAA', [true, true], 10), ...mitglieder('BBBBBB', [true, false], 20)],
      [dazu(10, '2026-10-17'), dazu(20, '2026-10-18')],
    );
  const nummern = () =>
    screen
      .getAllByRole('row')
      .map((r) => /[A-Z]{6}/.exec(r.textContent ?? '')?.[0])
      .filter(Boolean);

  it('Reiter mit der Zahl ihrer Zeilen; Spalten mit den Fragen der Anmeldung; Summenzeile', () => {
    zeigen(zwei());
    expect(screen.getByRole('button', { name: 'Alle 2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zahlung offen 2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Warteliste 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abgesagt 0' })).toBeTruthy();
    const kopf = screen.getAllByRole('columnheader').map((k) => k.textContent);
    expect(kopf.slice(0, 3)).toEqual(['Name', 'Nr.', 'Personen']);
    expect(kopf).toContain('Telefon');
    expect(kopf.slice(-3)).toEqual(['Betrag', 'Bezahlt', 'Angemeldet am']);
    // Lange Fragen sind auf zwei Zeilen gekürzt – ganz stehen sie beim Darüberfahren (echte Prüfung U2-1).
    for (const k of screen.getAllByRole('columnheader'))
      expect(k.getAttribute('title')).toBe(k.textContent);
    // Druckliste und Rundmail mit Linien-Symbol statt Zeichen (am Handy nur das Symbol).
    for (const name of ['Druckliste', 'Rundmail'])
      expect(screen.getByRole('button', { name }).querySelector('svg')).toBeTruthy();
    const summe = screen.getAllByRole('row').at(-1)!.textContent;
    expect(summe).toMatch(/^2 Anmeldungen/);
    expect(summe).toMatch(/3 Personen\+ 1 auf der Warteliste/);
    expect(summe).toMatch(/2 ausgefüllt/);
    expect(summe).toMatch(/18,00 €18,00 € offen · 0,00 € eingegangen/);
  });

  it('Spaltenkopf sortiert: auf, ab, wieder nach Anmeldetag; ein anderer Reiter beginnt ohne Wahl', () => {
    zeigen(zwei());
    expect(nummern()).toEqual(['AAAAAA', 'BBBBBB']);
    const personen = () => screen.getByRole('columnheader', { name: /Personen/ });
    fireEvent.click(within(personen()).getByRole('button'));
    expect(personen().getAttribute('aria-sort')).toBe('ascending');
    expect(nummern()).toEqual(['BBBBBB', 'AAAAAA']);
    fireEvent.click(within(personen()).getByRole('button'));
    expect(personen().getAttribute('aria-sort')).toBe('descending');
    expect(nummern()).toEqual(['AAAAAA', 'BBBBBB']);
    fireEvent.click(within(personen()).getByRole('button'));
    expect(personen().getAttribute('aria-sort')).toBeNull();
    fireEvent.click(within(personen()).getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: /^Zahlung offen/ }));
    expect(personen().getAttribute('aria-sort')).toBeNull();
  });

  it('ein Klick in die Zeile (nicht nur auf den Namen) öffnet die Anmeldung', () => {
    zeigen(fertig());
    fireEvent.click(within(zeile('Maria Beispiel')).getByText('AAAAAA'));
    expect(screen.getByText('Für die ganze Anmeldung · gilt für Jonas, Lena')).toBeTruthy();
  });

  it('Abgesagt: „Zurückholen“ nur mit Recht; die Suche findet auch Absagen', () => {
    const [jonas, lena] = mitglieder('AAAAAA', [true, false], 10);
    zeigen(fertig([lena], [absage(jonas, '2026-10-18', 10)]));
    fireEvent.click(screen.getByRole('button', { name: /^Abgesagt/ }));
    expect(zeile('Jonas Beispiel').textContent).toMatch(/Zurückholen$/);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Name suchen' }), {
      target: { value: 'lena' },
    });
    expect(screen.getByText('Niemand mit „lena“ gefunden.')).toBeTruthy();
    cleanup();
    zeigen(fertig([lena], [absage(jonas, '2026-10-18', 10)]), 10, false, false);
    fireEvent.click(screen.getByRole('button', { name: /^Abgesagt/ }));
    expect(screen.getByText('Jonas Beispiel').closest('tr')!.textContent).not.toMatch(
      /Zurückholen/,
    );
  });
});

describe('Je Person (U2-2)', () => {
  const jePerson = () => fireEvent.click(screen.getByRole('button', { name: 'Je Person' }));
  const personen = () =>
    within(screen.getByRole('table', { name: 'Personen' }))
      .getAllByRole('row')
      .slice(1, -1)
      .map((r) => r.textContent);

  it('Umschalter: eine Zeile je Person, Reiter zählen Personen, Summe zählt Personen mit Platz', () => {
    zeigen(fertig());
    expect(screen.getByRole('button', { name: 'Je Anmeldung' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    jePerson();
    expect(screen.queryByRole('table', { name: 'Anmeldungen' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Alle 2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Warteliste 1' })).toBeTruthy();
    const kopf = screen.getAllByRole('columnheader').map((k) => k.textContent);
    expect(kopf.slice(0, 4)).toEqual(['Vorname', 'Nachname', 'Status', 'Alter']);
    expect(kopf.slice(-2)).toEqual(['Betrag der Anmeldung', 'Bezahlt']);
    expect(personen()).toEqual([
      expect.stringMatching(/^JonasBeispielPlatz9.*AAAAAA.*6,00 €offen$/),
      expect.stringMatching(/^LenaBeispielWarteliste 17.*AAAAAA.*6,00 €offen$/),
    ]);
    const summe = screen.getAllByRole('row').at(-1)!.textContent;
    expect(summe).toMatch(/^1 Person\+ 1 auf der Warteliste/);
    // Der Betrag steht bei beiden Personen – gezählt wird er einmal.
    expect(summe).toMatch(/6,00 €6,00 € offen · 0,00 € eingegangen/);
  });

  it('Klick auf eine Person öffnet ihre Anmeldung; Warteliste je Person nach Warteplatz', () => {
    zeigen(fertig());
    jePerson();
    fireEvent.click(screen.getByRole('button', { name: 'Lena' }));
    expect(screen.getByText('Für die ganze Anmeldung · gilt für Jonas, Lena')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    fireEvent.click(screen.getByRole('button', { name: /^Warteliste/ }));
    expect(screen.getByRole('columnheader', { name: 'Warteplatz' })).toBeTruthy();
    expect(personen()).toEqual([expect.stringMatching(/^LenaBeispiel1Warteliste 1/)]);
  });

  it('Umschalten setzt die Sortierung zurück; bei „Abgesagt“ kein Umschalter (Absagen sind je Person)', () => {
    zeigen(fertig());
    jePerson();
    const alter = () => screen.getByRole('columnheader', { name: /Alter/ });
    fireEvent.click(within(alter()).getByRole('button'));
    expect(personen()[0]).toMatch(/^Lena/);
    fireEvent.click(screen.getByRole('button', { name: 'Je Anmeldung' }));
    jePerson();
    expect(alter().getAttribute('aria-sort')).toBeNull();
    expect(personen()[0]).toMatch(/^Jonas/);
    fireEvent.click(screen.getByRole('button', { name: /^Abgesagt/ }));
    expect(screen.queryByRole('button', { name: 'Je Person' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Alle/ }));
    // Die Wahl bleibt beim Reiterwechsel.
    expect(screen.getByRole('table', { name: 'Personen' })).toBeTruthy();
  });

  it('Suche je Person: nach dem Namen der Person oder der Anmeldung', () => {
    zeigen(fertig());
    jePerson();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Name suchen' }), {
      target: { value: 'lena' },
    });
    expect(personen()).toEqual([expect.stringMatching(/^Lena/)]);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Name suchen' }), {
      target: { value: 'maria' },
    });
    expect(personen()).toHaveLength(2);
  });
});

describe('Zahlung im Fenster (A7-2)', () => {
  const oeffnen = () => fireEvent.click(screen.getByRole('button', { name: /Maria Beispiel/ }));

  it('als bezahlt markieren: Zahlart wählen, bei der ersten Person, mit „Rückgängig“', async () => {
    const z = zeigen(fertig(mitglieder('AAAAAA', [true, true], 10)));
    oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Bar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Als bezahlt markieren' }));
    await waitFor(() => expect(z.onGespeichert).toHaveBeenCalled());
    expect(zm.zahlungSpeichern).toHaveBeenCalledWith(165, 10, {
      bezahlt: true,
      am: '2026-10-19',
      zahlart: 'Bar',
    });
    // „Rückgängig“ im Fenster selbst (Alwin, 19.10.2026) – nicht in der Leiste hinter dem Fenster.
    const zeile = screen.getByRole('status');
    expect(zeile.textContent).toMatch(/^Maria Beispiel: als bezahlt markiert \(Bar\)\./);
    fireEvent.click(within(zeile).getByRole('button', { name: 'Rückgängig' }));
    expect(await within(zeile).findByText('Rückgängig gemacht.')).toBeTruthy();
    expect(zm.zahlungSpeichern).toHaveBeenLastCalledWith(165, 10, {
      bezahlt: false,
      am: null,
      zahlart: null,
    });
    expect(z.onGespeichert).toHaveBeenCalledTimes(2);
    // Fenster zu und wieder auf → keine alte Änderung mehr.
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    oeffnen();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('bezahlt → Anzeige mit Zahlart, „Zurücksetzen“; in der Liste „✓ Bar“', async () => {
    const z = zeigen(fertig(mitglieder('AAAAAA', [true, true], 10, { bezahlt: true })));
    expect(zeile('Maria Beispiel').textContent).toMatch(/✓ Bar 18\.10\./);
    oeffnen();
    expect(screen.getByText('✓ bezahlt am 18.10.2026 · Bar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }));
    await waitFor(() => expect(z.onGespeichert).toHaveBeenCalled());
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
    await waitFor(() => expect(z.onGespeichert).toHaveBeenCalled());
    expect(zm.betragAendern).toHaveBeenCalledWith(
      165,
      10,
      1000,
      expect.stringMatching(/Gesamt: 12,00 €$/),
      '2026-10-19',
    );
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Rückgängig' }));
    await waitFor(() => expect(zm.betragWiederherstellen).toHaveBeenCalled());
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
    expect(
      screen.getByText(/hat selbst abgesagt \(Link in der Mail\)\. Ändern geht hier nicht mehr/),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Betrag ändern' })).toBeNull();
  });
});

describe('Nachrücken und Absagen (A7-3)', () => {
  // Wie Chrome 152: `scrollIntoView` gibt ein Promise zurück (jsdom kennt es gar nicht). Stand das als Rückgabe in einem
  // Effekt, hielt React es für die Aufräum-Funktion – „Mail schreiben“ ließ die Zeile verschwinden, die Seite wurde weiß.
  beforeEach(() => {
    Element.prototype.scrollIntoView = () => Promise.resolve() as unknown as void;
  });
  afterEach(() => {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });
  const oeffnen = () => fireEvent.click(screen.getByRole('button', { name: /Maria Beispiel/ }));
  const karte = (text: string) => screen.getByText(text).closest('div')!.parentElement!;

  it('Nachrücken: Rückfrage mit eigener Zahlung, danach „Mail schreiben“, aber kein Rückgängig', async () => {
    const z = zeigen(fertig());
    oeffnen();
    fireEvent.click(
      within(karte('Lena Beispiel, 7')).getByRole('button', { name: 'Nachrücken lassen' }),
    );
    expect(screen.getByText('Lena Beispiel nachrücken lassen?')).toBeTruthy();
    expect(screen.getByText('Neue Zahlung für Lena').nextSibling?.textContent).toBe('6,00 €');
    // Ohne eingerichtete Mails: wie gemessen nur „war erfolgreich“.
    expect(screen.getByText(/nur „Deine Anmeldung war erfolgreich“/)).toBeTruthy();
    // Fenster wie ChurchTools (E6-O F4): die Rückfrage hat ihre Knöpfe unten; ganz zu nur über das X.
    expect(fensterKnoepfe()).toEqual(['Fenster schließen', 'Abbrechen', 'Nachrücken lassen']);
    fireEvent.click(screen.getByRole('button', { name: 'Nachrücken lassen' }));
    await waitFor(() => expect(z.onGespeichert).toHaveBeenCalled());
    expect(bm.nachrueckenLassen).toHaveBeenCalledWith(
      165,
      expect.anything(),
      expect.objectContaining({
        personId: 11,
        zahlung: expect.objectContaining({ betragCent: 600 }),
      }),
    );
    const zeile = screen.getByRole('status');
    expect(zeile.textContent).toMatch(/^Lena Beispiel ist nachgerückt\./);
    expect(within(zeile).queryByRole('button', { name: 'Rückgängig' })).toBeNull();
    fireEvent.click(within(zeile).getByRole('button', { name: 'Mail schreiben' }));
    expect(screen.getByText('Kinderfreizeit: Lena hat einen Platz')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Im Mailprogramm öffnen' }).getAttribute('href'),
    ).toMatch(/^mailto:maria%40beispiel\.test\?subject=/);
    expect(fensterKnoepfe()).toEqual(['Fenster schließen', 'Zurück', 'Text kopieren']);
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    fireEvent.click(screen.getByRole('button', { name: 'Text kopieren' }));
    expect(await screen.findByText('Kopiert.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(fensterKnoepfe().at(-1)).toBe('Schließen');
    // „Kopiert.“ gehört zu dieser einen Mail – wer sie noch einmal öffnet, sieht es nicht mehr.
    fireEvent.click(
      within(screen.getByRole('status')).getByRole('button', { name: 'Mail schreiben' }),
    );
    expect(screen.queryByText('Kopiert.')).toBeNull();
  });

  it('der Knopf im Hinweis oben öffnet gleich die Rückfrage; voll → Plätze erhöhen', () => {
    zeigen(fertig());
    fireEvent.click(screen.getByRole('button', { name: /^Warteliste/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Lena nachrücken lassen' }));
    expect(screen.getByText('Lena Beispiel nachrücken lassen?')).toBeTruthy();
    cleanup();
    zeigen(fertig(), 1);
    oeffnen();
    fireEvent.click(
      within(karte('Lena Beispiel, 7')).getByRole('button', { name: 'Nachrücken lassen' }),
    );
    expect(screen.getByText(/Alle 1 Plätze sind belegt\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Plätze erhöhen und nachrücken' })).toBeTruthy();
  });

  it('Absagen: Rückfrage mit neuer Zahlung, danach Rückgängig im Fenster', async () => {
    const zurueck = vi.fn().mockResolvedValue(undefined);
    bm.absagenLassen.mockResolvedValue(zurueck);
    const z = zeigen(fertig(mitglieder('AAAAAA', [true, true], 10)));
    oeffnen();
    fireEvent.click(within(karte('Lena Beispiel, 7')).getByRole('button', { name: 'Absagen' }));
    expect(screen.getByText('Lena Beispiel absagen?')).toBeTruthy();
    expect(screen.getByText('Zahlung der Anmeldung').nextSibling?.textContent).toBe(
      '12,00 € 6,00 €',
    );
    expect(fensterKnoepfe()).toEqual(['Fenster schließen', 'Abbrechen', 'Ja, absagen']);
    fireEvent.click(screen.getByRole('button', { name: 'Ja, absagen' }));
    await waitFor(() => expect(z.onGespeichert).toHaveBeenCalled());
    const zeile = screen.getByRole('status');
    expect(zeile.textContent).toMatch(/^Lena Beispiel ist abgesagt\./);
    expect(within(zeile).getByRole('button', { name: 'Mail schreiben' })).toBeTruthy();
    fireEvent.click(within(zeile).getByRole('button', { name: 'Rückgängig' }));
    await waitFor(() => expect(zurueck).toHaveBeenCalled());
    // Ohne eingerichtete Mails kein Hinweis auf eine zweite Bestätigung.
    expect(screen.queryByText(/schickt dabei die Bestätigung noch einmal/)).toBeNull();
  });

  it('Absagen mit Bestätigungsmails (A9-1): das Fenster sagt, dass „Rückgängig“ sie noch einmal schickt', async () => {
    bm.absagenLassen.mockResolvedValue(vi.fn().mockResolvedValue(undefined));
    const z = zeigen(fertig(mitglieder('AAAAAA', [true, true], 10)), 10, false, true, true);
    oeffnen();
    fireEvent.click(within(karte('Lena Beispiel, 7')).getByRole('button', { name: 'Absagen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ja, absagen' }));
    await waitFor(() => expect(z.onGespeichert).toHaveBeenCalled());
    expect(
      screen.getByText(
        '„Rückgängig“ trägt Lena wieder ein – ChurchTools schickt dabei die Bestätigung noch einmal.',
      ),
    ).toBeTruthy();
    // Eine Absage hat keinen Ablauf – „Mail schreiben“ bleibt (A9-2b).
    expect(
      within(screen.getByRole('status')).getByRole('button', { name: 'Mail schreiben' }),
    ).toBeTruthy();
    // Nach dem Rückgängigmachen ist der Satz erledigt und verschwindet (echte Prüfung 24.10.2026).
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Rückgängig' }));
    await waitFor(() =>
      expect(screen.queryByText(/schickt dabei die Bestätigung noch einmal/)).toBeNull(),
    );
  });

  it('Nachrücken mit Bestätigungsmails (A9-1): die Rückfrage nennt die Bestätigung mit Betrag', () => {
    zeigen(fertig(), 10, false, true, true);
    oeffnen();
    fireEvent.click(
      within(karte('Lena Beispiel, 7')).getByRole('button', { name: 'Nachrücken lassen' }),
    );
    expect(
      screen.getByText(/ChurchTools schickt Lena die Bestätigung mit Betrag und Bankdaten\./),
    ).toBeTruthy();
    expect(screen.queryByText(/war erfolgreich/)).toBeNull();
  });

  it('Nachrücken mit Bestätigungsmails (A9-2b): danach kein „Mail schreiben“ – die Bestätigung kommt von selbst', async () => {
    const z = zeigen(fertig(), 10, false, true, true);
    oeffnen();
    fireEvent.click(
      within(karte('Lena Beispiel, 7')).getByRole('button', { name: 'Nachrücken lassen' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Nachrücken lassen' }));
    await waitFor(() => expect(z.onGespeichert).toHaveBeenCalled());
    const zeile = screen.getByRole('status');
    expect(zeile.textContent).toMatch(/^Lena Beispiel ist nachgerückt\./);
    expect(within(zeile).queryByRole('button', { name: 'Mail schreiben' })).toBeNull();
  });

  it('während des Absagens: X und „Abbrechen“ gesperrt (E6-O F4)', () => {
    bm.absagenLassen.mockReturnValue(new Promise(() => {}));
    zeigen(fertig(mitglieder('AAAAAA', [true, true], 10)));
    oeffnen();
    fireEvent.click(within(karte('Lena Beispiel, 7')).getByRole('button', { name: 'Absagen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ja, absagen' }));
    expect(fensterKnoepfe()).toEqual(['Fenster schließen', 'Abbrechen', 'Einen Moment …']);
    for (const name of ['Fenster schließen', 'Abbrechen'])
      expect(screen.getByRole('button', { name })).toHaveProperty('disabled', true);
  });

  it('ohne Recht keine Knöpfe zum Nachrücken oder Absagen', () => {
    zeigen(fertig(), 10, false, false);
    expect(screen.queryByRole('button', { name: 'Lena nachrücken lassen' })).toBeNull();
    oeffnen();
    expect(screen.queryByRole('button', { name: 'Nachrücken lassen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Absagen' })).toBeNull();
  });
});

describe('Anmeldung von Hand (A7-4a)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = () => Promise.resolve() as unknown as void;
    mm.gruppenfelderLaden.mockResolvedValue(FELDER);
    hm.meinName.mockResolvedValue('Alwin Friesen');
    hm.personenSuchen.mockResolvedValue([
      { personId: 10, vor: 'Jonas', nach: 'Beispiel', geburtstag: '2017-05-01', email: null },
      { personId: 50, vor: 'Paul', nach: 'Probe', geburtstag: '2016-04-03', email: null },
    ]);
  });
  afterEach(() => {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });
  const feld = (id: string) => document.getElementById(id) as HTMLInputElement;
  const tippen = (id: string, wert: string) =>
    fireEvent.change(feld(id), { target: { value: wert } });

  it('suchen → wer dabei ist, ist gesperrt; wartet jemand, kommt Paul hinten an – oder bekommt trotzdem einen Platz', async () => {
    const zurueck = vi.fn().mockResolvedValue(undefined);
    hm.vonHandAnmelden.mockResolvedValue({ personId: 50, warteplatz: null, rueckgaengig: zurueck });
    const z = zeigen(fertig());
    fireEvent.click(screen.getByRole('button', { name: '＋ Von Hand' }));
    // Fenster wie ChurchTools (E6-O F4): erst suchen – unten nur „Abbrechen“.
    expect(fensterKnoepfe().at(-1)).toBe('Abbrechen');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Name' }), {
      target: { value: 'Probe' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    const jonas = await screen.findByRole('button', { name: /Jonas Beispiel/ });
    expect([(jonas as HTMLButtonElement).disabled, jonas.textContent]).toEqual([
      true,
      expect.stringMatching(/schon dabei/),
    ]);
    fireEvent.click(screen.getByRole('button', { name: /Paul Probe/ }));

    expect(screen.getByText('Paul Probe anmelden')).toBeTruthy();
    // Ohne eingerichtete Mails (A9-1): ChurchTools schickt nichts.
    expect(screen.getByText(/keine Mail – danach gibt es „Mail schreiben“/)).toBeTruthy();
    expect(fensterKnoepfe().slice(-2)).toEqual(['Zurück', 'Anmelden']);
    expect(fensterKnoepfe()).not.toContain('Abbrechen');
    // Name aus ChurchTools – gesperrt; Unterschrift gibt es nur als Schalter.
    expect(feld('af-personen.0.pname-vor').disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Unterschrift liegt auf Papier vor' })).toBeTruthy();
    // Lena wartet → Paul käme hinten an.
    expect(screen.getByText('Warteliste 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Trotzdem einen Platz geben/ }));
    expect(screen.getByText('einen Platz')).toBeTruthy();
    expect(within(screen.getByRole('dialog')).getByText('Betrag').nextSibling?.textContent).toBe(
      '6,00 €',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
    expect(screen.getByText('Bitte die markierten Felder ausfüllen.')).toBeTruthy();
    expect(hm.vonHandAnmelden).not.toHaveBeenCalled();

    tippen('af-anmeldung.name-vor', 'Petra');
    tippen('af-anmeldung.name-nach', 'Probe');
    tippen('af-anmeldung.tel', '0170 1');
    tippen('af-anmeldung.eltern-0-vor', 'Petra');
    tippen('af-anmeldung.eltern-0-nach', 'Probe');
    tippen('af-anmeldung.eltern-0-tel', '0170 1');
    fireEvent.click(screen.getByLabelText(/einverstanden/));
    fireEvent.click(screen.getByRole('radio', { name: 'Ja' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unterschrift liegt auf Papier vor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
    await waitFor(() => expect(z.onGespeichert).toHaveBeenCalled());

    const [gruppe, plan] = hm.vonHandAnmelden.mock.calls[0];
    const x = e();
    expect(gruppe).toBe(165);
    expect(plan.person).toEqual({ art: 'da', personId: 50, geburtstagNachtragen: null });
    expect(plan.platz).toMatchObject({ status: 'active', neuesMax: null });
    expect(plan.felder[x.ctFelder.betrag]).toBe('6,00 €');
    expect(plan.felder[x.ctFelder.kontakt]).toBe('Petra Probe');
    expect(plan.felder[x.ctFelder.sign]).toMatch(/^✓ auf Papier – vermerkt von Alwin Friesen, /);
    expect(plan.felder[plan.nrFeld!]).toMatch(/^[2-9A-Z]{6}$/);
  });

  it('mit Bestätigungsmails (A9-1): Von Hand nennt die Bestätigung statt „keine Mail“', async () => {
    zeigen(fertig(), 10, false, true, true);
    fireEvent.click(screen.getByRole('button', { name: '＋ Von Hand' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Name' }), {
      target: { value: 'Probe' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    fireEvent.click(await screen.findByRole('button', { name: /Paul Probe/ }));
    expect(screen.getByText(/schickt die Bestätigung an die E-Mail-Adresse/)).toBeTruthy();
    expect(screen.queryByText(/keine Mail/)).toBeNull();
  });

  it('neue Person: gleicher Name → „dieselbe Person?“; trotzdem neu → Hinweis, dass sie in ChurchTools bleibt', async () => {
    hm.personenSuchen.mockResolvedValue([]);
    hm.gleichNamige.mockResolvedValue([
      { personId: 77, vor: 'Nina', nach: 'Neu', geburtstag: null, email: null },
    ]);
    hm.vonHandAnmelden.mockResolvedValue({ personId: 200, warteplatz: 2, rueckgaengig: vi.fn() });
    zeigen(fertig());
    fireEvent.click(screen.getByRole('button', { name: '＋ Von Hand' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Name' }), {
      target: { value: 'Nina Neu' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    fireEvent.click(await screen.findByRole('button', { name: /neue Person anlegen/ }));
    expect(
      [screen.getByLabelText('Vorname'), screen.getByLabelText('Nachname')].map(
        (x) => (x as HTMLInputElement).value,
      ),
    ).toEqual(['Nina', 'Neu']);
    expect(fensterKnoepfe().slice(-2)).toEqual(['Zurück', 'Weiter']);
    expect(fensterKnoepfe()).not.toContain('Abbrechen');
    fireEvent.change(screen.getByLabelText('Geburtsdatum'), { target: { value: '2017-01-02' } });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(await screen.findByText(/In ChurchTools gibt es schon Nina Neu\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Nina Neu.*Diese nehmen/ })).toBeTruthy();
    expect(fensterKnoepfe().slice(-2)).toEqual(['Zurück', 'Trotzdem neu anlegen']);
    fireEvent.click(screen.getByRole('button', { name: 'Trotzdem neu anlegen' }));
    expect(screen.getByText('Nina Neu anmelden')).toBeTruthy();
  });
});

describe('Person dazu (A7-4b)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = () => Promise.resolve() as unknown as void;
    mm.gruppenfelderLaden.mockResolvedValue(FELDER);
    hm.personenSuchen.mockResolvedValue([
      { personId: 50, vor: 'Paul', nach: 'Beispiel', geburtstag: '2018-04-03', email: null },
    ]);
  });
  afterEach(() => {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it('aus dem Fenster der Anmeldung: nur die Fragen der Person, gleiche Nr., eigene Zahlung; Abbrechen führt zurück', async () => {
    hm.vonHandAnmelden.mockResolvedValue({ personId: 50, warteplatz: null, rueckgaengig: vi.fn() });
    const z = zeigen(fertig());
    fireEvent.click(screen.getByRole('button', { name: /Maria Beispiel/ }));
    fireEvent.click(screen.getByRole('button', { name: '＋ Person dazu' }));
    expect(screen.getByText('Person zur Anmeldung dazu')).toBeTruthy();
    // Abbrechen → zurück in die Anmeldung.
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.getByRole('button', { name: '＋ Person dazu' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '＋ Person dazu' }));

    fireEvent.change(screen.getByRole('searchbox', { name: 'Name' }), {
      target: { value: 'Paul' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    fireEvent.click(await screen.findByRole('button', { name: /Paul Beispiel/ }));
    expect(screen.getByText(/zur Anmeldung von Maria Beispiel · Anmelde-Nr\. AAAAAA/)).toBeTruthy();
    expect(screen.queryByText('Für die Anmeldung')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Unterschrift liegt auf Papier vor' })).toBeNull();
    // Lena wartet → Paul käme hinten an; trotzdem einen Platz → eigene Zahlung.
    expect(screen.getByText('Neue Zahlung für Paul').nextSibling?.textContent).toBe(
      'folgt beim Nachrücken',
    );
    fireEvent.click(screen.getByRole('button', { name: /Trotzdem einen Platz geben/ }));
    expect(screen.getByText('Neue Zahlung für Paul').nextSibling?.textContent).toBe('6,00 €');
    fireEvent.click(screen.getByRole('radio', { name: 'Ja' }));
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
    await waitFor(() => expect(z.onGespeichert).toHaveBeenCalled());

    const plan = hm.vonHandAnmelden.mock.calls.at(-1)![1];
    const x = e();
    expect(plan.felder[plan.nrFeld!]).toBe('AAAAAA');
    expect(plan.felder[x.ctFelder.kontakt]).toBeUndefined();
    expect(plan.felder[x.ctFelder.betrag]).toBe('6,00 €');
    expect(plan.felder[x.ctFelder.aufschluesselung]).toMatch(/^Dazu angemeldet am /);
  });

  it('ohne Anmelde-Nr. (ältere Anmeldung) gibt es „Person dazu“ nicht', () => {
    zeigen(fertig(mitglieder(undefined, [true, false], 10)));
    fireEvent.click(screen.getAllByRole('button', { name: /Maria Beispiel/ })[0]);
    expect(screen.queryByRole('button', { name: '＋ Person dazu' })).toBeNull();
  });
});

describe('Zurückholen (A7-4c)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = () => Promise.resolve() as unknown as void;
    mm.gruppenfelderLaden.mockResolvedValue(FELDER);
    hm.vonHandAnmelden.mockResolvedValue({ personId: 11, warteplatz: null, rueckgaengig: vi.fn() });
  });
  afterEach(() => {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });
  const mitAbsage = () => {
    const [jonas, lena] = mitglieder('AAAAAA', [true, false], 10);
    return fertig(
      [jonas],
      [dazu(10, '2026-10-17'), dazu(11, '2026-10-17'), absage(lena, '2026-10-19', 1)],
    );
  };

  it('Filter „Abgesagt“: Zeile anklicken → Rückfrage mit Platz und eigener Zahlung → zurück mit den alten Antworten', async () => {
    const z = zeigen(mitAbsage());
    fireEvent.click(screen.getByRole('button', { name: /Abgesagt/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Lena Beispiel' }));
    expect(screen.getByText('Lena Beispiel zurückholen?')).toBeTruthy();
    // Solange die Felder laden, steht nicht kurz der Satz für „allein“ da.
    expect(screen.queryByText(/Kontakt, Unterschrift, Fragen/)).toBeNull();
    expect(await screen.findByText(/in die Anmeldung von Maria Beispiel/)).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByText('Neue Zahlung für Lena').nextSibling?.textContent).toBe('6,00 €'),
    );
    expect(fensterKnoepfe()).toEqual(['Fenster schließen', 'Abbrechen', 'Zurückholen']);
    fireEvent.click(screen.getByRole('button', { name: 'Zurückholen' }));
    await waitFor(() => expect(z.onGespeichert).toHaveBeenCalled());
    const [, plan] = hm.vonHandAnmelden.mock.calls.at(-1)!;
    const x = e();
    expect(plan.person).toEqual({ art: 'da', personId: 11, geburtstagNachtragen: null });
    expect([plan.felder[x.ctFelder.foto], plan.felder[plan.nrFeld!]]).toEqual(['114', 'AAAAAA']);
    expect(plan.felder[x.ctFelder.aufschluesselung]).toMatch(/^Zurückgeholt am /);
  });

  it.each([
    [false, 'ohne Abläufe: danach „Mail schreiben“'],
    [true, 'mit Bestätigungsmails (A9-2b): danach kein „Mail schreiben“'],
  ])('Zurückholen %s – %s', async (mitBestaetigung) => {
    const z = zeigen(mitAbsage(), 10, false, true, mitBestaetigung);
    fireEvent.click(screen.getByRole('button', { name: /Abgesagt/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Lena Beispiel' }));
    await waitFor(() =>
      expect(screen.getByText('Neue Zahlung für Lena').nextSibling?.textContent).toBe('6,00 €'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zurückholen' }));
    await waitFor(() => expect(z.onGespeichert).toHaveBeenCalled());
    const zeile = await screen.findByRole('status');
    expect(zeile.textContent).toMatch(/Lena Beispiel ist zurück/);
    expect(!!within(zeile).queryByRole('button', { name: 'Mail schreiben' })).toBe(
      !mitBestaetigung,
    );
  });

  it('eigene Zahlung einer Zurückgeholten: Titel „– zurückgeholt“, nicht „Anmeldung (…)“', () => {
    const x = e();
    const roh = mitglieder('AAAAAA', [true, false], 10);
    roh[1].groupMemberStatus = 'active';
    roh[1].fields!.push(
      { id: x.ctFelder.betrag, value: '6,00 €' },
      { id: x.ctFelder.aufschluesselung, value: 'Zurückgeholt am 22.10.2026\nFür Lena: 6,00 €' },
    );
    zeigen(fertig(roh));
    fireEvent.click(screen.getByRole('button', { name: /Maria Beispiel/ }));
    expect(screen.getByText('Lena – zurückgeholt')).toBeTruthy();
    expect(screen.getByText('Gilt nur für Lena.')).toBeTruthy();
  });

  it('im Fenster der Anmeldung unter „Abgesagt“; Abbrechen führt zurück in die Anmeldung', () => {
    zeigen(mitAbsage());
    fireEvent.click(screen.getByRole('button', { name: /Maria Beispiel/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Zurückholen' }));
    expect(screen.getByText('Lena Beispiel zurückholen?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.getByRole('button', { name: '＋ Person dazu' })).toBeTruthy();
  });

  it('in der Suche von „Von Hand“: wer abgesagt hat, wird zurückgeholt statt neu angemeldet', async () => {
    hm.personenSuchen.mockResolvedValue([
      { personId: 11, vor: 'Lena', nach: 'Beispiel', geburtstag: '2019-02-02', email: null },
    ]);
    zeigen(mitAbsage());
    fireEvent.click(screen.getByRole('button', { name: '＋ Von Hand' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Name' }), {
      target: { value: 'Lena' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    fireEvent.click(await screen.findByRole('button', { name: /Lena Beispiel.*zurückholen/ }));
    expect(screen.getByText('Lena Beispiel zurückholen?')).toBeTruthy();
    expect(await screen.findByText(/keine Mail – danach gibt es „Mail schreiben“/)).toBeTruthy();
  });

  it('mit Bestätigungsmails (A9-1): Zurückholen nennt die Bestätigung statt „keine Mail“', async () => {
    hm.personenSuchen.mockResolvedValue([
      { personId: 11, vor: 'Lena', nach: 'Beispiel', geburtstag: '2019-02-02', email: null },
    ]);
    zeigen(mitAbsage(), 10, false, true, true);
    fireEvent.click(screen.getByRole('button', { name: '＋ Von Hand' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Name' }), {
      target: { value: 'Lena' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    fireEvent.click(await screen.findByRole('button', { name: /Lena Beispiel.*zurückholen/ }));
    expect(await screen.findByText(/schickt die Bestätigung an die E-Mail-Adresse/)).toBeTruthy();
    expect(screen.queryByText(/keine Mail/)).toBeNull();
  });

  it('ohne Recht zum Ändern: Zeile nur zum Ansehen', () => {
    zeigen(mitAbsage(), 10, false, false);
    fireEvent.click(screen.getByRole('button', { name: /Abgesagt/ }));
    expect(screen.queryByRole('button', { name: /Lena Beispiel/ })).toBeNull();
  });
});

describe('Mehrere Zahlungen', () => {
  it('eigene Zahlung (dazu angemeldet): eigener Titel, „gilt nur für“ statt „für die ganze Anmeldung“', () => {
    const x = e();
    const roh = mitglieder('AAAAAA', [true, false], 10);
    roh[1].groupMemberStatus = 'active';
    roh[1].waitinglistPosition = null;
    roh[1].fields!.push(
      { id: x.ctFelder.betrag, value: '6,00 €' },
      {
        id: x.ctFelder.aufschluesselung,
        value: 'Dazu angemeldet am 22.10.2026\nFür Lena: 6,00 €',
      },
    );
    zeigen(fertig(roh));
    fireEvent.click(screen.getByRole('button', { name: /Maria Beispiel/ }));
    expect(screen.getByText('Lena – dazu angemeldet')).toBeTruthy();
    expect(screen.getAllByText('Gilt für die ganze Anmeldung.')).toHaveLength(1);
    expect(screen.getByText('Gilt nur für Lena.')).toBeTruthy();
  });
});

describe('Mail schreiben', () => {
  const mail: Mail = { an: null, betreff: 'Kinderfreizeit: Anmeldung für Paula', text: 'Hallo' };
  const mitKnoepfen = (m: Mail) =>
    render(
      <>
        <MailAnsicht mail={m} kopiert={null} />
        <MailKnoepfe mail={m} onZurueck={() => {}} onKopiert={() => {}} />
      </>,
    );

  it('ohne E-Mail-Adresse: kein Knopf zum Mailprogramm, dafür der Hinweis zum Kopieren', () => {
    mitKnoepfen(mail);
    expect(screen.queryByRole('link', { name: 'Im Mailprogramm öffnen' })).toBeNull();
    expect(screen.getByText(/Ohne E-Mail-Adresse: Text kopieren/)).toBeTruthy();
    cleanup();
    mitKnoepfen({ ...mail, an: 'friesen.alwin+a7h@ecg-donrath.de' });
    expect(screen.getByText(/Öffnet dein Mailprogramm/)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Im Mailprogramm öffnen' }).getAttribute('href'),
    ).toMatch(/^mailto:friesen\.alwin%2Ba7h%40ecg-donrath\.de\?/);
  });

  it('Kopieren: das Ergebnis meldet die Ansicht – gelungen oder mit Hinweis zum Markieren', async () => {
    const kopiert = vi.fn();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<MailKnoepfe mail={mail} onZurueck={() => {}} onKopiert={kopiert} />);
    fireEvent.click(screen.getByRole('button', { name: 'Text kopieren' }));
    await waitFor(() => expect(kopiert).toHaveBeenCalledWith('ja'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'Kinderfreizeit: Anmeldung für Paula\n\nHallo',
    );
    cleanup();
    render(<MailAnsicht mail={mail} kopiert="nein" />);
    expect(screen.getByText(/Kopieren ging nicht/)).toBeTruthy();
  });
});

describe('Rundmail (A7-5)', () => {
  const CT = new Map([
    ['Angemeldet von', '{{{groupMemberField.angemeldet-von}}}'],
    ['Anmelde-Nr.', '{{{groupMemberField.anmelde-nr-}}}'],
    ['Betrag', '{{{groupMemberField.betrag}}}'],
  ]);
  beforeEach(() => {
    rm.platzhalterLaden.mockResolvedValue(CT);
    rm.rundmailSenden.mockResolvedValue({ bestaetigt: 1 });
  });

  it('Zahlungserinnerung an „Zahlung offen“: je Anmeldung eine Mail, Platzhalter für ChurchTools, Rückfrage, verschickt', async () => {
    zeigen(fertig());
    fireEvent.click(screen.getByRole('button', { name: /Zahlung offen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Rundmail' }));
    // Aus dem Filter „Zahlung offen“ → gleich mit der Zahlungserinnerung.
    expect(screen.getByLabelText<HTMLInputElement>('Betreff').value).toBe(
      'Kinderfreizeit: Bitte noch überweisen',
    );
    expect(screen.getByText(/1 Mail/)).toBeTruthy();
    // Platzhalter der Person gelten für die, an die die Mail geht (echter Test 22.10.2026).
    expect(screen.getByText(/gelten für die Person, an die die Mail geht/)).toBeTruthy();
    const senden = screen.getByRole<HTMLButtonElement>('button', { name: 'Senden …' });
    await waitFor(() => expect(senden.disabled).toBe(false));
    // Fenster wie ChurchTools (E6-O F4): „Vorschau“ als zweiter Weg, „Senden …“ zuletzt.
    expect(fensterKnoepfe().slice(-3)).toEqual(['Abbrechen', 'Vorschau', 'Senden …']);
    fireEvent.click(senden);
    expect(screen.getByText('1 Mail jetzt senden?')).toBeTruthy();
    expect(fensterKnoepfe()).toEqual(['Fenster schließen', 'Zurück', 'Ja, 1 Mail senden']);
    fireEvent.click(screen.getByRole('button', { name: 'Ja, 1 Mail senden' }));
    await screen.findByText(/laut Protokoll von ChurchTools übernommen/);
    expect(fensterKnoepfe()).toEqual(['Fenster schließen', 'Schließen']);
    const [gruppe, an, betreff, html] = rm.rundmailSenden.mock.calls[0];
    expect([gruppe, an, betreff]).toEqual([
      165,
      [{ personId: 10, email: 'maria@beispiel.test' }],
      'Kinderfreizeit: Bitte noch überweisen',
    ]);
    expect(html).toMatch(/^<p>Hallo \{\{\{groupMemberField\.angemeldet-von\}\}\},<\/p>/);
    expect(html).toContain('{{{groupMemberField.betrag}}}');
  });

  it('unbekannter Platzhalter → Hinweis, Senden gesperrt; eigener Text wird nicht still durch eine Vorlage ersetzt', async () => {
    zeigen(fertig());
    fireEvent.click(screen.getByRole('button', { name: 'Rundmail' }));
    await waitFor(() => expect(rm.platzhalterLaden).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Betreff'), { target: { value: 'Hallo' } });
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Größe: [Schuhgröße]' } });
    expect(
      await screen.findByText(/Diese Platzhalter kennt ChurchTools hier nicht: \[Schuhgröße\]/),
    ).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Senden …' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Infos vorab' }));
    expect(screen.getByText(/Deinen Text durch die Vorlage ersetzen\?/)).toBeTruthy();
    expect(screen.getByLabelText<HTMLTextAreaElement>('Text').value).toBe('Größe: [Schuhgröße]');
    fireEvent.click(screen.getByRole('button', { name: 'Ja, ersetzen' }));
    expect(screen.getByLabelText<HTMLTextAreaElement>('Text').value).toMatch(
      /^Hallo \[Angemeldet von\],/,
    );
  });

  it('Vorschau (E6-O F4): unten „Zurück · Senden …“, ganz zu nur über das X', async () => {
    rm.vorschauLaden.mockResolvedValue({ betreff: 'Kinderfreizeit', html: '<p>Hallo</p>' });
    zeigen(fertig());
    fireEvent.click(screen.getByRole('button', { name: /Zahlung offen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Rundmail' }));
    const vorschau = screen.getByRole<HTMLButtonElement>('button', { name: 'Vorschau' });
    await waitFor(() => expect(vorschau.disabled).toBe(false));
    fireEvent.click(vorschau);
    await screen.findByTitle('Vorschau der Mail');
    expect(fensterKnoepfe().slice(-2)).toEqual(['Zurück', 'Senden …']);
    expect(fensterKnoepfe()).not.toContain('Abbrechen');
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(screen.getByLabelText('Betreff')).toBeTruthy();
  });

  it('unklar, ob verschickt → Meldung, kein zweites Senden', async () => {
    rm.rundmailSenden.mockRejectedValue(
      Object.assign(new R.UnklarObVerschickt(), { message: 'unklar – bitte erst nachsehen' }),
    );
    zeigen(fertig());
    fireEvent.click(screen.getByRole('button', { name: 'Rundmail' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zahlungserinnerung' }));
    const senden = screen.getByRole<HTMLButtonElement>('button', { name: 'Senden …' });
    await waitFor(() => expect(senden.disabled).toBe(false));
    fireEvent.click(senden);
    const ja = screen.getByRole('button', { name: 'Ja, 1 Mail senden' });
    fireEvent.click(ja);
    expect(await screen.findByText('unklar – bitte erst nachsehen')).toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Ja, 1 Mail senden' }).disabled,
    ).toBe(true);
  });
});

describe('Druckliste (A8-1)', () => {
  // Seit E6-O F4 ist das Fenster ein „dialog“ – gesucht wird nur darin, nicht auf der Seite dahinter.
  const fenster = () => screen.getByRole('dialog');
  // Das PDF ist fertig, sobald „Teilen …“ geht – nach jeder Änderung wird es neu gebaut.
  const pdfFertig = () =>
    waitFor(() =>
      expect(
        within(fenster()).getByRole<HTMLButtonElement>('button', { name: 'Teilen …' }).disabled,
      ).toBe(false),
    );
  const oeffnen = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Druckliste' }));
    await pdfFertig();
  };

  it('Vorschau mit Platz; Warteliste zuschaltbar; unverändert herunterladen merkt nichts', async () => {
    zeigen(fertig());
    await oeffnen();
    const vorschau = within(fenster()).getByLabelText('Vorschau');
    expect(within(vorschau).getByText('Beispiel, Jonas')).toBeTruthy();
    expect(within(vorschau).queryByText('1. Beispiel, Lena')).toBeNull();
    fireEvent.click(within(fenster()).getByRole('button', { name: 'Auch Warteliste (2)' }));
    expect(within(vorschau).getByText('1. Beispiel, Lena')).toBeTruthy();
    await pdfFertig();
    // Fenster wie ChurchTools (E6-O F4): beide Wege unten, „Teilen …“ zuletzt; „Heruntergeladen“ steht im Inhalt.
    expect(fensterKnoepfe().slice(-3)).toEqual(['Abbrechen', 'Herunterladen', 'Teilen …']);
    fireEvent.click(within(fenster()).getByRole('button', { name: 'Herunterladen' }));
    await waitFor(() => expect(tm.downloadPdf).toHaveBeenCalledTimes(1));
    expect(within(fenster()).getByRole('status').textContent).toBe('Heruntergeladen');
    expect(tm.downloadPdf.mock.calls[0][1]).toBe('Kinderfreizeit – Teilnehmer');
    expect(em.aendereEinstellungen).not.toHaveBeenCalled();
  });

  it('andere Spalten → beim Teilen gemerkt; ohne Recht nicht', async () => {
    const r = zeigen(fertig());
    await oeffnen();
    fireEvent.click(within(fenster()).getByRole('button', { name: 'Telefon' }));
    await pdfFertig();
    fireEvent.click(within(fenster()).getByRole('button', { name: 'Teilen …' }));
    expect(tm.sharePdf).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(r.onGespeichert).toHaveBeenCalled());
    const aendern = em.aendereEinstellungen.mock.calls[0][1];
    expect(aendern(e()).druck).toEqual({
      spalten: ['alter', 'kontakt', 'frage:tel'],
      sortierung: 'nachname',
    });

    cleanup();
    em.aendereEinstellungen.mockClear();
    zeigen(fertig(), 10, false, false);
    await oeffnen();
    fireEvent.click(within(fenster()).getByRole('button', { name: 'Telefon' }));
    await pdfFertig();
    fireEvent.click(within(fenster()).getByRole('button', { name: 'Teilen …' }));
    expect(em.aendereEinstellungen).not.toHaveBeenCalled();
  });

  it('Listen nach dem Formular, „＋ weitere“ öffnet den Rest mit Hinweis (A8-2)', async () => {
    zeigen(fertig());
    await oeffnen();
    // Kinder-Event: Küche und Abholliste passen, Zimmer (keine Auswahl im Preis) erst hinter „＋ weitere“.
    expect(screen.getByRole('button', { name: 'Küche & Allergien' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Zimmer' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Abholliste' }));
    await pdfFertig();
    expect(
      within(screen.getByLabelText('Vorschau')).getByText('Abgeholt von / Uhrzeit'),
    ).toBeTruthy();
    // Spalten gibt es nur bei den Teilnehmern (im Fenster – die Tabelle dahinter hat ihre eigene Spalte „Telefon“).
    expect(
      within(screen.getByRole('dialog')).queryByRole('button', { name: 'Telefon' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '＋ weitere' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zimmer' }));
    expect(screen.getByText(/Im Preis gibt es keine Auswahl/)).toBeTruthy();
    await pdfFertig();
    fireEvent.click(screen.getByRole('button', { name: 'Herunterladen' }));
    await waitFor(() => expect(tm.downloadPdf).toHaveBeenCalled());
    expect(tm.downloadPdf.mock.calls.at(-1)![1]).toBe('Kinderfreizeit – Zimmer');
  });
});
