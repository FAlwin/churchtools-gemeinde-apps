// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ortSchluessel, type Entwurf } from '@shared/dienstplan/entwuerfe';
import type { SendeEintrag, SendeErgebnis } from '@shared/dienstplan/senden';
import { SendenFach, type SendeZeile } from './SendenFach';
import type { SendeHinweis } from './sendeHinweise';

const ALWIN = { personId: 1, name: 'Alwin' };
const SPIKE = { personId: 19, name: 'Spike' };

const entwurf = (eventId: number, serviceId: number, x: Partial<Entwurf> = {}): Entwurf => ({
  ort: { eventId, serviceId, index: null },
  ziel: { art: 'person', personId: 46, name: 'Anna Test' },
  modus: 'anfrage',
  gesehen: { art: 'frei' },
  von: ALWIN,
  zeit: '2026-10-15T08:00:00.000Z',
  version: 1,
  ...x,
});
const zeile = (e: Entwurf, tag: string, dienst: string): SendeZeile => ({
  entwurf: e,
  kategorie: 30,
  tag,
  termin: 'Gottesdienst',
  dienst,
  bisher: null,
});

// Zwei Termine: am 25.10. Anfrage (Ton) und Direkt (Licht), am 01.11. ein Gast (fremd, von Spike).
const ANNA = zeile(entwurf(20, 6), '2026-10-25', 'Ton');
const BEN = zeile(
  entwurf(20, 7, { modus: 'direkt', ziel: { art: 'person', personId: 49, name: 'Ben Test' } }),
  '2026-10-25',
  'Licht',
);
const MAX = zeile(
  entwurf(21, 6, { ziel: { art: 'gast', name: 'Max' }, von: SPIKE }),
  '2026-11-01',
  'Ton',
);
const ZEILEN = [ANNA, BEN, MAX];
const k = (z: SendeZeile) => ortSchluessel(z.entwurf.ort);

type Senden = (
  eintraege: SendeEintrag[],
  melde: (index: number, ergebnis: SendeErgebnis) => void,
) => Promise<SendeErgebnis[]>;

/** Senden, das jedem Eintrag das Ergebnis aus `antworten` gibt (nach dessen Ort) – und mitschreibt. */
function sendenMit(antworten: Map<string, SendeErgebnis>) {
  const runden: SendeEintrag[][] = [];
  const senden = vi.fn<Senden>((eintraege, melde) => {
    runden.push(eintraege);
    const r = eintraege.map((e, i) => {
      const a = antworten.get(ortSchluessel(e.entwurf.ort)) ?? { art: 'gesendet' };
      melde(i, a);
      return a;
    });
    return Promise.resolve(r);
  });
  return { senden, runden };
}

function zeige(
  x: {
    zeilen?: SendeZeile[];
    hinweise?: Map<string, SendeHinweis> | Promise<Map<string, SendeHinweis>>;
    senden?: Senden;
  } = {},
) {
  const onClose = vi.fn();
  const hinweise = vi.fn(() => Promise.resolve(x.hinweise ?? new Map<string, SendeHinweis>()));
  render(
    <SendenFach
      zeilen={x.zeilen ?? ZEILEN}
      ichId={1}
      hinweise={hinweise}
      senden={x.senden ?? sendenMit(new Map()).senden}
      onClose={onClose}
    />,
  );
  return { onClose, hinweise };
}
const knopf = (name: RegExp | string) => screen.getByRole('button', { name });

describe('SendenFach (E4-4-2)', () => {
  it('nach Terminen geordnet; was passiert, in Worten; fremde Entwürfe mit „von“', async () => {
    zeige();
    expect(screen.getByText('So, 25.10. · Gottesdienst')).toBeTruthy();
    expect(screen.getByText('So, 01.11. · Gottesdienst')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Anfrage an Anna Test – Ton' })).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: 'Direkt zuteilen: Ben Test – Licht' }),
    ).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Gast eintragen: Max – Ton' })).toBeTruthy();
    expect(screen.getAllByText('von Spike')).toHaveLength(1);
    const satz = screen.getByText(/bekommen eine Mitteilung in der ChurchTools-App/).textContent;
    expect(satz).toContain('1 Anfrage –');
    expect(satz).toContain('1 direkt zugeteilt –');
    expect(satz).toContain('1 Gast – nur der Name im Plan.');
    expect(knopf('Jetzt senden (3)')).toBeTruthy();
    await screen.findByRole('button', { name: 'Jetzt senden (3)' });
  });

  it('Hinweise: erst „werden geprüft“, dann rot an der Zeile und im Kasten; ungeprüft wird gesagt', async () => {
    let fertig!: (m: Map<string, SendeHinweis>) => void;
    zeige({ hinweise: new Promise((r) => (fertig = r)) });
    expect(screen.getByText(/werden geprüft/)).toBeTruthy();
    await act(async () => {
      fertig(
        new Map<string, SendeHinweis>([
          [k(ANNA), { text: 'abwesend: Urlaub' }],
          [k(BEN), { ungeprueft: true }],
        ]),
      );
      await Promise.resolve();
    });
    expect(screen.queryByText(/werden geprüft/)).toBeNull();
    expect(screen.getByText('abwesend: Urlaub')).toBeTruthy();
    expect(screen.getByText('Hinweise nicht geprüft')).toBeTruthy();
    expect(screen.getByText('1 Einteilung hat einen Hinweis')).toBeTruthy();
    // Abgewählt → kein Kasten mehr (er zählt nur Ausgewähltes).
    fireEvent.click(screen.getByRole('checkbox', { name: /Anna Test/ }));
    expect(screen.queryByText(/einen Hinweis/)).toBeNull();
  });

  it('Häkchen: nur Ausgewähltes wird gesendet, in Reihenfolge; danach steht nur das noch da', async () => {
    const s = sendenMit(new Map());
    zeige({ senden: s.senden });
    await screen.findByRole('button', { name: 'Jetzt senden (3)' });
    fireEvent.click(screen.getByRole('checkbox', { name: /Ben Test/ }));
    fireEvent.click(knopf('Jetzt senden (2)'));
    await screen.findByText('Alle 2 gesendet');
    expect(s.runden).toEqual([
      [
        { entwurf: ANNA.entwurf, kategorie: 30 },
        { entwurf: MAX.entwurf, kategorie: 30 },
      ],
    ]);
    expect(screen.queryByText(/Ben Test/)).toBeNull();
    expect(screen.getByText('angefragt')).toBeTruthy();
    expect(screen.getByText('als Gast eingetragen')).toBeTruthy();
  });

  it('E4-5: Zurückziehen und Ersetzen – Satz oben und Hinweis je Zeile (wer was mitbekommt)', async () => {
    const zurueck: SendeZeile = {
      ...zeile(
        entwurf(22, 6, { ziel: { art: 'frei' }, gesehen: { art: 'anfrage', personId: 49 } }),
        '2026-11-08',
        'Ton',
      ),
      bisher: 'Ben Test',
    };
    const ersetzt: SendeZeile = {
      ...zeile(entwurf(22, 7, { gesehen: { art: 'zusage', personId: 52 } }), '2026-11-08', 'Licht'),
      bisher: 'Clara Test',
    };
    zeige({ zeilen: [zurueck, ersetzt] });
    await screen.findByRole('button', { name: 'Jetzt senden (2)' });
    const satz = [...document.querySelectorAll('p')]
      .map((p) => p.textContent ?? '')
      .find((t) => t.includes('zurückgezogen'));
    expect(satz).toContain('1 ersetzt – wer dort stand, bekommt „Du wurdest … ausgetragen“.');
    expect(satz).toContain('1 zurückgezogen – ChurchTools sagt den Personen nicht Bescheid.');
    expect(screen.getByRole('checkbox', { name: 'Zurückziehen: Ben Test – Ton' })).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: 'Anfrage an Anna Test statt Clara Test – Licht' }),
    ).toBeTruthy();
    expect(screen.getByText(/ChurchTools sagt Ben Test nicht Bescheid/).className).toMatch(
      /warnung/,
    );
    expect(screen.getByText(/Clara Test bekommt von ChurchTools/).className).not.toMatch(/warnung/);
  });

  it('nichts ausgewählt → kein Senden-Knopf', async () => {
    zeige({ zeilen: [ANNA] });
    await screen.findByRole('button', { name: 'Jetzt senden (1)' });
    fireEvent.click(screen.getByRole('checkbox', { name: /Anna Test/ }));
    expect(screen.getByText('Nichts ausgewählt.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /senden/ })).toBeNull();
  });

  it('während des Sendens: Fortschritt, Schließen gesperrt; danach schließt es mit „gesendet“', async () => {
    let melde!: (i: number, r: SendeErgebnis) => void;
    let fertig!: (r: SendeErgebnis[]) => void;
    const senden = vi.fn<Senden>((_, m) => {
      melde = m;
      return new Promise((r) => (fertig = r));
    });
    const { onClose } = zeige({ zeilen: [ANNA, BEN], senden });
    await screen.findByRole('button', { name: 'Jetzt senden (2)' });
    fireEvent.click(knopf('Jetzt senden (2)'));
    expect(screen.getByText('Wird gesendet … 0 von 2')).toBeTruthy();
    expect(screen.getByLabelText('wird gesendet')).toBeTruthy();
    expect(screen.getByLabelText('wartet')).toBeTruthy();
    act(() => melde(0, { art: 'gesendet' }));
    expect(screen.getByText('Wird gesendet … 1 von 2')).toBeTruthy();
    // Gesperrt wie im ConfirmDialog (E6-O F2, #720): X und Abbrechen tun nichts, solange es läuft.
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fenster schließen' }));
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      melde(1, { art: 'gesendet' });
      fertig([{ art: 'gesendet' }, { art: 'gesendet' }]);
      await Promise.resolve();
    });
    fireEvent.click(knopf('Schließen'));
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it('Ergebnis je Zeile; „Erneut senden“ nur für das, was sich lohnt – und nur das wird nochmal versucht', async () => {
    const s = sendenMit(
      new Map<string, SendeErgebnis>([
        [k(ANNA), { art: 'nicht-gesendet', grund: 'konflikt', jetzt: { art: 'frei' } }],
        [k(BEN), { art: 'nicht-gesendet', grund: 'voruebergehend' }],
      ]),
    );
    zeige({ senden: s.senden });
    await screen.findByRole('button', { name: 'Jetzt senden (3)' });
    fireEvent.click(knopf('Jetzt senden (3)'));
    await screen.findByText('1 gesendet, 2 nicht');
    expect(screen.getByText(/Inzwischen steht dort jemand anderes/)).toBeTruthy();
    expect(screen.getByText(/ChurchTools antwortet gerade nicht/)).toBeTruthy();
    expect(screen.getAllByLabelText('nicht gesendet')).toHaveLength(2);
    fireEvent.click(knopf('Erneut senden (1)'));
    await waitFor(() => expect(s.runden).toHaveLength(2));
    expect(s.runden[1]).toEqual([{ entwurf: BEN.entwurf, kategorie: 30 }]);
  });

  it('nichts gesendet → Schließen meldet „nicht gesendet“ (kein Neuladen); Abbrechen vorher genauso', async () => {
    const s = sendenMit(
      new Map<string, SendeErgebnis>([[k(ANNA), { art: 'nicht-gesendet', grund: 'kein-recht' }]]),
    );
    const a = zeige({ zeilen: [ANNA], senden: s.senden });
    await screen.findByRole('button', { name: 'Jetzt senden (1)' });
    fireEvent.click(knopf('Abbrechen'));
    expect(a.onClose).toHaveBeenLastCalledWith(false);
    fireEvent.click(knopf('Jetzt senden (1)'));
    await screen.findByText('0 gesendet, 1 nicht');
    expect(screen.queryByRole('button', { name: /Erneut senden/ })).toBeNull();
    fireEvent.click(knopf('Schließen'));
    expect(a.onClose).toHaveBeenLastCalledWith(false);
  });

  it('nichts gesendet, aber Konflikt → Schließen lässt neu laden (die Matrix wäre sonst veraltet)', async () => {
    const s = sendenMit(
      new Map<string, SendeErgebnis>([
        [
          k(ANNA),
          { art: 'nicht-gesendet', grund: 'konflikt', jetzt: { art: 'anfrage', personId: 64 } },
        ],
      ]),
    );
    const a = zeige({ zeilen: [ANNA], senden: s.senden });
    fireEvent.click(await screen.findByRole('button', { name: 'Jetzt senden (1)' }));
    await screen.findByText('0 gesendet, 1 nicht');
    fireEvent.click(knopf('Schließen'));
    expect(a.onClose).toHaveBeenLastCalledWith(true);
  });
});

/** Fenster wie ChurchTools (E6-O F2, #720): X oben rechts, die Knöpfe unten rechts – der Hauptknopf zuletzt. */
const knopfFolge = () =>
  screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);

describe('SendenFach im ChurchTools-Aufbau', () => {
  it('X oben, unten Abbrechen und Jetzt senden', async () => {
    zeige();
    await screen.findByRole('button', { name: /^Jetzt senden/ });
    expect(screen.getByRole('dialog', { name: 'Einteilungen senden' })).toBeTruthy();
    expect(knopfFolge()[0]).toBe('Fenster schließen');
    expect(knopfFolge().at(-2)).toBe('Abbrechen');
    expect(knopfFolge().at(-1)).toMatch(/^Jetzt senden \(\d+\)$/);
  });
});
