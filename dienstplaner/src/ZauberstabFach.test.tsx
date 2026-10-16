// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import type { RohKandidat } from '@shared/dienstplan/werKann';
import type { EntwurfErgebnis } from '@shared/dienstplan/entwuerfe';
import { ZauberstabFach, type Wahl, type ZauberZeile } from './ZauberstabFach';
import { ladeWerKann } from './ladeWerKann';

vi.mock('./ladeWerKann', () => ({ ladeWerKann: vi.fn() }));
const laden = vi.mocked(ladeWerKann);
afterEach(() => laden.mockReset());

const k = (id: number, name: string, o: Partial<RohKandidat> = {}): RohKandidat => ({
  person: { domainIdentifier: String(id), title: name },
  score: 0,
  ...o,
});
const ANNA = k(1, 'Anna');
const BEN = k(2, 'Ben', { score: -40 });

/** Zwei Gottesdienste am selben Tag (9 und 11 Uhr), je ein freier Platz Ton. */
const zeile = (terminId: number, uhr: string, o: Partial<ZauberZeile> = {}): ZauberZeile => ({
  schluessel: `${terminId}|6|-`,
  terminId,
  serviceId: 6,
  tag: '2026-10-25',
  schonDa: [],
  dienst: 'Ton',
  nr: 1,
  von: 1,
  kopf: `So, 25.10. · Gottesdienst · ${uhr} Uhr`,
  monatName: 'Oktober',
  index: null,
  gruppeId: 3,
  gesehen: { art: 'frei' },
  ...o,
});
const NEUN = zeile(9, '09:00');
const ELF = zeile(11, '11:00');

const ok: EntwurfErgebnis = { ok: true, entwurf: null };

function zeige(o: Partial<Parameters<typeof ZauberstabFach>[0]> = {}) {
  const onClose = vi.fn();
  const uebernehmen = vi.fn(
    (wahlen: Wahl[], melde: (i: number, r: EntwurfErgebnis) => void): Promise<void> => {
      wahlen.forEach((_, i) => melde(i, ok));
      return Promise.resolve();
    },
  );
  render(
    <ZauberstabFach
      titel="Automatische Planung · Technik"
      unter="So, 25.10. · 2 Termine"
      zeilen={[NEUN, ELF]}
      eingeplant={[]}
      mitEntwurf={0}
      uebernehmen={uebernehmen}
      onClose={onClose}
      {...o}
    />,
  );
  return { onClose, uebernehmen };
}
const auswahl = (uhr: string) =>
  screen.getByRole<HTMLSelectElement>('combobox', { name: new RegExp(`${uhr} Uhr$`) });
const gewaehlt = (uhr: string) => auswahl(uhr).selectedOptions[0].textContent;

describe('ZauberstabFach (E5-2)', () => {
  it('lädt je Termin und Dienst, dann je Platz ein Vorschlag – am selben Tag nicht zweimal dieselbe Person', async () => {
    laden.mockResolvedValue([ANNA, BEN]);
    zeige();
    await screen.findByText('2 Vorschläge');
    expect(laden.mock.calls).toEqual([
      [9, 6],
      [11, 6],
    ]);
    expect(gewaehlt('09:00')).toBe('Anna (0×)');
    expect(gewaehlt('11:00')).toBe('Ben (0×)');
    expect(screen.getByRole('button', { name: '2 als Entwurf übernehmen' })).toBeTruthy();
  });

  it('niemand passt → „frei lassen“ mit Hinweis; zählt nicht mit', async () => {
    laden.mockResolvedValue([k(1, 'Anna', { score: -100 })]);
    zeige({ zeilen: [NEUN] });
    await screen.findByText('0 Vorschläge');
    expect(gewaehlt('09:00')).toBe('— frei lassen —');
    expect(screen.getByText(/Niemand Passendes frei/)).toBeTruthy();
    expect(screen.getByText(/ohne passende Person/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '0 als Entwurf übernehmen' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('„Passt eher nicht“ mit Grund – gewählt, steht „Achtung“ darunter', async () => {
    laden.mockResolvedValue([
      ANNA,
      k(3, 'David', { score: -1000, absences: [{ absenceReason: { nameTranslated: 'Urlaub' } }] }),
    ]);
    zeige({ zeilen: [NEUN] });
    await screen.findByText('1 Vorschlag');
    expect(screen.getByRole('option', { name: 'David – abwesend: Urlaub' })).toBeTruthy();
    fireEvent.change(auswahl('09:00'), { target: { value: '3' } });
    expect(screen.getByText('Achtung: abwesend: Urlaub')).toBeTruthy();
  });

  it('„hat zuvor abgesagt“ (wie ChurchTools): passt eher nicht, ehrlich benannt – bewusst wählbar', async () => {
    laden.mockResolvedValue([
      k(1, 'Anna', {
        score: -500,
        scoreHints: [{ score: -500, reason: 'service.previously-declined' }],
      }),
    ]);
    zeige({ zeilen: [NEUN] });
    await screen.findByText('0 Vorschläge');
    expect(
      screen.getByRole('option', { name: 'Anna – hat zuvor abgesagt oder wurde herausgenommen' }),
    ).toBeTruthy();
    fireEvent.change(auswahl('09:00'), { target: { value: '1' } });
    expect(screen.getByRole('button', { name: '1 als Entwurf übernehmen' })).toBeTruthy();
  });

  it('von Hand gewählt bleibt bei „Neu vorschlagen“, der Rest richtet sich danach', async () => {
    laden.mockResolvedValue([ANNA, BEN]);
    zeige();
    await screen.findByText('2 Vorschläge');
    fireEvent.change(auswahl('09:00'), { target: { value: '2' } }); // Ben um 9
    fireEvent.click(screen.getByRole('button', { name: 'Neu vorschlagen' }));
    expect(gewaehlt('09:00')).toBe('Ben (0×)');
    expect(gewaehlt('11:00')).toBe('Anna (0×)');
  });

  it('vorhandene Entwürfe zählen mit (`eingeplant`)', async () => {
    laden.mockResolvedValue([ANNA, BEN]);
    zeige({ zeilen: [NEUN], eingeplant: [{ personId: 1, tag: '2026-10-25' }] });
    await screen.findByText('1 Vorschlag');
    expect(gewaehlt('09:00')).toBe('Ben (0×)');
  });

  it('Übernehmen: nur gewählte Plätze, mit Name – alles gut → schließt mit der Anzahl', async () => {
    laden.mockResolvedValue([ANNA, BEN]);
    const { uebernehmen, onClose } = zeige();
    await screen.findByText('2 Vorschläge');
    fireEvent.change(auswahl('11:00'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '1 als Entwurf übernehmen' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(1));
    expect(uebernehmen.mock.calls[0][0].map((w) => [w.zeile.terminId, w.personId, w.name])).toEqual(
      [[9, 1, 'Anna']],
    );
  });

  it('Teilfehler: Fenster bleibt mit Ergebnis je Zeile; Schließen meldet, was eingetragen wurde', async () => {
    laden.mockResolvedValue([ANNA, BEN]);
    const uebernehmen = vi.fn(
      (_w: Wahl[], melde: (i: number, r: EntwurfErgebnis) => void): Promise<void> => {
        melde(0, ok);
        melde(1, { ok: false, grund: 'konflikt', jetzt: null });
        return Promise.resolve();
      },
    );
    const { onClose } = zeige({ uebernehmen });
    await screen.findByText('2 Vorschläge');
    fireEvent.click(screen.getByRole('button', { name: '2 als Entwurf übernehmen' }));
    await screen.findByText(/1 eingetragen/);
    expect(screen.getByText('als Entwurf eingetragen')).toBeTruthy();
    expect(screen.getByText('Jemand anderes hat diesen Platz eben geändert.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).toHaveBeenCalledWith(1);
  });

  it('Ladefehler → Fehlerkasten; „Erneut versuchen“ lädt neu', async () => {
    laden.mockRejectedValueOnce(new ApiError(502, 'ChurchTools antwortet nicht.'));
    laden.mockResolvedValue([ANNA]);
    zeige({ zeilen: [NEUN] });
    fireEvent.click(await screen.findByRole('button', { name: /erneut versuchen/i }));
    await screen.findByText('1 Vorschlag');
  });

  it('Abbrechen beim Laden: schließt ohne etwas einzutragen', async () => {
    laden.mockReturnValue(new Promise<never>(() => {}));
    const { onClose, uebernehmen } = zeige();
    expect(screen.getByText(/Vorschläge werden berechnet/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onClose).toHaveBeenCalledWith(0);
    expect(uebernehmen).not.toHaveBeenCalled();
  });

  it('während des Eintragens lässt sich das Fenster nicht schließen', async () => {
    laden.mockResolvedValue([ANNA]);
    const { onClose } = zeige({ zeilen: [NEUN], uebernehmen: () => new Promise<never>(() => {}) });
    fireEvent.click(await screen.findByRole('button', { name: '1 als Entwurf übernehmen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bitte warten – wird eingetragen …' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Abbrechen beim Laden hält auch die noch offenen Abfragen an', async () => {
    const offen: ((r: RohKandidat[]) => void)[] = [];
    laden.mockImplementation(() => new Promise((r) => offen.push(r)));
    const zeilen = [1, 2, 3, 4, 5, 6].map((t) => zeile(t, `0${t}:00`));
    const { onClose } = zeige({ zeilen });
    await waitFor(() => expect(laden).toHaveBeenCalledTimes(4));
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onClose).toHaveBeenCalledWith(0);
    offen.forEach((r) => r([ANNA]));
    await new Promise((r) => setTimeout(r, 0));
    expect(laden).toHaveBeenCalledTimes(4);
  });

  it('Plätze mit Entwurf: der Hinweis, dass sie bleiben', async () => {
    laden.mockResolvedValue([ANNA]);
    zeige({ zeilen: [NEUN], mitEntwurf: 2 });
    await screen.findByText(/2 Plätze mit Entwurf bleiben, wie sie sind/);
  });
});
