// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { planAus } from '@shared/dienstplan/plan';
import type { RohTermin } from '@shared/dienstplan/termine';
import { abwesenheitenAus, type GruppenStand } from '@shared/dienstplan/personenDaten';
import type { PersonenAntworten } from '@shared/dienstplan/personenAntworten';
import { mailInhalt } from '@shared/dienstplan/erinnern';
import { antwortBereinigt, type Antworten } from '@shared/dienstplan/verfuegbarkeit';
import { diensteAus } from '@shared/ct/dienste';
import { ApiError } from '@ui/ct/fehler';
import type { AntwortenLader } from './ladeAntworten';
import type { PersonenLader } from './ladePersonen';
import type { MailSender } from './erinnernSenden';
import { Planen } from './Planen';
import { ganzSichtbar, planbar } from './start';
import { startFuer } from './start.testutil';

/**
 * E5c-5 „Erinnern“ im Fenster: Knopf, Dienstgruppen mit Zahl, gesperrte Gruppe mit Grund, Empfänger mit Abwählen und
 * Vorschau (= Versand), „Text anpassen“, Ergebnis, Anhalten mit „An die übrigen“, Esc. Gesendet wird nichts – `senden` ist ein
 * Spion. Die Regel „wer fehlt“ steht in `shared/dienstplan/erinnern.test.ts`.
 *
 * Plan: Termin 20 (So 18.10., 10:00) mit Ton (Technik) – David ist dort eingeteilt – und einem freien Gesang-Platz; Termin 21
 * (Mi 21.10., 19:00) mit einem freien Gesang-Platz. Musik (CT-Gruppe 9): Anna, Ben, Carla. Technik (CT-Gruppe 7): Anna, David.
 * Antworten (nur Musik sichtbar): Ben Ja an beiden, Anna Ja am 21., Carla am 20. abwesend, sonst nichts → Musik fehlt:
 * Anna (20.), Carla (21.). Technik (wenn sichtbar): Anna (20.).
 */
const START = startFuer({
  dienste: diensteAus([
    { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7], sortKey: 1 },
    { id: 9, name: 'Gesang', serviceGroupId: 4, groupIds: [9], sortKey: 2 },
  ]),
});
const ROH = [
  {
    id: 20,
    name: 'Gottesdienst',
    startDate: '2026-10-18T08:00:00Z',
    endDate: '2026-10-18T09:30:00Z',
    eventServices: [
      { serviceId: 6, personId: 14, name: 'David Test', isAccepted: true, index: null },
      { serviceId: 9, personId: null, name: null, index: null },
    ],
  },
  {
    id: 21,
    name: 'Gebetsabend',
    startDate: '2026-10-21T17:00:00Z',
    endDate: '2026-10-21T18:30:00Z',
    eventServices: [{ serviceId: 9, personId: null, name: null, index: null }],
  },
] as RohTermin[];
const PLAN = planAus(ROH, {
  ichId: START.ichId,
  dienste: START.dienste,
  dienstgruppen: START.dienstgruppen,
  zeitzone: 'Europe/Berlin',
  planbar: (d) => planbar(START, d),
  ganzSichtbar: (d) => ganzSichtbar(START, d),
});

const person = (id: number, name: string) => ({
  id,
  name,
  bild: null,
  initialen: name.slice(0, 2),
});
const ANNA = person(5, 'Anna Test');
const BEN = person(8, 'Ben Test');
const CARLA = person(11, 'Carla Test');
const DAVID = person(14, 'David Test');
const da = (
  mitglieder: ReturnType<typeof person>[],
  abwesenheiten: Extract<GruppenStand, { art: 'da' }>['abwesenheiten'] = [],
): GruppenStand => ({ art: 'da', mitglieder, abwesenheiten });
const abwesend = abwesenheitenAus([
  {
    id: 1,
    person: { domainIdentifier: '11' },
    absenceReason: { nameTranslated: 'Urlaub' },
    startDate: '2026-10-18',
    endDate: '2026-10-18',
  },
]);
const personenStand = (): Map<number, GruppenStand> =>
  new Map<number, GruppenStand>([
    [7, da([ANNA, DAVID], abwesend)],
    [9, da([ANNA, BEN, CARLA], abwesend)],
  ]);
const antw = (x: Parameters<typeof antwortBereinigt>[0][]): Antworten =>
  Object.fromEntries(x.map((e, i) => [String(20 + i), antwortBereinigt(e)]));
const ANTWORTEN = (sichtbar: number[] = [4]): PersonenAntworten => ({
  jePerson: new Map<number, Antworten>([
    [
      8,
      antw([
        { a: 'ja', tag: '2026-10-18' },
        { a: 'ja', tag: '2026-10-21' },
      ]),
    ],
    [5, { '21': antwortBereinigt({ a: 'ja', tag: '2026-10-21' }) }],
  ]),
  sichtbar: new Set(sichtbar),
});

const LINK = 'https://ct.test/ccm/dienstplaner/#/abwesenheiten';

interface Aufbau {
  senden?: MailSender;
  personen?: PersonenLader;
  antworten?: AntwortenLader;
  erinnern?: boolean;
  start?: ReturnType<typeof startFuer>;
}
function zeige(o: Aufbau = {}) {
  const senden = o.senden ?? vi.fn<MailSender>(() => Promise.resolve({}));
  const start = o.start ?? START;
  const plan = o.start
    ? planAus(ROH, {
        ichId: start.ichId,
        dienste: start.dienste,
        dienstgruppen: start.dienstgruppen,
        zeitzone: 'Europe/Berlin',
        planbar: (d) => planbar(start, d),
        ganzSichtbar: (d) => ganzSichtbar(start, d),
      })
    : PLAN;
  localStorage.setItem('dienstplaner.planen.ansicht', JSON.stringify({ unteransicht: 'matrix' }));
  const r = render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan, wochen: 8 }}
      handy={false}
      onNochmal={() => {}}
      onMehr={() => {}}
      mehrMoeglich={false}
      ladeZeitraum={vi.fn(() => new Promise<never>(() => {}))}
      heute="2026-10-14"
      ladePersonen={o.personen ?? (() => Promise.resolve(personenStand()))}
      ladeAntworten={o.antworten ?? (() => Promise.resolve(ANTWORTEN()))}
      erinnern={o.erinnern === false ? undefined : { senden, link: () => LINK }}
    />,
  );
  return { senden, ...r };
}
const knopf = () => screen.queryByRole('button', { name: /^Erinnern:/ });
const oeffnen = async (o: Aufbau = {}) => {
  const z = zeige(o);
  fireEvent.click(screen.getByRole('button', { name: /^Erinnern:/ }));
  const fenster = await screen.findByRole('dialog', { name: 'Erinnern' });
  return { ...z, fenster };
};
/** Wartet, bis das Fenster geladen hat (die Dienstgruppen-Knöpfe stehen da). */
const geladen = async (f: HTMLElement) => within(f).findByRole('list', { name: 'Dienstgruppen' });
const zeilen = (f: HTMLElement) =>
  within(within(f).getByRole('list', { name: 'Empfänger' })).getAllByRole('listitem');
const haken = (f: HTMLElement, name: string) =>
  within(f).getByRole<HTMLInputElement>('checkbox', { name: `${name} erinnern` });
const sendeKnopf = (f: HTMLElement, text: RegExp) => within(f).getByRole('button', { name: text });
const bodies = (s: MailSender) =>
  (s as ReturnType<typeof vi.fn<MailSender>>).mock.calls.map((c) => c[0]);

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Der Knopf „Erinnern“ in der Planen-Leiste', () => {
  it('steht da für Planer mit einer planbaren Dienstgruppe', () => {
    zeige();
    expect(knopf()).not.toBeNull();
  });

  it('fehlt ohne Anschluss „erinnern“, ohne planbare Dienstgruppe – und ohne Lader für Personen/Antworten', () => {
    zeige({ erinnern: false });
    expect(knopf()).toBeNull();
    cleanup();
    zeige({
      start: startFuer({
        dienste: START.dienste,
        rechte: { ...START.rechte, planbareDienstgruppen: [], sichtbareDienstgruppen: null },
      }),
    });
    expect(knopf()).toBeNull();
  });
});

describe('Das Fenster: Gruppen, Empfänger, Vorschau', () => {
  it('Titel und Unterzeile; die Gruppen als Knöpfe mit Zahl – Musik vorgewählt, Technik gesperrt mit Grund', async () => {
    const { fenster } = await oeffnen();
    const gruppen = await geladen(fenster);
    expect(
      within(fenster).getByText(
        'Termine So, 18.10. – Mi, 21.10. (wie gezeigt) · Mail über ChurchTools, Absender: du',
      ),
    ).toBeTruthy();
    const musik = within(gruppen).getByRole('button', { name: 'Musik · 2' });
    expect(musik.getAttribute('aria-pressed')).toBe('true');
    const technik = within(gruppen).getByRole('button', { name: 'Technik · gesperrt' });
    expect((technik as HTMLButtonElement).disabled).toBe(true);
    expect(technik.getAttribute('aria-pressed')).toBe('false');
    expect(
      within(fenster).getByText('Technik ist gesperrt: Antworten nicht sichtbar.'),
    ).toBeTruthy();
  });

  it('nur planbare Dienstgruppen stehen zur Wahl – eine Gruppe, die man nur sehen darf, nicht', async () => {
    const { fenster } = await oeffnen({
      start: startFuer({
        dienste: START.dienste,
        rechte: { ...START.rechte, planbareDienstgruppen: [4], sichtbareDienstgruppen: null },
      }),
    });
    const gruppen = await geladen(fenster);
    expect(within(gruppen).getAllByRole('listitem')).toHaveLength(1);
    expect(within(gruppen).getByRole('button', { name: 'Musik · 2' })).toBeTruthy();
    expect(within(gruppen).queryByRole('button', { name: /Technik/ })).toBeNull();
  });

  it('Empfänger: Anna (offen: So, 18.10.) und Carla (Mi, 21.10.), je mit Haken; Zähler im Senden-Knopf', async () => {
    const { fenster } = await oeffnen();
    await geladen(fenster);
    const z = zeilen(fenster);
    expect(z).toHaveLength(2);
    expect(z[0].textContent).toContain('Anna Test');
    expect(z[0].textContent).toContain('1 offen: So, 18.10.');
    expect(z[1].textContent).toContain('Carla Test');
    expect(z[1].textContent).toContain('1 offen: Mi, 21.10.');
    expect(
      within(fenster).getByText('2 bekommen eine eigene Mail mit ihren offenen Terminen'),
    ).toBeTruthy();
    expect(sendeKnopf(fenster, /^An 2 Personen senden$/)).toBeTruthy();
  });

  it('Abwählen nimmt die Person aus dem Versand; mit nur noch einer heißt es „An 1 Person senden“', async () => {
    const { fenster, senden } = await oeffnen();
    await geladen(fenster);
    fireEvent.click(within(fenster).getByRole('checkbox', { name: 'Carla Test erinnern' }));
    expect(sendeKnopf(fenster, /^An 1 Person senden$/)).toBeTruthy();
    expect(
      within(fenster).getByText('1 bekommt eine eigene Mail mit ihren offenen Terminen'),
    ).toBeTruthy();
    (senden as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { sentRecipientIds: [5] } });
    fireEvent.click(sendeKnopf(fenster, /^An 1 Person senden$/));
    await screen.findByText('1 Mail verschickt.');
    expect(bodies(senden).map((b) => b.recipients)).toEqual([[5]]);
  });

  it('keine Person gewählt → Senden gesperrt', async () => {
    const { fenster } = await oeffnen();
    await geladen(fenster);
    fireEvent.click(within(fenster).getByRole('checkbox', { name: 'Anna Test erinnern' }));
    fireEvent.click(within(fenster).getByRole('checkbox', { name: 'Carla Test erinnern' }));
    expect((sendeKnopf(fenster, /^An 0 Personen senden$/) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('Vorschau: dieselbe Mail wie beim Senden (Betreff, Text, Termine, Knopf mit der vollen Adresse)', async () => {
    const { fenster, senden } = await oeffnen();
    await geladen(fenster);
    fireEvent.click(
      within(fenster).getByRole('button', { name: 'Vorschau der Mail an Anna Test' }),
    );
    const vorschau = within(fenster).getByRole('region', { name: 'Vorschau für Anna Test' });
    expect(vorschau.textContent).toContain('Betreff: Wann kannst du im Oktober?');
    expect(vorschau.textContent).toContain('Hallo Anna,');
    expect(vorschau.textContent).toContain('So, 18.10. · Gottesdienst · 10:00 Uhr');
    const a = vorschau.querySelector('a')!;
    expect(a.getAttribute('href')).toBe(LINK);
    expect(a.textContent).toBe('Im Dienstplaner eintragen');
    // Ein Klick auf den Knopf der Vorschau öffnet nichts.
    expect(fireEvent.click(a)).toBe(false);

    (senden as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { sentRecipientIds: [5, 11] } });
    fireEvent.click(sendeKnopf(fenster, /^An 2 Personen senden$/));
    await screen.findByText('Erinnert');
    const gesendet = bodies(senden)[0];
    // Vergleich über den DOM: was verschickt wird, ist das, was die Vorschau zeigt.
    const zeigt = document.createElement('div');
    zeigt.innerHTML = gesendet.body;
    // Betreff-Zeile, dann der Inhalt der Mail: Wort für Wort derselbe wie der gesendete (`children[1]`).
    expect(vorschau.children[1].innerHTML).toBe(zeigt.innerHTML);
    expect(gesendet.body).toBe(
      mailInhalt({
        name: 'Anna Test',
        einleitung:
          'für diese Termine fehlt noch deine Antwort. Bitte trag kurz ein, ob du kannst – Ja, Vielleicht oder Nein. Danke!',
        termine: [{ terminId: 20, tag: '2026-10-18', name: 'Gottesdienst', uhrzeit: '10:00' }],
        link: LINK,
      }),
    );
    expect(gesendet.subject).toBe('Wann kannst du im Oktober?');
  });

  it('„Text anpassen“: Betreff und Einleitung gehen so raus – maskiert, mit Zeilenumbruch', async () => {
    const { fenster, senden } = await oeffnen();
    await geladen(fenster);
    fireEvent.click(within(fenster).getByRole('button', { name: /Text anpassen/ }));
    fireEvent.change(within(fenster).getByLabelText('Betreff'), {
      target: { value: 'Dezember-Plan' },
    });
    fireEvent.change(within(fenster).getByLabelText(/^Text \(nach/), {
      target: { value: 'Bitte <b>jetzt</b> & schnell\nDanke' },
    });
    fireEvent.click(
      within(fenster).getByRole('button', { name: 'Vorschau der Mail an Carla Test' }),
    );
    expect(
      within(fenster).getByRole('region', { name: 'Vorschau für Carla Test' }).textContent,
    ).toContain('Betreff: Dezember-Plan');
    (senden as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { sentRecipientIds: [5, 11] } });
    fireEvent.click(sendeKnopf(fenster, /^An 2 Personen senden$/));
    await screen.findByText('Erinnert');
    const a = bodies(senden)[0];
    expect(a.subject).toBe('Dezember-Plan');
    expect(a.body).toContain('Bitte &lt;b&gt;jetzt&lt;/b&gt; &amp; schnell<br>Danke');
    expect(a.body).not.toContain('<b>');
  });

  it('zwei Gruppen gewählt: eine Person einmal – mit beiden Gruppen und vereinigten Terminen; ein Aufruf je Person', async () => {
    const { fenster, senden } = await oeffnen({
      antworten: () => Promise.resolve(ANTWORTEN([3, 4])),
    });
    const gruppen = await geladen(fenster);
    // Technik ist jetzt beurteilbar: Anna fehlt dort am 18. (David ist eingeteilt, Anna nicht).
    const technik = within(gruppen).getByRole('button', { name: 'Technik · 1' });
    const musik = within(gruppen).getByRole('button', { name: 'Musik · 2' });
    // Vorgewählt ist die erste Gruppe mit Fehlenden (Plan-Reihenfolge) – die andere kommt dazu.
    expect([technik, musik].filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(
      1,
    );
    fireEvent.click([technik, musik].find((b) => b.getAttribute('aria-pressed') === 'false')!);
    expect(technik.getAttribute('aria-pressed')).toBe('true');
    expect(musik.getAttribute('aria-pressed')).toBe('true');
    const z = zeilen(fenster);
    expect(z.map((x) => x.querySelector('b')?.textContent)).toEqual([
      expect.stringMatching(/^Anna Test · .*Technik.*Musik|^Anna Test · .*Musik.*Technik/),
      'Carla Test',
    ]);
    // Anna fehlt am 18. in BEIDEN Gruppen – der Termin steht einmal da.
    expect(z[0].textContent).toContain('1 offen: So, 18.10.');
    (senden as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { sentRecipientIds: [5, 11] } });
    fireEvent.click(sendeKnopf(fenster, /^An 2 Personen senden$/));
    await screen.findByText('Erinnert');
    expect(bodies(senden).map((b) => b.recipients)).toEqual([[5], [11]]);
    expect(bodies(senden)[0].eventIds).toEqual([20]);
  });

  it('Ladefehler: Hinweis mit „Erneut versuchen“, niemand wird als „fehlend“ gezeigt', async () => {
    const lader = vi
      .fn<PersonenLader>()
      .mockRejectedValueOnce(new ApiError(504, 'Zeitüberschreitung'))
      .mockResolvedValue(personenStand());
    const { fenster } = await oeffnen({ personen: lader });
    const kasten = await within(fenster).findByRole('alert');
    expect(kasten.textContent).toContain('ChurchTools antwortet gerade nicht');
    expect(within(fenster).queryByRole('list', { name: 'Empfänger' })).toBeNull();
    expect(within(fenster).queryByRole('list', { name: 'Dienstgruppen' })).toBeNull();
    fireEvent.click(within(kasten).getByRole('button', { name: 'Erneut versuchen' }));
    await geladen(fenster);
    expect(zeilen(fenster)).toHaveLength(2);
  });

  it('die Abwesenheiten einer Gruppe nicht sichtbar → Musik gesperrt, Grund genannt, nichts zu senden', async () => {
    const { fenster } = await oeffnen({
      personen: () =>
        Promise.resolve(
          new Map<number, GruppenStand>([
            [7, da([ANNA, DAVID])],
            [9, da([ANNA, BEN, CARLA], 'nichtSichtbar')],
          ]),
        ),
    });
    await geladen(fenster);
    expect(
      within(fenster).getByText('Musik ist gesperrt: Abwesenheiten nicht sichtbar.'),
    ).toBeTruthy();
    expect(within(fenster).getByText('Wähle mindestens eine Dienstgruppe.')).toBeTruthy();
    expect((sendeKnopf(fenster, /^An 0 Personen senden$/) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe('Senden und Ergebnis', () => {
  it('alles geklappt: „2 Mails verschickt.“ mit Namen, Hinweis zum Hintergrund, „Fertig“ schließt; Kopie nur im ersten Aufruf', async () => {
    const senden = vi
      .fn<MailSender>()
      .mockResolvedValueOnce({ data: { sentRecipientIds: [5] } })
      .mockResolvedValueOnce({ data: { sentRecipientIds: [11] } });
    const { fenster } = await oeffnen({ senden });
    await geladen(fenster);
    fireEvent.click(within(fenster).getByRole('checkbox', { name: 'Eine Kopie an mich' }));
    fireEvent.click(sendeKnopf(fenster, /^An 2 Personen senden$/));
    const ok = await screen.findByText('2 Mails verschickt.');
    expect(ok.parentElement?.textContent).toContain('Anna Test, Carla Test.');
    expect(screen.getByText(/ChurchTools verschickt im Hintergrund/)).toBeTruthy();
    expect(bodies(senden).map((b) => b.sendCopyToMe)).toEqual([true, false]);
    fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ohne Mail-Adresse (rejectedRecipientIds): „Nicht erinnert: Carla Test (keine Mail-Adresse in ChurchTools).“', async () => {
    const senden = vi
      .fn<MailSender>()
      .mockResolvedValueOnce({ data: { sentRecipientIds: [5], rejectedRecipientIds: [] } })
      .mockResolvedValueOnce({ data: { sentRecipientIds: [], rejectedRecipientIds: [11] } });
    const { fenster } = await oeffnen({ senden });
    await geladen(fenster);
    fireEvent.click(sendeKnopf(fenster, /^An 2 Personen senden$/));
    await screen.findByText('1 Mail verschickt.');
    expect(
      screen.getByText(/Nicht erinnert: Carla Test \(keine Mail-Adresse in ChurchTools\)\./),
    ).toBeTruthy();
  });

  it('niemand hat eine Mail-Adresse: Titel „Niemand erinnert“, „Keine Mail verschickt.“ – nicht „Erinnert“', async () => {
    const senden = vi
      .fn<MailSender>()
      .mockResolvedValueOnce({ data: { sentRecipientIds: [], rejectedRecipientIds: [5] } })
      .mockResolvedValueOnce({ data: { sentRecipientIds: [], rejectedRecipientIds: [11] } });
    const { fenster } = await oeffnen({ senden });
    await geladen(fenster);
    fireEvent.click(sendeKnopf(fenster, /^An 2 Personen senden$/));
    await screen.findByText('Keine Mail verschickt.');
    expect(screen.getByText('Niemand erinnert')).toBeTruthy();
    expect(screen.queryByText('Erinnert')).toBeNull();
  });

  it('Abbruch (504 bei Carla): „1 von 2 verschickt“, Carla unklar und NICHT vorgewählt; Senden an die übrigen nur auf Wunsch', async () => {
    const senden = vi
      .fn<MailSender>()
      .mockResolvedValueOnce({ data: { sentRecipientIds: [5] } })
      .mockRejectedValueOnce(new ApiError(504, 'Zeitüberschreitung'));
    const { fenster } = await oeffnen({ senden });
    await geladen(fenster);
    fireEvent.click(sendeKnopf(fenster, /^An 2 Personen senden$/));
    const kopf = await screen.findByText('1 von 2 verschickt.');
    expect(kopf.parentElement?.textContent).toContain(
      'Bei Carla Test ist unklar, ob die Mail rausging',
    );
    const dialog = screen.getByRole('dialog', { name: 'Erinnern – nur zum Teil' });
    expect(
      within(dialog).getByRole('heading', { name: 'Verschickt' }).nextElementSibling?.textContent,
    ).toBe('Anna Test');
    expect(haken(dialog, 'Carla Test').checked).toBe(false);
    expect(
      within(dialog).getByText(/ist unklar, ob die Mail rausging – nicht vorgewählt/),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole<HTMLButtonElement>('button', { name: 'An die 0 übrigen senden' })
        .disabled,
    ).toBe(true);
    // Nichts wurde wiederholt.
    expect(senden).toHaveBeenCalledTimes(2);
    // Später schließt, ohne etwas zu senden.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Später' }));
    expect(senden).toHaveBeenCalledTimes(2);
  });

  it('Abbruch mitten drin: „An die übrigen senden“ schickt NUR die, die noch keine Mail bekamen – Anna nicht noch einmal', async () => {
    const senden = vi
      .fn<MailSender>()
      // Erster Lauf: Anna ok, Carla (zweite) 503 → unklar. Es bleibt niemand unversucht – darum drei Empfänger:
      .mockResolvedValueOnce({ data: { sentRecipientIds: [5] } })
      .mockRejectedValueOnce(new ApiError(503, 'x'));
    const { fenster } = await oeffnen({
      senden,
      antworten: () => Promise.resolve({ ...ANTWORTEN(), jePerson: new Map() }),
    });
    await geladen(fenster);
    // Ohne Antworten fehlt allen Musik-Mitgliedern etwas: Anna, Ben, Carla.
    expect(zeilen(fenster)).toHaveLength(3);
    fireEvent.click(sendeKnopf(fenster, /^An 3 Personen senden$/));
    await screen.findByText('1 von 3 verschickt.');
    const dialog = screen.getByRole('dialog', { name: 'Erinnern – nur zum Teil' });
    // Ben (zweiter) ist unklar, Carla (dritte) unversucht und vorgewählt.
    expect(haken(dialog, 'Ben Test').checked).toBe(false);
    expect(haken(dialog, 'Carla Test').checked).toBe(true);
    senden.mockResolvedValueOnce({ data: { sentRecipientIds: [11] } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'An die 1 übrige senden' }));
    await screen.findByText('Erinnern – nur zum Teil');
    expect(bodies(senden).map((b) => b.recipients)).toEqual([[5], [8], [11]]);
    // Ben bleibt unklar – das Fenster sagt es weiter, Anna und Carla stehen als verschickt da.
    const heute = screen.getByRole('dialog', { name: 'Erinnern – nur zum Teil' });
    expect(within(heute).getByText('2 von 3 verschickt.')).toBeTruthy();
  });

  it('Der unklaren Person kann man bewusst noch einmal senden (Haken setzen)', async () => {
    const senden = vi
      .fn<MailSender>()
      .mockResolvedValueOnce({ data: { sentRecipientIds: [5] } })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { fenster } = await oeffnen({ senden });
    await geladen(fenster);
    fireEvent.click(sendeKnopf(fenster, /^An 2 Personen senden$/));
    await screen.findByText('1 von 2 verschickt.');
    const dialog = screen.getByRole('dialog', { name: 'Erinnern – nur zum Teil' });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Carla Test erinnern' }));
    senden.mockResolvedValueOnce({ data: { sentRecipientIds: [11] } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'An die 1 übrige senden' }));
    await screen.findByText('2 Mails verschickt.');
    expect(bodies(senden).map((b) => b.recipients)).toEqual([[5], [11], [11]]);
  });

  it('„Eine Kopie an mich“ gilt für das ganze Erinnern: der zweite Lauf („An die übrigen“) fordert keine zweite an', async () => {
    const senden = vi
      .fn<MailSender>()
      .mockResolvedValueOnce({ data: { sentRecipientIds: [5] } })
      .mockRejectedValueOnce(new ApiError(504, 'x'))
      .mockResolvedValueOnce({ data: { sentRecipientIds: [11] } });
    const { fenster } = await oeffnen({
      senden,
      antworten: () => Promise.resolve({ ...ANTWORTEN(), jePerson: new Map() }),
    });
    await geladen(fenster);
    fireEvent.click(within(fenster).getByRole('checkbox', { name: 'Eine Kopie an mich' }));
    fireEvent.click(sendeKnopf(fenster, /^An 3 Personen senden$/));
    await screen.findByText('1 von 3 verschickt.');
    const dialog = screen.getByRole('dialog', { name: 'Erinnern – nur zum Teil' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'An die 1 übrige senden' }));
    await screen.findByText('2 von 3 verschickt.');
    expect(bodies(senden).map((b) => b.recipients)).toEqual([[5], [8], [11]]);
    expect(bodies(senden).map((b) => b.sendCopyToMe)).toEqual([true, false, false]);
  });

  it('kein Recht (403): angehalten mit dem Satz dazu – und ohne „An die übrigen“ (dieselbe Wand)', async () => {
    const senden = vi.fn<MailSender>().mockRejectedValue(new ApiError(403, 'Forbidden'));
    const { fenster } = await oeffnen({ senden });
    await geladen(fenster);
    fireEvent.click(sendeKnopf(fenster, /^An 2 Personen senden$/));
    await screen.findByText('0 von 2 verschickt.');
    expect(
      screen.getByText(/ChurchTools erlaubt dir nicht, Mails zu Terminen zu schicken\./),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /übrig/ })).toBeNull();
    expect(senden).toHaveBeenCalledTimes(1);
  });

  it('während des Sendens schließt Esc nicht; im Fenster davor schon', async () => {
    let fertig: (v: unknown) => void = () => {};
    const senden = vi.fn<MailSender>(() => new Promise((f) => (fertig = f)));
    const { fenster } = await oeffnen({ senden });
    await geladen(fenster);
    fireEvent.click(sendeKnopf(fenster, /^An 2 Personen senden$/));
    await screen.findByText('Wird gesendet … 0 von 2');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: /Wird gesendet/ })).toBeTruthy();
    fertig({ data: { sentRecipientIds: [5] } });
    await waitFor(() => expect(senden).toHaveBeenCalledTimes(2));
    fertig({ data: { sentRecipientIds: [11] } });
    await screen.findByText('2 Mails verschickt.');
  });

  it('Esc vor dem Senden schließt das Fenster', async () => {
    const { fenster, senden } = await oeffnen();
    await geladen(fenster);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(senden).not.toHaveBeenCalled();
  });
});
