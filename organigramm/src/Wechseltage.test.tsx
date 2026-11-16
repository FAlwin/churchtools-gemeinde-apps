// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { tagPunkt } from '@shared/ct/datum';
import {
  GRUNDWERTE,
  sommerferienAus,
  uebergaenge,
  wechselGruppenRegeln,
  wechseljahre,
  type Wechseljahr,
} from '@shared/organigramm/gruppenwechsel';
import { einrichtungAus, type Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import {
  gruppenSicht,
  type GruppenStand,
  type KjDaten,
  type Phase,
} from '@shared/organigramm/gruppenwechselSicht';
import {
  leitungenNachricht,
  regelAbweichungen,
  wechseltageStand,
  wechseltagText,
} from '@shared/organigramm/wechseltage';
import { Wechseltage } from './Wechseltage';
import { ladeRegelAbgleich } from './ladeRegelAbgleich';

vi.mock('./ladeRegelAbgleich', () => ({ ladeRegelAbgleich: vi.fn() }));
const abgleichLaden = vi.mocked(ladeRegelAbgleich);

const FISCHE = 50;
const JUNGSCHAR = 51;
const WECHSEL = 52;

const basis = (eingetragenBis?: number): Einrichtung =>
  einrichtungAus({
    einstellung: {
      ...GRUNDWERTE,
      stufen: [
        { gruppeId: FISCHE, name: 'Fische 7–9', abAlter: 7 },
        { gruppeId: JUNGSCHAR, name: 'Jungschar', abAlter: 10 },
      ],
    },
    bereichGruppeId: 53,
    wechselGruppen: [{ vonGruppeId: FISCHE, nachGruppeId: JUNGSCHAR, gruppeId: WECHSEL }],
    ...(eingetragenBis === undefined ? {} : { eingetragenBis }),
  })!;

const FERIEN = sommerferienAus(
  [
    { titel: 'Sommerferien NRW 2027', beginn: '2027-07-19', ende: '2027-08-31' },
    { titel: 'Sommerferien NRW 2028', beginn: '2028-07-10', ende: '2028-08-22' },
    { titel: 'Sommerferien NRW 2029', beginn: '2029-07-16', ende: '2029-08-28' },
  ],
  GRUNDWERTE.ferienStichwort,
);
const JAHRE: Wechseljahr[] = wechseljahre(FERIEN, GRUNDWERTE);
const J27 = JAHRE[0];

const kind = (personId: number) => ({
  personId,
  name: `Kind ${personId}`,
  leitung: false,
  status: 'active' as const,
  statusGeaendert: null,
});
const sichtbar = (...mitglieder: ReturnType<typeof kind>[]): GruppenStand => ({
  art: 'sichtbar',
  mitglieder,
});
const DATEN: KjDaten = {
  gruppen: new Map([
    [FISCHE, sichtbar(kind(1), kind(2), kind(3))],
    [JUNGSCHAR, sichtbar(kind(9))],
    [WECHSEL, sichtbar()],
  ]),
  geburtstage: new Map<number, string | null>([
    [1, '2017-09-30'], // am Stichtag 10 → wechselt
    [2, '2017-01-01'], // wechselt
    [3, '2018-01-01'], // bleibt
    [9, '2016-01-01'],
  ]),
};
const sichtenFuer = (e: Einrichtung) =>
  e.einstellung.stufen.flatMap(
    (s) => gruppenSicht(e, s.gruppeId, DATEN, J27, J27.ankuendigung, 'immer') ?? [],
  );

function zeigen(
  o: { bis?: number; admin?: boolean; phase?: Phase; onAbgemeldet?: (e: unknown) => void } = {},
) {
  const e = basis(o.bis);
  return render(
    <Wechseltage
      einrichtung={e}
      jahr={J27}
      jahre={JAHRE}
      ferien={FERIEN}
      phase={o.phase ?? 'ruhig'}
      sichten={sichtenFuer(e)}
      admin={o.admin ?? false}
      tage={wechseltageStand(e.eingetragenBis, J27.jahr)}
      onAbgemeldet={o.onAbgemeldet ?? (() => {})}
    />,
  );
}

beforeEach(() => {
  abgleichLaden.mockReset();
  abgleichLaden.mockResolvedValue({ abweichungen: [], nichtPruefbar: [] });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('Wechseltage: Tabelle', () => {
  it('eine Zeile je Jahr mit Sommerferien, Ankündigung, Wechseltag (mit Wochentag), Stichtag und Status', () => {
    zeigen({ bis: 2028 });
    const tabelle = within(screen.getByRole('table'));
    const zeilen = tabelle.getAllByRole('row').slice(1);
    expect(zeilen).toHaveLength(3);
    const z27 = within(zeilen[0]).getAllByRole('cell');
    expect(z27.map((c) => c.textContent)).toEqual([
      '2027',
      `${tagPunkt('2027-07-19')} – ${tagPunkt('2027-08-31')}`,
      tagPunkt(J27.ankuendigung),
      wechseltagText(J27.wechseltag),
      tagPunkt(J27.stichtag),
      'eingetragen',
    ]);
    expect(within(zeilen[1]).getByText('eingetragen')).toBeTruthy();
    expect(within(zeilen[2]).getByText('fehlt noch')).toBeTruthy();
  });

  it('nur das aktuelle und spätere Jahre – das vergangene Vorjahr steht nicht da', () => {
    const e = basis(2029);
    render(
      <Wechseltage
        einrichtung={e}
        jahr={JAHRE[1]}
        jahre={JAHRE}
        ferien={FERIEN}
        phase="ruhig"
        sichten={sichtenFuer(e)}
        admin={false}
        tage={wechseltageStand(2029, 2028)}
        onAbgemeldet={() => {}}
      />,
    );
    expect(screen.queryByRole('cell', { name: '2027' })).toBeNull();
    expect(screen.getByRole('cell', { name: '2028' })).toBeTruthy();
  });

  it('ohne „eingetragen bis“: „nicht bekannt“ in jeder Zeile und ein ruhiger Hinweis – keine Erinnerung', () => {
    zeigen({});
    expect(screen.getAllByText('nicht bekannt')).toHaveLength(3);
    expect(screen.getByText(/erst, wenn ein Admin „Einrichten“ ausgeführt hat/)).toBeTruthy();
    expect(screen.queryByText(/fehlen bald|fehlen Wechseltage/)).toBeNull();
  });

  it('Tabelle liegt in einer scrollbaren Karte (Handy)', () => {
    zeigen({ bis: 2028 });
    expect(screen.getByRole('table').closest('section')?.className).toMatch(/rahmen/);
  });
});

describe('Wechseltage: Erinnerung „läuft aus“', () => {
  it('nur noch das nächste Jahr eingetragen → gelber Hinweis „fehlen bald“', () => {
    zeigen({ bis: 2027 });
    expect(screen.getByText('Wechseltage fehlen bald.')).toBeTruthy();
    expect(screen.getByText(/nur noch bis 2027/)).toBeTruthy();
    expect(screen.getByText(/Admin Bescheid geben/)).toBeTruthy();
  });

  it('das nächste Jahr schon nicht mehr eingetragen → „Ab 2027 fehlen Wechseltage“', () => {
    zeigen({ bis: 2026 });
    expect(screen.getByText('Ab 2027 fehlen Wechseltage.')).toBeTruthy();
  });

  it('mehr als das nächste Jahr eingetragen → kein Hinweis', () => {
    zeigen({ bis: 2029 });
    expect(screen.queryByText(/fehlen/)).toBeNull();
  });
});

describe('Wechseltage: Leitungen Bescheid geben', () => {
  it('vor der Ankündigung: nur der Satz mit dem Datum, kein Text zum Kopieren', () => {
    zeigen({ bis: 2029, phase: 'ruhig' });
    expect(
      screen.getByText(`Ab der Ankündigung am ${tagPunkt(J27.ankuendigung)} steht hier ein Text`, {
        exact: false,
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Text kopieren' })).toBeNull();
  });

  it('ab der Ankündigung: der Text der reinen Funktion, mit den Zahlen der Übersicht', () => {
    zeigen({ bis: 2029, phase: 'angekuendigt' });
    const feld = screen.getByRole('textbox', { name: 'Text für die Leitungen' });
    expect(feld).toHaveProperty('readOnly', true);
    const erwartet = leitungenNachricht(J27, sichtenFuer(basis(2029)));
    expect((feld as HTMLTextAreaElement).value).toBe(erwartet);
    expect(erwartet).toContain('• Fische → Jungschar: 2 Kinder');
  });

  it('nach dem Wechseltag braucht es keinen Text mehr', () => {
    zeigen({ bis: 2029, phase: 'wechsel' });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText(/keinen Bescheid mehr/)).toBeTruthy();
  });

  it('„Text kopieren“ schreibt genau diesen Text in die Zwischenablage und zeigt „Kopiert“', async () => {
    const schreiben = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: schreiben },
      configurable: true,
    });
    zeigen({ bis: 2029, phase: 'angekuendigt' });
    fireEvent.click(screen.getByRole('button', { name: 'Text kopieren' }));
    await act(async () => {});
    expect(schreiben).toHaveBeenCalledWith(leitungenNachricht(J27, sichtenFuer(basis(2029))));
    expect(screen.getByRole('button', { name: 'Kopiert' })).toBeTruthy();
  });

  it('Zwischenablage verweigert → Text markiert, „Markiert – jetzt kopieren“', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('nein')) },
      configurable: true,
    });
    zeigen({ bis: 2029, phase: 'angekuendigt' });
    fireEvent.click(screen.getByRole('button', { name: 'Text kopieren' }));
    await act(async () => {});
    expect(screen.getByText('Markiert – jetzt kopieren')).toBeTruthy();
    const feld = screen.getByRole<HTMLTextAreaElement>('textbox');
    expect(feld.selectionEnd - feld.selectionStart).toBe(feld.value.length);
    expect(screen.getByRole('button', { name: 'Text kopieren' })).toBeTruthy();
  });
});

describe('Wechseltage: Abgleich mit ChurchTools (nur Admins)', () => {
  const uebergang = uebergaenge(basis().einstellung)[0];
  const fehlend = regelAbweichungen(
    uebergang,
    WECHSEL,
    JAHRE,
    2029,
    wechselGruppenRegeln(
      uebergang,
      JAHRE.filter((j) => j.jahr <= 2028),
      { teilnehmer: 1, leiter: 2 },
    ),
  );

  it('Nicht-Admins: die Regeln werden gar nicht erst abgefragt', () => {
    zeigen({ bis: 2029, admin: false });
    expect(abgleichLaden).not.toHaveBeenCalled();
  });

  it('Admin ohne „eingetragen bis“: nichts zu vergleichen, keine Abfrage', () => {
    zeigen({ admin: true });
    expect(abgleichLaden).not.toHaveBeenCalled();
  });

  it('Admin: fragt mit „eingetragen bis“ und den künftigen Jahren; passt es, steht nichts da', async () => {
    zeigen({ bis: 2029, admin: true });
    await screen.findByRole('table');
    await act(async () => {});
    expect(abgleichLaden).toHaveBeenCalledTimes(1);
    const [e, jahre, bis] = abgleichLaden.mock.calls[0];
    expect(e.eingetragenBis).toBe(2029);
    expect(jahre.map((j) => j.jahr)).toEqual([2027, 2028, 2029]);
    expect(bis).toBe(2029);
    expect(screen.queryByText(/passen nicht/)).toBeNull();
    expect(screen.queryByText(/ließ sich gerade nicht prüfen/)).toBeNull();
  });

  it('Abweichung: gelber Hinweis mit Gruppe und Jahr', async () => {
    expect(fehlend).toHaveLength(1);
    abgleichLaden.mockResolvedValue({ abweichungen: fehlend, nichtPruefbar: [] });
    zeigen({ bis: 2029, admin: true });
    expect(
      await screen.findByText(
        'Die Regeln in ChurchTools passen nicht zu „eingetragen bis 2029“: Fische 7–9 → Jungschar: 2029 fehlt.',
      ),
    ).toBeTruthy();
  });

  it('nicht lesbar (vorübergehend): sagt es, ohne eine Abweichung zu behaupten', async () => {
    abgleichLaden.mockResolvedValue({ abweichungen: [], nichtPruefbar: ['Fische → Jungschar'] });
    zeigen({ bis: 2029, admin: true });
    expect(await screen.findByText(/ließ sich gerade nicht prüfen/)).toBeTruthy();
    expect(screen.getByText(/Fische → Jungschar/, { exact: false })).toBeTruthy();
    expect(screen.queryByText(/passen nicht/)).toBeNull();
  });

  it('unerwarteter Fehler beim Prüfen: „ließ sich gerade nicht prüfen“, die Seite bleibt', async () => {
    abgleichLaden.mockRejectedValue(new TypeError('Failed to fetch'));
    const abgemeldet = vi.fn();
    zeigen({ bis: 2029, admin: true, onAbgemeldet: abgemeldet });
    expect(await screen.findByText(/ließ sich gerade nicht prüfen/)).toBeTruthy();
    expect(abgemeldet).not.toHaveBeenCalled();
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('abgemeldet (401) geht an die ganze Seite', async () => {
    const x = new ApiError(401, 'abgemeldet');
    abgleichLaden.mockRejectedValue(x);
    const abgemeldet = vi.fn();
    zeigen({ bis: 2029, admin: true, onAbgemeldet: abgemeldet });
    await act(async () => {});
    expect(abgemeldet).toHaveBeenCalledWith(x);
  });
});
