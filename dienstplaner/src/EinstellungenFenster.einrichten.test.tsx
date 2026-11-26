// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import { STANDARD_BETRIEBSART } from '@shared/ct/liveAgenda';
import type { AbfragenInhalt } from '@shared/dienstplan/abfragen';
import { standardInhalt, type AbfragenStand } from '@shared/dienstplan/abfragenSpeicher';
import { EinstellungenFenster } from './EinstellungenFenster';
import type { Lage, Lauf, EinrichtenAnschluss } from './einrichtenAbfragen';

vi.mock('./einrichtenAbfragen', async (original) => ({
  ...(await original<typeof import('./einrichtenAbfragen')>()),
  lageLesen: vi.fn(),
  einrichten: vi.fn(),
}));
import * as schreiben from './einrichtenAbfragen';

/**
 * **Kasten „In ChurchTools“ und Fenster „Einrichten“** (R-5a). Das Schreiben prüft `einrichtenAbfragen.test.ts`; hier geht es
 * um die Oberfläche: wer was sieht, was das Fenster VOR dem Klick sagt, und dass ein Lesefehler nie zu „Einrichten …“ führt.
 */
const MUSIK: Dienstgruppe = { id: 4, name: 'Musik', fuerAlle: false };
const ICH = { personId: 1, name: 'Alwin' };
const GNAME = 'Dienstplaner: Antwort fehlt – Musik';

const stand = (
  inhalt: AbfragenInhalt = standardInhalt(),
  extra: Partial<AbfragenStand> = {},
): AbfragenStand => ({
  inhalt,
  gespeichert: null,
  unlesbar: false,
  fehler: null,
  ...extra,
});
const EINGERICHTET: AbfragenInhalt = {
  ...standardInhalt(),
  einrichtung: { gruppeId: 5, routineId: 6 },
};

const person = (id: number, name: string) => ({ id, name });
const lage = (teil: Partial<Lage> = {}): Lage => ({
  art: 'bereit',
  stand: stand(),
  typId: 13,
  rollen: { teilnehmer: 52 },
  gruppenRechtIds: { sehen: 1104, bearbeiten: 1112 },
  gruppeName: GNAME,
  routineName: 'Dienstplaner: Erinnerungen Musik',
  gruppeId: null,
  verschwunden: false,
  uebernommen: false,
  routineId: null,
  routineAus: false,
  planer: [person(1, 'Alwin Friesen'), person(2, 'Bea Beispiel')],
  rechteNachtragen: [person(1, 'Alwin Friesen'), person(2, 'Bea Beispiel')].map((p) => ({
    person: p,
    fehlt: [
      { schluessel: 'sehen' as const, name: 'Gruppe inkl. ihrer Gruppenmitglieder sehen' },
      {
        schluessel: 'bearbeiten' as const,
        name: 'Gruppenmitgliedschaften einer Gruppe bearbeiten',
      },
    ],
  })),
  ablage: null,
  plan: {
    gruppeAnlegen: true,
    routineAnlegen: true,
    einrichtungSchreiben: true,
    rechteNachtragen: [
      { personId: 1, fehlt: ['sehen', 'bearbeiten'] },
      { personId: 2, fehlt: ['sehen', 'bearbeiten'] },
    ],
    nichtsZuTun: false,
  },
  fertig: false,
  ...teil,
});

function zeige(
  o: {
    darf?: boolean;
    inhalt?: AbfragenInhalt;
    stand?: AbfragenStand;
    ohneEinrichten?: boolean;
  } = {},
) {
  const lesen = vi.fn(() => Promise.resolve(o.stand ?? stand(o.inhalt)));
  const speichern = vi.fn();
  const anschluss = { port: {} } as EinrichtenAnschluss;
  const gruppenIds = vi.fn(() => [21]);
  render(
    <EinstellungenFenster
      darfAendern
      ich={ICH}
      abfragen={{
        anschluss: { lesen, speichern, ich: ICH },
        gruppen: [MUSIK],
        heute: '2026-12-01',
        ...(o.ohneEinrichten
          ? {}
          : { einrichten: { darf: o.darf ?? true, anschluss, gruppenIds } }),
      }}
      onSchliessen={() => {}}
      lesen={() =>
        Promise.resolve({
          betriebsart: STANDARD_BETRIEBSART,
          gespeichert: null,
          unlesbar: false,
          fehler: null,
        })
      }
    />,
  );
  return { lesen, gruppenIds, anschluss };
}
const kasten = () => screen.findByRole('group', { name: 'In ChurchTools' });

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('Kasten „In ChurchTools“', () => {
  it('nicht eingerichtet, Admin: Satz zum Warum – mit den zwei Rechten der Planer, kein Leiter – und „Einrichten …“', async () => {
    zeige({ darf: true });
    const k = await kasten();
    expect(
      within(k).getByText(
        /„Gruppe inkl. ihrer Gruppenmitglieder sehen“ und „Gruppenmitgliedschaften einer Gruppe bearbeiten“/,
      ),
    ).toBeTruthy();
    expect(k.textContent).not.toMatch(/Leiter der Gruppe|als Leiter/);
    expect(
      within(k).getByText(
        /legt der Dienstplaner in ChurchTools eine Hilfsgruppe mit einer Routine an/,
      ),
    ).toBeTruthy();
    expect(within(k).getByRole('button', { name: 'Einrichten …' })).toBeTruthy();
    expect(within(k).queryByText('eingerichtet')).toBeNull();
    expect(within(k).queryByText(/Bitte einen Admin/)).toBeNull();
  });

  it('nicht eingerichtet, kein Admin: „Bitte einen Admin …“, kein Knopf', async () => {
    zeige({ darf: false });
    const k = await kasten();
    expect(within(k).getByText('Bitte einen Admin, die Erinnerungen einzurichten.')).toBeTruthy();
    expect(within(k).queryByRole('button', { name: /Einrichten/ })).toBeNull();
  });

  it('ohne Anschluss zum Einrichten (z. B. kein Admin-Zugang) gilt „kein Admin“', async () => {
    zeige({ ohneEinrichten: true });
    const k = await kasten();
    expect(within(k).getByText(/Bitte einen Admin/)).toBeTruthy();
  });

  it('eingerichtet: grünes Etikett, Satz mit Gruppenname, „Was ist das?“ klappt die Erklärung auf', async () => {
    zeige({ inhalt: EINGERICHTET });
    const k = await kasten();
    expect(within(k).getByText('eingerichtet')).toBeTruthy();
    expect(
      within(k).getByText(`Gruppe „${GNAME}“ mit einer Routine, die diesen Plan verschickt.`),
    ).toBeTruthy();
    expect(within(k).queryByText(/Meine Gruppen/)).toBeNull();
    fireEvent.click(within(k).getByRole('button', { name: 'Was ist das?' }));
    expect(within(k).getByText(/Meine Gruppen/)).toBeTruthy();
    fireEvent.click(within(k).getByRole('button', { name: 'Erklärung verbergen' }));
    expect(within(k).queryByText(/Meine Gruppen/)).toBeNull();
  });

  it('eingerichtet: die Hinweise „noch nicht eingerichtet“ sind weg – und es steht nichts Falsches da', async () => {
    zeige({ inhalt: EINGERICHTET });
    await kasten();
    expect(screen.queryByText(/noch nicht eingerichtet/)).toBeNull();
    expect(
      screen.getByText(
        'Erinnerungen verschickt ChurchTools gegen 0:15 Uhr an alle, die dann noch offen sind.',
      ),
    ).toBeTruthy();
  });

  it('eingerichtet, Admin: „Planer prüfen …“ öffnet das Fenster (zum Nachtragen der Rechte)', async () => {
    vi.mocked(schreiben.lageLesen).mockResolvedValue(lage({ fertig: true }));
    const { gruppenIds } = zeige({ inhalt: EINGERICHTET });
    fireEvent.click(await screen.findByRole('button', { name: 'Planer prüfen …' }));
    await screen.findByRole('dialog', { name: 'Erinnerungen für Musik einrichten' });
    expect(gruppenIds).toHaveBeenCalledWith(4);
  });

  it('Lesefehler: weder „nicht eingerichtet“ noch „Einrichten …“ – sonst droht eine doppelte Einrichtung', async () => {
    zeige({ stand: stand(standardInhalt(), { fehler: 'voruebergehend' }) });
    await screen.findByRole('region', { name: 'Verfügbarkeit & Erinnerungen' });
    await screen.findByText(/lassen sich so nicht ändern/);
    expect(screen.queryByRole('group', { name: 'In ChurchTools' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Einrichten/ })).toBeNull();
  });

  it('unlesbarer Wert (neuere Fassung): ebenfalls kein Einrichten', async () => {
    zeige({ stand: stand(standardInhalt(), { unlesbar: true }) });
    await screen.findByText(/lassen sich so nicht ändern/);
    expect(screen.queryByRole('button', { name: /Einrichten/ })).toBeNull();
  });

  it('ungespeicherte Änderungen am Plan sperren „Einrichten …“ (beides schreibt dasselbe Dokument)', async () => {
    zeige();
    const k = await kasten();
    fireEvent.click(screen.getAllByRole('button', { name: 'Erinnerung entfernen' })[0]);
    expect(
      within(k).getByRole<HTMLButtonElement>('button', { name: 'Einrichten …' }).disabled,
    ).toBe(true);
    expect(within(k).getByText('Erst speichern, dann einrichten.')).toBeTruthy();
  });
});

describe('Fenster „Erinnerungen für Musik einrichten“', () => {
  const oeffnen = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Einrichten …' }));
    return screen.findByRole('dialog', { name: 'Erinnerungen für Musik einrichten' });
  };

  it('sagt VOR dem Klick: Gruppe (Typ, ohne Obergruppe), Routine, die Planer mit Namen und genau die zwei Rechte (nur für diese Gruppe), was Mitarbeitende sehen', async () => {
    vi.mocked(schreiben.lageLesen).mockResolvedValue(lage());
    zeige();
    const f = await oeffnen();
    await within(f).findAllByText(/Gruppe „Dienstplaner: Antwort fehlt – Musik“/);
    const text = f.textContent ?? '';
    expect(text).toContain('Gruppentyp „Dienstplaner“, ohne Obergruppe');
    expect(text).toContain('wird angelegt');
    expect(text).toContain('Dienstplaner: Erinnerungen Musik');
    expect(text).toContain('werden gesetzt bei: Alwin Friesen, Bea Beispiel');
    expect(text).toContain(`nur für die Gruppe „${GNAME}“`);
    expect(text).toContain('„Gruppe inkl. ihrer Gruppenmitglieder sehen“');
    expect(text).toContain('„Gruppenmitgliedschaften einer Gruppe bearbeiten“');
    expect(text).not.toContain('Leiter der Gruppe');
    expect(text).toContain('Meine Gruppen');
    expect(text).toContain('austreten');
    expect(text).toContain('Alles lässt sich in ChurchTools ansehen.');
    // Vor dem Klick wird nichts geschrieben.
    expect(schreiben.einrichten).not.toHaveBeenCalled();
    expect(within(f).getByRole('button', { name: 'Einrichten' })).toBeTruthy();
  });

  it('der Text nennt den Reiter nicht neu „Verfügbarkeit“', async () => {
    vi.mocked(schreiben.lageLesen).mockResolvedValue(lage());
    zeige();
    const f = await oeffnen();
    await within(f).findAllByText(/Gruppe „/);
    expect(f.textContent).not.toContain('Verfügbarkeit');
  });

  it('Klick auf „Einrichten“ ruft einrichten und zeigt, was angelegt wurde – und liest das Dokument neu', async () => {
    vi.mocked(schreiben.lageLesen).mockResolvedValue(lage());
    const lauf: Lauf = {
      art: 'gelaufen',
      ok: true,
      angelegt: ['Gruppe „x“ angelegt (Nr. 5)', 'Routine „y“ angelegt'],
      hinweise: [],
      fehler: null,
    };
    vi.mocked(schreiben.einrichten).mockResolvedValue(lauf);
    const { lesen } = zeige();
    const f = await oeffnen();
    const vorher = lesen.mock.calls.length;
    fireEvent.click(await within(f).findByRole('button', { name: 'Einrichten' }));
    await within(f).findByText(/sind eingerichtet/);
    expect(within(f).getByText('Gruppe „x“ angelegt (Nr. 5)')).toBeTruthy();
    expect(within(f).getByText('Routine „y“ angelegt')).toBeTruthy();
    expect(schreiben.einrichten).toHaveBeenCalledTimes(1);
    expect(schreiben.einrichten).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4, name: 'Musik' }),
      [21],
      expect.anything(),
    );
    expect(lesen.mock.calls.length).toBeGreaterThan(vorher);
    expect(within(f).getByRole('button', { name: 'Fertig' })).toBeTruthy();
  });

  it('Fehler mitten drin: der Text nennt, was schon angelegt ist; „Nochmal versuchen“ ist ein Klick, nichts läuft von selbst', async () => {
    vi.mocked(schreiben.lageLesen).mockResolvedValue(lage());
    vi.mocked(schreiben.einrichten).mockResolvedValue({
      art: 'gelaufen',
      ok: false,
      angelegt: ['Gruppe „x“ angelegt (Nr. 5)'],
      hinweise: [],
      fehler: { text: 'ChurchTools antwortet gerade nicht.', nochmal: true },
    });
    zeige();
    const f = await oeffnen();
    fireEvent.click(await within(f).findByRole('button', { name: 'Einrichten' }));
    await within(f).findByText(/ChurchTools antwortet gerade nicht\. Schon angelegt:/);
    expect(within(f).getByText('Gruppe „x“ angelegt (Nr. 5)')).toBeTruthy();
    expect(schreiben.einrichten).toHaveBeenCalledTimes(1);
    fireEvent.click(within(f).getByRole('button', { name: 'Nochmal versuchen' }));
    await vi.waitFor(() => expect(schreiben.einrichten).toHaveBeenCalledTimes(2));
  });

  it('schon eingerichtet, Rechte fehlen: der Knopf heißt „Rechte nachtragen“', async () => {
    vi.mocked(schreiben.lageLesen).mockResolvedValue(
      lage({
        gruppeId: 5,
        routineId: 6,
        rechteNachtragen: [
          {
            person: person(2, 'Bea Beispiel'),
            fehlt: [
              { schluessel: 'bearbeiten', name: 'Gruppenmitgliedschaften einer Gruppe bearbeiten' },
            ],
          },
        ],
        plan: {
          gruppeAnlegen: false,
          routineAnlegen: false,
          einrichtungSchreiben: false,
          rechteNachtragen: [{ personId: 2, fehlt: ['bearbeiten'] }],
          nichtsZuTun: false,
        },
      }),
    );
    zeige({ inhalt: EINGERICHTET });
    fireEvent.click(await screen.findByRole('button', { name: 'Planer prüfen …' }));
    const f = await screen.findByRole('dialog', { name: 'Erinnerungen für Musik einrichten' });
    expect(await within(f).findByRole('button', { name: 'Rechte nachtragen' })).toBeTruthy();
    expect(f.textContent).toContain('noch nicht gesetzt bei: Bea Beispiel');
  });

  it('V-4: nennt VOR dem Klick die Ablage „Antworten Musik“ als eigene Zeile – „wird angelegt“, „schon da“, „nicht ganz freigegeben“', async () => {
    vi.mocked(schreiben.lageLesen).mockResolvedValue(
      lage({ ablage: { name: 'Antworten Musik', stand: 'einrichtbar', anlegen: true } }),
    );
    zeige();
    let f = await oeffnen();
    await within(f).findAllByText(/Ablage „Antworten Musik“/);
    expect(f.textContent).toMatch(/Ablage „Antworten Musik“ – wird angelegt\./);
    expect(f.textContent).toContain('Ohne sie geht „Fertig“ nicht');
    cleanup();
    vi.mocked(schreiben.lageLesen).mockResolvedValue(
      lage({ ablage: { name: 'Antworten Musik', stand: 'bereit', anlegen: false } }),
    );
    zeige();
    f = await oeffnen();
    await within(f).findAllByText(/Ablage „Antworten Musik“/);
    expect(f.textContent).toMatch(/Ablage „Antworten Musik“ – schon da\./);
    cleanup();
    vi.mocked(schreiben.lageLesen).mockResolvedValue(
      lage({ ablage: { name: 'Antworten Musik', stand: 'nur-lesen', anlegen: false } }),
    );
    zeige();
    f = await oeffnen();
    await within(f).findAllByText(/Ablage „Antworten Musik“/);
    expect(f.textContent).toContain('steht da, ist aber nicht ganz freigegeben');
    expect(f.textContent).toContain('bitte in ChurchTools freigeben');
  });

  it('V-4: ohne Anschluss an die Ablage (ablage null) gibt es die Zeile nicht', async () => {
    vi.mocked(schreiben.lageLesen).mockResolvedValue(lage());
    zeige();
    const f = await oeffnen();
    await within(f).findAllByText(/Gruppe „Dienstplaner: Antwort fehlt – Musik“/);
    expect(f.textContent).not.toContain('Ablage „');
  });

  it('V-4: fehlt nur die Ablage (alles andere steht), heißt der Knopf „Einrichten“, nicht „Rechte nachtragen“', async () => {
    vi.mocked(schreiben.lageLesen).mockResolvedValue(
      lage({
        gruppeId: 5,
        routineId: 6,
        rechteNachtragen: [],
        ablage: { name: 'Antworten Musik', stand: 'einrichtbar', anlegen: true },
        plan: {
          gruppeAnlegen: false,
          routineAnlegen: false,
          einrichtungSchreiben: false,
          rechteNachtragen: [],
          nichtsZuTun: true,
        },
      }),
    );
    zeige({ inhalt: EINGERICHTET });
    fireEvent.click(await screen.findByRole('button', { name: 'Planer prüfen …' }));
    const f = await screen.findByRole('dialog', { name: 'Erinnerungen für Musik einrichten' });
    expect(await within(f).findByRole('button', { name: 'Einrichten' })).toBeTruthy();
    expect(within(f).queryByRole('button', { name: 'Rechte nachtragen' })).toBeNull();
  });

  it('Gruppentyp fehlt: der Grund steht da, kein „Einrichten“', async () => {
    vi.mocked(schreiben.lageLesen).mockResolvedValue({
      art: 'gestoppt',
      text: 'Der Gruppentyp „Dienstplaner“ fehlt in ChurchTools – siehe Anleitung. Es wurde nichts angelegt.',
      nochmal: false,
    });
    zeige();
    const f = await oeffnen();
    await within(f).findByText(/siehe Anleitung/);
    expect(within(f).queryByRole('button', { name: 'Einrichten' })).toBeNull();
  });
});
