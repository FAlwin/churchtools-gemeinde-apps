// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { berechnePreis, euroText, type PreisRegeln } from '@shared/anmeldung/preis';
import * as E from './einrichten';
import { PreisFensterZeigen, PreiseKarte, ProbeRechnen, type PreisFenster } from './Preise';

vi.mock('./einrichten', async (original) => {
  const echt = await original<typeof import('./einrichten')>();
  return { ...echt, aenderePreise: vi.fn() };
});
const m = vi.mocked(E);

/** Die Freizeit aus der Demo: Zimmer, Alter, Frühbucher, Bettwäsche. */
function freizeit(): PreisRegeln {
  return {
    grundpreis: {
      art: 'auswahl',
      betragCent: 0,
      gilt: 'person',
      auswahlName: 'Zimmer',
      optionen: [
        { name: '4-Bett-Zimmer', preisCent: 6552, kontingent: 8, belegt: 3, personenJe: 0 },
        { name: '2-Bett-Zimmer', preisCent: 8900, kontingent: 4, belegt: 1, personenJe: 0 },
      ],
    },
    alter: [
      { von: 0, bis: 2, art: 'frei', wert: 0 },
      { von: 3, bis: 11, art: 'prozent', wert: 50 },
    ],
    anpassungen: [
      {
        art: 'rabatt',
        bezeichnung: 'Frühbucher',
        bedingung: 'fruehbucher',
        bis: '2026-10-31',
        abKind: 2,
        einheit: 'euro',
        wert: 500,
        gilt: 'person',
      },
    ],
    extras: [{ bezeichnung: 'Bettwäsche leihen', preisCent: 800, gilt: 'person' }],
  };
}

function fenster(
  w: PreisFenster,
  mehr: { anmeldungen?: number | null; geburtsdatum?: boolean } = {},
) {
  const gespeichert = vi.fn();
  const wechsel = vi.fn();
  render(
    <PreisFensterZeigen
      id={91}
      fenster={w}
      preis={freizeit()}
      geburtsdatum={mehr.geburtsdatum ?? true}
      anmeldungen={mehr.anmeldungen ?? 0}
      onClose={() => {}}
      onGespeichert={gespeichert}
      onWechsel={wechsel}
    />,
  );
  return { gespeichert, wechsel };
}

/** Was das Fenster an `aenderePreise` gegeben hat – angewandt auf die Preise. */
async function gespeicherteAenderung(): Promise<PreisRegeln> {
  await waitFor(() => expect(m.aenderePreise).toHaveBeenCalled());
  const [id, aendern] = m.aenderePreise.mock.calls[0];
  expect(id).toBe(91);
  return aendern(freizeit());
}

describe('Karte „Preise“ (A4)', () => {
  it('zeigt die Bausteine in Rechenreihenfolge; mit Recht anklickbar', () => {
    const oeffnen = vi.fn();
    render(
      <PreiseKarte
        preis={freizeit()}
        geburtsdatum
        darf
        onOeffnen={oeffnen}
        onGeburtsdatum={() => {}}
      />,
    );
    const karte = screen.getByRole('region', { name: 'Preise' });
    const knoepfe = within(karte).getAllByRole('button');
    const texte = knoepfe.map((k) => k.textContent ?? '');
    [
      /^1Grundpreisnach Auswahl/,
      /^2Nach Alterunter 3/,
      /^3Rabatt: Frühbucher−5,00/,
      /^4Extra: Bettwäsche/,
      /Baustein hinzufügen$/,
    ].forEach((muster, i) => expect(texte[i]).toMatch(muster));
    expect(texte).toHaveLength(5);
    fireEvent.click(knoepfe[2]);
    expect(oeffnen).toHaveBeenCalledWith({ art: 'anpassung', index: 0 });
  });

  it('ohne Recht: lesen ja, klicken und hinzufügen nein', () => {
    render(
      <PreiseKarte
        preis={freizeit()}
        geburtsdatum
        darf={false}
        onOeffnen={() => {}}
        onGeburtsdatum={() => {}}
      />,
    );
    const karte = screen.getByRole('region', { name: 'Preise' });
    expect(within(karte).queryAllByRole('button')).toHaveLength(0);
    expect(within(karte).getByText('Rabatt: Frühbucher')).toBeTruthy();
  });

  it('Preise nach Alter ohne Geburtsdatum → Warnung mit Weg zum Einschalten; mit Geburtsdatum keine', () => {
    const geburt = vi.fn();
    const { unmount } = render(
      <PreiseKarte
        preis={freizeit()}
        geburtsdatum={false}
        darf
        onOeffnen={() => {}}
        onGeburtsdatum={geburt}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Preise nach Alter');
    fireEvent.click(screen.getByRole('button', { name: 'Geburtsdatum abfragen' }));
    expect(geburt).toHaveBeenCalled();
    unmount();
    render(
      <PreiseKarte
        preis={freizeit()}
        geburtsdatum
        darf
        onOeffnen={() => {}}
        onGeburtsdatum={() => {}}
      />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('auch ein Geschwister-Rabatt braucht das Geburtsdatum', () => {
    const p = { ...freizeit(), alter: [] };
    p.anpassungen = [{ ...p.anpassungen[0], bedingung: 'abKind', abKind: 3 }];
    render(
      <PreiseKarte
        preis={p}
        geburtsdatum={false}
        darf
        onOeffnen={() => {}}
        onGeburtsdatum={() => {}}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Geschwister-Rabatt');
  });
});

describe('Preis-Fenster (A4)', () => {
  it('Hinweis bei vorhandenen Anmeldungen (Alwin: Betrag bleibt) – ohne Anmeldungen keiner', () => {
    fenster({ art: 'grund' }, { anmeldungen: 4 });
    expect(screen.getByText(/Es gibt schon 4 Anmeldungen\. Ihr Betrag bleibt/)).toBeTruthy();
  });
  it('… und ohne Anmeldungen kein Hinweis', () => {
    fenster({ art: 'grund' }, { anmeldungen: 0 });
    expect(screen.queryByText(/Es gibt schon/)).toBeNull();
  });

  it('Grundpreis: Komma-Betrag gespeichert, „belegt“ unberührt; kein Betrag → gesperrt mit Hinweis', async () => {
    m.aenderePreise.mockResolvedValue({} as never);
    const { gespeichert } = fenster({ art: 'grund' });
    const preis = screen.getAllByLabelText('Preis €')[1];
    fireEvent.change(preis, { target: { value: '9,5x' } });
    expect(screen.getByText('Bitte einen Betrag eintragen, z. B. 12,50.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveProperty('disabled', true);
    fireEvent.change(preis, { target: { value: '92,50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const neu = await gespeicherteAenderung();
    expect(neu.grundpreis.optionen[1]).toEqual({
      name: '2-Bett-Zimmer',
      preisCent: 9250,
      kontingent: 4,
      belegt: 1,
      personenJe: 0,
    });
    expect(neu.extras).toEqual(freizeit().extras);
    await waitFor(() => expect(gespeichert).toHaveBeenCalled());
  });

  it('Grundpreis: was pruefeRegeln meldet, steht im Fenster und sperrt Speichern', () => {
    fenster({ art: 'grund' });
    fireEvent.change(screen.getByLabelText('Name der Option 1'), { target: { value: '' } });
    expect(screen.getByText('Option 1 hat keinen Namen.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveProperty('disabled', true);
  });

  it('neuer Rabatt kommt ans Ende; Prozent nach dem Wechsel von € geprüft', async () => {
    m.aenderePreise.mockResolvedValue({} as never);
    fenster({ art: 'anpassung', index: null });
    fireEvent.change(screen.getByLabelText('Bezeichnung (steht so in der Mail)'), {
      target: { value: 'Geschwister' },
    });
    fireEvent.change(screen.getByLabelText('Höhe'), { target: { value: '12,50' } });
    fireEvent.click(screen.getByRole('button', { name: '%' }));
    expect(screen.getByText('Bitte eine ganze Zahl eintragen, z. B. 50.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Höhe'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const neu = await gespeicherteAenderung();
    expect(neu.anpassungen).toHaveLength(2);
    expect(neu.anpassungen[1]).toMatchObject({
      art: 'rabatt',
      bezeichnung: 'Geschwister',
      einheit: 'prozent',
      wert: 10,
    });
  });

  it('Extra entfernen: genau dieses', async () => {
    m.aenderePreise.mockResolvedValue({} as never);
    fenster({ art: 'extra', index: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Baustein entfernen' }));
    expect((await gespeicherteAenderung()).extras).toEqual([]);
  });

  it('Alter: Gruppen nach Alter sortiert gespeichert – auch wenn die erste umgestellt wird', async () => {
    m.aenderePreise.mockResolvedValue({} as never);
    fenster({ art: 'alter' });
    // Die erste Gruppe wird zur ältesten: ab 18 Jahren fester Preis.
    fireEvent.change(screen.getAllByLabelText('von Jahren')[0], { target: { value: '18' } });
    fireEvent.change(screen.getAllByLabelText('bis Jahren')[0], { target: { value: '' } });
    fireEvent.change(screen.getAllByLabelText('Preis')[0], { target: { value: 'fest' } });
    fireEvent.change(screen.getByLabelText('Euro'), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Altersgruppe' }));
    fireEvent.change(screen.getAllByLabelText('von Jahren')[2], { target: { value: '12' } });
    fireEvent.change(screen.getAllByLabelText('bis Jahren')[2], { target: { value: '17' } });
    fireEvent.change(screen.getAllByLabelText('Prozent')[1], { target: { value: '75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect((await gespeicherteAenderung()).alter).toEqual([
      { von: 3, bis: 11, art: 'prozent', wert: 50 },
      { von: 12, bis: 17, art: 'prozent', wert: 75 },
      { von: 18, bis: null, art: 'fest', wert: 9900 },
    ]);
  });

  it('Baustein hinzufügen: „Nach Alter“ gibt es schon → gesperrt; Rabatt öffnet das Rabatt-Fenster', () => {
    const { wechsel } = fenster({ art: 'neu' });
    expect(screen.getByRole('button', { name: /Nach Alter/ })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: /Rabatt oder Zuschlag/ }));
    expect(wechsel).toHaveBeenCalledWith({ art: 'anpassung', index: null });
  });
});

describe('Probe rechnen (A4)', () => {
  const gesamt = () =>
    within(screen.getByRole('list', { name: 'Aufschlüsselung' }))
      .getAllByRole('listitem')
      .at(-1)!.textContent;

  it('rechnet mit berechnePreis – dieselbe Rechnung wie das Formular', () => {
    render(<ProbeRechnen preis={freizeit()} wer="familie" geburtsdatum heute="2026-10-13" />);
    const erwartet = berechnePreis(freizeit(), {
      alter: [38, 36, 9, 6],
      option: 0,
      angemeldetAm: '2026-10-13',
      extras: [true],
    });
    expect(gesamt()).toBe(`Gesamt${euroText(erwartet.gesamtCent)}`);
    // Und von Hand: 2 × 65,52 + 2 × 32,76 − 4 × 5,00 + 4 × 8,00 = 208,56 €
    expect(gesamt()).toBe('Gesamt208,56 €');
  });

  it('Zimmer wechseln, Extra abwählen, nach dem Frühbucher-Datum anmelden', () => {
    render(<ProbeRechnen preis={freizeit()} wer="familie" geburtsdatum heute="2026-10-13" />);
    fireEvent.change(screen.getByLabelText('Zimmer'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('Angemeldet am'), { target: { value: '2026-11-01' } });
    const erwartet = berechnePreis(freizeit(), {
      alter: [38, 36, 9, 6],
      option: 1,
      angemeldetAm: '2026-11-01',
      extras: [false],
    });
    expect(gesamt()).toBe(`Gesamt${euroText(erwartet.gesamtCent)}`);
    expect(screen.getByText(/gilt hier nicht: Anmeldung nach dem 31\.10\.2026/)).toBeTruthy();
  });

  it('ohne Geburtsdatum: wie das Formular ohne Alter – alle zahlen den Grundpreis', () => {
    render(
      <ProbeRechnen preis={freizeit()} wer="familie" geburtsdatum={false} heute="2026-10-13" />,
    );
    const erwartet = berechnePreis(freizeit(), {
      alter: [null, null, null, null],
      option: 0,
      angemeldetAm: '2026-10-13',
      extras: [true],
    });
    expect(gesamt()).toBe(`Gesamt${euroText(erwartet.gesamtCent)}`);
    expect(screen.queryByLabelText('Alter Person 1')).toBeNull();
    expect(screen.getByText(/jede Person zahlt den Grundpreis/)).toBeTruthy();
  });

  it('Einzelpersonen: eine Person, keine weitere hinzuzufügen', () => {
    render(<ProbeRechnen preis={freizeit()} wer="einzeln" geburtsdatum heute="2026-10-13" />);
    expect(screen.getAllByLabelText(/Alter Person/)).toHaveLength(1);
    expect(screen.queryByRole('button', { name: '+ Person' })).toBeNull();
  });
});
