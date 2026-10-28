// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { DEFAULT_SITE_CONFIG, type Absence, type AbsenceEvent } from '@shared/types/index';

/**
 * #177 Abwesenheiten – die Bedienung nach Entwurfsrunde 8 (19.09.2026), nicht die Daten:
 *  - ein Haken ist nur VORGEMERKT, erst „Speichern" schreibt – alle auf einmal (Alwin + Frau),
 *  - ein zweiter Tipp nimmt den Haken zurück, „Verwerfen" alles,
 *  - ein Termin in einem Zeitraum fragt nach (löschen vormerken oder anpassen), statt still zu löschen,
 *  - der Zeitraum-Knopf (wie im Dienstplaner) wählt, was zu sehen ist – ab heute vier Wochen, ein Monat, eigener,
 *  - „Einträge" listet Anstehendes und Früheres, Vergangenes nur zum Ansehen,
 *  - offline sind die Kästchen und das Plus gesperrt.
 */
const absences = vi.fn();
const events = vi.fn();
const anlegen = vi.fn();
const aendern = vi.fn();
const loeschen = vi.fn();
const sichern = vi.fn();
vi.mock('../hooks/useAvailability', () => ({
  useMyAbsences: (...a: unknown[]) => absences(...a),
  useAbsenceEvents: (...a: unknown[]) => events(...a),
  useAbsenceReasons: () => ({ data: GRUENDE }),
  useCreateAbsence: () => ({ mutate: anlegen, isPending: false }),
  useUpdateAbsence: () => ({ mutate: aendern, isPending: false }),
  useDeleteAbsence: () => ({ mutate: loeschen, isPending: false }),
  useSaveAbsenceChanges: () => ({ mutate: sichern, isPending: false }),
}));
vi.mock('../components/Coachmarks', () => ({ Coachmarks: () => null }));
// Die Termin-Arten kommen aus der Site-Konfiguration (#400) – hier als Attrappe, je Test änderbar.
const siteConfig = vi.fn();
vi.mock('../hooks/useSiteConfig', () => ({ useSiteConfig: () => siteConfig() }));
vi.mock('../utils/onboarding', async () => {
  const echt = await vi.importActual<typeof import('../utils/onboarding')>('../utils/onboarding');
  return { ...echt, isTourDone: () => true };
});

const { Availability } = await import('./Availability');

/** Die Gründe, wie ChurchTools sie liefert – gemessen an der ECG-Instanz (05.09.2026). */
const GRUENDE = [
  { id: 3, name: 'Krank', standard: false },
  { id: 2, name: 'Urlaub', standard: false },
  { id: 1, name: 'Abwesend', standard: true },
];

const EVENTS: AbsenceEvent[] = [
  {
    id: 1,
    name: 'Gottesdienst',
    date: '2026-10-04',
    startDate: '2026-10-04T10:00:00Z',
    endDate: '2026-10-04T12:00:00Z',
  },
  {
    id: 2,
    name: 'Gottesdienst',
    date: '2026-10-11',
    startDate: '2026-10-11T10:00:00Z',
    endDate: '2026-10-11T12:00:00Z',
  },
  {
    id: 3,
    name: 'Jugendabend',
    date: '2026-10-16',
    startDate: '2026-10-16T18:00:00Z',
    endDate: '2026-10-16T20:00:00Z',
  },
  {
    id: 4,
    name: 'Gottesdienst',
    date: '2026-11-01',
    startDate: '2026-11-01T10:00:00Z',
    endDate: '2026-11-01T12:00:00Z',
  },
];
/** Die Termin-Arten des Admins (#400) – „Jugend" trifft „Jugendabend" über das Suchwort. */
const ARTEN = [
  { id: 'gd', name: 'Gottesdienst', suchwort: 'Gottesdienst' },
  { id: 'jugend', name: 'Jugend', suchwort: 'Jugend' },
];
const EIGENE: Absence = {
  id: 10,
  startDate: '2026-10-11',
  endDate: '2026-10-11',
  startTime: null,
  endTime: null,
  comment: 'Reise',
  reason: 'Abwesend',
  reasonId: 1,
  vonApp: true,
};
const URLAUB: Absence = {
  id: 11,
  startDate: '2026-10-14',
  endDate: '2026-10-20',
  startTime: null,
  endTime: null,
  comment: 'Herbstferien',
  reason: 'Urlaub',
  reasonId: 2,
  vonApp: false,
};
const FRUEHER: Absence = {
  id: 12,
  startDate: '2026-07-20',
  endDate: '2026-08-03',
  startTime: null,
  endTime: null,
  comment: 'Sommer',
  reason: 'Urlaub',
  reasonId: 2,
  vonApp: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Der Termin-Filter wird auf dem Gerät gemerkt – jeder Test beginnt ohne Auswahl.
  localStorage.clear();
  siteConfig.mockReturnValue({ data: { ...DEFAULT_SITE_CONFIG, terminArten: ARTEN } });
  absences.mockReturnValue({
    data: [EIGENE, URLAUB, FRUEHER],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  events.mockReturnValue({ data: EVENTS, isLoading: false, isError: false, refetch: vi.fn() });
});

const HEUTE = '2026-10-01';

function zeige(online = true, heute = HEUTE) {
  const onToast = vi.fn();
  render(<Availability online={online} onToast={onToast} heute={heute} />);
  return { onToast };
}

const kasten = (name: RegExp) => screen.getByRole<HTMLButtonElement>('button', { name });
const leiste = () => screen.queryByRole('status');

describe('Abwesenheiten – Kopf und Monat', () => {
  it('heißt „Abwesenheiten", hat den Schalter Termine | Einträge und zeigt den laufenden Monat', () => {
    zeige();
    expect(screen.getByText('Abwesenheiten')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Termine' })).not.toBeNull();
    expect(screen.getByRole('button', { name: /Einträge/ })).not.toBeNull();
    expect(screen.getByText('Oktober 2026')).not.toBeNull();
    expect(screen.getByText('3 Termine')).not.toBeNull();
    expect(screen.queryByText('01.11.')).toBeNull(); // November gehört nicht in den Oktober
  });

  it('„Ab heute“ zeigt die nächsten vier Wochen – der Knopf nennt die Spanne', () => {
    zeige();
    expect(
      screen.getByRole('button', {
        name: /^Zeitraum: 01\.10\. – 28\.10\.2026, 3 Termine · ab heute/,
      }),
    ).not.toBeNull();
    expect(screen.queryByRole('button', { name: /01\.11\./ })).toBeNull();
  });

  it('Zeitraum-Knopf: „Nächster Monat“ zeigt November, „Dieser Monat“ wieder Oktober', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /^Zeitraum:/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Nächster Monat/ }));
    // Der Knopf nennt den Monat, darunter steht er als Überschrift.
    expect(
      screen.getByRole('button', { name: /^Zeitraum: November 2026, 1 Termin$/ }),
    ).not.toBeNull();
    expect(screen.getAllByText('November 2026')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /^Zeitraum:/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Dieser Monat/ }));
    expect(
      screen.getByRole('button', { name: /^Zeitraum: Oktober 2026, 3 Termine$/ }),
    ).not.toBeNull();
    expect(screen.queryByText('November 2026')).toBeNull();
  });

  it('ein eigener Zeitraum über mehrere Monate – je Monat eine Überschrift', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /^Zeitraum:/ }));
    fireEvent.change(screen.getByLabelText('von'), { target: { value: '2026-10-10' } });
    fireEvent.change(screen.getByLabelText('bis'), { target: { value: '2026-11-30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anzeigen' }));
    expect(screen.getByText('Oktober 2026')).not.toBeNull();
    expect(screen.getByText('November 2026')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /04\.10\./ })).toBeNull();
  });

  it('Vergangenes steht nicht unter „Termine“ – auch nicht in „Dieser Monat“', () => {
    zeige(true, '2026-10-12');
    fireEvent.click(screen.getByRole('button', { name: /^Zeitraum:/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Dieser Monat/ }));
    expect(screen.queryByRole('button', { name: /04\.10\./ })).toBeNull();
    expect(screen.queryByRole('button', { name: /11\.10\./ })).toBeNull();
    expect(kasten(/16\.10\./)).not.toBeNull();
  });

  it('ein Zeitraum ohne Termine sagt das', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /^Zeitraum:/ }));
    fireEvent.change(screen.getByLabelText('von'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByLabelText('bis'), { target: { value: '2026-12-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anzeigen' }));
    expect(screen.getByText('Kein Termin in diesem Zeitraum.')).not.toBeNull();
  });

  it('geholt werden zwölf Monate – ein eigener Zeitraum darüber hinaus holt bis zur Jahresgrenze nach', () => {
    zeige();
    expect(events).toHaveBeenLastCalledWith(true, '2027-09-30');
    fireEvent.click(screen.getByRole('button', { name: /^Zeitraum:/ }));
    fireEvent.change(screen.getByLabelText('von'), { target: { value: '2027-09-20' } });
    fireEvent.change(screen.getByLabelText('bis'), { target: { value: '2027-10-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anzeigen' }));
    expect(events).toHaveBeenLastCalledWith(true, '2027-10-01');
    expect(absences).toHaveBeenLastCalledWith(true, '2025-10-01', '2027-10-01');
  });

  it('mehr als ein Jahr voraus lässt der Knopf nicht zu – der Server lehnte es mit einem Ladefehler ab', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /^Zeitraum:/ }));
    fireEvent.change(screen.getByLabelText('von'), { target: { value: '2027-12-01' } });
    fireEvent.change(screen.getByLabelText('bis'), { target: { value: '2028-01-31' } });
    expect(screen.getByText('Höchstens bis 01.10.2027')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Anzeigen' })).toHaveProperty('disabled', true);
    expect(events).not.toHaveBeenCalledWith(true, '2028-01-31');
  });
});

describe('Abwesenheiten – Häkchen sind vorgemerkt, Speichern schreibt alle', () => {
  it('ein Haken zeigt die Leiste, schreibt aber noch nichts; Speichern trägt den Termin ein', () => {
    const { onToast } = zeige();
    expect(leiste()).toBeNull();
    const k = kasten(/Abwesend – Gottesdienst, So, 04\.10\./);
    expect(k.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(k);
    expect(k.getAttribute('aria-pressed')).toBe('true');
    expect(leiste()?.textContent).toContain('1 Änderung vorgemerkt');
    expect(sichern).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(sichern).toHaveBeenCalledTimes(1);
    // Mit dem ZEITFENSTER des Termins (22.09.2026) – nur so lassen sich zwei Termine am selben Tag
    // einzeln abhaken.
    expect(sichern.mock.calls[0][0]).toEqual({
      eintragen: [
        {
          startDate: '2026-10-04',
          endDate: '2026-10-04',
          startTime: '2026-10-04T10:00:00Z',
          endTime: '2026-10-04T12:00:00Z',
        },
      ],
      loeschen: [],
    });
    // Erfolg meldet die Zahl und räumt auf (der Rückruf kommt von außen → act)
    void act(() => sichern.mock.calls[0][1].onSuccess(1));
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('1 Änderung gespeichert'));
    expect(leiste()).toBeNull();
  });

  it('ein zweiter Tipp nimmt den Haken zurück – nichts bleibt vorgemerkt', () => {
    zeige();
    const k = kasten(/So, 04\.10\./);
    fireEvent.click(k);
    fireEvent.click(k);
    expect(k.getAttribute('aria-pressed')).toBe('false');
    expect(leiste()).toBeNull();
  });

  it('ein eigener Eintrag hat den Haken; ihn entfernen merkt das Löschen vor', () => {
    zeige();
    const k = kasten(/So, 11\.10\./);
    expect(k.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(k);
    expect(k.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(sichern.mock.calls[0][0]).toEqual({ eintragen: [], loeschen: [10] });
  });

  it('„Verwerfen" nimmt alles zurück', () => {
    zeige();
    fireEvent.click(kasten(/So, 04\.10\./));
    fireEvent.click(kasten(/So, 11\.10\./));
    expect(leiste()?.textContent).toContain('2 Änderungen vorgemerkt');
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
    expect(leiste()).toBeNull();
    expect(kasten(/So, 11\.10\./).getAttribute('aria-pressed')).toBe('true');
  });

  it('solange etwas vorgemerkt ist, gibt es kein Plus – ein Speichern-Weg', () => {
    zeige();
    expect(screen.getByRole('button', { name: 'Zeitraum eintragen' })).not.toBeNull();
    fireEvent.click(kasten(/So, 04\.10\./));
    expect(screen.queryByRole('button', { name: 'Zeitraum eintragen' })).toBeNull();
  });

  it('ein Fehler beim Speichern behält die Vormerkung – man kann es noch einmal versuchen', () => {
    const { onToast } = zeige();
    fireEvent.click(kasten(/So, 04\.10\./));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    void act(() => sichern.mock.calls[0][1].onError(new Error('429')));
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('Konnte nicht gespeichert'));
    expect(leiste()?.textContent).toContain('1 Änderung vorgemerkt');
  });
});

describe('Abwesenheiten – ein Termin in einem Zeitraum fragt nach', () => {
  it('der Haken sitzt, die Unterzeile nennt den Zeitraum, ein Tipp öffnet die Rückfrage', () => {
    zeige();
    const k = kasten(/Jugendabend, Fr, 16\.10\./);
    expect(k.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/Urlaub · Mi, 14\.10\. – Di, 20\.10\./)).not.toBeNull();
    fireEvent.click(k);
    expect(screen.getByText('Teil eines Zeitraums')).not.toBeNull();
    expect(screen.getByText(/gehört zu/).textContent).toContain('Urlaub, Mi, 14.10. – Di, 20.10.');
    expect(leiste()).toBeNull(); // noch nichts vorgemerkt
  });

  it('„Zeitraum löschen" merkt den ganzen Zeitraum vor – Speichern löscht ihn', () => {
    zeige();
    fireEvent.click(kasten(/Jugendabend/));
    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum löschen' }));
    expect(screen.queryByText('Teil eines Zeitraums')).toBeNull();
    expect(kasten(/Jugendabend/).getAttribute('aria-pressed')).toBe('false');
    expect(leiste()?.textContent).toContain('1 Änderung vorgemerkt');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(sichern.mock.calls[0][0]).toEqual({ eintragen: [], loeschen: [11] });
  });

  it('ein weiterer Tipp nimmt die vorgemerkte Löschung zurück – ohne neue Rückfrage', () => {
    zeige();
    fireEvent.click(kasten(/Jugendabend/));
    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum löschen' }));
    fireEvent.click(kasten(/Jugendabend/));
    expect(screen.queryByText('Teil eines Zeitraums')).toBeNull();
    expect(kasten(/Jugendabend/).getAttribute('aria-pressed')).toBe('true');
    expect(leiste()).toBeNull();
  });

  it('„Zeitraum anpassen" öffnet das Fenster mit den Werten des Zeitraums', () => {
    zeige();
    fireEvent.click(kasten(/Jugendabend/));
    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum anpassen' }));
    expect(screen.getByText('Abwesenheit ändern')).not.toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Von').value).toBe('2026-10-14');
    expect(screen.getByLabelText<HTMLInputElement>('Bis').value).toBe('2026-10-20');
    expect(leiste()).toBeNull();
  });
});

describe('Abwesenheiten – Seite „Einträge"', () => {
  it('zeigt Anstehendes nach Monat, mit den Terminen, die ein Eintrag trifft', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /Einträge/ }));
    expect(screen.getByRole('button', { name: 'Anstehend (2)' })).not.toBeNull();
    expect(screen.getByText('Oktober 2026')).not.toBeNull();
    const urlaub = screen.getByRole('button', {
      name: /Abwesenheit Mi, 14\.10\. – Di, 20\.10\. ändern/,
    });
    expect(urlaub.textContent).toContain('trifft Fr, 16.10.');
    expect(urlaub.textContent).toContain('in ChurchTools eingetragen');
    expect(screen.queryByText(/Sommer/)).toBeNull();
  });

  it('„Früher" listet Vergangenes – ein Tipp zeigt es nur zum Ansehen', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /Einträge/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Früher (1)' }));
    expect(screen.getByText('Juli 2026')).not.toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: /Abwesenheit .*20\.07\. – .*03\.08\. ansehen/ }),
    );
    expect(screen.getByText('Vergangene Abwesenheit')).not.toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Von').disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Löschen' })).toBeNull();
  });

  it('ein anstehender Eintrag öffnet „Abwesenheit ändern" und lässt sich löschen', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /Einträge/ }));
    fireEvent.click(screen.getByRole('button', { name: /Abwesenheit So, 11\.10\. ändern/ }));
    expect(screen.getByText('Abwesenheit ändern')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(loeschen).toHaveBeenCalledWith(10, expect.anything());
  });
});

describe('Abwesenheiten – das Plus je Bildschirm (Scheibe S2)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const plus = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Zeitraum eintragen' });

  it('am iPad/Rechner grün mit Text im Seitenkopf – wie „+ Gruppe erstellen“ in ChurchTools', () => {
    zeige();
    expect(plus().textContent).toContain('Zeitraum eintragen');
    fireEvent.click(plus());
    expect(screen.getByRole('dialog', { name: 'Zeitraum eintragen' })).not.toBeNull();
  });

  it('am Handy schwebt das runde Plus ohne Text und öffnet das Fenster direkt', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    zeige();
    expect(plus().textContent).toBe('');
    fireEvent.click(plus());
    expect(screen.getByRole('dialog', { name: 'Zeitraum eintragen' })).not.toBeNull();
  });

  it('am Handy gibt es kein Plus, solange etwas vorgemerkt ist', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    zeige();
    fireEvent.click(kasten(/So, 04\.10\./));
    expect(screen.queryByRole('button', { name: 'Zeitraum eintragen' })).toBeNull();
  });
});

describe('Abwesenheiten – Plus und offline', () => {
  it('das Plus öffnet „Zeitraum eintragen" mit dem nächsten Termin als Start', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum eintragen' }));
    expect(screen.getByRole('dialog', { name: 'Zeitraum eintragen' })).not.toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Von').value).toBe('2026-10-04');
    fireEvent.click(screen.getByRole('button', { name: '1 Woche' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eintragen (7 Tage)' }));
    expect(anlegen).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: '2026-10-04', endDate: '2026-10-10', reasonId: 1 }),
      expect.anything(),
    );
  });

  it('offline sind Kästchen und Plus gesperrt, Ansehen geht', () => {
    zeige(false);
    expect(kasten(/So, 04\.10\./).disabled).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Zeitraum eintragen' }).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Einträge/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Früher (1)' }));
    const alt = screen.getByRole<HTMLButtonElement>('button', { name: /ansehen/ });
    expect(alt.disabled).toBe(false);
  });
});

/**
 * Der Termin-Filter (#400) – Alwin: „nur Gottesdienst oder nur Gebetsabend". Entschieden: nach
 * Termin-Arten mit Suchwörtern (vom Admin gepflegt), **genau eine oder alle**, auf dem Gerät
 * gemerkt.
 *
 * Die Knöpfe gibt es nur, wenn es etwas zu wählen gibt; die Zahl „n Termine" folgt dem Filter; und
 * vorgemerkte Häkchen überstehen ihn – sie hängen am Tag, nicht an der Liste.
 */
describe('Abwesenheiten – Termin-Filter (#400, seit 28.10.2026 mit Häkchen wie im Dienstplaner)', () => {
  const filter = () => screen.getByRole<HTMLButtonElement>('button', { name: /^Filter/ });
  const haken = (name: string) => screen.getByRole<HTMLInputElement>('checkbox', { name });
  const oeffne = () => fireEvent.click(filter());

  it('ein Knopf „Filter“ mit einem Häkchen je Art – anfangs alle angehakt', () => {
    zeige();
    expect(filter().getAttribute('aria-label')).toBe('Filter');
    oeffne();
    expect(haken('Gottesdienst').checked).toBe(true);
    expect(haken('Jugend').checked).toBe(true);
  });

  it('KEIN Filter, wenn keine Termin-Arten gepflegt sind', () => {
    siteConfig.mockReturnValue({ data: { ...DEFAULT_SITE_CONFIG, terminArten: [] } });
    zeige();
    expect(screen.queryByRole('button', { name: /^Filter/ })).toBeNull();
    // Auch kein leeres Ziel für die Einführung – sonst zeigte ihr Schritt „Nur bestimmte Termine“ ins Leere.
    expect(document.querySelector('[data-tour="verf-filter"]')).toBeNull();
  });

  it('KEIN Filter, wenn alle Termine in dieselbe Art fallen', () => {
    siteConfig.mockReturnValue({ data: { ...DEFAULT_SITE_CONFIG, terminArten: [ARTEN[0]] } });
    events.mockReturnValue({
      data: EVENTS.filter((e) => e.name === 'Gottesdienst'),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    zeige();
    expect(screen.queryByRole('button', { name: /^Filter/ })).toBeNull();
  });

  it('ein Termin, der zu keiner Art passt, steht unter „Sonstige“', () => {
    siteConfig.mockReturnValue({ data: { ...DEFAULT_SITE_CONFIG, terminArten: [ARTEN[0]] } });
    zeige();
    oeffne();
    fireEvent.click(haken('Gottesdienst'));
    expect(screen.getByText('1 Termin')).not.toBeNull();
    expect(kasten(/16\.10\./)).not.toBeNull();
    expect(haken('Sonstige').checked).toBe(true);
  });

  it('ein Häkchen weg blendet die Art aus – Liste und Zahl; der Knopf nennt, wie viel ausgeblendet ist', () => {
    zeige();
    oeffne();
    fireEvent.click(haken('Gottesdienst'));
    expect(screen.getByText('1 Termin')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /04\.10\./ })).toBeNull();
    expect(kasten(/16\.10\./)).not.toBeNull();
    expect(filter().getAttribute('aria-label')).toBe('Filter, 1 ausgeblendet');
  });

  it('mehrere ausblenden geht – anders als vorher („eins oder alles“)', () => {
    zeige();
    oeffne();
    fireEvent.click(haken('Gottesdienst'));
    fireEvent.click(haken('Jugend'));
    expect(screen.getByText('Kein Termin in diesem Zeitraum.')).not.toBeNull();
    expect(filter().getAttribute('aria-label')).toBe('Filter, 2 ausgeblendet');
  });

  it('das Häkchen wieder setzen zeigt die Art wieder', () => {
    zeige();
    oeffne();
    fireEvent.click(haken('Jugend'));
    expect(screen.getByText('2 Termine')).not.toBeNull();
    fireEvent.click(haken('Jugend'));
    expect(screen.getByText('3 Termine')).not.toBeNull();
  });

  it('merkt sich die ausgeblendeten Arten auf dem Gerät', () => {
    zeige();
    oeffne();
    fireEvent.click(haken('Jugend'));
    expect(localStorage.getItem('worship:abwesenheiten-ausgeblendet')).toBe('["jugend"]');
    cleanup();
    zeige();
    expect(screen.getByText('2 Termine')).not.toBeNull();
  });

  it('die gemerkte Wahl der alten Art wird umgerechnet: „nur Jugend“ → Gottesdienst ausgeblendet', () => {
    localStorage.setItem('worship:abwesenheiten-filter', JSON.stringify(['jugend']));
    zeige();
    expect(screen.getByText('1 Termin')).not.toBeNull();
    expect(filter().getAttribute('aria-label')).toBe('Filter, 1 ausgeblendet');
  });

  it('eine alte Wahl, die es nicht mehr gibt, blendet nichts aus – keine leere Liste ohne Grund', () => {
    localStorage.setItem('worship:abwesenheiten-filter', JSON.stringify(['99']));
    zeige();
    expect(screen.getByText('3 Termine')).not.toBeNull();
  });

  it('ist schon etwas Neues gemerkt, zählt die alte Wahl nicht mehr', () => {
    localStorage.setItem('worship:abwesenheiten-filter', JSON.stringify(['jugend']));
    localStorage.setItem('worship:abwesenheiten-ausgeblendet', '[]');
    zeige();
    expect(screen.getByText('3 Termine')).not.toBeNull();
  });

  it('ein vorgemerkter Haken übersteht den Filterwechsel', () => {
    zeige();
    fireEvent.click(kasten(/04\.10\./));
    expect(leiste()).not.toBeNull();
    oeffne();
    fireEvent.click(haken('Gottesdienst')); // der 04.10. ist jetzt ausgeblendet
    expect(leiste()).not.toBeNull(); // die Vormerkung bleibt
    fireEvent.click(haken('Gottesdienst'));
    expect(kasten(/04\.10\./).getAttribute('aria-pressed')).toBe('true');
  });
});

/**
 * **Runterziehen zum Aktualisieren** (Alwin, 22.09.2026: „bei Abwesenheit und Termine ist das
 * Neuladen nicht richtig. Bei Lied stimmt es.").
 *
 * Die Seite lädt ZWEI Dinge – die eigenen Einträge und die Termine. Vorher warf sie beide Abrufe mit
 * `void` weg und gab selbst nichts zurück; die Ladeanzeige war deshalb sofort wieder da und wieder
 * weg, während die Daten noch unterwegs waren. Hier dauern die Abrufe absichtlich deutlich länger
 * als die Untergrenze der Anzeige (450 ms) – sonst wäre der Test auch ohne den Fix grün.
 */
describe('Abwesenheiten – Runterziehen zum Aktualisieren', () => {
  const scroller = (c: HTMLElement) => c.querySelector('[class*="scroll"]') as HTMLElement;
  // Bei jeder Prüfung frisch holen: React tauscht den Teilbaum beim Zustandswechsel aus, eine
  // gemerkte Referenz zeigt danach auf ein Element, das nicht mehr im Dokument hängt.
  const anzeigerDeckkraft = (c: HTMLElement) =>
    (c.querySelector('[class*="pullIndicator"]') as HTMLElement).style.opacity;

  it('lässt die Ladeanzeige stehen, bis Einträge UND Termine da sind', async () => {
    vi.useFakeTimers();
    let eintraegeFertig!: () => void;
    let termineFertig!: () => void;
    absences.mockReturnValue({
      data: [EIGENE, URLAUB, FRUEHER],
      isLoading: false,
      isError: false,
      refetch: () => new Promise((f) => (eintraegeFertig = f as () => void)),
    });
    events.mockReturnValue({
      data: EVENTS,
      isLoading: false,
      isError: false,
      refetch: () => new Promise((f) => (termineFertig = f as () => void)),
    });

    const { container } = render(<Availability online onToast={vi.fn()} heute={HEUTE} />);
    const bereich = scroller(container);

    fireEvent.touchStart(bereich, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(bereich, { touches: [{ clientY: 200 }] });
    await act(async () => {
      fireEvent.touchEnd(bereich);
    });

    // Lange nach der Untergrenze – die Anzeige steht, weil noch geladen wird.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(anzeigerDeckkraft(container)).toBe('1');

    await act(async () => {
      eintraegeFertig();
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(anzeigerDeckkraft(container)).toBe('1'); // die Termine fehlen noch

    await act(async () => {
      termineFertig();
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(anzeigerDeckkraft(container)).toBe('0');
    vi.useRealTimers();
  });
});

/**
 * **Zwei Termine an einem Tag – einzeln abhaken** (Alwin, 22.09.2026: „manchmal hab ich morgens
 * keine Zeit kann aber nachmittags und umgekehrt. das muss in der logik geändert werden").
 *
 * Vorher hing der Haken am TAG: Ein Kästchen abhaken setzte beide Termine des Tages auf abwesend,
 * weil die Abwesenheit ganztägig war. Jetzt trägt ein Haken das Zeitfenster genau dieses Termins
 * ein, und nur der zugehörige Termin zeigt den Haken.
 */
describe('Abwesenheiten – mehrere Termine am selben Tag', () => {
  const VORMITTAGS: AbsenceEvent = {
    id: 21,
    name: 'Gottesdienst',
    date: '2026-10-04',
    startDate: '2026-10-04T10:00:00Z',
    endDate: '2026-10-04T12:00:00Z',
  };
  const NACHMITTAGS: AbsenceEvent = {
    id: 22,
    name: 'Jugendtreff',
    date: '2026-10-04',
    startDate: '2026-10-04T16:00:00Z',
    endDate: '2026-10-04T18:00:00Z',
  };

  beforeEach(() => {
    events.mockReturnValue({
      data: [VORMITTAGS, NACHMITTAGS],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('ein Haken am Vormittagstermin lässt den Nachmittag frei', () => {
    absences.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
    zeige();
    const vormittags = kasten(/Abwesend – Gottesdienst/);
    const nachmittags = kasten(/Abwesend – Jugendtreff/);

    fireEvent.click(vormittags);

    expect(vormittags.getAttribute('aria-pressed')).toBe('true');
    expect(nachmittags.getAttribute('aria-pressed')).toBe('false');
    expect(leiste()?.textContent).toContain('1 Änderung vorgemerkt');

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(sichern.mock.calls[0][0]).toEqual({
      eintragen: [
        {
          startDate: '2026-10-04',
          endDate: '2026-10-04',
          startTime: '2026-10-04T10:00:00Z',
          endTime: '2026-10-04T12:00:00Z',
        },
      ],
      loeschen: [],
    });
  });

  it('ein vorhandener Eintrag mit Uhrzeit hakt nur seinen Termin ab', () => {
    absences.mockReturnValue({
      data: [
        {
          id: 30,
          startDate: '2026-10-04',
          endDate: '2026-10-04',
          startTime: '2026-10-04T16:00:00Z',
          endTime: '2026-10-04T18:00:00Z',
          comment: '',
          reason: 'Abwesend',
          reasonId: 1,
          vonApp: true,
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    zeige();

    expect(kasten(/Abwesend – Jugendtreff/).getAttribute('aria-pressed')).toBe('true');
    expect(kasten(/Abwesend – Gottesdienst/).getAttribute('aria-pressed')).toBe('false');
  });

  it('ein ganztägiger Eintrag gilt weiterhin für beide Termine des Tages', () => {
    absences.mockReturnValue({
      data: [
        {
          id: 31,
          startDate: '2026-10-04',
          endDate: '2026-10-04',
          startTime: null,
          endTime: null,
          comment: '',
          reason: 'Urlaub',
          reasonId: 2,
          vonApp: true,
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    zeige();

    expect(kasten(/Abwesend – Gottesdienst/).getAttribute('aria-pressed')).toBe('true');
    expect(kasten(/Abwesend – Jugendtreff/).getAttribute('aria-pressed')).toBe('true');
  });
});

/**
 * **Ein ganztägiger Eintrag darf nicht stumm verschwinden** (Code-Check vor v2.25.2, 23.09.2026).
 *
 * Die Rückfrage griff nur bei MEHRTÄGIGEN Einträgen. Ein ganztägiger Ein-Tages-Eintrag deckt aber
 * ebenfalls beide Termine des Tages – nimmt man bei einem den Haken weg, wurde die ganze Abwesenheit
 * zum Löschen vorgemerkt und der zweite Termin verlor seinen Haken mit, ohne Warnung und ohne
 * sichtbare Vormerkung. Das trifft während der Umstellung JEDEN Bestandseintrag, denn die sind alle
 * ganztägig.
 */
describe('Abwesenheiten – ganztägiger Eintrag bei zwei Terminen am Tag', () => {
  const VORMITTAGS: AbsenceEvent = {
    id: 41,
    name: 'Gottesdienst',
    date: '2026-10-04',
    startDate: '2026-10-04T10:00:00Z',
    endDate: '2026-10-04T12:00:00Z',
  };
  const NACHMITTAGS: AbsenceEvent = {
    id: 42,
    name: 'Jugendtreff',
    date: '2026-10-04',
    startDate: '2026-10-04T16:00:00Z',
    endDate: '2026-10-04T18:00:00Z',
  };
  const GANZTAGS = {
    id: 50,
    startDate: '2026-10-04',
    endDate: '2026-10-04',
    startTime: null,
    endTime: null,
    comment: '',
    reason: 'Abwesend',
    reasonId: 1,
    vonApp: true,
  };

  beforeEach(() => {
    events.mockReturnValue({
      data: [VORMITTAGS, NACHMITTAGS],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    absences.mockReturnValue({
      data: [GANZTAGS],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('fragt nach, statt den Eintrag für beide Termine stumm zu löschen', () => {
    zeige();
    // Beide Termine tragen den Haken – der Eintrag gilt für den ganzen Tag.
    expect(kasten(/Abwesend – Gottesdienst/).getAttribute('aria-pressed')).toBe('true');
    expect(kasten(/Abwesend – Jugendtreff/).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(kasten(/Abwesend – Gottesdienst/));

    // Es MUSS eine Rückfrage kommen; der Nachmittag darf seinen Haken nicht stumm verlieren.
    // Geprüft am Titel des Fensters und am Knopf – der Fließtext ist über mehrere Elemente verteilt.
    expect(screen.queryByText('Gilt für den ganzen Tag')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Eintrag löschen/ })).not.toBeNull();
    expect(kasten(/Abwesend – Jugendtreff/).getAttribute('aria-pressed')).toBe('true');
  });
});
