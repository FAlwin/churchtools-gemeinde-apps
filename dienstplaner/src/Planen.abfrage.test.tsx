// @vitest-environment jsdom
import { mehrEintrag, mehrEintragOder } from './mehrMenue.testutil';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { diensteAus } from '@shared/ct/dienste';
import { tagKurz } from '@shared/ct/datum';
import type { SpeicherErgebnis } from '@shared/ct/versionierterWert';
import {
  erinnerungsTage,
  geltenderPlan,
  STANDARD_PLAN,
  type Abfrage,
  type AbfragenInhalt,
} from '@shared/dienstplan/abfragen';
import { standardInhalt, type AbfragenStand } from '@shared/dienstplan/abfragenSpeicher';
import { neueAbfrage, type AbfrageFormular } from '@shared/dienstplan/abfrageFenster';
import { termineFuerAbfrage } from '@shared/dienstplan/erinnern';
import { planAus, type Plan } from '@shared/dienstplan/plan';
import type { RohTermin } from '@shared/dienstplan/termine';
import { abwesenheitenAus, type GruppenStand } from '@shared/dienstplan/personenDaten';
import type { PersonenAntworten } from '@shared/dienstplan/personenAntworten';
import { antwortBereinigt, type Antworten } from '@shared/dienstplan/verfuegbarkeit';
import { leereListe, pauseSetzen, type Personenliste } from '@shared/dienstplan/personenliste';
import { liste } from '@shared/dienstplan/personenliste.testutil';
import type { AbfrageAnschluss } from './AbfrageFenster';
import type { AutomatikAnschluss } from './abfrageAutomatikLauf';
import { EINR, hilfsgruppe, R_LEITER, R_TEILNEHMER } from './abfrageAutomatik.testutil';
import { ABFRAGE_UNLESBAR } from './abfragenTexte';
import type { AntwortenLader } from './ladeAntworten';
import type { PersonenLader } from './ladePersonen';
import type { TermineDaten } from './ladeTermine';
import { Planen } from './Planen';
import { ganzSichtbar, planbar } from './start';
import { startFuer } from './start.testutil';
import { daten as entwuerfeDaten, nachgebaut } from './entwurfAnschluss.testutil';

/**
 * R-2 „Abfrage …“ im ⋯-Menü von Planen: Menüeintrag, Formular, Zeitleiste (aus `erinnerungsTage`), Starten (schreibt die
 * Abfrage mit den Terminen aus `termineFuerAbfrage`), Stand (offen · fertig · pausiert), Beenden mit Rückfrage und die
 * Hausregeln des Speichers (Lesefehler, unlesbar, Konflikt: nichts wird geschrieben bzw. überschrieben). Gespeichert wird
 * nichts wirklich – `speichern` ist ein Spion. Rechenregeln: `shared/dienstplan/abfrageFenster.test.ts`.
 *
 * Plan (heute = Mi 14.10.2026): Termin 20 (So 18.10.) Ton mit David + freier Gesang-Platz; 21 (Mi 21.10.) freier Gesang-Platz;
 * 22 (Fr 23.10.) nur ein Ton-Platz – Musik hat dort keine Dienste; 23 (Sa 24.10.) Gesang, aber abgesagt; 24 (So 01.11.)
 * Gesang. Musik (Dienstgruppe 4, CT-Gruppe 9): Anna, Ben, Carla. Antworten: Ben Ja an 20 und 21, Anna Ja am 21., Carla
 * am 18.10. abwesend (Ben hat auch für den 01.11. geantwortet) – Musik fehlt (Termine 20, 21): Anna (20.), Carla (21.).
 */
const START = startFuer({
  dienste: diensteAus([
    { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7], sortKey: 1 },
    { id: 9, name: 'Gesang', serviceGroupId: 4, groupIds: [9], sortKey: 2 },
  ]),
});
const frei = (serviceId: number) => ({ serviceId, personId: null, name: null, index: null });
const roh = (id: number, name: string, tag: string, services: object[], abgesagt = false) =>
  ({
    id,
    name,
    startDate: `${tag}T08:00:00Z`,
    endDate: `${tag}T09:30:00Z`,
    ...(abgesagt ? { isCanceled: true } : {}),
    eventServices: services,
  }) as RohTermin;
const ROH: RohTermin[] = [
  roh(20, 'Gottesdienst', '2026-10-18', [
    { serviceId: 6, personId: 14, name: 'David Test', isAccepted: true, index: null },
    frei(9),
  ]),
  roh(21, 'Gebetsabend', '2026-10-21', [frei(9)]),
  roh(22, 'Jugend', '2026-10-23', [frei(6)]),
  roh(23, 'Probe', '2026-10-24', [frei(9)], true),
  roh(24, 'Gottesdienst', '2026-11-01', [frei(9)]),
];
const planVon = (r: RohTermin[]): Plan =>
  planAus(r, {
    ichId: START.ichId,
    dienste: START.dienste,
    dienstgruppen: START.dienstgruppen,
    zeitzone: 'Europe/Berlin',
    planbar: (d) => planbar(START, d),
    ganzSichtbar: (d) => ganzSichtbar(START, d),
  });
const PLAN = planVon(ROH);

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
const ANTWORTEN = (): PersonenAntworten => ({
  jePerson: new Map<number, Antworten>([
    [
      8,
      {
        ...antw([
          { a: 'ja', tag: '2026-10-18' },
          { a: 'ja', tag: '2026-10-21' },
        ]),
        '24': antwortBereinigt({ a: 'ja', tag: '2026-11-01' }),
      },
    ],
    [5, { '21': antwortBereinigt({ a: 'ja', tag: '2026-10-21' }) }],
  ]),
  sichtbar: new Set([4, 3]),
});

const HEUTE = '2026-10-14';
const ICH = { personId: 1, name: 'Alwin Friesen' };
const ZEIT = '2026-10-12T12:00:00.000Z';
/** Eine laufende Abfrage von Musik: Zeitraum 18.10.–01.11., Frist 15.10. (blau). */
const LAUFEND: Abfrage = {
  id: 'a1',
  von: '2026-10-18',
  bis: '2026-11-01',
  frist: '2026-10-15',
  oeffnen: '2026-10-10',
  termine: [20, 21, 24],
  gestartet: { personId: 2, name: 'Jonas Test', zeit: ZEIT },
  beendet: null,
};
/** Ein eigener Erinnerungsplan – NICHT der Standard, damit ein fest verdrahteter Standard auffällt. */
const EIGENER_PLAN = {
  punkte: [
    { art: 'oeffnen' as const },
    { art: 'vorFrist' as const, tage: 3 },
    { art: 'nachFrist' as const, alleTage: 2, hoechstens: 2 },
  ],
  mail: null,
};

const stand = (inhalt: AbfragenInhalt | null, version = 3): AbfragenStand =>
  inhalt
    ? {
        inhalt,
        gespeichert: { version, zeit: ZEIT, von: { personId: 2, name: 'Jonas Test' }, inhalt },
        unlesbar: false,
        fehler: null,
      }
    : { inhalt: standardInhalt(), gespeichert: null, unlesbar: false, fehler: null };

const speichernOk = (): AbfrageAnschluss['speichern'] =>
  vi.fn((_g, neu, von, erwartet) =>
    Promise.resolve({
      ok: true,
      daten: { version: (erwartet ?? 0) + 1, zeit: ZEIT, von, inhalt: neu },
    } satisfies SpeicherErgebnis<AbfragenInhalt>),
  );

interface Aufbau {
  lesen?: AbfrageAnschluss['lesen'];
  speichern?: AbfrageAnschluss['speichern'];
  ladeZeitraum?: (von: string, bis: string) => Promise<TermineDaten>;
  abfragen?: boolean;
  personenlisten?: [number, Personenliste][];
  /** Die Automatik in ChurchTools (R-5b) – ohne sie startet und endet alles wie vor R-5b. */
  automatik?: AutomatikAnschluss;
  jetzt?: string;
  ladePersonen?: PersonenLader;
}
function zeige(o: Aufbau = {}) {
  const lesen = o.lesen ?? vi.fn(() => Promise.resolve(stand(null)));
  const speichern = o.speichern ?? speichernOk();
  const ladeZeitraum = o.ladeZeitraum ?? vi.fn(() => new Promise<never>(() => {}));
  localStorage.setItem('dienstplaner.planen.ansicht', JSON.stringify({ unteransicht: 'matrix' }));
  const r = render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
      handy={false}
      onNochmal={() => {}}
      onMehr={() => {}}
      mehrMoeglich={false}
      ladeZeitraum={ladeZeitraum}
      heute={HEUTE}
      ladePersonen={
        o.ladePersonen ?? ((() => Promise.resolve(personenStand())) satisfies PersonenLader)
      }
      ladeAntworten={(() => Promise.resolve(ANTWORTEN())) satisfies AntwortenLader}
      erinnern={{
        senden: () => Promise.resolve({}),
        link: () => 'https://ct.test/ccm/dienstplaner/',
      }}
      abfragen={
        o.abfragen === false
          ? undefined
          : {
              lesen,
              speichern,
              ich: ICH,
              neueId: () => 'neu-1',
              jetzt: () => o.jetzt ?? ZEIT,
              ...(o.automatik
                ? {
                    automatik: o.automatik,
                    link: (id: number) => `https://ct.test/abwesenheiten?abfrage=${id}`,
                  }
                : {}),
            }
      }
      {...(o.personenlisten
        ? {
            entwuerfe: nachgebaut({
              laden: () => Promise.resolve(entwuerfeDaten([], {}, o.personenlisten)),
            }),
          }
        : {})}
    />,
  );
  return { lesen, speichern, ladeZeitraum, ...r };
}
/** Öffnet das Fenster und wählt die Dienstgruppe Musik; `name`: der Titel, der danach erwartet wird. */
async function oeffnen(o: Aufbau = {}, name: string | RegExp = 'Abfrage starten') {
  const z = zeige(o);
  mehrEintrag('Abfrage …');
  const erstes = await screen.findByRole('dialog', { name: /^Abfrage/ });
  await waehle(erstes, 'Musik');
  return { ...z, fenster: await screen.findByRole('dialog', { name }) };
}
/** Nur Musik (4) hat diesen Inhalt, jede andere Dienstgruppe keine Abfrage. */
const nurMusik = (inhalt: AbfragenInhalt, version = 3): AbfrageAnschluss['lesen'] =>
  vi.fn((id: number) => Promise.resolve(stand(id === 4 ? inhalt : null, version)));
async function waehle(f: HTMLElement, gruppe: string) {
  fireEvent.change(within(f).getByLabelText('Dienstgruppe'), {
    target: { value: gruppe === 'Musik' ? '4' : '3' },
  });
}
const feld = (f: HTMLElement, name: string | RegExp) =>
  within(f).getByLabelText<HTMLInputElement>(name);
const setze = (f: HTMLElement, name: string | RegExp, wert: string) =>
  fireEvent.change(feld(f, name), { target: { value: wert } });
const knopf = (f: HTMLElement, name: string | RegExp) => within(f).getByRole('button', { name });
const zeitzeilen = (f: HTMLElement) =>
  within(within(f).getByRole('region', { name: 'Was passiert wann' })).getAllByRole('listitem');
const gespeichert = (s: AbfrageAnschluss['speichern']) =>
  (s as ReturnType<typeof vi.fn>).mock.calls as [
    number,
    AbfragenInhalt,
    typeof ICH,
    number | null,
  ][];

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Der Menüeintrag „Abfrage …“', () => {
  it('steht im ⋯-Menü neben „Erinnern“ – und öffnet das Fenster', async () => {
    zeige();
    expect(mehrEintragOder('Abfrage …')).not.toBeNull();
    expect(mehrEintragOder('Erinnern')).not.toBeNull();
    mehrEintrag('Abfrage …');
    expect(await screen.findByRole('dialog', { name: 'Abfrage starten' })).toBeTruthy();
  });

  it('fehlt ohne Anschluss „abfragen“', () => {
    zeige({ abfragen: false });
    expect(mehrEintragOder('Abfrage …')).toBeNull();
    expect(mehrEintragOder('Erinnern')).not.toBeNull();
  });
});

describe('Formular und Starten', () => {
  it('Zeitraum und Frist sind aus dem gezeigten Zeitraum vorbelegt; es gibt nur die planbaren Dienstgruppen', async () => {
    const { fenster } = await oeffnen();
    expect(feld(fenster, 'Zeitraum von').value).toBe('2026-10-18');
    expect(feld(fenster, 'bis').value).toBe('2026-11-01');
    // vier Wochen vor dem Beginn läge vor heute – dann heute
    expect(feld(fenster, /^Frist/).value).toBe(HEUTE);
    const gruppen = within(within(fenster).getByLabelText('Dienstgruppe')).getAllByRole('option');
    expect(gruppen.map((o) => o.textContent).sort()).toEqual(['Musik', 'Technik']);
  });

  it('„Abfrage starten“ schreibt die Abfrage: Termine aus termineFuerAbfrage, Tage, ich, Version wie gelesen', async () => {
    const gelesen = stand(
      { plan: EIGENER_PLAN, abfragen: [], einrichtung: null, verfuegbarkeit: 'zusagen' as const },
      3,
    );
    const { fenster, speichern } = await oeffnen({ lesen: () => Promise.resolve(gelesen) });
    await waitFor(() =>
      expect(knopf(fenster, 'Abfrage starten')).toHaveProperty('disabled', false),
    );
    fireEvent.click(knopf(fenster, 'Abfrage starten'));
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    const [gruppe, inhalt, von, erwartet] = gespeichert(speichern)[0];
    expect(gruppe).toBe(4);
    expect(von).toEqual(ICH);
    expect(erwartet).toBe(3);
    // Der eigene Plan bleibt erhalten.
    expect(inhalt.plan).toEqual(EIGENER_PLAN);
    const erwartetTermine = termineFuerAbfrage(
      PLAN,
      PLAN.gruppen.find((g) => g.gruppe?.id === 4)!,
      '2026-10-18',
      '2026-11-01',
      HEUTE,
    );
    // Die Auswahl selbst: 20, 21, 24 – nicht 22 (Musik hat dort keine Dienste) und nicht 23 (abgesagt).
    expect(erwartetTermine).toEqual([20, 21, 24]);
    expect(inhalt.abfragen).toHaveLength(1);
    expect(inhalt.abfragen[0]).toEqual({
      id: 'neu-1',
      von: '2026-10-18',
      bis: '2026-11-01',
      frist: HEUTE,
      oeffnen: HEUTE,
      termine: erwartetTermine,
      gestartet: { personId: ICH.personId, name: ICH.name, zeit: ZEIT },
      beendet: null,
    });
    // Danach zeigt das Fenster den Stand dieser Abfrage.
    expect(await screen.findByRole('dialog', { name: /^Abfrage Musik · 18\.10\./ })).toBeTruthy();
  });

  it('ein Zeitraum außerhalb des geladenen Plans wird nachgeladen – die Termine kommen aus dem geladenen Plan', async () => {
    const mehr = planVon([roh(19, 'Gebet', '2026-10-16', [frei(9)]), ...ROH]);
    const ladeZeitraum = vi.fn((_von: string, _bis: string) =>
      Promise.resolve({ zeilen: [], plan: mehr } satisfies TermineDaten),
    );
    const { fenster, speichern } = await oeffnen({ ladeZeitraum });
    // Im gezeigten Zeitraum: kein Nachladen.
    expect(ladeZeitraum).not.toHaveBeenCalled();
    setze(fenster, 'Zeitraum von', '2026-10-15');
    await waitFor(() => expect(ladeZeitraum).toHaveBeenCalledWith('2026-10-15', '2026-11-01'));
    await waitFor(() =>
      expect(knopf(fenster, 'Abfrage starten')).toHaveProperty('disabled', false),
    );
    fireEvent.click(knopf(fenster, 'Abfrage starten'));
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    const termine = gespeichert(speichern)[0][1].abfragen[0].termine;
    expect(termine).toEqual(
      termineFuerAbfrage(
        mehr,
        mehr.gruppen.find((g) => g.gruppe?.id === 4)!,
        '2026-10-15',
        '2026-11-01',
        HEUTE,
      ),
    );
    expect(termine).toContain(19);
  });

  it('eine Frist nicht vor dem Beginn sperrt das Starten und sagt warum – es wird nichts geschrieben', async () => {
    const { fenster, speichern } = await oeffnen();
    setze(fenster, /^Frist/, '2026-10-18');
    expect(within(fenster).getByText(/Die Frist muss vor dem Beginn/)).toBeTruthy();
    expect(knopf(fenster, 'Abfrage starten')).toHaveProperty('disabled', true);
    fireEvent.click(knopf(fenster, 'Abfrage starten'));
    expect(speichern).not.toHaveBeenCalled();
  });

  it('ohne Termine der Dienstgruppe im Zeitraum lässt sich nicht starten', async () => {
    const { fenster, speichern } = await oeffnen();
    // Der 23.10. hat nur einen Ton-Platz.
    setze(fenster, 'Zeitraum von', '2026-10-22');
    setze(fenster, 'bis', '2026-10-23');
    expect(
      await within(fenster).findByText(/keine Termine, an denen Musik Dienste hat/),
    ).toBeTruthy();
    expect(knopf(fenster, 'Abfrage starten')).toHaveProperty('disabled', true);
    expect(speichern).not.toHaveBeenCalled();
  });
});

describe('Was passiert wann', () => {
  const formular = (f: HTMLElement): AbfrageFormular => ({
    von: feld(f, 'Zeitraum von').value,
    bis: feld(f, 'bis').value,
    frist: feld(f, /^Frist/).value,
    oeffnen: 'sofort',
    oeffnenTag: '',
  });

  it('die Tage kommen aus erinnerungsTage mit dem EIGENEN Plan der Dienstgruppe', async () => {
    const inhalt: AbfragenInhalt = {
      plan: EIGENER_PLAN,
      abfragen: [],
      einrichtung: null,
      verfuegbarkeit: 'zusagen' as const,
    };
    const { fenster } = await oeffnen({ lesen: nurMusik(inhalt) });
    setze(fenster, 'Zeitraum von', '2026-10-30');
    setze(fenster, /^Frist/, '2026-10-25');
    await waitFor(() => zeitzeilen(fenster));
    const f = formular(fenster);
    const abfrage = neueAbfrage({
      id: 'x',
      formular: f,
      heute: HEUTE,
      termine: [20, 21, 24],
      ich: ICH,
      zeit: ZEIT,
    });
    const tage = erinnerungsTage(geltenderPlan(inhalt), abfrage, HEUTE);
    // Der eigene Plan: Öffnen (heute), 3 Tage vor der Frist, zwei Erinnerungen nach der Frist im Abstand von 2 Tagen.
    expect(tage.length).toBe(4);
    const texte = zeitzeilen(fenster).map((li) => li.textContent ?? '');
    for (const tag of tage.filter((t) => t !== HEUTE))
      expect(texte.some((t) => t.startsWith(tagKurz(tag)))).toBe(true);
    // Ein Tag, den nur der STANDARD-Plan hat (2 Tage vor der Frist), steht nicht da.
    const nurStandard = erinnerungsTage(STANDARD_PLAN, abfrage, HEUTE).filter(
      (t) => !tage.includes(t) && t !== f.frist,
    );
    expect(nurStandard.length).toBeGreaterThan(0);
    for (const tag of nurStandard)
      expect(texte.some((t) => t.startsWith(tagKurz(tag)))).toBe(false);
    // Die letzte Zeile ist das Ende des Zeitraums.
    expect(texte[texte.length - 1]).toContain('Zeitraum beginnt: Abfrage endet');
  });

  it('heute: Zahlen aus fehlendeInGruppe – wer erscheint, wer fehlt, wer pausiert, wer fertig ist', async () => {
    // Clara pausiert (Musik) bis nach dem 21.10. – ihr einziger offener Termin (21.) entfällt: pausiert statt offen.
    const pause = liste(pauseSetzen(leereListe(), CARLA.id, { bis: '2026-12-31' }));
    const { fenster } = await oeffnen({ personenlisten: [[4, pause]] });
    setze(fenster, 'Zeitraum von', '2026-10-18');
    setze(fenster, 'bis', '2026-10-21');
    const heute = await waitFor(() => {
      const z = zeitzeilen(fenster).find((li) => li.textContent?.includes('Erscheint bei'));
      expect(z).toBeDefined();
      expect(z!.textContent).not.toContain('geladen');
      return z!.textContent;
    });
    // Musik: Anna, Ben, Carla. Anna fehlt am 18., Carla pausiert, Ben hat alles beantwortet.
    expect(heute).toContain('Erscheint bei 3 Personen.');
    expect(heute).toContain('1 Person fehlt noch Antworten');
    expect(heute).toContain('1 pausiert – keine Mail');
    expect(heute).toContain('1 schon fertig');
  });

  it('der Hinweis kommt aus der Einrichtung im Dokument – eingerichtet sagt, wer erinnert und wann', async () => {
    const a = await oeffnen();
    await waitFor(() => zeitzeilen(a.fenster));
    expect(
      within(a.fenster).getByText(
        'Automatische Erinnerungen sind für Musik noch nicht eingerichtet – bis dahin per „Erinnern“.',
      ),
    ).toBeTruthy();
    cleanup();
    const eingerichtet: AbfragenInhalt = {
      ...standardInhalt(),
      einrichtung: { gruppeId: 7, routineId: 8 },
    };
    const b = await oeffnen({ lesen: nurMusik(eingerichtet) });
    await waitFor(() => zeitzeilen(b.fenster));
    expect(within(b.fenster).queryByText(/noch nicht eingerichtet/)).toBeNull();
    expect(
      within(b.fenster).getByText(
        'Erinnerungen verschickt ChurchTools gegen 0:15 Uhr an alle, die dann noch offen sind.',
      ),
    ).toBeTruthy();
  });
});

describe('Der Stand einer laufenden Abfrage', () => {
  const laufend = (x: Partial<Abfrage> = {}): AbfragenInhalt => ({
    plan: EIGENER_PLAN,
    abfragen: [{ ...LAUFEND, ...x }],
    einrichtung: null,
    verfuegbarkeit: 'zusagen' as const,
  });

  it('zeigt Etikett, „gestartet am … von …“ und die drei Abschnitte', async () => {
    const pause = liste(pauseSetzen(leereListe(), CARLA.id, { bis: '2026-12-31' }));
    const { fenster } = await oeffnen(
      { lesen: nurMusik(laufend()), personenlisten: [[4, pause]] },
      /^Abfrage Musik/,
    );
    expect(
      await screen.findByRole('dialog', { name: 'Abfrage Musik · 18.10.–01.11.' }),
    ).toBeTruthy();
    // blau bis zur Frist
    expect(within(fenster).getByText(`bis ${tagKurz('2026-10-15')}`)).toBeTruthy();
    expect(within(fenster).getByText('gestartet am 12.10. von Jonas Test')).toBeTruthy();
    // Anna fehlt an 20 und 24 (21. hat sie beantwortet); Ben ist fertig; Carla pausiert.
    expect(await within(fenster).findByText('Noch offen · 1')).toBeTruthy();
    const offen = within(fenster).getByRole('list', { name: 'Noch offen' });
    expect(offen.textContent).toContain('Anna Test');
    expect(offen.textContent).toContain('2 von 3 offen');
    expect(within(fenster).getByText('Fertig · 1')).toBeTruthy();
    expect(within(fenster).getByText('Ben Test')).toBeTruthy();
    expect(within(fenster).getByText('Pausiert – keine Erinnerung · 1')).toBeTruthy();
    expect(within(fenster).getByText('Carla Test (Pause bis 31.12.)')).toBeTruthy();
    // Das Formular gibt es hier nicht.
    expect(within(fenster).queryByRole('button', { name: 'Abfrage starten' })).toBeNull();
  });

  it('nach der Frist ist das Etikett rot', async () => {
    const { fenster } = await oeffnen(
      { lesen: nurMusik(laufend({ frist: '2026-10-13' })) },
      /^Abfrage Musik/,
    );
    const etikett = within(fenster).getByText(`Frist war ${tagKurz('2026-10-13')}`);
    expect(etikett.className).toMatch(/rot/);
    cleanup();
    const blau = await oeffnen({ lesen: nurMusik(laufend()) }, /^Abfrage Musik/);
    expect(within(blau.fenster).getByText(`bis ${tagKurz('2026-10-15')}`).className).toMatch(
      /blau/,
    );
  });

  it('auch eine Abfrage, die erst öffnet (geplant), zeigt den Stand statt des Formulars', async () => {
    const { fenster } = await oeffnen(
      {
        lesen: nurMusik(laufend({ oeffnen: '2026-10-15' })),
      },
      /^Abfrage Musik/,
    );
    expect(within(fenster).getByText(`öffnet ${tagKurz('2026-10-15')}`)).toBeTruthy();
    expect(within(fenster).queryByRole('button', { name: 'Abfrage starten' })).toBeNull();
  });

  it('die Zeitleiste kommt aus erinnerungsTage ab dem Öffnen; vergangene Tage stehen grau und ohne „verschickt“', async () => {
    const inhalt = laufend();
    const { fenster } = await oeffnen({ lesen: nurMusik(inhalt) }, /^Abfrage Musik/);
    const tage = erinnerungsTage(EIGENER_PLAN, inhalt.abfragen[0], inhalt.abfragen[0].oeffnen);
    // Öffnen (10.10.) liegt vor heute, ein Tag danach (12.10.: 3 Tage vor der Frist) auch.
    expect(tage.some((t) => t < HEUTE)).toBe(true);
    const zeilen = zeitzeilen(fenster);
    const vorbei = zeilen.filter((li) => /vorbei/.test(li.className));
    expect(vorbei.length).toBe(tage.filter((t) => t < HEUTE).length);
    for (const li of zeilen) expect(li.textContent).not.toMatch(/verschickt|✓/);
    expect(zeilen.some((li) => li.textContent?.startsWith(tagKurz('2026-10-10')))).toBe(true);
  });

  it('„Abfrage beenden“ fragt zurück – erst die Bestätigung schreibt, mit dem Tag von heute; der Plan bleibt', async () => {
    const { fenster, speichern } = await oeffnen({ lesen: nurMusik(laufend()) }, /^Abfrage Musik/);
    fireEvent.click(knopf(fenster, 'Abfrage beenden'));
    const frage = await screen.findByRole('alertdialog', { name: 'Abfrage beenden?' });
    expect(speichern).not.toHaveBeenCalled();
    // Abbrechen: nichts passiert.
    fireEvent.click(within(frage).getByRole('button', { name: 'Abbrechen' }));
    expect(speichern).not.toHaveBeenCalled();
    fireEvent.click(knopf(fenster, 'Abfrage beenden'));
    fireEvent.click(
      within(await screen.findByRole('alertdialog', { name: 'Abfrage beenden?' })).getByRole(
        'button',
        {
          name: 'Abfrage beenden',
        },
      ),
    );
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    const [gruppe, inhalt, , erwartet] = gespeichert(speichern)[0];
    expect(gruppe).toBe(4);
    expect(erwartet).toBe(3);
    expect(inhalt.plan).toEqual(EIGENER_PLAN);
    expect(inhalt.abfragen).toEqual([{ ...LAUFEND, beendet: HEUTE }]);
    // Danach steht wieder das Formular da.
    expect(await screen.findByRole('dialog', { name: 'Abfrage starten' })).toBeTruthy();
  });
});

describe('Hausregeln des Speichers', () => {
  it('unlesbar: Hinweis, kein Starten – und nie geschrieben', async () => {
    const lesen = vi.fn(() =>
      Promise.resolve<AbfragenStand>({
        ...stand(null),
        unlesbar: true,
        gespeichert: { version: 9, zeit: ZEIT, von: ICH, inhalt: standardInhalt() },
      }),
    );
    const { fenster, speichern } = await oeffnen({ lesen });
    expect(await within(fenster).findByText(ABFRAGE_UNLESBAR)).toBeTruthy();
    expect(within(fenster).queryByRole('button', { name: 'Abfrage starten' })).toBeNull();
    expect(within(fenster).queryByLabelText('Zeitraum von')).toBeNull();
    // „Nochmal versuchen“ liest neu (und schreibt nichts).
    fireEvent.click(knopf(fenster, 'Nochmal versuchen'));
    await waitFor(() => expect(lesen.mock.calls.length).toBeGreaterThan(1));
    expect(speichern).not.toHaveBeenCalled();
  });

  it('Lesefehler: Meldung und „Nochmal versuchen“, kein Starten – und nichts geschrieben', async () => {
    const lesen = vi.fn(() =>
      Promise.resolve<AbfragenStand>({ ...stand(null), fehler: 'voruebergehend' }),
    );
    const { fenster, speichern } = await oeffnen({ lesen });
    expect(
      await within(fenster).findByText(
        'ChurchTools antwortet gerade nicht – die Abfrage konnte nicht gelesen werden.',
      ),
    ).toBeTruthy();
    expect(within(fenster).queryByRole('button', { name: 'Abfrage starten' })).toBeNull();
    fireEvent.click(knopf(fenster, 'Nochmal versuchen'));
    await waitFor(() => expect(lesen.mock.calls.length).toBeGreaterThan(1));
    expect(speichern).not.toHaveBeenCalled();
  });

  it('Konflikt: nichts überschrieben, einmal versucht, der neue Stand erscheint', async () => {
    // Jonas hat inzwischen eine Abfrage gestartet.
    const jetzt = {
      version: 4,
      zeit: ZEIT,
      von: { personId: 2, name: 'Jonas Test' },
      inhalt: {
        plan: null,
        abfragen: [LAUFEND],
        einrichtung: null,
        verfuegbarkeit: 'zusagen' as const,
      },
    };
    const speichern = vi.fn(() =>
      Promise.resolve({
        ok: false,
        grund: 'konflikt',
        jetzt,
      } satisfies SpeicherErgebnis<AbfragenInhalt>),
    ) as unknown as AbfrageAnschluss['speichern'];
    const { fenster } = await oeffnen({ speichern });
    await waitFor(() =>
      expect(knopf(fenster, 'Abfrage starten')).toHaveProperty('disabled', false),
    );
    fireEvent.click(knopf(fenster, 'Abfrage starten'));
    expect(
      await screen.findByText(
        'Jonas Test hat das inzwischen geändert – nichts überschrieben. Hier steht jetzt der neue Stand.',
      ),
    ).toBeTruthy();
    // Es springt auf den Stand der fremden Abfrage; es wurde nicht noch einmal versucht.
    expect(await screen.findByRole('dialog', { name: /^Abfrage Musik · 18\.10\./ })).toBeTruthy();
    expect(speichern).toHaveBeenCalledTimes(1);
  });

  it('Speichern scheitert vorübergehend: Meldung, die Eingabe bleibt, kein zweiter Versuch von selbst', async () => {
    const speichern = vi.fn(() =>
      Promise.resolve({
        ok: false,
        grund: 'voruebergehend',
      } satisfies SpeicherErgebnis<AbfragenInhalt>),
    ) as unknown as AbfrageAnschluss['speichern'];
    const { fenster } = await oeffnen({ speichern });
    await waitFor(() =>
      expect(knopf(fenster, 'Abfrage starten')).toHaveProperty('disabled', false),
    );
    setze(fenster, 'bis', '2026-10-30');
    fireEvent.click(knopf(fenster, 'Abfrage starten'));
    expect(await within(fenster).findByText(/nicht gespeichert/)).toBeTruthy();
    expect(feld(fenster, 'bis').value).toBe('2026-10-30');
    expect(speichern).toHaveBeenCalledTimes(1);
  });

  it('beim Starten bleiben ältere Abfragen erhalten, laufende werden nicht ersetzt (eine je Dienstgruppe)', async () => {
    const beendet: Abfrage = {
      ...LAUFEND,
      id: 'alt',
      beendet: '2026-09-01',
      von: '2026-09-10',
      bis: '2026-09-30',
      frist: '2026-09-05',
      oeffnen: '2026-09-01',
    };
    const gelesen = stand(
      {
        plan: EIGENER_PLAN,
        abfragen: [beendet],
        einrichtung: null,
        verfuegbarkeit: 'zusagen' as const,
      },
      5,
    );
    const { fenster, speichern } = await oeffnen({ lesen: () => Promise.resolve(gelesen) });
    await waitFor(() =>
      expect(knopf(fenster, 'Abfrage starten')).toHaveProperty('disabled', false),
    );
    fireEvent.click(knopf(fenster, 'Abfrage starten'));
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    const inhalt = gespeichert(speichern)[0][1];
    expect(inhalt.abfragen.map((a) => a.id)).toEqual(['alt', 'neu-1']);
    expect(gespeichert(speichern)[0][3]).toBe(5);
  });
});

describe('Vorwahl der Dienstgruppe (R-5c)', () => {
  const LAUF: AbfragenInhalt = {
    plan: EIGENER_PLAN,
    abfragen: [LAUFEND],
    einrichtung: null,
    verfuegbarkeit: 'zusagen' as const,
  };
  const nurGruppe = (laufendeId: number): AbfrageAnschluss['lesen'] =>
    vi.fn((id: number) => Promise.resolve(stand(id === laufendeId ? LAUF : null)));
  async function oeffneOhneWahl(lesen: AbfrageAnschluss['lesen']) {
    zeige({ lesen });
    mehrEintrag('Abfrage …');
    const f = await screen.findByRole('dialog', { name: /^Abfrage/ });
    return within(f).getByLabelText<HTMLSelectElement>('Dienstgruppe');
  }

  it('hat nur EINE andere als die erste Dienstgruppe eine laufende Abfrage, ist genau sie vorgewählt – und das Fenster zeigt deren Stand', async () => {
    const erste = await oeffneOhneWahl(nurGruppe(0));
    const alle = [...erste.options].map((o) => o.value);
    // Die Gegenprobe trägt nur, wenn die Gruppe mit der Abfrage NICHT die erste im Fenster ist.
    const andere = alle.find((v) => v !== alle[0])!;
    cleanup();
    const wahl = await oeffneOhneWahl(nurGruppe(Number(andere)));
    await waitFor(() => expect(wahl.value).toBe(andere));
    expect(await screen.findByRole('dialog', { name: /^Abfrage/ })).toBeTruthy();
  });

  it('keine laufende Abfrage: wie bisher die erste Dienstgruppe', async () => {
    const wahl = await oeffneOhneWahl(nurGruppe(0));
    const ersteWert = wahl.options[0].value;
    await new Promise((r) => setTimeout(r, 40));
    expect(wahl.value).toBe(ersteWert);
  });

  it('wer selbst eine Dienstgruppe wählt, wird nicht mehr umgestellt', async () => {
    let frei: () => void = () => {};
    const sperre = new Promise<void>((r) => (frei = r));
    const wahl0 = await oeffneOhneWahl(nurGruppe(0));
    const alle = [...wahl0.options].map((o) => o.value);
    cleanup();
    const lesen: AbfrageAnschluss['lesen'] = vi.fn(async (id: number) => {
      if (id !== Number(alle[0])) {
        await sperre;
        return stand(LAUF);
      }
      return stand(null);
    });
    const wahl = await oeffneOhneWahl(lesen);
    fireEvent.change(wahl, { target: { value: alle[0] } });
    frei();
    await new Promise((r) => setTimeout(r, 60));
    expect(wahl.value).toBe(alle[0]);
  });
});

describe('Automatik in ChurchTools (R-5b)', () => {
  const MIT_EINR: AbfragenInhalt = { ...standardInhalt(), einrichtung: EINR };
  const laufendMitEinr = (x: Partial<Abfrage> = {}): AbfragenInhalt => ({
    plan: EIGENER_PLAN,
    abfragen: [{ ...LAUFEND, ...x }],
    einrichtung: EINR,
    verfuegbarkeit: 'zusagen',
  });
  const tn = (person: number) => ({ person, rolle: R_TEILNEHMER });
  /** Ein Speicher, der seinen Aufruf ins Protokoll der Hilfsgruppe schreibt – so ist die Reihenfolge prüfbar. */
  const speichernMitLog = (log: string[]): AbfrageAnschluss['speichern'] =>
    vi.fn((_g, neu, von, erwartet) => {
      log.push('SPEICHERN');
      return Promise.resolve({
        ok: true,
        daten: { version: (erwartet ?? 0) + 1, zeit: ZEIT, von, inhalt: neu },
      } satisfies SpeicherErgebnis<AbfragenInhalt>);
    });
  /** Wartet, bis die Zahlen da sind (der Start-Knopf ist bei Automatik vorher gesperrt) – und klickt. */
  async function starte(fenster: HTMLElement) {
    await waitFor(() =>
      expect(knopf(fenster, 'Abfrage starten')).toHaveProperty('disabled', false),
    );
    fireEvent.click(knopf(fenster, 'Abfrage starten'));
  }

  it('Reihenfolge: Routine-Schritte (nachgelesen) → Abfrage ins Dokument (Version wie gelesen) → Offene als Teilnehmer eintragen', async () => {
    const { w, a } = hilfsgruppe();
    const speichern = speichernMitLog(w.log);
    const { fenster } = await oeffnen({
      lesen: nurMusik(MIT_EINR, 7),
      speichern,
      automatik: a,
      jetzt: '2026-10-14T08:00:00Z',
    });
    await starte(fenster);
    await waitFor(() => expect(w.log).toHaveLength(4));
    // Anna und Carla fehlen (Ben ist fertig).
    expect(w.log).toEqual([
      'PATCH /routines/60',
      'SPEICHERN',
      'PUT /groups/50/members/5',
      'PUT /groups/50/members/11',
    ]);
    expect(gespeichert(speichern)[0][3]).toBe(7);
    expect(w.mitglieder.map((m) => [m.person, m.rolle])).toEqual([
      [5, R_TEILNEHMER],
      [11, R_TEILNEHMER],
    ]);
    expect(await within(fenster).findByText(/2 Personen bekommen Erinnerungen/)).toBeTruthy();
  });

  it('die Schritte sind die aus erinnerungsTage: heute = Öffnen → Mail ohne Warten; Absender = wer startet; Link mit der Nummer der DIENSTGRUPPE', async () => {
    const { w, a } = hilfsgruppe();
    const { fenster } = await oeffnen({
      lesen: nurMusik(MIT_EINR),
      automatik: a,
      jetzt: '2026-10-14T08:00:00Z',
    });
    await starte(fenster);
    await waitFor(() => expect(w.patches).toHaveLength(1));
    const steps = (
      w.patches[0] as { steps: { actionKey: string; actionData: Record<string, unknown> }[] }
    ).steps;
    expect(steps[0].actionKey).toBe('send-member-email');
    expect(steps[0].actionData).toMatchObject({
      senderId: ICH.personId,
      skipIfEmailAddressMissing: true,
      addSignOutUrl: false,
    });
    expect(String(steps[0].actionData.body)).toContain('abfrage=4');
    expect(String(steps[0].actionData.body)).not.toContain(`abfrage=${EINR.gruppeId}`);
    expect(steps[steps.length - 1].actionKey).toBe('remove-member');
    // Nie ein Warten auf heute oder früher.
    for (const s of steps)
      if (s.actionKey === 'special:wait') expect(String(s.actionData.untilDate) > HEUTE).toBe(true);
  });

  it('Pausierte werden nicht eingetragen (sie sind nicht „offen“)', async () => {
    const pause = liste(pauseSetzen(leereListe(), CARLA.id, { bis: '2026-12-31' }));
    const { w, a } = hilfsgruppe();
    const { fenster } = await oeffnen({
      lesen: nurMusik(MIT_EINR),
      automatik: a,
      personenlisten: [[4, pause]],
      jetzt: '2026-10-14T08:00:00Z',
    });
    await starte(fenster);
    await waitFor(() => expect(w.mitglieder.length).toBeGreaterThan(0));
    await waitFor(() =>
      expect(within(fenster).queryByText(/Eingetragen|bekommen Erinnerungen/)).toBeTruthy(),
    );
    expect(w.mitglieder.map((m) => m.person)).toEqual([5]);
  });

  it('nicht leer → Stopp mit Grund, NICHTS geschrieben (kein PATCH, kein Dokument); „Gruppe leeren“ trägt aus, danach geht der Start', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [tn(5)] });
    const speichern = speichernMitLog(w.log);
    const { fenster } = await oeffnen({ lesen: nurMusik(MIT_EINR), speichern, automatik: a });
    await starte(fenster);
    expect(await within(fenster).findByText(/Reste einer früheren Abfrage/)).toBeTruthy();
    expect(w.log).toEqual([]);
    expect(speichern).not.toHaveBeenCalled();
    fireEvent.click(within(fenster).getByRole('button', { name: 'Gruppe leeren' }));
    await waitFor(() => expect(w.log).toEqual(['DELETE /groups/50/members/5']));
    await within(fenster).findByText(/Die Hilfsgruppe ist leer/);
    fireEvent.click(knopf(fenster, 'Abfrage starten'));
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
  });

  it('Aussetzer beim Lesen der Gruppe: nicht gestartet, nichts geschrieben (nie „ohne Automatik“)', async () => {
    const { w, a } = hilfsgruppe();
    w.stoerung.wirft = { 'GET /groups/50/members': new ApiError(503, 'ct') };
    const speichern = speichernMitLog(w.log);
    const { fenster } = await oeffnen({ lesen: nurMusik(MIT_EINR), speichern, automatik: a });
    await starte(fenster);
    expect(await within(fenster).findByText(/antwortet gerade nicht/)).toBeTruthy();
    expect(speichern).not.toHaveBeenCalled();
    expect(w.log).toEqual([]);
  });

  it('kein Recht an der Hilfsgruppe (403): die Abfrage startet wie bisher – mit ehrlichem Hinweis, ohne Eintragen', async () => {
    const { w, a } = hilfsgruppe();
    w.stoerung.wirft = { 'GET /groups/50/members': new ApiError(403, 'verboten') };
    const speichern = speichernMitLog(w.log);
    const { fenster } = await oeffnen({ lesen: nurMusik(MIT_EINR), speichern, automatik: a });
    await starte(fenster);
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(await within(fenster).findByText(/ohne automatische Erinnerungen/)).toBeTruthy();
    expect(w.log).toEqual(['SPEICHERN']);
  });

  it('Hilfsgruppe in ChurchTools gelöscht (404): die Abfrage startet trotzdem, der Hinweis sagt „neu einrichten“', async () => {
    const { w, a } = hilfsgruppe();
    w.stoerung.wirft = { 'GET /groups/50/members/routines': new ApiError(404, 'weg') };
    const speichern = speichernMitLog(w.log);
    const { fenster } = await oeffnen({ lesen: nurMusik(MIT_EINR), speichern, automatik: a });
    await starte(fenster);
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(await within(fenster).findByText(/ohne automatische Erinnerungen/)).toBeTruthy();
    expect(fenster.textContent).toContain('neu einrichten');
    expect(w.log).toEqual(['SPEICHERN']);
  });

  it('Beenden bei gelöschter Hilfsgruppe (404): wird trotzdem beendet gespeichert', async () => {
    const { w, a } = hilfsgruppe();
    w.stoerung.wirft = { 'GET /groups/50/members/routines': new ApiError(404, 'weg') };
    const speichern = speichernMitLog(w.log);
    const { fenster } = await oeffnen(
      { lesen: nurMusik(laufendMitEinr()), speichern, automatik: a },
      /^Abfrage Musik/,
    );
    fireEvent.click(knopf(fenster, 'Abfrage beenden'));
    fireEvent.click(
      within(await screen.findByRole('alertdialog', { name: 'Abfrage beenden?' })).getByRole(
        'button',
        { name: 'Abfrage beenden' },
      ),
    );
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(gespeichert(speichern)[0][1].abfragen[0].beendet).toBe(HEUTE);
  });

  it('ohne Einrichtung im Dokument: wie bisher, keine Automatik, kein Aufruf an die Hilfsgruppe', async () => {
    const { w, a } = hilfsgruppe();
    const speichern = speichernMitLog(w.log);
    const { fenster } = await oeffnen({
      lesen: nurMusik(standardInhalt()),
      speichern,
      automatik: a,
    });
    await starte(fenster);
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(w.log).toEqual(['SPEICHERN']);
  });

  it('mit Automatik wartet der Start auf die Zahlen: ohne gelesene Antworten bleibt der Knopf gesperrt (sonst bliebe die Gruppe leer)', async () => {
    const { a } = hilfsgruppe();
    const { fenster } = await oeffnen({
      lesen: nurMusik(MIT_EINR),
      automatik: a,
      ladePersonen: () => Promise.reject(new Error('nein')),
    });
    await within(fenster).findByText(/Wer noch offen ist, lässt sich gerade nicht sagen/);
    expect(knopf(fenster, 'Abfrage starten')).toHaveProperty('disabled', true);
  });

  it('Teilfehler beim Eintragen: die Abfrage läuft, die Meldung nennt, wer fehlt; „Fehlende nachtragen“ trägt NUR sie ein – am Starttag', async () => {
    const { w, a } = hilfsgruppe();
    w.stoerung.wirft = { 'PUT /groups/50/members/11': new ApiError(503, 'ct') };
    const { fenster } = await oeffnen({
      lesen: nurMusik(MIT_EINR),
      automatik: a,
      jetzt: '2026-10-14T08:00:00Z',
    });
    await starte(fenster);
    expect(await within(fenster).findByText(/es fehlen: Carla Test/)).toBeTruthy();
    expect(w.mitglieder.map((m) => m.person)).toEqual([5]);
    w.stoerung.wirft = undefined;
    w.log.length = 0;
    fireEvent.click(await within(fenster).findByRole('button', { name: 'Fehlende nachtragen' }));
    await waitFor(() => expect(w.log).toEqual(['PUT /groups/50/members/11']));
    expect(w.mitglieder.map((m) => m.person).sort((x, y) => x - y)).toEqual([5, 11]);
  });

  it('an einem späteren Tag gibt es „Fehlende nachtragen“ nicht – der Hinweis nennt „Erinnern“', async () => {
    const { w, a } = hilfsgruppe();
    w.stoerung.wirft = { 'PUT /groups/50/members/11': new ApiError(503, 'ct') };
    // Gestartet am 14.10., „heute“ im Fenster ist aber der 14.10. – der Starttag; für den Folgetag öffnen wir neu mit einer
    // Abfrage, die am 12.10. gestartet wurde (ZEIT) und deren Fehlende noch im Speicher dieser Sitzung stehen.
    const { fenster } = await oeffnen({ lesen: nurMusik(MIT_EINR), automatik: a, jetzt: ZEIT });
    await starte(fenster);
    expect(await within(fenster).findByText(/nachgetragen wird nur am Starttag/)).toBeTruthy();
    expect(within(fenster).queryByRole('button', { name: 'Fehlende nachtragen' })).toBeNull();
  });

  it('Beenden: erst alle ausgetragen (nachgelesen), dann „beendet“ gespeichert', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [tn(5), tn(11), { person: 1, rolle: R_LEITER }] });
    const speichern = speichernMitLog(w.log);
    const { fenster } = await oeffnen(
      { lesen: nurMusik(laufendMitEinr()), speichern, automatik: a },
      /^Abfrage Musik/,
    );
    fireEvent.click(knopf(fenster, 'Abfrage beenden'));
    fireEvent.click(
      within(await screen.findByRole('alertdialog', { name: 'Abfrage beenden?' })).getByRole(
        'button',
        { name: 'Abfrage beenden' },
      ),
    );
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    const log = w.log.filter((z) => z !== 'SPEICHERN' && !z.startsWith('GET'));
    expect(log).toEqual(['DELETE /groups/50/members/5', 'DELETE /groups/50/members/11']);
    expect(w.log.indexOf('SPEICHERN')).toBeGreaterThan(
      w.log.lastIndexOf('DELETE /groups/50/members/11'),
    );
    // Der Leiter bleibt.
    expect(w.mitglieder).toEqual([{ person: 1, rolle: R_LEITER }]);
    expect(gespeichert(speichern)[0][1].abfragen[0].beendet).toBe(HEUTE);
  });

  it('Beenden, Austragen schlägt fehl: NICHT als beendet gespeichert, Meldung nennt Name und „Erinnerungen laufen weiter“', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [tn(5), tn(11)] });
    w.stoerung.tragNichtAus = new Set([11]);
    const speichern = speichernMitLog(w.log);
    const { fenster } = await oeffnen(
      { lesen: nurMusik(laufendMitEinr()), speichern, automatik: a },
      /^Abfrage Musik/,
    );
    fireEvent.click(knopf(fenster, 'Abfrage beenden'));
    fireEvent.click(
      within(await screen.findByRole('alertdialog', { name: 'Abfrage beenden?' })).getByRole(
        'button',
        { name: 'Abfrage beenden' },
      ),
    );
    expect(await within(fenster).findByText(/Die Abfrage wurde nicht beendet/)).toBeTruthy();
    expect(fenster.textContent).toContain('Person 11');
    expect(speichern).not.toHaveBeenCalled();
  });

  it('Abgleich beim Öffnen des Stands: trägt aus, wer nicht mehr offen ist (beantwortet, eingeteilt, pausiert), und sagt es leise – trägt nie ein', async () => {
    // Offen ist nur Anna (5). Ben (8) hat alles beantwortet, Carla (11) pausiert, Dora (99) fehlt in der Gruppe (Nachzügler).
    const pause = liste(pauseSetzen(leereListe(), CARLA.id, { bis: '2026-12-31' }));
    const { w, a } = hilfsgruppe({ mitglieder: [tn(5), tn(8), tn(11)] });
    const { fenster } = await oeffnen(
      { lesen: nurMusik(laufendMitEinr()), automatik: a, personenlisten: [[4, pause]] },
      /^Abfrage Musik/,
    );
    expect(
      await within(fenster).findByText(/2 Personen ausgetragen, die inzwischen geantwortet haben/),
    ).toBeTruthy();
    expect(within(fenster).getByText(/1 Person bekommt noch Erinnerungen/)).toBeTruthy();
    expect(w.mitglieder.map((m) => m.person)).toEqual([5]);
    expect(w.log.filter((z) => z.startsWith('PUT'))).toEqual([]);
    // Einmal je Öffnen – kein zweiter Durchgang.
    await new Promise((r) => setTimeout(r, 30));
    expect(w.log.filter((z) => z.startsWith('DELETE'))).toHaveLength(2);
  });

  it('direkt nach dem Start läuft KEIN Abgleich neben dem Eintragen: unten steht dieselbe Zahl wie oben (R-5c)', async () => {
    const { w, a } = hilfsgruppe();
    // Das Eintragen hängt am ersten PUT, bis der Test es freigibt – der Abgleich liefe sonst vor dem Ende von (d).
    let frei: () => void = () => {};
    const sperre = new Promise<void>((r) => (frei = r));
    const echt = a.mitgliedAnlegen;
    let beimHaengen = -1;
    const gelesen = vi.spyOn(a.port, 'liste');
    a.mitgliedAnlegen = vi.fn(async (...args: Parameters<typeof echt>) => {
      if (beimHaengen < 0) beimHaengen = gelesen.mock.calls.length;
      await sperre;
      return echt(...args);
    });
    const { fenster } = await oeffnen({
      lesen: nurMusik(MIT_EINR),
      automatik: a,
      jetzt: '2026-10-14T08:00:00Z',
    });
    await starte(fenster);
    await waitFor(() => expect(beimHaengen).toBeGreaterThanOrEqual(0));
    // Zeit für Rendern und Effekte – mit dem Fehler ist der Abgleich spätestens jetzt gestartet und hat die Gruppe gelesen.
    await new Promise((r) => setTimeout(r, 60));
    expect(gelesen.mock.calls.length).toBe(beimHaengen);
    frei();
    expect(await within(fenster).findByText(/2 Personen bekommen Erinnerungen/)).toBeTruthy();
    // Unten die Zahl aus dem Nachlesen von (d) – ohne Abgleich, der sie sonst setzen würde.
    expect(await within(fenster).findByText('2 Personen bekommen noch Erinnerungen.')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 60));
    expect(within(fenster).queryByText(/1 Person bekommt noch Erinnerungen/)).toBeNull();
    expect(w.mitglieder.map((m) => m.person)).toEqual([5, 11]);
    // Beim erneuten Öffnen gleicht der Stand weiter ab (anderes Fenster, frischer Zustand).
    cleanup();
    const { fenster: neuFenster } = await oeffnen(
      { lesen: nurMusik(laufendMitEinr()), automatik: a },
      /^Abfrage Musik/,
    );
    expect(await within(neuFenster).findByText(/bekommen? noch Erinnerungen/)).toBeTruthy();
  });

  it('Abgleich: ist das Ergebnis nicht vollständig (Mitglieder nicht lesbar), wird NICHTS ausgetragen', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [tn(5), tn(8)] });
    const { fenster } = await oeffnen(
      {
        lesen: nurMusik(laufendMitEinr()),
        automatik: a,
        ladePersonen: () => Promise.reject(new Error('nein')),
      },
      /^Abfrage Musik/,
    );
    await within(fenster).findByText(/lässt sich gerade nicht sagen/);
    await new Promise((r) => setTimeout(r, 30));
    expect(w.log).toEqual([]);
    expect(w.mitglieder).toHaveLength(2);
  });

  it('Abgleich: Lesefehler an der Hilfsgruppe → nichts ausgetragen, keine Zeile', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [tn(5), tn(8)] });
    w.stoerung.wirft = { 'GET /groups/50/members': new ApiError(503, 'ct') };
    const { fenster } = await oeffnen(
      { lesen: nurMusik(laufendMitEinr()), automatik: a },
      /^Abfrage Musik/,
    );
    await within(fenster).findByText(/^Noch offen/);
    await new Promise((r) => setTimeout(r, 30));
    expect(w.log).toEqual([]);
    expect(within(fenster).queryByText(/bekommt? noch Erinnerungen/)).toBeNull();
  });
});
