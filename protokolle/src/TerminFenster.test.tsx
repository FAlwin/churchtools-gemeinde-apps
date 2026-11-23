// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { TerminZeile } from '@shared/protokolle/termine';
import * as K from './terminAnlegen';
import * as V from './terminVorlagenLesen';
import { TerminFenster } from './TerminFenster';

/** Das Fenster „In Kalender eintragen“ allein (W14): Welcher Kalender vorausgewählt ist und was ein Wechsel auslöst. */
vi.mock('./kalenderListe', () => ({
  ladeSchreibKalender: vi.fn(() =>
    Promise.resolve([
      { id: 4, name: 'Gemeindeleitung' },
      { id: 2, name: 'Gottesdienst' },
    ]),
  ),
}));
vi.mock('./terminAnlegen', async (orig) => ({
  ...(await orig<typeof import('./terminAnlegen')>()),
  kalenderTermineAmTag: vi.fn(),
}));
vi.mock('./terminEintragen', () => ({ terminLegen: vi.fn(), NICHT_NACHGELESEN: 'x' }));
vi.mock('./terminStandSchreiben', () => ({ terminVermerken: vi.fn() }));
vi.mock('./terminVorlagenLesen', async (orig) => ({
  ...(await orig<typeof import('./terminVorlagenLesen')>()),
  ladeVorlagen: vi.fn(),
  ladeTags: vi.fn(() => Promise.resolve([])),
  vorlageSpeichern: vi.fn(),
}));

const tag = vi.mocked(K.kalenderTermineAmTag);
const vorlagenLesen = vi.mocked(V.ladeVorlagen);
const vorlage = (id: number, kalender: number, titel: string, extra = {}) => ({
  id,
  kalender,
  titel,
  untertitel: '',
  beschreibung: '',
  link: '',
  intern: false,
  ganztaegig: false,
  startzeit: '10:00',
  dauer: 3600,
  art: 0,
  frequenz: 1,
  option: 0,
  wiederDauer: 0,
  adresse: null,
  tags: [],
  imAuftrag: null,
  ...extra,
});
const ZEILE: TerminZeile = {
  schluessel: 'termin-s-b',
  gruppe: { id: 11, name: 'Leitungsteam' },
  sitzung: { id: 's', schluessel: 'p:s', titel: 'Festplanung', beginn: '2026-11-21T18:00:00Z' },
  blockId: 'b',
  text: 'Heiligabend, 16 Uhr',
  datum: '2027-12-24',
  punkt: null,
};

const zeigen = (gruppenKalender: number | null) =>
  render(
    <TerminFenster
      zeile={ZEILE}
      gruppenKalender={gruppenKalender}
      schreibbar={[4, 2]}
      ort={{ modul: 24, kategorie: 61 }}
      ich={1}
      zeitzone="Europe/Berlin"
      onFertig={vi.fn()}
      onClose={vi.fn()}
    />,
  );
const kalenderWahl = async () => await screen.findByLabelText<HTMLSelectElement>('Kalender');

beforeEach(() => {
  tag.mockResolvedValue([]);
  vorlagenLesen.mockResolvedValue([
    vorlage(1, 4, 'Leitungssitzung'),
    vorlage(2, 2, 'Gottesdienst'),
  ]);
});
afterEach(cleanup);

describe('Kalender im Fenster', () => {
  it('vorausgewählt ist der Kalender der Gruppe, wenn man dort eintragen darf – auch wenn er nicht der erste ist', async () => {
    zeigen(2);
    await waitFor(async () => expect((await kalenderWahl()).value).toBe('2'));
    expect(tag).toHaveBeenCalledWith(2, '2027-12-24');
  });

  it('darf man im Kalender der Gruppe nicht eintragen (oder gibt es keinen), gilt der erste der Liste', async () => {
    zeigen(9);
    await waitFor(async () => expect((await kalenderWahl()).value).toBe('4'));
    cleanup();
    zeigen(null);
    await waitFor(async () => expect((await kalenderWahl()).value).toBe('4'));
  });

  it('ein anderer Kalender: der Tag wird dort noch einmal geprüft – und „Trotzdem neu“ gilt nicht mehr', async () => {
    tag.mockImplementation((kalender) =>
      Promise.resolve(
        kalender === 4
          ? [{ id: 161, titel: 'Heiligabend – Familiengottesdienst', beginn: '' }]
          : [],
      ),
    );
    zeigen(4);
    const f = await screen.findByRole('dialog', { name: 'In Kalender eintragen' });
    await within(f).findByText(/schon „Heiligabend – Familiengottesdienst“/);
    fireEvent.click(within(f).getByLabelText(/Trotzdem neu anlegen/));
    fireEvent.change(await kalenderWahl(), { target: { value: '2' } });
    await waitFor(() => expect(within(f).queryByText(/schon „/)).toBeNull());
    fireEvent.change(await kalenderWahl(), { target: { value: '4' } });
    await within(f).findByText(/schon „Heiligabend/);
    // Zurück im ersten Kalender: wieder „Nur verknüpfen“ vorgewählt, nicht das frühere „Trotzdem“.
    expect(within(f).getByLabelText<HTMLInputElement>(/Nur verknüpfen/).checked).toBe(true);
  });
});

/** Das Formular wie im ChurchTools-Dialog: Felder erscheinen und verschwinden mit Ganztägig und Wiederholung (W15-1). */
describe('Felder des Formulars', () => {
  const fenster = async () => {
    zeigen(4);
    return await screen.findByRole('dialog', { name: 'In Kalender eintragen' });
  };
  const art = (f: HTMLElement, wert: string) =>
    fireEvent.change(within(f).getByLabelText('Wiederholungen'), { target: { value: wert } });

  it('die Reihenfolge der Felder wie in ChurchTools', async () => {
    const f = await fenster();
    const namen = [...f.querySelectorAll('label > span, [role="group"][aria-label]')].map(
      (n) => n.getAttribute('aria-label') ?? n.textContent,
    );
    const reihenfolge = [
      'Kalender',
      'Titel *',
      'Untertitel',
      'Nur für eingeloggte Personen sichtbar',
      'Ganztägig',
      'Beginn',
      'Ende',
      'Wiederholungen',
      'Beschreibung',
      'Link',
      'Ort',
      'Tags',
    ];
    const stellen = reihenfolge.map((n) => namen.indexOf(n));
    expect(stellen.every((x) => x >= 0)).toBe(true);
    expect([...stellen].sort((a, b) => a - b)).toEqual(stellen);
  });

  it('Ganztägig: Stunde und Minute fallen weg, die Daten bleiben', async () => {
    const f = await fenster();
    expect(within(f).getByLabelText('Beginn Stunde')).toBeTruthy();
    fireEvent.click(within(f).getByLabelText('Ganztägig'));
    expect(within(f).queryByLabelText('Beginn Stunde')).toBeNull();
    expect(within(f).queryByLabelText('Ende Minute')).toBeNull();
    expect(within(f).getByLabelText('Beginn Datum')).toBeTruthy();
    expect(within(f).getByLabelText('Ende Datum')).toBeTruthy();
  });

  it('Keine Wiederholung: weder Bis noch Weitere Termine noch Ausnahmen', async () => {
    const f = await fenster();
    expect(within(f).queryByLabelText('Wiederholen bis')).toBeNull();
    expect(within(f).queryByRole('group', { name: 'Weitere Termine' })).toBeNull();
    expect(within(f).queryByRole('group', { name: 'Ausnahmen' })).toBeNull();
  });

  it.each([['1'], ['7'], ['31'], ['32'], ['365']])(
    'automatische Art %s: Bis und „Alle x“, dazu Weitere Termine und Ausnahmen',
    async (wert) => {
      const f = await fenster();
      art(f, wert);
      expect(within(f).getByLabelText<HTMLInputElement>('Wiederholen bis').value).not.toBe('');
      expect(within(f).getByLabelText<HTMLInputElement>('Alle x').value).toBe('1');
      expect(within(f).getByRole('group', { name: 'Weitere Termine' })).toBeTruthy();
      expect(within(f).getByRole('group', { name: 'Ausnahmen' })).toBeTruthy();
    },
  );

  it('die Einheit hinter „Alle x“ passt zur Art', async () => {
    const f = await fenster();
    for (const [wert, einheit] of [
      ['1', 'Tage'],
      ['7', 'Woche(n)'],
      ['31', 'Monat(e)'],
      ['365', 'Jahr(e)'],
    ]) {
      art(f, wert);
      expect(within(f).getByText(new RegExp(`${einheit.replace(/[()]/g, '\\$&')}$`))).toBeTruthy();
    }
  });

  it('Manuell: kein Bis, kein „Alle x“ – aber Weitere Termine und Ausnahmen', async () => {
    const f = await fenster();
    art(f, '999');
    expect(within(f).queryByLabelText('Wiederholen bis')).toBeNull();
    expect(within(f).queryByLabelText('Alle x')).toBeNull();
    expect(within(f).getByRole('group', { name: 'Weitere Termine' })).toBeTruthy();
    expect(within(f).getByRole('group', { name: 'Ausnahmen' })).toBeTruthy();
  });

  it('Monatlich nach Wochentag: zweite Auswahl mit dem Wochentag des Beginns (24.12.2027 = Freitag, der vierte)', async () => {
    const f = await fenster();
    art(f, '32');
    const w = within(f).getByLabelText<HTMLSelectElement>('Welcher Wochentag im Monat');
    expect([...w.options].map((o) => o.textContent)).toEqual([
      'Erster Freitag im Monat',
      'Zweiter Freitag im Monat',
      'Dritter Freitag im Monat',
      'Vierter Freitag im Monat',
      'Fünfter Freitag im Monat (wenn vorhanden)',
      'Letzter Freitag im Monat',
    ]);
    expect(w.value).toBe('4');
    // Das Datum ändern: die Auswahl rechnet neu (31.12.2027 ist der fünfte Freitag).
    fireEvent.change(within(f).getByLabelText('Beginn Datum'), { target: { value: '2027-12-31' } });
    expect(within(f).getByLabelText<HTMLSelectElement>('Welcher Wochentag im Monat').value).toBe(
      '5',
    );
    art(f, '7');
    expect(within(f).queryByLabelText('Welcher Wochentag im Monat')).toBeNull();
  });

  it('Keine Wiederholung räumt Bis und die Marken wieder weg', async () => {
    const f = await fenster();
    art(f, '999');
    fireEvent.click(within(f).getByRole('button', { name: 'Ausnahmen: Datum hinzufügen' }));
    fireEvent.change(within(f).getByLabelText('Ausnahmen: Datum wählen'), {
      target: { value: '2028-01-07' },
    });
    art(f, '0');
    art(f, '999');
    expect(within(f).queryByText('07.01.2028')).toBeNull();
  });

  it('Beginn nach hinten schieben: das Ende zieht mit', async () => {
    const f = await fenster();
    fireEvent.change(within(f).getByLabelText('Beginn Datum'), { target: { value: '2028-01-02' } });
    expect(within(f).getByLabelText<HTMLInputElement>('Ende Datum').value).toBe('2028-01-02');
  });

  it('Ende vor dem Beginn: Meldung und „Speichern“ gesperrt', async () => {
    const f = await fenster();
    fireEvent.change(within(f).getByLabelText('Ende Stunde'), { target: { value: '15' } });
    expect(await within(f).findByText(/Das Ende muss nach dem Beginn liegen/)).toBeTruthy();
    expect(within(f).getByRole<HTMLButtonElement>('button', { name: 'Speichern' }).disabled).toBe(
      true,
    );
  });

  it('Wiederholung ohne „Bis“: Meldung, nicht speicherbar', async () => {
    const f = await fenster();
    art(f, '7');
    fireEvent.change(within(f).getByLabelText('Wiederholen bis'), { target: { value: '' } });
    expect(await within(f).findByText(/bis wann sich der Termin wiederholt/)).toBeTruthy();
    expect(within(f).getByRole<HTMLButtonElement>('button', { name: 'Speichern' }).disabled).toBe(
      true,
    );
  });

  it('keine Reiterleiste, solange es nur den Reiter „Kalender“ gibt', async () => {
    const f = await fenster();
    expect(within(f).queryByRole('tablist')).toBeNull();
    expect(within(f).queryByText('Besprechungsanfragen')).toBeNull();
  });
});

describe('Termin-Vorlagen im Fenster', () => {
  it('links nur die Vorlagen des gewählten Kalenders – ein Wechsel tauscht die Liste', async () => {
    zeigen(4);
    const f = await screen.findByRole('dialog', { name: 'In Kalender eintragen' });
    const spalte = await within(f).findByRole('complementary', { name: 'Termin-Vorlagen' });
    await within(spalte).findByLabelText('Leitungssitzung');
    expect(within(spalte).queryByLabelText('Gottesdienst')).toBeNull();
    fireEvent.change(await kalenderWahl(), { target: { value: '2' } });
    await within(spalte).findByLabelText('Gottesdienst');
    expect(within(spalte).queryByLabelText('Leitungssitzung')).toBeNull();
    expect(within(spalte).getByText('Termin-Vorlagen Gottesdienst')).toBeTruthy();
  });

  it('eine Vorlage füllt; „Ohne Vorlage“ stellt die Vorbelegung wieder her', async () => {
    vorlagenLesen.mockResolvedValue([
      vorlage(1, 4, 'Leitungssitzung', {
        startzeit: '19:30',
        dauer: 7200,
        art: 7,
        frequenz: 2,
        wiederDauer: 86_400 * 14,
        beschreibung: 'Monatlich',
      }),
    ]);
    zeigen(4);
    const f = await screen.findByRole('dialog', { name: 'In Kalender eintragen' });
    fireEvent.click(await within(f).findByLabelText('Leitungssitzung'));
    expect(within(f).getByLabelText<HTMLInputElement>(/^Titel/).value).toBe('Leitungssitzung');
    expect(within(f).getByLabelText<HTMLSelectElement>('Beginn Stunde').value).toBe('19');
    expect(within(f).getByLabelText<HTMLSelectElement>('Ende Stunde').value).toBe('21');
    expect(within(f).getByLabelText<HTMLInputElement>('Alle x').value).toBe('2');
    expect(within(f).getByLabelText<HTMLInputElement>('Wiederholen bis').value).toBe('2028-01-07');
    expect(within(f).getByLabelText<HTMLTextAreaElement>('Beschreibung').value).toBe('Monatlich');
    fireEvent.click(within(f).getByLabelText('Ohne Vorlage'));
    expect(within(f).getByLabelText<HTMLInputElement>(/^Titel/).value).toBe('Heiligabend');
    expect(within(f).queryByLabelText('Wiederholen bis')).toBeNull();
  });

  it('am Handy ist die Spalte eine Auswahl oben', async () => {
    const echt = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: true,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      zeigen(4);
      const f = await screen.findByRole('dialog', { name: 'In Kalender eintragen' });
      expect(within(f).queryByRole('complementary')).toBeNull();
      const wahl = await within(f).findByLabelText<HTMLSelectElement>('Termin-Vorlage');
      await waitFor(() => expect(wahl.options.length).toBe(2));
      fireEvent.change(wahl, { target: { value: '1' } });
      expect(within(f).getByLabelText<HTMLInputElement>(/^Titel/).value).toBe('Leitungssitzung');
    } finally {
      window.matchMedia = echt;
    }
  });

  it('Vorlagen nicht ladbar: ein Satz und „Vorlagen noch einmal laden“ – das Formular bleibt benutzbar', async () => {
    vorlagenLesen.mockRejectedValueOnce(new Error('weg'));
    zeigen(4);
    const f = await screen.findByRole('dialog', { name: 'In Kalender eintragen' });
    await within(f).findByText('Die Vorlagen konnten nicht geladen werden.');
    expect(within(f).getByLabelText(/^Titel/)).toBeTruthy();
    fireEvent.click(within(f).getByRole('button', { name: 'Vorlagen noch einmal laden' }));
    await within(f).findByLabelText('Leitungssitzung');
  });
});
