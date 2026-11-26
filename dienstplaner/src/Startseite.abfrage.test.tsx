// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { tagKurz } from '@shared/ct/datum';
import { diensteAus } from '@shared/ct/dienste';
import type { CtAbsence } from '@shared/ct/typen';
import { erinnerungsTage, STANDARD_PLAN, type Abfrage } from '@shared/dienstplan/abfragen';
import { standardInhalt, type AbfragenStand } from '@shared/dienstplan/abfragenSpeicher';
import { offeneTermine } from '@shared/dienstplan/erinnern';
import { LEERER_PLAN, mein, zeile } from '@shared/dienstplan/zeile.testutil';
import type { TerminZeile } from '@shared/dienstplan/termine';
import type { Antworten } from '@shared/dienstplan/verfuegbarkeit';
import { Startseite } from './Startseite';
import { austrittFuerEigene, ladeKarten } from './useAbfragen';
import type { Start } from './start';
import { startFuer } from './start.testutil';
import { ladeAbfragen, speichereAbfragen } from './ladeAbfragen';
import { ladeAbwesenheiten, ladeLieder, ladeMusikApp } from './ladeBeiwerk';
import { ladeZeitraum } from './ladeTermine';
import { ladeVerfuegbarkeit, type Verfuegbarkeit } from './ladeVerfuegbarkeit';
import { ladeEntwuerfe } from './ladeEntwuerfe';

/**
 * **R-3: die Abfrage auf der Startseite** – Karte für Mitarbeitende und Zeile für Planer. Geladen wird gegen Attrappen der
 * Lader (Abfragen, Antworten, Termine des Zeitraums, Abwesenheiten); die Erwartung für „offen“ kommt aus `offeneTermine`
 * selbst. Heute = Di 10.11.2026; Musik (Dienstgruppe 4) fragt Feb–Mär 2027, Frist Di 17.11.
 *
 * Termine der Abfrage (101–106): 101 offen · 102 Ja-Antwort · 103 abgesagt · 104 in MUSIK eingeteilt · 105 in TECHNIK
 * eingeteilt (bleibt offen) · 106 Abwesenheit. Offen: 101 und 105 – von 6.
 */
vi.mock('./ladeAbfragen', () => ({ ladeAbfragen: vi.fn(), speichereAbfragen: vi.fn() }));
vi.mock('./ladeBeiwerk', () => ({
  ladeLieder: vi.fn(),
  ladeAbwesenheiten: vi.fn(),
  ladeMusikApp: vi.fn(),
}));
vi.mock('./ladeTermine', () => ({ ladeZeitraum: vi.fn() }));
vi.mock('./ladeVerfuegbarkeit', () => ({ ladeVerfuegbarkeit: vi.fn() }));
vi.mock('./ladeEntwuerfe', () => ({ ladeEntwuerfe: vi.fn() }));
// Das Fenster selbst prüft `Planen.abfrage.test.tsx`; hier zählt nur, dass es für die richtige Gruppe aufgeht.
vi.mock('./AbfrageFenster', () => ({
  AbfrageFenster: (p: { gruppen: { gruppe: { name: string } | null }[]; onClose: () => void }) => (
    <div role="dialog" aria-label="Abfrage-Fenster">
      Stand {p.gruppen.map((g) => g.gruppe?.name).join(',')}
      <button type="button" onClick={p.onClose}>
        zu
      </button>
    </div>
  ),
}));

const abfragen = vi.mocked(ladeAbfragen);
const antwortenLader = vi.mocked(ladeVerfuegbarkeit);
const zeitraum = vi.mocked(ladeZeitraum);
const abwesenheiten = vi.mocked(ladeAbwesenheiten);

const HEUTE = '2026-11-10';
const ABFRAGE: Abfrage = {
  id: 'a1',
  von: '2027-02-01',
  bis: '2027-03-31',
  frist: '2026-11-17',
  oeffnen: '2026-11-09',
  termine: [101, 102, 103, 104, 105, 106],
  gestartet: { personId: 1, name: 'Alwin', zeit: '2026-11-09T07:00:00Z' },
  beendet: null,
};
const ZEILEN: TerminZeile[] = [
  zeile(101, 'Gottesdienst', '2027-02-07'),
  zeile(102, 'Gottesdienst', '2027-02-14'),
  zeile(103, 'Gottesdienst', '2027-02-21', { abgesagt: true }),
  zeile(104, 'Gottesdienst', '2027-03-07', {
    meine: [mein('Gesang', true, { ort: { serviceId: 9, index: null } })],
  }),
  zeile(105, 'Gottesdienst', '2027-03-14', {
    meine: [mein('Ton', true, { ort: { serviceId: 6, index: null } })],
  }),
  zeile(106, 'Gottesdienst', '2027-03-21'),
];
const ABW: CtAbsence = { id: 1, startDate: '2027-03-21', endDate: '2027-03-21' };
const ANTWORTEN: Antworten = { '102': { a: 'ja', tag: '2027-02-14' } };
const bereit = (extra: Partial<Verfuegbarkeit> = {}): Verfuegbarkeit => ({
  modul: 16,
  gruppen: [],
  bereit: [30],
  antworten: ANTWORTEN,
  vertretungen: {},
  fertig: {},
  lesefehler: null,
  ...extra,
});
const stand = (a: Abfrage | null): AbfragenStand => ({
  inhalt: { ...standardInhalt(), abfragen: a ? [a] : [] },
  gespeichert: null,
  unlesbar: false,
  fehler: null,
});

// Ich bin in der ChurchTools-Gruppe 9 (Gesang in Musik) – also in der Dienstgruppe Musik (4); planen darf ich nichts.
const MITARBEITER: Start = startFuer({
  gruppen: [{ id: 9, name: 'Musikteam', leitung: false }],
  rechte: { ...startFuer().rechte, planbareDienstgruppen: [] },
  dienste: diensteAus([
    { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7] },
    { id: 9, name: 'Gesang', serviceGroupId: 4, groupIds: [9] },
  ]),
});
const PLANER: Start = {
  ...MITARBEITER,
  rechte: { ...MITARBEITER.rechte, planbareDienstgruppen: [4] },
};

const zeige = (start: Start = MITARBEITER, heute = HEUTE) => {
  const abfrage = {
    anschluss: { lesen: vi.fn(), speichern: vi.fn(), ich: { personId: 1, name: 'Alwin' } },
    ladeZeitraum: vi.fn(),
    ladePersonen: vi.fn(),
    ladeAntworten: vi.fn(),
  };
  render(
    <Startseite
      start={start}
      termine={{ art: 'fertig', zeilen: [], plan: LEERER_PLAN, wochen: 8 }}
      heute={heute}
      onNochmal={() => {}}
      onMeineTermine={() => {}}
      abfrage={abfrage}
    />,
  );
};
const karte = () => screen.queryByRole('region', { name: /^Wann kannst du/ });

beforeEach(() => {
  window.location.hash = '';
  vi.mocked(ladeLieder).mockResolvedValue(null);
  vi.mocked(ladeMusikApp).mockResolvedValue(null);
  abwesenheiten.mockResolvedValue([ABW]);
  abfragen.mockImplementation((id) => Promise.resolve(id === 4 ? stand(ABFRAGE) : stand(null)));
  antwortenLader.mockResolvedValue(bereit());
  zeitraum.mockResolvedValue({ zeilen: ZEILEN, plan: LEERER_PLAN });
  vi.mocked(ladeEntwuerfe).mockResolvedValue({
    modul: 16,
    schubladen: new Map(),
    entwuerfe: new Map(),
    gruppeJe: new Map(),
    personenlisten: new Map(),
  });
});

describe('Karte für Mitarbeitende', () => {
  it('zeigt Frage, blaues Etikett, Text und Fortschritt – genau mit dem Ergebnis von offeneTermine', async () => {
    zeige();
    const k = within(
      await screen.findByRole('region', { name: 'Wann kannst du im Februar und März?' }),
    );
    const offen = offeneTermine({
      termine: ZEILEN,
      heute: HEUTE,
      beantwortet: (t) => t.id === 102 || t.id === 106,
      eingeteilt: (t) => t.id === 104,
      pausiert: () => false,
    }).offen;
    expect(offen.map((t) => t.id)).toEqual([101, 105]);
    expect(k.getByText(`bis ${tagKurz('2026-11-17')}`)).toBeTruthy();
    expect(
      k.getByText(`Musik fragt für 6 Termine (01.02.–31.03.). Noch ${offen.length} offen.`),
    ).toBeTruthy();
    const balken = k.getByRole('progressbar');
    expect(balken.getAttribute('aria-valuenow')).toBe(String(6 - offen.length));
    expect(balken.getAttribute('aria-valuemax')).toBe('6');
    // Der Zeitraum der Abfrage wird selbst geladen (die Startseite lädt nur 8 Wochen).
    expect(zeitraum).toHaveBeenCalledWith(
      MITARBEITER,
      '2027-02-01',
      '2027-03-31',
      expect.any(String),
    );
  });

  it('die Karte steht direkt unter „Als Nächstes“ und vor „Für dich offen“', async () => {
    const naechster = zeile(
      1,
      'Gottesdienst',
      new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10),
      {
        meine: [mein('Ton', false)],
      },
    );
    render(
      <Startseite
        start={MITARBEITER}
        termine={{ art: 'fertig', zeilen: [naechster], plan: LEERER_PLAN, wochen: 8 }}
        heute={HEUTE}
        onNochmal={() => {}}
        onMeineTermine={() => {}}
      />,
    );
    await screen.findByRole('region', { name: /^Wann kannst du/ });
    const namen = screen.getAllByRole('region').map((r) => r.getAttribute('aria-labelledby') ?? '');
    expect(namen.slice(0, 1)).toEqual(['als-naechstes']);
    expect(namen.indexOf('abfrage-4')).toBe(1);
    expect(namen.indexOf('offen')).toBeGreaterThan(namen.indexOf('abfrage-4'));
  });

  it('„Jetzt eintragen“ ist ein Knopf (Neben-Knopf, keine Hauptaktion) und führt zu „Verfügbarkeit“ mit der Abfrage', async () => {
    zeige();
    const k = within(await screen.findByRole('region', { name: /^Wann kannst du/ }));
    const knopf = k.getByRole('button', { name: 'Jetzt eintragen' });
    fireEvent.click(knopf);
    expect(window.location.hash).toBe('#/abwesenheiten?abfrage=4');
  });

  it('nach der Frist: rotes Etikett „Frist vorbei“, die Karte bleibt', async () => {
    zeige(MITARBEITER, '2026-11-18');
    const k = within(await screen.findByRole('region', { name: /^Wann kannst du/ }));
    expect(k.getByText('Frist vorbei')).toBeTruthy();
    expect(k.getByText(/Noch 2 offen\./)).toBeTruthy();
  });

  it('geplante (noch nicht geöffnete) und beendete Abfrage: keine Karte', async () => {
    abfragen.mockImplementation((id) =>
      Promise.resolve(id === 4 ? stand({ ...ABFRAGE, oeffnen: '2026-11-12' }) : stand(null)),
    );
    const { unmount } = render(<div />);
    unmount();
    zeige();
    await waitFor(() => expect(abfragen).toHaveBeenCalled());
    await waitFor(() => expect(zeitraum).not.toHaveBeenCalled());
    expect(karte()).toBeNull();
  });

  it('beendet (von einem Planer): keine Karte', async () => {
    abfragen.mockImplementation((id) =>
      Promise.resolve(id === 4 ? stand({ ...ABFRAGE, beendet: '2026-11-10' }) : stand(null)),
    );
    zeige();
    await waitFor(() => expect(abfragen).toHaveBeenCalled());
    expect(karte()).toBeNull();
    expect(zeitraum).not.toHaveBeenCalled();
  });

  it('Gegenprobe Zustand: ohne die Beendet-Marke steht dieselbe Abfrage da', async () => {
    zeige();
    expect(await screen.findByRole('region', { name: /^Wann kannst du/ })).toBeTruthy();
  });

  it('ist nichts mehr offen, erscheint keine Karte (kein „Danke“)', async () => {
    antwortenLader.mockResolvedValue(
      bereit({
        antworten: {
          ...ANTWORTEN,
          '101': { a: 'ja', tag: '2027-02-07' },
          '105': { a: 'vielleicht', tag: '2027-03-14' },
        },
      }),
    );
    zeige();
    await waitFor(() => expect(zeitraum).toHaveBeenCalled());
    await waitFor(() => expect(antwortenLader).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(karte()).toBeNull();
    expect(screen.queryByText(/Danke/)).toBeNull();
  });

  it('eine Abfrage einer Dienstgruppe, in der ich nicht bin: keine Karte', async () => {
    abfragen.mockImplementation((id) => Promise.resolve(id === 3 ? stand(ABFRAGE) : stand(null)));
    zeige();
    await waitFor(() => expect(abfragen).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(karte()).toBeNull();
  });
});

describe('Die Startseite scheitert nie daran – keine Karte, kein Fehlerbalken, nichts geschrieben', () => {
  const nichts = async () => {
    await new Promise((r) => setTimeout(r, 20));
    expect(karte()).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/nochmal|erneut|Fehler/i)).toBeNull();
    expect(vi.mocked(speichereAbfragen)).not.toHaveBeenCalled();
    // Die übrige Startseite steht.
    expect(screen.getByText('Verfügbarkeit')).toBeTruthy();
  };
  const stumm = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

  it('Abfragen nicht lesbar (Fehler beim Lesen)', async () => {
    abfragen.mockRejectedValue(new Error('weg'));
    zeige();
    await nichts();
  });
  it('Abfragen mit Lesefehler (kein Recht) oder unlesbarem Wert', async () => {
    abfragen.mockResolvedValue({ ...stand(ABFRAGE), fehler: 'kein-recht' });
    zeige();
    await nichts();
  });
  it('unlesbarer Wert', async () => {
    abfragen.mockResolvedValue({ ...stand(ABFRAGE), unlesbar: true });
    zeige();
    await nichts();
  });
  it('Antworten nicht lesbar (Lesefehler im Speicher)', async () => {
    antwortenLader.mockResolvedValue(bereit({ lesefehler: 'voruebergehend' }));
    zeige();
    await nichts();
  });
  it('Antworten: kein bereiter Speicher', async () => {
    antwortenLader.mockResolvedValue(bereit({ bereit: [], antworten: {} }));
    zeige();
    await nichts();
  });
  it('Antworten werfen', async () => {
    stumm();
    antwortenLader.mockRejectedValue(new Error('weg'));
    zeige();
    await nichts();
  });
  it('Termine des Zeitraums werfen', async () => {
    stumm();
    zeitraum.mockRejectedValue(new Error('weg'));
    zeige();
    await nichts();
  });
  it('Abwesenheiten werfen', async () => {
    stumm();
    abwesenheiten.mockRejectedValue(new Error('weg'));
    zeige();
    await nichts();
  });
});

describe('Zeile für Planer in der Karte „Planen“', () => {
  const zeigePlaner = () => zeige(PLANER);
  const planen = () => within(screen.getByRole('region', { name: 'Planen' }));

  it('Titel mit Monaten, Etikett und nächste Erinnerung (erster Tag aus erinnerungsTage) – ohne „x von y offen“', async () => {
    zeigePlaner();
    const zeilenKnopf = await planen().findByRole('button', { name: /Abfrage Musik · Feb–Mär/ });
    const erster = erinnerungsTage(STANDARD_PLAN, ABFRAGE, HEUTE)[0];
    expect(within(zeilenKnopf).getByText(`nächste Erinnerung ${tagKurz(erster)}`)).toBeTruthy();
    expect(within(zeilenKnopf).getByText(`bis ${tagKurz('2026-11-17')}`)).toBeTruthy();
    expect(zeilenKnopf.textContent).not.toMatch(/offen/);
  });

  it('auch eine geplante Abfrage hat eine Zeile (grau „öffnet …“); eine beendete keine', async () => {
    abfragen.mockImplementation((id) =>
      Promise.resolve(id === 4 ? stand({ ...ABFRAGE, oeffnen: '2026-11-12' }) : stand(null)),
    );
    zeigePlaner();
    const z = await planen().findByRole('button', { name: /Abfrage Musik/ });
    expect(within(z).getByText(`öffnet ${tagKurz('2026-11-12')}`)).toBeTruthy();
    // Für Mitarbeitende gibt es dazu (noch) keine Karte.
    expect(karte()).toBeNull();
  });

  it('beendet: keine Zeile', async () => {
    abfragen.mockImplementation((id) =>
      Promise.resolve(id === 4 ? stand({ ...ABFRAGE, beendet: HEUTE }) : stand(null)),
    );
    zeigePlaner();
    await waitFor(() => expect(abfragen).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(planen().queryByRole('button', { name: /^Abfrage / })).toBeNull();
  });

  it('keine nächste Erinnerung mehr → die Zeile lässt den Satz weg', async () => {
    abfragen.mockImplementation((id) =>
      Promise.resolve(
        id === 4 ? stand({ ...ABFRAGE, frist: '2026-11-10', oeffnen: '2026-11-10' }) : stand(null),
      ),
    );
    // Standard-Plan ohne Tage ab heute: eigener leerer Plan.
    abfragen.mockImplementation((id) =>
      Promise.resolve(
        id === 4
          ? {
              ...stand({ ...ABFRAGE, frist: '2026-11-10', oeffnen: '2026-11-10' }),
              inhalt: {
                plan: { punkte: [], mail: null },
                abfragen: [{ ...ABFRAGE, frist: '2026-11-10', oeffnen: '2026-11-10' }],
                einrichtung: null,
                verfuegbarkeit: 'zusagen' as const,
              },
            }
          : stand(null),
      ),
    );
    zeigePlaner();
    const z = await planen().findByRole('button', { name: /Abfrage Musik/ });
    expect(z.textContent).not.toMatch(/nächste Erinnerung/);
  });

  it('Antippen öffnet das Fenster „Abfrage“ im Stand dieser Gruppe', async () => {
    zeigePlaner();
    fireEvent.click(await planen().findByRole('button', { name: /Abfrage Musik/ }));
    const fenster = await screen.findByRole('dialog', { name: 'Abfrage-Fenster' });
    expect(fenster.textContent).toContain('Stand Musik');
    expect(vi.mocked(ladeEntwuerfe)).toHaveBeenCalled();
    fireEvent.click(within(fenster).getByRole('button', { name: 'zu' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Mitarbeitende ohne Planer-Recht sehen keine Zeile', async () => {
    zeige(MITARBEITER);
    await screen.findByRole('region', { name: /^Wann kannst du/ });
    expect(screen.queryByRole('region', { name: 'Planen' })).toBeNull();
  });
});

describe('Austritt beim Laden (R-5b): nur bei sicherem „nichts mehr offen“', () => {
  const MIT_EINR = (a: Abfrage | null) => ({
    ...stand(a),
    inhalt: { ...stand(a).inhalt, einrichtung: { gruppeId: 50, routineId: 60 } },
  });
  /** Alle sechs Termine beantwortet oder abgedeckt: 101 und 105 kommen dazu. */
  const ALLES: Antworten = {
    ...ANTWORTEN,
    '101': { a: 'ja', tag: '2027-02-07' },
    '105': { a: 'ja', tag: '2027-03-14' },
  };
  const einrichtungDa = () =>
    abfragen.mockImplementation((id) =>
      Promise.resolve(id === 4 ? MIT_EINR(ABFRAGE) : stand(null)),
    );

  it('offen > 0: niemand trägt sich aus – die Karte bleibt', async () => {
    einrichtungDa();
    const austritt = vi.fn(() => Promise.resolve('ausgetragen'));
    const karten = await ladeKarten(MITARBEITER, HEUTE, 'Europe/Berlin', undefined, austritt);
    expect(karten).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 10));
    expect(austritt).not.toHaveBeenCalled();
  });

  it('genau EIN Termin offen: niemand trägt sich aus (die Grenze ist 0, nicht 1)', async () => {
    einrichtungDa();
    antwortenLader.mockResolvedValue(
      bereit({ antworten: { ...ANTWORTEN, '101': { a: 'ja', tag: '2027-02-07' } } }),
    );
    const austritt = vi.fn(() => Promise.resolve('ausgetragen'));
    const karten = await ladeKarten(MITARBEITER, HEUTE, 'Europe/Berlin', undefined, austritt);
    expect(karten.map((k) => k.stand.offen)).toEqual([1]);
    await austrittFuerEigene(MITARBEITER, HEUTE, 'Europe/Berlin', undefined, austritt);
    await new Promise((r) => setTimeout(r, 10));
    expect(austritt).not.toHaveBeenCalled();
  });

  it('offen === 0: ein Austritt für diese Abfrage mit meiner Nummer, keine Karte', async () => {
    einrichtungDa();
    antwortenLader.mockResolvedValue(bereit({ antworten: ALLES }));
    const austritt = vi.fn(() => Promise.resolve('ausgetragen'));
    expect(await ladeKarten(MITARBEITER, HEUTE, 'Europe/Berlin', undefined, austritt)).toEqual([]);
    await waitFor(() => expect(austritt).toHaveBeenCalledTimes(1));
    expect(austritt).toHaveBeenCalledWith(
      expect.objectContaining({ gruppe: expect.objectContaining({ id: 4 }) }),
      MITARBEITER.ichId,
    );
  });

  it('Antworten nicht lesbar (Lesefehler, kein bereiter Speicher): nie ein Austritt – „offen 0“ wäre geraten', async () => {
    einrichtungDa();
    const austritt = vi.fn(() => Promise.resolve('ausgetragen'));
    for (const v of [
      bereit({ antworten: ALLES, lesefehler: 'voruebergehend' }),
      bereit({ antworten: ALLES, bereit: [] }),
    ]) {
      antwortenLader.mockResolvedValue(v);
      await austrittFuerEigene(MITARBEITER, HEUTE, 'Europe/Berlin', undefined, austritt);
    }
    expect(austritt).not.toHaveBeenCalled();
  });

  it('Termine oder Abwesenheiten nicht ladbar: nie ein Austritt, nie ein Wurf', async () => {
    einrichtungDa();
    antwortenLader.mockResolvedValue(bereit({ antworten: ALLES }));
    const austritt = vi.fn(() => Promise.resolve('ausgetragen'));
    zeitraum.mockRejectedValueOnce(new Error('aus'));
    await expect(
      austrittFuerEigene(MITARBEITER, HEUTE, 'Europe/Berlin', undefined, austritt),
    ).resolves.toBeUndefined();
    abwesenheiten.mockRejectedValueOnce(new Error('aus'));
    await expect(
      austrittFuerEigene(MITARBEITER, HEUTE, 'Europe/Berlin', undefined, austritt),
    ).resolves.toBeUndefined();
    expect(austritt).not.toHaveBeenCalled();
  });

  it('ohne Einrichtung im Dokument: kein Austritt, auch nicht bei offen 0', async () => {
    antwortenLader.mockResolvedValue(bereit({ antworten: ALLES }));
    const austritt = vi.fn(() => Promise.resolve('ausgetragen'));
    await austrittFuerEigene(MITARBEITER, HEUTE, 'Europe/Berlin', undefined, austritt);
    expect(austritt).not.toHaveBeenCalled();
  });

  it('ein Austritt, der scheitert, bleibt leise (kein Wurf, keine Wiederholung)', async () => {
    einrichtungDa();
    antwortenLader.mockResolvedValue(bereit({ antworten: ALLES }));
    const austritt = vi.fn(() => Promise.reject(new Error('Person 14 in Gruppe 50')));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      austrittFuerEigene(MITARBEITER, HEUTE, 'Europe/Berlin', undefined, austritt),
    ).resolves.toBeUndefined();
    expect(austritt).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalled();
  });
});

describe('Abfrage bei „Nur abwesend“ (V-4): Karte, Fertig-Stand und Austritt', () => {
  /** Musik fragt hier nur nach Abwesenheiten; Ja-Antworten (ANTWORTEN) zählen dann nicht. */
  const abwesendDa = (extra: { einrichtung?: { gruppeId: number; routineId: number } } = {}) =>
    abfragen.mockImplementation((id) =>
      Promise.resolve(
        id === 4
          ? {
              ...stand(ABFRAGE),
              inhalt: {
                ...stand(ABFRAGE).inhalt,
                verfuegbarkeit: 'abwesend' as const,
                einrichtung: extra.einrichtung ?? null,
              },
            }
          : stand(null),
      ),
    );
  const ZEIT = '2026-11-10T09:00:00.000Z';

  it('die Karte bittet statt zu zählen: Text mit „Fertig“, kein Fortschrittsbalken, „Jetzt eintragen“ führt in „Verfügbarkeit“ mit der Abfrage', async () => {
    abwesendDa();
    zeige();
    const k = within(
      await screen.findByRole('region', { name: 'Wann kannst du im Februar und März?' }),
    );
    expect(
      k.getByText(
        'Musik fragt für 6 Termine (01.02.–31.03.). Trag ein, wann du nicht kannst, und tippe auf „Fertig“.',
      ),
    ).toBeTruthy();
    expect(k.queryByRole('progressbar')).toBeNull();
    expect(k.queryByText(/Noch \d+ offen/)).toBeNull();
    fireEvent.click(k.getByRole('button', { name: 'Jetzt eintragen' }));
    expect(window.location.hash).toBe('#/abwesenheiten?abfrage=4');
  });

  it('eine Ja-Antwort an jedem Termin macht NICHT fertig – die Karte bleibt (die Ja-Antworten sind nur ausgeblendet)', async () => {
    abwesendDa();
    antwortenLader.mockResolvedValue(
      bereit({
        antworten: Object.fromEntries(
          [101, 102, 104, 105].map((id) => [String(id), { a: 'ja' as const, tag: '2027-02-07' }]),
        ),
      }),
    );
    zeige();
    expect(await screen.findByRole('region', { name: /^Wann kannst du/ })).toBeTruthy();
  });

  it('mit „Fertig“ (Bestätigung dieser Abfrage) erscheint keine Karte mehr', async () => {
    abwesendDa();
    antwortenLader.mockResolvedValue(bereit({ fertig: { a1: ZEIT } }));
    zeige();
    await waitFor(() => expect(antwortenLader).toHaveBeenCalled());
    await waitFor(() => expect(zeitraum).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    expect(karte()).toBeNull();
  });

  it('die Bestätigung einer anderen Abfrage lässt die Karte stehen', async () => {
    abwesendDa();
    antwortenLader.mockResolvedValue(bereit({ fertig: { andere: ZEIT } }));
    zeige();
    expect(await screen.findByRole('region', { name: /^Wann kannst du/ })).toBeTruthy();
  });

  it('Austritt: mit „Fertig“ trage ich mich aus – ohne nicht (auch nicht mit Ja-Antworten an allen Terminen)', async () => {
    abwesendDa({ einrichtung: { gruppeId: 50, routineId: 60 } });
    const austritt = vi.fn(() => Promise.resolve('ausgetragen'));
    antwortenLader.mockResolvedValue(
      bereit({
        antworten: Object.fromEntries(
          [101, 102, 104, 105].map((id) => [String(id), { a: 'ja' as const, tag: '2027-02-07' }]),
        ),
      }),
    );
    await austrittFuerEigene(MITARBEITER, HEUTE, 'Europe/Berlin', undefined, austritt);
    await new Promise((r) => setTimeout(r, 10));
    expect(austritt).not.toHaveBeenCalled();
    antwortenLader.mockResolvedValue(bereit({ fertig: { a1: ZEIT } }));
    expect(await ladeKarten(MITARBEITER, HEUTE, 'Europe/Berlin', undefined, austritt)).toEqual([]);
    await waitFor(() => expect(austritt).toHaveBeenCalledTimes(1));
    expect(austritt).toHaveBeenCalledWith(
      expect.objectContaining({ gruppe: expect.objectContaining({ id: 4 }) }),
      MITARBEITER.ichId,
    );
  });

  it('Antworten nicht lesbar: auch hier nie ein Austritt – „fertig“ wäre geraten', async () => {
    abwesendDa({ einrichtung: { gruppeId: 50, routineId: 60 } });
    const austritt = vi.fn(() => Promise.resolve('ausgetragen'));
    antwortenLader.mockResolvedValue(
      bereit({ fertig: { a1: ZEIT }, lesefehler: 'voruebergehend' }),
    );
    await austrittFuerEigene(MITARBEITER, HEUTE, 'Europe/Berlin', undefined, austritt);
    expect(austritt).not.toHaveBeenCalled();
  });
});
