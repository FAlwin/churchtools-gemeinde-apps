// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { LeitungNichtFestgehalten, WebsiteNichtNachgezogen } from './leitungFehler';
import { WerDarfWas } from './WerDarfWas';
import * as R from './rechte';

vi.mock('./rechte', () => ({
  ladeWerDarfWas: vi.fn(),
  rechteSetzen: vi.fn(),
  untergruppeRechteSetzen: vi.fn(),
}));
const r = vi.mocked(R);

const KAT = { entwuerfe: 104, veroeffentlicht: 107 };
const ROLLEN = [
  { id: 1, name: 'Leiter', leitung: true },
  { id: 2, name: 'Mitarbeiter', leitung: false },
  { id: 3, name: 'Coach', leitung: false },
];
const stufe = (name: string) => screen.getByLabelText<HTMLSelectElement>(`Stufe von ${name}`).value;

beforeEach(() => {
  r.ladeWerDarfWas.mockResolvedValue({
    rollen: ROLLEN,
    ist: [
      { rolle: 1, stufe: 'leitung' },
      { rolle: 2, stufe: 'redakteur' },
      { rolle: 3, stufe: 'keine' },
    ],
    untergruppen: [],
  });
  r.rechteSetzen.mockResolvedValue(undefined);
});

describe('Wer darf was', () => {
  it('zeigt je Rolle die Stufe, die aus den Rechten in ChurchTools abgeleitet ist', async () => {
    render(<WerDarfWas gruppe={344} kategorien={KAT} />);
    await screen.findByLabelText('Stufe von Leiter');
    expect(stufe('Leiter')).toBe('leitung');
    expect(stufe('Mitarbeiter')).toBe('redakteur');
    expect(stufe('Coach')).toBe('keine');
    expect(r.ladeWerDarfWas).toHaveBeenCalledWith(344, KAT);
  });

  it('ein Mischzustand wird als „Weicht ab“ gezeigt – gewählt ist dann der Vorschlag der Rolle', async () => {
    r.ladeWerDarfWas.mockResolvedValue({
      rollen: ROLLEN,
      ist: [
        { rolle: 1, stufe: 'leitung' },
        { rolle: 2, stufe: 'abweicht' },
        { rolle: 3, stufe: 'keine' },
      ],
      untergruppen: [],
    });
    render(<WerDarfWas gruppe={344} kategorien={KAT} />);
    await screen.findByLabelText('Stufe von Mitarbeiter');
    expect(screen.getByText(/Weicht ab/)).toBeTruthy();
    expect(stufe('Mitarbeiter')).toBe('redakteur');
  });

  it('„Rechte setzen“ übergibt die gewählten Stufen, liest danach neu und meldet „nachgelesen“', async () => {
    render(<WerDarfWas gruppe={344} kategorien={KAT} />);
    await screen.findByLabelText('Stufe von Coach');
    fireEvent.change(screen.getByLabelText('Stufe von Coach'), { target: { value: 'leitung' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechte setzen' }));
    await screen.findByText(/Die Rechte sind gesetzt und nachgelesen/);
    expect(r.rechteSetzen).toHaveBeenCalledWith(344, KAT, [
      { rolle: 1, stufe: 'leitung' },
      { rolle: 2, stufe: 'redakteur' },
      { rolle: 3, stufe: 'leitung' },
    ]);
    expect(r.ladeWerDarfWas).toHaveBeenCalledTimes(2);
  });

  it('Fehler beim Setzen: Meldung mit Grund, die Wahl bleibt stehen, nichts gilt als gesetzt', async () => {
    r.rechteSetzen.mockRejectedValueOnce(new ApiError(503, 'kurz weg'));
    render(<WerDarfWas gruppe={344} kategorien={KAT} />);
    await screen.findByLabelText('Stufe von Coach');
    fireEvent.change(screen.getByLabelText('Stufe von Coach'), { target: { value: 'redakteur' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechte setzen' }));
    expect(await screen.findByText(/Noch nicht gesetzt/)).toBeTruthy();
    expect(screen.queryByText(/nachgelesen/)).toBeNull();
    expect(stufe('Coach')).toBe('redakteur');
    // Der zweite Versuch klappt und meldet es.
    fireEvent.click(screen.getByRole('button', { name: 'Rechte setzen' }));
    await screen.findByText(/Die Rechte sind gesetzt und nachgelesen/);
    expect(screen.queryByText(/Noch nicht gesetzt/)).toBeNull();
  });

  it('Rechte gesetzt, aber die Leitung ließ sich nicht festhalten (W3b-3): eigene Meldung OHNE „Noch nicht gesetzt“ – es IST gesetzt, die Stufen werden neu gelesen, ein zweiter Versuch geht', async () => {
    r.rechteSetzen.mockRejectedValueOnce(new LeitungNichtFestgehalten());
    render(<WerDarfWas gruppe={344} kategorien={KAT} />);
    await screen.findByLabelText('Stufe von Coach');
    fireEvent.click(screen.getByRole('button', { name: 'Rechte setzen' }));
    const meldung = await screen.findByText(
      /Die Rechte sind gesetzt\. ChurchTools hat aber nicht festgehalten/,
    );
    expect(meldung.textContent).not.toMatch(/Noch nicht gesetzt/);
    expect(screen.queryByText(/nachgelesen/)).toBeNull();
    // Gelesen wird neu: die Stufen zeigen, was jetzt gilt.
    expect(r.ladeWerDarfWas).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Rechte setzen' }));
    await screen.findByText(/Die Rechte sind gesetzt und nachgelesen/);
    expect(screen.queryByText(/nicht festgehalten/)).toBeNull();
  });

  it('Lesefehler: Meldung mit „Erneut versuchen“ statt einer leeren Liste', async () => {
    r.ladeWerDarfWas.mockRejectedValueOnce(new ApiError(504, 'x'));
    render(<WerDarfWas gruppe={344} kategorien={KAT} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    await screen.findByLabelText('Stufe von Leiter');
    expect(r.rechteSetzen).not.toHaveBeenCalled();
  });

  it('der Knopf ist während des Setzens gesperrt', async () => {
    let fertig: () => void = () => {};
    r.rechteSetzen.mockReturnValueOnce(new Promise<void>((ok) => (fertig = ok)));
    render(<WerDarfWas gruppe={344} kategorien={KAT} />);
    await screen.findByLabelText('Stufe von Coach');
    fireEvent.click(screen.getByRole('button', { name: 'Rechte setzen' }));
    expect(screen.getByRole('button', { name: /Rechte werden gesetzt/ })).toHaveProperty(
      'disabled',
      true,
    );
    fertig();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Rechte setzen' })).toBeTruthy());
  });
});

describe('Wer darf was – Untergruppen (W3b-4a)', () => {
  /** Rollen der Untergruppen mit eigenen `group_role`-IDs (an den Mitgliedern stünden 16/15). */
  const UG_ROLLEN = [
    { id: 3323, name: 'Jugend-Leiter', leitung: true },
    { id: 3320, name: 'Jugend-Mitarbeiter', leitung: false },
  ];
  const TECHNIK_ROLLEN = [
    { id: 3401, name: 'Technik-Leiter', leitung: true },
    { id: 3402, name: 'Technik-Mitarbeiter', leitung: false },
  ];
  beforeEach(() => {
    r.ladeWerDarfWas.mockResolvedValue({
      rollen: ROLLEN,
      ist: [
        { rolle: 1, stufe: 'leitung' },
        { rolle: 2, stufe: 'redakteur' },
        { rolle: 3, stufe: 'keine' },
      ],
      untergruppen: [
        {
          gruppe: 347,
          name: 'Website – Jugend',
          kategorie: 117,
          rollen: UG_ROLLEN,
          ist: [
            { rolle: 3323, stufe: 'redakteur' },
            { rolle: 3320, stufe: 'abweicht' },
          ],
        },
        {
          gruppe: 350,
          name: 'Website – Technik',
          kategorie: null,
          rollen: TECHNIK_ROLLEN,
          ist: [],
        },
      ],
    });
    r.untergruppeRechteSetzen.mockResolvedValue(undefined);
  });
  const bereich = (name: string) => screen.getByRole('region', { name: `Untergruppe ${name}` });

  it('je Untergruppe ein Abschnitt: eingerichtet mit den Stufen aus ChurchTools („Weicht ab“), nicht eingerichtet mit Hinweis und Vorbelegung', async () => {
    render(<WerDarfWas gruppe={344} kategorien={KAT} />);
    await screen.findByLabelText('Stufe von Technik-Leiter');
    // Eingerichtet: die heutige Stufe (nicht der Vorschlag) und „Weicht ab“ bei der abweichenden Rolle.
    expect(stufe('Jugend-Leiter')).toBe('redakteur');
    expect(bereich('Website – Jugend').textContent).toMatch(/Weicht ab/);
    expect(bereich('Website – Jugend').textContent).not.toMatch(/noch nicht eingerichtet/);
    // Nicht eingerichtet: Hinweis und Vorbelegung (Leiter = Leitung).
    expect(bereich('Website – Technik').textContent).toMatch(/noch nicht eingerichtet/);
    expect(stufe('Technik-Leiter')).toBe('leitung');
    expect(stufe('Technik-Mitarbeiter')).toBe('redakteur');
    // Ein Knopf je Bereich.
    expect(screen.getAllByRole('button', { name: 'Rechte setzen' })).toHaveLength(3);
  });

  it('„Rechte setzen“ bei einer nicht eingerichteten Untergruppe richtet sie ein – mit ihrer Wahl, nicht über die Website', async () => {
    render(<WerDarfWas gruppe={344} kategorien={KAT} />);
    await screen.findByLabelText('Stufe von Technik-Mitarbeiter');
    fireEvent.change(screen.getByLabelText('Stufe von Technik-Mitarbeiter'), {
      target: { value: 'keine' },
    });
    const knopf = bereich('Website – Technik').querySelector('button')!;
    fireEvent.click(knopf);
    await screen.findByText(/Die Rechte sind gesetzt und nachgelesen/);
    expect(r.untergruppeRechteSetzen).toHaveBeenCalledWith(
      344,
      KAT,
      { id: 350, name: 'Website – Technik' },
      [
        { rolle: 3401, stufe: 'leitung' },
        { rolle: 3402, stufe: 'keine' },
      ],
    );
    expect(r.rechteSetzen).not.toHaveBeenCalled();
    expect(r.ladeWerDarfWas).toHaveBeenCalledTimes(2);
  });

  it('Website-Rollen nicht nachgezogen: eigene Meldung ohne „Noch nicht gesetzt“, neu gelesen', async () => {
    r.untergruppeRechteSetzen.mockRejectedValueOnce(
      new WebsiteNichtNachgezogen('Website – Technik'),
    );
    render(<WerDarfWas gruppe={344} kategorien={KAT} />);
    await screen.findByLabelText('Stufe von Technik-Leiter');
    fireEvent.click(bereich('Website – Technik').querySelector('button')!);
    const meldung = await screen.findByText(/„Website – Technik“ ist eingerichtet/);
    expect(meldung.textContent).not.toMatch(/Noch nicht gesetzt/);
    expect(r.ladeWerDarfWas).toHaveBeenCalledTimes(2);
  });

  it('während ein Bereich setzt, warten die anderen (beide ändern die Rechte der Website-Rollen)', async () => {
    let fertig: () => void = () => {};
    r.untergruppeRechteSetzen.mockReturnValueOnce(new Promise<void>((ok) => (fertig = ok)));
    render(<WerDarfWas gruppe={344} kategorien={KAT} />);
    await screen.findByLabelText('Stufe von Technik-Leiter');
    fireEvent.click(bereich('Website – Technik').querySelector('button')!);
    for (const k of screen.getAllByRole('button', { name: 'Rechte setzen' }))
      expect(k).toHaveProperty('disabled', true);
    expect(screen.getByLabelText<HTMLSelectElement>('Stufe von Leiter').disabled).toBe(true);
    fertig();
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Rechte setzen' })[0]).toHaveProperty(
        'disabled',
        false,
      ),
    );
  });
});
