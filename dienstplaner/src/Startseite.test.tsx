// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LEERER_PLAN, zeile } from '@shared/dienstplan/zeile.testutil';
import type { TerminZeile } from '@shared/dienstplan/termine';
import { Startseite } from './Startseite';
import type { Start } from './start';
import { startFuer } from './start.testutil';
import { ladeAbwesenheiten, ladeLieder, ladeMusikApp } from './ladeBeiwerk';

vi.mock('./ladeBeiwerk', () => ({
  ladeLieder: vi.fn(),
  ladeAbwesenheiten: vi.fn(),
  ladeMusikApp: vi.fn(),
}));
const lieder = vi.mocked(ladeLieder);
const abwesenheiten = vi.mocked(ladeAbwesenheiten);
const musikApp = vi.mocked(ladeMusikApp);

// „jetzt“ der Startseite ist die echte Uhr – die Tage im Test liegen deshalb relativ zu heute.
const tag = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const HEUTE = tag(0);
const START: Start = startFuer({ gemeinde: null });

const TEAM = ['Anna', 'Ben', 'Clara', 'David', 'Ella', 'Finn', 'Greta'].map((name) => ({
  dienst: 'Gesang',
  name,
  zugesagt: true,
}));

const ZEILEN: TerminZeile[] = [
  zeile(1, 'Gottesdienst', tag(5), {
    meine: [{ dienst: 'Ton', zugesagt: true }],
    team: TEAM,
    freiNachGruppe: { 3: 2 },
  }),
  zeile(2, 'Gebetsabend', tag(8), { meine: [{ dienst: 'Gesang', zugesagt: false }] }),
  zeile(3, 'Gottesdienst', tag(12), { meine: [{ dienst: 'Licht', zugesagt: true }] }),
];

function zeige(
  zeilen: TerminZeile[] = ZEILEN,
  extra: Partial<Parameters<typeof Startseite>[0]> = {},
) {
  const onMeineTermine = vi.fn();
  render(
    <Startseite
      start={START}
      termine={{ art: 'fertig', zeilen, plan: LEERER_PLAN, wochen: 8 }}
      heute={HEUTE}
      onNochmal={() => {}}
      onMeineTermine={onMeineTermine}
      {...extra}
    />,
  );
  return { onMeineTermine };
}

beforeEach(() => {
  lieder.mockResolvedValue(['Halleluja', 'Treu']);
  abwesenheiten.mockResolvedValue([]);
  musikApp.mockResolvedValue(null);
});

const held = () => within(screen.getByRole('region', { name: 'Gottesdienst' }));

describe('Startseite (E3-3)', () => {
  it('Als Nächstes: Termin, eigener Dienst, Team (fünf + „und 2 weitere“), Lieder aus dem Ablauf', async () => {
    zeige();
    expect(held().getByText('Du:', { exact: false }).textContent).toBe('Du: Ton · zugesagt');
    expect(held().getByText(/^Mit dabei:/).textContent).toBe(
      'Mit dabei: Anna (Gesang), Ben (Gesang), Clara (Gesang), David (Gesang), Ella (Gesang) und 2 weitere',
    );
    expect(await held().findByText('Lieder: Halleluja · Treu')).toBeTruthy();
    expect(lieder).toHaveBeenCalledWith(1);
  });

  it('kein Ablauf → „Noch kein Ablauf.“; Ablauf nicht lesbar → gar nichts (nicht „kein Ablauf“)', async () => {
    lieder.mockResolvedValueOnce(null);
    const { unmount } = render(
      <Startseite
        start={START}
        termine={{ art: 'fertig', zeilen: ZEILEN, plan: LEERER_PLAN, wochen: 8 }}
        heute={HEUTE}
        onNochmal={() => {}}
        onMeineTermine={() => {}}
      />,
    );
    expect(await held().findByText('Noch kein Ablauf.')).toBeTruthy();
    unmount();
    lieder.mockRejectedValueOnce(new Error('weg'));
    zeige();
    await waitFor(() => expect(lieder).toHaveBeenCalledTimes(2));
    expect(held().queryByText(/Ablauf|Lieder/)).toBeNull();
  });

  it('Musik-App installiert → Knopf mit ihrer Adresse; sonst keiner', async () => {
    musikApp.mockResolvedValue('https://ct.test/ccm/musik-app/');
    zeige();
    const link = await held().findByRole('link', { name: /Musik-App/ });
    expect(link.getAttribute('href')).toBe('https://ct.test/ccm/musik-app/');
  });

  it('Für dich offen: die Anfrage – mit Warnung, wenn man an dem Tag abwesend ist', async () => {
    abwesenheiten.mockResolvedValue([
      { id: 1, startDate: tag(8), endDate: tag(8), startTime: null, endTime: null },
    ]);
    zeige();
    const offen = within(screen.getByRole('region', { name: 'Für dich offen' }));
    expect(offen.getByText('Gesang · Gebetsabend')).toBeTruthy();
    expect(await offen.findByText('Du bist an dem Tag als abwesend eingetragen.')).toBeTruthy();
  });

  it('Deine nächsten Dienste: zugesagt, ohne den Termin oben; „Alle“ führt zu „Meine“', () => {
    const { onMeineTermine } = zeige();
    const dienste = within(screen.getByRole('region', { name: 'Deine nächsten Dienste' }));
    expect(
      dienste.getAllByRole('listitem').map((li) => li.querySelector('b')?.textContent),
    ).toEqual(['Licht · Gottesdienst']);
    fireEvent.click(dienste.getByRole('button', { name: /Alle/ }));
    expect(onMeineTermine).toHaveBeenCalled();
  });

  it('Abwesenheiten: Anzahl der kommenden; nicht lesbar → neutraler Text statt „nichts eingetragen“', async () => {
    abwesenheiten.mockResolvedValue([
      { id: 1, startDate: tag(-40), endDate: tag(-39) },
      { id: 2, startDate: tag(30), endDate: tag(32) },
    ]);
    const { unmount } = render(
      <Startseite
        start={START}
        termine={{ art: 'fertig', zeilen: ZEILEN, plan: LEERER_PLAN, wochen: 8 }}
        heute={HEUTE}
        onNochmal={() => {}}
        onMeineTermine={() => {}}
      />,
    );
    expect(await screen.findByText(/^1 eingetragen/)).toBeTruthy();
    unmount();
    abwesenheiten.mockRejectedValue(new Error('weg'));
    zeige();
    await waitFor(() => expect(abwesenheiten).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Trag ein, wann du nicht kannst.')).toBeTruthy();
    expect(screen.queryByText('Noch nichts eingetragen')).toBeNull();
  });

  it('Planen: freie Plätze je Gruppe (rot) oder „alles besetzt“', () => {
    zeige();
    const planen = within(screen.getByRole('region', { name: 'Planen' }));
    expect(planen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Technik2 Plätze frei',
      'Musikalles besetzt',
    ]);
  });

  it('ein einzelner freier Platz heißt „1 Platz frei“', () => {
    zeige([zeile(1, 'X', tag(5), { freiNachGruppe: { 3: 1 } })]);
    expect(screen.getByText('1 Platz frei')).toBeTruthy();
  });

  it('keine Termine → sagt es; Ladefehler → Fehlerkasten mit „Erneut versuchen“', () => {
    zeige([]);
    expect(screen.getByText('In den nächsten 8 Wochen stehen keine Termine an.')).toBeTruthy();
  });

  it('Ladefehler der Termine → Fehlerkasten; „Erneut versuchen“ ruft neu', () => {
    const onNochmal = vi.fn();
    render(
      <Startseite
        start={START}
        termine={{
          art: 'fehler',
          fehler: { text: 'ChurchTools antwortet gerade nicht.', nochmal: true },
        }}
        heute={HEUTE}
        onNochmal={onNochmal}
        onMeineTermine={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(onNochmal).toHaveBeenCalled();
  });
});
