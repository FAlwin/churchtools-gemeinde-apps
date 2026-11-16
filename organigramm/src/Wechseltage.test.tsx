// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { tagPunkt } from '@shared/ct/datum';
import {
  GRUNDWERTE,
  sommerferienAus,
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
  wechseltageStand,
  wechseltagText,
} from '@shared/organigramm/wechseltage';
import { Wechseltage } from './Wechseltage';
import type { RegelStand } from './ladeRegelStand';

const FISCHE = 50;
const JUNGSCHAR = 51;
const WECHSEL = 52;

const basis = (): Einrichtung =>
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

/** Regeln, die bis zu diesem Jahr lückenlos eingetragen sind (der Status je Jahr kommt fertig aus dem Loader). */
const regelBis = (bis: number): RegelStand => ({
  art: 'da',
  staende: JAHRE.map((j) => ({
    jahr: j.jahr,
    stand: j.jahr <= bis ? { art: 'eingetragen' } : { art: 'fehlt' },
  })),
  bis,
});

function zeigen(
  o: {
    /** `null` = ohne das Recht (Bereichsleitung): keine Spalte. */
    regel?: Parameters<typeof Wechseltage>[0]['regel'];
    phase?: Phase;
    jahr?: Wechseljahr;
  } = {},
) {
  const e = basis();
  const jahr = o.jahr ?? J27;
  const regel = o.regel === undefined ? null : o.regel;
  return render(
    <Wechseltage
      einrichtung={e}
      jahr={jahr}
      jahre={JAHRE}
      ferien={FERIEN}
      phase={o.phase ?? 'ruhig'}
      sichten={sichtenFuer(e)}
      regel={regel}
      tage={wechseltageStand(regel?.art === 'da' ? regel.bis : undefined, jahr.jahr)}
    />,
  );
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('Wechseltage: Tabelle', () => {
  it('Admin (mit Recht): eine Zeile je Jahr mit Sommerferien, Ankündigung, Wechseltag, Stichtag und Status', () => {
    zeigen({ regel: regelBis(2028) });
    const zeilen = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(zeilen).toHaveLength(3);
    expect(
      within(zeilen[0])
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual([
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

  it('Bereichsleitung ohne das Recht: Ferien und Wechseltage, aber keine Spalte „In den Regeln“ und keine Erinnerung', () => {
    zeigen({ regel: null });
    expect(screen.queryByRole('columnheader', { name: 'In den Regeln' })).toBeNull();
    expect(screen.getAllByRole('columnheader')).toHaveLength(5);
    const z = within(screen.getByRole('table')).getAllByRole('row')[1];
    expect(within(z).getAllByRole('cell')).toHaveLength(5);
    expect(screen.queryByText(/eingetragen|fehlt noch|nicht prüfbar/)).toBeNull();
    expect(screen.queryByText(/fehlen/)).toBeNull();
  });

  it('„unvollständig“ nennt die Übergänge, in denen das Jahr fehlt', () => {
    zeigen({
      regel: {
        art: 'da',
        staende: [
          { jahr: 2027, stand: { art: 'unvollstaendig', fehlend: ['Fische → Jungschar'] } },
          { jahr: 2028, stand: { art: 'fehlt' } },
          { jahr: 2029, stand: { art: 'fehlt' } },
        ],
        bis: 2026,
      },
    });
    expect(screen.getByText('unvollständig – fehlt bei Fische → Jungschar')).toBeTruthy();
  });

  it('wird noch geprüft: „wird geprüft“, noch keine Erinnerung', () => {
    zeigen({ regel: { art: 'laedt' } });
    expect(screen.getAllByText('wird geprüft')).toHaveLength(3);
    expect(screen.queryByText(/fehlen/)).toBeNull();
  });

  it('nur das aktuelle und spätere Jahre – das vergangene Vorjahr steht nicht da', () => {
    zeigen({ jahr: JAHRE[1], regel: regelBis(2029) });
    expect(screen.queryByRole('cell', { name: '2027' })).toBeNull();
    expect(screen.getByRole('cell', { name: '2028' })).toBeTruthy();
  });

  it('Tabelle liegt in einer scrollbaren Karte (Handy)', () => {
    zeigen({ regel: regelBis(2028) });
    expect(screen.getByRole('table').closest('section')?.className).toMatch(/rahmen/);
  });
});

describe('Wechseltage: nicht prüfbar', () => {
  it('Spalte „nicht prüfbar“ und ein ruhiger Hinweis – keine gelbe Erinnerung', () => {
    zeigen({ regel: { art: 'nichtPruefbar' } });
    expect(screen.getAllByText('nicht prüfbar')).toHaveLength(3);
    expect(screen.getByText(/ließ sich gerade nicht prüfen/)).toBeTruthy();
    expect(screen.getByText(/Es wurde nichts verändert/)).toBeTruthy();
    expect(screen.queryByText(/fehlen/)).toBeNull();
  });
});

describe('Wechseltage: Erinnerung „läuft aus“ (nur mit dem Recht)', () => {
  it('Regeln reichen nur noch bis zum nächsten Jahr → gelber Hinweis „fehlen bald“', () => {
    zeigen({ regel: regelBis(2027) });
    expect(screen.getByText('Wechseltage fehlen bald.')).toBeTruthy();
    expect(screen.getByText('Die Regeln reichen nur noch bis 2027.')).toBeTruthy();
  });

  it('das nächste Jahr steht schon nicht in den Regeln → „Ab 2027 fehlen Wechseltage in den Regeln“', () => {
    zeigen({ regel: regelBis(2026) });
    expect(screen.getByText('Ab 2027 fehlen Wechseltage in den Regeln.')).toBeTruthy();
    expect(screen.getByText(/„Schulferien NRW“ – rechtzeitig nachtragen/)).toBeTruthy();
  });

  it('mehr als das nächste Jahr in den Regeln → kein Hinweis', () => {
    zeigen({ regel: regelBis(2029) });
    expect(screen.queryByText(/fehlen/)).toBeNull();
  });

  it('ohne das Recht gibt es nie eine Erinnerung – auch wenn sie nötig wäre', () => {
    zeigen({ regel: null });
    expect(screen.queryByText(/fehlen/)).toBeNull();
  });
});

describe('Wechseltage: „nichts zu tun“ nur, wenn die Regeln reichen', () => {
  const NICHTS = 'nichts zu tun – ChurchTools verschiebt von selbst';
  it('Regeln reichen über das nächste Jahr hinaus → „nichts zu tun“', () => {
    zeigen({ regel: regelBis(2029) });
    expect(screen.getByText(NICHTS)).toBeTruthy();
  });
  it.each([
    ['fehlt', regelBis(2026)],
    ['läuft bald aus', regelBis(2027)],
    ['nicht prüfbar', { art: 'nichtPruefbar' } as const],
    ['wird geprüft', { art: 'laedt' } as const],
    ['ohne das Recht', null],
  ])('%s → kein „nichts zu tun“', (_, regel) => {
    zeigen({ regel });
    expect(screen.queryByText(NICHTS)).toBeNull();
  });
});

describe('Wechseltage: Leitungen Bescheid geben', () => {
  it('vor der Ankündigung: nur der Satz mit dem Datum, kein Text zum Kopieren', () => {
    zeigen({ phase: 'ruhig' });
    expect(
      screen.getByText(`Ab der Ankündigung am ${tagPunkt(J27.ankuendigung)} steht hier ein Text`, {
        exact: false,
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Text kopieren' })).toBeNull();
  });

  it('ab der Ankündigung: der Text der reinen Funktion, mit den Zahlen der Übersicht', () => {
    zeigen({ phase: 'angekuendigt' });
    const feld = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Text für die Leitungen',
    });
    expect(feld).toHaveProperty('readOnly', true);
    const erwartet = leitungenNachricht(J27, sichtenFuer(basis()));
    expect(feld.value).toBe(erwartet);
    expect(erwartet).toContain('• Fische → Jungschar: 2 Kinder');
  });

  it('nach dem Wechseltag braucht es keinen Text mehr', () => {
    zeigen({ phase: 'wechsel' });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText(/keinen Bescheid mehr/)).toBeTruthy();
  });

  it('„Text kopieren“ schreibt genau diesen Text in die Zwischenablage und zeigt „Kopiert“', async () => {
    const schreiben = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: schreiben },
      configurable: true,
    });
    zeigen({ phase: 'angekuendigt' });
    fireEvent.click(screen.getByRole('button', { name: 'Text kopieren' }));
    await act(async () => {});
    expect(schreiben).toHaveBeenCalledWith(leitungenNachricht(J27, sichtenFuer(basis())));
    expect(screen.getByRole('button', { name: 'Kopiert' })).toBeTruthy();
  });

  it('Zwischenablage verweigert → Text markiert, „Markiert – jetzt kopieren“', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('nein')) },
      configurable: true,
    });
    zeigen({ phase: 'angekuendigt' });
    fireEvent.click(screen.getByRole('button', { name: 'Text kopieren' }));
    await act(async () => {});
    expect(screen.getByText('Markiert – jetzt kopieren')).toBeTruthy();
    const feld = screen.getByRole<HTMLTextAreaElement>('textbox');
    expect(feld.selectionEnd - feld.selectionStart).toBe(feld.value.length);
    expect(screen.getByRole('button', { name: 'Text kopieren' })).toBeTruthy();
  });
});
