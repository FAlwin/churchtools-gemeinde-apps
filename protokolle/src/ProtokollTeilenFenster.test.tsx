// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Person } from '@shared/organigramm/mitglieder';
import type { TreffenStand } from '@shared/protokolle/anwesenheit';
import { neueAufgabe } from '@shared/protokolle/aufgaben';
import type { Block } from '@shared/protokolle/dokument';
import type { ProtokollBlatt } from '@shared/protokolle/protokollBlatt';
import type { ProtokollKopf } from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import {
  ProtokollTeilenFenster,
  type ProtokollTeilenProps,
  type TeilenLesen,
} from './ProtokollTeilenFenster';

/**
 * **„Protokoll teilen“** (S6-3b): liest Anwesenheit und Mitglieder frisch, baut das Blatt aus `protokollBlatt` und zeigt
 * es im Fenster wie im Dienstplaner. Das Blatt wird festgehalten statt gezeichnet (jsdom kann kein pdf.js).
 */
const blaetter = vi.hoisted(() => [] as unknown[]);
vi.mock('@ui/teilen/protokollPdf', () => ({
  protokollPdf: vi.fn(async (b: unknown) => {
    blaetter.push(b);
    const { jsPDF } = await import('jspdf');
    return new jsPDF();
  }),
}));
vi.mock('@ui/teilen/pdfSeiten', () => ({
  renderPdfToCanvases: vi.fn(() => Promise.resolve([])),
  renderPdfSeite: vi.fn(() => Promise.reject(new Error('jsdom'))),
}));

const KOPF: ProtokollKopf = {
  art: 'protokoll',
  fassung: 1,
  sitzung: 's-nov',
  titel: 'Leitungssitzung',
  status: 'frei',
  beginn: '2026-11-11T18:00:00Z',
  termin: null,
  treffen: 54,
  freigabe: { von: 1, am: '2026-11-12T09:00:00Z' },
  sperre: null,
  stand: 'x',
};
const SITZUNG: Sitzung = {
  schluessel: 'p:s-nov',
  beginn: KOPF.beginn,
  titel: 'Leitungssitzung',
  termin: null,
  treffen: 54,
  kopf: KOPF,
  anfragen: [],
};
const DOKUMENT: Block[] = [
  {
    id: 'b1',
    type: 'heading',
    props: { level: 1 },
    content: [{ type: 'text', text: 'Rückblick' }],
  },
  { id: 'b2', type: 'verweis', props: { art: 'anwesenheit' } },
  {
    id: 'b3',
    type: 'aufgabe',
    props: { aufgabe: 't1' },
    content: [{ type: 'text', text: 'Deko' }],
  },
];
const DEKO = neueAufgabe({
  id: 't1',
  gruppe: 11,
  sitzung: 's-nov',
  text: 'Deko',
  von: 1,
  am: '2026-11-11T18:00:00Z',
  wer: [2],
});
const MARIA: Person = { id: 2, name: 'Maria Dück', initialen: 'MD', bild: null };
const ANWESEND: TreffenStand = {
  abgeschlossen: true,
  begonnen: true,
  personen: [{ person: 2, name: 'Maria Dück', status: 'da' }],
};

const lesen = (x: Partial<TeilenLesen> = {}) => ({
  anwesenheit: vi.fn<TeilenLesen['anwesenheit']>(() => Promise.resolve(ANWESEND)),
  mitglieder: vi.fn<TeilenLesen['mitglieder']>(() => Promise.resolve([MARIA])),
  ...x,
});

const zeige = (x: Partial<ProtokollTeilenProps> = {}) =>
  render(
    <ProtokollTeilenFenster
      sitzung={SITZUNG}
      gruppe="Leitungsteam"
      gruppeId={11}
      kopf={KOPF}
      dokument={DOKUMENT}
      aufgaben={[DEKO]}
      protokolle={[]}
      naechste="2026-12-09T18:00:00Z"
      zeitzone="Europe/Berlin"
      gemeinde="ECG Donrath"
      ich={{ person: 1, name: 'Alwin Friesen' }}
      onClose={() => {}}
      lesen={lesen()}
      {...x}
    />,
  );
const letztes = () => blaetter.at(-1) as ProtokollBlatt;
const alles = (b: ProtokollBlatt) => JSON.stringify(b);

describe('Protokoll teilen (S6-3b)', () => {
  it('freigegeben: liest Anwesenheit und Mitglieder frisch, Blatt mit Namen, Datei ohne „ENTWURF“', async () => {
    blaetter.length = 0;
    const l = lesen();
    zeige({ lesen: l });
    expect(await screen.findByRole('dialog', { name: 'Protokoll teilen' })).toBeTruthy();
    expect(
      await screen.findByText(/Fertig · 1 Seite · Protokoll Leitungsteam 2026-11-11\.pdf/),
    ).toBeTruthy();
    expect(l.anwesenheit).toHaveBeenCalledWith(11, 54);
    expect(l.mitglieder).toHaveBeenCalledWith(11);
    const b = letztes();
    expect(b.entwurf).toBe(false);
    expect(b.gemeinde).toBe('ECG Donrath');
    expect(alles(b)).toContain('Maria Dück');
    expect(alles(b)).toContain('Anwesend (1)');
    expect(b.uebersicht.naechste).toMatch(/09\.12\.2026/);
    expect(screen.getByRole('button', { name: /Herunterladen/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Teilen/ })).toBeTruthy();
  });

  it('Entwurf: „ENTWURF“ im Dateinamen, Banner auf dem Blatt', async () => {
    blaetter.length = 0;
    const kopf = { ...KOPF, status: 'entwurf' as const, freigabe: null };
    zeige({ kopf, sitzung: { ...SITZUNG, kopf } });
    expect(await screen.findByText(/Protokoll Leitungsteam 2026-11-11 ENTWURF\.pdf/)).toBeTruthy();
    expect(letztes().banner).toBe('ENTWURF – NOCH NICHT FREIGEGEBEN');
  });

  it('Anwesenheit und Mitglieder nicht lesbar: das PDF entsteht trotzdem, der Grund steht im Log', async () => {
    blaetter.length = 0;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    zeige({
      lesen: lesen({
        anwesenheit: vi.fn(() => Promise.reject(new Error('503'))),
        mitglieder: vi.fn(() => Promise.reject(new Error('504'))),
      }),
    });
    expect(await screen.findByText(/Fertig · 1 Seite/)).toBeTruthy();
    expect(alles(letztes())).toContain('Die Anwesenheit ließ sich nicht laden.');
    // Zuständig ist jemand – ohne Namen gezählt, nicht „noch niemand“.
    expect(alles(letztes())).toContain('eine weitere Person');
    expect(alles(letztes())).not.toContain('noch niemand');
    expect(warn).toHaveBeenCalledWith(
      '[protokoll teilen] Anwesenheit nicht geladen:',
      expect.any(Error),
    );
    expect(warn).toHaveBeenCalledWith(
      '[protokoll teilen] Mitglieder nicht geladen:',
      expect.any(Error),
    );
  });

  it('Mitglieder schon da (Editor): kein zweites Lesen; ohne Gruppentreffen keine Anwesenheit', async () => {
    blaetter.length = 0;
    const l = lesen();
    const kopf = { ...KOPF, treffen: null };
    zeige({ lesen: l, kopf, sitzung: { ...SITZUNG, kopf, treffen: null }, mitglieder: [MARIA] });
    expect(await screen.findByText(/Fertig · 1 Seite/)).toBeTruthy();
    expect(l.mitglieder).not.toHaveBeenCalled();
    expect(l.anwesenheit).not.toHaveBeenCalled();
    expect(alles(letztes())).toContain('Maria Dück');
    expect(alles(letztes())).toContain('Zu dieser Sitzung gibt es kein Gruppentreffen.');
  });

  it('Mitgliederliste verborgen: den eigenen Namen kennt das Blatt trotzdem (aus „ich“)', async () => {
    blaetter.length = 0;
    const meins = { ...DEKO, wer: [1] };
    zeige({
      aufgaben: [meins],
      lesen: lesen({ mitglieder: vi.fn(() => Promise.resolve('verborgen' as const)) }),
    });
    await screen.findByText(/Fertig · 1 Seite/);
    expect(alles(letztes())).toContain('"text":" – Alwin Friesen"');
  });

  it('neu gezeichnet mit gleichen Werten (neues „ich“-Objekt): das PDF entsteht nicht noch einmal', async () => {
    blaetter.length = 0;
    const l = lesen();
    const { rerender } = zeige({ lesen: l });
    await screen.findByText(/Fertig · 1 Seite/);
    const props: ProtokollTeilenProps = {
      sitzung: SITZUNG,
      gruppe: 'Leitungsteam',
      gruppeId: 11,
      kopf: KOPF,
      dokument: DOKUMENT,
      aufgaben: [DEKO],
      protokolle: [],
      naechste: '2026-12-09T18:00:00Z',
      zeitzone: 'Europe/Berlin',
      gemeinde: 'ECG Donrath',
      ich: { person: 1, name: 'Alwin Friesen' },
      onClose: () => {},
      lesen: l,
    };
    rerender(<ProtokollTeilenFenster {...props} />);
    await waitFor(() => expect(screen.getByText(/Fertig · 1 Seite/)).toBeTruthy());
    const vorher = blaetter.length;
    rerender(<ProtokollTeilenFenster {...props} ich={{ person: 1, name: 'Alwin Friesen' }} />);
    rerender(<ProtokollTeilenFenster {...props} ich={{ person: 1, name: 'Alwin Friesen' }} />);
    await waitFor(() => expect(screen.getByText(/Fertig · 1 Seite/)).toBeTruthy());
    expect(blaetter).toHaveLength(vorher);
  });
});
