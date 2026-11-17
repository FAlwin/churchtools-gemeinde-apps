// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { VORLAGE_GEAENDERT, VORLAGE_NAME_MAX } from '@shared/ct/ablaufVorlagen';
import { vorlagenStandAus } from '@shared/ct/ablaufVorlagenListe';
import { VORLAGE_GESPERRT, VORLAGE_VERWEIGERT } from '@shared/ct/schreibKern';
import type { CtAblaufVorlage } from '@shared/ct/typen';
import { ApiError } from '../ct/fehler';
import { AlsVorlageFenster } from './AlsVorlageFenster';
import { alsVorlageMeldung } from './vorlagenMeta';
import type { AlsVorlageZugriff } from './vorlagenZugriff';

/**
 * **„Als Vorlage speichern“** (E10-V5, Entwurf `e10-vorlagen.html` Abschnitt 4). Die Liste kommt aus dem Erzeuger
 * (`vorlagenStandAus` auf rohen ChurchTools-Daten), nicht aus handgeschriebenen Einträgen – so prüft der Test auch, dass der
 * Änderungsstempel (`modifiedDate`) wirklich bis zum Kern durchkommt. Die Regeln des Schreibens prüft der Kern
 * (`shared/ct/ablaufVorlagen.test.ts`).
 */
afterEach(cleanup);

const KALENDER = [
  { id: 1, name: 'Gottesdienst' },
  { id: 2, name: 'Jugend' },
  { id: 3, name: 'Frauentreff' },
];

function roh(id: number, name: string, kalender: number, punkte: number, stempel: string) {
  return {
    id,
    name,
    calendarId: kalender,
    eventStartPosition: 0,
    items: Array.from({ length: punkte }, (_, k) => ({ id: id * 100 + k, title: `P${k}` })),
    meta: { modifiedDate: stempel },
  } as unknown as CtAblaufVorlage;
}

const VORLAGEN = [
  roh(11, 'Gottesdienst', 1, 9, '2026-11-12T10:00:00Z'),
  roh(12, 'Gottesdienst mit Abendmahl', 1, 11, '2026-11-13T10:00:00Z'),
  roh(21, 'Jugendabend', 2, 7, '2026-11-14T10:00:00Z'),
  roh(31, 'Frauenfrühstück', 3, 5, '2026-11-15T10:00:00Z'),
];

function zugriff(over: Partial<AlsVorlageZugriff> = {}): AlsVorlageZugriff & {
  stand: ReturnType<typeof vi.fn>;
  speichern: ReturnType<typeof vi.fn>;
  ersetzen: ReturnType<typeof vi.fn>;
} {
  return {
    stand: vi.fn(() => Promise.resolve(vorlagenStandAus(VORLAGEN, KALENDER, 'Europe/Berlin'))),
    speichern: vi.fn(() => Promise.resolve(99)),
    ersetzen: vi.fn(() => Promise.resolve()),
    ...over,
  } as never;
}

function zeige(
  z = zugriff(),
  o: { darfIn?: (k: number | null) => boolean; kalender?: number | null; punkte?: number } = {},
) {
  const p = { onFertig: vi.fn(), onClose: vi.fn() };
  render(
    <AlsVorlageFenster
      terminTitel="Gottesdienst"
      terminText="Gottesdienst · So, 23.11.2026"
      punkte={o.punkte ?? 9}
      terminKalenderId={o.kalender === undefined ? 1 : o.kalender}
      darfIn={o.darfIn ?? (() => true)}
      zugriff={z}
      {...p}
    />,
  );
  return { z, ...p };
}

/** Wartet, bis die Liste geladen ist (die Wege hängen davon ab). */
async function geladen(): Promise<void> {
  await waitFor(() => expect(screen.queryByText('Vorlagen werden geladen …')).toBeNull());
}

const knopf = (name: string) => screen.getByRole('button', { name });
const kalenderWahl = () => screen.getByRole('combobox');

describe('AlsVorlageFenster – Aufbau', () => {
  it('Titel, Unterzeile mit Zahl der Punkte, zwei Wege – „Als neue Vorlage“ ist offen', async () => {
    zeige();
    await geladen();
    expect(screen.getByText('Als Vorlage speichern')).toBeTruthy();
    expect(screen.getByText('Ablauf von: Gottesdienst · So, 23.11.2026 · 9 Punkte')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Als neue Vorlage' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen
        .getByRole('button', { name: 'Vorhandene Vorlage ersetzen' })
        .getAttribute('aria-pressed'),
    ).toBe('false');
    expect(knopf('Speichern')).toBeTruthy();
  });

  it('ein einzelner Punkt heißt „1 Punkt“', async () => {
    zeige(zugriff(), { punkte: 1 });
    await geladen();
    expect(screen.getByText(/· 1 Punkt$/)).toBeTruthy();
  });

  it('der blaue Hinweis sagt, was übernommen wird – und dass keine Namen mitkommen', async () => {
    zeige();
    await geladen();
    expect(
      screen.getByText(
        /Übernommen werden alle Einträge mit Dauer, Notiz und Infos je Dienstgruppe/,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/keine Namen von Personen/)).toBeTruthy();
  });
});

describe('AlsVorlageFenster – als neue Vorlage', () => {
  it('Name ist mit dem Termin-Titel vorbelegt, Kalender mit dem des Termins', async () => {
    zeige(zugriff(), { kalender: 2 });
    await geladen();
    expect(screen.getByRole('textbox')).toHaveProperty('value', 'Gottesdienst');
    expect(kalenderWahl()).toHaveProperty('value', '2');
  });

  it('der Titel wird auf die erlaubte Länge gekürzt', async () => {
    const z = zugriff();
    const lang = 'x'.repeat(VORLAGE_NAME_MAX + 20);
    render(
      <AlsVorlageFenster
        terminTitel={lang}
        terminText="T"
        punkte={1}
        terminKalenderId={1}
        darfIn={() => true}
        zugriff={z}
        onFertig={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await geladen();
    expect(screen.getByRole('textbox')).toHaveProperty('value', 'x'.repeat(VORLAGE_NAME_MAX));
  });

  it('Kalender des Termins nicht erlaubt: der Kalender mit den meisten Vorlagen (wie bei „Neue Vorlage“)', async () => {
    // Erlaubt: Jugend (1 Vorlage) und Frauentreff (1) – Gleichstand, der erste in der Reihenfolge der Liste.
    zeige(zugriff(), { darfIn: (k) => k === 2 || k === 3, kalender: 1 });
    await geladen();
    expect(kalenderWahl()).toHaveProperty('value', '3'); // „Frauentreff“ steht vor „Jugend“ (nach Namen)
  });

  it('zur Wahl stehen nur Kalender, in denen man Vorlagen bearbeiten darf', async () => {
    zeige(zugriff(), { darfIn: (k) => k === 1 || k === 3 });
    await geladen();
    const namen = within(kalenderWahl())
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(namen).toEqual(['Frauentreff', 'Gottesdienst']);
  });

  it('Speichern gibt Name und gewählten Kalender an den Zugriff, dann „fertig“ mit dem Namen', async () => {
    const { z, onFertig } = zeige();
    await geladen();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Sonntag neu ' } });
    fireEvent.change(kalenderWahl(), { target: { value: '2' } });
    fireEvent.click(knopf('Speichern'));
    await waitFor(() => expect(onFertig).toHaveBeenCalledWith('neu', 'Sonntag neu'));
    expect(z.speichern).toHaveBeenCalledWith({ name: '  Sonntag neu ', kalenderId: 2 });
    expect(z.ersetzen).not.toHaveBeenCalled();
  });

  it('Namensregel: ein leerer Name sperrt „Speichern“', async () => {
    const { z } = zeige();
    await geladen();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    expect(knopf('Speichern')).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ok' } });
    expect(knopf('Speichern')).toHaveProperty('disabled', false);
    expect(z.speichern).not.toHaveBeenCalled();
  });

  it('Fehler (403, 423, 502) stehen im Fenster, das offen bleibt – wörtlich', async () => {
    for (const meldung of [
      VORLAGE_VERWEIGERT,
      VORLAGE_GESPERRT,
      'Die Ablaufvorlage wurde nicht vollständig angelegt und wieder entfernt. Bitte noch einmal versuchen.',
    ]) {
      cleanup();
      const speichern = vi.fn(() => Promise.reject(new ApiError(502, meldung)));
      const { onFertig, onClose } = zeige(zugriff({ speichern }));
      await geladen();
      fireEvent.click(knopf('Speichern'));
      expect((await screen.findByRole('alert')).textContent).toBe(meldung);
      expect(onFertig).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      // Das Fenster ist wieder bedienbar.
      expect(knopf('Speichern')).toHaveProperty('disabled', false);
    }
  });
});

describe('AlsVorlageFenster – vorhandene Vorlage ersetzen', () => {
  async function ersetzenWaehlen() {
    fireEvent.click(await screen.findByRole('button', { name: 'Vorhandene Vorlage ersetzen' }));
  }

  it('zeigt nur Vorlagen, die man bearbeiten darf – die des Termin-Kalenders zuerst, je mit Punkten', async () => {
    zeige(zugriff(), { darfIn: (k) => k !== 3, kalender: 2 });
    await geladen();
    await ersetzenWaehlen();
    const eintraege = screen
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
      .filter((t) => /Punkt/.test(t));
    expect(eintraege).toEqual([
      'Jugendabend7 Punkte', // Kalender des Termins zuerst
      'Gottesdienst9 Punkte',
      'Gottesdienst mit Abendmahl11 Punkte',
    ]);
    expect(screen.queryByText(/Frauenfrühstück/)).toBeNull(); // kein Recht im Kalender 3
  });

  it('nichts ist vorausgewählt: kein Warntext, „Ersetzen“ gesperrt, bis man eine Vorlage antippt (Alwin, 17.11.2026)', async () => {
    zeige(zugriff(), { punkte: 6 });
    await geladen();
    await ersetzenWaehlen();
    expect(screen.queryByText(/werden durch die/)).toBeNull();
    expect(knopf('Ersetzen')).toHaveProperty('disabled', true);
    fireEvent.click(
      screen.getByRole('button', { name: /^Gottesdienst9 Punkte$|^Gottesdienst 9 Punkte$/ }),
    );
    expect(knopf('Ersetzen')).toHaveProperty('disabled', false);
  });

  it('gewählt: roter Hinweis nennt die richtigen Zahlen, der Knopf ist rot und heißt „Ersetzen“', async () => {
    zeige(zugriff(), { punkte: 6 });
    await geladen();
    await ersetzenWaehlen();
    fireEvent.click(
      screen.getByRole('button', { name: /^Gottesdienst9 Punkte$|^Gottesdienst 9 Punkte$/ }),
    );
    expect(
      screen.getByText(
        'Die 9 Punkte von „Gottesdienst“ werden durch die 6 Punkte dieses Ablaufs ersetzt. Name und Kalender bleiben. Abläufe, die schon aus der Vorlage entstanden sind, ändern sich nicht.',
      ),
    ).toBeTruthy();
    expect(knopf('Ersetzen').className).toMatch(/gefahr/);
    expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
    // Der blaue Hinweis gehört nur zum Weg „neu“.
    expect(screen.queryByText(/Übernommen werden alle Einträge/)).toBeNull();
  });

  it('eine andere Vorlage wählen: Warntext und „gesehen“ wechseln mit', async () => {
    const { z, onFertig } = zeige();
    await geladen();
    await ersetzenWaehlen();
    fireEvent.click(screen.getByRole('button', { name: /Gottesdienst mit Abendmahl/ }));
    expect(screen.getByText(/Die 11 Punkte von „Gottesdienst mit Abendmahl“ werden/)).toBeTruthy();
    fireEvent.click(knopf('Ersetzen'));
    await waitFor(() =>
      expect(onFertig).toHaveBeenCalledWith('ersetzt', 'Gottesdienst mit Abendmahl'),
    );
    // Der Stempel, den die Liste beim Öffnen kannte – unverändert aus `meta.modifiedDate`.
    expect(z.ersetzen).toHaveBeenCalledWith(12, '2026-11-13T10:00:00Z');
    expect(z.speichern).not.toHaveBeenCalled();
  });

  it('keine Vorlage, die man bearbeiten darf: Hinweis, „Ersetzen“ gesperrt', async () => {
    zeige(zugriff(), { darfIn: (k) => k === null });
    await geladen();
    await ersetzenWaehlen();
    expect(screen.getByText('Es gibt keine Vorlage, die du bearbeiten darfst.')).toBeTruthy();
    expect(knopf('Ersetzen')).toHaveProperty('disabled', true);
  });

  it('412: die Meldung steht im Fenster, die Liste wird neu geladen, das Fenster bleibt offen', async () => {
    const ersetzen = vi.fn(() =>
      Promise.reject(Object.assign(new Error(VORLAGE_GEAENDERT), { status: 412 })),
    );
    const z = zugriff({ ersetzen });
    const { onFertig, onClose } = zeige(z);
    await geladen();
    await ersetzenWaehlen();
    fireEvent.click(
      screen.getByRole('button', { name: /^Gottesdienst9 Punkte$|^Gottesdienst 9 Punkte$/ }),
    );
    expect(z.stand).toHaveBeenCalledTimes(1);
    fireEvent.click(knopf('Ersetzen'));
    expect((await screen.findByRole('alert')).textContent).toBe(VORLAGE_GEAENDERT);
    await waitFor(() => expect(z.stand).toHaveBeenCalledTimes(2));
    expect(onFertig).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('andere Fehler (403, 423, 502) laden die Liste NICHT neu – nur 412 verlangt es', async () => {
    const ersetzen = vi.fn(() => Promise.reject(new ApiError(423, VORLAGE_GESPERRT)));
    const z = zugriff({ ersetzen });
    zeige(z);
    await geladen();
    await ersetzenWaehlen();
    fireEvent.click(
      screen.getByRole('button', { name: /^Gottesdienst9 Punkte$|^Gottesdienst 9 Punkte$/ }),
    );
    fireEvent.click(knopf('Ersetzen'));
    expect((await screen.findByRole('alert')).textContent).toBe(VORLAGE_GESPERRT);
    expect(z.stand).toHaveBeenCalledTimes(1);
  });
});

describe('AlsVorlageFenster – Laden', () => {
  it('solange die Liste lädt, ist nichts speicherbar; scheitert sie, steht die Meldung mit „Erneut versuchen“', async () => {
    let versuch = 0;
    const stand = vi.fn(() =>
      ++versuch === 1
        ? Promise.reject(new ApiError(503, 'x'))
        : Promise.resolve(vorlagenStandAus(VORLAGEN, KALENDER, 'Europe/Berlin')),
    );
    zeige(zugriff({ stand }));
    expect(knopf('Speichern')).toHaveProperty('disabled', true);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    await geladen();
    await waitFor(() => expect(knopf('Speichern')).toHaveProperty('disabled', false));
  });
});

describe('alsVorlageMeldung', () => {
  it('nennt den Namen der Vorlage – für beide Wege', () => {
    expect(alsVorlageMeldung('neu', 'Sonntag')).toBe('Als Vorlage „Sonntag“ gespeichert.');
    expect(alsVorlageMeldung('ersetzt', 'Sonntag')).toBe('Vorlage „Sonntag“ ersetzt.');
  });
});
