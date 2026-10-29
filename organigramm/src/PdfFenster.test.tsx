// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { jsPDF } from 'jspdf';
import { anfangsOffen } from '@shared/organigramm/ansichten';
import type { Knoten } from '@shared/organigramm/gruppen';
import { svgSeitenPdf } from '@ui/teilen/svgSeitenPdf';
import { downloadPdf, oeffnePdf } from '@ui/teilen/sharePdf';
import { ladeGemeindeLogo } from '@ui/ct/logo';
import { rollenAus } from '@shared/organigramm/mitglieder';
import type { MitgliederDaten } from './ladeMitglieder';
import { PdfFenster } from './PdfFenster';

// jsdom hat keine Zeichenfläche zum Messen – geschätzt wie im Browser ohne Canvas.
vi.mock('./textBreite', () => ({ textBreite: (t: string) => t.length * 8 }));
// Die PDF entsteht im Browser – hier zählt, AUS WELCHEN Seiten.
vi.mock('@ui/teilen/svgSeitenPdf', () => ({ svgSeitenPdf: vi.fn() }));
vi.mock('@ui/teilen/sharePdf', () => ({ downloadPdf: vi.fn(), oeffnePdf: vi.fn() }));
vi.mock('@ui/ct/logo', () => ({ ladeGemeindeLogo: vi.fn() }));
const bauen = vi.mocked(svgSeitenPdf);
const logo = vi.mocked(ladeGemeindeLogo);

const g = (id: number, name: string, kinder: Knoten[] = []): Knoten => ({
  gruppe: { id, name, typId: 2, statusId: 1, farbe: null },
  kinder,
});
const BAUM = [
  g(10, 'Gottesdienst', [g(7, 'Technik', [g(12, 'Stream'), g(15, 'Ton')]), g(8, 'Predigt')]),
  g(47, 'Café'),
];
/** Viele Gruppen – die Liste läuft über mehrere Seiten, „von oben“ wird winzig. */
const VIEL = [
  g(
    1,
    'Gottesdienst',
    Array.from({ length: 70 }, (_, i) => g(100 + i, `Gruppe ${i + 1}`)),
  ),
];

// Rollen eines Dienstes wie gemessen (Test-Instanz 29.10.2026): Mitarbeiter ist die Standardrolle.
const ROLLEN = rollenAus([
  { id: 15, name: 'Mitarbeiter', isLeader: false, sortKey: 0, groupTypeId: 2, isDefault: true },
  { id: 16, name: 'Leiter', isLeader: true, sortKey: 1, groupTypeId: 2 },
]);
const MITGLIEDER: MitgliederDaten = {
  je: new Map([
    [
      7,
      {
        art: 'sichtbar',
        mitglieder: [
          { personId: 1, rolleId: 16 },
          { personId: 2, rolleId: 15 },
          { personId: 3, rolleId: 15 },
        ],
        angefragt: [],
      },
    ],
    [12, { art: 'verborgen' }],
  ]),
  personen: new Map(
    (
      [
        [1, 'Alwin Friesen'],
        [2, 'Bea Berg'],
        [3, 'Carl Clau'],
      ] as const
    ).map(([id, name]) => [id, { id, name, bild: null, initialen: name[0] }]),
  ),
};

const PDF = { name: 'pdf' } as unknown as jsPDF;
const HEUTE = new Date(2026, 9, 28);

beforeEach(() => {
  bauen.mockResolvedValue(PDF);
  logo.mockResolvedValue(null);
});
afterEach(() => {
  bauen.mockReset();
  logo.mockReset();
  vi.mocked(downloadPdf).mockClear();
  vi.mocked(oeffnePdf).mockClear();
});

async function zeigen(extra: Partial<Parameters<typeof PdfFenster>[0]> = {}) {
  const onSchliessen = vi.fn();
  const r = render(
    <PdfFenster
      baum={BAUM}
      gemeinde="ECG"
      offen={anfangsOffen(BAUM)}
      spitze={null}
      ansicht="karten"
      personen={{ wahl: 'aus', mitglieder: MITGLIEDER, rollen: ROLLEN }}
      onSchliessen={onSchliessen}
      heute={HEUTE}
      {...extra}
    />,
  );
  await act(async () => {});
  return { onSchliessen, ...r };
}
const vorschau = () => screen.getByRole('figure', { name: 'Vorschau' });
const auswahl = (name: string) => screen.getByLabelText<HTMLSelectElement>(name);
const seiten = () => within(vorschau()).getAllByRole('img', { hidden: true });
const knopf = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });
const letzteSeiten = () => bauen.mock.calls[bauen.mock.calls.length - 1][0];

describe('Organigramm als PDF (O7b-4)', () => {
  it('übernimmt den Reiter – aus Karten wird „von oben“ –, Papier passend, anfangs alles aufgeklappt', async () => {
    await zeigen();
    expect(auswahl('Ansicht').value).toBe('oben');
    expect(auswahl('Ausschnitt').value).toBe('');
    expect(auswahl('Papier').value).toBe('passend');
    const [s] = seiten();
    expect(s.getAttribute('aria-label')).toBe('Organigramm · ECG, Seite 1 von 1');
    expect(s.textContent).toContain('Stand 28.10.2026');
    expect(s.textContent).toContain('ECG · Organigramm aus ChurchTools');
    // Technik ist im Reiter zu – „alles aufgeklappt“ zeigt Stream trotzdem.
    expect(s.textContent).toContain('Stream');
    // Auf Papier gibt es nichts zu klappen und nichts zu klicken.
    expect(s.querySelectorAll('circle')).toHaveLength(0);
    // … aber die Linie führt bis ans Kästchen: 6 Kanten (eine je Untergruppe) und 3 Stücke an den Stellen der +/−
    // (Gemeinde, Gottesdienst, Technik).
    expect(s.querySelectorAll('path')).toHaveLength(9);
    expect(within(vorschau()).queryAllByRole('button')).toHaveLength(0);
    expect(
      screen.getByText(/^Passend gewählt: A4 quer\. Schrift im Diagramm etwa 11 pt\.$/),
    ).toBeTruthy();
  });

  it('die PDF entsteht gleich – aus genau den Seiten der Vorschau, im Format des Papiers', async () => {
    await zeigen();
    expect(bauen).toHaveBeenCalled();
    const [s] = seiten();
    expect(letzteSeiten()).toEqual([{ svg: s, breite: 297, hoehe: 210 }]);
    expect(bauen.mock.calls[bauen.mock.calls.length - 1][1]).toEqual({
      titel: 'Organigramm – ECG',
      thema: 'Stand 28.10.2026',
    });
    fireEvent.change(auswahl('Papier'), { target: { value: 'a3-hoch' } });
    await act(async () => {});
    expect(letzteSeiten()).toEqual([{ svg: seiten()[0], breite: 297, hoehe: 420 }]);
  });

  it('Herunterladen und Öffnen erst, wenn die PDF fertig ist – dann mit Dateinamen zum Ausschnitt', async () => {
    let fertig: (d: jsPDF) => void = () => {};
    bauen.mockImplementation(() => new Promise((r) => (fertig = r)));
    await zeigen({ spitze: '10' });
    expect(knopf('PDF wird erstellt …').disabled).toBe(true);
    expect(knopf('Herunterladen').disabled).toBe(true);
    await act(async () => fertig(PDF));
    fireEvent.click(knopf('PDF öffnen'));
    expect(oeffnePdf).toHaveBeenCalledWith(PDF, 'Organigramm-Gottesdienst-2026-10-28.pdf');
    fireEvent.click(knopf('Herunterladen'));
    expect(downloadPdf).toHaveBeenCalledWith(PDF, 'Organigramm-Gottesdienst-2026-10-28.pdf');
  });

  it('wer während des Bauens umschaltet, bekommt die PDF zur NEUEN Wahl – die alte wird verworfen', async () => {
    const offen: ((d: jsPDF) => void)[] = [];
    bauen.mockImplementation(() => new Promise((r) => offen.push(r)));
    await zeigen();
    fireEvent.change(auswahl('Ansicht'), { target: { value: 'mindmap' } });
    await act(async () => {});
    const alt = { name: 'alt' } as unknown as jsPDF;
    const neu = { name: 'neu' } as unknown as jsPDF;
    await act(async () => offen[0](alt));
    expect(knopf('PDF wird erstellt …').disabled).toBe(true);
    await act(async () => offen[offen.length - 1](neu));
    fireEvent.click(knopf('PDF öffnen'));
    expect(oeffnePdf).toHaveBeenCalledWith(neu, expect.any(String));
  });

  it('ohne „alles aufgeklappt“ wie im Reiter; Ausschnitt und Liste wirken auf die Vorschau', async () => {
    await zeigen({ ansicht: 'mindmap' });
    expect(auswahl('Ansicht').value).toBe('mindmap');
    fireEvent.click(screen.getByLabelText('Alles aufgeklappt'));
    expect(vorschau().textContent).not.toContain('Stream');
    fireEvent.change(auswahl('Ausschnitt'), { target: { value: '10' } });
    expect(seiten()[0].getAttribute('aria-label')).toBe(
      'Organigramm · ECG · Gottesdienst, Seite 1 von 1',
    );
    expect(vorschau().textContent).not.toContain('Café');
    fireEvent.change(auswahl('Ansicht'), { target: { value: 'liste' } });
    expect(vorschau().querySelector('rect[rx]')).toBeNull();
    expect(vorschau().textContent).toContain('Predigt');
    await act(async () => {});
    expect(letzteSeiten()[0]).toMatchObject({ breite: 210, hoehe: 297 });
  });

  it('eine lange Liste läuft über Seiten: alle in die PDF, in der Vorschau zum Blättern', async () => {
    await zeigen({ baum: VIEL, offen: anfangsOffen(VIEL), ansicht: 'liste' });
    const alle = seiten();
    expect(alle.length).toBeGreaterThan(1);
    expect(screen.getByText(`Die Liste läuft über ${alle.length} Seiten.`)).toBeTruthy();
    expect(letzteSeiten().map((s) => s.svg)).toEqual(alle);
    expect(alle[0].getAttribute('aria-label')).toContain(`Seite 1 von ${alle.length}`);
    // Gezeigt wird eine Seite; die anderen sind da, aber verborgen.
    const sichtbar = () => alle.filter((s) => !s.getAttribute('class')!.includes('verborgen'));
    expect(sichtbar()).toEqual([alle[0]]);
    expect(knopf('Vorige Seite').disabled).toBe(true);
    fireEvent.click(knopf('Nächste Seite'));
    expect(sichtbar()).toEqual([alle[1]]);
    // Die Anzeige unter der Vorschau – nicht der Fuß der Seite, der dasselbe sagt.
    expect(screen.getAllByText(`Seite 2 von ${alle.length}`).some((e) => !e.closest('svg'))).toBe(
      true,
    );
  });

  it('wird die Schrift zu klein, rät das Fenster zu A3 oder einem Ausschnitt', async () => {
    await zeigen({ baum: VIEL, offen: anfangsOffen(VIEL), ansicht: 'oben' });
    expect(screen.getByText(/Die Schrift wird sehr klein .* Besser A3 wählen/)).toBeTruthy();
  });

  it('das Logo der Gemeinde steht oben links – abwählbar; ohne Logo gibt es die Wahl nicht', async () => {
    logo.mockResolvedValue('data:image/png;base64,AAAA');
    await zeigen();
    expect(seiten()[0].querySelector('image')!.getAttribute('href')).toBe(
      'data:image/png;base64,AAAA',
    );
    fireEvent.click(screen.getByLabelText('Logo der Gemeinde'));
    expect(seiten()[0].querySelector('image')).toBeNull();
  });

  it('lädt das Logo nicht, steht das Blatt ohne da – ohne Meldung', async () => {
    logo.mockRejectedValue(new Error('offline'));
    await zeigen();
    expect(screen.queryByLabelText('Logo der Gemeinde')).toBeNull();
    expect(seiten()[0].querySelector('image')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('lässt sich die PDF nicht erstellen: Meldung, und „Noch einmal versuchen“ baut neu', async () => {
    bauen.mockRejectedValueOnce(new Error('kaputt'));
    await zeigen();
    expect(screen.getByRole('alert').textContent).toContain('nicht erstellen');
    const vorher = bauen.mock.calls.length;
    fireEvent.click(knopf('Noch einmal versuchen'));
    await act(async () => {});
    expect(bauen.mock.calls.length).toBe(vorher + 1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(knopf('PDF öffnen').disabled).toBe(false);
  });

  it('Personen (O7b-6b): Häkchen an, wenn der Reiter Personen zeigt – mit dessen Stufe, in Diagramm und Liste', async () => {
    await zeigen({ personen: { wahl: 'alle', mitglieder: MITGLIEDER, rollen: ROLLEN } });
    expect(screen.getByLabelText<HTMLInputElement>('Personen').checked).toBe(true);
    expect(vorschau().textContent).toContain('LEITER');
    expect(vorschau().textContent).toContain('Bea Berg');
    expect(vorschau().textContent).toContain('Mitglieder nicht sichtbar');
    // Die Kästchen werden höher – und genau diese Seiten gehen in die PDF.
    const technik = [...vorschau().querySelectorAll('g')].find(
      (x) => x.querySelector('title')?.textContent === 'Technik',
    );
    expect(Number(technik?.querySelector('rect')?.getAttribute('height'))).toBeGreaterThan(36);
    await act(async () => {});
    expect(letzteSeiten()[0].svg.textContent).toContain('Bea Berg');
    fireEvent.change(auswahl('Ansicht'), { target: { value: 'liste' } });
    expect(vorschau().textContent).toContain('MITARBEITER');
    expect(vorschau().textContent).toContain('Carl Clau');
    fireEvent.click(screen.getByLabelText('Personen'));
    expect(vorschau().textContent).not.toContain('Bea Berg');
    expect(vorschau().textContent).not.toContain('LEITER');
  });

  it('steht der Reiter auf „Aus“, ist das Häkchen aus – angehakt zeigt es die Rollen, die Standardrolle als Zahl', async () => {
    await zeigen();
    expect(screen.getByLabelText<HTMLInputElement>('Personen').checked).toBe(false);
    expect(vorschau().textContent).not.toContain('LEITER');
    fireEvent.click(screen.getByLabelText('Personen'));
    expect(vorschau().textContent).toContain('Alwin Friesen');
    expect(vorschau().textContent).toContain('2 Mitarbeiter');
    expect(vorschau().textContent).not.toContain('Bea Berg');
  });

  it('mit Personen erst, wenn die Mitglieder geladen sind – vorher keine PDF ohne Personen zum Herunterladen', async () => {
    const { rerender, onSchliessen } = await zeigen({
      ansicht: 'liste',
      personen: { wahl: 'alle', mitglieder: null, rollen: ROLLEN },
    });
    expect(bauen).not.toHaveBeenCalled();
    expect(knopf('Herunterladen').disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('Mitglieder werden noch geladen');
    rerender(
      <PdfFenster
        baum={BAUM}
        gemeinde="ECG"
        offen={anfangsOffen(BAUM)}
        spitze={null}
        ansicht="liste"
        personen={{ wahl: 'alle', mitglieder: MITGLIEDER, rollen: ROLLEN }}
        onSchliessen={onSchliessen}
        heute={HEUTE}
      />,
    );
    await act(async () => {});
    expect(bauen).toHaveBeenCalled();
    expect(letzteSeiten()[0].svg.textContent).toContain('Bea Berg');
    expect(knopf('Herunterladen').disabled).toBe(false);
  });

  it('eine tiefere Spitze aus dem Reiter steht als Ausschnitt bereit', async () => {
    await zeigen({ spitze: '10/7', ansicht: 'links' });
    expect(auswahl('Ausschnitt').value).toBe('10/7');
    expect(auswahl('Ausschnitt').selectedOptions[0].text).toBe('Technik');
    expect(seiten()[0].getAttribute('aria-label')).toBe(
      'Organigramm · ECG · Technik, Seite 1 von 1',
    );
  });
});
