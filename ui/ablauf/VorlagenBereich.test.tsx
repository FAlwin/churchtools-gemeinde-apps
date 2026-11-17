// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { VORLAGE_VERWEIGERT } from '@shared/ct/schreibKern';
import { vorlageAnlegen, VORLAGE_NAME_MAX } from '@shared/ct/ablaufVorlagen';
import { vorlagenStandAus } from '@shared/ct/ablaufVorlagenListe';
import type { CtAblaufVorlage } from '@shared/ct/typen';
import { ApiError } from '../ct/fehler';
import { VorlagenBereich } from './VorlagenBereich';
import type { VorlagenZugriff } from './vorlagenZugriff';

/**
 * **Die Seite „Ablaufvorlagen“** (E10-V3a): Liste, Vorlage öffnen, anlegen, umbenennen, löschen. Die App-Seite ist eine
 * Attrappe des Zugriffs; die Rohdaten sind so gebaut, wie ChurchTools sie liefert (Liste mit Punkten, `modifiedDate`).
 */
afterEach(cleanup);

beforeEach(() => {
  // Computer-Breite: „Neue Vorlage“ steht als Knopf im Kopf (am Handy als schwebendes Plus).
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});
afterEach(() => vi.unstubAllGlobals());

const KALENDER = [
  { id: 1, name: 'Gottesdienst' },
  { id: 2, name: 'Jugend' },
  { id: 3, name: 'Frauentreff' },
];

const vorlage = (
  id: number,
  name: string,
  kalender: number | null,
  extra = {},
): CtAblaufVorlage => ({
  id,
  name,
  calendarId: kalender,
  eventStartPosition: 1,
  items: [
    { id: id * 10, position: 0, title: 'Soundcheck', type: 'normal', duration: 600 },
    { id: id * 10 + 1, position: 1, title: 'Begrüßung', type: 'normal', duration: 300 },
  ],
  meta: { modifiedDate: '2026-11-12T10:00:00Z' },
  ...extra,
});

const ROH: CtAblaufVorlage[] = [vorlage(5, 'Gottesdienst', 1), vorlage(6, 'Jugendabend', 2)];

/** Eine Attrappe, die sich merkt, was geschrieben wurde. */
function zugriff(roh: CtAblaufVorlage[] = ROH, over: Partial<VorlagenZugriff> = {}) {
  // Kopien: Umbenennen darf die Vorlagen der nächsten Tests nicht ändern.
  const gespeichert = roh.map((v) => ({ ...v }));
  const z: VorlagenZugriff = {
    liste: vi.fn(() => Promise.resolve(vorlagenStandAus(gespeichert, KALENDER, 'Europe/Berlin'))),
    vorlage: vi.fn((id: number) => {
      const v = gespeichert.find((x) => x.id === id);
      return v ? Promise.resolve(v) : Promise.reject(new ApiError(404, 'weg'));
    }),
    aktionen: vi.fn((_id, geschrieben) => ({
      reorder: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve(null)),
      restore: vi.fn(() => Promise.resolve()),
      update: vi.fn(() => {
        geschrieben();
        return Promise.resolve();
      }),
      setVorBeginn: vi.fn(() => Promise.resolve()),
      add: vi.fn(() => Promise.resolve()),
    })),
    anlegen: vi.fn((d) => {
      gespeichert.push(vorlage(9, d.name, d.kalenderId, { items: [] }));
      return Promise.resolve(9);
    }),
    umbenennen: vi.fn((id, name) => {
      const v = gespeichert.find((x) => x.id === id);
      if (v) v.name = name;
      return Promise.resolve();
    }),
    loeschen: vi.fn((id) => {
      gespeichert.splice(
        gespeichert.findIndex((x) => x.id === id),
        1,
      );
      return Promise.resolve();
    }),
    ...over,
  };
  return z;
}

/** Wie der Dienstplaner: die offene Vorlage liegt in „der Adresse“ – hier ein Zustand. */
function Seite({
  z,
  darf,
  start = null,
}: {
  z: VorlagenZugriff;
  darf: (kalender: number | null) => boolean;
  start?: number | null;
}) {
  const [offen, setOffen] = useState<number | null>(start);
  return (
    <VorlagenBereich
      zugriff={z}
      darfIn={darf}
      dienste={[]}
      offeneId={offen}
      onOeffnen={setOffen}
      zurueck={{ label: 'Planen', onClick: () => setOffen(-1) }}
    />
  );
}

const nurGottesdienst = (k: number | null) => k === 1;
const alles = () => true;
const nichts = () => false;

describe('Liste', () => {
  it('Bänder je Kalender mit „N Vorlagen“, Zeilen mit Punkten, Vorlauf und Änderung', async () => {
    render(<Seite z={zugriff()} darf={alles} />);
    const gd = await screen.findByRole('region', { name: 'Gottesdienst' });
    expect(within(gd).getByText('1 Vorlage')).toBeTruthy();
    expect(within(gd).getByText('2 Punkte · 1 vor Beginn · geändert 12.11.')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Jugend' })).toBeTruthy();
  });

  it('„nur ansehen“ am Kalender ohne das Recht – nicht am Kalender mit Recht', async () => {
    render(<Seite z={zugriff()} darf={nurGottesdienst} />);
    const jugend = await screen.findByRole('region', { name: 'Jugend' });
    expect(within(jugend).getByText('nur ansehen')).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: 'Gottesdienst' })).queryByText('nur ansehen'),
    ).toBeNull();
  });

  it('„Neue Vorlage“ nur, wenn man in mindestens einem Kalender darf', async () => {
    render(<Seite z={zugriff()} darf={nurGottesdienst} />);
    expect(await screen.findByRole('button', { name: 'Neue Vorlage' })).toBeTruthy();
    cleanup();
    render(<Seite z={zugriff()} darf={nichts} />);
    await screen.findByRole('region', { name: 'Gottesdienst' });
    expect(screen.queryByRole('button', { name: 'Neue Vorlage' })).toBeNull();
  });

  it('leer: der Hinweis; mit Recht steht „Neue Vorlage“ trotzdem da (Kalender kommen aus /calendars)', async () => {
    render(<Seite z={zugriff([])} darf={alles} />);
    expect(
      await screen.findByText(
        'Noch keine Vorlage. Lege eine an oder speichere den Ablauf eines Termins als Vorlage.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Neue Vorlage' })).toBeTruthy();
  });

  it('lädt: Hinweis; scheitert: Fehlerkasten mit „Erneut versuchen“ – danach die Liste', async () => {
    let versuch = 0;
    const z = zugriff(ROH, {
      liste: vi.fn(() => {
        versuch += 1;
        return versuch === 1
          ? Promise.reject(new ApiError(503, 'unklar'))
          : Promise.resolve(vorlagenStandAus(ROH, KALENDER, 'Europe/Berlin'));
      }),
    });
    render(<Seite z={z} darf={alles} />);
    expect(screen.getByText('Vorlagen werden geladen …')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByRole('region', { name: 'Gottesdienst' })).toBeTruthy();
  });

  it('„‹ Planen“ führt zurück, wo man herkam', async () => {
    const onZurueck = vi.fn();
    render(
      <VorlagenBereich
        zugriff={zugriff()}
        darfIn={alles}
        dienste={[]}
        offeneId={null}
        onOeffnen={() => {}}
        zurueck={{ label: 'Planen', onClick: onZurueck }}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Planen/ }));
    expect(onZurueck).toHaveBeenCalled();
  });
});

describe('Neue Vorlage', () => {
  async function oeffneNeu(darf: (kalender: number | null) => boolean = alles) {
    const z = zugriff();
    render(<Seite z={z} darf={darf} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Neue Vorlage' }));
    return { z, fenster: screen.getByRole('dialog', { name: 'Neue Vorlage' }) };
  }

  it('bietet nur Kalender an, in denen man darf – vorbelegt mit dem ersten', async () => {
    const { fenster } = await oeffneNeu((k) => k === 2 || k === 3);
    const optionen = within(fenster)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(optionen).toEqual(['Frauentreff', 'Jugend']);
    expect(within(fenster).getByRole<HTMLSelectElement>('combobox').value).toBe('3');
  });

  it('der Name folgt der Regel des Kerns: leer oder nur Leerzeichen → „Anlegen“ gesperrt; Grenze am Feld', async () => {
    const { fenster } = await oeffneNeu();
    const anlegen = within(fenster).getByRole('button', { name: 'Anlegen' });
    expect(anlegen).toHaveProperty('disabled', true);
    const name = within(fenster).getByRole('textbox');
    fireEvent.change(name, { target: { value: '   ' } });
    expect(anlegen).toHaveProperty('disabled', true);
    expect(name.getAttribute('maxlength')).toBe(String(VORLAGE_NAME_MAX));
    fireEvent.change(name, { target: { value: 'Gebetsabend' } });
    expect(anlegen).toHaveProperty('disabled', false);
  });

  it('Anlegen → die neue Vorlage geht gleich im Bearbeiten-Modus auf; die Liste wird neu gelesen', async () => {
    const { z, fenster } = await oeffneNeu();
    fireEvent.change(within(fenster).getByRole('combobox'), { target: { value: '2' } });
    fireEvent.change(within(fenster).getByRole('textbox'), { target: { value: ' Gebetsabend ' } });
    fireEvent.click(within(fenster).getByRole('button', { name: 'Anlegen' }));
    expect(await screen.findByRole('heading', { name: 'Gebetsabend' })).toBeTruthy();
    expect(z.anlegen).toHaveBeenCalledWith({ name: ' Gebetsabend ', kalenderId: 2 });
    // Bearbeiten-Modus: der Knopf heißt „Fertig“ und das Plus ist da.
    expect(screen.getByRole('button', { name: 'Fertig' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Eintrag hinzufügen' })).toBeTruthy();
    expect(z.liste).toHaveBeenCalledTimes(2);
  });

  it('Fehler beim Anlegen (403 aus dem Kern) steht im Fenster, das offen bleibt', async () => {
    const z = zugriff(ROH, {
      anlegen: vi.fn(() => Promise.reject(new ApiError(403, VORLAGE_VERWEIGERT))),
    });
    render(<Seite z={z} darf={alles} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Neue Vorlage' }));
    const fenster = screen.getByRole('dialog', { name: 'Neue Vorlage' });
    fireEvent.change(within(fenster).getByRole('textbox'), { target: { value: 'X' } });
    fireEvent.click(within(fenster).getByRole('button', { name: 'Anlegen' }));
    expect((await within(fenster).findByRole('alert')).textContent).toBe(VORLAGE_VERWEIGERT);
    expect(within(fenster).getByRole('button', { name: 'Anlegen' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('mit dem echten Kern: eine leere Vorlage entsteht, wird nachgelesen und steht im Bearbeiten', async () => {
    // Der Erzeuger: `vorlageAnlegen` – ChurchTools als Attrappe, die den Aufruf ehrlich beantwortet.
    const gespeichert: CtAblaufVorlage[] = [];
    const kern = {
      agenda: () => Promise.reject(new Error('nicht gebraucht')),
      song: () => Promise.reject(new Error('nicht gebraucht')),
      vorlage: (id: number) => {
        const v = gespeichert.find((x) => x.id === id);
        return v ? Promise.resolve(v) : Promise.reject(new ApiError(404, 'weg'));
      },
      schreibe: (_p: string, a: { json?: unknown }) => {
        const j = a.json as { name: string; calendarId: number };
        gespeichert.push({ id: 11, name: j.name, calendarId: j.calendarId, items: [] });
        return Promise.resolve({ data: { id: 11 } });
      },
      fehler: (s: number, m: string) => new ApiError(s, m),
    };
    const z = zugriff(ROH, {
      anlegen: (d) => vorlageAnlegen(kern, d),
      vorlage: kern.vorlage,
      liste: () => Promise.resolve(vorlagenStandAus(gespeichert, KALENDER, 'Europe/Berlin')),
    });
    render(<Seite z={z} darf={alles} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Neue Vorlage' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Gebetsabend' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));
    expect(await screen.findByRole('heading', { name: 'Gebetsabend' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fertig' })).toBeTruthy();
  });
});

describe('Vorlage öffnen', () => {
  it('Kopf mit „‹ Vorlagen“, Name und „Ablaufvorlage · Kalender X“; ein Tipp in der Liste öffnet sie', async () => {
    render(<Seite z={zugriff()} darf={alles} />);
    fireEvent.click(await screen.findByRole('button', { name: /Gottesdienst/ }));
    expect(await screen.findByRole('heading', { name: 'Gottesdienst' })).toBeTruthy();
    expect(screen.getByText('Ablaufvorlage · Kalender Gottesdienst')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Vorlagen/ })).toBeTruthy();
    // Ansicht: Punkte ohne Uhrzeit.
    expect(screen.getByText('Begrüßung')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d\d:\d\d/);
  });

  it('„Bearbeiten“ nur mit dem Recht für den Kalender der Vorlage', async () => {
    render(<Seite z={zugriff()} darf={nurGottesdienst} start={5} />);
    expect(await screen.findByRole('button', { name: 'Vorlage bearbeiten' })).toBeTruthy();
    cleanup();
    render(<Seite z={zugriff()} darf={nurGottesdienst} start={6} />);
    await screen.findByRole('heading', { name: 'Jugendabend' });
    expect(screen.queryByRole('button', { name: 'Vorlage bearbeiten' })).toBeNull();
  });

  it('im Bearbeiten: „Umbenennen …“ und „Löschen …“ in der Hinweiszeile; Fertig beendet es', async () => {
    render(<Seite z={zugriff()} darf={alles} start={5} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Vorlage bearbeiten' }));
    expect(screen.getByRole('button', { name: /Umbenennen …/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Löschen …/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));
    expect(screen.queryByRole('button', { name: /Umbenennen …/ })).toBeNull();
  });

  it('nach einem Schreiben wird die Vorlage frisch gelesen – und die Liste', async () => {
    const z = zugriff();
    render(<Seite z={z} darf={alles} start={5} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Vorlage bearbeiten' }));
    const lesen = vi.mocked(z.vorlage).mock.calls.length;
    const liste = vi.mocked(z.liste).mock.calls.length;
    // Der Punkt „Begrüßung“: Dauer ändern und speichern → die Aktion meldet `geschrieben`.
    fireEvent.click(screen.getByText('Begrüßung').closest('button') as HTMLElement);
    fireEvent.change(screen.getByPlaceholderText('z. B. 5'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(vi.mocked(z.vorlage).mock.calls.length).toBeGreaterThan(lesen));
    expect(vi.mocked(z.liste).mock.calls.length).toBeGreaterThan(liste);
  });
});

describe('Umbenennen', () => {
  async function oeffne(z = zugriff()) {
    render(<Seite z={z} darf={alles} start={5} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Vorlage bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: /Umbenennen …/ }));
    return { z, fenster: screen.getByRole('dialog', { name: 'Vorlage umbenennen' }) };
  }

  it('Fenster mit dem Namen und „Höchstens 100 Zeichen.“; Speichern schreibt und zeigt den neuen Namen', async () => {
    const { z, fenster } = await oeffne();
    expect(within(fenster).getByText('Höchstens 100 Zeichen.')).toBeTruthy();
    const feld = within(fenster).getByRole<HTMLInputElement>('textbox');
    expect(feld.value).toBe('Gottesdienst');
    fireEvent.change(feld, { target: { value: 'Gottesdienst (Sommer)' } });
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByRole('heading', { name: 'Gottesdienst (Sommer)' })).toBeTruthy();
    expect(z.umbenennen).toHaveBeenCalledWith(5, 'Gottesdienst (Sommer)');
    expect(screen.queryByRole('dialog', { name: 'Vorlage umbenennen' })).toBeNull();
  });

  it('ein leerer Name lässt sich nicht speichern', async () => {
    const { fenster } = await oeffne();
    fireEvent.change(within(fenster).getByRole('textbox'), { target: { value: '  ' } });
    expect(within(fenster).getByRole('button', { name: 'Speichern' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('gesperrt oder verweigert: die Meldung des Kerns steht im Fenster', async () => {
    const z = zugriff(ROH, {
      umbenennen: vi.fn(() =>
        Promise.reject(new ApiError(423, 'Diese Ablaufvorlage ist gesperrt.')),
      ),
    });
    const { fenster } = await oeffne(z);
    fireEvent.change(within(fenster).getByRole('textbox'), { target: { value: 'Neu' } });
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }));
    expect((await within(fenster).findByRole('alert')).textContent).toBe(
      'Diese Ablaufvorlage ist gesperrt.',
    );
  });
});

describe('Löschen', () => {
  async function oeffne(z = zugriff()) {
    render(<Seite z={z} darf={alles} start={5} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Vorlage bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: /Löschen …/ }));
    return { z, fenster: screen.getByRole('alertdialog', { name: 'Vorlage löschen?' }) };
  }

  it('fragt nach – mit rotem Hinweis –, löscht erst auf „Löschen“ und führt zurück zur Liste', async () => {
    const { z, fenster } = await oeffne();
    expect(within(fenster).getByText('Das lässt sich nicht rückgängig machen.')).toBeTruthy();
    expect(z.loeschen).not.toHaveBeenCalled();
    fireEvent.click(within(fenster).getByRole('button', { name: 'Löschen' }));
    expect(await screen.findByRole('heading', { name: 'Ablaufvorlagen' })).toBeTruthy();
    expect(z.loeschen).toHaveBeenCalledWith(5);
    // Die Liste ist frisch gelesen – die gelöschte Vorlage fehlt.
    await waitFor(() => expect(screen.queryByRole('button', { name: /Gottesdienst/ })).toBeNull());
  });

  it('„Abbrechen“ löscht nichts und bleibt in der Vorlage', async () => {
    const { z, fenster } = await oeffne();
    fireEvent.click(within(fenster).getByRole('button', { name: 'Abbrechen' }));
    expect(z.loeschen).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Gottesdienst' })).toBeTruthy();
  });

  it('verweigert: die Meldung steht im Fenster, die Vorlage bleibt', async () => {
    const z = zugriff(ROH, {
      loeschen: vi.fn(() => Promise.reject(new ApiError(403, VORLAGE_VERWEIGERT))),
    });
    const { fenster } = await oeffne(z);
    fireEvent.click(within(fenster).getByRole('button', { name: 'Löschen' }));
    expect((await within(fenster).findByRole('alert')).textContent).toBe(VORLAGE_VERWEIGERT);
    // Das Fenster bleibt offen (die Seite dahinter ist für den Vorleser verdeckt, aber da).
    expect(screen.getByRole('heading', { name: 'Gottesdienst', hidden: true })).toBeTruthy();
  });
});

describe('Fehler beim Lesen einer Vorlage', () => {
  it('nicht erreichbar: Fehlerkasten statt Seite, „‹ Vorlagen“ bleibt', async () => {
    const z = zugriff(ROH, { vorlage: vi.fn(() => Promise.reject(new ApiError(503, 'x'))) });
    render(<Seite z={z} darf={alles} start={5} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Vorlagen/ })).toBeTruthy();
  });
});
