// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AnmeldungenReiter, type MitgliederZustand } from './AnmeldungenReiter';
import { MailAnsicht } from './AnmeldungAktion';
import * as Z from './zahlung';
import * as B from './bewegung';
import * as H from './vonHand';
import * as M from './mitglieder';
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
    />,
  );
  return Object.assign(onNeuLaden, { onGespeichert });
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

  it('alle warten (das Formular schreibt „0,00 €“) → „Betrag beim Nachrücken“ statt „0,00 €“', () => {
    zeigen(fertig(mitglieder('AAAAAA', [false, false], 10)));
    const zeile = screen.getByRole('button', { name: /Maria Beispiel/ });
    expect(zeile.textContent).toMatch(/Betrag beim Nachrücken/);
    expect(zeile.textContent).not.toMatch(/0,00 €/);
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
    expect(screen.getByRole('button', { name: /Maria Beispiel/ }).textContent).toMatch(
      /✓ Bar 18\.10\./,
    );
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
  });

  it('der Knopf im Hinweis oben öffnet gleich die Rückfrage; voll → Plätze erhöhen', () => {
    zeigen(fertig());
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
    fireEvent.click(screen.getByRole('button', { name: 'Ja, absagen' }));
    await waitFor(() => expect(z.onGespeichert).toHaveBeenCalled());
    const zeile = screen.getByRole('status');
    expect(zeile.textContent).toMatch(/^Lena Beispiel ist abgesagt\./);
    expect(within(zeile).getByRole('button', { name: 'Mail schreiben' })).toBeTruthy();
    fireEvent.click(within(zeile).getByRole('button', { name: 'Rückgängig' }));
    await waitFor(() => expect(zurueck).toHaveBeenCalled());
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
    // Name aus ChurchTools – gesperrt; Unterschrift gibt es nur als Schalter.
    expect(feld('af-personen.0.pname-vor').disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Unterschrift liegt auf Papier vor' })).toBeTruthy();
    // Lena wartet → Paul käme hinten an.
    expect(screen.getByText('Warteliste 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Trotzdem einen Platz geben/ }));
    expect(screen.getByText('einen Platz')).toBeTruthy();
    expect(screen.getByText('Betrag').nextSibling?.textContent).toBe('6,00 €');

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
    fireEvent.change(screen.getByLabelText('Geburtsdatum'), { target: { value: '2017-01-02' } });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(await screen.findByText(/In ChurchTools gibt es schon Nina Neu\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Nina Neu.*Diese nehmen/ })).toBeTruthy();
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
    fireEvent.click(screen.getByRole('button', { name: /Lena Beispiel.*Zurückholen/ }));
    expect(screen.getByText('Lena Beispiel zurückholen?')).toBeTruthy();
    // Solange die Felder laden, steht nicht kurz der Satz für „allein“ da.
    expect(screen.queryByText(/Kontakt, Unterschrift, Fragen/)).toBeNull();
    expect(await screen.findByText(/in die Anmeldung von Maria Beispiel/)).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByText('Neue Zahlung für Lena').nextSibling?.textContent).toBe('6,00 €'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zurückholen' }));
    await waitFor(() => expect(z.onGespeichert).toHaveBeenCalled());
    const [, plan] = hm.vonHandAnmelden.mock.calls.at(-1)!;
    const x = e();
    expect(plan.person).toEqual({ art: 'da', personId: 11, geburtstagNachtragen: null });
    expect([plan.felder[x.ctFelder.foto], plan.felder[plan.nrFeld!]]).toEqual(['114', 'AAAAAA']);
    expect(plan.felder[x.ctFelder.aufschluesselung]).toMatch(/^Zurückgeholt am /);
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
  it('ohne E-Mail-Adresse: kein Knopf zum Mailprogramm, dafür der Hinweis zum Kopieren', () => {
    const mail = { an: null, betreff: 'Kinderfreizeit: Anmeldung für Paula', text: 'Hallo' };
    render(<MailAnsicht mail={mail} onZurueck={() => {}} />);
    expect(screen.queryByRole('link', { name: 'Im Mailprogramm öffnen' })).toBeNull();
    expect(screen.getByText(/Ohne E-Mail-Adresse: Text kopieren/)).toBeTruthy();
    cleanup();
    render(
      <MailAnsicht
        mail={{ ...mail, an: 'friesen.alwin+a7h@ecg-donrath.de' }}
        onZurueck={() => {}}
      />,
    );
    expect(screen.getByText(/Öffnet dein Mailprogramm/)).toBeTruthy();
  });
});
