// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { geplanterKopf } from '@shared/protokolle/planen';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import { BLOCKNOTE_DOKUMENT } from '@shared/protokolle/dokument.testdaten';
import { teileBauen, type ProtokollTeil } from '@shared/protokolle/speicher';
import * as B from './bearbeiten';
import * as L from './lesen';
import * as M from './mitglieder';
import { SitzungBearbeiten } from './SitzungBearbeiten';
import { Sitzungen } from './Sitzungen';
import { NaechsteSitzung } from './NaechsteSitzung';

/** Fenster „Sitzung bearbeiten“ (K2b-1, Serien K2b-2) – Schreiben und Lesen sind Attrappen; was sie tun, prüft `bearbeiten.test.ts`. */
vi.mock('./bearbeiten', async (orig) => ({
  ...(await orig<typeof import('./bearbeiten')>()),
  sitzungAendern: vi.fn(),
  sitzungAbsagen: vi.fn(),
  terminStand: vi.fn(),
}));
vi.mock('./mitglieder', () => ({ ladeGruppenMitglieder: vi.fn() }));
vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeSitzungen: vi.fn(),
  ladeAufgaben: vi.fn(() => Promise.resolve([])),
}));

afterEach(cleanup);

const aendern = vi.mocked(B.sitzungAendern);
const absagen = vi.mocked(B.sitzungAbsagen);
const ZONE = 'Europe/Berlin';
const JETZT = new Date('2026-10-29T10:00:00Z');
const BEGINN = '2027-05-26T17:30:00Z';

const SITZUNG: Sitzung = {
  schluessel: 'p:s1',
  beginn: BEGINN,
  ende: '2027-05-26T19:30:00Z',
  titel: 'Leitungssitzung',
  termin: { kalender: 4, id: 70 },
  treffen: 80,
  kopf: geplanterKopf(
    { titel: 'Leitungssitzung', beginn: BEGINN, termin: { kalender: 4, id: 70 }, treffen: 80 },
    's1',
  ),
  anfragen: [
    { person: 1, antwort: 'zugesagt' },
    { person: 19, antwort: 'zugesagt' },
  ],
};

const zeige = (s: Sitzung = SITZUNG, sitzungen: Sitzung[] = [s]) => {
  const onFertig = vi.fn();
  render(
    <SitzungBearbeiten
      gruppe={{ id: 194, name: 'Technik' }}
      modul={24}
      kategorie={62}
      sitzung={s}
      sitzungen={sitzungen}
      ich={{ person: 1 }}
      zeitzone={ZONE}
      jetzt={JETZT}
      onFertig={onFertig}
      onClose={vi.fn()}
    />,
  );
  return onFertig;
};
const speichern = () => screen.getByRole('button', { name: /^Speichern/ });
const bereit = () => waitFor(() => expect(screen.getByLabelText('Titel')).toBeTruthy());

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(B.terminStand).mockResolvedValue({
    roh: { repeatId: 0, signup: null, startDate: BEGINN, endDate: '2027-05-26T19:30:00Z' },
    eingeladen: [1, 19],
    termine: [],
  });
  vi.mocked(M.ladeGruppenMitglieder).mockResolvedValue([
    { id: 1, name: 'Alwin Friesen', bild: null, initialen: 'AF' },
    { id: 19, name: 'Spike Musiker', bild: null, initialen: 'SM' },
    { id: 7, name: 'Johann Becker', bild: null, initialen: 'JB' },
  ]);
  aendern.mockResolvedValue({ hinweise: [] });
  absagen.mockResolvedValue({ hinweise: [] });
});

describe('SitzungBearbeiten', () => {
  it('zeigt die Sitzung, wie sie ist; Speichern erst nach einer Änderung', async () => {
    zeige();
    await bereit();
    expect(screen.getByLabelText<HTMLInputElement>('Datum').value).toBe('2027-05-26');
    expect(screen.getByLabelText<HTMLInputElement>('Uhrzeit').value).toBe('19:30');
    expect(screen.getByLabelText<HTMLSelectElement>('Dauer').value).toBe('120');
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Spike/ })).toBeTruthy());
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /Spike/ }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /Johann/ }).checked).toBe(false);
    expect((speichern() as HTMLButtonElement).disabled).toBe(true);
  });

  it('neue Zeit: „Alle neu einladen“ vorgewählt, sagt die Mail an; gespeichert wird mit neu einladen', async () => {
    const onFertig = zeige();
    await bereit();
    expect(screen.queryByRole('checkbox', { name: /Alle neu einladen/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Uhrzeit'), { target: { value: '19:00' } });
    expect(
      screen.getByRole<HTMLInputElement>('checkbox', { name: /Alle neu einladen/ }).checked,
    ).toBe(true);
    expect(screen.getByRole('note').textContent).toMatch(/„Termin geändert“ an 1 Person/);
    await waitFor(() => expect((speichern() as HTMLButtonElement).disabled).toBe(false));
    expect(speichern().textContent).toBe('Speichern und benachrichtigen');
    fireEvent.click(speichern());
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(aendern.mock.calls[0][0]).toMatchObject({
      neu: {
        titel: 'Leitungssitzung',
        beginn: '2027-05-26T17:00:00Z',
        ende: '2027-05-26T19:00:00Z',
      },
      nachher: [1, 19],
      neuEinladen: true,
    });
  });

  it('neue Zeit, „neu einladen“ abgewählt: still, sagt das auch', async () => {
    zeige();
    await bereit();
    fireEvent.change(screen.getByLabelText('Datum'), { target: { value: '2027-06-02' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Alle neu einladen/ }));
    expect(screen.getByText(/Niemand wird benachrichtigt/)).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
    await waitFor(() => expect(speichern().textContent).toBe('Speichern'));
    fireEvent.click(speichern());
    await waitFor(() => expect(aendern).toHaveBeenCalled());
    expect(aendern.mock.calls[0][0].neuEinladen).toBe(false);
  });

  it('nur der Titel: keine Frage, keine Mail', async () => {
    zeige();
    await bereit();
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Klausur' } });
    expect(screen.queryByRole('checkbox', { name: /Alle neu einladen/ })).toBeNull();
    expect(screen.queryByRole('note')).toBeNull();
    await waitFor(() => expect((speichern() as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(speichern());
    await waitFor(() => expect(aendern).toHaveBeenCalled());
    expect(aendern.mock.calls[0][0].neuEinladen).toBe(false);
  });

  it('ein- und ausladen: je Person gesagt, welche Mail sie bekommt', async () => {
    zeige();
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Spike/ })).toBeTruthy());
    fireEvent.click(screen.getByRole('checkbox', { name: /Spike/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Johann/ }));
    expect(screen.getByRole('checkbox', { name: /Spike/ }).closest('label')?.textContent).toMatch(
      /wird ausgeladen/,
    );
    expect(screen.getByRole('note').textContent).toMatch(
      /„Neue Besprechungsanfrage“ an 1 Person, „Termin gelöscht“ an 1 Person/,
    );
    fireEvent.click(speichern());
    await waitFor(() => expect(aendern).toHaveBeenCalled());
    expect(aendern.mock.calls[0][0].nachher).toEqual([1, 7]);
  });

  it('Zeit und Eingeladene aus dem Termin, nicht aus der Liste (dort fehlen sie nach 180 Tagen)', async () => {
    // Beim Prüfen in der Test-Instanz 29.10.2026: Sitzung im Mai 2027 kam ohne Eingeladene und ohne Ende ins Fenster.
    vi.mocked(B.terminStand).mockResolvedValue({
      roh: { repeatId: 0, startDate: BEGINN, endDate: '2027-05-26T21:00:00Z' },
      eingeladen: [1, 19],
      termine: [],
    });
    zeige({ ...SITZUNG, anfragen: [], ende: undefined });
    await waitFor(() =>
      expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /Spike/ }).checked).toBe(true),
    );
    expect(screen.getByLabelText<HTMLSelectElement>('Dauer').value).toBe('210');
    fireEvent.change(screen.getByLabelText('Uhrzeit'), { target: { value: '19:00' } });
    expect(screen.getByRole('checkbox', { name: /Alle neu einladen/ })).toBeTruthy();
    fireEvent.click(speichern());
    await waitFor(() => expect(aendern).toHaveBeenCalled());
    expect(aendern.mock.calls[0][0].sitzung).toMatchObject({
      ende: '2027-05-26T21:00:00Z',
      anfragen: [
        { person: 1, antwort: 'offen' },
        { person: 19, antwort: 'offen' },
      ],
    });
    expect(aendern.mock.calls[0][0].nachher).toEqual([1, 19]);
  });

  it('Eingeladene, die keine Mitglieder sind, bleiben eingeladen', async () => {
    vi.mocked(B.terminStand).mockResolvedValue({
      roh: { repeatId: 0, startDate: BEGINN, endDate: '2027-05-26T19:30:00Z' },
      eingeladen: [1, 19, 99],
      termine: [],
    });
    zeige();
    await waitFor(() => expect(screen.getByText(/Außerdem eingeladen: 1 Person/)).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Klausur' } });
    fireEvent.click(speichern());
    await waitFor(() => expect(aendern).toHaveBeenCalled());
    expect(aendern.mock.calls[0][0].nachher).toEqual([1, 19, 99]);
  });

  it('neue Zeit in der Vergangenheit oder auf einer anderen Sitzung: gesperrt', async () => {
    const andere: Sitzung = {
      ...SITZUNG,
      schluessel: 'p:s2',
      beginn: '2027-06-02T17:30:00Z',
      kopf: null,
    };
    zeige(SITZUNG, [SITZUNG, andere]);
    await bereit();
    fireEvent.change(screen.getByLabelText('Datum'), { target: { value: '2026-10-01' } });
    expect(screen.getByText('Die Sitzung muss in der Zukunft liegen.')).toBeTruthy();
    expect((speichern() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Datum'), { target: { value: '2027-06-02' } });
    expect(screen.getByRole('alert').textContent).toMatch(/schon eine Sitzung/);
    expect((speichern() as HTMLButtonElement).disabled).toBe(true);
  });

  it('Anmeldung am Termin: sagt es, keine Felder, kein Absagen', async () => {
    vi.mocked(B.terminStand).mockResolvedValue({
      roh: { repeatId: 0, signup: { groups: [] } },
      eingeladen: [1, 19],
      termine: [],
    });
    zeige();
    expect(await screen.findByText(B.ANMELDUNG)).toBeTruthy();
    expect(screen.queryByLabelText('Titel')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sitzung absagen' })).toBeNull();
  });

  it('Hinweise nach dem Speichern: bleibt offen, „Fertig“ schließt', async () => {
    aendern.mockResolvedValue({ hinweise: ['Das Gruppentreffen steht noch auf der alten Zeit.'] });
    const onFertig = zeige();
    await bereit();
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Klausur' } });
    fireEvent.click(speichern());
    expect(await screen.findByText(/Gruppentreffen steht noch/)).toBeTruthy();
    expect(onFertig).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));
    expect(onFertig).toHaveBeenCalled();
  });

  it('absagen: erst sagen, was passiert (Mail an 1 Person, geplante Sitzung verschwindet), dann absagen', async () => {
    const onFertig = zeige();
    await bereit();
    fireEvent.click(screen.getByRole('button', { name: 'Sitzung absagen' }));
    expect(screen.getByRole('note').textContent).toMatch(/„Termin gelöscht“ an 1 Person/);
    expect(screen.getByText('Die geplante Sitzung verschwindet')).toBeTruthy();
    expect(absagen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sitzung absagen' }));
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(absagen.mock.calls[0][0].sitzung).toMatchObject({
      schluessel: 'p:s1',
      anfragen: SITZUNG.anfragen,
    });
  });

  it('absagen eines begonnenen Protokolls: es bleibt', async () => {
    zeige({ ...SITZUNG, kopf: { ...SITZUNG.kopf!, status: 'entwurf' } });
    await bereit();
    fireEvent.click(screen.getByRole('button', { name: 'Sitzung absagen' }));
    expect(screen.getByText('Das Protokoll bleibt')).toBeTruthy();
  });

  describe('Serie (K2b-2)', () => {
    // Serie ab Mi 05.05.2027 19:30, wöchentlich; die Sitzung im Fenster ist die vom 26.05.
    const serie = (start = '2027-05-05') =>
      vi.mocked(B.terminStand).mockResolvedValue({
        roh: {
          repeatId: 7,
          signup: null,
          startDate: `${start}T17:30:00Z`,
          endDate: `${start}T19:00:00Z`,
        },
        eingeladen: [1, 19],
        termine: ['2027-05-05T17:30:00Z', '2027-05-26T17:30:00Z', '2027-06-02T17:30:00Z'],
      });

    it('Zeit dieser Sitzung (nicht die des ersten Termins), Dauer der Serie; Einladungen gelten für alle', async () => {
      serie();
      zeige();
      await waitFor(() => expect(screen.getByText(/gelten für die ganze Serie/)).toBeTruthy());
      expect(screen.getByLabelText<HTMLInputElement>('Datum').value).toBe('2027-05-26');
      expect(screen.getByLabelText<HTMLSelectElement>('Dauer').value).toBe('90');
      expect(screen.queryByRole('radiogroup', { name: 'Gilt für' })).toBeNull();
    });

    it('Titel und Zeit ändern: fragt „Nur diese“ / „Ab dieser“ – geteilt lädt alle neu ein, ohne „Alle neu einladen“', async () => {
      serie();
      const onFertig = zeige();
      await bereit();
      fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Klausur' } });
      fireEvent.change(screen.getByLabelText('Uhrzeit'), { target: { value: '19:00' } });
      expect(
        screen.getByRole<HTMLInputElement>('radio', { name: /Nur diese Sitzung/ }).checked,
      ).toBe(true);
      expect(screen.queryByRole('checkbox', { name: /Alle neu einladen/ })).toBeNull();
      expect(screen.getByRole('note').textContent).toMatch(
        /keine Einladungen.*„Neue Besprechungsanfrage“ an 1 Person/,
      );
      fireEvent.click(screen.getByRole('radio', { name: /Ab dieser Sitzung/ }));
      expect(screen.getByText(/Termine davor bleiben/)).toBeTruthy();
      await waitFor(() => expect((speichern() as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(speichern());
      await waitFor(() => expect(onFertig).toHaveBeenCalled());
      expect(aendern.mock.calls[0][0]).toMatchObject({ umfang: 'ab', zeitzone: ZONE });
    });

    it('„Ab dieser“ am ersten Termin: die ganze Serie – dort gibt es „Alle neu einladen“', async () => {
      serie('2027-05-26');
      zeige();
      await bereit();
      fireEvent.change(screen.getByLabelText('Uhrzeit'), { target: { value: '19:00' } });
      fireEvent.click(screen.getByRole('radio', { name: /Ab dieser Sitzung/ }));
      expect(screen.getByText(/ganze Serie ändert sich/)).toBeTruthy();
      expect(screen.getByRole('checkbox', { name: /Alle neu einladen/ })).toBeTruthy();
      expect(screen.getByRole('note').textContent).toMatch(/„Termin geändert“ an 1 Person/);
    });

    it('absagen: drei Wege, „nur diese“ vorgewählt und still; „ganze Serie“ sagt die Mail und die kommenden Termine', async () => {
      serie();
      const onFertig = zeige();
      await bereit();
      fireEvent.click(screen.getByRole('button', { name: 'Sitzung absagen' }));
      expect(
        screen.getByRole<HTMLInputElement>('radio', { name: /Nur diese Sitzung/ }).checked,
      ).toBe(true);
      expect(screen.getByRole('radio', { name: /Serie ab hier beenden/ })).toBeTruthy();
      expect(screen.queryByRole('note')).toBeNull();
      // Gefunden in der Test-Instanz 29.10.2026: ohne Treffen und Protokoll stand „Das passiert …“ leer da.
      expect(screen.getByText('Der Termin fällt aus der Serie')).toBeTruthy();
      fireEvent.click(screen.getByRole('radio', { name: /Ganze Serie löschen/ }));
      expect(screen.getByText(/noch 3 kommende/)).toBeTruthy();
      expect(screen.getByRole('note').textContent).toMatch(/„Terminserie gelöscht“ an 1 Person/);
      fireEvent.click(screen.getByRole('button', { name: 'Sitzung absagen' }));
      await waitFor(() => expect(onFertig).toHaveBeenCalled());
      expect(absagen.mock.calls[0][0]).toMatchObject({ art: 'serie', zeitzone: ZONE });
    });

    it('absagen am ersten Termin: kein „ab hier beenden“ (hieße ganze Serie)', async () => {
      serie('2027-05-26');
      zeige();
      await bereit();
      fireEvent.click(screen.getByRole('button', { name: 'Sitzung absagen' }));
      expect(screen.queryByRole('radio', { name: /Serie ab hier beenden/ })).toBeNull();
    });
  });

  it('Protokoll ohne Termin: kein Laden des Termins, keine Einladungen, kein Absagen', async () => {
    zeige({ ...SITZUNG, termin: null, anfragen: [] });
    await bereit();
    expect(B.terminStand).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Dauer')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Einladen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sitzung absagen' })).toBeNull();
  });
});

describe('Einstiege (Sitzungsansicht, Kasten „Nächste Sitzung“)', () => {
  const GRUPPE: ProtokollGruppe = {
    id: 194,
    name: 'Technik',
    lage: 'eingerichtet',
    protokolle: 62,
    mitarbeit: null,
  };
  const frei = teileBauen(BLOCKNOTE_DOKUMENT, 'frei');
  const FREI: Sitzung = {
    ...SITZUNG,
    schluessel: 'p:frei',
    titel: 'Septembersitzung',
    beginn: '2026-10-14T17:00:00Z',
    termin: null,
    treffen: null,
    kopf: {
      ...SITZUNG.kopf!,
      sitzung: 'frei',
      status: 'frei',
      stand: frei.stand,
      freigabe: { von: 1, am: '2026-10-15T08:00:00Z' },
    },
  };
  const zeigeListe = (schreibbar: number[]) => {
    vi.mocked(L.ladeSitzungen).mockResolvedValue({
      kommend: [SITZUNG],
      protokolle: [FREI],
      teile: frei.werte.map((w) => JSON.parse(w) as ProtokollTeil),
      kalender: 4,
      treffenNichtFreigegeben: false,
    });
    render(
      <Sitzungen
        modul={24}
        gruppen={[GRUPPE]}
        ich={{ person: 1, name: 'Alwin' }}
        schreibbar={schreibbar}
      />,
    );
  };

  it('Leitung: „Bearbeiten“ in der Ansicht öffnet das Fenster', async () => {
    zeigeListe([62]);
    fireEvent.click(await screen.findByText('Leitungssitzung', { selector: 'b' }));
    fireEvent.click(await screen.findByRole('button', { name: /Sitzung bearbeiten/ }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('Mitglieder: kein „Bearbeiten“', async () => {
    zeigeListe([]);
    fireEvent.click(await screen.findByText('Leitungssitzung', { selector: 'b' }));
    await screen.findByText(/Das Protokoll ist geplant/);
    expect(screen.queryByRole('button', { name: /Sitzung bearbeiten/ })).toBeNull();
  });

  it('freigegebenes Protokoll: kein „Bearbeiten“ und kein „Ändern“ an der nächsten Sitzung', async () => {
    zeigeListe([62]);
    await screen.findByText(/freigegeben am/);
    fireEvent.click(screen.getByText(/freigegeben am/));
    // Der Kasten „Nächste Sitzung“ ist da (mit der geplanten) – nur ohne „Ändern“.
    expect(await screen.findByText('Nächste Sitzung')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Sitzung bearbeiten/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Nächste Sitzung ändern/ })).toBeNull();
  });
});

describe('NaechsteSitzung', () => {
  it('„Ändern“ nur, wenn es gereicht wird', () => {
    const onAendern = vi.fn();
    render(<NaechsteSitzung naechste={SITZUNG} zeitzone={ZONE} onAendern={onAendern} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nächste Sitzung ändern' }));
    expect(onAendern).toHaveBeenCalled();
    cleanup();
    render(<NaechsteSitzung naechste={SITZUNG} zeitzone={ZONE} />);
    expect(screen.queryByRole('button', { name: 'Nächste Sitzung ändern' })).toBeNull();
  });
});
