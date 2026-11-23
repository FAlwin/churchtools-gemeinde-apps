// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { TerminZeile } from '@shared/protokolle/termine';
import type { Ressource } from '@shared/protokolle/terminRessourcen';
import * as K from './terminAnlegen';
import * as V from './terminVorlagenLesen';
import * as B from './buchungenLesen';
import { terminLegen } from './terminEintragen';
import { terminVermerken } from './terminStandSchreiben';
import { TerminFenster } from './TerminFenster';

/** Der Reiter „Ressourcen“ im Fenster „In Kalender eintragen“ (W15-2): Rechte, Tabelle, Status, Nachbuch-Meldung. */
vi.mock('./kalenderListe', () => ({
  ladeSchreibKalender: vi.fn(() => Promise.resolve([{ id: 4, name: 'Gemeindeleitung' }])),
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
vi.mock('./buchungenLesen', () => ({ ladeRessourcen: vi.fn() }));

const RESSOURCEN: Ressource[] = [
  { id: 4, name: 'Bus', typId: 12, typ: 'Fahrzeug', anzahl: 1 },
  { id: 5, name: 'Stühle', typId: 11, typ: 'Gegenstand', anzahl: 80 },
  { id: 2, name: 'Küche', typId: 10, typ: 'Raum', anzahl: 1 },
  { id: 1, name: 'Saal', typId: 10, typ: 'Raum', anzahl: 1 },
];
const ZEILE: TerminZeile = {
  schluessel: 'termin-s-b',
  gruppe: { id: 11, name: 'Leitungsteam' },
  sitzung: { id: 's', schluessel: 'p:s', titel: 'Festplanung', beginn: '2026-11-21T18:00:00Z' },
  blockId: 'b',
  text: 'Heiligabend, 16 Uhr',
  datum: '2027-12-24',
  punkt: null,
};
const STAND = { vermerke: [] } as never;

const onFertig = vi.fn();
const zeigen = (buchen: number[] = [1, 2, 4, 5], verwalten: number[] = [2]) =>
  render(
    <TerminFenster
      zeile={ZEILE}
      gruppenKalender={4}
      schreibbar={[4]}
      ressourcenBuchen={buchen}
      ressourcenVerwalten={verwalten}
      ort={{ modul: 24, kategorie: 61 }}
      ich={1}
      zeitzone="Europe/Berlin"
      onFertig={onFertig}
      onClose={vi.fn()}
    />,
  );
const fenster = async () => await screen.findByRole('dialog', { name: 'In Kalender eintragen' });
const reiterRessourcen = async (f: HTMLElement) => {
  fireEvent.click(await within(f).findByRole('button', { name: 'Ressourcen' }));
  await within(f).findByText('Vorhandene Buchungen');
};
/** Ein Zahlenfeld nach seinem Namen – „Vorlauf“ heißt auch die Gruppe darum. */
const zahl = (f: HTMLElement, name: string) =>
  within(f).getByRole<HTMLInputElement>('spinbutton', { name });
const waehle = (f: HTMLElement, name: RegExp) => {
  const auswahl = within(f).getByLabelText<HTMLSelectElement>('Ressource');
  const o = within(auswahl).getByRole<HTMLOptionElement>('option', { name });
  fireEvent.change(auswahl, { target: { value: o.value } });
};

beforeEach(() => {
  vi.mocked(K.kalenderTermineAmTag).mockResolvedValue([]);
  vi.mocked(V.ladeVorlagen).mockResolvedValue([]);
  vi.mocked(B.ladeRessourcen).mockResolvedValue(RESSOURCEN);
  vi.mocked(terminLegen).mockResolvedValue({ art: 'angelegt', id: 700 });
  vi.mocked(terminVermerken).mockResolvedValue(STAND);
  onFertig.mockReset();
});
afterEach(cleanup);

describe('Reiter und Rechte', () => {
  it('ohne Recht zum Buchen gibt es den Reiter nicht – und es wird nichts geladen', async () => {
    zeigen([], []);
    const f = await fenster();
    expect(within(f).queryByRole('button', { name: 'Ressourcen' })).toBeNull();
    expect(within(f).queryByRole('button', { name: 'Kalender' })).toBeNull();
    expect(B.ladeRessourcen).not.toHaveBeenCalled();
  });

  it('mit Recht: Reiter „Kalender · Ressourcen“ in dieser Reihenfolge, kein Zähler', async () => {
    zeigen();
    const f = await fenster();
    const namen = within(f)
      .getAllByRole('button', { name: /^(Kalender|Ressourcen)$/ })
      .map((b) => b.textContent);
    expect(namen).toEqual(['Kalender', 'Ressourcen']);
    expect(B.ladeRessourcen).toHaveBeenCalledWith(new Set([1, 2, 4, 5]));
  });
});

describe('Vorlauf und Nachlauf', () => {
  it('Vorgabe 15/15 mit der errechneten Uhrzeit; die Zeit folgt dem Wert', async () => {
    zeigen();
    const f = await fenster();
    fireEvent.click(within(f).getByLabelText('Ganztägig'));
    fireEvent.click(within(f).getByLabelText('Ganztägig'));
    fireEvent.change(within(f).getByLabelText('Beginn Stunde'), { target: { value: '14' } });
    fireEvent.change(within(f).getByLabelText('Beginn Minute'), { target: { value: '00' } });
    fireEvent.change(within(f).getByLabelText('Ende Stunde'), { target: { value: '16' } });
    fireEvent.change(within(f).getByLabelText('Ende Minute'), { target: { value: '00' } });
    await reiterRessourcen(f);
    const vorlauf = zahl(f, 'Vorlauf');
    const nachlauf = zahl(f, 'Nachlauf');
    expect([vorlauf.value, nachlauf.value]).toEqual(['15', '15']);
    expect(within(f).getByText('24.12.2027 13:45')).toBeTruthy();
    expect(within(f).getByText('24.12.2027 16:15')).toBeTruthy();
    fireEvent.change(vorlauf, { target: { value: '60' } });
    expect(within(f).getByText('24.12.2027 13:00')).toBeTruthy();
  });

  it('die Vorschläge im Pfeil setzen den Wert; zu große Eingaben werden auf die Grenze gesetzt', async () => {
    zeigen();
    const f = await fenster();
    await reiterRessourcen(f);
    fireEvent.change(within(f).getByLabelText('Nachlauf: Vorschlag wählen'), {
      target: { value: '90' },
    });
    expect(zahl(f, 'Nachlauf').value).toBe('90');
    fireEvent.change(zahl(f, 'Nachlauf'), { target: { value: '99999' } });
    expect(zahl(f, 'Nachlauf').value).toBe('1440');
    fireEvent.change(zahl(f, 'Vorlauf'), { target: { value: '99999' } });
    expect(zahl(f, 'Vorlauf').value).toBe('20160');
  });
});

describe('Tabelle der Buchungen', () => {
  it('Auswahl „Name · Typ“ gruppiert nach Typ; eine Ressource nur einmal', async () => {
    zeigen();
    const f = await fenster();
    await reiterRessourcen(f);
    const auswahl = within(f).getByLabelText('Ressource');
    expect(within(f).getByText('Noch keine Ressource gebucht.')).toBeTruthy();
    expect([...auswahl.querySelectorAll('optgroup')].map((g) => g.getAttribute('label'))).toEqual([
      'Fahrzeug',
      'Gegenstand',
      'Raum',
    ]);
    expect(within(auswahl).getByRole('option', { name: 'Saal · Raum' })).toBeTruthy();
    waehle(f, /^Saal/);
    expect(within(auswahl).queryByRole('option', { name: 'Saal · Raum' })).toBeNull();
    expect(within(f).getAllByRole('row')).toHaveLength(2); // Kopf + Saal
  });

  it('neue Zeile mit dem aktuellen Vorlauf/Nachlauf als Startwert, eigener Wert je Zeile, ✕ entfernt', async () => {
    zeigen();
    const f = await fenster();
    await reiterRessourcen(f);
    fireEvent.change(zahl(f, 'Vorlauf'), { target: { value: '45' } });
    waehle(f, /^Saal/);
    expect(zahl(f, 'Vorlauf Saal').value).toBe('45');
    expect(zahl(f, 'Nachlauf Saal').value).toBe('15');
    fireEvent.change(zahl(f, 'Vorlauf Saal'), { target: { value: '120' } });
    expect(zahl(f, 'Vorlauf').value).toBe('45');
    fireEvent.click(within(f).getByRole('button', { name: 'Buchung Saal entfernen' }));
    expect(within(f).queryByLabelText('Vorlauf Saal')).toBeNull();
  });

  it('Status: wählbar nur bei Ressourcen, die man verwalten darf – sonst fest „Wartet auf Bestätigung“', async () => {
    zeigen([1, 2], [2]);
    const f = await fenster();
    await reiterRessourcen(f);
    waehle(f, /^Saal/);
    waehle(f, /^Küche/);
    expect(within(f).queryByLabelText('Status Saal')).toBeNull();
    expect(within(f).getByText('Wartet auf Bestätigung', { selector: 'span' })).toBeTruthy();
    const status = within(f).getByLabelText<HTMLSelectElement>('Status Küche');
    expect([...status.options].map((o) => o.text)).toEqual([
      'Wartet auf Bestätigung',
      'Bestätigt',
      'Abgelehnt',
    ]);
    fireEvent.change(status, { target: { value: '2' } });
    expect(status.value).toBe('2');
  });

  it('Menge nur bei Ressourcen mit mehr als einem Stück', async () => {
    zeigen();
    const f = await fenster();
    await reiterRessourcen(f);
    waehle(f, /^Saal/);
    waehle(f, /^Stühle/);
    expect(within(f).queryByLabelText('Anzahl Saal')).toBeNull();
    const menge = within(f).getByLabelText<HTMLInputElement>('Anzahl Stühle');
    expect(menge.value).toBe('1');
    fireEvent.change(menge, { target: { value: '500' } });
    expect(menge.value).toBe('80');
  });
});

describe('Speichern: Buchungen werden nachgelesen', () => {
  const speichern = async (f: HTMLElement) => {
    await waitFor(() =>
      expect(within(f).getByRole<HTMLButtonElement>('button', { name: 'Speichern' }).disabled).toBe(
        false,
      ),
    );
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
  };
  const mitSaal = async () => {
    zeigen();
    const f = await fenster();
    await reiterRessourcen(f);
    waehle(f, /^Saal/);
    waehle(f, /^Küche/);
    return f;
  };

  it('die Buchungen gehen mit dem Eintrag zu ChurchTools; sind alle da, geht das Fenster wie bisher zu', async () => {
    vi.mocked(terminLegen).mockResolvedValue({
      art: 'angelegt',
      id: 700,
      buchungen: { fehlend: [], unklar: false },
    });
    const f = await mitSaal();
    await speichern(f);
    await waitFor(() => expect(onFertig).toHaveBeenCalledWith(STAND));
    const q = vi.mocked(terminLegen).mock.calls[0][0];
    expect(q.eintrag.buchungen.map((b) => b.ressource)).toEqual([1, 2]);
  });

  it('eine Buchung fehlt: der Vermerk entsteht, das Fenster bleibt und nennt die Ressource', async () => {
    vi.mocked(terminLegen).mockResolvedValue({
      art: 'angelegt',
      id: 700,
      buchungen: { fehlend: [2], unklar: false },
    });
    const f = await mitSaal();
    await speichern(f);
    expect(await within(f).findByText(/„Küche“ wurde nicht gebucht/)).toBeTruthy();
    expect(within(f).getByText(/in ChurchTools nachbuchen/)).toBeTruthy();
    expect(terminVermerken).toHaveBeenCalledTimes(1);
    expect(onFertig).not.toHaveBeenCalled();
    fireEvent.click(within(f).getByRole('button', { name: 'Fertig' }));
    expect(onFertig).toHaveBeenCalledWith(STAND);
  });

  it('Schließen mit ✕ gibt den neuen Stand trotzdem weiter (der Vermerk steht ja)', async () => {
    vi.mocked(terminLegen).mockResolvedValue({
      art: 'angelegt',
      id: 700,
      buchungen: { fehlend: [1], unklar: false },
    });
    const f = await mitSaal();
    await speichern(f);
    await within(f).findByText(/„Saal“ wurde nicht gebucht/);
    fireEvent.click(within(f).getByRole('button', { name: /schließen/i }));
    expect(onFertig).toHaveBeenCalledWith(STAND);
  });

  it('Nachlesen unklar: eigene Meldung – nicht „nicht gebucht“', async () => {
    vi.mocked(terminLegen).mockResolvedValue({
      art: 'angelegt',
      id: 700,
      buchungen: { fehlend: [], unklar: true },
    });
    const f = await mitSaal();
    await speichern(f);
    expect(await within(f).findByText(/nicht nachlesen/)).toBeTruthy();
    expect(within(f).queryByText(/wurde nicht gebucht/)).toBeNull();
  });

  it('Vermerk scheitert und eine Buchung fehlt: „Nochmal vermerken“ zeigt die Buchungsmeldung weiter', async () => {
    vi.mocked(terminLegen).mockResolvedValue({
      art: 'angelegt',
      id: 700,
      buchungen: { fehlend: [1], unklar: false },
    });
    vi.mocked(terminVermerken).mockRejectedValueOnce(new Error('weg'));
    const f = await mitSaal();
    await speichern(f);
    await within(f).findByRole('button', { name: 'Nochmal vermerken' });
    expect(within(f).getByText(/„Saal“ wurde nicht gebucht/)).toBeTruthy();
    fireEvent.click(within(f).getByRole('button', { name: 'Nochmal vermerken' }));
    await within(f).findByRole('button', { name: 'Fertig' });
    expect(onFertig).not.toHaveBeenCalled();
    expect(terminLegen).toHaveBeenCalledTimes(1);
  });
});

describe('„Nur verknüpfen“ und Vorlagen', () => {
  it('beim Verknüpfen steht im Reiter, dass nichts gebucht wird – und die Felder sind gesperrt', async () => {
    vi.mocked(K.kalenderTermineAmTag).mockResolvedValue([
      { id: 161, titel: 'Heiligabend – Familiengottesdienst', beginn: '' },
    ]);
    zeigen();
    const f = await fenster();
    await within(f).findByText(/schon „Heiligabend/);
    await reiterRessourcen(f);
    expect(within(f).getByText(/dabei wird nichts gebucht/)).toBeTruthy();
    expect(within(f).getByLabelText<HTMLSelectElement>('Ressource').disabled).toBe(true);
    fireEvent.click(within(f).getByLabelText(/Trotzdem neu anlegen/));
    expect(within(f).queryByText(/dabei wird nichts gebucht/)).toBeNull();
    expect(within(f).getByLabelText<HTMLSelectElement>('Ressource').disabled).toBe(false);
  });

  it('eine Vorlage mit Buchungen füllt die Tabelle – nur buchbare Ressourcen, Status ohne Recht 1', async () => {
    vi.mocked(V.ladeVorlagen).mockResolvedValue([
      {
        id: 9,
        kalender: 4,
        titel: 'Gottesdienst',
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
        buchungen: [
          { ressource: 1, vorlauf: 150, nachlauf: 60, status: 2, menge: 1 },
          { ressource: 2, vorlauf: 0, nachlauf: 0, status: 2, menge: 1 },
          { ressource: 99, vorlauf: 5, nachlauf: 5, status: 1, menge: 1 },
        ],
      },
    ]);
    zeigen([1, 2], [2]);
    const f = await fenster();
    fireEvent.click(await within(f).findByLabelText('Gottesdienst'));
    await reiterRessourcen(f);
    expect(zahl(f, 'Vorlauf Saal').value).toBe('150');
    expect(zahl(f, 'Nachlauf Saal').value).toBe('60');
    expect(within(f).queryByLabelText('Status Saal')).toBeNull(); // nicht verwaltbar → fest
    expect(within(f).getByLabelText<HTMLSelectElement>('Status Küche').value).toBe('2');
    expect(within(f).queryByLabelText(/Ressource 99/)).toBeNull();
    expect(within(f).getAllByRole('row')).toHaveLength(3);
  });
});
